import {
  AUDIT_FAMILY_PREFIXES,
  AuditFamily,
  type AuditEntry,
  type AuditPage,
  type AuditQuery,
} from "@octa/contracts";
import { csvCell } from "../csv.js";
import type { Db } from "../db.js";

/**
 * `/audit`'s reads: one query, enriched once, for the page and the CSV.
 *
 * PAGE-SPECS.md §/console/audit: "If a grade is ever challenged, this is the
 * evidence." Until 28 Sep 2026 the route returned the newest 100 (500 at most)
 * and the page filtered only those, so an October row had left the page by
 * December. Every filter now runs here, over the whole log, and the page
 * extends backwards with a keyset cursor (instructor, 28 Sep 2026).
 *
 * The sentence (`what`) is written HERE, not in the console, so the page and
 * the file a teacher hands a dean cannot say different things about one row.
 */

/** A row of the enriched log: the entry, plus what its ids point at today. */
interface Row {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  at: Date;
  actor_id: string | null;
  actor_name: string | null;
  subject_user_id: string | null;
  subject_name: string | null;
  subject_student_id: string | null;
  item_slug: string | null;
  assessment_title: string | null;
  block_stage: string | null;
  block_ordinal: number | null;
  submission_title: string | null;
  stage_title: string | null;
  section_code: string | null;
}

/*
 * The subject is the STUDENT an entry is about, wherever the entry keeps them:
 * a lock's `userId` in its payload, a roster row's student ID as its target, a
 * submission's owner, or a profile. "Everything about Juan" is one search
 * because of this join, and "who opened stage 06 for Juan" is answerable
 * without anyone knowing that a lock stores its student in the payload.
 */
const ENRICHED = `
  select l.id, l.action, l.target_type, l.target_id, l.payload, l.at, l.actor_id,
         a.full_name                                                      as actor_name,
         coalesce(su.id, sd.claimed_by, sb.user_id, tp.id)                as subject_user_id,
         coalesce(su.full_name, sd.full_name, sbp.full_name, tp.full_name) as subject_name,
         coalesce(su.student_id, sd.student_id, sbp.student_id, tp.student_id) as subject_student_id,
         it.slug   as item_slug,
         asm.title as assessment_title,
         cb.stage_id as block_stage,
         cb.ordinal  as block_ordinal,
         sb.title  as submission_title,
         st.title  as stage_title,
         sec.code  as section_code
    from audit_log l
    left join profiles a  on a.id = l.actor_id
    left join profiles su on su.id = case
           when l.payload->>'userId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then (l.payload->>'userId')::uuid end
    left join student_directory sd on l.target_type in ('student', 'student_directory')
                                  and sd.student_id = l.target_id
    left join submissions sb  on l.target_type = 'submission'    and sb.id::text  = l.target_id
    left join profiles sbp    on sbp.id = sb.user_id
    left join profiles tp     on l.target_type = 'profile'       and tp.id::text  = l.target_id
    left join items it        on l.target_type = 'item'          and it.id::text  = l.target_id
    left join assessments asm on l.target_type = 'assessment'    and asm.id::text = l.target_id
    left join content_blocks cb on l.target_type = 'content_block' and cb.id::text = l.target_id
    left join stages st on st.id = case when l.target_type = 'stage' then l.target_id
                                        else coalesce(cb.stage_id, it.stage_id, l.payload->>'stageId') end
    left join sections sec on sec.id::text = l.payload->>'sectionId'
`;

/** What `q` is matched against: who it is about, what it touched, and why. */
const SEARCHED = `concat_ws(' ',
    e.subject_name, e.subject_student_id, e.target_id, e.item_slug, e.payload->>'slug',
    e.assessment_title, e.payload->>'title', e.stage_title, e.submission_title, e.section_code,
    e.payload->>'reason', e.payload->>'from', e.payload->>'to', e.payload->>'fullName')`;

function where(q: AuditQuery, withCursor: boolean): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (q.family) clauses.push(`split_part(e.action, '.', 1) = any(${p([...AUDIT_FAMILY_PREFIXES[q.family]])}::text[])`);
  if (q.actor === "system") clauses.push("e.actor_id is null");
  else if (q.actor) clauses.push(`e.actor_id = ${p(q.actor)}::uuid`);
  if (q.from) clauses.push(`e.at >= ${p(q.from)}::timestamptz`);
  if (q.to) clauses.push(`e.at < ${p(q.to)}::timestamptz`);
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    clauses.push(`${SEARCHED} ilike ${p(like)} escape '\\'`);
  }
  if (withCursor && q.before) {
    clauses.push(`(e.at, e.id) < (select at, id from audit_log where id = ${p(q.before)}::bigint)`);
  }
  return { sql: clauses.length ? `where ${clauses.join(" and ")}` : "", params };
}

