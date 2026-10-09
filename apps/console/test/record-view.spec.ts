import { describe, it, expect } from "vitest";
import {
  asRosterRow, dayDate, duration, moonWords, paperSummary, sequence, showsKey, timeTaken, verdict,
} from "../src/lib/record-view";
import type { AttemptDetail, StudentDetail } from "../src/lib/api";

describe("showsKey: only a paper that was handed in", () => {
  it("shows the key for submitted and voided papers", () => {
    expect(showsKey("submitted")).toBe(true);
    expect(showsKey("voided")).toBe(true);
  });
  it("withholds it while a student is sitting, and for a paper never handed in", () => {
    expect(showsKey("in_progress")).toBe(false);
    expect(showsKey("abandoned")).toBe(false);
  });
  it("withholds it for anything it does not recognise: least privilege", () => {
    expect(showsKey("")).toBe(false);
    expect(showsKey("SUBMITTED")).toBe(false);
  });
});

describe("duration", () => {
  it("reads seconds under a minute, minutes and padded seconds above", () => {
    expect(duration(31_000)).toBe("31 s");
    expect(duration(65_000)).toBe("1 min 05 s");
    expect(duration(872_000)).toBe("14 min 32 s");
  });
  it("says nothing it cannot know", () => {
    expect(duration(null)).toBe("—");
    expect(duration(-5)).toBe("—");
    expect(duration(Number.NaN)).toBe("—");
  });
  it("timeTaken is start to hand-in, and nothing without a hand-in", () => {
    expect(timeTaken("2026-09-24T08:00:00Z", "2026-09-24T08:14:32Z")).toBe("14 min 32 s");
    expect(timeTaken("2026-09-24T08:00:00Z", null)).toBe("—");
  });
});

describe("verdict: in words, never colour alone", () => {
  it("names all three outcomes", () => {
    expect(verdict({ isCorrect: true, studentAnswer: "4.255" })).toBe("Correct");
    expect(verdict({ isCorrect: false, studentAnswer: "9.5" })).toBe("Not correct");
    expect(verdict({ isCorrect: null, studentAnswer: null })).toBe("Not answered");
  });
  it("an answer with no recorded verdict is not called correct", () => {
    expect(verdict({ isCorrect: null, studentAnswer: "x" })).toBe("Not answered");
  });
});

describe("sequence and dates", () => {
  it("splits an ordering value on its separator", () => {
    expect(sequence("Keyboard | I/O module | System bus")).toEqual(["Keyboard", "I/O module", "System bus"]);
    expect(sequence(null)).toEqual([]);
  });
  it("prints a day in one format whatever the locale", () => {
    expect(dayDate("2026-09-21T10:34:15Z")).toBe("21 Sep 2026");
    expect(dayDate(null)).toBeNull();
    expect(dayDate("not a date")).toBeNull();
  });
});

const item = (o: Partial<AttemptDetail["items"][number]>): AttemptDetail["items"][number] => ({
  ordinal: 1, type: "S", stageId: "01", objectiveId: "01.1", stem: "q", options: ["a", "b"],
  resolvedParams: null, correctValue: "a", rationale: "r", studentAnswer: null, isCorrect: null,
  timeMs: null, ...o,
});

describe("paperSummary", () => {
  const paper: AttemptDetail = {
    attemptId: "x", status: "submitted", engineVersion: "1.0.0",
    student: { userId: "u", studentId: "232129006", fullName: "A" },
    assessmentTitle: "Stage 01 Check", scope: "stage", attemptNo: 1,
    startedAt: "2026-09-24T08:00:00Z", submittedAt: "2026-09-24T08:14:32Z", score: 1, maxScore: 3,
    items: [
      item({ studentAnswer: "a", isCorrect: true, timeMs: 30_000 }),
      item({ ordinal: 2, studentAnswer: "b", isCorrect: false, timeMs: 45_000 }),
      item({ ordinal: 3 }),
    ],
  };
  it("counts correct answers only on a keyed paper", () => {
    expect(paperSummary(paper, true)).toBe("3 questions · 1 correct · 1 min 15 s on questions");
  });
  it("counts answers, never correctness, on a withheld one", () => {
    expect(paperSummary(paper, false)).toBe("3 questions · 2 answered so far · 1 min 15 s on questions");
  });
});

describe("asRosterRow", () => {
  it("hands the roster's dialogs the record as a registered row", () => {
    const d: StudentDetail = {
      student: {
        userId: "u", studentId: "232129006", fullName: "Kristine Joy Montebon",
        sectionId: "s", sectionCode: "BSCPE - 4", claimedAt: "2026-09-21T10:34:15Z", deactivated: true,
        avatar: { url: null, hue: 120, variant: 1, removable: false }, pictureRemovedAt: null,
      },
      sections: [], attempts: [], progress: [],
    };
    expect(asRosterRow(d)).toMatchObject({
      studentId: "232129006", userId: "u", sectionId: "s", deactivated: true, status: "claimed",
    });
  });
});

describe("moonWords: a moon's state in words, never a colour (30 Sep 2026)", () => {
  const moon = (correct: number, mastered: boolean, questions: number) => ({
    id: "01.2", description: "x", correct, mastered, questions,
  });
  it("mastered wins, even once its questions are retired", () => {
    expect(moonWords(moon(2, true, 3))).toBe("Mastered");
    expect(moonWords(moon(2, true, 0))).toBe("Mastered");
  });
  it("a moon with no live question says so (fail-closed)", () => {
    expect(moonWords(moon(0, false, 0))).toBe("No questions yet");
  });
  it("not started, then how many are right of how many there are", () => {
    expect(moonWords(moon(0, false, 3))).toBe("Not started");
    expect(moonWords(moon(1, false, 3))).toBe("1 of 3 right");
  });
});

import { studentAnswerText } from "../src/lib/record-view";

describe("studentAnswerText: an answer is text before any page sees it (8 Oct 2026)", () => {
  // On the deployment an object here was handed to React as a child and blanked the console.
  const options = ["A compiler", "An assembler", "A linker"];
  it("turns the stored shapes into text", () => {
    expect(studentAnswerText({ index: 1 }, options)).toBe("An assembler");
    expect(studentAnswerText({ order: ["b", "a"] })).toBe("b | a");
    expect(studentAnswerText({ value: "0x1F" })).toBe("0x1F");
    expect(studentAnswerText({ value: 12 })).toBe("12");
    expect(studentAnswerText("An assembler")).toBe("An assembler");
  });
  it("is null, never an object, for anything it cannot read", () => {
    for (const raw of [null, undefined, {}, [], "", { index: 7 }, { order: [] }, { weird: 1 }, true]) {
      expect(studentAnswerText(raw, options), JSON.stringify(raw)).toBeNull();
    }
  });
});
