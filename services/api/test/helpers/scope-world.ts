import { setup, pool } from "./rls.js";
import { resetWorld, type World } from "./fixtures.js";

/**
 * The world T2's two suites share (class-scope-rls.spec.ts, class-scope-api.spec.ts).
 *
 * Four classes, five staff accounts, four students, so every cell of the matrix has someone to be
 * denied: teacher A holds BSCPE-2A (the fixture's own, with students A and B... A carries the extra
 * rows), teacher B holds SCOPE-B, an ENDED class held by teacher E, the admin's own class D, and a
 * teacher who holds nothing.
 */

export type Key = "A" | "B" | "E" | "D";

export interface Seeded {
  user: string;
  section: string;
  attempt: string;
  room: string;
}

export interface ScopeWorld {
  w: World;
  st: Record<Key, Seeded>;
  adminId: string;
  teacherBId: string;
  teacherEId: string;
  teacherNoneId: string;
}

export const ALL: Key[] = ["A", "B", "E", "D"];

let adminIdRef = "";
let wRef!: World;

async function seedStudent(key: Key, code: string, ended: boolean, holder: string): Promise<Seeded> {
  const sec = (
    await setup(`insert into sections (code, term) values ($1, '2026-1') returning id::text`, [code])
  ).rows[0]!.id as string;
  const u = (
    await setup(
      `insert into auth.users (id, email, raw_app_meta_data)
       values (gen_random_uuid(), $1, '{"role":"student"}'::jsonb) returning id::text`,
      [`${key.toLowerCase()}-scope@octa-test.local`],
    )
  ).rows[0]!.id as string;
  await setup(
    `insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
     values ($1, $2, $3, 'claimed', $4, now())`,
    [`22-90${key.charCodeAt(0)}`, `Student ${key}`, sec, u],
  );
  await setup(
    `insert into profiles (id, student_id, full_name, section_id, role)
     values ($1, $2, $3, $4, 'student'::user_role)`,
    [u, `22-90${key.charCodeAt(0)}`, `Student ${key}`, sec],
  );
  await setup(
    `insert into classes (section_id, subject_code, teacher_id, term, ended_at)
     values ($1, 'CPE 412', $2, '2026-1', case when $3::boolean then now() end)`,
    [sec, holder, ended],
  );
  const at = (
    await setup(
      `insert into attempts (user_id, assessment_id, attempt_no, seed, status, score, max_score, submitted_at)
       values ($1, $2, 7, $3, 'submitted', 1, 1, now()) returning id::text`,
      [u, wRef.practiceAssessmentId, `seed-${key}`],
    )
  ).rows[0]!.id as string;
  await setup(
    `insert into attempt_items (attempt_id, ordinal, item_id, resolved_options, correct_value)
     values ($1, 1, $2, '["x","y"]'::jsonb, '{"value":"x"}'::jsonb)`,
    [at, wRef.itemId],
  );
  await setup(
    `insert into responses (attempt_id, ordinal, raw_answer, is_correct, points)
     values ($1, 1, '{"value":"x"}'::jsonb, true, 1)`,
    [at],
  );
  await setup(`insert into attempt_events (attempt_id, kind) values ($1, 'left_page')`, [at]);
  await setup(`insert into stage_progress (user_id, stage_id, mastery, attempts) values ($1, '00', 0.5, 1)`, [u]);
  await setup(`insert into level_progress (user_id, level, competency, mastery) values ($1, 0, 'read', 0.5)`, [u]);
  await setup(
    `insert into stage_locks (scope, scope_user_id, stage_id, state) values ('user', $1, '05', 'unlocked')`,
    [u],
  );
  await setup(
    `insert into stage_locks (scope, scope_section_id, stage_id, state) values ('section', $1, '05', 'unlocked')`,
    [sec],
  );
  await setup(
    `insert into submissions (user_id, kind, slug, title, status, submitted_at)
     values ($1, 'lab', 'lab-1', 'Lab 1', 'submitted', now())`,
    [u],
  );
  await setup(
    `insert into audit_log (actor_id, action, target_type, target_id) values ($1, 'test.touch', 'student', $2)`,
    [adminIdRef, u],
  );
  const room = (
    await setup(`insert into chat_rooms (kind, student_id) values ('direct', $1) returning id::text`, [u])
  ).rows[0]!.id as string;
  await setup(`insert into chat_rooms (kind, section_id) values ('section', $1)`, [sec]);
  await setup(`insert into chat_messages (room_id, author_id, body) values ($1, $2, 'hello')`, [room, u]);

  // Rows whose own triggers refuse a bare insert (a mastery needs a correct counting answer; a live
  // answer needs an open session) are seeded with triggers off, in one transaction.
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local session_replication_role = replica");
    const fam = (await c.query(`select family_id::text from items where id = $1`, [wRef.itemId])).rows[0]!.family_id;
    await c.query(
      `insert into objective_progress (attempt_id, ordinal, user_id, objective_id, family_id)
       values ($1, 1, $2, '03.1', $3)`,
      [at, u, fam],
    );
    const ls = (
      await c.query(
        `insert into live_sessions (item_id, section_id, started_by, ended_by, ended_at)
         values ($1, $2, $3, $3, now()) returning id::text`,
        [wRef.itemId, sec, adminIdRef],
      )
    ).rows[0]!.id as string;
    await c.query(`insert into live_responses (session_id, user_id, raw_answer, is_correct) values ($1, $2, '{"v":1}', true)`, [ls, u]);
    await c.query("commit");
  } finally {
    c.release();
  }
  return { user: u, section: sec, attempt: at, room };
}


