/**
 * Deterministic layout for the solar system.
 *
 * Supersedes the spatial grammar in `src/lib/layout.ts` (the galaxy's Y/X/Z
 * assignment), not that file's role: positions are still a pure function of
 * seed data, computed once, unit-tested, never force-directed. A simulation
 * would rearrange the map between sessions and destroy the spatial memory that
 * makes a map worth having.
 *
 * THE COORDINATE SYSTEM  (docs/redesign/SOLAR-SYSTEM-SPEC.md §1.1)
 *
 *   orbit radius   the Computer Level Hierarchy. L0 innermost, nearest the
 *                  sun; L6 outermost. "Closer to the centre" already means
 *                  "closer to the core" in ordinary language, which is the
 *                  whole reason this beats an abstract vertical axis.
 *   angle          `ordinal` -- curriculum order, swept across ~300°.
 *   the plane      flat. There is no Y axis, on purpose: radius already
 *                  carries depth, and an axis encoding nothing is decoration.
 *   the sun        the machine itself. Not a chapter -- the destination the
 *                  whole course descends toward.
 *
 * Act is NOT a spatial axis. It moves to a HUD chip and flight-path colour
 * banding. Once critical-path position moved onto the flight path there was
 * nothing principled left for an angle-within-ring to encode, and an arbitrary
 * formula is decoration.
 *
 * FOUR RULINGS FROM R0 ARE IMPLEMENTED HERE (docs/PROGRESS.md, F-1..F-4).
 * Each is measured against the real seed, not assumed, and each has a named
 * test. Read them before changing a constant.
 */

import { seededHash } from "./bodies";
import { stageRing } from "./ring";

/* ------------------------------------------------------------------ types */

export interface StageInput {
  readonly id: string;
  readonly act: number;
  readonly ordinal: number;
  /** Levels the stage declares in `stages.levels`. */
  readonly levels: number[];
}

export interface ObjectiveInput {
  readonly id: string;
  readonly stageId: string;
  /** Computer Level Hierarchy level, 0-6. One per objective, always. */
  readonly level: number;
}

export interface Body {
  readonly id: string;
  readonly kind: "planet" | "moon";
  /** Ring this body belongs to. Fractional only if a stage's moons ever span levels. */
  readonly ring: number;
  /** Distance from the sun. */
  readonly radius: number;
  /** Radians. Curriculum order for planets; local orbital phase for moons. */
  readonly angle: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Moons only: the stage this objective belongs to. */
  readonly parentId?: string;
  /**
   * Moons only. True for roughly one moon in five — the seeded subset that
   * stays visible at overview scale as a preview (§5).
   *
   * Which moons are chosen varies per student and is purely cosmetic. The
   * COUNT is real data and is unaffected, and `/app/map` lists every moon
   * regardless of what the scene draws. This is a rendering hint, not a fact
   * about the curriculum.
   */
  readonly previewAtOverview?: boolean;
  /**
   * Planets only, and true for exactly one stage today. A stage declaring all
   * seven levels is not AT a level -- it is ABOUT the hierarchy, and renders as
   * a spoke crossing every ring rather than a point on one. See F-4.
   */
  readonly spansAllLevels?: boolean;
  /**
   * Planets only (R4.7, instructor 1 Oct 2026): the orbit is an ellipse with
   * the sun at a focus. `radius` is its semi-major axis, `e` its eccentricity
   * (gentle, and never reaching a neighbouring orbit), `omega` the direction
   * of perihelion. Curriculum data, never the student's seed: every student's
   * orbits are the same shape.
   */
  readonly e?: number;
  readonly omega?: number;
}

/** A level's band: one planet per orbit inside it, so distance still reads as level. */
export interface Band {
  readonly level: number;
  readonly inner: number;
  readonly outer: number;
}

export interface SolarLayout {
  readonly bodies: ReadonlyMap<string, Body>;
  /** Radius of each ring, indexed by level 0-6. The renderer draws these. */
  readonly ringRadii: readonly number[];
  /** Bodies sitting on each ring, indexed by level. Drives ring stroke weight. */
  readonly ringOccupancy: readonly number[];
  /** Each level's band, L0 innermost. `ringRadii[L]` is its centre. */
  readonly bands: readonly Band[];
  /** The frost line: the gap between L2 and L3, rocky inside, giants beyond (world.ts). */
  readonly frost: { readonly inner: number; readonly outer: number; readonly radius: number };
  /** Where the system's leftovers sit (cosmetic, R4.7): the asteroid belt fills the frost gap. */
  readonly kuiper: { readonly inner: number; readonly outer: number };
  readonly oort: number;
}

