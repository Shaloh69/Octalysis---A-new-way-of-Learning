import type { Db } from "../db.js";
import type { GradebookInput } from "./compute.js";

/**
 * Reads everything the gradebook counts, and decides nothing.
 *
 * The rules live in `compute.ts`, where they are unit-tested; this file only
 * fetches rows. Staff-only by its callers (`requireStaff()`), and it runs as
 * the API's own connection, the same read `ai_after_submit` grants staff.
 */
export async function loadGradebookInput(db: Db): Promise<GradebookInput> {
  const [stages, students, checks, exams, examScores, submissions] = await Promise.all([
    db.query("select id, title from stages where gradeable order by ordinal"),
    db.query(
      `select p.id as user_id, p.student_id, p.full_name, s.code as section
         from profiles p
         left join sections s on s.id = p.section_id
        where p.student_id is not null and p.deleted_at is null
        order by p.student_id`,
    ),
    // A row with attempts = 0 was never sat; `mastery` is the best check ratio.
    db.query("select user_id, stage_id, mastery from stage_progress where attempts > 0"),
    // A final blueprint's `by_act` key IS its grading period: Prelim is act 1.
    db.query(
      `select a.id, a.title
         from assessments a
         join blueprints b on b.id = a.blueprint_id
        where b.scope = 'final'
        order by (select min(k::int) from jsonb_object_keys(coalesce(b.constraints->'by_act', '{}'::jsonb)) k)
                 nulls last, a.opens_at nulls last, a.title`,
    ),
    db.query(
      `select at.user_id, at.assessment_id, at.score / at.max_score as ratio
         from attempts at
         join assessments a on a.id = at.assessment_id
         join blueprints b on b.id = a.blueprint_id
        where b.scope = 'final' and at.status = 'submitted' and at.max_score > 0`,
    ),
    db.query("select user_id, kind, slug, title, status, score, max_score from submissions"),
  ]);

  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

  return {
    stages: stages.rows.map((r) => ({ id: r.id as string, title: r.title as string })),
    students: students.rows.map((r) => ({
      userId: r.user_id as string,
      studentId: r.student_id as string,
      fullName: r.full_name as string,
      section: (r.section as string | null) ?? null,
    })),
    checks: checks.rows.map((r) => ({
      userId: r.user_id as string, stageId: r.stage_id as string, ratio: Number(r.mastery),
    })),
    exams: exams.rows.map((r) => ({ id: r.id as string, title: r.title as string })),
    examScores: examScores.rows.map((r) => ({
      userId: r.user_id as string, assessmentId: r.assessment_id as string, ratio: Number(r.ratio),
    })),
    submissions: submissions.rows.map((r) => ({
      userId: r.user_id as string,
      kind: r.kind as GradebookInput["submissions"][number]["kind"],
      slug: r.slug as string,
      title: r.title as string,
      status: r.status as GradebookInput["submissions"][number]["status"],
      score: num(r.score),
      maxScore: num(r.max_score),
    })),
  };
}
