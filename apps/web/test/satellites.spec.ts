import { describe, it, expect } from "vitest";
import {
  isGiant,
  irregularCount,
  isIrregular,
  irregularShape,
  moonDirection,
  ringBands,
  ringSpan,
  rocheLimit,
  RING_STYLES,
  BODY_SCALE,
  MASS_RATIO,
  MOON_CLOCK,
  MOON_E_MAX,
  MOON_SIZE,
  hillRadius,
  moonOrbitsOf,
  planetGM,
  planetSize,
} from "../src/solar-system/satellites";
import { positionAt, radiusAt } from "../src/solar-system/kepler";
import { skinFor, type BodyKind } from "../src/solar-system/bodies";
import { OUTER_WORLDS, INNER_WORLDS } from "../src/solar-system/world";

/**
 * R4.8 (instructor, 2 Oct 2026): the rest of the brief's moons and rings.
 * "Moons ... ranging from massive spheroidal worlds with subsurface oceans to
 * tiny, captured irregularly-shaped asteroids", and "Planetary Rings ...
 * orbiting a planet inside its Roche Limit" on the giants beyond Saturn.
 */

const KINDS: BodyKind[] = ["rocky", "earthlike", "veiled", "gas", "ringed", "ice"];
const seeds = [0, 0.37, 1.234, 5.5, 9.81];

describe("which worlds are giants", () => {
  it("every world beyond the frost line is a giant; none inside it is", () => {
    for (const k of OUTER_WORLDS) expect(isGiant(skinFor(k).kind), k).toBe(true);
    for (const k of INNER_WORLDS) expect(isGiant(skinFor(k).kind), k).toBe(false);
  });
});

describe("captured irregular moons (R4.8)", () => {
  it("only a giant captures them, and only its OUTERMOST moons", () => {
    for (const seed of seeds) {
      for (const kind of KINDS) {
        for (const n of [0, 1, 2, 3, 5, 8, 11]) {
          const c = irregularCount(kind, n, "06", seed);
          if (!isGiant(kind) || n < 3) expect(c, `${kind} ${n}`).toBe(0);
          else {
            expect(c, `${kind} ${n}`).toBeGreaterThanOrEqual(1);
            expect(c).toBeLessThanOrEqual(Math.max(1, Math.floor(n / 3)));
          }
          for (let i = 0; i < n; i++) expect(isIrregular(kind, i, n, "06", seed)).toBe(i >= n - c);
        }
      }
    }
  });

  it("the rest stay spheres: most of a giant's moons are round", () => {
    for (const seed of seeds) expect(irregularCount("gas", 10, "06", seed)).toBeLessThan(5);
  });

  it("seeded per student: the same student sees the same moons; some students see a different count", () => {
    expect(irregularCount("gas", 10, "06", 0.37)).toBe(irregularCount("gas", 10, "06", 0.37));
    const counts = new Set([...seeds, 2, 3, 4, 6, 7].map((s) => irregularCount("gas", 10, "06", s)));
    expect(counts.size).toBeGreaterThan(1);
  });

  it("an irregular shape is lumpy but never tiny: its longest axis is whole, none under half", () => {
    for (const seed of seeds) {
      for (const id of ["06.1", "06.10", "08.5", "18.4"]) {
        const s = irregularShape(id, seed);
        expect(Math.max(...s)).toBe(1);
        expect(Math.min(...s)).toBeGreaterThanOrEqual(0.5);
        expect(Math.max(...s) - Math.min(...s)).toBeGreaterThan(0.15);
      }
    }
  });

  it("captured moons orbit backwards, as captured moons do; every other moon goes the planet's way", () => {
    for (let i = 0; i < 10; i++) {
      expect(moonDirection("gas", i, 10, "06", 0.37)).toBe(isIrregular("gas", i, 10, "06", 0.37) ? -1 : 1);
    }
    expect(moonDirection("rocky", 4, 5, "05", 0.37)).toBe(1);
  });
});

describe("faint rings on the other giants (R4.8)", () => {
  it("Jupiter-, Uranus- and Neptune-like worlds wear faint rings; Saturn keeps its bright one; no rocky world has one", () => {
    expect(skinFor("saturn").ring).toBeTruthy();
    for (const k of ["jupiter", "uranus", "neptune"] as const) expect(skinFor(k).faintRing, k).toBeTruthy();
    for (const k of INNER_WORLDS) {
      expect(skinFor(k).faintRing, k).toBeUndefined();
      expect(skinFor(k).ring, k).toBeUndefined();
    }
  });

  it("every band of every style lies inside its planet's Roche limit, and is faint", () => {
    for (const style of RING_STYLES) {
      const bands = ringBands(style);
      expect(bands.length, style).toBeGreaterThan(0);
      for (const size of [0.5, 1, 1.7]) {
        const [inner, outer] = ringSpan(size);
        for (const b of bands) {
          expect(b.from).toBeGreaterThanOrEqual(0);
          expect(b.to).toBeLessThanOrEqual(1);
          expect(b.from).toBeLessThan(b.to);
          expect(inner + b.to * (outer - inner), style).toBeLessThan(rocheLimit(size));
          expect(b.alpha).toBeGreaterThan(0);
          expect(b.alpha, `${style} is faint`).toBeLessThanOrEqual(0.45);
        }
      }
    }
  });
});

/**
 * Moons follow the planets' rules (instructor, 5 Oct 2026: "fix the moons
 * orbit, make it follow the same logic and rules we had for planets").
 */