export async function seedScopeWorld(): Promise<ScopeWorld> {
  const st = {} as Record<Key, Seeded>;
  const w = await resetWorld();
  wRef = w;
  const ids = await setup(
    `insert into auth.users (id, email, raw_app_meta_data) values
       (gen_random_uuid(), 'admin-scope@octa-test.local',  '{"role":"admin"}'::jsonb),
       (gen_random_uuid(), 'tb-scope@octa-test.local',     '{"role":"teacher"}'::jsonb),
       (gen_random_uuid(), 'te-scope@octa-test.local',     '{"role":"teacher"}'::jsonb),
       (gen_random_uuid(), 'tn-scope@octa-test.local',     '{"role":"teacher"}'::jsonb)
     returning id::text`,
  );
  const [admin, tb, te, tn] = ids.rows.map((r) => r.id as string) as [string, string, string, string];
  adminIdRef = admin;
  await setup(
    `insert into profiles (id, full_name, role) values
       ($1, 'The Admin', 'admin'::user_role), ($2, 'Teacher B', 'teacher'::user_role),
       ($3, 'Teacher E', 'teacher'::user_role), ($4, 'Teacher None', 'teacher'::user_role)`,
    [admin, tb, te, tn],
  );

  // Student A is the world's own (section BSCPE-2A, held by w.teacher): give them the same extra rows.
  const secA = w.sectionId;
  const aAttempt = (
    await setup(
      `insert into attempts (user_id, assessment_id, attempt_no, seed, status, score, max_score, submitted_at)
       values ($1, $2, 7, 'seed-A', 'submitted', 1, 1, now()) returning id::text`,
      [w.studentA, w.practiceAssessmentId],
    )
  ).rows[0]!.id as string;
  await setup(
    `insert into attempt_items (attempt_id, ordinal, item_id, resolved_options, correct_value)
     values ($1, 1, $2, '["x","y"]'::jsonb, '{"value":"x"}'::jsonb)`,
    [aAttempt, w.itemId],
  );
  await setup(
    `insert into responses (attempt_id, ordinal, raw_answer, is_correct, points) values ($1, 1, '{"value":"x"}'::jsonb, true, 1)`,
    [aAttempt],
  );
  await setup(`insert into attempt_events (attempt_id, kind) values ($1, 'left_page')`, [aAttempt]);
  await setup(`insert into stage_progress (user_id, stage_id, mastery, attempts) values ($1, '00', 0.5, 1)`, [w.studentA]);
  await setup(`insert into level_progress (user_id, level, competency, mastery) values ($1, 0, 'read', 0.5)`, [w.studentA]);
  await setup(`insert into stage_locks (scope, scope_user_id, stage_id, state) values ('user', $1, '05', 'unlocked')`, [w.studentA]);
  await setup(`insert into stage_locks (scope, scope_section_id, stage_id, state) values ('section', $1, '05', 'unlocked')`, [secA]);
  await setup(
    `insert into submissions (user_id, kind, slug, title, status, submitted_at) values ($1, 'lab', 'lab-1', 'Lab 1', 'submitted', now())`,
    [w.studentA],
  );
  await setup(`insert into audit_log (actor_id, action, target_type, target_id) values ($1, 'test.touch', 'student', $2)`, [admin, w.studentA]);
  await setup(`insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
               values ('22-90065', 'Student A', $1, 'claimed', $2, now())`, [secA, w.studentA]);
  const aRoom = (await setup(`insert into chat_rooms (kind, student_id) values ('direct', $1) returning id::text`, [w.studentA])).rows[0]!.id as string;
  await setup(`insert into chat_rooms (kind, section_id) values ('section', $1)`, [secA]);
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local session_replication_role = replica");
    const fam = (await c.query(`select family_id::text from items where id = $1`, [w.itemId])).rows[0]!.family_id;
    // The world's student has a paper open, which closes the chat for a student: seeded with triggers off.
    await c.query(`insert into chat_messages (room_id, author_id, body) values ($1, $2, 'hello')`, [aRoom, w.studentA]);
    await c.query(`insert into objective_progress (attempt_id, ordinal, user_id, objective_id, family_id) values ($1, 1, $2, '03.1', $3)`, [aAttempt, w.studentA, fam]);
    const ls = (await c.query(`insert into live_sessions (item_id, section_id, started_by, ended_by, ended_at) values ($1, $2, $3, $3, now()) returning id::text`, [w.itemId, secA, admin])).rows[0]!.id as string;
    await c.query(`insert into live_responses (session_id, user_id, raw_answer, is_correct) values ($1, $2, '{"v":1}', true)`, [ls, w.studentA]);
    await c.query("commit");
  } finally {
    c.release();
  }
  st.A = { user: w.studentA, section: secA, attempt: aAttempt, room: aRoom };
  st.B = await seedStudent("B", "SCOPE-B", false, tb);
  st.E = await seedStudent("E", "SCOPE-E", true, te);
  st.D = await seedStudent("D", "SCOPE-D", false, admin);

  return { w, st, adminId: admin, teacherBId: tb, teacherEId: te, teacherNoneId: tn };
}
