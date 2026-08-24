import { describe, it, expect } from "vitest";
import { makeAttemptSeed } from "../../src/engine/seed.js";
import { resolveItem, type BankItem } from "../../src/engine/resolve.js";
import {
  gradeResponse,
  parseNumericAnswer,
  numbersMatch,
  scoreAttempt,
} from "../../src/engine/grade.js";
import {
  toStudentItem,
  toStudentPaper,
  containsAnswerKey,
} from "../../src/serialize/student.js";

const P_CYCLE: BankItem = {
  id: "p-1", slug: "P-07-cycle-time", stageId: "07", objectiveId: "07.3",
  type: "P", bloom: "apply", stemTemplate: "", solverRef: "cycle-time",
  correctSpec: {}, distractorPool: [],
};

const S_ASM: BankItem = {
  id: "s-1", slug: "S-03-assembler", stageId: "03", objectiveId: "03.1",
  type: "S", bloom: "understand",
  stemTemplate: "Which converts assembly mnemonics into machine code?",
  correctSpec: { value: "An assembler" },
  distractorPool: ["A compiler", "An interpreter", "A linker", "The control unit"],
  rationaleTemplate: "An assembler translates mnemonics one-to-one into machine instructions.",
};

const seed = makeAttemptSeed({ studentId: "21-0001", stageId: "07", attemptNo: 1, examSalt: "s" });

describe("parseNumericAnswer", () => {
  it("accepts what students actually type", () => {
    expect(parseNumericAnswer("7.52")).toBe(7.52);
    expect(parseNumericAnswer("  7.52  ")).toBe(7.52);
    expect(parseNumericAnswer("7.52 ns")).toBe(7.52);
    expect(parseNumericAnswer("7.52ns")).toBe(7.52);
    expect(parseNumericAnswer("465.66 GiB")).toBe(465.66);
    expect(parseNumericAnswer("-128")).toBe(-128);
    expect(parseNumericAnswer(".5")).toBe(0.5);
    expect(parseNumericAnswer("+3")).toBe(3);
  });

  it("accepts thousands separators", () => {
    expect(parseNumericAnswer("1,073,741,824")).toBe(1073741824);
    expect(parseNumericAnswer("65,535")).toBe(65535);
  });

  it("accepts scientific notation in several spellings", () => {
    expect(parseNumericAnswer("1.5e6")).toBe(1.5e6);
    expect(parseNumericAnswer("1.5E+6")).toBe(1.5e6);
    expect(parseNumericAnswer("1.5 x 10^6")).toBe(1.5e6);
    expect(parseNumericAnswer("1.5*10^6")).toBe(1.5e6);
    expect(parseNumericAnswer("1.5 × 10^6")).toBe(1.5e6);
  });

  it("rejects things that are not numbers", () => {
    expect(parseNumericAnswer("")).toBeNull();
    expect(parseNumericAnswer("   ")).toBeNull();
    expect(parseNumericAnswer("An assembler")).toBeNull();
    expect(parseNumericAnswer("abc")).toBeNull();
    expect(parseNumericAnswer("1.2.3")).toBeNull();
  });
});

describe("numbersMatch — tolerance is RELATIVE", () => {
  it("1% of a small number is small, 1% of a big number is big", () => {
    expect(numbersMatch(7.52, 7.55, 0.01)).toBe(true);
    expect(numbersMatch(7.52, 7.9, 0.01)).toBe(false);
    expect(numbersMatch(465.66, 469, 0.01)).toBe(true);
    // An absolute epsilon would wrongly reject this pair, or wrongly accept the
    // 7.9 above. That is why the tolerance is relative.
    expect(numbersMatch(465.66, 500, 0.01)).toBe(false);
  });

  it("handles the classic float case", () => {
    expect(numbersMatch(0.3, 0.1 + 0.2, 0)).toBe(true);
  });

  it("tolerance 0 still allows a few ULPs, but nothing meaningful", () => {
    expect(numbersMatch(251, 251, 0)).toBe(true);
    expect(numbersMatch(251, 250, 0)).toBe(false);
    expect(numbersMatch(251, 251.0000001, 0)).toBe(false);
  });

  it("rejects NaN and Infinity rather than treating them as close", () => {
    expect(numbersMatch(10, Number.NaN, 0.5)).toBe(false);
    expect(numbersMatch(10, Number.POSITIVE_INFINITY, 0.5)).toBe(false);
  });

  it("handles an expected value of exactly zero", () => {
    expect(numbersMatch(0, 0, 0.01)).toBe(true);
    expect(numbersMatch(0, 0.005, 0.01)).toBe(true);
    expect(numbersMatch(0, 1, 0.01)).toBe(false);
  });
});

