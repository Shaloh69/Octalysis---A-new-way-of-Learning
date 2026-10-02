import { describe, it, expect } from "vitest";
import { lagrangePoint, orbitThrough, positionAt, radiusAt, solveKepler } from "../src/solar-system/kepler";
import { STAR_GM, starPeriod } from "../src/solar-system/orbit";

/**
 * R4.7, gentle ellipses (instructor, 1 Oct 2026): "planets orbit along distinct
 * elliptical paths rather than perfect circles, dynamically accelerating at
 * their closest approach (perihelion) and slowing down at their farthest
 * (aphelion)" (docs/source/solar-system-brief.md). Kepler's three laws, tested
 * as laws, not as pictures.
 */

const TAU = 2 * Math.PI;

describe("Kepler's equation", () => {
  it("E - e sin E = M, solved to machine precision across the orbit", () => {
    for (const e of [0, 0.05, 0.12, 0.3]) {
      for (let M = 0; M < TAU; M += 0.37) {
        const E = solveKepler(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 10);
      }
    }
  });
});

describe("the first law: an ellipse with the star at one focus", () => {
  it("the distance stays between perihelion a(1-e) and aphelion a(1+e), and reaches both", () => {
    const o = orbitThrough({ a: 12, e: 0.1, omega: 0.7, theta0: 1.1 });
    let min = Infinity;
    let max = 0;
    for (let i = 0; i <= 2000; i++) {
      const { r } = positionAt(o, (o.period * i) / 2000);
      min = Math.min(min, r);
      max = Math.max(max, r);
      expect(r).toBeGreaterThanOrEqual(12 * 0.9 - 1e-9);
      expect(r).toBeLessThanOrEqual(12 * 1.1 + 1e-9);
    }
    expect(min).toBeCloseTo(10.8, 2);
    expect(max).toBeCloseTo(13.2, 2);
  });

  it("perihelion points along omega: the closest approach is in that direction", () => {
    const o = orbitThrough({ a: 10, e: 0.12, omega: 2, theta0: 0 });
    let best = { r: Infinity, x: 0, y: 0 };
    for (let i = 0; i < 4000; i++) {
      const p = positionAt(o, (o.period * i) / 4000);
      if (p.r < best.r) best = p;
    }
    expect(Math.atan2(best.y, best.x)).toBeCloseTo(2, 2);
  });
});

describe("the second law: equal areas in equal times", () => {
  it("the area swept in a short interval is the same at perihelion and at aphelion", () => {
    const o = orbitThrough({ a: 12, e: 0.12, omega: 0, theta0: 0 });
    const dt = o.period / 5000;
    const swept = (t: number) => {
      const p = positionAt(o, t);
      const q = positionAt(o, t + dt);
      return Math.abs(p.x * q.y - p.y * q.x) / 2;
    };
    const areas: number[] = [];
    for (let k = 0; k < 20; k++) areas.push(swept((o.period * k) / 20));
    const mean = areas.reduce((s, a) => s + a, 0) / areas.length;
    for (const a of areas) expect(Math.abs(a - mean) / mean).toBeLessThan(1e-3);
  });

  it("so it is faster at perihelion than at aphelion, by (1+e)/(1-e)", () => {
    const e = 0.1;
    const o = orbitThrough({ a: 12, e, omega: 0, theta0: 0 });
    const dt = o.period / 100000;
    const speed = (t: number) => {
      const p = positionAt(o, t);
      const q = positionAt(o, t + dt);
      return Math.hypot(q.x - p.x, q.y - p.y) / dt;
    };
    // Mean anomaly 0 is perihelion; half a period later, aphelion.
    const tPeri = ((0 - o.M0 + TAU) % TAU) / ((TAU) / o.period);
    const vp = speed(tPeri);
    const va = speed(tPeri + o.period / 2);
    expect(vp).toBeGreaterThan(va);
    expect(vp / va).toBeCloseTo((1 + e) / (1 - e), 2);
  });
});

