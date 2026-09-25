import { describe, it, expect } from "vitest";
import {
  bulkToast, cellKind, cellLine, column, localToIso, rectangle, scopeLine, selectionSummary,
  singleToast, when, windowError, windowLine,
} from "../src/lib/locks-view";
import type { LockCell, ScopeLock } from "../src/lib/api";

const cell = (c: Partial<LockCell>): LockCell => ({
  userId: "u1", stageId: "05", unlocked: false, mastery: 0,
  override: null, reason: null, setBy: null, setAt: null, ...c,
});

const m = {
  students: [{ userId: "a" }, { userId: "b" }, { userId: "c" }].map((s) => ({
    ...s, studentId: s.userId, fullName: s.userId, sectionId: null,
  })),
  stages: ["00", "01", "02", "03"].map((id, i) => ({ id, title: id, ordinal: i })),
};

describe("a cell reads the database's answer, never its own", () => {
  it("an automatic cell is drawn from `unlocked` alone", () => {
    expect(cellKind(cell({ unlocked: true }))).toBe("auto-open");
    expect(cellKind(cell({ unlocked: false }))).toBe("auto-closed");
  });

  it("a person's override is marked as a person's, whatever the database says", () => {
    expect(cellKind(cell({ override: "unlocked", unlocked: true }))).toBe("person-open");
    expect(cellKind(cell({ override: "locked", unlocked: false }))).toBe("person-closed");
    // The disagreement case: opened by a person, still closed in the database.
    expect(cellKind(cell({ override: "unlocked", unlocked: false }))).toBe("person-open");
  });

  it("says the database's answer first when the two disagree", () => {
    const line = cellLine(cell({ override: "unlocked", unlocked: false, setBy: "T", reason: "window" }));
    expect(line.startsWith("Closed")).toBe(true);
    expect(line).toMatch(/Opened by T/);
  });

  it("names who, when and why for an override, and nobody for the curriculum", () => {
    const line = cellLine(cell({
      override: "locked", setBy: "Demo Teacher", setAt: "2026-09-24T01:30:00.000Z", reason: "quiz",
    }));
    expect(line).toMatch(/^Closed by Demo Teacher, 24 Sep 2026, \d\d:30: “quiz”\.$/);
    expect(cellLine(cell({ unlocked: true }))).toBe("Open, by the curriculum.");
  });
});

describe("dates read the same in every browser", () => {
  it("never says Sept", () => {
    expect(when("2026-09-24T12:00:00.000Z")).toMatch(/^2[45] Sep 2026, \d\d:\d\d$/);
    expect(when(null)).toBe("");
    expect(when("not a date")).toBe("");
  });
});

describe("bulk selection", () => {
  it("a rectangle covers every cell between two corners, in either direction", () => {
    const r = rectangle(m, { row: 2, col: 3 }, { row: 1, col: 2 });
    expect(r.sort()).toEqual(["b|02", "b|03", "c|02", "c|03"]);
  });

  it("a single corner is one cell", () => {
    expect(rectangle(m, { row: 0, col: 0 }, { row: 0, col: 0 })).toEqual(["a|00"]);
  });

  it("a column is one stage for every student", () => {
    expect(column(m, "02")).toEqual(["a|02", "b|02", "c|02"]);
  });

  it("summarises students × stages", () => {
    expect(selectionSummary(["a|02", "b|02", "a|03"])).toEqual({
      cells: 3, students: 2, stages: 2, stageIds: ["02", "03"],
    });
  });
});

describe("toasts say what happened to what", () => {
  it("one cell", () => {
    expect(singleToast("05", "locked", "Juan")).toBe("Stage 05 closed for Juan");
    expect(singleToast("05", "unlocked", "Juan")).toBe("Stage 05 opened early for Juan");
  });

  it("one stage for many", () => {
    expect(bulkToast(["a|05", "b|05"], "locked")).toBe("Stage 05 closed for 2 students");
  });

  it("many stages", () => {
    expect(bulkToast(["a|05", "a|06", "b|05"], "auto")).toBe(
      "3 cells returned to automatic across 2 students and 2 stages",
    );
  });
});

describe("scheduled overrides", () => {
  const l: ScopeLock = {
    id: "x", scope: "section", sectionId: "s", sectionCode: "BSCPE - 4", stageId: "06",
    state: "unlocked", reason: "lab week", unlockAt: "2026-10-01T00:00:00.000Z",
    lockAt: null, setBy: "T", setAt: null,
  };

  it("prints the window as stored and never claims it is active", () => {
    expect(windowLine(l)).toMatch(/^from 1 Oct 2026/);
    expect(windowLine({ unlockAt: null, lockAt: null })).toBe("");
    expect(scopeLine(l)).toMatch(/^Section BSCPE - 4: opened by T \(from 1 Oct 2026, [\d:]+\): “lab week”$/);
    expect(scopeLine(l)).not.toMatch(/active|now/i);
  });

  it("refuses a window that closes before it opens", () => {
    expect(windowError("2026-10-10T08:00", "2026-10-09T08:00")).toMatch(/close after it opens/);
    expect(windowError("2026-10-10T08:00", "2026-10-10T08:00")).toMatch(/close after it opens/);
    expect(windowError("2026-10-10T08:00", "2026-10-17T08:00")).toBeNull();
    expect(windowError("", "2026-10-17T08:00")).toBeNull();
  });

  it("an empty or unreadable time is no time", () => {
    expect(localToIso("")).toBeNull();
    expect(localToIso("nonsense")).toBeNull();
    expect(localToIso("2026-10-10T08:00")).toMatch(/^2026-10-10T/);
  });
});