export async function loadAuditPage(db: Db, q: AuditQuery): Promise<AuditPage> {
  const page = where(q, true);
  const all = where(q, false);
  const [rows, total, actors] = await Promise.all([
    db.query<Row>(
      `with e as (${ENRICHED}) select * from e ${page.sql}
        order by e.at desc, e.id desc limit ${q.limit + 1}`,
      page.params,
    ),
    db.query<{ n: string }>(`with e as (${ENRICHED}) select count(*) as n from e ${all.sql}`, all.params),
    db.query<{ id: string | null; name: string | null }>(
      `select distinct l.actor_id as id, p.full_name as name
         from audit_log l left join profiles p on p.id = l.actor_id`,
    ),
  ]);

  const more = rows.rows.length > q.limit;
  const shown = more ? rows.rows.slice(0, q.limit) : rows.rows;
  return {
    entries: shown.map(toEntry),
    next: more ? shown[shown.length - 1]!.id : null,
    total: Number(total.rows[0]?.n ?? 0),
    actors: actors.rows
      .map((a) => ({ id: a.id, name: a.id === null ? "System (scheduled)" : (a.name ?? "An account with no name") }))
      .sort((x, y) => (x.id === null ? 1 : y.id === null ? -1 : x.name.localeCompare(y.name))),
  };
}

/** An export past this many rows is refused with a sentence, not streamed for minutes. */
export const AUDIT_EXPORT_MAX = 50_000;

export async function loadAuditExport(db: Db, q: AuditQuery): Promise<{ entries: AuditEntry[]; total: number }> {
  const all = where(q, false);
  const { rows: count } = await db.query<{ n: string }>(
    `with e as (${ENRICHED}) select count(*) as n from e ${all.sql}`,
    all.params,
  );
  const total = Number(count[0]?.n ?? 0);
  if (total > AUDIT_EXPORT_MAX) return { entries: [], total };
  const { rows } = await db.query<Row>(
    `with e as (${ENRICHED}) select * from e ${all.sql} order by e.at desc, e.id desc`,
    all.params,
  );
  return { entries: rows.map(toEntry), total };
}

/* ------------------------------------------------------------------ */

