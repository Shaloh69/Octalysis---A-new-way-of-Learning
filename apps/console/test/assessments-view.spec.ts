import { describe, it, expect } from "vitest";
import {
  bankWords, cellWords, counts, dayTime, fromLocalInput, saltState, toLocalInput,
  unfillable, windowLines, windowSentence, windowState,
} from "../src/lib/assessments-view";
import type { Bank } from "../src/lib/api";

const NOW = new Date("2026-09-27T12:00:00");
const iso = (s: string) => new Date(s).toISOString();

const short: Bank = { totalItems: 8, poolSize: 0, enoughItems: false, shortfalls: [], satisfiable: false };
const fills: Bank = { totalItems: 8, poolSize: 9, enoughItems: true, shortfalls: [], satisfiable: true };

describe("windowState: the engine's rule, a NULL bound is no bound", () => {
  it("no dates is open now", () => {
    expect(windowState({ opensAt: null, closesAt: null }, NOW)).toBe("open");
  });
  it("an opening in the future is scheduled", () => {
    expect(windowState({ opensAt: iso("2026-10-01T08:00"), closesAt: null }, NOW)).toBe("scheduled");
  });
  it("a closing in the past is closed, whatever the opening", () => {
    expect(windowState({ opensAt: null, closesAt: iso("2026-09-20T17:00") }, NOW)).toBe("closed");
    expect(windowState({ opensAt: iso("2026-09-01T08:00"), closesAt: iso("2026-09-20T17:00") }, NOW)).toBe("closed");
  });
  it("inside the window is open", () => {
    expect(windowState({ opensAt: iso("2026-09-20T08:00"), closesAt: iso("2026-10-01T17:00") }, NOW)).toBe("open");
  });
});

describe("dates: one format, built by hand", () => {
  it("writes day, month, year and the local time, never 'Sept'", () => {
    expect(dayTime(iso("2026-09-01T08:05"))).toBe("1 Sep 2026, 08:05");
    expect(dayTime(null)).toBeNull();
  });
  it("the window cell has a line per bound, none without one", () => {
    expect(windowLines({ opensAt: null, closesAt: null })).toEqual([]);
    expect(windowLines({ opensAt: iso("2026-10-01T08:00"), closesAt: iso("2026-10-08T17:00") })).toEqual([
      ["opens", "1 Oct 2026, 08:00"],
      ["closes", "8 Oct 2026, 17:00"],
    ]);
  });
  it("the preview's sentence says what a student can do", () => {
    expect(windowSentence(null, null, NOW)).toBe("Open now, and stays open.");
    expect(windowSentence(null, iso("2026-10-08T17:00"), NOW)).toBe("Open now, closes 8 Oct 2026, 17:00.");
    expect(windowSentence(iso("2026-10-01T08:00"), null, NOW)).toBe("Opens 1 Oct 2026, 08:00 and stays open.");
    expect(windowSentence(null, iso("2026-09-20T17:00"), NOW)).toBe("Closed on 20 Sep 2026, 17:00.");
  });
  it("round-trips a datetime-local value, and an empty field is null", () => {
    expect(toLocalInput(iso("2026-10-01T08:00"))).toBe("2026-10-01T08:00");
    expect(fromLocalInput("2026-10-01T08:00")).toBe(iso("2026-10-01T08:00"));
    expect(fromLocalInput("")).toBeNull();
    expect(toLocalInput(null)).toBe("");
  });
});

describe("the salt: when, never what", () => {
  it("says set, or rotated, with the day", () => {
    expect(saltState({ saltSetAt: iso("2026-09-27T08:00"), saltRotatedAt: null })).toEqual({ verb: "set", day: "27 Sep 2026" });
    expect(saltState({ saltSetAt: iso("2026-09-27T08:00"), saltRotatedAt: iso("2026-09-28T08:00") })).toEqual({
      verb: "rotated", day: "28 Sep 2026",
    });
  });
  it("is null when the secrets row is missing, which the page turns into a warning", () => {
    expect(saltState({ saltSetAt: null, saltRotatedAt: null })).toBeNull();
  });
});

describe("the bank, in words", () => {
  it("fills, short of items, or short in cells", () => {
    expect(bankWords(fills)).toBe("fills");
    expect(bankWords(short)).toBe("short: 0 of 8 live");
    expect(
      bankWords({ ...fills, satisfiable: false, shortfalls: [{ dimension: "by_bloom", cell: "apply", need: 3, have: 1 }] }),
    ).toBe("short in 1 cell");
  });
  it("names a cell the way a teacher would", () => {
    expect(cellWords({ dimension: "by_bloom", cell: "apply" })).toBe("Bloom · apply");
    expect(cellWords({ dimension: "by_type", cell: "P" })).toBe("Type · computed");
    expect(cellWords({ dimension: "by_type", cell: "G" })).toBe("Type · ordering");
    expect(cellWords({ dimension: "by_act", cell: "1" })).toBe("Act 1 · Prelim");
  });
});

describe("the header and the banner", () => {
  const rows = [
    { opensAt: null, closesAt: null, bank: short },
    { opensAt: iso("2026-10-01T08:00"), closesAt: null, bank: short },
    { opensAt: null, closesAt: iso("2026-09-20T17:00"), bank: short },
    { opensAt: null, closesAt: null, bank: fills },
  ];
  it("counts open, scheduled and closed", () => {
    expect(counts(rows, NOW)).toEqual({ all: 4, open: 2, scheduled: 1, closed: 1 });
  });
  it("warns only about assessments a student can still reach", () => {
    // The closed one cannot be started, so its bank no longer matters.
    expect(unfillable(rows, NOW)).toHaveLength(2);
  });
});
