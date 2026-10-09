import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runAs,
  setup,
  anon,
  authenticated,
  denialReason,
  closePool,
  type Actor,
  type QueryResult,
} from "./helpers/rls.js";
import type { World } from "./helpers/fixtures.js";
import { seedScopeWorld, ALL, type Key, type Seeded } from "./helpers/scope-world.js";

/**
 * T2: a teacher holds their own classes (docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5;
 * db/addendum-class-scope.sql).
 *
 * The rule, asked of the database by every student-data policy:
 *   READ   a section's students: the actor holds a class on the section (ended or not), or is the admin.
 *   WRITE  a section's students: the actor holds a class on the section and it has NOT ended.
 *          The admin has no write on a class they do not hold.
 *   A global lock is written by no staff token at all.
 *
 * Four classes, four staff accounts, four students, so every cell of the matrix has someone to be
 * denied: teacher A (holds A), teacher B (holds B), an ENDED class held by teacher E, the admin's own
 * class D, and a teacher who holds nothing. Hard rule 8: watched red first, 9 Oct 2026, against a
 * database without the addendum (every policy still said is_staff()).
 */

let w: World;
const actors: Record<string, Actor> = {};
const st = {} as Record<Key, Seeded>;

/** Who may READ whose rows (the admin reads every section's). */
const READS: Record<string, Key[]> = {
  teacherA: ["A"],
  teacherB: ["B"],
  teacherEnded: ["E"],
  admin: ["A", "B", "E", "D"],
  teacherNone: [],
  studentA: [],
  anon: [],
};

/** Who may WRITE whose rows: holds the class and it has not ended. The admin writes only their own. */
const WRITES: Record<string, Key[]> = {
  teacherA: ["A"],
  teacherB: ["B"],
  teacherEnded: [],
  admin: ["D"],
  teacherNone: [],
  studentA: [],
  anon: [],
};

function readable(res: QueryResult): boolean {
  if (res.error?.code === "42P01" || res.error?.code === "42883") {
    throw new Error(`a missing table or function proves nothing: ${res.error.message}`);
  }
  return res.error === null && res.rowCount > 0;
}

beforeAll(async () => {
  const sw = await seedScopeWorld();
  w = sw.w;
  Object.assign(st, sw.st);
  actors.teacherA = authenticated(w.teacher, "teacher", "teacherA");
  actors.teacherB = authenticated(sw.teacherBId, "teacher", "teacherB");
  actors.teacherEnded = authenticated(sw.teacherEId, "teacher", "teacherEnded");
  actors.teacherNone = authenticated(sw.teacherNoneId, "teacher", "teacherNone");
  actors.admin = authenticated(sw.adminId, "admin", "admin");
  actors.studentA = authenticated(w.studentA, "student", "studentA");
  actors.anon = anon;
});

afterAll(async () => {
  await closePool();
});

/** Each read is a query for ONE student's rows. */
const READ_CASES: Array<{ table: string; sql: string; param: (s: Seeded) => string }> = [
  { table: "profiles", sql: "select id from profiles where id = $1", param: (s) => s.user },
  { table: "student_directory", sql: "select student_id from student_directory where claimed_by = $1", param: (s) => s.user },
  { table: "attempts", sql: "select id from attempts where user_id = $1", param: (s) => s.user },
  { table: "attempt_items", sql: "select attempt_id from attempt_items where attempt_id = $1", param: (s) => s.attempt },
  { table: "responses", sql: "select attempt_id from responses where attempt_id = $1", param: (s) => s.attempt },
  { table: "attempt_events", sql: "select id from attempt_events where attempt_id = $1", param: (s) => s.attempt },
  { table: "stage_progress", sql: "select stage_id from stage_progress where user_id = $1", param: (s) => s.user },
  { table: "level_progress", sql: "select level from level_progress where user_id = $1", param: (s) => s.user },
  { table: "objective_progress", sql: "select ordinal from objective_progress where user_id = $1", param: (s) => s.user },
  { table: "stage_locks (a student's lock)", sql: "select id from stage_locks where scope = 'user' and scope_user_id = $1", param: (s) => s.user },
  { table: "stage_locks (a section's lock)", sql: "select id from stage_locks where scope = 'section' and scope_section_id = $1", param: (s) => s.section },
  { table: "submissions", sql: "select id from submissions where user_id = $1", param: (s) => s.user },
  { table: "live_sessions", sql: "select id from live_sessions where section_id = $1", param: (s) => s.section },
  { table: "live_responses", sql: "select session_id from live_responses where user_id = $1", param: (s) => s.user },
  { table: "chat_rooms (a thread)", sql: "select id from chat_rooms where kind = 'direct' and student_id = $1", param: (s) => s.user },
  { table: "chat_rooms (a section room)", sql: "select id from chat_rooms where kind = 'section' and section_id = $1", param: (s) => s.section },
  { table: "chat_messages", sql: "select id from chat_messages where room_id = $1", param: (s) => s.room },
  { table: "audit_log (an action on a student)", sql: "select id from audit_log where target_type = 'student' and target_id = $1", param: (s) => s.user },
];