function familyOf(action: string): AuditFamily | null {
  const prefix = action.split(".")[0] ?? "";
  for (const f of AuditFamily.options) if (AUDIT_FAMILY_PREFIXES[f].includes(prefix)) return f;
  return null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function toEntry(r: Row): AuditEntry {
  const payload = r.payload ?? {};
  const subject = r.subject_name
    ? { userId: r.subject_user_id, name: r.subject_name, studentId: r.subject_student_id }
    : null;
  return {
    id: String(r.id),
    at: new Date(r.at).toISOString(),
    action: r.action,
    family: familyOf(r.action),
    what: describe(r, payload),
    actor: r.actor_id ? { id: r.actor_id, name: r.actor_name } : null,
    subject,
    target: r.target_type ? { type: r.target_type, id: r.target_id, label: targetLabel(r, payload) } : null,
    reason: str(payload.reason),
    payload,
  };
}

function targetLabel(r: Row, p: Record<string, unknown>): string {
  const id = r.target_id ?? "";
  switch (r.target_type) {
    case "stage":
      return `Stage ${id}${r.stage_title ? ` · ${r.stage_title}` : ""}`;
    case "item":
      return r.item_slug ?? str(p.slug) ?? `Item ${id}`;
    case "assessment":
      return r.assessment_title ?? str(p.title) ?? `Assessment ${id}`;
    case "content_block": {
      const stage = r.block_stage ?? str(p.stageId);
      const ordinal = r.block_ordinal ?? num(p.ordinal);
      return stage && ordinal !== null ? `Stage ${stage}, block ${ordinal}` : `Block ${id}`;
    }
    case "submission":
      return r.submission_title ?? `Submission ${id}`;
    case "student":
    case "student_directory":
      return r.subject_name ? `${r.subject_name} (${id})` : `Student ${id}`;
    case "section":
      return `Section ${id}`;
    case "profile":
      return r.subject_name ?? `Account ${id}`;
    case "feedback":
      return `Feedback report ${id}`;
    case "chat_message":
      return /^\d+ messages$/.test(id) ? `${id} in the class chat` : "A message in the class chat";
    default:
      return `${r.target_type} ${id}`.trim();
  }
}

const LOCK_VERB: Record<string, string> = { unlocked: "Opened", locked: "Closed" };
const FEEDBACK_STATE: Record<string, string> = {
  new: "new", triaged: "triaged", in_progress: "in progress", shipped: "shipped", wont_fix: "won't fix",
};

/** One sentence per entry: who is in its own column, so this says what, to what, for whom. */
export function describe(r: Row, p: Record<string, unknown>): string {
  const name = r.subject_name ?? str(p.fullName) ?? (r.target_id ? `student ${r.target_id}` : "a student");
  const stage = str(p.stageId) ?? r.target_id ?? "?";
  const item = r.item_slug ?? str(p.slug);
  const itemWords = item ? `item ${item}` : "an item";
  const title = r.assessment_title ?? str(p.title) ?? "an assessment";

  switch (r.action) {
    case "lock.set":
    case "lock.window": {
      const scope = str(p.scope);
      const forWhom =
        scope === "user" ? ` for ${r.subject_name ?? "one student"}`
        : scope === "section" ? ` for section ${r.section_code ?? "(a section)"}`
        : " for everyone";
      const scheduled =
        r.action === "lock.window" ? ", on its schedule" : str(p.unlockAt) || str(p.lockAt) ? ", on a schedule" : "";
      const verb = LOCK_VERB[str(p.state) ?? ""];
      return verb
        ? `${verb} stage ${stage}${forWhom}${scheduled}`
        : `Returned stage ${stage} to its prerequisites${forWhom}`;
    }
    case "roster.import": {
      const added = Array.isArray(p.inserted) ? p.inserted.length : 0;
      const updated = Array.isArray(p.updated) ? p.updated.length : 0;
      return `Imported the roster for ${r.target_id ?? "a section"}: ${added} added, ${updated} updated`;
    }
    case "roster.deactivate":
      return `Deactivated ${name}`;
    case "roster.reactivate":
      return `Reactivated ${name}`;
    case "roster.section":
      return `Moved ${name} from ${str(p.from) ?? "no section"} to ${str(p.to) ?? "no section"}`;
    case "auth.register":
      return `Claimed student ID ${r.target_id ?? "?"}`;
    case "account.credentials":
      return "Changed their sign-in email and password";
    case "admin.bootstrap":
      return "Created the first administrator account";
    case "item.create":
      return `Created ${itemWords}${p.via === "import" ? " by import" : ""}`;
    case "item.version":
      return `Versioned ${itemWords}${num(p.version) !== null ? ` to version ${num(p.version)}` : ""}`;
    case "item.status":
      return `Moved ${itemWords} from ${str(p.from) ?? "?"} to ${str(p.to) ?? "?"}${
        p.selfApproved === true ? ", approving their own item" : ""
      }`;
    case "assessment.create":
      return `Created the assessment ${title}`;
    case "assessment.window":
      return `Changed when ${title} is open`;
    case "assessment.salt_rotate":
      return `Rotated the exam salt of ${title}`;
    case "submission.grade": {
      const score = num(p.score);
      const max = num(p.maxScore);
      const what = r.submission_title ?? "a submission";
      return `Marked ${what} for ${name}${score !== null && max !== null ? `: ${score} of ${max}` : ""}`;
    }
    case "submission.return":
      return `Returned ${r.submission_title ?? "a submission"} to ${name} for revision`;
    case "content.edit": {
      const from = num(p.previousVersion);
      const to = num(p.version);
      return `Edited block ${num(p.ordinal) ?? "?"} of stage ${stage}${
        from !== null && to !== null ? ` (version ${from} to ${to})` : ""
      }`;
    }
    case "summary.approve":
      return `Approved the summary for stage ${stage}`;
    case "summary.send_back":
      return `Sent back the summary for stage ${stage}${p.wasLive === true ? ", taking it off students' screens" : ""}`;
    case "feedback.triage":
      return `Marked a feedback report ${FEEDBACK_STATE[str(p.status) ?? ""] ?? "as reviewed"}`;
    case "live.start":
      return `Put ${item ?? "a question"} to the room, ${
        str(p.sectionId) ? `for section ${r.section_code ?? str(p.section) ?? "(a section)"}` : "for everyone"
      }`;
    case "live.end": {
      const n = num(p.answered);
      return `Ended ${item ?? "a question"}${n !== null ? ` after ${n} ${n === 1 ? "answer" : "answers"}` : ""}`;
    }
    /* The class chat (6 Oct 2026). The removed text is in the payload, which Details shows. */
    case "chat.message.removed":
      return "Removed a student's message from the class chat";
    case "chat.attachment.removed": {
      const f = Array.isArray(p.files) ? (p.files[0] as { name?: unknown } | undefined) : undefined;
      return `Removed ${str(f?.name) ?? "an attachment"} from the class chat to free storage`;
    }
    case "chat.attachments.pruned": {
      const n = Array.isArray(p.files) ? p.files.length : 0;
      return `Removed ${n} chat ${n === 1 ? "attachment" : "attachments"} older than ${num(p.olderThanDays) ?? "?"} days`;
    }
    default:
      return `${r.action}${r.target_type ? ` on ${r.target_type} ${r.target_id ?? ""}`.trimEnd() : ""}`;
  }
}

/* ------------------------------------------------------------------ CSV */

export const AUDIT_CSV_COLUMNS = [
  "at", "action", "what", "who", "who_id", "about", "about_student_id",
  "target_type", "target_id", "target", "reason", "payload",
] as const;

/**
 * A reason is typed by a person, and this file is opened in Excel by someone
 * else: the log must never be the thing that executes. The guard is shared with
 * `/feedback`'s export (`csv.ts`).
 */
const cell = csvCell;

export function toAuditCsv(entries: AuditEntry[]): string {
  const lines = [AUDIT_CSV_COLUMNS.join(",")];
  for (const e of entries) {
    lines.push(
      [
        e.at, e.action, e.what,
        e.actor ? (e.actor.name ?? "") : "System (scheduled)",
        e.actor?.id ?? "",
        e.subject?.name ?? "", e.subject?.studentId ?? "",
        e.target?.type ?? "", e.target?.id ?? "", e.target?.label ?? "",
        e.reason ?? "",
        JSON.stringify(e.payload),
      ].map(cell).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