describe("moons on the planets' rules", () => {
  const SCALE = BODY_SCALE;
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `06.${i + 1}`);
  const systems = KINDS.flatMap((kind) => [2, 5, 8, 11].map((n) => ({ kind, n, size: planetSize(n, kind, SCALE) })));

  it("each moon its own gentle ellipse, the planet at a focus, starting at its curriculum angle", () => {
    for (const s of systems) {
      const os = moonOrbitsOf({ planetId: "06", kind: s.kind, moonIds: ids(s.n), size: s.size, scale: SCALE, seed: 0.37 });
      expect(os).toHaveLength(s.n);
      os.forEach((o, i) => {
        expect(o.e).toBeGreaterThan(0);
        expect(o.e).toBeLessThanOrEqual(MOON_E_MAX);
        const p = positionAt(o, 0);
        const d = Math.atan2(p.y, p.x) - (i / s.n) * Math.PI * 2;
        expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThan(1e-9);
      });
      const axes = os.map((o) => o.a);
      expect(new Set(axes.map((a) => a.toFixed(6))).size, "one moon per orbit").toBe(s.n);
    }
  });

  it("every orbit, perihelion to aphelion, stays outside the Roche limit and inside the Hill sphere", () => {
    for (const s of systems) {
      const os = moonOrbitsOf({ planetId: "06", kind: s.kind, moonIds: ids(s.n), size: s.size, scale: SCALE, seed: 0.37 });
      const hill = hillRadius(12, 0.03, s.kind); // the innermost planet's orbit: the smallest Hill sphere on the map
      for (const o of os) {
        expect(o.a * (1 - o.e), `${s.kind}`).toBeGreaterThan(rocheLimit(s.size));
        expect(o.a * (1 + o.e) + MOON_SIZE * SCALE, `${s.kind} ${s.n}`).toBeLessThan(hill);
      }
    }
  });

  it("no two moons ever overlap: on their moving positions over the outermost moon's period, and at every angle", () => {
    for (const s of systems) {
      const os = moonOrbitsOf({ planetId: "06", kind: s.kind, moonIds: ids(s.n), size: s.size, scale: SCALE, seed: 0.37 });
      const r = MOON_SIZE * SCALE;
      const T = Math.max(...os.map((o) => o.period));
      let worst = Infinity;
      for (let k = 0; k <= 600; k++) {
        const at = os.map((o) => positionAt(o, (T * k) / 600 * o.dir));
        for (let i = 0; i < at.length; i++)
          for (let j = i + 1; j < at.length; j++) worst = Math.min(worst, Math.hypot(at[i]!.x - at[j]!.x, at[i]!.y - at[j]!.y) - 2 * r);
      }
      if (s.n > 1) {
        expect(Number.isFinite(worst)).toBe(true);
        expect(worst, `${s.kind} ${s.n}`).toBeGreaterThan(0.05 * SCALE);
      }
      for (let i = 0; i + 1 < os.length; i++) {
        for (let k = 0; k < 360; k++) {
          const th = (k / 360) * Math.PI * 2;
          expect(radiusAt(os[i + 1]!, th) - radiusAt(os[i]!, th), `${s.kind} ${s.n} moons ${i}/${i + 1}`).toBeGreaterThan(2 * r);
        }
      }
    }
  });

  it("the planet's mass sets the pace: T² ∝ a³ around one planet, and a heavier planet turns its moons faster in the same ratio", () => {
    const giant = moonOrbitsOf({ planetId: "06", kind: "gas", moonIds: ids(5), size: 1, scale: SCALE, seed: 0 });
    const rocky = moonOrbitsOf({ planetId: "06", kind: "rocky", moonIds: ids(5), size: 1, scale: SCALE, seed: 0 });
    expect((giant[0]!.period / giant[4]!.period) ** 2).toBeCloseTo((giant[0]!.a / giant[4]!.a) ** 3, 9);
    for (let i = 0; i < 5; i++) {
      expect(giant[i]!.a).toBeCloseTo(rocky[i]!.a, 12);
      expect(rocky[i]!.period / giant[i]!.period).toBeCloseTo(Math.sqrt(MASS_RATIO.gas / MASS_RATIO.rocky), 9);
      expect(giant[i]!.period).toBeCloseTo(2 * Math.PI * Math.sqrt(giant[i]!.a ** 3 / (planetGM("gas") * MOON_CLOCK ** 2)), 9);
    }
  });

  it("captured moons still go backwards; the rest go the planet's way", () => {
    const os = moonOrbitsOf({ planetId: "06", kind: "gas", moonIds: ids(10), size: 1.5, scale: SCALE, seed: 0.37 });
    os.forEach((o, i) => expect(o.dir).toBe(moonDirection("gas", i, 10, "06", 0.37)));
  });

  it("the same for every student: a moon's ellipse is its objective's, never the seed's", () => {
    const a = moonOrbitsOf({ planetId: "06", kind: "gas", moonIds: ids(6), size: 1, scale: SCALE, seed: 1 });
    const b = moonOrbitsOf({ planetId: "06", kind: "gas", moonIds: ids(6), size: 1, scale: SCALE, seed: 9 });
    expect(a.map((o) => [o.a, o.e, o.omega, o.M0])).toEqual(b.map((o) => [o.a, o.e, o.omega, o.M0]));
  });
});