/* -------------------------------------------------------------- constants */

/** Levels 0..6. L0 innermost (nearest the hardware), L6 outermost. */
export const LEVELS = [0, 1, 2, 3, 4, 5, 6] as const;

export const LEVEL_NAMES: Record<number, string> = {
  6: "User",
  5: "High-Level Language",
  4: "Assembly Language",
  3: "System Software",
  2: "Machine / ISA",
  1: "Control",
  0: "Digital Logic",
};

/**
 * The sun's drawn radius (R4.9, instructor 2 Oct 2026: "also a bigger sun";
 * R4.7's was 1.7). The scene draws it; the layout keeps the innermost band
 * clear of it, tested with the innermost planet at its perihelion.
 */
export const SUN_RADIUS = 3.4;

/** Clearance around the sun, so the innermost band is not drawn through it. */
const INNER_RADIUS = SUN_RADIUS + 3;

/*
 * The spacing constants that were here (MIN_STEP, STEP_SPREAD, STEP_GROWTH)
 * drew circular rings spaced by occupancy (F-2). R4.7 replaced them with bands
 * sized by their planets (ORBIT_GAP, below); the F-2 property survives as
 * "a crowded level gets a wider band", tested in layout-solar.spec.ts.
 */

/**
 * The sweep, in radians. ~300°, deliberately NOT a full turn (F-3).
 *
 * At 360° stage 18 lands ~19° from stage 00 and the map draws a closed ring --
 * which says the curriculum returns to its start. It does not: 19 nodes, 18
 * edges, one chain, no forks, no return. The gap is the part that tells the
 * truth, so it is wider than any gap between consecutive stages.
 */
const SWEEP = (300 * Math.PI) / 180;

/** Where stage 00 sits. -90° puts it at the top, where a reader starts. */
const ANGLE_START = -Math.PI / 2;

/**
 * How far a moon orbits from its planet's centre.
 *
 * Must clear the planet itself. At 0.55 the moons sat INSIDE a mastered
 * planet's 0.62 radius — they rendered as bumps on its edge rather than as
 * bodies orbiting it, which only showed up once the focused tier drew them
 * individually and someone looked at the result.
 */
const MOON_ORBIT = 1.15;

/** Moons past this many per ring start a second, slightly wider ring. */
const MOONS_PER_LOCAL_RING = 8;

/**
 * R4.7, ONE PLANET PER ORBIT, A LEVEL IS A BAND (instructor, 1 Oct 2026).
 * Each level's band is as wide as its planets need (ORBIT_GAP each, never less
 * than MIN_BAND), so a crowded level still gets more room (F-2) and radius is
 * still strictly increasing in level. The gap at the frost line is wide enough
 * to hold the asteroid belt.
 *
 * R4.9 (instructor, 2 Oct 2026: "a wider orbit with enough space that they
 * don't overlap"): the orbits are wider, and a giant's orbit wider than a
 * rocky world's, since a giant is drawn larger. Which is which comes from the
 * level alone (the frost line sits between L2 and L3), never from the
 * student's seed. Tested on the moving planets: no two ever overlap.
 */
const ORBIT_GAP = 3.2;
const ORBIT_GAP_GIANTS = 4.4;
const MIN_BAND = 2.4;
const BAND_GAP = 1.2;
const FROST_GAP = 6;
/** Gentle: no orbit is more eccentric than this, and none reaches a neighbour's. */
const E_MIN = 0.03;
const E_MAX = 0.12;
/** How much of its slot an orbit's swing (a·e) may take, so neighbours keep their distance. */
const E_ROOM = 0.4;

/** A number in [0, 1) from a stage id: curriculum data, the same for every student. */
function unit(id: string, salt: string): number {
  return seededHash(`${salt}:${id}`) / 0x100000000;
}

/* ---------------------------------------------------------------- helpers */

