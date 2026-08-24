import { describe, it, expect } from "vitest";
import { makeRng } from "../../src/engine/seed.js";
import { getSolver, listSolvers } from "../../src/engine/solvers.js";

/**
 * Solvers are checked against hand-computed tables, including the worked example
 * from the instructor's own source deck. A solver bug is not a bug — it is a
 * grading incident affecting every student who drew that variant.
 */

describe("cycle-time", () => {
  const s = getSolver("cycle-time");

  it("133 MHz -> 7.52 ns — the worked example from the source deck", () => {
    // PHASES.md P3 names this exact case as an exit criterion.
    expect(s.solve({ f: 133 })).toBeCloseTo(7.5188, 4);
    expect(Number(s.solve({ f: 133 }).toFixed(2))).toBe(7.52);
  });

  it("matches a hand-computed table", () => {
    const table: Array<[number, number]> = [
      [1, 1000],
      [10, 100],
      [100, 10],
      [200, 5],
      [500, 2],
      [1000, 1],
      [2000, 0.5],
      [4000, 0.25],
    ];
    for (const [f, expected] of table) {
      expect(s.solve({ f })).toBeCloseTo(expected, 10);
    }
  });

  it("proposes enough candidates that 3 distinct ones always survive dedupe", () => {
    // Solvers propose CANDIDATES. Collisions are unavoidable in general -- at
    // f = 1000 MHz, f/1000 and 1000/f are both 1 -- so the no-duplicate-options
    // guarantee lives in resolve.ts. What a solver owes is enough candidates
    // that three distinct ones always remain.
    const rng = makeRng("a".repeat(64));
    for (let i = 0; i < 500; i++) {
      const p = s.draw(rng);
      const correct = s.solve(p);
      const distinct = new Set(
        s
          .distractors(p, correct)
          .map((d) => d.value)
          .filter((v) => Math.abs(v - correct) > 1e-9)
          .map((v) => v.toPrecision(9)),
      );
      expect(distinct.size, `only ${distinct.size} survived at f=${p.f}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("every distractor names a misconception", () => {
    const p = { f: 133 };
    for (const d of s.distractors(p, s.solve(p))) {
      expect(d.misconception.length).toBeGreaterThan(10);
    }
  });

  it("the rationale contains the actual numbers", () => {
    const p = { f: 133 };
    const r = s.rationale(p, s.solve(p));
    expect(r).toContain("133");
    expect(r).toMatch(/7\.5/);
  });
});

describe("unit-convert", () => {
  const s = getSolver("unit-convert");

  it("500 GB advertised -> about 465.66 GiB", () => {
    // The canonical "where did my disk space go" example.
    expect(s.solve({ gb: 500 })).toBeCloseTo(465.661, 3);
  });

  it("1000 GB -> about 931.32 GiB", () => {
    expect(s.solve({ gb: 1000 })).toBeCloseTo(931.323, 3);
  });

  it("distractors are all distinct from the answer and from each other", () => {
    const rng = makeRng("b".repeat(64));
    for (let i = 0; i < 200; i++) {
      const p = s.draw(rng);
      const correct = s.solve(p);
      const values = s.distractors(p, correct).map((d) => d.value);
      for (const v of values) expect(Math.abs(v - correct)).toBeGreaterThan(1e-9);
      // These four are algebraically independent for every gb > 0, so unlike
      // cycle-time this solver owes exact distinctness.
      expect(new Set(values.map((v) => v.toPrecision(9))).size).toBe(values.length);
    }
  });
});

describe("twos-complement", () => {
  const s = getSolver("twos-complement");

  it("matches a hand-computed table", () => {
    const table: Array<[number, number, number]> = [
      // width, value, expected unsigned encoding
      [8, -1, 255],
      [8, -2, 254],
      [8, -128, 128],
      [8, -127, 129],
      [16, -1, 65535],
      [16, -32768, 32768],
      [16, -256, 65280],
    ];
    for (const [width, value, expected] of table) {
      expect(s.solve({ width, value })).toBe(expected);
    }
  });

  it("the one's-complement distractor is exactly one less", () => {
    const p = { width: 8, value: -5 };
    const correct = s.solve(p); // 251
    const ds = s.distractors(p, correct);
    const ones = ds.find((d) => d.misconception.includes("one's complement"));
    expect(ones?.value).toBe(correct - 1);
  });

  it("the sign-magnitude distractor sets the sign bit on the magnitude", () => {
    const p = { width: 8, value: -5 };
    const ds = s.distractors(p, s.solve(p));
    const sm = ds.find((d) => d.misconception.includes("sign-magnitude"));
    expect(sm?.value).toBe(128 + 5);
  });

  it("only ever draws negative values — the sign is the whole point", () => {
    const rng = makeRng("c".repeat(64));
    for (let i = 0; i < 1000; i++) {
      const p = s.draw(rng);
      expect(p.value!).toBeLessThan(0);
      expect(p.value!).toBeGreaterThanOrEqual(-(2 ** (p.width! - 1)));
      expect([8, 16]).toContain(p.width);
    }
  });

  it("the encoding always fits the declared width", () => {
    const rng = makeRng("d".repeat(64));
    for (let i = 0; i < 1000; i++) {
      const p = s.draw(rng);
      const v = s.solve(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** p.width!);
    }
  });
});

describe("amat", () => {
  const s = getSolver("amat");

  it("matches a hand-computed table", () => {
    // AMAT = hit + missRate * penalty
    expect(s.solve({ hitTime: 1, hitRatePct: 90, missPenalty: 100 })).toBeCloseTo(11, 10);
    expect(s.solve({ hitTime: 2, hitRatePct: 95, missPenalty: 60 })).toBeCloseTo(5, 10);
    expect(s.solve({ hitTime: 4, hitRatePct: 99, missPenalty: 200 })).toBeCloseTo(6, 10);
  });

  it("the hit-rate confusion distractor is the classic error", () => {
    const p = { hitTime: 1, hitRatePct: 90, missPenalty: 100 };
    const ds = s.distractors(p, s.solve(p));
    const wrong = ds.find((d) => d.misconception.includes("hit rate instead of the miss rate"));
    // 1 + 0.9*100 = 91, versus the correct 11.
    expect(wrong?.value).toBeCloseTo(91, 10);
  });

  it("AMAT is always at least the hit time", () => {
    const rng = makeRng("e".repeat(64));
    for (let i = 0; i < 1000; i++) {
      const p = s.draw(rng);
      expect(s.solve(p)).toBeGreaterThanOrEqual(p.hitTime!);
    }
  });
});

describe("registry", () => {
  it("exposes exactly the four P3 solvers", () => {
    expect(listSolvers().map((s) => s.id).sort()).toEqual([
      "amat",
      "cycle-time",
      "twos-complement",
      "unit-convert",
    ]);
  });

  it("names the known solvers when asked for one that does not exist", () => {
    expect(() => getSolver("nope")).toThrow(/Unknown solver_ref "nope"/);
    expect(() => getSolver("nope")).toThrow(/cycle-time/);
  });

  it("refuses an unknown engine version rather than silently using the latest", () => {
    // Silently falling back would regenerate a DIFFERENT paper than the student
    // sat, while appearing to work.
    expect(() => getSolver("cycle-time", "9.9.9")).toThrow(/Unknown engine_version/);
  });

  it("every solver produces finite, non-NaN answers over 10,000 draws", () => {
    const rng = makeRng("1".repeat(64));
    for (const s of listSolvers()) {
      for (let i = 0; i < 2500; i++) {
        const p = s.draw(rng);
        const v = s.solve(p);
        expect(Number.isFinite(v), `${s.id} produced ${v} from ${JSON.stringify(p)}`).toBe(true);
        for (const d of s.distractors(p, v)) {
          expect(Number.isFinite(d.value), `${s.id} distractor ${d.value}`).toBe(true);
        }
      }
    }
  });

  it("every solver's stem interpolates its parameters — no leftover placeholders", () => {
    const rng = makeRng("2".repeat(64));
    for (const s of listSolvers()) {
      const p = s.draw(rng);
      const stem = s.stem(p);
      expect(stem).not.toMatch(/\{|\}|undefined|NaN/);
      expect(stem.length).toBeGreaterThan(20);
    }
  });
});
