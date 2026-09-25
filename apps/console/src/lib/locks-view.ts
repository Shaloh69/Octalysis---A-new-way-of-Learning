import type { LockCell, LockMatrix, ScopeLock } from "./api";

/**
 * `/locks`' pure logic: what a cell SAYS, and which cells a bulk selection
 * covers. Nothing here decides whether a stage is open. `unlocked` arrives from
 * `is_stage_unlocked()` through the API (hard rule 4), and every function
 * below reads it as given.
 */

/** How a cell is drawn: the database's answer, and whether a person decided. */
export type CellKind = "auto-open" | "auto-closed" | "person-open" | "person-closed";

export function cellKind(c: Pick<LockCell, "unlocked" | "override">): CellKind {
  if (c.override === "unlocked") return "person-open";
  if (c.override === "locked") return "person-closed";
  return c.unlocked ? "auto-open" : "auto-closed";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "24 Sep 2026, 09:30" in the teacher's own time zone. Formatted by hand:
 * `toLocaleString("en-GB")` says "Sept" on newer ICU and "Sep" on older, and
 * a date that reads differently from one browser to the next is not evidence.
 */
export function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/**
 * The cell in words: what the student sees, then who decided and why.
 *
 * When a person's override and the database disagree (an override opening a
 * stage inside a window that has not started), the database's answer comes
 * first, because it is what the student sees, and the override is reported as
 * what it is.
 */
export function cellSentence(c: LockCell): { state: string; decided: string } {
  const state = c.unlocked ? "Open" : "Closed";
  if (c.override === null) {
    return { state, decided: "by the curriculum" };
  }
  const verb = c.override === "unlocked" ? "Opened" : "Closed";
  const at = when(c.setAt);
  const decided =
    `${verb} by ${c.setBy ?? "a staff account"}${at ? `, ${at}` : ""}` +
    (c.reason ? `: “${c.reason}”` : "");
  return { state, decided };
}

/** "Open. Closed by …" reads badly; the readout drops the repeat. */
export function cellLine(c: LockCell): string {
  const { state, decided } = cellSentence(c);
  if (c.override === null) return `${state}, ${decided}.`;
  const agrees = (c.override === "unlocked") === c.unlocked;
  return agrees
    ? `${decided}.`
    : `${state}: the database has not opened it yet. ${decided}.`;
}

export function scopeLabel(l: Pick<ScopeLock, "scope" | "sectionCode">): string {
  return l.scope === "global" ? "Every student" : `Section ${l.sectionCode ?? "?"}`;
}

/** "Every student: closed by …" — a course-wide or section override, in words. */
export function scopeLine(l: ScopeLock): string {
  const verb = l.state === "unlocked" ? "opened" : "closed";
  const at = when(l.setAt);
  const window = windowLine(l);
  return (
    `${scopeLabel(l)}: ${verb} by ${l.setBy}${at ? `, ${at}` : ""}` +
    (window ? ` (${window})` : "") +
    (l.reason ? `: “${l.reason}”` : "")
  );
}

/** The window as stored. Whether it is "active now" is the database's call. */
export function windowLine(l: Pick<ScopeLock, "unlockAt" | "lockAt">): string {
  const from = when(l.unlockAt);
  const to = when(l.lockAt);
  if (from && to) return `from ${from} until ${to}`;
  if (from) return `from ${from}`;
  if (to) return `until ${to}`;
  return "";
}

/* ------------------------------------------------------------ selection */

export interface Pos {
  row: number;
  col: number;
}

export const cellKey = (userId: string, stageId: string) => `${userId}|${stageId}`;

/**
 * Every cell in the rectangle between two corners, inclusive. Shift-click
 * from the first cell to the last: stage 05 for everyone is two presses.
 */
export function rectangle(
  m: Pick<LockMatrix, "students" | "stages">,
  a: Pos,
  b: Pos,
): string[] {
  const out: string[] = [];
  const [r0, r1] = [Math.min(a.row, b.row), Math.max(a.row, b.row)];
  const [c0, c1] = [Math.min(a.col, b.col), Math.max(a.col, b.col)];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const st = m.students[r];
      const sg = m.stages[c];
      if (st && sg) out.push(cellKey(st.userId, sg.id));
    }
  }
  return out;
}

/** Every student, one stage. */
export function column(m: Pick<LockMatrix, "students">, stageId: string): string[] {
  return m.students.map((s) => cellKey(s.userId, stageId));
}

/** "9 cells selected (3 students × 3 stages)". */
export function selectionSummary(keys: Iterable<string>): {
  cells: number; students: number; stages: number; stageIds: string[];
} {
  const users = new Set<string>();
  const stages = new Set<string>();
  let cells = 0;
  for (const k of keys) {
    const [u, s] = k.split("|") as [string, string];
    users.add(u);
    stages.add(s);
    cells++;
  }
  return { cells, students: users.size, stages: stages.size, stageIds: [...stages].sort() };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* --------------------------------------------------------------- toasts */

export type LockTarget = "locked" | "unlocked" | "auto";

const DID: Record<LockTarget, string> = {
  unlocked: "opened early",
  locked: "closed",
  auto: "returned to automatic",
};

/** "Stage 05 closed for Juan Miguel Dela Cruz". What happened to what. */
export function singleToast(stageId: string, next: LockTarget, who: string): string {
  return `Stage ${stageId} ${DID[next]} for ${who}`;
}

/** "Stage 05 closed for 21 students", or "9 cells closed across 3 students". */
export function bulkToast(keys: Iterable<string>, next: LockTarget): string {
  const s = selectionSummary(keys);
  if (s.stages === 1) {
    return `Stage ${s.stageIds[0]} ${DID[next]} for ${plural(s.students, "student")}`;
  }
  return `${plural(s.cells, "cell")} ${DID[next]} across ${plural(s.students, "student")} and ${plural(s.stages, "stage")}`;
}

/** A section or course-wide override is not "early"; it is a schedule. */
const SET: Record<LockTarget, string> = {
  unlocked: "opened",
  locked: "closed",
  auto: "returned to automatic",
};

export function scopeToast(stageId: string, next: LockTarget, scope: string): string {
  return `Stage ${stageId} ${SET[next]} for ${scope === "Every student" ? "every student" : scope}`;
}

/* ------------------------------------------------------------ the form */

/**
 * A `datetime-local` value ("2026-10-01T08:00", the teacher's time) as an ISO
 * instant, or null when empty or unreadable.
 */
export function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The window has to close after it opens. The API refuses it too. */
export function windowError(opens: string, closes: string): string | null {
  const a = localToIso(opens);
  const b = localToIso(closes);
  if (a && b && Date.parse(b) <= Date.parse(a)) return "The window has to close after it opens.";
  return null;
}
