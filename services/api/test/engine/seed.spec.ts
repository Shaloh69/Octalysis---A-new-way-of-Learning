import { describe, it, expect } from "vitest";
import { makeRng, makeAttemptSeed, deriveSeed } from "../../src/engine/seed.js";

/**
 * Determinism is the load-bearing property of the whole engine. If these fail,
 * "we can regenerate any student's exact paper" stops being true, and with it
 * the dispute story, the analytics, and the fairness argument.
 */

describe("makeAttemptSeed", () => {
  const base = { studentId: "21-0001", stageId: "07", attemptNo: 1, examSalt: "salt" };

  it("is stable across calls", () => {
    expect(makeAttemptSeed(base)).toBe(makeAttemptSeed(base));
  });

  it("is a 64-char sha256 hex digest", () => {
    expect(makeAttemptSeed(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when ANY part changes", () => {
    const seen = new Set([
      makeAttemptSeed(base),
      makeAttemptSeed({ ...base, studentId: "21-0002" }),
      makeAttemptSeed({ ...base, stageId: "09" }),
      makeAttemptSeed({ ...base, attemptNo: 2 }),
      makeAttemptSeed({ ...base, examSalt: "other" }),
    ]);
    expect(seen.size).toBe(5);
  });

  it("does not collide across a field boundary", () => {
    // A naive concatenation would make ("ab","c") and ("a","bc") identical.
    const a = makeAttemptSeed({ ...base, studentId: "21", stageId: "0001" });
    const b = makeAttemptSeed({ ...base, studentId: "210", stageId: "001" });
    expect(a).not.toBe(b);
  });

  it("derives independent sub-streams", () => {
    const s = makeAttemptSeed(base);
    expect(deriveSeed(s, "items")).not.toBe(deriveSeed(s, "options"));
    expect(deriveSeed(s, "items")).toBe(deriveSeed(s, "items"));
  });
});

describe("makeRng — determinism", () => {
  const seed = "a".repeat(64);

  it("produces an identical stream from the same seed, 100 runs", () => {
    const reference = Array.from({ length: 50 }, () => 0);
    const first = makeRng(seed);
    for (let i = 0; i < reference.length; i++) reference[i] = first.int(0, 1_000_000);

    for (let run = 0; run < 100; run++) {
      const rng = makeRng(seed);
      const got = Array.from({ length: reference.length }, () => rng.int(0, 1_000_000));
      expect(got).toEqual(reference);
    }
  });

  it("produces different streams from different seeds", () => {
    const a = makeRng("0".repeat(64));
    const b = makeRng("1".repeat(64));
    const sa = Array.from({ length: 20 }, () => a.nextU64().toString());
    const sb = Array.from({ length: 20 }, () => b.nextU64().toString());
    expect(sa).not.toEqual(sb);
  });

  it("shuffles identically from the same seed", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const a = makeRng(seed).shuffle(input);
    const b = makeRng(seed).shuffle(input);
    expect(a).toEqual(b);
  });

  it("never mutates the input array", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    makeRng(seed).shuffle(input);
    expect(input).toEqual(copy);
  });

  it("rejects a seed that is too short to be a real digest", () => {
    expect(() => makeRng("abc")).toThrow(/16 hex/);
    expect(() => makeRng("nothex!!!!!!!!!!!!!!")).toThrow(/16 hex/);
  });
});

describe("makeRng — distribution", () => {
  it("int() stays inside its bounds over 100,000 draws", () => {
    const rng = makeRng("f".repeat(64));
    for (let i = 0; i < 100_000; i++) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("int() is uniform — no modulo bias", () => {
    // A plain `nextU64() % range` skews the low end. Over 70 items x 40 students
    // that is a measurable bias in which variants appear, so it is worth a test.
    const rng = makeRng("c".repeat(64));
    const buckets = new Array(7).fill(0) as number[];
    const N = 140_000;
    for (let i = 0; i < N; i++) buckets[rng.int(0, 6)]! += 1;

    const expected = N / 7;
    // Chi-square, 6 df, critical value 22.46 at p=0.001.
    const chi2 = buckets.reduce((acc, o) => acc + (o - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(22.46);
  });

  it("nextFloat() is in [0, 1)", () => {
    const rng = makeRng("9".repeat(64));
    for (let i = 0; i < 50_000; i++) {
      const v = rng.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Number.isNaN(v)).toBe(false);
    }
  });

  it("shuffle() is unbiased — every element reaches position 0 about equally", () => {
    const rng = makeRng("7".repeat(64));
    const items = [0, 1, 2, 3, 4];
    const firstPos = new Array(5).fill(0) as number[];
    const N = 50_000;
    for (let i = 0; i < N; i++) firstPos[rng.shuffle(items)[0]!]! += 1;

    const expected = N / 5;
    const chi2 = firstPos.reduce((acc, o) => acc + (o - expected) ** 2 / expected, 0);
    // 4 df, critical value 18.47 at p=0.001.
    expect(chi2).toBeLessThan(18.47);
  });

  it("sample() returns distinct items and refuses to overdraw", () => {
    const rng = makeRng("5".repeat(64));
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s = rng.sample(items, 3);
    expect(s).toHaveLength(3);
    expect(new Set(s).size).toBe(3);
    expect(() => rng.sample(items, 99)).toThrow(/asked for 99 of 8/);
  });

  it("pick() throws on an empty array rather than returning undefined", () => {
    expect(() => makeRng("3".repeat(64)).pick([])).toThrow(/empty/);
  });
});
