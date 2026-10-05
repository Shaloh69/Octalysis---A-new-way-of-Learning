import type { ResolvedItem } from "../engine/resolve.js";

/**
 * THE serializer for student-facing item payloads.
 *
 * There is exactly one of these, and every student route uses it. Stripping the
 * answer key ad hoc per endpoint is how a leak gets shipped: someone adds a
 * route at 1am, writes `res.send(item)`, and the key is public.
 *
 * The shape below is an ALLOW-LIST, built field by field. It is deliberately not
 * `const { correctValue, ...rest } = item` — a rest-spread silently forwards any
 * field added to ResolvedItem later, so the safe-by-default direction is
 * inverted. Adding a field to the answer key must not require remembering to
 * come here; forgetting to come here must mean the field is *absent*, not leaked.
 */

export interface StudentItem {
  readonly ordinal: number;
  readonly type: "S" | "P" | "G";
  readonly stem: string;
  readonly options: string[];
  readonly points: number;
  /** Safe: the unit is part of the question, not the answer. */
  readonly unit?: string;
  /**
   * The question's figure, when it needs one (6 Oct 2026). Only an APPROVED
   * drawing ever reaches here; an item whose figure is unapproved cannot be
   * live (trigger `items_figure_approved`). A figure is part of the question,
   * like its stem: whoever writes one must never draw the answer into it.
   */
  readonly figure?: StudentFigure;
}

export interface StudentFigure {
  readonly title: string;
  readonly svg: string;
}

/** Strip one item down to what a student may see while the attempt is open. */
export function toStudentItem(item: ResolvedItem, figure?: StudentFigure): StudentItem {
  const out: StudentItem = {
    ordinal: item.ordinal,
    type: item.type,
    stem: item.stem,
    options: [...item.options],
    points: item.points,
  };
  // `unit` is only included when it is non-empty, so the payload does not carry
  // an empty string that hints at the answer's shape.
  const withUnit = item.unit ? { ...out, unit: item.unit } : out;
  // Built field by field, like everything else here.
  return figure ? { ...withUnit, figure: { title: figure.title, svg: figure.svg } } : withUnit;
}

/** `figures` maps an item id to its approved figure (repo/figures-repo.ts). */
export function toStudentPaper(
  items: readonly ResolvedItem[],
  figures: ReadonlyMap<string, StudentFigure> = new Map(),
): StudentItem[] {
  return items.map((item) => toStudentItem(item, figures.get(item.itemId)));
}

/**
 * What a student may see AFTER their attempt is submitted, or after answering a
 * practice item where immediate feedback is the design.
 *
 * `rs_own` in db/schema.sql enforces the same rule at the database level: a
 * verdict on a `final`-scope assessment is withheld until submit. This function
 * is the API-side half of that; neither is sufficient alone.
 */
export interface StudentVerdict {
  readonly ordinal: number;
  readonly isCorrect: boolean;
  readonly points: number;
  readonly rationale: string;
  readonly correctValue: string;
}

export function toStudentVerdict(
  item: ResolvedItem,
  result: { isCorrect: boolean; points: number },
): StudentVerdict {
  return {
    ordinal: item.ordinal,
    isCorrect: result.isCorrect,
    points: result.points,
    rationale: item.rationale,
    correctValue: item.correctValue,
  };
}

/**
 * A student's own recorded answer, in the shape they sent it.
 *
 * `raw_answer` is whatever the grading service stored, so it is rebuilt here
 * key by key rather than forwarded: the same allow-list rule as the paper.
 * Anything that is not an index, a value or an order is dropped, not passed on.
 */
export type StudentAnswer = { index: number } | { value: string | number } | { order: string[] };

export function toStudentAnswer(raw: unknown): StudentAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.index === "number") return { index: r.index };
  if (typeof r.value === "string" || typeof r.value === "number") return { value: r.value };
  if (Array.isArray(r.order) && r.order.every((o) => typeof o === "string")) {
    return { order: [...(r.order as string[])] };
  }
  return null;
}

/**
 * What a RESUMED paper says about the questions already recorded (instructor
 * ruling, 29 Sep 2026): each one's own answer, and, only where the assessment
 * reveals verdicts as it goes (a stage check, never a final), the verdict the
 * student was already shown when they recorded it.
 *
 * Built from the stored responses, so it names only recorded ordinals. A key
 * for a question the student has not recorded cannot reach this list, because
 * nothing here starts from the paper.
 */
export interface StudentRecorded {
  readonly ordinal: number;
  readonly answer: StudentAnswer | null;
  readonly verdict?: StudentVerdict;
}

export function toStudentRecorded(
  items: readonly ResolvedItem[],
  responses: ReadonlyArray<{ ordinal: number; rawAnswer: unknown; isCorrect: boolean; points: number }>,
  revealVerdict: boolean,
): StudentRecorded[] {
  const out: StudentRecorded[] = [];
  for (const r of responses) {
    const item = items.find((i) => i.ordinal === r.ordinal);
    if (!item) continue;
    const answer = toStudentAnswer(r.rawAnswer);
    out.push(
      revealVerdict
        ? { ordinal: r.ordinal, answer, verdict: toStudentVerdict(item, { isCorrect: r.isCorrect, points: r.points }) }
        : { ordinal: r.ordinal, answer },
    );
  }
  return out;
}

/**
 * Belt-and-braces check used by tests and by the audit route: does this payload
 * contain anything from the answer key?
 *
 * AUDITS.md §3.4 calls for three independent leak checks. This is the runtime
 * one, and it exists because "we stripped the field" is a claim, while "we
 * searched the serialised body for the actual secret and did not find it" is
 * evidence.
 */
export function containsAnswerKey(payload: unknown, items: readonly ResolvedItem[]): string[] {
  const body = JSON.stringify(payload);
  const found: string[] = [];

  for (const item of items) {
    // Short values like "1" or "8" appear legitimately inside stems and options,
    // so only flag values distinctive enough to be meaningful evidence.
    if (item.correctValue.length >= 4 && body.includes(item.correctValue)) {
      // An option list legitimately contains the correct value — that is the
      // point of a multiple-choice question. Only flag it appearing somewhere a
      // student could distinguish it from the other options.
      const asOption = item.options.some((o) => o === item.correctValue);
      if (!asOption) found.push(`ordinal ${item.ordinal}: correctValue "${item.correctValue}"`);
    }
    if (item.rationale.length >= 12 && body.includes(item.rationale)) {
      found.push(`ordinal ${item.ordinal}: rationale`);
    }
    if (body.includes(`"correctIndex"`) || body.includes(`"correctValue"`)) {
      found.push(`ordinal ${item.ordinal}: answer-key field name present`);
    }
  }

  return [...new Set(found)];
}