describe("gradeResponse", () => {
  const p = resolveItem(P_CYCLE, seed, { ordinal: 1 });
  const s = resolveItem(S_ASM, seed, { ordinal: 2 });

  it("grades a correct selection by index", () => {
    const r = gradeResponse(s, { index: s.correctIndex });
    expect(r.isCorrect).toBe(true);
    expect(r.points).toBe(1);
    expect(r.chosenIndex).toBe(s.correctIndex);
  });

  it("grades a wrong selection and records WHICH distractor", () => {
    const wrong = (s.correctIndex + 1) % s.options.length;
    const r = gradeResponse(s, { index: wrong });
    expect(r.isCorrect).toBe(false);
    expect(r.points).toBe(0);
    // Distractor analysis depends on knowing which wrong option was chosen.
    expect(r.chosenIndex).toBe(wrong);
  });

  it("grades free numeric entry with the unit attached", () => {
    const r = gradeResponse(p, { value: `${p.correctValue} ns` });
    expect(r.isCorrect).toBe(true);
  });

  it("accepts an answer within tolerance and rejects one outside", () => {
    const exact = Number(p.correctValue);
    expect(gradeResponse(p, { value: String(exact * 1.005) }).isCorrect).toBe(true);
    expect(gradeResponse(p, { value: String(exact * 1.5) }).isCorrect).toBe(false);
  });

  it("accepts the option label when the client sends text instead of an index", () => {
    const r = gradeResponse(s, { value: "An assembler" });
    expect(r.isCorrect).toBe(true);
  });

  it("is case- and whitespace-insensitive on text", () => {
    expect(gradeResponse(s, { value: "  an   ASSEMBLER " }).isCorrect).toBe(true);
  });

  it("treats a missing or malformed answer as wrong, never as an error", () => {
    for (const bad of [{}, null, undefined, { index: -1 }, { index: 99 }, { value: null }]) {
      const r = gradeResponse(s, bad);
      expect(r.isCorrect).toBe(false);
      expect(r.points).toBe(0);
    }
  });

  it("grades an ordering item on exact sequence", () => {
    const g = resolveItem(
      {
        id: "g-1", slug: "G-13", stageId: "13", objectiveId: "13.2", type: "G",
        bloom: "analyze", stemTemplate: "Order these.",
        correctSpec: { order: ["one", "two", "three", "four", "five"], take: 4 },
        distractorPool: [],
      },
      seed,
      { ordinal: 3 },
    );
    const correct = g.correctValue.split(" | ");
    expect(gradeResponse(g, { order: correct }).isCorrect).toBe(true);
    expect(gradeResponse(g, { order: [...correct].reverse() }).isCorrect).toBe(false);
    expect(gradeResponse(g, { order: "not an array" }).isCorrect).toBe(false);
  });
});

describe("scoreAttempt", () => {
  it("sums points and breaks down per objective", () => {
    const items = [
      resolveItem(P_CYCLE, seed, { ordinal: 1 }),
      resolveItem(S_ASM, seed, { ordinal: 2 }),
    ];
    const results = new Map([
      [1, gradeResponse(items[0]!, { value: items[0]!.correctValue })],
      [2, gradeResponse(items[1]!, { index: (items[1]!.correctIndex + 1) % 4 })],
    ]);
    const scored = scoreAttempt(items, results);
    expect(scored.score).toBe(1);
    expect(scored.maxScore).toBe(2);
    expect(scored.mastery).toBe(0.5);
    expect(scored.byObjective["07.3"]).toEqual({ correct: 1, total: 1 });
    expect(scored.byObjective["03.1"]).toEqual({ correct: 0, total: 1 });
  });

  it("counts an unanswered ordinal as wrong, not as absent", () => {
    const items = [resolveItem(S_ASM, seed, { ordinal: 1 })];
    const scored = scoreAttempt(items, new Map());
    expect(scored.score).toBe(0);
    expect(scored.maxScore).toBe(1);
    expect(scored.byObjective["03.1"]).toEqual({ correct: 0, total: 1 });
  });
});

/* ============================================================
 * The one that matters most: no answer key in a student payload.
 * ========================================================== */

describe("student serializer — the answer key never leaves the server", () => {
  const items = [
    resolveItem(P_CYCLE, seed, { ordinal: 1 }),
    resolveItem(S_ASM, seed, { ordinal: 2 }),
  ];

  it("drops correctValue, correctIndex, rationale and resolvedParams", () => {
    const out = toStudentItem(items[0]!) as unknown as Record<string, unknown>;
    expect(out).not.toHaveProperty("correctValue");
    expect(out).not.toHaveProperty("correctIndex");
    expect(out).not.toHaveProperty("rationale");
    expect(out).not.toHaveProperty("resolvedParams");
    expect(out).not.toHaveProperty("itemId");
    expect(out).not.toHaveProperty("tolerance");
  });

  it("keeps exactly the fields a student needs to answer", () => {
    const out = toStudentItem(items[1]!);
    expect(Object.keys(out).sort()).toEqual(["options", "ordinal", "points", "stem", "type"]);
  });

  it("the serialised paper contains no answer-key evidence", () => {
    const payload = toStudentPaper(items);
    expect(containsAnswerKey(payload, items)).toEqual([]);
  });

  it("the rationale text never appears in a paper payload", () => {
    const body = JSON.stringify(toStudentPaper(items));
    expect(body).not.toContain("translates mnemonics one-to-one");
    expect(body).not.toContain("reciprocal of frequency");
  });

  it("CATCHES a leak if one is introduced — the check is not vacuous", () => {
    // Serialise the raw resolved item, the way a careless route would.
    const leaked = items.map((i) => ({ ...i }));
    const found = containsAnswerKey(leaked, items);
    expect(found.length).toBeGreaterThan(0);
    expect(found.join(" ")).toMatch(/answer-key field name present|rationale/);
  });

  it("a rest-spread would have leaked, which is why the serializer is an allow-list", () => {
    // This documents the design decision in an executable form: if toStudentItem
    // were `const { correctValue, ...rest } = item`, adding a field to the answer
    // key later would forward it silently.
    const naive = (() => {
      const { correctValue, correctIndex, rationale, ...rest } = items[0]!;
      void correctValue;
      void correctIndex;
      void rationale;
      return rest;
    })();
    // The naive version still carries resolvedParams, which reveals the drawn
    // numbers and lets a student recompute the answer offline.
    expect(naive).toHaveProperty("resolvedParams");
    expect(toStudentItem(items[0]!)).not.toHaveProperty("resolvedParams");
  });
});
