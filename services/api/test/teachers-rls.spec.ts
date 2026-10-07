import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runAs,
  setup,
  anon,
  authenticated,
  service,
  denialReason,
  closePool,
  type Actor,
  type QueryResult,
} from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Teachers, subjects and classes (T1; docs/TEACHERS-AND-SUBJECTS-PLAN.md;
 * db/addendum-teachers.sql).
 *
 * The admin alone reads the teacher roster; no client role writes the roster,
 * a subject, a book or a class (every write is the API's, as `requireAdmin()`);
 * a teacher reads their own classes, a student their section's; a class's
 * teacher is a staff account and its book is one of its subject's books.
 *
 * Every denial has its positive control, and a missing table is NOT a denial
 * (42P01 proves nothing). Hard rule 8: watched red first, 7 Oct 2026 (night):
 * before the addendum every positive control failed on a missing table.
 */

function denied(res: QueryResult): boolean {
  if (res.error?.code === "42P01" || res.error?.code === "42883") return false; // missing table / function
  return res.error !== null || res.rowCount === 0;
}

let w: World;
let admin: Actor;
let teacherA: Actor;
let teacherB: Actor;
let student: Actor;
let adminId = "";
let idB = "";
let sectionA = "";
let sectionB = "";
let bookDefault = "";

beforeAll(async () => {
  w = await resetWorld();
  const ids = await setup(
    `insert into auth.users (id, email, raw_app_meta_data) values
       (gen_random_uuid(), 'admin@octa-test.local', '{"role":"admin"}'::jsonb),
       (gen_random_uuid(), 't2@octa-test.local', '{"role":"teacher"}'::jsonb)
     returning id::text`,
  );
  [adminId, idB] = ids.rows.map((r) => r.id as string) as [string, string];
  await setup(
    `insert into profiles (id, full_name, role) values ($1, 'The Admin', 'admin'::user_role), ($2, 'Teacher B', 'teacher'::user_role)`,
    [adminId, idB],
  );
  const secs = await setup(`select id::text, code from sections order by code`);
  sectionA = secs.rows.find((r) => r.code === "BSCPE-2A")!.id as string;
  sectionB = secs.rows.find((r) => r.code === "BSCPE-2B")!.id as string;

  // Everything below exists only once the addendum is applied; before it, the
  // fixtures fail and every positive control below fails with them.
  try {
    const b = await setup(`select id::text from subject_books where subject_code = 'CPE 412' and is_default`);
    bookDefault = (b.rows[0]?.id as string | undefined) ?? "";
    await setup(
      `insert into teacher_directory (employee_id, full_name, email, role) values
         ('EMP-0001', 'Teacher A', 't@octa-test.local', 'teacher'),
         ('EMP-0002', 'Teacher B', 't2@octa-test.local', 'teacher')`,
    );
    await setup(
      `insert into classes (section_id, subject_code, teacher_id, term) values
         ($1, 'CPE 412', $3, '2026-1'), ($2, 'CPE 412', $4, '2026-1')`,
      [sectionA, sectionB, w.teacher, idB],
    );
  } catch {
    /* red run: no schema yet */
  }

  admin = authenticated(adminId, "admin", "admin");
  teacherA = authenticated(w.teacher, "teacher", "teacherA");
  teacherB = authenticated(idB, "teacher", "teacherB");
  student = authenticated(w.studentA, "student", "student");
}, 60_000);

afterAll(async () => {
  await closePool();
});

describe("the teacher roster is the admin's alone", () => {
  it("denies a teacher every roster row", async () => {
    const res = await runAs(teacherA, "select employee_id from teacher_directory");
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies a student and anon every roster row", async () => {
    for (const who of [student, anon]) {
      const res = await runAs(who, "select employee_id from teacher_directory");
      expect(denied(res), `${who.label}: ${denialReason(res)}`).toBe(true);
    }
  });
  it("denies a teacher adding themselves to the roster", async () => {
    const res = await runAs(
      teacherA,
      "insert into teacher_directory (employee_id, full_name, role) values ('EMP-9999', 'Me', 'admin') returning employee_id",
    );
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies even the admin a direct write: the roster changes only through the API", async () => {
    const res = await runAs(admin, "update teacher_directory set role = 'admin' where employee_id = 'EMP-0002' returning employee_id");
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("POSITIVE CONTROL: the admin reads every roster row", async () => {
    const res = await runAs(admin, "select employee_id from teacher_directory order by 1");
    expect(res.error).toBeNull();
    expect(res.rows.map((r) => r.employee_id)).toEqual(["EMP-0001", "EMP-0002"]);
  });
  it("is_admin() is true for the admin only", async () => {
    for (const [who, want] of [[admin, true], [teacherA, false], [student, false]] as const) {
      const res = await runAs(who, "select is_admin() as a");
      expect(res.error, denialReason(res)).toBeNull();
      expect(res.rows[0]!.a, who.label).toBe(want);
    }
  });
});

describe("classes: a teacher sees their own, a student their section's", () => {
  it("denies teacher A teacher B's class", async () => {
    const res = await runAs(teacherA, "select id from classes where teacher_id = $1", [idB]);
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies a student a class of another section", async () => {
    const res = await runAs(student, "select id from classes where section_id = $1", [sectionB]);
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies anon every class", async () => {
    const res = await runAs(anon, "select id from classes");
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies a teacher making a class, and a student", async () => {
    for (const who of [teacherA, student]) {
      const res = await runAs(
        who,
        "insert into classes (section_id, subject_code, teacher_id, term) values ($1, 'CPE 412', $2, '2026-2') returning id",
        [sectionA, w.teacher],
      );
      expect(denied(res), `${who.label}: ${denialReason(res)}`).toBe(true);
    }
  });
  it("denies a teacher moving a class onto themselves", async () => {
    const res = await runAs(teacherA, "update classes set teacher_id = $1 where section_id = $2 returning id", [w.teacher, sectionB]);
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("POSITIVE CONTROL: teacher A reads their own class, a student their section's, the admin all", async () => {
    const t = await runAs(teacherA, "select section_id::text as s from classes");
    expect(t.error).toBeNull();
    expect(t.rows.map((r) => r.s)).toEqual([sectionA]);
    const s = await runAs(student, "select section_id::text as s from classes");
    expect(s.error).toBeNull();
    expect(s.rows.map((r) => r.s)).toEqual([sectionA]);
    const a = await runAs(admin, "select count(*)::int as n from classes");
    expect(a.rows[0]!.n).toBe(2);
  });
});

describe("subjects and books", () => {
  it("CPE 412 is seeded with two or more books, one the default", async () => {
    const res = await runAs(service, "select count(*)::int as n, count(*) filter (where is_default)::int as d from subject_books where subject_code = 'CPE 412'");
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rows[0]!.n).toBeGreaterThanOrEqual(2);
    expect(res.rows[0]!.d).toBe(1);
  });
  it("POSITIVE CONTROL: a student reads the subjects and their books", async () => {
    const res = await runAs(student, "select code from subjects");
    expect(res.error).toBeNull();
    expect(res.rows.map((r) => r.code)).toContain("CPE 412");
  });
  it("denies a teacher adding a subject or a book", async () => {
    const s = await runAs(teacherA, "insert into subjects (code, title) values ('CPE 999', 'Mine') returning code");
    expect(denied(s), denialReason(s)).toBe(true);
    const b = await runAs(teacherA, "insert into subject_books (subject_code, title) values ('CPE 412', 'Mine') returning id");
    expect(denied(b), denialReason(b)).toBe(true);
  });
  it("denies anon the subjects", async () => {
    const res = await runAs(anon, "select code from subjects");
    expect(denied(res), denialReason(res)).toBe(true);
  });
});

describe("what the database holds, for every role, the API's included", () => {
  it("refuses a class whose teacher is a student", async () => {
    const res = await runAs(
      service,
      "insert into classes (section_id, subject_code, teacher_id, term) values ($1, 'CPE 412', $2, '2026-9') returning id",
      [sectionA, w.studentA],
    );
    expect(res.error, "a student cannot hold a class").not.toBeNull();
    expect(res.error?.code).not.toBe("42P01");
  });
  it("refuses a class whose book belongs to another subject", async () => {
    await runAs(service, "insert into subjects (code, title) values ('CPE 413', 'Another subject') on conflict do nothing");
    const res = await runAs(
      service,
      "insert into classes (section_id, subject_code, teacher_id, term, book_id) values ($1, 'CPE 413', $2, '2026-9', $3::uuid) returning id",
      [sectionA, w.teacher, bookDefault || "00000000-0000-0000-0000-000000000000"],
    );
    expect(res.error?.code, denialReason(res)).toBe("23503"); // foreign_key_violation
  });
  it("refuses a second class of one section, subject and term", async () => {
    const res = await runAs(
      service,
      "insert into classes (section_id, subject_code, teacher_id, term) values ($1, 'CPE 412', $2, '2026-1') returning id",
      [sectionA, idB],
    );
    expect(res.error?.code, denialReason(res)).toBe("23505"); // unique_violation
  });
  it("POSITIVE CONTROL: many sections may take one subject, with a book of that subject", async () => {
    const res = await runAs(
      service,
      "insert into classes (section_id, subject_code, teacher_id, term, book_id) values ($1, 'CPE 412', $2, '2026-2', $3::uuid) returning id",
      [sectionB, w.teacher, bookDefault || "00000000-0000-0000-0000-000000000000"],
    );
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rowCount).toBe(1);
  });
});
