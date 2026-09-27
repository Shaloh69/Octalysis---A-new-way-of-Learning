import type { Submission } from "./api";

/**
 * `/submissions`' pure logic: what state a submission is in and how its
 * lateness, its mark and its place in the queue read in words. Tested in
 * `test/submissions-view.spec.ts`; the page only renders what these return.
 */

type Status = Submission["status"];
type Kind = Submission["kind"];

/**
 * The manual's rubric, in its own words (`LAB-MANUAL.md` §0.3). LABS ONLY:
 * the manual defines no rubric for the project or participation, so those are
 * a score out of a maximum the grader states (instructor, 27 Sep 2026).
 */
export const BANDS = [
  { score: 4, label: "Correct, complete, and the reasoning is stated" },
  { score: 3, label: "Correct and complete; reasoning thin or missing" },
  { score: 2, label: "Partially correct, or complete with a conceptual error" },
  { score: 1, label: "Attempted, substantially incorrect" },
  { score: 0, label: "Not submitted" },
] as const;

export const LAB_MAX = 4;

export const usesBands = (kind: Kind): boolean => kind === "lab";

/** The state in a word. `submitted` is what the teacher has to do: mark it. */
export const STATUS_WORD: Record<Status, string> = {
  submitted: "to mark",
  returned: "returned",
  graded: "graded",
  draft: "draft",
  voided: "voided",
};

export const STATUS_TONE = {
  submitted: "warning",
  returned: "info",
  graded: "success",
  draft: "neutral",
  voided: "locked",
} as const;

export const KIND_WORD: Record<Kind, string> = {
  lab: "Labs",
  project: "Project",
  participation: "Participation",
};

/**
 * A submission the API will take a mark on: handed in, or returned. A returned
 * one keeps its form, because the grader may re-mark it; but it is waiting on
 * the STUDENT, so it is not "waiting to be marked" (`isWaiting`).
 */
export const isMarkable = (s: Pick<Submission, "status">): boolean =>
  s.status === "submitted" || s.status === "returned";

/** Waiting on the teacher: handed in and not yet marked. */
export const isWaiting = (s: Pick<Submission, "status">): boolean => s.status === "submitted";

/** `3 hours`, `1 day`, `12 days`. Never "0": anything late is at least a minute. */
export function durationWords(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (min < 60) return plural(min, "minute");
  const hours = Math.floor(min / 60);
  if (hours < 24) return plural(hours, "hour");
  return plural(Math.floor(hours / 24), "day");
}

/**
 * The Late column, in words. `isLate` is the database's generated fact; the
 * duration is only how it is said. Late is recorded, never penalised here.
 */
export function lateWords(s: Pick<Submission, "isLate" | "dueAt" | "submittedAt" | "status">): string {
  if (s.status === "draft" || !s.submittedAt) return "not handed in";
  if (!s.dueAt) return "no due date";
  if (!s.isLate) return "on time";
  const by = new Date(s.submittedAt).getTime() - new Date(s.dueAt).getTime();
  return by > 0 ? `${durationWords(by)} late` : "late";
}

/** `3`, `2.5`, `85`: a score as the grader would write it. */
export function scoreText(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** `3/4`, or null when there is no mark. */
export function markText(s: Pick<Submission, "score" | "maxScore">): string | null {
  if (s.score === null || s.maxScore === null) return null;
  return `${scoreText(s.score)}/${scoreText(s.maxScore)}`;
}

/** The band a graded lab was given, read back from its rubric; null if none. */
export function bandOf(s: Pick<Submission, "rubric">): (typeof BANDS)[number] | null {
  const b = (s.rubric as { band?: unknown }).band;
  return BANDS.find((x) => x.score === b) ?? null;
}

export function counts(rows: Array<Pick<Submission, "status">>) {
  const n = (st: Status) => rows.filter((r) => r.status === st).length;
  return {
    all: rows.length,
    submitted: n("submitted"),
    returned: n("returned"),
    graded: n("graded"),
    draft: n("draft"),
  };
}

export type StatusFilter = Status | "all";

export interface Filter {
  status: StatusFilter;
  /** A slug, a kind (`kind:lab`), or null for every deliverable. */
  deliverable: string | null;
  q: string;
}

/** Whether a row passes the deliverable and search filters (not the status). */
export function matchesScope(
  s: Pick<Submission, "slug" | "kind" | "studentName" | "studentId">,
  f: Pick<Filter, "deliverable" | "q">,
): boolean {
  if (f.deliverable) {
    if (f.deliverable.startsWith("kind:")) {
      if (s.kind !== f.deliverable.slice(5)) return false;
    } else if (s.slug !== f.deliverable) return false;
  }
  const q = f.q.trim().toLowerCase();
  if (q && !s.studentName.toLowerCase().includes(q) && !s.studentId.toLowerCase().includes(q)) return false;
  return true;
}

export function matches(
  s: Pick<Submission, "slug" | "kind" | "studentName" | "studentId" | "status">,
  f: Filter,
): boolean {
  return (f.status === "all" || s.status === f.status) && matchesScope(s, f);
}

/**
 * Save and advance: the next submission WAITING after `currentId`, in the
 * order the queue shows, wrapping to the top. Never the current one, and never
 * a returned one: that is with the student (27 Sep: the empty pane said "22
 * waiting" beside a header saying "21 to mark" until this was split out).
 */
export function nextToMark(
  rows: Array<Pick<Submission, "id" | "status">>,
  currentId: string | null,
): string | null {
  if (!rows.some(isWaiting)) return null;
  const at = rows.findIndex((r) => r.id === currentId);
  const after = [...rows.slice(at + 1), ...rows.slice(0, Math.max(0, at))].find(
    (r) => isWaiting(r) && r.id !== currentId,
  );
  return after?.id ?? null;
}

/** The Deliverable menu: kinds present, each with its slugs and counts. */
export function deliverables(rows: Array<Pick<Submission, "kind" | "slug" | "title">>) {
  const order: Kind[] = ["lab", "project", "participation"];
  return order
    .map((kind) => {
      const bySlug = new Map<string, { slug: string; title: string; n: number }>();
      for (const r of rows) {
        if (r.kind !== kind) continue;
        const e = bySlug.get(r.slug) ?? { slug: r.slug, title: r.title, n: 0 };
        e.n += 1;
        bySlug.set(r.slug, e);
      }
      const slugs = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
      return { kind, n: slugs.reduce((t, s) => t + s.n, 0), slugs };
    })
    .filter((g) => g.n > 0);
}

/**
 * A stated score for a project or participation entry. Null when it can be
 * saved; otherwise the sentence that says why not. Mirrors the API's own
 * checks (`GradeBody`, `score > maxScore`) so the teacher hears it first.
 */
export function scoreProblem(score: string, max: string): string | null {
  if (score.trim() === "" || max.trim() === "") return "Enter a score and what it is out of.";
  const s = Number(score);
  const m = Number(max);
  if (!Number.isFinite(s) || !Number.isFinite(m)) return "The score and the maximum must be numbers.";
  if (m <= 0) return "The maximum must be more than 0.";
  if (s < 0) return "A score cannot be below 0.";
  if (s > m) return `A score of ${scoreText(s)} is above the maximum of ${scoreText(m)}.`;
  return null;
}
