import { makeRng, deriveSeed, type Rng } from "./seed.js";
import { getSolver, round, type SolverParams } from "./solvers.js";

/**
 * Turn a bank item plus a seed into the exact instance a student sees.
 *
 * This module owns three guarantees that AUDITS.md §3.3 names explicitly:
 *
 *   - No resolved item has duplicate options.
 *   - No distractor equals the correct value. Float collisions in a type-P item
 *     will produce this if nothing guards it -- at f = 1000 MHz, the cycle-time
 *     solver's `f/1000` and `1000/f` are both 1.
 *   - The correct answer's position is uniformly distributed. A generator that
 *     puts the answer at B 40% of the time is exploitable without knowing any
 *     content at all.
 */

export type ItemType = "S" | "P" | "G";

/** What the bank stores. Mirrors the `items` table. */
export interface BankItem {
  readonly id: string;
  readonly slug: string;
  readonly stageId: string;
  readonly objectiveId: string | null;
  readonly type: ItemType;
  readonly bloom: string;
  readonly stemTemplate: string;
  /** P only. */
  readonly solverRef?: string | null;
  /** S: {value}. G: {order: [...]}. */
  readonly correctSpec: Record<string, unknown>;
  /** S: string[]. G: unused. */
  readonly distractorPool: unknown;
  readonly rationaleTemplate?: string | null;
}

/** The resolved instance. `correctValue` and `rationale` are answer-key surface. */
export interface ResolvedItem {
  readonly itemId: string;
  readonly ordinal: number;
  readonly type: ItemType;
  readonly stageId: string;
  readonly objectiveId: string | null;
  readonly bloom: string;
  readonly stem: string;
  /** Options exactly as shown, in shown order. */
  readonly options: string[];
  readonly resolvedParams: SolverParams;
  readonly points: number;

  /** ANSWER KEY. Never leaves the server before submit. */
  readonly correctValue: string;
  /** ANSWER KEY. Index into `options`. */
  readonly correctIndex: number;
  /** ANSWER KEY until the verdict is due. */
  readonly rationale: string;
  /** P only: relative tolerance for free-entry numeric grading. */
  readonly tolerance?: number;
  readonly unit?: string;
}

/** Render a number the way it will be compared and displayed. */
export function formatNumber(n: number, sigFigs: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const r = round(n, sigFigs);
  // Avoid exponential notation for values a student would write out longhand.
  if (Math.abs(r) >= 1e-4 && Math.abs(r) < 1e9) {
    return String(Number.parseFloat(r.toPrecision(sigFigs)));
  }
  return r.toExponential(Math.max(0, sigFigs - 1));
}

/** Distinctness key. Two options that render identically ARE duplicates. */
const optionKey = (s: string): string => s.trim().toLowerCase();

/**
 * Pick `count` distractors that are distinct from the correct answer and from
 * each other, preserving the solver's ordering preference (earlier candidates
 * represent more common misconceptions, so they are preferred).
 */
function pickDistinct(
  candidates: readonly string[],
  correct: string,
  count: number,
  rng: Rng,
  context: string,
): string[] {
  const seen = new Set<string>([optionKey(correct)]);
  const distinct: string[] = [];

  for (const c of candidates) {
    const k = optionKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    distinct.push(c);
  }

  if (distinct.length < count) {
    throw new Error(
      `Cannot build ${count} distinct distractors for ${context}: only ${distinct.length} of ` +
        `${candidates.length} candidates survived deduplication against the correct answer ` +
        `"${correct}". Add more misconception-based candidates to the solver or the pool.`,
    );
  }

  // Sample rather than take the first N, so students do not all see the same
  // three misconceptions for a given item.
  return rng.sample(distinct, count);
}

export interface ResolveOptions {
  readonly ordinal: number;
  readonly points?: number;
  readonly optionCount?: number;
  readonly engineVersion?: string;
}

/**
 * Resolve one item. Deterministic: same item + same seed + same engineVersion
 * produces a byte-identical instance, forever.
 */
export function resolveItem(
  item: BankItem,
  attemptSeed: string,
  opts: ResolveOptions,
): ResolvedItem {
  const { ordinal, points = 1, optionCount = 4, engineVersion = "1.0.0" } = opts;

  // A per-item sub-stream. Without this, inserting an item at ordinal 3 would
  // shift every subsequent item's parameters -- which would mean a regenerated
  // paper silently differing from the one the student sat.
  const rng = makeRng(deriveSeed(attemptSeed, `item:${item.id}:${ordinal}`));

  switch (item.type) {
    case "P":
      return resolveParameterized(item, rng, ordinal, points, optionCount, engineVersion);
    case "S":
      return resolveStatic(item, rng, ordinal, points, optionCount);
    case "G":
      return resolveGenerated(item, rng, ordinal, points);
    default: {
      const exhaustive: never = item.type;
      throw new Error(`Unknown item type: ${String(exhaustive)}`);
    }
  }
}

