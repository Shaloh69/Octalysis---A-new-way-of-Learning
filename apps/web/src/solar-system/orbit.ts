/**
 * Orbital motion (WEB-REVAMP.md §4): Kepler's third law, T² ∝ a³, so the
 * angular speed of a circular orbit is ω ∝ a^-1.5. The orbits stay circular,
 * so a planet's radius still means its level; only the angle moves.
 *
 * Pure and deterministic: the same radius and the same time give the same
 * angle on every device, and at t = 0 every planet sits where the layout put
 * it (`computeSolarLayout`: curriculum order). Under reduced motion the map
 * simply holds t at 0.
 */

/** Seconds for the OUTERMOST ring to go round once. Slow: ambient, never busy. */
export const OUTER_PERIOD_S = 600;

/** Period of an orbit of radius `a`, scaled so the outermost ring takes OUTER_PERIOD_S. */
export function periodSeconds(a: number, outer: number): number {
  return OUTER_PERIOD_S * Math.pow(a / outer, 1.5);
}

/** Radians per second: ω = 2π / T, which is ∝ a^-1.5. */
export function angularSpeed(a: number, outer: number): number {
  return (2 * Math.PI) / periodSeconds(a, outer);
}

/** The angle of a body that started at `angle0` on an orbit of radius `a`, after `t` seconds. */
export function orbitAngle(angle0: number, a: number, outer: number, t: number): number {
  if (t === 0) return angle0;
  const TAU = 2 * Math.PI;
  return (((angle0 + angularSpeed(a, outer) * t) % TAU) + TAU) % TAU;
}
