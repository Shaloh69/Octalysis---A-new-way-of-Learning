import { KIND_SCALE, seededHash, type BodyKind, type RingStyle } from "./bodies";

/**
 * Moons, rings and the planets they belong to (R4.7; the instructor's brief:
 * "any major moons must remain securely within their planet's gravitational
 * Hill Sphere and outside its destructive tidal Roche Limit"; "Planetary
 * Rings ... orbiting a planet inside its Roche Limit"; "a massive host star
 * containing over 99% of the system's mass").
 *
 * THE MAP IS NOT TO SCALE, as no orrery is: a real moon system is far too
 * small to see beside its planet's orbit. So the physics is real and the
 * drawing is magnified ONCE, uniformly: each world has a mass ratio to its
 * star (Earth-like ~3e-6, Jupiter-like ~1e-3, so the star holds over 99% of
 * every system), its Hill radius is the real a(1-e)·∛(μ/3), and every moon
 * system is drawn MOON_SYSTEM_SCALE times larger than that frame. Inside the
 * magnified frame the order the brief asks for holds, and is tested on the
 * seeded layout: Roche limit < every moon's orbit < Hill radius, and a ring
 * inside the Roche limit.
 */

/** The fluid Roche limit for a moon of the planet's own density: 2.44 planet radii. */
export const ROCHE_K = 2.44;
/** How much larger every moon system is drawn than its orbit's scale allows. One number for all. */
export const MOON_SYSTEM_SCALE = 200;
/** Space between successive moon orbits, before the scene's scale. */
const MOON_GAP = 0.26;

/** Planet mass over star mass, by kind (Earth, Venus, Jupiter, Saturn, Uranus and Neptune's own). */
export const MASS_RATIO: Record<BodyKind, number> = {
  rocky: 3.0e-6,
  earthlike: 3.0e-6,
  veiled: 2.4e-6,
  gas: 9.5e-4,
  ringed: 2.9e-4,
  ice: 5.0e-5,
};

/**
 * How large every planet and moon system is drawn (R4.9, instructor 2 Oct
 * 2026: "smaller planets"). R4.7 grew bodies with the system (its outermost
 * ring over 35 units: 1.73); R4.9 fixes them at 0.65 of that, so widening the
 * orbits no longer grows the planets, and a chosen planet's moon system keeps
 * its proportions (the camera fits it either way).
 */
export const BODY_SCALE = 1.73 * 0.65;

/** A planet's drawn radius: it still grows with its moons, its kind makes a giant read as one. */
export function planetSize(moonCount: number, kind: BodyKind, scale: number): number {
  return (0.62 + Math.min(moonCount || 5, 12) * 0.035) * KIND_SCALE[kind] * scale;
}

export function rocheLimit(size: number): number {
  return ROCHE_K * size;
}

/** The i-th moon's orbit: the first just outside the Roche limit, each further one a gap out. */
export function moonOrbit(size: number, i: number, scale: number): number {
  return rocheLimit(size) * 1.08 + i * MOON_GAP * scale;
}

/** The Hill radius, magnified like every moon system: a(1-e)·∛(μ/3) × MOON_SYSTEM_SCALE. */
export function hillRadius(a: number, e: number, kind: BodyKind): number {
  return MOON_SYSTEM_SCALE * a * (1 - e) * Math.cbrt(MASS_RATIO[kind] / 3);
}

/** A ring's inner and outer edge, as drawn: inside the Roche limit, where no moon can form. */
export function ringSpan(size: number): [number, number] {
  return [size * 1.35, size * 2.3];
}

/* --------------------------------------------- R4.8: the rest of the brief */

/** Gas and ice giants: the worlds beyond the frost line (`world.ts`'s OUTER_WORLDS are all of these kinds). */
export function isGiant(kind: BodyKind): boolean {
  return kind === "gas" || kind === "ringed" || kind === "ice";
}

const studentKey = (seed: number) => Math.round(seed * 1e6);

/**
 * How many of a planet's moons are captured irregulars (the brief: "tiny,
 * captured irregularly-shaped asteroids"). Only a giant captures them, as the
 * real giants have; its OUTERMOST one or two moons, seeded per student, never
 * more than a third of them, so most of a giant's moons stay round. A moon
 * stays a moon whatever its shape: the count, the order, the button in the
 * panel, the glow states and the pick target are all unchanged.
 */
export function irregularCount(kind: BodyKind, moonCount: number, planetId: string, seed: number): number {
  if (!isGiant(kind) || moonCount < 3) return 0;
  const most = Math.max(1, Math.floor(moonCount / 3));
  return 1 + (seededHash(`captured:${planetId}:${studentKey(seed)}`) % Math.min(2, most));
}

/** Whether the i-th moon (innermost first) is a captured irregular: the last `irregularCount` of them. */
export function isIrregular(kind: BodyKind, i: number, moonCount: number, planetId: string, seed: number): boolean {
  return i >= moonCount - irregularCount(kind, moonCount, planetId, seed);
}

/** Captured moons orbit backwards, as Phoebe and Triton do: -1 for one, 1 for every other moon. */
export function moonDirection(kind: BodyKind, i: number, moonCount: number, planetId: string, seed: number): 1 | -1 {
  return isIrregular(kind, i, moonCount, planetId, seed) ? -1 : 1;
}

/**
 * A captured moon's lumpy shape: its three axes, the longest whole and none
 * under half, so it reads as a potato and never shrinks out of sight. Seeded
 * by the moon and the student.
 */
export function irregularShape(moonId: string, seed: number): [number, number, number] {
  const h = seededHash(`shape:${moonId}:${studentKey(seed)}`);
  const mid = 0.6 + ((h & 0xff) / 255) * 0.2;
  const short = 0.5 + (((h >>> 8) & 0xff) / 255) * 0.1;
  const order = (h >>> 16) % 3;
  return order === 0 ? [1, mid, short] : order === 1 ? [mid, short, 1] : [short, 1, mid];
}

export const RING_STYLES = ["dust", "narrow", "arcs"] as const satisfies readonly RingStyle[];

/**
 * The faint rings of the giants beyond Saturn (the brief: "Planetary Rings:
 * Billions of tiny particles ... orbiting a planet inside its Roche Limit"),
 * each band a fraction of `ringSpan` (0 its inner edge, 1 its outer), so every
 * one lies inside the Roche limit. Shaped after the real ones, and faint.
 */
export function ringBands(style: RingStyle): Array<{ from: number; to: number; alpha: number }> {
  switch (style) {
    case "dust": // Jupiter's: a faint halo, a brighter main ring, the gossamer sheets outside it.
      return [
        { from: 0, to: 0.35, alpha: 0.06 },
        { from: 0.35, to: 0.5, alpha: 0.18 },
        { from: 0.5, to: 1, alpha: 0.04 },
      ];
    case "narrow": // Uranus's: thin dark rings, the outermost (epsilon) the widest and brightest.
      return [0.3, 0.38, 0.45, 0.52, 0.58, 0.64, 0.7, 0.78]
        .map((f) => ({ from: f, to: f + 0.015, alpha: 0.32 }))
        .concat([{ from: 0.9, to: 0.94, alpha: 0.45 }]);
    case "arcs": // Neptune's: two broad faint rings, two narrow ones, the outer the brightest.
      return [
        { from: 0, to: 0.25, alpha: 0.07 },
        { from: 0.45, to: 0.47, alpha: 0.32 },
        { from: 0.47, to: 0.8, alpha: 0.05 },
        { from: 0.86, to: 0.885, alpha: 0.42 },
      ];
  }
}
