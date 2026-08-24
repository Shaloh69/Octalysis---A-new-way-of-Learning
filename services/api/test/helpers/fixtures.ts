import { setup } from "./rls.js";

/**
 * Fixture world for the RLS suite.
 *
 * Deliberately shaped so every denial in docs/AUDITS.md §3.1 has something real
 * to be denied. In particular there is a stage that is unlocked, a stage that is
 * locked by prerequisite, a stage that is unpublished, an attempt that is
 * in-progress, and an attempt that is submitted — because "the key is hidden"
 * and "the key is visible after submit" are the same query with different state.
 */

export interface World {
  sectionId: string;
  otherSectionId: string;
  studentA: string;
  studentB: string;
  teacher: string;
  /** Prereq-free, published: studentA can read it. */
  unlockedStage: string;
  /** Prereq 03+04 at 70%, studentA has no mastery: locked. */
  lockedStage: string;
  /** published = false: nobody but staff sees it, regardless of locks. */
  unpublishedStage: string;
  itemId: string;
  practiceAssessmentId: string;
  finalAssessmentId: string;
  inProgressAttemptId: string;
  submittedAttemptId: string;
  finalAttemptId: string;
  /** The literal answer key value stored on the in-progress attempt. */
  secretAnswer: string;
  examSalt: string;
}

