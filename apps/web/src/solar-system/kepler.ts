import { periodSeconds } from "./orbit";

/**
 * Elliptical orbits (R4.7; instructor, 1 Oct 2026: gentle ellipses, faster at
 * perihelion, slower at aphelion). Kepler's three laws, exactly:
 *
 *   1. an ellipse with the star at one focus: r = a(1 - e cos E)
 *   2. equal areas in equal times: the MEAN anomaly advances uniformly,
 *      M = M0 + n t, and E follows from Kepler's equation E - e sin E = M
 *   3. T² ∝ a³: the period is `orbit.ts`'s, scaled to the outermost orbit
 *
 * Pure and deterministic: the same orbit and time give the same point on every
 * device. At t = 0 the body sits at `theta0`, the angle the curriculum layout
 * gave it, so the map still opens in curriculum order. Under reduced motion
 * the map holds t at 0.
 */

const TAU = 2 * Math.PI;

export interface Orbit {
  /** Semi-major axis. */
  a: number;
  /** Eccentricity, 0 for a circle; "gentle" here, a few hundredths. */
  e: number;
  /** Direction of perihelion, radians from +x. */
  omega: number;
  /** Mean anomaly at t = 0. */
  M0: number;
  /** Seconds per orbit. */
  period: number;
}

/** E such that E - e sin E = M (Newton's method; converges in a few steps for e < 0.9). */
export function solveKepler(M: number, e: number): number {
  const m = ((M % TAU) + TAU) % TAU;
  let E = e < 0.8 ? m : Math.PI;
  for (let i = 0; i < 12; i++) {
    const f = E - e * Math.sin(E) - m;
    E -= f / (1 - e * Math.cos(E));
    if (Math.abs(f) < 1e-14) break;
  }
  return E;
}

/** The orbit of semi-major axis `a` and eccentricity `e` that passes through angle `theta0` at t = 0. */
export function orbitThrough(o: { a: number; e: number; omega: number; theta0: number; outerA: number }): Orbit {
  const nu = o.theta0 - o.omega;
  const E0 = 2 * Math.atan2(Math.sqrt(1 - o.e) * Math.sin(nu / 2), Math.sqrt(1 + o.e) * Math.cos(nu / 2));
  return { a: o.a, e: o.e, omega: o.omega, M0: E0 - o.e * Math.sin(E0), period: periodSeconds(o.a, o.outerA) };
}

/** Where the body is at time t: the plane's x and y (the star at the origin), and its distance. */
export function positionAt(o: Orbit, t: number): { x: number; y: number; r: number } {
  const E = solveKepler(o.M0 + (TAU / o.period) * t, o.e);
  const px = o.a * (Math.cos(E) - o.e);
  const py = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
  const c = Math.cos(o.omega);
  const s = Math.sin(o.omega);
  return { x: px * c - py * s, y: px * s + py * c, r: o.a * (1 - o.e * Math.cos(E)) };
}

/** The ellipse's own points, for drawing the orbit line: n points, the star at a focus. */
export function ellipsePoints(o: Pick<Orbit, "a" | "e" | "omega">, n = 128): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const c = Math.cos(o.omega);
  const s = Math.sin(o.omega);
  const b = o.a * Math.sqrt(1 - o.e * o.e);
  for (let i = 0; i <= n; i++) {
    const E = (TAU * i) / n;
    const px = o.a * (Math.cos(E) - o.e);
    const py = b * Math.sin(E);
    out.push({ x: px * c - py * s, y: px * s + py * c });
  }
  return out;
}
