import { describe, it, expect } from "vitest";
import { dayTime, indexLabel, indexMark, MARK_GLYPH, paperFacts, paramsLine, statusNote } from "../src/lib/paper-view";
import type { AttemptDetail } from "../src/lib/api";

const item = (over: Partial<AttemptDetail["items"][number]> = {}): AttemptDetail["items"][number] => ({
  ordinal: 1, type: "S", stageId: "01", objectiveId: "01.1", stem: "?", options: ["a", "b"],
  resolvedParams: null, correctValue: "a", rationale: null, studentAnswer: "a", isCorrect: true, timeMs: 30_000,
  ...over,
});

const paper = (over: Partial<AttemptDetail> = {}): AttemptDetail => ({
  attemptId: "x", status: "submitted", engineVersion: "1.0.0",
  student: { userId: "u", studentId: "232129006", fullName: "A" },
  assessmentTitle: "Stage 01 Check", scope: "stage", attemptNo: 2,
  startedAt: "2026-09-24T08:00:00Z", submittedAt: "2026-09-24T08:14:32Z", score: 1, maxScore: 3,
  items: [item(), item({ ordinal: 2, studentAnswer: "b", isCorrect: false, timeMs: 15_000 }), item({ ordinal: 3, studentAnswer: null, isCorrect: null, timeMs: null })],
  ...over,
});

describe("dayTime", () => {
  it("is the day, then the local hour and minute", () => {
    const iso = new Date(2026, 8, 24, 8, 5).toISOString();
    expect(dayTime(iso)).toBe("24 Sep 2026, 08:05");
  });
  it("says nothing it cannot know", () => {
    expect(dayTime(null)).toBeNull();
    expect(dayTime("not a date")).toBeNull();
  });
});

describe("paramsLine", () => {
  it("names each value the variant drew", () => {
    expect(paramsLine({ a: 3, b: "0x1F" })).toBe("a = 3 · b = 0x1F");
  });
  it("is null when nothing was drawn", () => {
    expect(paramsLine(null)).toBeNull();
    expect(paramsLine({})).toBeNull();
  });
});

describe("statusNote", () => {
  it("says why the key is missing on a paper not handed in", () => {
    expect(statusNote("in_progress")).toMatch(/once it is handed in/);
    expect(statusNote("abandoned")).toMatch(/never was/);
  });
  it("says a voided paper no longer counts", () => {
    expect(statusNote("voided")).toMatch(/no longer counts/);
  });
  it("says nothing for a paper simply handed in", () => {
    expect(statusNote("submitted")).toBeNull();
  });
});

describe("indexMark and indexLabel", () => {
  it("gives a verdict only when the key shows", () => {
    expect(indexMark({ studentAnswer: "a", isCorrect: true }, true)).toBe("correct");
    expect(indexMark({ studentAnswer: "b", isCorrect: false }, true)).toBe("not-correct");
    expect(indexMark({ studentAnswer: "b", isCorrect: false }, false)).toBe("answered");
    expect(indexMark({ studentAnswer: null, isCorrect: null }, false)).toBe("not-answered");
  });
  it("says the result in words, and a withheld one never says 'correct'", () => {
    expect(indexLabel(3, "not-correct")).toBe("Question 3, not correct");
    expect(indexLabel(3, "answered")).not.toMatch(/correct/);
  });
  it("gives every result its own shape", () => {
    expect(new Set(Object.values(MARK_GLYPH)).size).toBe(4);
  });
});

describe("paperFacts", () => {
  it("reads a handed-in paper", () => {
    const f = paperFacts(paper(), true);
    expect(f.score).toEqual({ got: 1, of: 3 });
    expect(f.answered).toEqual({ got: 2, of: 3 });
    expect(f.timeTaken).toBe("14 min 32 s");
    expect(f.onQuestions).toBe("45 s");
  });
  it("gives no score and no hand-in for a paper still being sat", () => {
    const f = paperFacts(paper({ status: "in_progress", submittedAt: null, score: null, maxScore: null }), false);
    expect(f.score).toBeNull();
    expect(f.handedInAt).toBeNull();
    expect(f.timeTaken).toBeNull();
  });
  it("withholds the score when the key is withheld, even if one was stored", () => {
    expect(paperFacts(paper(), false).score).toBeNull();
  });
});