describe("the fixture is real: the superuser sees every row the matrix below denies", () => {
  for (const c of READ_CASES) {
    it(`${c.table}: one row for each of the four students`, async () => {
      for (const k of ALL) {
        const r = await setup(c.sql, [c.param(st[k])]);
        expect(r.rowCount, `${c.table} for ${k}`).toBeGreaterThan(0);
      }
    });
  }
});

describe("T2 reads: a teacher reads the students of the classes they hold, ended or not; the admin reads all", () => {
  for (const c of READ_CASES) {
    for (const [name, mayRead] of Object.entries(READS)) {
      for (const k of ALL) {
        if (name === "studentA" && k === "A") continue; // a student's own rows are theirs: other suites own that
        const expected = mayRead.includes(k);
        it(`${c.table}: ${name} ${expected ? "READS" : "is DENIED"} student ${k}`, async () => {
          const res = await runAs(actors[name]!, c.sql, [c.param(st[k])]);
          expect(readable(res), `${name} on ${c.table} for ${k}: ${denialReason(res)}`).toBe(expected);
        });
      }
    }
  }
});

const WRITE_CASES: Array<{ name: string; sql: string; param: (s: Seeded) => string }> = [
  { name: "profiles", sql: "update profiles set full_name = full_name where id = $1 returning id", param: (s) => s.user },
  { name: "student_directory", sql: "update student_directory set full_name = full_name where claimed_by = $1 returning student_id", param: (s) => s.user },
  { name: "attempts", sql: "update attempts set score = score where id = $1 returning id", param: (s) => s.attempt },
  { name: "stage_progress", sql: "update stage_progress set mastery = mastery where user_id = $1 returning stage_id", param: (s) => s.user },
  { name: "level_progress", sql: "update level_progress set mastery = mastery where user_id = $1 returning level", param: (s) => s.user },
  { name: "submissions (the status; a grade itself is the API's, by column grant)", sql: "update submissions set status = status where user_id = $1 returning id", param: (s) => s.user },
  { name: "stage_locks (a student's lock, written)", sql: "insert into stage_locks (scope, scope_user_id, stage_id, state) values ('user', $1, '00', 'locked') returning id", param: (s) => s.user },
  { name: "stage_locks (a section's lock, written)", sql: "insert into stage_locks (scope, scope_section_id, stage_id, state) values ('section', $1, '00', 'locked') returning id", param: (s) => s.section },
  { name: "stage_locks (a student's lock, changed)", sql: "update stage_locks set state = 'locked' where scope = 'user' and scope_user_id = $1 returning id", param: (s) => s.user },
  { name: "sections", sql: "update sections set term = term where id = $1 returning id", param: (s) => s.section },
  { name: "assessments (a section's own)", sql: "insert into assessments (blueprint_id, section_id, title) select id, $1::uuid, 'Make-up' from blueprints limit 1 returning id", param: (s) => s.section },
];

