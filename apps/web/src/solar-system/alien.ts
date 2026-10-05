import { orbitThrough, positionAt, type Orbit } from "./kepler";
import type { SmallOrbit } from "./populations";

/**
 * The easter egg (instructor, 5 Oct 2026): "sometimes in a comet orbit an
 * alien will come to orbit, and if we click on that alien riding a flying
 * saucer we will focus on that alien", with a speech bubble on every click.
 *
 * The saucer rides one comet's own ellipse (its a, e and perihelion), at its
 * own phase: its first pass through the inner system falls 25-75 seconds
 * after the map opens, seeded per student, and then, like every comet, it
 * spends most of its period out at the edges. That is the "sometimes". Seeded,
 * never random, like everything on the map. `?alien=now` brings it in at once.
 *
 * Cosmetic: it is no stage and no moon, and choosing it changes nothing a
 * student is graded on. Its words are the instructor's, in this order.
 */

export const ALIEN_LINES = ["Pag tuon haa", "Oi tan aw man ka", "Alien nako BOII!", "Shem gwapo"] as const;

/** The line the n-th click shows (0-based), in order, round and round. */
export function alienLine(n: number): string {
  return ALIEN_LINES[((n % ALIEN_LINES.length) + ALIEN_LINES.length) % ALIEN_LINES.length]!;
}

/** The comet it rides, by the student's seed. */
export function alienComet(comets: readonly SmallOrbit[], seed: number): number {
  return comets.length ? Math.floor(Math.abs(seed) * 1e6) % comets.length : -1;
}

/** Seconds after the map opens at which the saucer first passes perihelion: 25 to 75, seeded. */
export function alienFirstPass(seed: number): number {
  return 25 + ((Math.floor(Math.abs(seed) * 7919e3) % 5001) / 5000) * 50;
}

/**
 * The saucer's orbit: the comet's ellipse (turned by the student's rotation,
 * as the comet is), with its mean anomaly set so it reaches perihelion at
 * `passAt` seconds. `now` puts it there at t = 0.
 */
export function alienOrbit(comet: SmallOrbit, rotation: number, passAt: number): Orbit {
  const base = orbitThrough({ a: comet.a, e: comet.e, omega: comet.omega + rotation, theta0: comet.theta0 + rotation });
  const n = (2 * Math.PI) / base.period;
  return { ...base, M0: -n * passAt };
}

/** Whether the saucer is in the inner system, where a student can see it: inside 1.6 frost lines. */
export function alienNear(o: Orbit, t: number, frostRadius: number): boolean {
  return positionAt(o, t).r < frostRadius * 1.6;
}

