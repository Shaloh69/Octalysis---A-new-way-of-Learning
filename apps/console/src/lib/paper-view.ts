import type { AttemptDetail } from "./api";
import { dayDate, duration, verdict, type PaperItem } from "./record-view";

/**
 * `/attempts/:attemptId`'s pure logic, kept here so it is tested and the page
 * is only layout. `design/templates/console/attempts-detail/SPEC.md` owns the
 * decisions. Whether the key shows is NOT decided here: it is the record's
 * `showsKey()`, so the two pages cannot disagree.
 */

/** `24 Sep 2026, 08:00`, the reader's local time. Built by hand, like `dayDate()`. */
export function dayTime(iso: string | null): string | null {
  const day = dayDate(iso);
  if (!day || !iso) return null;
  const d = new Date(iso);
  return `${day}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** What a computed item drew for this variant: `a = 3 · b = 4`. Null when it drew nothing. */
export function paramsLine(params: Record<string, unknown> | null): string | null {
  if (!params) return null;
  const parts = Object.entries(params).map(([k, v]) => `${k} = ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The sentence under the title, for a paper that is not simply handed in.
 * A withheld key is said, never merely absent (SOURCE.md: "Correct answers are
 * hidden.").
 */
export function statusNote(status: string): string | null {
  switch (status) {
    case "in_progress":
      return "In progress: the student is still sitting this paper. Their answers so far are below. The key, the verdicts and the rationales appear once it is handed in.";
    case "abandoned":
      return "Abandoned before it was handed in. The key is shown only for a paper that was handed in, and this one never was.";
    case "voided":
      return "Voided. Kept for the record; it no longer counts toward a grade. It was handed in, so the key is shown.";
    default:
      return null;
  }
}

export type IndexMark = "correct" | "not-correct" | "not-answered" | "answered";

/** One question's result for the index: a verdict when the key shows, answered or not when it does not. */
export function indexMark(item: Pick<PaperItem, "isCorrect" | "studentAnswer">, keyed: boolean): IndexMark {
  if (item.studentAnswer === null) return "not-answered";
  if (!keyed) return "answered";
  return verdict(item) === "Correct" ? "correct" : "not-correct";
}

/** A shape per result, so the index never relies on colour. */
export const MARK_GLYPH: Record<IndexMark, string> = {
  correct: "✓",
  "not-correct": "–",
  "not-answered": "○",
  answered: "●",
};

const MARK_WORDS: Record<IndexMark, string> = {
  correct: "correct",
  "not-correct": "not correct",
  "not-answered": "not answered",
  answered: "answered",
};

/** The index link's accessible name: `Question 3, not correct`. */
export function indexLabel(ordinal: number, mark: IndexMark): string {
  return `Question ${ordinal}, ${MARK_WORDS[mark]}`;
}

/** The facts beside the paper. Every value a number, a date or "not handed in". */
export interface PaperFacts {
  score: { got: number; of: number } | null;
  answered: { got: number; of: number };
  startedAt: string | null;
  handedInAt: string | null;
  timeTaken: string | null;
  onQuestions: string;
}

export function paperFacts(paper: AttemptDetail, keyed: boolean): PaperFacts {
  const n = paper.items.length;
  const handedIn = paper.submittedAt !== null;
  return {
    score:
      keyed && paper.score !== null && paper.maxScore !== null ? { got: paper.score, of: paper.maxScore } : null,
    answered: { got: paper.items.filter((i) => i.studentAnswer !== null).length, of: n },
    startedAt: dayTime(paper.startedAt),
    handedInAt: handedIn ? dayTime(paper.submittedAt) : null,
    timeTaken: handedIn ? duration(new Date(paper.submittedAt!).getTime() - new Date(paper.startedAt).getTime()) : null,
    onQuestions: duration(paper.items.reduce((t, i) => t + (i.timeMs ?? 0), 0)),
  };
}
