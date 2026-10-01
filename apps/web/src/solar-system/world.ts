import { seededHash, moonSkinKey, type SkinKey } from "./bodies";
import { LEVEL_NAMES } from "./layout";
import { stageRing } from "./ring";

export { stageRing };

/**
 * The world a student is entering: what a planet looks like on the map, and
 * what the arrival screen says about it (instructor rulings, 1-2 Oct 2026:
 * R4.7's frost line, R3.4's arrival screen). ONE module decides both, so the
 * globe on the map and the words on arrival can never disagree.
 *
 * THE FROST LINE sits between Machine / ISA (L2) and System Software (L3):
 * rocky worlds inside it, gas and ice giants beyond. Stage 01, which spans
 * every level, is a spoke across the system and is the home world.
 *
 * HARD RULE 5. A fact is either `brief`, the instructor's own text word for
 * word (`docs/source/solar-system-brief.md`, tested), or `data`, built from the
 * planet's own record (its title, moons, levels, grading period). Nothing about
 * a body is invented. COSMETIC: no lock, mastery or count is read to decide a
 * look, and the look decides nothing.
 */

export const FROST_RING = 2.5;
export type Zone = "inner" | "outer";
export const zoneOf = (ring: number): Zone => (ring < FROST_RING ? "inner" : "outer");

/** Rocky worlds, for inside the frost line. */
export const INNER_WORLDS = ["earth", "mars", "venus", "venusSurface", "mercury"] as const satisfies readonly SkinKey[];
/** Gas and ice giants, for beyond it. */
export const OUTER_WORLDS = ["jupiter", "saturn", "uranus", "neptune"] as const satisfies readonly SkinKey[];
/** The spoke across every level is the home world. */
const SPOKE_WORLD: SkinKey = "earth";

/** The planet's world: by the frost line, seeded by the student and the stage. */
export function planetSkinKey(stageId: string, ring: number, spoke: boolean, seed: number): SkinKey {
  if (spoke) return SPOKE_WORLD;
  const list: readonly SkinKey[] = zoneOf(ring) === "inner" ? INNER_WORLDS : OUTER_WORLDS;
  return list[seededHash(`${stageId}:${Math.round(seed * 1e6)}`) % list.length]!;
}

/** What each texture looks like, in words: our own textures described, not facts about them. */
const PLANET_WORDS: Partial<Record<SkinKey, string>> = {
  earth: "a blue-green ocean world",
  mars: "a red rocky world",
  venus: "a cloud-veiled world",
  venusSurface: "a scorched rocky world",
  mercury: "a grey cratered world",
  jupiter: "a banded gas giant",
  saturn: "a ringed gas giant",
  uranus: "a pale blue ice giant",
  neptune: "a deep blue ice giant",
};
const MOON_WORDS: Partial<Record<SkinKey, string>> = {
  moon: "a grey cratered moon",
  ceres: "a dark rocky moon",
  eris: "a pale icy moon",
  makemake: "a reddish icy moon",
  mercury: "a scorched rocky moon",
  haumea: "an egg-shaped icy moon",
};

export function describeSkin(key: SkinKey, as: "planet" | "moon"): string {
  return (as === "planet" ? PLANET_WORDS[key] : MOON_WORDS[key]) ?? (as === "planet" ? "a world" : "a moon");
}

/* ------------------------------------------------------- the brief, quoted */

/** Each is the instructor's text word for word (tested against the file). */
const BRIEF = {
  terrestrial:
    "Terrestrial Planets: Small, high-density worlds made of rock and metal (like Earth or Mars) that form close to the star where it is too hot for gases to condense.",
  giants:
    "Gas & Ice Giants: Massive, low-density worlds made of hydrogen, helium, methane, and ammonia (like Jupiter or Neptune) that form in the freezing outer system.",
  rings:
    "Planetary Rings: Billions of tiny particles of ice, rock, and dust orbiting a planet inside its Roche Limit, preventing them from fusing into a proper moon.",
  belt: "Asteroid Belts: Vast rings of rocky, metallic debris left over from the system’s early formation that failed to merge into a planet due to gravitational disruptions from nearby giant planets.",
  inner: "rocky terrestrial planets form in the hot interior",
  outer: "volatile gas and ice giants thrive in the freezing outer regions",
  moons:
    "Moons (Natural Satellites): Smaller bodies locked to a parent planet, ranging from massive spheroidal worlds with subsurface oceans to tiny, captured irregularly-shaped asteroids.",
  hill: "any major moons must remain securely within their planet’s gravitational Hill Sphere and outside its destructive tidal Roche Limit to avoid being torn into rings.",
} as const;

