import { describe, it, expect } from "vitest";
import {
  asRosterRow, dayDate, duration, paperSummary, sequence, showsKey, timeTaken, verdict,
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
      },
      sections: [], attempts: [], progress: [],
    };
    expect(asRosterRow(d)).toMatchObject({
      studentId: "232129006", userId: "u", sectionId: "s", deactivated: true, status: "claimed",
    });
  });
});