/**
 * Which ring a stage sits on.
 *
 * The rule is the mean of its own moons' levels -- objectives each carry
 * exactly one level, unambiguously, so no collapse of `stages.levels` is
 * needed and none is guessed at.
 *
 * F-1, THE ONE CASE THAT IS NOT THAT: a stage with no objectives has no moons
 * and therefore no mean. Stage 00 (Orientation) is the only one in this
 * syllabus, and it is the first planet a student ever sees, so it gets a stated
 * fallback rather than a NaN: the deepest level it declares. That puts it on
 * ring 6, which is where the existing map already places it.
 *
 * This is deliberately a named branch and not a trailing `?? 6`, so the case is
 * visible to the next reader instead of hiding inside an expression.
 */
function ringForStage(stage: StageInput, moons: readonly ObjectiveInput[]): number {
  // No objectives authored for this stage falls back to its lowest level. See F-1.
  return stageRing(stage.levels, moons.map((m) => m.level));
}

/**
 * Angle for a stage, from curriculum order alone.
 *
 * Real data doing real work: this is the role radius played for critical-path
 * position in the galaxy, now that radius encodes depth. Because angle advances
 * monotonically with `ordinal`, the flight path reads as one continuous sweep
 * rather than a shape that jumps in two axes at once.
 */
export function angleForOrdinal(ordinal: number, stageCount: number): number {
  if (stageCount <= 1) return ANGLE_START;
  return ANGLE_START + (ordinal / (stageCount - 1)) * SWEEP;
}

/* ------------------------------------------------------------------- main */

/**
 * Which moons stay visible when nothing is focused.
 *
 * Deterministic from the moon's own id plus the student's cosmetic seed, so it
 * is stable across sessions rather than reshuffling on every render — a preview
 * set that changes each visit would be worse than no preview at all.
 *
 * Note the seed is a plain number handed in by the caller, and this is the ONLY
 * place in this file that sees it. It cannot reach any radius or angle: those
 * are computed before this runs and never consult it. `cosmetics.spec.ts`
 * asserts that separation directly.
 */
function isPreviewMoon(objectiveId: string, seed: number): boolean {
  let h = seed >>> 0;
  for (let i = 0; i < objectiveId.length; i += 1) {
    h = (Math.imul(h ^ objectiveId.charCodeAt(i), 0x01000193) >>> 0);
  }
  return h % 5 === 0;
}

