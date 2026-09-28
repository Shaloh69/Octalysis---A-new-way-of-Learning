import { describe, it, expect } from "vitest";
import type { LiveStage } from "@octa/contracts";
import {
  busiest, clockTime, endedWords, plural, resultWords, share, startedWords, whoMayAnswer,
} from "../src/lib/live-view";

const stage = (stageId: string, students: number): LiveStage => ({
  stageId, title: `Stage ${stageId}`, students, avgMastery: students < 5 ? null : 60,
});

describe("the split is the server's figure, said in words", () => {
  it("a whole percent, or nothing when there is nothing to divide", () => {
    expect(share(7, 12)).toBe(58);
    expect(share(0, 5)).toBe(0);
    expect(share(null, 4)).toBeNull();
    expect(share(3, 0)).toBeNull();
  });

  it("names the split once it is sent", () => {
    expect(resultWords({ answered: 12, correct: 7 }, 5)).toBe("7 of 12 correct, 58%");
  });

  it("says why it is held back, and never implies a number", () => {
    expect(resultWords({ answered: 3, correct: null }, 5)).toMatch(/^Held back until 5 have answered/);
    expect(resultWords({ answered: 0, correct: null }, 5)).toBe("Nobody has answered yet. The result appears once 5 have.");
  });
});

describe("the toasts say what happened to what", () => {
  it("start names the item and who may answer", () => {
    expect(startedWords("P-04-cache-1", null)).toBe("P-04-cache-1 put to the room, for everyone");
    expect(startedWords("P-04-cache-1", "BSCPE - 4")).toBe("P-04-cache-1 put to the room, for section BSCPE - 4");
  });
  it("end names the item and how many answered", () => {
    expect(endedWords("P-04-cache-1", 12)).toBe("P-04-cache-1 ended after 12 answers");
    expect(endedWords("P-04-cache-1", 1)).toBe("P-04-cache-1 ended after 1 answer");
  });
  it("who may answer", () => {
    expect(whoMayAnswer(null)).toBe("everyone");
    expect(whoMayAnswer("BSCPE-2A")).toBe("section BSCPE-2A");
  });
  it("plural", () => {
    expect(plural(1, "student", "students")).toBe("1 student");
    expect(plural(0, "student", "students")).toBe("0 students");
  });
});

describe("the projector's stages", () => {
  it("keeps the eight with the most students, shown in course order", () => {
    const stages = ["01", "02", "03", "04", "05", "06", "07", "08", "09"].map((id, i) => stage(id, 30 - i));
    stages.push(stage("10", 2));
    expect(busiest(stages).map((s) => s.stageId)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
    expect(busiest([stage("07", 3), stage("02", 21)]).map((s) => s.stageId)).toEqual(["02", "07"]);
  });
});

describe("the clock is one format", () => {
  it("is 24-hour, zero-padded, built by hand", () => {
    const d = new Date(2026, 8, 29, 9, 5, 7);
    expect(clockTime(d.toISOString())).toBe("09:05:07");
  });
});
