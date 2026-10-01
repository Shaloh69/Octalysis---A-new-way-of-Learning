import { describe, it, expect } from "vitest";
import { orbitThrough, positionAt, solveKepler } from "../src/solar-system/kepler";

/**
 * R4.7, gentle ellipses (instructor, 1 Oct 2026): "planets orbit along distinct
 * elliptical paths rather than perfect circles, dynamically accelerating at
 * their closest approach (perihelion) and slowing down at their farthest
 * (aphelion)" (docs/source/solar-system-brief.md). Kepler's three laws, tested
 * as laws, not as pictures.
 */

const OUTER = 40;
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
    const o = orbitThrough({ a: 12, e: 0.1, omega: 0.7, theta0: 1.1, outerA: OUTER });
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
    const o = orbitThrough({ a: 10, e: 0.12, omega: 2, theta0: 0, outerA: OUTER });
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
    const o = orbitThrough({ a: 12, e: 0.12, omega: 0, theta0: 0, outerA: OUTER });
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
    const o = orbitThrough({ a: 12, e, omega: 0, theta0: 0, outerA: OUTER });
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
    const a = orbitThrough({ a: 8, e: 0.05, omega: 0, theta0: 0, outerA: OUTER });
    const b = orbitThrough({ a: 20, e: 0.1, omega: 1, theta0: 2, outerA: OUTER });
    expect((a.period / b.period) ** 2).toBeCloseTo((8 / 20) ** 3, 10);
  });

  it("at t = 0 the planet is where the curriculum layout put it", () => {
    for (const theta0 of [-1.5, 0, 0.8, 2.9, 4.4]) {
      const o = orbitThrough({ a: 15, e: 0.11, omega: 1.3, theta0, outerA: OUTER });
      const p = positionAt(o, 0);
      const d = Math.atan2(p.y, p.x) - theta0;
      expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThan(1e-9);
    }
  });

  it("a circle (e = 0) keeps a constant distance and speed", () => {
    const o = orbitThrough({ a: 9, e: 0, omega: 0, theta0: 0.4, outerA: OUTER });
    for (let i = 0; i < 50; i++) expect(positionAt(o, (o.period * i) / 50).r).toBeCloseTo(9, 10);
  });
});
