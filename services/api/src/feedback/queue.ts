import type pg from "pg";
import type {
  FeedbackBulkTriage,
  FeedbackGroup,
  FeedbackKind,
  FeedbackQueue,
  FeedbackQuery,
  FeedbackReport,
  FeedbackSeverity,
  FeedbackStatus,
} from "@octa/contracts";
import { csvLine } from "../csv.js";
import type { Db } from "../db.js";

/**
 * `/feedback`'s triage queue: one query shape for the page and the CSV.
 *
 * Rebuilt 29 Sep 2026 on the instructor's rulings of that day:
 *
 *  - **Exact repeats are one group.** Same kind, item, route, status and text
 *    (trimmed, whitespace collapsed, case folded). The seed carried one
 *    complaint five times and each was triaged on its own. A report with no
 *    text is its own group: two blank CSATs are not the same complaint.
 *  - **Filtered on the server** (status, kind) and **paged by a keyset cursor
 *    over groups**, newest activity first, so a cap never hides a report. The
 *    old GET stopped at 300 rows and said nothing.
 *  - **SUS by role**, each with its n (`PAGE-SPECS.md` §4.3).
 *
 * SUS responses are never in the queue: they are the panel.
 */

/** The group key, in SQL, over a row aliased `f`. */
const GROUP_KEY = `
  case when nullif(btrim(f.body), '') is null then 'r:' || f.id::text
       else 'g:' || md5(f.channel::text || '|' || coalesce(f.item_id::text, '') || '|' ||
                        coalesce(f.route, '') || '|' || f.status::text || '|' ||
                        lower(regexp_replace(btrim(f.body), '\\s+', ' ', 'g')))
  end`;

/** The reports a filter matches, each with its group key. `$1` status, `$2` kind. */
const MATCHING = `
  select f.*, ${GROUP_KEY} as gkey
    from feedback f
   where f.channel <> 'sus'
     and ($1::text is null or f.status  = $1::feedback_status)
     and ($2::text is null or f.channel = $2::feedback_channel)`;

export const FEEDBACK_EXPORT_MAX = 50_000;

interface ReportRow {
  id: string;
  gkey: string;
  channel: FeedbackKind;
  category: string | null;
  body: string | null;
  rating: number | null;
  route: string | null;
  app_version: string | null;
  context: Record<string, unknown> | null;
  item_id: string | null;
  item_slug: string | null;
  resolved_variant: unknown;
  status: FeedbackStatus;
  severity: string | null;
  released_in: string | null;
  triaged_by: string | null;
  triaged_by_name: string | null;
  updated_at: Date;
  created_at: Date;
  role: string;
  reporter_name: string | null;
}

const REPORT_COLUMNS = `
  m.id, m.gkey, m.channel, m.category, m.body, m.rating, m.route, m.app_version, m.context,
  m.item_id, i.slug as item_slug, m.resolved_variant, m.status, m.severity, m.released_in,
  m.triaged_by, t.full_name as triaged_by_name, m.updated_at, m.created_at, m.role::text as role,
  p.full_name as reporter_name`;

const REPORT_JOINS = `
  left join profiles p on p.id = m.user_id
  left join profiles t on t.id = m.triaged_by
  left join items    i on i.id = m.item_id`;

const SEVERITIES = new Set(["low", "medium", "high"]);
const asSeverity = (s: string | null): FeedbackSeverity | null =>
  s && SEVERITIES.has(s) ? (s as FeedbackSeverity) : null;

function toReport(r: ReportRow): FeedbackReport {
  return {
    id: r.id,
    reporterName: r.reporter_name,
    role: r.role,
    createdAt: r.created_at.toISOString(),
    route: r.route,
    appVersion: r.app_version,
    category: r.category,
    rating: r.rating === null ? null : Number(r.rating),
    context: r.context ?? {},
    resolvedVariant: r.resolved_variant ?? null,
  };
}

/** A group from its reports, newest first. The newest report speaks for the group. */
function toGroup(key: string, rows: ReportRow[]): FeedbackGroup {
  const newest = rows[0]!;
  const triaged = rows
    .filter((r) => r.triaged_by)
    .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())[0];
  return {
    key,
    status: newest.status,
    kind: newest.channel,
    category: newest.category,
    body: newest.body,
    severity: asSeverity(newest.severity),
    releasedIn: newest.released_in,
    item: newest.item_id ? { id: newest.item_id, slug: newest.item_slug } : null,
    route: newest.route,
    count: rows.length,
    firstAt: rows[rows.length - 1]!.created_at.toISOString(),
    lastAt: newest.created_at.toISOString(),
    triagedBy: triaged ? { id: triaged.triaged_by!, name: triaged.triaged_by_name } : null,
    triagedAt: triaged ? triaged.updated_at.toISOString() : null,
    reports: rows.map(toReport),
  };
}

/** `<microseconds since epoch>.<group key>`: exact, unlike an ISO string, which drops microseconds. */
function parseCursor(before: string | undefined): { us: string; key: string } | null {
  if (!before) return null;
  const dot = before.indexOf(".");
  const us = before.slice(0, dot);
  if (dot < 1 || !/^\d+$/.test(us)) return null;
  return { us, key: before.slice(dot + 1) };
}

