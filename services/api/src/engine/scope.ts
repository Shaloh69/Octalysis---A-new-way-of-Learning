/**
 * EXAMINABLE SCOPE — the flag that says how far the item bank currently reaches.
 *
 * Instructor's ruling, 9 September 2026: **the bank ships through stage 08 and
 * the Midterm. Semi-final and Finals land in a later update.**
 *
 * This is a deliberate, recorded boundary, not an accident of how far the
 * authoring got. Without it the two out-of-scope blueprints would sit in the
 * database looking available, a student could start one, and the sampler would
 * throw `BlueprintUnsatisfiable` at the moment they pressed Start -- the single
 * worst place in the whole system to discover a content gap.
 *
 * ## Why a constant and not an environment variable
 *
 * Exam scope decides what a real class is graded on. An env var makes it
 * flippable per-deployment by whoever last edited a dashboard, with no review,
 * no diff and no test run -- and the failure mode is silent: an exam appears,
 * students sit it, and the paper is drawn from a bank that was never authored
 * for it. Widening the scope should be a commit that a human approves and that
 * the suite gates. So it is a constant, and `scope.spec.ts` fails if it is moved
 * without the bank moving with it.
 *
 * ## How to widen it, when acts 3 and 4 are authored
 *
 * 1. Author the items for those stages and seed them.
 * 2. Raise `EXAMINABLE_THROUGH_STAGE` to "18".
 * 3. Add "Semi-final Examination" and "Final Examination" to `EXAMINABLE_BLUEPRINTS`.
 * 4. Run `pnpm verify`. The feasibility test proves every in-scope blueprint can
 *    actually be filled from the bank BEFORE any student sees it.
 *
 * The act 3 and act 4 SOLVERS are already written, tested and registered. They
 * are deliberately left in place: a registry entry is inert until an item
 * references it, and removing them would mean re-deriving the maths later. What
 * is out of scope is the item bank and the assessments, which is what this file
 * governs.
 */

/** The last stage the authored item bank covers. Stage ids are zero-padded. */
export const EXAMINABLE_THROUGH_STAGE = "08";

/** Grading periods the bank can currently fill. Act == grading period. */
export const EXAMINABLE_ACTS: readonly number[] = [1, 2];

/**
 * Blueprints that may be offered to students right now, by name.
 * The other two exist in `db/schema.sql` and stay there -- they are the plan,
 * not a promise, until their acts are authored.
 */
export const EXAMINABLE_BLUEPRINTS: readonly string[] = [
  "Prelim Examination",
  "Midterm Examination",
];

/** Blueprints deliberately withheld, and the reason, for anything that reports. */
export const DEFERRED_BLUEPRINTS: readonly string[] = [
  "Semi-final Examination",
  "Final Examination",
];

/**
 * Is this stage inside the authored bank?
 *
 * Stage 00 is orientation: it is `gradeable = false` and V-1 excludes it from
 * sampling regardless, so this returning true for "00" is harmless -- the
 * gradeable check is the one that keeps it out of papers.
 */
export function isStageExaminable(stageId: string): boolean {
  return stageId <= EXAMINABLE_THROUGH_STAGE;
}

/** Is this grading period inside the authored bank? */
export function isActExaminable(act: number): boolean {
  return EXAMINABLE_ACTS.includes(act);
}

/** Is this blueprint safe to attach an assessment to? */
export function isBlueprintExaminable(name: string): boolean {
  return EXAMINABLE_BLUEPRINTS.includes(name);
}
