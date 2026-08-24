import type { ResolvedItem } from "./resolve.js";

/**
 * Grading. Runs ONLY here, under service_role, never in the browser.
 *
 * The numeric path is where the subtle bugs live. A student who types the right
 * answer and is marked wrong because of a float comparison, a unit suffix, or an
 * exponent format is a grading incident, and they will be right to complain.
 */

export interface GradeResult {
  readonly isCorrect: boolean;
  readonly points: number;
  /** Safe to return to the student once the verdict is due. */
  readonly rationale: string;
  /** Which option they chose, when it can be determined. For distractor analysis. */
  readonly chosenIndex: number | null;
  /** Normalised form actually compared, for the audit trail. */
  readonly normalised: string;
}

/**
 * Parse a number a student typed.
 *
 * Accepts: plain decimals, thousands separators, scientific notation in several
 * spellings, and a trailing unit. Returns null when there is no number at all.
 */
export function parseNumericAnswer(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  if (s === "") return null;

  // Strip a trailing unit: "7.52 ns", "465.66GiB", "11 ns."
  s = s.replace(/[a-zµμ%]+\.?$/u, "").trim();

  // Thousands separators, but only when they are grouping digits: 1,073,741,824
  s = s.replace(/(\d),(?=\d{3}\b)/g, "$1");

  // Exponent spellings students actually use: 1.5x10^6, 1.5 * 10^6, 1.5e6, 1.5E+6
  s = s
    .replace(/\s*[x*×]\s*10\s*\^?\s*/g, "e")
    .replace(/\s*10\s*\^\s*/g, "1e")
    .replace(/\s+/g, "");

  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare two numbers within a RELATIVE tolerance.
 *
 * Relative, not absolute: 1% of 7.52 ns and 1% of 465.66 GiB are wildly different
 * absolute quantities, and a fixed epsilon would be far too strict on one and far
 * too loose on the other.
 *
 * A tolerance of 0 means exact — used by two's complement, where the answer is an
 * integer bit pattern and "close" is meaningless.
 */
export function numbersMatch(expected: number, got: number, tolerance: number): boolean {
  if (Number.isNaN(got) || !Number.isFinite(got)) return false;

  if (tolerance === 0) {
    // Still not ===, because 0.1 + 0.2 !== 0.3 and a student computing in steps
    // can land one ULP away on a value that is conceptually exact.
    return Math.abs(expected - got) <= Number.EPSILON * Math.max(1, Math.abs(expected)) * 8;
  }

  if (expected === 0) return Math.abs(got) <= tolerance;
  return Math.abs(expected - got) / Math.abs(expected) <= tolerance;
}

const normaliseText = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Grade one response against the resolved item.
 *
 * `raw` is whatever the client sent: `{ index: 2 }` for a choice, `{ value: "7.52" }`
 * for free entry, `{ order: [...] }` for an ordering item.
 */
export function gradeResponse(item: ResolvedItem, raw: unknown): GradeResult {
  const answer = (raw ?? {}) as Record<string, unknown>;

  // ---- ordering / matching -------------------------------------------------
  if (item.type === "G") {
    const order = answer.order;
    if (!Array.isArray(order) || order.some((o) => typeof o !== "string")) {
      return miss(item, "no ordering submitted");
    }
    const submitted = (order as string[]).join(" | ");
    const isCorrect = normaliseText(submitted) === normaliseText(item.correctValue);
    return {
      isCorrect,
      points: isCorrect ? item.points : 0,
      rationale: item.rationale,
      chosenIndex: null,
      normalised: submitted,
    };
  }

  // ---- selected an option --------------------------------------------------
  if (typeof answer.index === "number") {
    const idx = answer.index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= item.options.length) {
      return miss(item, `index ${idx} out of range`);
    }
    const isCorrect = idx === item.correctIndex;
    return {
      isCorrect,
      points: isCorrect ? item.points : 0,
      rationale: item.rationale,
      chosenIndex: idx,
      normalised: item.options[idx]!,
    };
  }

  // ---- typed a value -------------------------------------------------------
  const value = answer.value;
  if (typeof value !== "string" && typeof value !== "number") {
    return miss(item, "no answer submitted");
  }
  const text = String(value);

  // If it matches an option exactly, treat it as a selection. This is what
  // happens when a client sends the label instead of the index.
  const optionIdx = item.options.findIndex((o) => normaliseText(o) === normaliseText(text));
  if (optionIdx !== -1) {
    const isCorrect = optionIdx === item.correctIndex;
    return {
      isCorrect,
      points: isCorrect ? item.points : 0,
      rationale: item.rationale,
      chosenIndex: optionIdx,
      normalised: item.options[optionIdx]!,
    };
  }

  // Free numeric entry — the drill path, where re-rolling means students type
  // rather than pick.
  if (item.type === "P") {
    const got = parseNumericAnswer(text);
    const expected = parseNumericAnswer(item.correctValue);
    if (got !== null && expected !== null) {
      const isCorrect = numbersMatch(expected, got, item.tolerance ?? 0.01);
      return {
        isCorrect,
        points: isCorrect ? item.points : 0,
        rationale: item.rationale,
        chosenIndex: null,
        normalised: String(got),
      };
    }
  }

  // Fall back to text comparison for static items answered free-form.
  const isCorrect = normaliseText(text) === normaliseText(item.correctValue);
  return {
    isCorrect,
    points: isCorrect ? item.points : 0,
    rationale: item.rationale,
    chosenIndex: null,
    normalised: normaliseText(text),
  };
}

function miss(item: ResolvedItem, normalised: string): GradeResult {
  return {
    isCorrect: false,
    points: 0,
    rationale: item.rationale,
    chosenIndex: null,
    normalised,
  };
}

export interface ScoredAttempt {
  readonly score: number;
  readonly maxScore: number;
  /** Proportion in [0, 1]. */
  readonly mastery: number;
  readonly byObjective: Record<string, { correct: number; total: number }>;
}

/** Score a whole submitted attempt. */
export function scoreAttempt(
  items: readonly ResolvedItem[],
  results: ReadonlyMap<number, GradeResult>,
): ScoredAttempt {
  let score = 0;
  let maxScore = 0;
  const byObjective: Record<string, { correct: number; total: number }> = {};

  for (const item of items) {
    maxScore += item.points;
    const r = results.get(item.ordinal);
    if (r?.isCorrect) score += r.points;

    const key = item.objectiveId ?? "(unassigned)";
    const bucket = (byObjective[key] ??= { correct: 0, total: 0 });
    bucket.total += 1;
    if (r?.isCorrect) bucket.correct += 1;
  }

  return {
    score,
    maxScore,
    mastery: maxScore === 0 ? 0 : score / maxScore,
    byObjective,
  };
}
