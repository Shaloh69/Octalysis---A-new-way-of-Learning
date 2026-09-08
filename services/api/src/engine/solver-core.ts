/**
 * Shared vocabulary for the parameterized-item solvers.
 *
 * This file exists so the per-act solver banks (`solvers-act1.ts` ..
 * `solvers-act4.ts`) and the registry in `solvers.ts` can share types and the
 * rounding helper WITHOUT importing each other. `solvers.ts` is still the only
 * public surface -- it re-exports everything here, so `resolve.ts` and the tests
 * keep importing from exactly one place.
 *
 * The two rules from `solvers.ts` govern every solver in every bank:
 *
 * 1. **Every distractor comes from a real student misconception**, never a
 *    random number near the answer, and each one names its misconception.
 * 2. **Solvers are versioned and never mutated in place.** Adding a new `id` to
 *    an existing registry is safe -- no stored seed references it. Changing the
 *    maths of one that is already live is not.
 */

import type { Rng } from "./seed.js";

export interface SolverParams {
  readonly [k: string]: number;
}

export interface Distractor {
  readonly value: number;
  /** The misconception this represents. Surfaces in distractor analysis. */
  readonly misconception: string;
}

export interface Solver {
  readonly id: string;
  readonly version: string;
  /** Objective this item type measures, for blueprint accounting. */
  readonly objectiveHint: string;
  readonly unit: string;
  /** Relative tolerance. 0.01 = accept within 1%. */
  readonly tolerance: number;
  /** Significant figures used when rendering the expected answer. */
  readonly sigFigs: number;
  draw(rng: Rng): SolverParams;
  solve(p: SolverParams): number;
  stem(p: SolverParams): string;
  distractors(p: SolverParams, correct: number): Distractor[];
  rationale(p: SolverParams, correct: number): string;
}

export const round = (n: number, sf: number): number =>
  Number.parseFloat(n.toPrecision(sf));

/** log2 for exact powers of two, which is all any of these solvers needs. */
export const log2 = (n: number): number => Math.round(Math.log2(n));

/** Render a byte count the way a spec sheet would. */
export const bytes = (n: number): string => {
  if (n >= 2 ** 30 && n % 2 ** 30 === 0) return `${n / 2 ** 30} GiB`;
  if (n >= 2 ** 20 && n % 2 ** 20 === 0) return `${n / 2 ** 20} MiB`;
  if (n >= 2 ** 10 && n % 2 ** 10 === 0) return `${n / 2 ** 10} KiB`;
  return `${n} bytes`;
};