export function computeSolarLayout(
  stages: readonly StageInput[],
  objectives: readonly ObjectiveInput[],
  /**
   * Cosmetic seed, used for ONE thing: which moons preview at overview scale.
   * Defaults to 0 so every existing caller and test is unaffected, and so the
   * function stays pure and reproducible.
   */
  previewSeed = 0,
): SolarLayout {
  const ordered = [...stages].sort((a, b) => a.ordinal - b.ordinal);

  const moonsByStage = new Map<string, ObjectiveInput[]>();
  for (const o of objectives) {
    const list = moonsByStage.get(o.stageId);
    if (list) list.push(o);
    else moonsByStage.set(o.stageId, [o]);
  }
  // Sort within a stage so a moon's orbital slot does not depend on fetch order.
  for (const list of moonsByStage.values()) list.sort((a, b) => a.id.localeCompare(b.id));

  // Pass 1: which ring is everything on? Needed before radii, since radii
  // depend on occupancy.
  const stageRing = new Map<string, number>();
  const occupancy = LEVELS.map(() => 0);

  /** Count one body onto a ring, ignoring anything outside L0-L6. */
  const countOnRing = (level: number): void => {
    const slot = Math.round(level);
    const current = occupancy[slot];
    if (current !== undefined) occupancy[slot] = current + 1;
  };

  for (const s of ordered) {
    const ring = ringForStage(s, moonsByStage.get(s.id) ?? []);
    stageRing.set(s.id, ring);
    countOnRing(ring);
  }
  for (const o of objectives) countOnRing(o.level);

  // Pass 2: the bands, one per level, as wide as their planets need (R4.7).
  const byBand = LEVELS.map(() => [] as StageInput[]);
  for (const s of ordered) byBand[Math.max(0, Math.min(6, Math.round(stageRing.get(s.id)!)))]!.push(s);
  for (const list of byBand) list.sort((a, b) => stageRing.get(a.id)! - stageRing.get(b.id)! || a.ordinal - b.ordinal);
  const bands: Band[] = [];
  let edge = INNER_RADIUS;
  for (const level of LEVELS) {
    if (level > 0) edge += level === 3 ? FROST_GAP : BAND_GAP;
    const width = Math.max(MIN_BAND, byBand[level]!.length * (level >= 3 ? ORBIT_GAP_GIANTS : ORBIT_GAP));
    bands.push({ level, inner: edge, outer: edge + width });
    edge += width;
  }
  const ringRadii = bands.map((b) => (b.inner + b.outer) / 2);
  const frost = { inner: bands[2]!.outer, outer: bands[3]!.inner, radius: (bands[2]!.outer + bands[3]!.inner) / 2 };
  const kuiper = { inner: bands[6]!.outer + 3, outer: bands[6]!.outer + 9 };

  // Each planet's own orbit: its slot in its band, and a gentle ellipse that
  // stays inside its slot (so no orbit ever reaches its neighbour's).
  const orbitOf = new Map<string, { a: number; e: number; omega: number }>();
  for (const level of LEVELS) {
    const list = byBand[level]!;
    const band = bands[level]!;
    const slot = (band.outer - band.inner) / Math.max(1, list.length);
    list.forEach((s, i) => {
      const a = band.inner + (i + 0.5) * slot;
      const eMax = Math.min(E_MAX, (E_ROOM * slot) / a);
      const e = Math.max(0, Math.min(eMax, E_MIN + unit(s.id, "e") * (eMax - E_MIN)));
      orbitOf.set(s.id, { a, e, omega: unit(s.id, "omega") * Math.PI * 2 });
    });
  }

  const bodies = new Map<string, Body>();

  for (const s of ordered) {
    const ring = stageRing.get(s.id)!;
    const orbit = orbitOf.get(s.id)!;
    const angle = angleForOrdinal(s.ordinal, ordered.length);
    // Where the ellipse puts it at the layout's angle (t = 0): r = a(1-e²)/(1+e cos ν).
    const radius = orbit.a;
    const r0 = (orbit.a * (1 - orbit.e * orbit.e)) / (1 + orbit.e * Math.cos(angle - orbit.omega));

    // F-4: a stage declaring every level is about the hierarchy, not in it.
    // Keep the flag so the renderer can draw it as a spoke across all seven
    // rings. Its own moons are all at one level, so the mean alone would
    // silently lose this.
    const spansAllLevels = s.levels.length >= LEVELS.length;

    bodies.set(s.id, {
      id: s.id,
      kind: "planet",
      ring,
      radius,
      angle,
      x: Math.cos(angle) * r0,
      y: 0,
      z: Math.sin(angle) * r0,
      spansAllLevels,
      e: orbit.e,
      omega: orbit.omega,
    });

    // Moons orbit their planet, not the sun. A moon's `ring` still records its
    // own objective's level -- that is what the flat map and the screen-reader
    // list read -- but placing it at that radius from the sun would drop it
    // exactly on top of its parent, since a stage's objectives are all at the
    // stage's own level.
    const moons = moonsByStage.get(s.id) ?? [];
    moons.forEach((m, i) => {
      const localRing = Math.floor(i / MOONS_PER_LOCAL_RING);
      const inRing = moons.length - localRing * MOONS_PER_LOCAL_RING;
      const countHere = Math.min(MOONS_PER_LOCAL_RING, inRing);
      const slot = i % MOONS_PER_LOCAL_RING;
      const localAngle = (slot / countHere) * Math.PI * 2;
      const localRadius = MOON_ORBIT * (1 + localRing * 0.45);

      bodies.set(m.id, {
        id: m.id,
        kind: "moon",
        ring: m.level,
        radius: localRadius,
        angle: localAngle,
        x: Math.cos(angle) * r0 + Math.cos(localAngle) * localRadius,
        y: 0,
        z: Math.sin(angle) * r0 + Math.sin(localAngle) * localRadius,
        parentId: s.id,
        previewAtOverview: isPreviewMoon(m.id, previewSeed),
      });
    });
  }

  // The Oort cloud far out (R4.9): comets falling from it stay out there nearly all the time.
  return { bodies, ringRadii, ringOccupancy: occupancy, bands, frost, kuiper, oort: kuiper.outer * 2.2 };
}

/** The flight path: curriculum order, one point per stage. */
export function flightPath(layout: SolarLayout, stages: readonly StageInput[]): Body[] {
  return [...stages]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => layout.bodies.get(s.id))
    .filter((b): b is Body => b !== undefined);
}