/* ------------------------------------------------------------ the arrival */

export interface WorldStage {
  id: string;
  title: string;
  act: number;
  levels: number[];
  gradeable: boolean;
  objectives: Array<{ id: string; level: number; description: string }>;
}

export interface ArrivalFact {
  /** A short lead-in, ours (e.g. "Beyond the frost line"); the text after it is the fact. */
  label?: string;
  text: string;
  source: "brief" | "data";
}

export interface Arrival {
  skinKey: SkinKey;
  descriptor: string;
  zone: Zone;
  spoke: boolean;
  facts: ArrivalFact[];
}

const ACTS: Record<number, string> = { 1: "Prelim", 2: "Midterm", 3: "Semi-finals", 4: "Finals" };

function levelsText(levels: readonly number[]): string {
  const ls = [...new Set(levels)].sort((a, b) => a - b);
  return ls.map((l) => `L${l} ${LEVEL_NAMES[l]}`).join(", ");
}

export function planetArrival(s: WorldStage, seed: number): Arrival {
  const ring = stageRing(s.levels, s.objectives.map((o) => o.level));
  const spoke = s.levels.length === 7;
  const zone = zoneOf(ring);
  const skinKey = planetSkinKey(s.id, ring, spoke, seed);
  const facts: ArrivalFact[] = [];

  if (!s.gradeable) facts.push({ text: BRIEF.belt, source: "brief" });
  else facts.push({ text: zone === "inner" || spoke ? BRIEF.terrestrial : BRIEF.giants, source: "brief" });
  if (skinKey === "saturn") facts.push({ text: BRIEF.rings, source: "brief" });
  if (!spoke) {
    facts.push(
      zone === "inner"
        ? { label: "Inside the frost line", text: BRIEF.inner, source: "brief" }
        : { label: "Beyond the frost line", text: BRIEF.outer, source: "brief" },
    );
  }

  facts.push(
    s.gradeable
      ? { text: `${s.objectives.length} moons circle ${s.title}, one for each of its objectives.`, source: "data" }
      : { text: `${s.title} has no moons: a belt of asteroids circles it, and nothing in it is graded.`, source: "data" },
  );
  facts.push(
    spoke
      ? { text: `It spans every level of the Computer Level Hierarchy, L0 to L6: a spoke across the whole system.`, source: "data" }
      : { text: `It orbits at ${levelsText(s.levels)}.`, source: "data" },
  );
  if (ACTS[s.act]) facts.push({ text: `Stage ${s.id} belongs to the ${ACTS[s.act]}.`, source: "data" });

  return { skinKey, descriptor: describeSkin(skinKey, "planet"), zone, spoke, facts };
}

export function moonArrival(s: WorldStage, objective: WorldStage["objectives"][number], seed: number): Arrival {
  const planet = planetArrival(s, seed);
  const skinKey = moonSkinKey(objective.id, seed);
  return {
    skinKey,
    descriptor: describeSkin(skinKey, "moon"),
    zone: planet.zone,
    spoke: false,
    facts: [
      { label: `Moon ${objective.id}`, text: objective.description, source: "data" },
      { text: `Moon ${objective.id} is one of ${s.objectives.length} moons of Stage ${s.id} · ${s.title}, ${planet.descriptor}.`, source: "data" },
      { text: BRIEF.moons, source: "brief" },
      { label: "Hill sphere and Roche limit", text: BRIEF.hill, source: "brief" },
    ],
  };
}
