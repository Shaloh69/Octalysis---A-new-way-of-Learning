import { describe, it, expect } from "vitest";
import { makeAttemptSeed } from "../../src/engine/seed.js";
import { resolveItem, formatNumber, type BankItem } from "../../src/engine/resolve.js";

const seedFor = (studentId: string, attemptNo = 1) =>
  makeAttemptSeed({ studentId, stageId: "07", attemptNo, examSalt: "test-salt" });

const P_CYCLE: BankItem = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "P-07-cycle-time",
  stageId: "07",
  objectiveId: "07.3",
  type: "P",
  bloom: "apply",
  stemTemplate: "",
  solverRef: "cycle-time",
  correctSpec: {},
  distractorPool: [],
};

const S_ASSEMBLER: BankItem = {
  id: "22222222-2222-2222-2222-222222222222",
  slug: "S-03-assembler",
  stageId: "03",
  objectiveId: "03.1",
  type: "S",
  bloom: "understand",
  stemTemplate: "Which converts assembly mnemonics into machine code?",
  correctSpec: { value: "An assembler" },
  distractorPool: [
    "A compiler",
    "An interpreter",
    "A linker",
    "The control unit",
    "A microprogram",
    "The ALU",
  ],
  rationaleTemplate: "An assembler translates mnemonics one-to-one into machine instructions.",
};

const G_FDE: BankItem = {
  id: "33333333-3333-3333-3333-333333333333",
  slug: "G-13-fde-order",
  stageId: "13",
  objectiveId: "13.2",
  type: "G",
  bloom: "analyze",
  stemTemplate: "Put these fetch-decode-execute sub-steps in order.",
  correctSpec: {
    order: [
      "PC -> MAR",
      "memory[MAR] -> MBR",
      "MBR -> IR",
      "PC + 1 -> PC",
      "decode IR opcode",
      "operand address -> MAR",
      "execute in ALU",
    ],
    take: 5,
  },
  distractorPool: [],
};

describe("formatNumber", () => {
  it("keeps integers as integers", () => {
    expect(formatNumber(10, 4)).toBe("10");
    expect(formatNumber(255, 12)).toBe("255");
  });

  it("rounds to significant figures without exponent for human-scale values", () => {
    expect(formatNumber(7.518796992, 4)).toBe("7.519");
    expect(formatNumber(465.6612873, 4)).toBe("465.7");
  });
});

