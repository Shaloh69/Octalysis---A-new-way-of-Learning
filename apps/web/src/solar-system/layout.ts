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
}

export interface SolarLayout {
  readonly bodies: ReadonlyMap<string, Body>;
  /** Radius of each ring, indexed by level 0-6. The renderer draws these. */
  readonly ringRadii: readonly number[];
  /** Bodies sitting on each ring, indexed by level. Drives ring stroke weight. */
  readonly ringOccupancy: readonly number[];
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

/** Clearance around the sun, so the innermost ring is not drawn through it. */
const INNER_RADIUS = 4;

/** Every ring gets at least this much step, so an empty ring is still visible. */
const MIN_STEP = 0.8;

/**
 * How much extra radius the busiest ring earns over an empty one (F-2).
 *
 * Tuned, not arbitrary: the tightest ring's arc-length-per-body improves
 * measurably against even spacing, which `layout-solar.spec.ts` asserts as a
 * property rather than pinning these numbers. Raise it and crowded rings spread
 * further; the monotonicity and student-independence tests must both still pass.
 */
const STEP_SPREAD = 3.2;

/**
 * How much more room each ring gets than the one inside it.
 *
 * Ring spacing GROWS outward rather than stepping uniformly (§1.1). The gap
 * between L5 and L6 is visibly larger than the gap between L0 and L1, which is
 * what gives the system a sense of scale — a uniform widening just makes a
 * bigger flat disc, and real orbital systems do not step evenly either.
 *
 * Still a fixed, deterministic function of LEVEL. It is not a function of time,
 * completion order, or progress, and §1.1 explicitly forbids making it one:
 * radius carries the Computer Level Hierarchy, and a time-varying value inside
 * that axis would replace a fact with an effect that merely resembles it.
 */
const STEP_GROWTH = 1.32;

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

/** How far a moon orbits from its planet's centre. */
const MOON_ORBIT = 0.55;

/** Moons past this many per ring start a second, slightly wider ring. */
const MOONS_PER_LOCAL_RING = 8;

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
  if (moons.length === 0) {
    // No objectives authored for this stage. See F-1.
    return Math.min(...stage.levels);
  }
  return moons.reduce((sum, m) => sum + m.level, 0) / moons.length;
}

/**
 * Ring radii, spaced by how loaded each ring is (F-2).
 *
 * Even steps were the original rule and they fail the thing they were meant to
 * fix. Measured against the real seed: L1 carries 7 of 19 planets and 43 of 110
 * moons -- 39% of every body in the system -- on the second-smallest
 * circumference, while L4 and L5 carry nothing at all. Even spacing gives the
 * most crowded ring one of the least room.
 *
 * So each ring's radial STEP grows with its own load, which pushes a crowded
 * ring (and everything outside it) outward and buys it circumference.
 *
 * Two properties this may never break, both tested:
 *   - radius is strictly increasing in level. L0 is always innermost. That is
 *     the semantic claim the whole map rests on.
 *   - radius is identical for every student. Occupancy comes from curriculum
 *     data, never from the per-student cosmetic seed.
 *
 * `DESIGN-MANDATE-V2.md` §1B states the principle this obeys: which ring a body
 * sits on is data and is never adjusted; how far apart the rings are drawn is a
 * rendering constant. Ordering is data, spacing is typography.
 */
function computeRingRadii(occupancy: readonly number[]): number[] {
  const busiest = Math.max(...occupancy, 1);
  const radii: number[] = [];
  let r = INNER_RADIUS;
  for (const level of LEVELS) {
    // Two independent contributions, both positive, so the result is strictly
    // increasing by construction: occupancy (F-2) widens crowded rings, and
    // growth widens every ring relative to the one inside it.
    const load = MIN_STEP + STEP_SPREAD * ((occupancy[level] ?? 0) / busiest);
    r += load * Math.pow(STEP_GROWTH, level);
    radii[level] = r;
  }
  return radii;
}

/** Radius for a possibly-fractional ring, interpolating between whole rings. */
function radiusForRing(ring: number, ringRadii: readonly number[]): number {
  const lo = Math.floor(ring);
  const hi = Math.ceil(ring);
  const loR = ringRadii[Math.max(0, Math.min(6, lo))]!;
  if (lo === hi) return loR;
  const hiR = ringRadii[Math.max(0, Math.min(6, hi))]!;
  return loR + (hiR - loR) * (ring - lo);
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

  // Pass 2: radii, then place everything.
  const ringRadii = computeRingRadii(occupancy);
  const bodies = new Map<string, Body>();

  for (const s of ordered) {
    const ring = stageRing.get(s.id)!;
    const radius = radiusForRing(ring, ringRadii);
    const angle = angleForOrdinal(s.ordinal, ordered.length);

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
      x: Math.cos(angle) * radius,
      y: 0,
      z: Math.sin(angle) * radius,
      spansAllLevels,
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
        x: Math.cos(angle) * radius + Math.cos(localAngle) * localRadius,
        y: 0,
        z: Math.sin(angle) * radius + Math.sin(localAngle) * localRadius,
        parentId: s.id,
        previewAtOverview: isPreviewMoon(m.id, previewSeed),
      });
    });
  }

  return { bodies, ringRadii, ringOccupancy: occupancy };
}

/** The flight path: curriculum order, one point per stage. */
export function flightPath(layout: SolarLayout, stages: readonly StageInput[]): Body[] {
  return [...stages]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => layout.bodies.get(s.id))
    .filter((b): b is Body => b !== undefined);
}
