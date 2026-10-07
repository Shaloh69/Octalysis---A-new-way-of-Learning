import { describe, it, expect } from "vitest";
import type { TeacherRow } from "@octa/contracts";
import {
  canDisable, confirmWord, parseTeacherRoster, planOutcome, teacherCounts, teacherMatches, teachesSubject,
} from "../src/lib/teachers-view";

const row = (over: Partial<TeacherRow> = {}): TeacherRow => ({
  key: "u1", userId: "11111111-1111-4111-8111-111111111111", employeeId: "EMP-0001", fullName: "Maria Osmeña",
  email: "maria@example.com", role: "teacher", status: "active", classes: [], tokensThisMonth: 0, lastSignInAt: null,
  avatar: { url: null, hue: 200, variant: 1, removable: false },
  ...over,
});

describe("the teacher roster parser", () => {
  it("reads ID, name, email and role in any order after the ID, by comma or tab", () => {
    const r = parseTeacherRoster("EMP-0001, Maria Santos, maria@x.edu, admin\nEMP-0002\tJuan Cruz\tjuan@x.edu");
    expect(r.bad).toBe(0);
    expect(r.rows).toEqual([
      { employeeId: "EMP-0001", fullName: "Maria Santos", email: "maria@x.edu", role: "admin" },
      { employeeId: "EMP-0002", fullName: "Juan Cruz", email: "juan@x.edu", role: "teacher" },
    ]);
  });
  it("keeps a name that has a comma in it", () => {
    const r = parseTeacherRoster("EMP-0003, Dela Cruz, Juan Miguel, juan@x.edu");
    expect(r.rows[0]).toMatchObject({ fullName: "Dela Cruz, Juan Miguel", email: "juan@x.edu" });
  });
  it("counts a line with no valid ID, or no name, as bad, and skips blank lines", () => {
    const r = parseTeacherRoster("\n?, Someone\nEMP-0004\n\nEMP-0005, Ana Reyes\n");
    expect(r.bad).toBe(2);
    expect(r.rows.map((x) => x.employeeId)).toEqual(["EMP-0005"]);
  });
});

describe("the page's words", () => {
  it("counts by status", () => {
    expect(teacherCounts([row(), row({ status: "unclaimed" }), row({ status: "disabled" })])).toEqual({
      all: 3, active: 1, unclaimed: 1, disabled: 1,
    });
  });
  it("finds 'osmena' in 'Osmeña', and by ID and email", () => {
    expect(teacherMatches(row(), "osmena")).toBe(true);
    expect(teacherMatches(row(), "emp-0001")).toBe(true);
    expect(teacherMatches(row(), "example.com")).toBe(true);
    expect(teacherMatches(row(), "zzz")).toBe(false);
  });
  it("a subject filter counts live classes only", () => {
    const cls = { id: "c", sectionId: "s", sectionCode: "BSCPE-2A", subjectCode: "CPE 412", term: "2026-1", bookId: null, bookLabel: null, students: 3 };
    expect(teachesSubject(row({ classes: [{ ...cls, endedAt: null }] }), "CPE 412")).toBe(true);
    expect(teachesSubject(row({ classes: [{ ...cls, endedAt: "2026-10-01T00:00:00Z" }] }), "CPE 412")).toBe(false);
    expect(teachesSubject(row(), "all")).toBe(true);
  });
  it("never offers to disable an admin or yourself", () => {
    expect(canDisable(row({ role: "admin" }), null)).toBe(false);
    expect(canDisable(row(), row().userId)).toBe(false);
    expect(canDisable(row(), "someone-else")).toBe(true);
    expect(canDisable(row({ userId: null, key: "employee:EMP-9" }), "x")).toBe(true);
  });
  it("confirms with the employee ID, or the name when there is none", () => {
    expect(confirmWord(row())).toBe("EMP-0001");
    expect(confirmWord(row({ employeeId: null }))).toBe("Maria Osmeña");
  });
  it("says why a row is not imported", () => {
    expect(planOutcome({ employeeId: "E", fullName: "A", email: null, role: "teacher", current: { fullName: "B", email: null, role: "teacher", status: "claimed" }, action: "conflict", why: "claimed" }).detail)
      .toMatch(/never overwritten/);
    expect(planOutcome({ employeeId: "E", fullName: "A", email: "a@x", role: "admin", current: { fullName: "A", email: null, role: "teacher", status: "unclaimed" }, action: "update" }).detail)
      .toBe("Email: none → a@x · Role: teacher → admin");
  });
});