describe("resolveItem — determinism", () => {
  it("same item + same seed produces a byte-identical instance, 100 runs", () => {
    const seed = seedFor("21-0001");
    const reference = JSON.stringify(resolveItem(P_CYCLE, seed, { ordinal: 1 }));
    for (let i = 0; i < 100; i++) {
      expect(JSON.stringify(resolveItem(P_CYCLE, seed, { ordinal: 1 }))).toBe(reference);
    }
  });

  it("different students get different instances of the same item", () => {
    const a = resolveItem(P_CYCLE, seedFor("21-0001"), { ordinal: 1 });
    const b = resolveItem(P_CYCLE, seedFor("21-0002"), { ordinal: 1 });
    // Not guaranteed different params on a single draw, but the option ORDER
    // is drawn from an independent stream, so the pair should differ overall.
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("ordinal is part of the sub-stream, so the same item at two positions differs", () => {
    const seed = seedFor("21-0001");
    const at1 = resolveItem(P_CYCLE, seed, { ordinal: 1 });
    const at2 = resolveItem(P_CYCLE, seed, { ordinal: 2 });
    expect(at1.stem === at2.stem && at1.options.join() === at2.options.join()).toBe(false);
  });

  it("a later attempt gets a different paper", () => {
    const a = resolveItem(P_CYCLE, seedFor("21-0001", 1), { ordinal: 1 });
    const b = resolveItem(P_CYCLE, seedFor("21-0001", 2), { ordinal: 1 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("resolveItem — option integrity", () => {
  it("type P: never duplicates an option, and never repeats the correct value", () => {
    // This is the guarantee that the cycle-time f=1000 collision would break.
    for (let i = 0; i < 2000; i++) {
      const r = resolveItem(P_CYCLE, seedFor(`s-${i}`), { ordinal: 1 });
      expect(new Set(r.options).size, `dupe at i=${i}: ${r.options.join(", ")}`).toBe(
        r.options.length,
      );
      expect(r.options.filter((o) => o === r.correctValue)).toHaveLength(1);
    }
  });

  it("type P: the correct value is always present and correctIndex points at it", () => {
    for (let i = 0; i < 1000; i++) {
      const r = resolveItem(P_CYCLE, seedFor(`k-${i}`), { ordinal: 1 });
      expect(r.options[r.correctIndex]).toBe(r.correctValue);
    }
  });

  it("specifically covers f = 1000 MHz, where two candidate pairs collide", () => {
    // At f = 1000 the solver proposes five candidates and TWO are dropped:
    //   correct        1000/f        = 1
    //   candidate 1    1e6/f         = 1000     kept
    //   candidate 2    f/1000        = 1        DROPPED - equals the correct value
    //   candidate 3    1/f           = 0.001    kept
    //   candidate 4    correct*1000  = 1000     DROPPED - duplicates candidate 1
    //   candidate 5    correct/2     = 0.5      kept
    // Exactly three survive, which is exactly what a 4-option item needs. This
    // is the worst case in the whole solver, so it gets its own test.
    let found = false;
    for (let i = 0; i < 5000 && !found; i++) {
      const r = resolveItem(P_CYCLE, seedFor(`f-${i}`), { ordinal: 1 });
      if (r.resolvedParams.f === 1000) {
        found = true;
        expect(r.correctValue).toBe("1");
        expect(r.options).toHaveLength(4);
        expect(new Set(r.options).size).toBe(4);
        // The correct value appears exactly once despite a candidate matching it.
        expect(r.options.filter((o) => o === "1")).toHaveLength(1);
        // "1000" is a legitimate distractor here (the MHz-as-Hz misconception),
        // and it appears exactly once despite two candidates producing it.
        expect(r.options.filter((o) => o === "1000")).toHaveLength(1);
        expect(new Set(r.options)).toEqual(new Set(["1", "1000", "0.001", "0.5"]));
      }
    }
    expect(found, "no seed drew f=1000 in 5000 tries").toBe(true);
  });

  it("type S: samples 3 of the pool and never includes the correct answer twice", () => {
    for (let i = 0; i < 1000; i++) {
      const r = resolveItem(S_ASSEMBLER, seedFor(`t-${i}`), { ordinal: 1 });
      expect(r.options).toHaveLength(4);
      expect(new Set(r.options).size).toBe(4);
      expect(r.options).toContain("An assembler");
      expect(r.options.filter((o) => o === "An assembler")).toHaveLength(1);
    }
  });

  it("type G: shows a subset, never in the correct order", () => {
    for (let i = 0; i < 500; i++) {
      const r = resolveItem(G_FDE, seedFor(`g-${i}`), { ordinal: 1 });
      expect(r.options).toHaveLength(5);
      expect(new Set(r.options).size).toBe(5);
      expect(r.options.join(" | ")).not.toBe(r.correctValue);
      // Every shown step must be one of the real steps.
      for (const o of r.options) {
        expect(G_FDE.correctSpec.order as string[]).toContain(o);
      }
    }
  });
});

describe("resolveItem — answer position is uniform", () => {
  it("the correct option lands in each slot about equally, 8000 papers", () => {
    // Engine rule 5. A generator that puts the answer at B 40% of the time is
    // exploitable by week 4 without knowing any content.
    const counts = [0, 0, 0, 0];
    const N = 8000;
    for (let i = 0; i < N; i++) {
      const r = resolveItem(S_ASSEMBLER, seedFor(`pos-${i}`), { ordinal: 1 });
      counts[r.correctIndex]! += 1;
    }
    const expected = N / 4;
    const chi2 = counts.reduce((a, o) => a + (o - expected) ** 2 / expected, 0);
    // 3 df, critical value 16.27 at p = 0.001.
    expect(chi2, `distribution was ${counts.join("/")}`).toBeLessThan(16.27);
  });
});

describe("resolveItem — failure modes are loud", () => {
  it("a type-P item with no solver_ref names the item", () => {
    expect(() =>
      resolveItem({ ...P_CYCLE, solverRef: null }, seedFor("x"), { ordinal: 1 }),
    ).toThrow(/P-07-cycle-time is type P but has no solver_ref/);
  });

  it("a type-S item with too small a pool refuses rather than shipping 2 options", () => {
    const thin: BankItem = { ...S_ASSEMBLER, distractorPool: ["A compiler"] };
    expect(() => resolveItem(thin, seedFor("y"), { ordinal: 1 })).toThrow(
      /Cannot build 3 distinct distractors/,
    );
  });

  it("a type-S pool that only repeats the correct answer is caught", () => {
    const bad: BankItem = {
      ...S_ASSEMBLER,
      distractorPool: ["An assembler", "an assembler", "AN ASSEMBLER"],
    };
    expect(() => resolveItem(bad, seedFor("z"), { ordinal: 1 })).toThrow(
      /Cannot build 3 distinct distractors/,
    );
  });

  it("a type-G item with too few steps is caught", () => {
    const bad: BankItem = { ...G_FDE, correctSpec: { order: ["a", "b"] } };
    expect(() => resolveItem(bad, seedFor("w"), { ordinal: 1 })).toThrow(/at least 3/);
  });
});
