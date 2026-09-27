import { AUDIT_FAMILY_LABELS, AuditFamily, type AuditEntry } from "@octa/contracts";

/**
 * `/audit`'s pure half: the filter as the address holds it, the range as the
 * API wants it, and an entry's recorded fields as a teacher reads them.
 * Tested in `test/audit-view.spec.ts`.
 */

/** The filter as it lives in the address, so a view can be linked as evidence. */
export interface AuditFilters {
  family: AuditFamily | null;
  /** A user id, or "system". */
  actor: string | null;
  q: string;
  /** Local calendar days, `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readFilters(p: URLSearchParams): AuditFilters {
  const family = AuditFamily.safeParse(p.get("family"));
  const day = (v: string | null) => (v && DAY.test(v) ? v : "");
  return {
    family: family.success ? family.data : null,
    actor: p.get("actor") || null,
    q: (p.get("q") ?? "").trim(),
    from: day(p.get("from")),
    to: day(p.get("to")),
  };
}

export function hasFilter(f: AuditFilters): boolean {
  return Boolean(f.family || f.actor || f.q || f.from || f.to);
}

/** Local midnight of a `YYYY-MM-DD`, as an instant. */
function midnight(day: string, addDays = 0): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d + addDays).toISOString();
}

/**
 * The API's parameters. A day is the TEACHER's day: `from` is its local
 * midnight, `to` the midnight after the last day asked for, so "28 Sep to 28
 * Sep" is one whole local day and nothing from the 29th.
 */
