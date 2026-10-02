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
} from "../src/solar-system/satellites";
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