function resolveParameterized(
  item: BankItem,
  rng: Rng,
  ordinal: number,
  points: number,
  optionCount: number,
  engineVersion: string,
): ResolvedItem {
  if (!item.solverRef) {
    throw new Error(`Item ${item.slug} is type P but has no solver_ref.`);
  }
  const solver = getSolver(item.solverRef, engineVersion);

  const params = solver.draw(rng);
  const correctNum = solver.solve(params);

  if (!Number.isFinite(correctNum)) {
    throw new Error(
      `Solver ${solver.id} produced a non-finite answer (${correctNum}) from ${JSON.stringify(params)}.`,
    );
  }

  const correct = formatNumber(correctNum, solver.sigFigs);
  const candidates = solver
    .distractors(params, correctNum)
    .filter((d) => Number.isFinite(d.value))
    .map((d) => formatNumber(d.value, solver.sigFigs));

  const distractors = pickDistinct(
    candidates,
    correct,
    optionCount - 1,
    rng,
    `${item.slug} (solver ${solver.id}, params ${JSON.stringify(params)})`,
  );

  const options = rng.shuffle([correct, ...distractors]);

  return {
    itemId: item.id,
    ordinal,
    type: "P",
    stageId: item.stageId,
    objectiveId: item.objectiveId,
    bloom: item.bloom,
    stem: solver.stem(params),
    options,
    resolvedParams: params,
    points,
    correctValue: correct,
    correctIndex: options.indexOf(correct),
    rationale: solver.rationale(params, correctNum),
    tolerance: solver.tolerance,
    unit: solver.unit,
  };
}

function resolveStatic(
  item: BankItem,
  rng: Rng,
  ordinal: number,
  points: number,
  optionCount: number,
): ResolvedItem {
  const correct = item.correctSpec.value;
  if (typeof correct !== "string") {
    throw new Error(`Item ${item.slug} is type S but correct_spec.value is not a string.`);
  }

  const pool = item.distractorPool;
  if (!Array.isArray(pool) || pool.some((p) => typeof p !== "string")) {
    throw new Error(`Item ${item.slug} is type S but distractor_pool is not an array of strings.`);
  }

  // INV-16 requires >= 4 in the pool because we sample 3. Enforce it here too,
  // so a bad item fails at generation rather than shipping a 2-option question.
  const distractors = pickDistinct(
    pool as string[],
    correct,
    optionCount - 1,
    rng,
    `${item.slug} (static pool of ${pool.length})`,
  );

  const options = rng.shuffle([correct, ...distractors]);

  return {
    itemId: item.id,
    ordinal,
    type: "S",
    stageId: item.stageId,
    objectiveId: item.objectiveId,
    bloom: item.bloom,
    stem: item.stemTemplate,
    options,
    resolvedParams: {},
    points,
    correctValue: correct,
    correctIndex: options.indexOf(correct),
    rationale: item.rationaleTemplate ?? "",
  };
}

function resolveGenerated(
  item: BankItem,
  rng: Rng,
  ordinal: number,
  points: number,
): ResolvedItem {
  const order = item.correctSpec.order;
  if (!Array.isArray(order) || order.some((o) => typeof o !== "string")) {
    throw new Error(`Item ${item.slug} is type G but correct_spec.order is not an array of strings.`);
  }
  const steps = order as string[];
  if (steps.length < 3) {
    throw new Error(`Item ${item.slug} is type G with only ${steps.length} steps; need at least 3.`);
  }

  // Draw k of n and shuffle the presentation. The student's task is to restore
  // the correct relative order of the subset they were given.
  const k = Math.min(steps.length, typeof item.correctSpec.take === "number" ? item.correctSpec.take : steps.length);
  const chosenIdx = rng.sample(
    steps.map((_, i) => i),
    k,
  ).sort((a, b) => a - b);

  const correctSequence = chosenIdx.map((i) => steps[i]!);

  // Present them shuffled. Reshuffle if we happen to draw the answer.
  let shown = rng.shuffle(correctSequence);
  let guard = 0;
  while (shown.join(" ") === correctSequence.join(" ") && guard < 16) {
    shown = rng.shuffle(correctSequence);
    guard++;
  }

  return {
    itemId: item.id,
    ordinal,
    type: "G",
    stageId: item.stageId,
    objectiveId: item.objectiveId,
    bloom: item.bloom,
    stem: item.stemTemplate,
    options: shown,
    resolvedParams: {},
    points,
    correctValue: correctSequence.join(" | "),
    correctIndex: -1, // ordering items have no single correct option
    rationale: item.rationaleTemplate ?? "",
  };
}