export async function resetWorld(): Promise<World> {
  // `responses` is append-only for everyone, service_role included, so an
  // ordinary DELETE here raises. That is the design working: history cannot be
  // rewritten, and the supported deactivation path is profiles.deleted_at (V-20).
  //
  // A test fixture is the one legitimate exception, so it takes the documented
  // maintenance escape -- session_replication_role = 'replica' suspends user
  // triggers (and FK triggers) for this session only. It is deliberate, it is
  // scoped to teardown, and it is restored immediately below.
  //
  // Never use this outside a fixture. If production ever needs it, that is a
  // decision with an audit_log entry, not a convenience.
  await setup(`
    set session_replication_role = 'replica';

    delete from responses      where true;
    delete from attempt_items  where true;
    delete from attempts       where true;
    delete from assessment_secrets where true;
    delete from assessments    where true;
    delete from item_stats     where true;
    delete from items          where true;
    delete from content_blocks where true;
    delete from stage_locks    where true;
    delete from stage_progress where true;
    delete from level_progress where true;
    delete from profiles       where true;
    delete from student_directory where true;
    delete from sections       where true;
    delete from stages         where id = '99';
    delete from auth.users     where true;

    set session_replication_role = 'origin';
  `);

  const secretAnswer = "An assembler";
  const examSalt = "fixture-salt-do-not-use-in-production-0000";

  const { rows } = await setup(
    `
    with
    sec as (
      insert into sections (code, term) values ('BSCPE-2A','2026-1'), ('BSCPE-2B','2026-1')
      returning id, code
    ),
    ua as ( select auth.test_create_user('a@test.local','student') as id ),
    ub as ( select auth.test_create_user('b@test.local','student') as id ),
    ut as ( select auth.test_create_user('t@test.local','teacher') as id ),
    dir as (
      insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
      select '21-0001','Student A',(select id from sec where code='BSCPE-2A'),'claimed'::claim_status,(select id from ua), now()
      union all
      select '21-0002','Student B',(select id from sec where code='BSCPE-2A'),'claimed'::claim_status,(select id from ub), now()
      returning student_id
    ),
    prof as (
      insert into profiles (id, student_id, full_name, section_id, role)
      select (select id from ua), '21-0001','Student A',(select id from sec where code='BSCPE-2A'),'student'::user_role
      union all
      select (select id from ub), '21-0002','Student B',(select id from sec where code='BSCPE-2A'),'student'::user_role
      union all
      select (select id from ut), null,      'Instructor',(select id from sec where code='BSCPE-2A'),'teacher'::user_role
      returning id
    ),
    -- An unpublished stage. Every seeded stage is published, and "unlocked" is
    -- not the same as "published" (V-7) -- so we need one to prove it.
    unpub as (
      insert into stages (id, act, ordinal, title, est_minutes, prereq, published, gradeable, archetype, levels)
      values ('99', 4, 99, 'Unpublished Draft', 30, '{}', false, true, 'A', '{6}')
      returning id
    ),
    itm as (
      insert into items (slug, stage_id, type, status, version, bloom, stem_template, correct_spec, distractor_pool, reviewed_by, reviewed_at)
      values ('S-03-assembler','03','S','live',1,'understand',
              'Which converts assembly mnemonics into machine code?',
              jsonb_build_object('value', $1::text),
              '["A compiler","An interpreter","A linker","The control unit"]'::jsonb,
              (select id from ut), now())
      returning id
    ),
    bp_practice as (
      insert into blueprints (name, scope, stage_id, total_items, constraints)
      values ('Stage 03 Check','stage','03',1,'{"by_type":{"S":1}}'::jsonb)
      returning id
    ),
    bp_final as (
      insert into blueprints (name, scope, total_items, constraints)
      values ('Power-On Self Test','final',1,'{"by_type":{"S":1}}'::jsonb)
      returning id
    ),
    a_practice as (
      insert into assessments (blueprint_id, section_id, title)
      values ((select id from bp_practice), (select id from sec where code='BSCPE-2A'), 'Stage 03 Check')
      returning id
    ),
    a_final as (
      insert into assessments (blueprint_id, section_id, title)
      values ((select id from bp_final), (select id from sec where code='BSCPE-2A'), 'Power-On Self Test')
      returning id
    ),
    secrets as (
      insert into assessment_secrets (assessment_id, exam_salt)
      values ((select id from a_practice), $2::text),
             ((select id from a_final),    $2::text)
      returning assessment_id
    ),
    at_prog as (
      insert into attempts (user_id, assessment_id, attempt_no, seed, status)
      values ((select id from ua), (select id from a_practice), 1, 'seed-in-progress', 'in_progress')
      returning id
    ),
    at_sub as (
      insert into attempts (user_id, assessment_id, attempt_no, seed, status, score, max_score, submitted_at)
      values ((select id from ua), (select id from a_practice), 2, 'seed-submitted', 'submitted', 1, 1, now())
      returning id
    ),
    at_final as (
      insert into attempts (user_id, assessment_id, attempt_no, seed, status)
      values ((select id from ua), (select id from a_final), 1, 'seed-final', 'in_progress')
      returning id
    ),
    ai as (
      insert into attempt_items (attempt_id, ordinal, item_id, resolved_options, correct_value)
      values ((select id from at_prog), 1, (select id from itm),
              '["An assembler","A compiler","A linker"]'::jsonb, jsonb_build_object('value',$1::text)),
             ((select id from at_sub), 1, (select id from itm),
              '["An assembler","A compiler","A linker"]'::jsonb, jsonb_build_object('value',$1::text)),
             ((select id from at_final), 1, (select id from itm),
              '["An assembler","A compiler","A linker"]'::jsonb, jsonb_build_object('value',$1::text))
      returning attempt_id
    ),
    resp as (
      insert into responses (attempt_id, ordinal, raw_answer, is_correct, points)
      values ((select id from at_prog),  1, '{"value":"A compiler"}'::jsonb, false, 0),
             ((select id from at_final), 1, '{"value":"A compiler"}'::jsonb, false, 0)
      returning attempt_id
    ),
    cb as (
      insert into content_blocks (stage_id, ordinal, kind, body_md)
      values ('00', 1, 'prose', 'Welcome to the boot sequence.'),
             ('05', 1, 'prose', 'Locked content a student must not read.'),
             ('99', 1, 'prose', 'Unpublished draft content.')
      returning id
    )
    select
      (select id from sec where code='BSCPE-2A') as section_id,
      (select id from sec where code='BSCPE-2B') as other_section_id,
      (select id from ua) as student_a,
      (select id from ub) as student_b,
      (select id from ut) as teacher,
      (select id from itm) as item_id,
      (select id from a_practice) as practice_assessment_id,
      (select id from a_final) as final_assessment_id,
      (select id from at_prog) as in_progress_attempt_id,
      (select id from at_sub) as submitted_attempt_id,
      (select id from at_final) as final_attempt_id
    `,
    [secretAnswer, examSalt],
  );

  const r = rows[0] as Record<string, string>;

  return {
    sectionId: r.section_id!,
    otherSectionId: r.other_section_id!,
    studentA: r.student_a!,
    studentB: r.student_b!,
    teacher: r.teacher!,
    unlockedStage: "00",
    lockedStage: "05",
    unpublishedStage: "99",
    itemId: r.item_id!,
    practiceAssessmentId: r.practice_assessment_id!,
    finalAssessmentId: r.final_assessment_id!,
    inProgressAttemptId: r.in_progress_attempt_id!,
    submittedAttemptId: r.submitted_attempt_id!,
    finalAttemptId: r.final_attempt_id!,
    secretAnswer,
    examSalt,
  };
}
