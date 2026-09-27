import {
  GRADE_COMPONENT_LABELS, GRADE_WEIGHTS, GradeComponent,
  type Gradebook, type GradebookComponentInfo, type GradebookStudent,
} from "@octa/contracts";

/**
 * The gradebook's arithmetic, pure, so every rule is a unit test
 * (`test/engine/gradebook.spec.ts`) rather than a hope about SQL.
 *
 * Instructor decisions, 28 Sep 2026:
 *
 *  - The weights are the syllabus's and fixed (`GRADE_WEIGHTS`).
 *  - The final is a SCORE SO FAR. A component the class has no marks in yet is
 *    left out and the rest rescaled, and the page says how much of the grade
 *    that covers. Within a component that has marks, work a student did not
 *    hand in or sit counts as 0.
 *  - A stage check not sat is NOT SAT (null), never 0. It becomes a 0 only
 *    inside the Quizzes component, once the class has sat that check.
 *
 * And two findings the `/submissions` session parked (NEXT-SESSION §0g):
 *
 *  - Only `status = 'graded'` scores. A returned row keeps its old score in
 *    the table, and counting it would score work the student is revising.
 *  - A mark is normalised by its own `max_score`. The seed's labs are out of
 *    100; the console marks a lab out of 4.
 */

type SubmissionKind = "lab" | "project" | "participation";