describe("the third law, and where it starts", () => {
  it("T² ∝ a³", () => {
    const a = orbitThrough({ a: 8, e: 0.05, omega: 0, theta0: 0 });
    const b = orbitThrough({ a: 20, e: 0.1, omega: 1, theta0: 2 });
    expect((a.period / b.period) ** 2).toBeCloseTo((8 / 20) ** 3, 10);
  });

  it("at t = 0 the planet is where the curriculum layout put it", () => {
    for (const theta0 of [-1.5, 0, 0.8, 2.9, 4.4]) {
      const o = orbitThrough({ a: 15, e: 0.11, omega: 1.3, theta0 });
      const p = positionAt(o, 0);
      const d = Math.atan2(p.y, p.x) - theta0;
      expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThan(1e-9);
    }
  });

  it("a circle (e = 0) keeps a constant distance and speed", () => {
    const o = orbitThrough({ a: 9, e: 0, omega: 0, theta0: 0.4 });
    for (let i = 0; i < 50; i++) expect(positionAt(o, (o.period * i) / 50).r).toBeCloseTo(9, 10);
  });
});

/**
 * R4.8 (the brief: "The Host Star: The gravitational anchor of the entire
 * system. Its mass dictates the speed and distance of all orbiting bodies").
 * Periods come from the star's mass, T = 2π√(a³/GM), not from a scale fitted
 * to the outermost orbit.
 */
describe("the host star's mass dictates the speed (R4.8)", () => {
  it("T = 2π√(a³/GM), with one star-mass constant", () => {
    for (const a of [3, 12.5, 40, 61]) expect(starPeriod(a)).toBeCloseTo(TAU * Math.sqrt(a ** 3 / STAR_GM), 9);
  });

  it("a heavier star turns every orbit faster, in the same ratio: four times the mass, half the period", () => {
    for (const a of [4, 9.5, 22, 60]) expect(starPeriod(a, 4 * STAR_GM) / starPeriod(a)).toBeCloseTo(0.5, 12);
  });

  it("an orbit takes its period from the star it circles", () => {
    const light = orbitThrough({ a: 20, e: 0.05, omega: 0, theta0: 0 });
    const heavy = orbitThrough({ a: 20, e: 0.05, omega: 0, theta0: 0, gm: 9 * STAR_GM });
    expect(light.period).toBeCloseTo(starPeriod(20), 9);
    expect(heavy.period).toBeCloseTo(light.period / 3, 9);
  });
});

/**
 * R4.8, the Trojans (the brief: "a massive planet paired with a smaller
 * companion tucked 60 degrees ahead or behind it in a stable Lagrange point").
 * L4 leads the planet by 60°, L5 trails it by 60°, both on the planet's own
 * orbit, at every moment.
 */
describe("Lagrange points L4 and L5 (R4.8)", () => {
  const o = orbitThrough({ a: 44, e: 0.12, omega: 0.9, theta0: 2.2 });
  const wrap = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));

  it("each is 60° from its planet, L4 ahead and L5 behind, at every t", () => {
    for (let i = 0; i < 400; i++) {
      const t = (o.period * i) / 400;
      const p = positionAt(o, t);
      const theta = Math.atan2(p.y, p.x);
      expect(wrap(lagrangePoint(o, t, 4).theta - theta)).toBeCloseTo(Math.PI / 3, 9);
      expect(wrap(lagrangePoint(o, t, 5).theta - theta)).toBeCloseTo(-Math.PI / 3, 9);
    }
  });

  it("each lies on the planet's own orbit: r = a(1-e²)/(1+e cos(θ-ω))", () => {
    for (let i = 0; i < 400; i++) {
      const t = (o.period * i) / 400;
      for (const side of [4, 5] as const) {
        const L = lagrangePoint(o, t, side);
        expect(Math.hypot(L.x, L.y)).toBeCloseTo(L.r, 9);
        expect(L.r).toBeCloseTo((o.a * (1 - o.e ** 2)) / (1 + o.e * Math.cos(L.theta - o.omega)), 9);
        expect(radiusAt(o, L.theta)).toBeCloseTo(L.r, 9);
      }
    }
  });

  it("L4 is ahead in the direction of motion: the planet moves towards it", () => {
    const t = o.period * 0.3;
    const now = positionAt(o, t);
    const soon = positionAt(o, t + o.period / 200);
    const L4 = lagrangePoint(o, t, 4);
    const gap = (q: { x: number; y: number }) => Math.abs(wrap(L4.theta - Math.atan2(q.y, q.x)));
    expect(gap(soon)).toBeLessThan(gap(now));
  });
});
