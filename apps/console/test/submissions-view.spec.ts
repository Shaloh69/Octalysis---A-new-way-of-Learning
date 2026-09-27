import { describe, it, expect } from "vitest";
import {
  bandOf, counts, deliverables, durationWords, lateWords, markText, matches, nextToMark,
  scoreProblem, scoreText, usesBands,
} from "../src/lib/submissions-view";

const iso = (s: string) => new Date(s).toISOString();

describe("lateWords: the Late column, a fact in words", () => {
  const base = { isLate: false, dueAt: iso("2026-09-20T17:00"), submittedAt: iso("2026-09-20T09:00"), status: "submitted" as const };

  it("on time", () => {
    expect(lateWords(base)).toBe("on time");
  });
  it("late, by how much, from the database's own flag", () => {
    expect(lateWords({ ...base, isLate: true, submittedAt: iso("2026-09-21T20:00") })).toBe("1 day late");
    expect(lateWords({ ...base, isLate: true, submittedAt: iso("2026-09-20T20:30") })).toBe("3 hours late");
    expect(lateWords({ ...base, isLate: true, submittedAt: iso("2026-09-20T17:20") })).toBe("20 minutes late");
  });
  it("trusts is_late, never the clock: not late unless the database says so", () => {
    expect(lateWords({ ...base, isLate: false, submittedAt: iso("2026-09-22T09:00") })).toBe("on time");
  });
  it("no due date is said, not left blank", () => {
    expect(lateWords({ ...base, dueAt: null })).toBe("no due date");
  });
  it("a draft has not been handed in, so it cannot be late yet", () => {
    expect(lateWords({ ...base, status: "draft", submittedAt: null })).toBe("not handed in");
  });
});

describe("durationWords", () => {
  it("is singular at one and never zero", () => {
    expect(durationWords(0)).toBe("1 minute");
    expect(durationWords(60 * 60_000)).toBe("1 hour");
    expect(durationWords(24 * 60 * 60_000)).toBe("1 day");
    expect(durationWords(50 * 60 * 60_000)).toBe("2 days");
  });
});

describe("marks", () => {
  it("reads as the grader writes it", () => {
    expect(markText({ score: 3, maxScore: 4 })).toBe("3/4");
    expect(markText({ score: 85, maxScore: 100 })).toBe("85/100");
    expect(markText({ score: 2.5, maxScore: 4 })).toBe("2.5/4");
    expect(markText({ score: null, maxScore: null })).toBeNull();
    expect(scoreText(7.125)).toBe("7.13");
  });
  it("reads a lab's band back from its rubric", () => {
    expect(bandOf({ rubric: { band: 3 } })?.label).toMatch(/reasoning thin/);
    expect(bandOf({ rubric: {} })).toBeNull();
  });
  it("uses the manual's bands for labs only", () => {
    expect(usesBands("lab")).toBe(true);
    expect(usesBands("project")).toBe(false);
    expect(usesBands("participation")).toBe(false);
  });
});

describe("scoreProblem: a stated score, checked as the API checks it", () => {
  it("accepts a score within its maximum", () => {
    expect(scoreProblem("18", "20")).toBeNull();
    expect(scoreProblem("0", "20")).toBeNull();
    expect(scoreProblem("20", "20")).toBeNull();
  });
  it("names what is wrong", () => {
    expect(scoreProblem("", "20")).toMatch(/enter a score/i);
    expect(scoreProblem("21", "20")).toMatch(/above the maximum of 20/);
    expect(scoreProblem("-1", "20")).toMatch(/below 0/);
    expect(scoreProblem("5", "0")).toMatch(/more than 0/);
    expect(scoreProblem("x", "20")).toMatch(/numbers/);
  });
});

const rows = [
  { id: "a", status: "submitted" as const, slug: "lab-03", kind: "lab" as const, title: "Lab 03", studentName: "Angelo Go", studentId: "232129009" },
  { id: "b", status: "graded" as const, slug: "lab-03", kind: "lab" as const, title: "Lab 03", studentName: "Bea Enriquez", studentId: "232129010" },
  { id: "c", status: "returned" as const, slug: "lab-05", kind: "lab" as const, title: "Lab 05", studentName: "Josue Alcantara", studentId: "232129011" },
  { id: "d", status: "draft" as const, slug: "final-project", kind: "project" as const, title: "Final", studentName: "Kim Villanueva", studentId: "232129003" },
  { id: "e", status: "submitted" as const, slug: "final-project", kind: "project" as const, title: "Final", studentName: "Emmanuel Diaz", studentId: "232129007" },
];

describe("filters", () => {
  it("counts every state", () => {
    expect(counts(rows)).toEqual({ all: 5, submitted: 2, returned: 1, graded: 1, draft: 1 });
  });
  it("by status, deliverable, kind and search", () => {
    const f = (o: Partial<Parameters<typeof matches>[1]>) =>
      rows.filter((r) => matches(r, { status: "all", deliverable: null, q: "", ...o })).map((r) => r.id);
    expect(f({ status: "submitted" })).toEqual(["a", "e"]);
    expect(f({ deliverable: "lab-03" })).toEqual(["a", "b"]);
    expect(f({ deliverable: "kind:project" })).toEqual(["d", "e"]);
    expect(f({ q: "diaz" })).toEqual(["e"]);
    expect(f({ q: "232129011" })).toEqual(["c"]);
  });
  it("groups deliverables by kind, with counts", () => {
    const g = deliverables(rows);
    expect(g.map((x) => [x.kind, x.n])).toEqual([["lab", 3], ["project", 2]]);
    expect(g[0]!.slugs.map((s) => [s.slug, s.n])).toEqual([["lab-03", 2], ["lab-05", 1]]);
  });
});

describe("nextToMark: save and advance", () => {
  it("moves to the next row WAITING after the current one, passing a returned one", () => {
    // "c" is returned: with the student, not the teacher.
    expect(nextToMark(rows, "a")).toBe("e");
    expect(nextToMark(rows, "c")).toBe("e");
  });
  it("wraps to the top, and never returns the current row", () => {
    expect(nextToMark(rows, "e")).toBe("a");
    expect(nextToMark([rows[0]!], "a")).toBeNull();
  });
  it("starts at the top when nothing is open", () => {
    expect(nextToMark(rows, null)).toBe("a");
  });
  it("is null when nothing is left to mark", () => {
    expect(nextToMark(rows.filter((r) => r.status === "graded"), "b")).toBeNull();
  });
});