export interface GradebookInput {
  /** Gradeable stages, in order. */
  stages: Array<{ id: string; title: string }>;
  students: Array<{ userId: string; studentId: string; fullName: string; section: string | null }>;
  /** Best stage-check result per student and stage, for checks actually sat. */
  checks: Array<{ userId: string; stageId: string; ratio: number }>;
  /** Final-scope assessments (Prelim, Midterm, ...), in order. */
  exams: Array<{ id: string; title: string }>;
  /** Submitted attempts on those, one row per attempt; the best one counts. */
  examScores: Array<{ userId: string; assessmentId: string; ratio: number }>;
  submissions: Array<{
    userId: string;
    kind: SubmissionKind;
    slug: string;
    title: string;
    status: "draft" | "submitted" | "returned" | "graded" | "voided";
    score: number | null;
    maxScore: number | null;
  }>;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const mean = (xs: readonly number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

/** A mark counts only when it is graded and has a usable maximum. */
function markOf(s: GradebookInput["submissions"][number]): number | null {
  if (s.status !== "graded" || s.score === null || s.maxScore === null || s.maxScore <= 0) return null;
  return Math.min(1, Math.max(0, s.score / s.maxScore));
}

export function computeGradebook(input: GradebookInput): Gradebook {
  const users = input.students.map((s) => s.userId);

  /* ---- stage checks ---- */
  const checkBy = new Map<string, number>();
  for (const c of input.checks) {
    const k = `${c.userId}|${c.stageId}`;
    checkBy.set(k, Math.max(checkBy.get(k) ?? 0, c.ratio));
  }
  const satStages = input.stages.filter((st) => users.some((u) => checkBy.has(`${u}|${st.id}`)));

  /* ---- exams: best submitted attempt ---- */
  const examBy = new Map<string, number>();
  for (const e of input.examScores) {
    const k = `${e.userId}|${e.assessmentId}`;
    examBy.set(k, Math.max(examBy.get(k) ?? 0, e.ratio));
  }
  const satExams = input.exams.filter((ex) => users.some((u) => examBy.has(`${u}|${ex.id}`)));

  /* ---- submissions: which deliverables have a mark anywhere in the class ---- */
  const live = input.submissions.filter((s) => s.status !== "voided");
  const subBy = new Map<string, GradebookInput["submissions"][number]>();
  for (const s of live) subBy.set(`${s.userId}|${s.slug}`, s);
  const countedOf = (kind: SubmissionKind) => {
    const seen = new Map<string, string>();
    for (const s of live) {
      if (s.kind === kind && markOf(s) !== null && !seen.has(s.slug)) seen.set(s.slug, s.title);
    }
    return [...seen].sort(([a], [b]) => a.localeCompare(b)).map(([id, title]) => ({ id, title }));
  };
  const countedSubs: Record<SubmissionKind, Array<{ id: string; title: string }>> = {
    lab: countedOf("lab"),
    project: countedOf("project"),
    participation: countedOf("participation"),
  };

  const counted: Record<GradeComponent, Array<{ id: string; title: string }>> = {
    project: countedSubs.project,
    quizzes: satStages.map((s) => ({ id: s.id, title: s.title })),
    exams: satExams,
    labs: countedSubs.lab,
    participation: countedSubs.participation,
  };

  const components: GradebookComponentInfo[] = GradeComponent.options.map((key) => ({
    key,
    label: GRADE_COMPONENT_LABELS[key],
    weight: GRADE_WEIGHTS[key],
    covered: counted[key].length > 0,
    counted: counted[key],
  }));
  const coverage = components.filter((c) => c.covered).reduce((a, c) => a + c.weight, 0);

  /** A student's share of one submission component: handed-in-unmarked is excluded, missing is 0. */
  function submissionComponent(userId: string, kind: SubmissionKind): number | null {
    const marks: number[] = [];
    for (const d of countedSubs[kind]) {
      const row = subBy.get(`${userId}|${d.id}`);
      const mark = row ? markOf(row) : null;
      if (mark !== null) marks.push(mark);
      else if (row && (row.status === "submitted" || row.status === "returned")) continue;
      else marks.push(0);
    }
    const m = mean(marks);
    return m === null ? null : m * 100;
  }

  const students: GradebookStudent[] = input.students.map((st) => {
    const checks: Record<string, number | null> = {};
    for (const s of input.stages) {
      const r = checkBy.get(`${st.userId}|${s.id}`);
      checks[s.id] = r === undefined ? null : round1(r * 100);
    }

    const raw: Record<GradeComponent, number | null> = {
      project: submissionComponent(st.userId, "project"),
      quizzes: satStages.length === 0
        ? null
        : mean(satStages.map((s) => checkBy.get(`${st.userId}|${s.id}`) ?? 0))! * 100,
      exams: satExams.length === 0
        ? null
        : mean(satExams.map((e) => examBy.get(`${st.userId}|${e.id}`) ?? 0))! * 100,
      labs: submissionComponent(st.userId, "lab"),
      participation: submissionComponent(st.userId, "participation"),
    };

    let weighted = 0;
    let weights = 0;
    for (const key of GradeComponent.options) {
      const v = raw[key];
      if (v === null) continue;
      weighted += GRADE_WEIGHTS[key] * v;
      weights += GRADE_WEIGHTS[key];
    }

    const unmarked = live.filter(
      (s) => s.userId === st.userId && (s.status === "submitted" || s.status === "returned"),
    ).length;

    return {
      ...st,
      checks,
      components: Object.fromEntries(
        GradeComponent.options.map((k) => [k, raw[k] === null ? null : round1(raw[k]!)]),
      ) as Record<GradeComponent, number | null>,
      unmarked,
      final: weights === 0 ? null : round1(weighted / weights),
    };
  });

  const avg = (xs: Array<number | null>): number | null => {
    const m = mean(xs.filter((x): x is number => x !== null));
    return m === null ? null : round1(m);
  };

  return {
    components,
    coverage,
    stages: input.stages.map((s) => ({ id: s.id, title: s.title })),
    students,
    classAverage: {
      checks: Object.fromEntries(input.stages.map((s) => [s.id, avg(students.map((x) => x.checks[s.id] ?? null))])),
      components: Object.fromEntries(
        GradeComponent.options.map((k) => [k, avg(students.map((x) => x.components[k] ?? null))]),
      ) as Record<GradeComponent, number | null>,
      final: avg(students.map((x) => x.final)),
    },
    awaitingMarking: live.filter((s) => s.status === "submitted").length,
  };
}

/**
 * The export. One escaping implementation, here: a student named
 * `Dela Cruz, Juan` has a comma in their name, and a gradebook that splits them
 * across two columns is a grading incident, not a formatting bug.
 *
 * A stage check not sat is an EMPTY cell, never 0 (instructor, 28 Sep 2026).
 * Each component column carries its weight in its name, so the file explains
 * itself without a comment line a spreadsheet would read as a student.
 */
export function toCsv(g: Gradebook): string {
  const escape = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cell = (n: number | null, digits: number): string => (n === null ? "" : n.toFixed(digits));

  const header = [
    "student_id", "full_name", "section",
    ...g.stages.map((s) => `stage_${s.id}`),
    ...g.components.map((c) => `${c.key}_${c.weight}`),
    "final_so_far", "grade_covered_pct",
  ];
  const lines = [header.join(",")];
  for (const s of g.students) {
    lines.push([
      escape(s.studentId), escape(s.fullName), escape(s.section ?? ""),
      ...g.stages.map((st) => cell(s.checks[st.id] ?? null, 0)),
      ...g.components.map((c) => cell(s.components[c.key] ?? null, 1)),
      cell(s.final, 1), String(g.coverage),
    ].join(","));
  }
  return lines.join("\n");
}