describe("T2 writes: a teacher writes only where their class has not ended; the admin only to their own", () => {
  for (const c of WRITE_CASES) {
    for (const [name, mayWrite] of Object.entries(WRITES)) {
      for (const k of ALL) {
        if (name === "studentA" && k === "A") continue; // a student's own rows are theirs: other suites own that
        const expected = mayWrite.includes(k);
        it(`${c.name}: ${name} ${expected ? "WRITES" : "is DENIED"} student/section ${k}`, async () => {
          const res = await runAs(actors[name]!, c.sql, [c.param(st[k])]);
          expect(readable(res), `${name} on ${c.name} for ${k}: ${denialReason(res)}`).toBe(expected);
        });
      }
    }
  }
});

describe("T2: what no staff token may write", () => {
  it("a GLOBAL stage lock is written by no staff token, the admin's included", async () => {
    for (const name of ["teacherA", "teacherB", "teacherNone", "admin"]) {
      const res = await runAs(
        actors[name]!,
        "insert into stage_locks (scope, stage_id, state) values ('global', '00', 'locked') returning id",
      );
      expect(readable(res), `${name} wrote a global lock`).toBe(false);
    }
  });

  it("a GLOBAL assessment (no section) is written by the admin alone", async () => {
    const sql = "insert into assessments (blueprint_id, section_id, title) select id, null, 'Shared' from blueprints limit 1 returning id";
    expect(readable(await runAs(actors.teacherA!, sql)), "a teacher wrote a shared paper").toBe(false);
    expect(readable(await runAs(actors.teacherNone!, sql)), "a teacher with no class wrote a shared paper").toBe(false);
    const adminRes = await runAs(actors.admin!, sql);
    expect(readable(adminRes), `POSITIVE CONTROL: the admin edits shared papers: ${denialReason(adminRes)}`).toBe(true);
  });

  it("a teacher's own audit rows are theirs to read; another teacher's are not", async () => {
    await setup(`insert into audit_log (actor_id, action, target_type, target_id) values ($1, 'test.own', 'stage', '00')`, [w.teacher]);
    const sql = "select id from audit_log where action = 'test.own'";
    expect(readable(await runAs(actors.teacherA!, sql)), "POSITIVE CONTROL: a teacher reads their own actions").toBe(true);
    expect(readable(await runAs(actors.teacherB!, sql)), "another teacher read someone's actions").toBe(false);
    expect(readable(await runAs(actors.admin!, sql)), "the admin reads everything").toBe(true);
  });

  it("an ended class: still read, no longer written (the same student, the same teacher)", async () => {
    const read = await runAs(actors.teacherEnded!, "select id from attempts where user_id = $1", [st.E.user]);
    const write = await runAs(actors.teacherEnded!, "update stage_progress set mastery = 1 where user_id = $1 returning stage_id", [st.E.user]);
    expect(readable(read), "POSITIVE CONTROL: an ended class is read-only, not blind").toBe(true);
    expect(readable(write), "an ended class wrote a student's progress").toBe(false);
  });

  it("a student moved to another section leaves the old teacher's view at once", async () => {
    await setup(`update profiles set section_id = $2 where id = $1`, [st.A.user, st.B.section]);
    try {
      expect(readable(await runAs(actors.teacherA!, "select id from attempts where user_id = $1", [st.A.user])), "the old teacher still reads them").toBe(false);
      expect(readable(await runAs(actors.teacherB!, "select id from attempts where user_id = $1", [st.A.user])), "POSITIVE CONTROL: the new teacher reads them").toBe(true);
    } finally {
      await setup(`update profiles set section_id = $2 where id = $1`, [st.A.user, st.A.section]);
    }
  });

  it("a teacher with no class reads no student, and a staff colleague's profile is still readable", async () => {
    const students = await runAs(actors.teacherNone!, "select id from profiles where role = 'student'");
    expect(readable(students), "a teacher with no class read a student").toBe(false);
    const staff = await runAs(actors.teacherNone!, "select id from profiles where role in ('teacher','admin')");
    expect(readable(staff), "POSITIVE CONTROL: staff see staff (names in the chat)").toBe(true);
  });
});