export function apiParams(f: AuditFilters, before?: string | null): URLSearchParams {
  const out = new URLSearchParams({ limit: "100" });
  if (f.family) out.set("family", f.family);
  if (f.actor) out.set("actor", f.actor);
  if (f.q) out.set("q", f.q);
  if (f.from) out.set("from", midnight(f.from));
  if (f.to) out.set("to", midnight(f.to, 1));
  if (before) out.set("before", before);
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "28 Sep 2026", built by hand: ICU writes "Sept" for en-GB (NEXT-SESSION §0e.5). */
export function entryDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14:03", local, 24-hour: evidence needs the time, not "3 hours ago". */
export function entryTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The timeline's day heading: "Monday, 28 Sep 2026". */
export function dayHeading(iso: string): string {
  return `${WEEKDAYS[new Date(iso).getDay()]}, ${entryDay(iso)}`;
}

/** A local-day key, for grouping the timeline. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayWords(day: string): string {
  return entryDay(midnight(day));
}

/** What the filter asks, in words, for the result line and the empty state. */
export function filterWords(f: AuditFilters, actorName: (id: string) => string): string {
  const parts: string[] = [];
  if (f.family) parts.push(AUDIT_FAMILY_LABELS[f.family]);
  if (f.actor) parts.push(`by ${f.actor === "system" ? "System (scheduled)" : actorName(f.actor)}`);
  if (f.q) parts.push(`about “${f.q}”`);
  if (f.from && f.to) parts.push(f.from === f.to ? `on ${dayWords(f.from)}` : `from ${dayWords(f.from)} to ${dayWords(f.to)}`);
  else if (f.from) parts.push(`from ${dayWords(f.from)}`);
  else if (f.to) parts.push(`up to ${dayWords(f.to)}`);
  return parts.join(" · ");
}

/* ------------------------------------------------------------ details */

export interface Field {
  label: string;
  value: string;
  /** Numbers, ids, hashes, keys: what the machine sees. */
  mono?: boolean;
  /** Text a person wrote or approved, shown whole. */
  quote?: boolean;
}

const LOCK_SCOPE: Record<string, string> = { global: "Everyone", section: "A section", user: "One student" };
const LOCK_STATE: Record<string, string> = { unlocked: "Open", locked: "Closed", auto: "Back to its prerequisites" };

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const when = (v: unknown): string | null => {
  const s = str(v);
  return s ? `${entryDay(s)} ${entryTime(s)}` : null;
};
const idList = (ids: unknown[]) => (ids.length === 0 ? "0" : `${ids.length}: ${ids.join(", ")}`);
const humanise = (k: string) => k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/**
 * Every recorded field of an entry, in words. The reason is not here: it has
 * its own column and is never truncated. Nothing recorded is dropped: a field
 * this function has no words for is listed under its own name.
 */
export function detailFields(e: AuditEntry): Field[] {
  const p = e.payload;
  const out: Field[] = [];
  const used = new Set<string>(["reason"]);
  const add = (keys: string[], f: Field | null) => {
    keys.forEach((k) => used.add(k));
    if (f) out.push(f);
  };

  switch (e.action) {
    case "summary.approve":
      add(["text"], str(p.text) ? { label: "Text approved", value: str(p.text)!, quote: true } : null);
      add(["hash"], str(p.hash) ? { label: "Text hash", value: str(p.hash)!, mono: true } : null);
      break;
    case "summary.send_back":
      add(["wasLive"], {
        label: "Was on students' screens",
        value: p.wasLive === true ? "Yes: sending it back took it off them" : "No: it had not been approved",
      });
      break;
    case "content.edit":
      add(["stageId"], str(p.stageId) ? { label: "Stage", value: str(p.stageId)!, mono: true } : null);
      add(["ordinal"], num(p.ordinal) !== null ? { label: "Block", value: String(num(p.ordinal)), mono: true } : null);
      add(["previousVersion", "version"], num(p.version) !== null
        ? { label: "Version", value: `${num(p.previousVersion) ?? "?"} → ${num(p.version)}`, mono: true }
        : null);
      break;
    case "lock.set":
    case "lock.window":
      add(["scope"], str(p.scope) ? { label: "For", value: LOCK_SCOPE[str(p.scope)!] ?? str(p.scope)! } : null);
      add(["state"], str(p.state) ? { label: "Now", value: LOCK_STATE[str(p.state)!] ?? str(p.state)! } : null);
      add(["unlockAt", "unlock_at"], when(p.unlockAt ?? p.unlock_at) ? { label: "Opens", value: when(p.unlockAt ?? p.unlock_at)!, mono: true } : null);
      add(["lockAt", "lock_at"], when(p.lockAt ?? p.lock_at) ? { label: "Closes", value: when(p.lockAt ?? p.lock_at)!, mono: true } : null);
      add(["bulk"], num(p.bulk) !== null ? { label: "Part of one change to", value: `${num(p.bulk)} cells`, mono: true } : null);
      break;
    case "assessment.window": {
      const from = (p.from ?? {}) as Record<string, unknown>;
      const to = (p.to ?? {}) as Record<string, unknown>;
      const pair = (k: string, fmt: (v: unknown) => string | null) =>
        `${fmt(from[k]) ?? "not set"} → ${fmt(to[k]) ?? "not set"}`;
      add(["from", "to"], null);
      out.push({ label: "Opens", value: pair("opensAt", when), mono: true });
      out.push({ label: "Closes", value: pair("closesAt", when), mono: true });
      out.push({ label: "Attempts allowed", value: pair("attemptsAllowed", (v) => (num(v) === null ? null : String(num(v)))), mono: true });
      break;
    }
    case "submission.grade":
      add(["score", "maxScore"], num(p.score) !== null
        ? { label: "Mark", value: `${num(p.score)} of ${num(p.maxScore) ?? "?"}`, mono: true }
        : null);
      break;
    case "submission.return": {
      const prev = (p.previous ?? {}) as Record<string, unknown>;
      add(["previous"], num(prev.score) !== null
        ? { label: "The mark it replaced", value: `${num(prev.score)} of ${num(prev.maxScore) ?? "?"}`, mono: true }
        : null);
      if (str(prev.feedbackMd)) out.push({ label: "The feedback it replaced", value: str(prev.feedbackMd)!, quote: true });
      break;
    }
    case "item.status":
      add(["from", "to"], { label: "Status", value: `${str(p.from) ?? "?"} → ${str(p.to) ?? "?"}` });
      add(["bulk"], p.bulk === true ? { label: "How", value: "In one bulk step" } : null);
      add(["selfApproved"], p.selfApproved === true ? { label: "Approved by", value: "Its own author" } : null);
      break;
    case "roster.import":
      add(["inserted"], Array.isArray(p.inserted) ? { label: "Added", value: idList(p.inserted), mono: true } : null);
      add(["updated"], Array.isArray(p.updated) ? { label: "Updated", value: idList(p.updated), mono: true } : null);
      break;
  }

  for (const [k, v] of Object.entries(p)) {
    if (used.has(k) || v === null || v === undefined) continue;
    const value = typeof v === "object" ? JSON.stringify(v) : String(v);
    out.push({ label: humanise(k), value, mono: typeof v !== "string" || /^[0-9a-f-]{8,}$/i.test(value) });
  }
  return out;
}
