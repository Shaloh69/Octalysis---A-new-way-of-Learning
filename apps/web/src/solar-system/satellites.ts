import { KIND_SCALE, type BodyKind } from "./bodies";

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
