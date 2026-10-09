import type { Db } from "../db.js";
import type { GradebookInput } from "./compute.js";
import { sectionFilter, type StaffScope } from "../scope.js";

/**
 * Reads everything the gradebook counts, and decides nothing.
 *
 * The rules live in `compute.ts`, where they are unit-tested; this file only
 * fetches rows. Staff-only by its callers (`requireStaff()`), and it runs as
 * the API's own connection, the same read `ai_after_submit` grants staff.
 *
 * T2 (9 Oct 2026): only the students of the classes the actor reads, and only the exam columns that
 * apply to them (a shared paper, or one made for a section they read). Every other query is cut to
 * those students, so nothing about another teacher's class reaches the computation.
 */
export async function loadGradebookInput(db: Db, scope: StaffScope): Promise<GradebookInput> {
  const sp: unknown[] = [];
  const reach = sectionFilter(scope, "read", "p.section_id", sp);
  const students = await db.query(
    `select p.id as user_id, p.student_id, p.full_name, s.code as section
       from profiles p
       left join sections s on s.id = p.section_id
      where p.student_id is not null and p.deleted_at is null and ${reach}
      order by p.student_id`,
    sp,
  );
  const ids = students.rows.map((r) => r.user_id as string);
  const ap: unknown[] = [];
  const examReach = sectionFilter(scope, "read", "a.section_id", ap);
  const [stages, checks, exams, examScores, submissions, moons, moonScores] = await Promise.all([
    db.query("select id, title from stages where gradeable order by ordinal"),
    // A row with attempts = 0 was never sat; `mastery` is the best check ratio.
    db.query("select user_id, stage_id, mastery from stage_progress where attempts > 0 and user_id = any($1::uuid[])", [ids]),
    // A final blueprint's `by_act` key IS its grading period: Prelim is act 1.
    db.query(
      `select a.id, a.title
         from assessments a
         join blueprints b on b.id = a.blueprint_id
        where b.scope = 'final' and (a.section_id is null or ${examReach})
        order by (select min(k::int) from jsonb_object_keys(coalesce(b.constraints->'by_act', '{}'::jsonb)) k)
                 nulls last, a.opens_at nulls last, a.title`,
      ap,
    ),
    db.query(
      `select at.user_id, at.assessment_id, at.score / at.max_score as ratio
         from attempts at
         join assessments a on a.id = at.assessment_id
         join blueprints b on b.id = a.blueprint_id
        where b.scope = 'final' and at.status = 'submitted' and at.max_score > 0
          and at.user_id = any($1::uuid[])`,
      [ids],
    ),
    db.query("select user_id, kind, slug, title, status, score, max_score from submissions where user_id = any($1::uuid[])", [ids]),
    // The GRADED moons (docs/GRADED-MOONS-PLAN.md): live, of a gradeable stage, switched on.
    db.query(
      `select o.id, o.description
         from live_objectives o join stages s on s.id = o.stage_id
        where o.graded and s.gradeable
        order by s.ordinal, split_part(o.id, '.', 1), nullif(split_part(o.id, '.', 2), '')::int`,
    ),
    // The best SUBMITTED sitting of each moon check; an open or voided one scores nothing.
    db.query(
      `select at.user_id, b.objective_id, at.score / at.max_score as ratio
         from attempts at
         join assessments a on a.id = at.assessment_id
         join blueprints b on b.id = a.blueprint_id
        where b.scope = 'moon' and at.status = 'submitted' and at.max_score > 0
          and at.user_id = any($1::uuid[])`,
      [ids],
    ),
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
    moons: moons.rows.map((r) => ({ id: r.id as string, title: `Moon ${r.id as string}` })),
    moonScores: moonScores.rows.map((r) => ({
      userId: r.user_id as string, objectiveId: r.objective_id as string, ratio: Number(r.ratio),
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
