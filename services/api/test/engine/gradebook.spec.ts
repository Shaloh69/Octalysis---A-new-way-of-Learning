import { describe, it, expect } from "vitest";
import { GRADE_WEIGHTS, Gradebook } from "@octa/contracts";
import { computeGradebook, toCsv, type GradebookInput } from "../../src/gradebook/compute.js";

/**
 * The gradebook's arithmetic, with no database.
 *
 * Every rule here is an instructor decision of 28 Sep 2026 or a finding the
 * `/submissions` session parked (`docs/NEXT-SESSION.md` §0g.2, §0g.3), and each
 * test is named after the rule it holds.
 */

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

function world(over: Partial<GradebookInput> = {}): GradebookInput {
  return {
    stages: [
      { id: "01", title: "Introduction" },
      { id: "02", title: "Performance" },
      { id: "03", title: "Top-level view" },
    ],
    students: [
      { userId: A, studentId: "21-0001", fullName: "Ana Reyes", section: "BSCPE - 4" },
      { userId: B, studentId: "21-0002", fullName: "Ben Cruz", section: "BSCPE - 4" },
    ],
    checks: [],
    exams: [],
    examScores: [],
    submissions: [],
    ...over,
  };
}

describe("computeGradebook", () => {
  it("the syllabus weights sum to 100", () => {
    expect(Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("a stage check nobody has sat is not counted, and a student who has not sat one is NOT SAT, not 0", () => {
    const g = computeGradebook(world({ checks: [{ userId: A, stageId: "01", ratio: 0.8 }] }));
    const a = g.students.find((s) => s.userId === A)!;
    const b = g.students.find((s) => s.userId === B)!;
    expect(a.checks["01"]).toBe(80);
    expect(b.checks["01"]).toBeNull();
    expect(a.checks["02"]).toBeNull();
    // Quizzes counts stage 01 only (the class has sat nothing else) ...
    const quizzes = g.components.find((c) => c.key === "quizzes")!;
    expect(quizzes.counted.map((c) => c.id)).toEqual(["01"]);
    // ... and within it, a check the student did not sit counts as 0.
    expect(a.components.quizzes).toBe(80);
    expect(b.components.quizzes).toBe(0);
  });

  it("a real 0% stays 0, and is not confused with not sat", () => {
    const g = computeGradebook(world({ checks: [{ userId: A, stageId: "01", ratio: 0 }] }));
    expect(g.students.find((s) => s.userId === A)!.checks["01"]).toBe(0);
    expect(g.students.find((s) => s.userId === B)!.checks["01"]).toBeNull();
  });

  it("a component the class has no marks in is left out, and the final is rescaled over the rest", () => {
    const g = computeGradebook(world({
      checks: [
        { userId: A, stageId: "01", ratio: 0.9 },
        { userId: B, stageId: "01", ratio: 0.5 },
      ],
      submissions: [
        { userId: A, kind: "lab", slug: "lab-03", title: "Lab 3", status: "graded", score: 3, maxScore: 4 },
        { userId: B, kind: "lab", slug: "lab-03", title: "Lab 3", status: "graded", score: 4, maxScore: 4 },
      ],
    }));
    // Quizzes (30) and labs (10) have marks: 40% of the grade is covered.
    expect(g.coverage).toBe(40);
    expect(g.components.filter((c) => c.covered).map((c) => c.key)).toEqual(["quizzes", "labs"]);
    const a = g.students.find((s) => s.userId === A)!;
    expect(a.components.project).toBeNull();
    expect(a.components.exams).toBeNull();
    // (30 * 90 + 10 * 75) / 40 = 86.25
    expect(a.final).toBe(86.3);
    const b = g.students.find((s) => s.userId === B)!;
    // (30 * 50 + 10 * 100) / 40 = 62.5
    expect(b.final).toBe(62.5);
  });

  it("nothing marked anywhere: no coverage, no final, and no average invented", () => {
    const g = computeGradebook(world());
    expect(g.coverage).toBe(0);
    expect(g.students.every((s) => s.final === null)).toBe(true);
    expect(g.classAverage.final).toBeNull();
  });

  it("normalises a mark by its own maximum: a lab out of 100 and a lab out of 4 are the same scale", () => {
    const g = computeGradebook(world({
      submissions: [
        { userId: A, kind: "lab", slug: "lab-03", title: "Lab 3", status: "graded", score: 75, maxScore: 100 },
        { userId: B, kind: "lab", slug: "lab-03", title: "Lab 3", status: "graded", score: 3, maxScore: 4 },
      ],
    }));
    expect(g.students.map((s) => s.components.labs)).toEqual([75, 75]);
  });

  it("only a GRADED row scores: a returned lab keeps its old score in the row, and it must not count", () => {
    const g = computeGradebook(world({
      submissions: [
        { userId: A, kind: "lab", slug: "lab-03", title: "Lab 3", status: "returned", score: 4, maxScore: 4 },
        { userId: B, kind: "lab", slug: "lab-03", title: "Lab 3", status: "graded", score: 2, maxScore: 4 },
      ],
    }));
    const a = g.students.find((s) => s.userId === A)!;
    // Handed in and waiting on a revision: not scored, not zero, counted as unmarked.
    expect(a.components.labs).toBeNull();
    expect(a.unmarked).toBe(1);
  });

  it("handed in and not yet marked is not a zero; not handed in is", () => {
    const g = computeGradebook(world({
      submissions: [
        { userId: A, kind: "lab", slug: "lab-03", title: "Lab 3", status: "graded", score: 4, maxScore: 4 },
        { userId: A, kind: "lab", slug: "lab-05", title: "Lab 5", status: "graded", score: 2, maxScore: 4 },
        { userId: B, kind: "lab", slug: "lab-03", title: "Lab 3", status: "submitted", score: null, maxScore: null },
        // B has only a draft of lab 5: never handed in.
        { userId: B, kind: "lab", slug: "lab-05", title: "Lab 5", status: "draft", score: null, maxScore: null },
      ],
    }));
    const b = g.students.find((s) => s.userId === B)!;
    // lab-03 pending (excluded), lab-05 not handed in (0): mean over lab-05 only.
    expect(b.components.labs).toBe(0);
    expect(b.unmarked).toBe(1);
    expect(g.awaitingMarking).toBe(1);
    expect(g.students.find((s) => s.userId === A)!.components.labs).toBe(75);
  });

  it("a deliverable nobody has a mark in is not counted yet, so nobody gets a 0 for it", () => {
    const g = computeGradebook(world({
      submissions: [
        { userId: A, kind: "project", slug: "final-project", title: "Final project", status: "submitted", score: null, maxScore: null },
      ],
    }));
    const project = g.components.find((c) => c.key === "project")!;
    expect(project.covered).toBe(false);
    expect(project.counted).toEqual([]);
    expect(g.students.every((s) => s.components.project === null)).toBe(true);
  });

  it("a voided submission counts for nothing, not even as unmarked", () => {
    const g = computeGradebook(world({
      submissions: [
        { userId: A, kind: "lab", slug: "lab-03", title: "Lab 3", status: "voided", score: 4, maxScore: 4 },
      ],
    }));
    expect(g.components.find((c) => c.key === "labs")!.covered).toBe(false);
    expect(g.students.find((s) => s.userId === A)!.unmarked).toBe(0);
  });

  it("major exams: best submitted score per exam, an exam not sat counts 0 once the class has sat it", () => {
    const g = computeGradebook(world({
      exams: [
        { id: "e1", title: "Prelim Examination" },
        { id: "e2", title: "Midterm Examination" },
      ],
      examScores: [
        { userId: A, assessmentId: "e1", ratio: 0.6 },
        { userId: A, assessmentId: "e1", ratio: 0.9 },
      ],
    }));
    const exams = g.components.find((c) => c.key === "exams")!;
    expect(exams.counted.map((c) => c.title)).toEqual(["Prelim Examination"]);
    expect(g.students.find((s) => s.userId === A)!.components.exams).toBe(90);
    expect(g.students.find((s) => s.userId === B)!.components.exams).toBe(0);
  });

  it("the class average is over students with a value, and never counts not-sat as 0", () => {
    const g = computeGradebook(world({
      checks: [{ userId: A, stageId: "01", ratio: 0.6 }],
    }));
    expect(g.classAverage.checks["01"]).toBe(60);
    expect(g.classAverage.checks["02"]).toBeNull();
    // Quizzes: A 60, B 0 (did not sit a counted check) -> 30.
    expect(g.classAverage.components.quizzes).toBe(30);
  });

  it("the result satisfies the shared contract", () => {
    const g = computeGradebook(world({ checks: [{ userId: A, stageId: "01", ratio: 1 }] }));
    expect(() => Gradebook.parse(g)).not.toThrow();
  });
});

describe("toCsv", () => {
  it("names the weight in each component column, and leaves a not-sat check EMPTY", () => {
    const g = computeGradebook(world({ checks: [{ userId: A, stageId: "01", ratio: 0.8 }] }));
    const [header, rowA, rowB] = toCsv(g).split("\n");
    expect(header).toBe(
      "student_id,full_name,section,stage_01,stage_02,stage_03," +
      "project_20,quizzes_30,exams_30,labs_10,participation_10,final_so_far,grade_covered_pct",
    );
    expect(rowA).toBe("21-0001,Ana Reyes,BSCPE - 4,80,,,,80.0,,,,80.0,30");
    // B sat nothing: an empty cell, not a 0. Quizzes counts stage 01, so 0.0 there.
    expect(rowB).toBe("21-0002,Ben Cruz,BSCPE - 4,,,,,0.0,,,,0.0,30");
  });

  it("escapes a name containing a comma and a quote", () => {
    const g = computeGradebook(world({
      students: [{ userId: A, studentId: "21-0001", fullName: 'Dela Cruz, Juan "JD"', section: null }],
    }));
    expect(toCsv(g).split("\n")[1]).toMatch(/^21-0001,"Dela Cruz, Juan ""JD""",,/);
  });
});
