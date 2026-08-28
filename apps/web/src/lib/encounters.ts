/**
 * Which encounter theme dresses which stage.
 *
 * `GAME-DESIGN.md` §9. The mapping lives here rather than in the database
 * because it is a PRESENTATION decision, not curriculum: changing a stage's
 * theme must never require a migration, and a wrong value here costs a student
 * a different-looking panel rather than a different lesson.
 *
 * A theme is four tokens and a panel skin, applied with `data-encounter` on a
 * wrapper. It dresses the LAB beat and NEVER an assessment -- a themed exam
 * would mean two students sitting the same paper in different clothes, and the
 * fairness argument this project rests on is that the papers are equivalent.
 */
export type Encounter =
  | "base"
  | "switchboard"
  | "retro"
  | "pixel"
  | "circuit"
  | "bench"
  | "dos"
  | "modern";

const BY_STAGE: Record<string, Encounter> = {
  // Orientation and the arguments stay in the token system.
  "00": "base",
  "01": "base",
  "06": "base",
  "11": "base",
  "13": "base",

  // The history chapter, and the control unit it foreshadows.
  "02": "switchboard",
  "15": "switchboard",

  // Memory, in the decade people first met it at home.
  "04": "retro",

  // Binary arithmetic is the one place a satisfying click earns its keep.
  "09": "pixel",

  // Anything you would draw as a board with traces on it.
  "03": "circuit",
  "12": "circuit",
  "14": "circuit",

  // Anything you would read off an instrument.
  "05": "bench",
  "07": "bench",

  // Anything whose primary artefact is an x86 listing.
  "10": "dos",
  "16": "dos",

  // 08, 17 and 18 SHARE a theme deliberately -- a callback, so a student
  // notices in week fifteen that they can now decode what they could not in
  // week six.
  "08": "modern",
  "17": "modern",
  "18": "modern",
};

export function encounterFor(stageId: string): Encounter {
  return BY_STAGE[stageId] ?? "base";
}