export async function loadFeedbackQueue(db: Db, q: FeedbackQuery): Promise<FeedbackQueue> {
  const status = q.status ?? null;
  const kind = q.kind ?? null;
  const cursor = parseCursor(q.before);

  const { rows: page } = await db.query<{ gkey: string; last_us: string }>(
    `with m as (${MATCHING}),
          g as (select gkey, (extract(epoch from max(created_at)) * 1000000)::bigint as last_us
                  from m group by gkey)
     select gkey, last_us::text from g
      where $3::bigint is null or (last_us, gkey) < ($3::bigint, $4::text)
      order by last_us desc, gkey desc
      limit $5`,
    [status, kind, cursor?.us ?? null, cursor?.key ?? null, q.limit + 1],
  );
  const more = page.length > q.limit;
  const keys = page.slice(0, q.limit);

  const { rows: reports } = keys.length
    ? await db.query<ReportRow>(
        `with m as (${MATCHING})
         select ${REPORT_COLUMNS} from m ${REPORT_JOINS}
          where m.gkey = any($3::text[])
          order by m.created_at desc, m.id desc`,
        [status, kind, keys.map((k) => k.gkey)],
      )
    : { rows: [] as ReportRow[] };
  const byKey = new Map<string, ReportRow[]>();
  for (const r of reports) byKey.set(r.gkey, [...(byKey.get(r.gkey) ?? []), r]);

  const { rows: [total] } = await db.query<{ groups: number; reports: number }>(
    `with m as (${MATCHING}) select count(distinct gkey)::int as groups, count(*)::int as reports from m`,
    [status, kind],
  );

  // The status filter's own counts: every status, for the current kind.
  const { rows: byStatus } = await db.query<{ status: FeedbackStatus; n: number }>(
    `select status, count(*)::int as n from feedback
      where channel <> 'sus' and ($1::text is null or channel = $1::feedback_channel)
      group by status`,
    [kind],
  );
  const counts: Record<FeedbackStatus, number> = { new: 0, triaged: 0, in_progress: 0, shipped: 0, wont_fix: 0 };
  for (const r of byStatus) counts[r.status] = r.n;

  const { rows: sus } = await db.query<{ who: "student" | "staff"; n: number; mean: string | null }>(
    `select case when role = 'student' then 'student' else 'staff' end as who,
            count(*)::int as n, round(avg(sus_score), 1)::text as mean
       from feedback where channel = 'sus' and sus_score is not null
      group by 1`,
  );
  const fig = (who: "student" | "staff") => {
    const r = sus.find((x) => x.who === who);
    return { n: r?.n ?? 0, mean: r?.mean == null ? null : Number(r.mean) };
  };

  const last = keys[keys.length - 1];
  return {
    groups: keys.map((k) => toGroup(k.gkey, byKey.get(k.gkey) ?? [])).filter((g) => g.reports.length > 0),
    next: more && last ? `${last.last_us}.${last.gkey}` : null,
    total: { groups: total?.groups ?? 0, reports: total?.reports ?? 0 },
    counts,
    sus: { student: fig("student"), staff: fig("staff") },
  };
}

/* ------------------------------------------------------------------ CSV */

export const FEEDBACK_CSV_COLUMNS = [
  "received_at", "kind", "category", "status", "severity", "released_in", "reporter", "role",
  "route", "app_version", "item", "rating", "body", "repeats", "id",
] as const;

/** Every matching report, one line each, with its group's size. */
export async function loadFeedbackCsv(
  db: Db,
  q: Pick<FeedbackQuery, "status" | "kind">,
): Promise<{ csv: string; total: number }> {
  const { rows } = await db.query<ReportRow & { repeats: number }>(
    `with m as (${MATCHING})
     select ${REPORT_COLUMNS}, count(*) over (partition by m.gkey)::int as repeats
       from m ${REPORT_JOINS}
      order by m.created_at desc, m.id desc
      limit ${FEEDBACK_EXPORT_MAX + 1}`,
    [q.status ?? null, q.kind ?? null],
  );
  const lines = [FEEDBACK_CSV_COLUMNS.join(",")];
  for (const r of rows.slice(0, FEEDBACK_EXPORT_MAX)) {
    lines.push(
      csvLine([
        r.created_at.toISOString(), r.channel, r.category, r.status, r.severity, r.released_in,
        r.reporter_name, r.role, r.route, r.app_version, r.item_slug ?? r.item_id,
        r.rating === null ? "" : String(r.rating), r.body, String(r.repeats), r.id,
      ]),
    );
  }
  return { csv: `${lines.join("\n")}\n`, total: rows.length };
}

/* --------------------------------------------------------- bulk triage */

/**
 * One decision for every report in a group: one transaction, and one
 * `audit_log` row per report saying the state it left. If any id does not
 * exist, nothing is written. `severity` / `releasedIn`: null clears, absent
 * leaves.
 */
export async function triageFeedback(
  client: pg.PoolClient,
  actor: string,
  b: FeedbackBulkTriage,
): Promise<{ updated: number } | null> {
  const ids = [...new Set(b.ids)];
  const { rows: before } = await client.query<{ id: string; status: FeedbackStatus }>(
    "select id, status from feedback where id = any($1::uuid[]) for update",
    [ids],
  );
  if (before.length !== ids.length) return null;

  const setSeverity = b.severity !== undefined;
  const setRelease = b.releasedIn !== undefined;
  await client.query(
    `update feedback
        set status      = $2::feedback_status,
            severity    = case when $3 then $4 else severity end,
            released_in = case when $5 then $6 else released_in end,
            triaged_by  = $7, updated_at = now()
      where id = any($1::uuid[])`,
    [ids, b.status, setSeverity, b.severity ?? null, setRelease, b.releasedIn || null, actor],
  );

  for (const r of before) {
    await client.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1, 'feedback.triage', 'feedback', $2, $3)`,
      [
        actor,
        r.id,
        JSON.stringify({
          status: b.status,
          previousStatus: r.status,
          ...(setSeverity ? { severity: b.severity } : {}),
          ...(setRelease ? { releasedIn: b.releasedIn || null } : {}),
          groupSize: ids.length,
        }),
      ],
    );
  }
  return { updated: ids.length };
}
