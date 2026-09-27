import type { AttemptDetail, RosterRow, StudentDetail } from "./api";

/**
 * `/students/:userId`'s pure logic, kept here so it is tested and the page is
 * only layout. `design/templates/console/students-detail/SPEC.md` owns the
 * decisions; this file owns the words.
 */

export type AttemptStatus = StudentDetail["attempts"][number]["status"];
export type PaperItem = AttemptDetail["items"][number];

/**
 * Does this paper show its key, its verdicts and its rationales?
 *
 * The database grants staff the key for EVERY status. The page is stricter
 * (instructor, 27 Sep 2026): only a paper that was handed in. A console gets
 * projected, and a key on a paper a student is still sitting must never be on
 * the wall. An abandoned paper was never handed in, so it is withheld too. A
 * voided one was: it is exactly what a dispute reads.
 */
export function showsKey(status: AttemptStatus | string): boolean {
  return status === "submitted" || status === "voided";
}

export const STATUS_WORD: Record<AttemptStatus, string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  voided: "Voided",
  abandoned: "Abandoned",
};

export const TYPE_WORD: Record<PaperItem["type"], string> = {
  S: "Single choice",
  P: "Computed",
  G: "Ordering",
};

/** `31 s`, `1 min 05 s`, `14 min 32 s`. Mono on the page; words here. */
export function duration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, "0")} s`;
}

/** Start to hand-in. Nothing for a paper that was never handed in. */
export function timeTaken(startedAt: string, submittedAt: string | null): string {
  if (!submittedAt) return "—";
  return duration(new Date(submittedAt).getTime() - new Date(startedAt).getTime());
}

/** Never colour alone, and never red: an incorrect answer gets a neutral word. */
export function verdict(item: Pick<PaperItem, "isCorrect" | "studentAnswer">): string {
  if (item.studentAnswer === null || item.isCorrect === null) return "Not answered";
  return item.isCorrect ? "Correct" : "Not correct";
}

/** An ordering answer or key is stored as `a | b | c`. */
export function sequence(value: string | null): string[] {
  if (!value) return [];
  return value.split(" | ").map((s) => s.trim()).filter(Boolean);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * `21 Sep 2026`, the same everywhere. Built by hand: ICU's `en-GB` writes
 * "Sept", and another runtime's may not, so `toLocaleDateString` is not one
 * format. The day is the reader's local day.
 */
export function dayDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** The paper's one-line summary, above its questions. */
export function paperSummary(paper: AttemptDetail, keyed: boolean): string {
  const n = paper.items.length;
  const answered = paper.items.filter((i) => i.studentAnswer !== null).length;
  const time = paper.items.reduce((t, i) => t + (i.timeMs ?? 0), 0);
  const parts = [`${n} ${n === 1 ? "question" : "questions"}`];
  if (keyed) parts.push(`${paper.items.filter((i) => i.isCorrect === true).length} correct`);
  else parts.push(`${answered} answered so far`);
  parts.push(`${duration(time)} on questions`);
  return parts.join(" · ");
}

/**
 * The record as the roster's dialogs expect a row, so `StatusDialog` and
 * `MoveDialog` are reused as they are rather than copied.
 */
export function asRosterRow(d: StudentDetail): RosterRow {
  return {
    studentId: d.student.studentId,
    fullName: d.student.fullName,
    status: "claimed",
    claimedAt: d.student.claimedAt,
    sectionId: d.student.sectionId,
    sectionCode: d.student.sectionCode,
    userId: d.student.userId,
    deactivated: d.student.deactivated,
    attempts: d.attempts.length,
    avgMastery: null,
  };
}
