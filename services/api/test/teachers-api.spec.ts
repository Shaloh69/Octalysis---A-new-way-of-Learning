import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import type { SupabaseAdmin } from "../src/routes/auth.js";
import { setup, pool, closePool } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * The admin's teacher routes and the teacher claim (T1, 7 Oct 2026;
 * src/routes/teachers.ts, POST /api/v1/auth/claim-teacher).
 *
 * Denials first: a teacher, a student and no token are refused every admin
 * route; the claim's four failures are one message. Positive controls as the
 * admin. Hard rule 8: watched red first (no routes: every positive control
 * 404'd), then green.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mint(userId: string, role: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { role },
  })).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

class FakeAdmin implements SupabaseAdmin {
  banned = new Map<string, boolean>();
  async createUser({ email, appMetadata }: { email: string; password: string; appMetadata: Record<string, unknown> }) {
    const { rows } = await pool.query(
      `insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), $1, $2::jsonb) returning id`,
      [email, JSON.stringify(appMetadata)],
    );
    return { id: rows[0].id as string };
  }
  async deleteUser(id: string) {
    await pool.query("delete from auth.users where id = $1", [id]);
  }
  async updateUser() {}
  async setBanned(id: string, banned: boolean) {
    this.banned.set(id, banned);
  }
}

let app: FastifyInstance;
let w: World;
let fake: FakeAdmin;
let adminId = "";
let adminTok = "";
let teacherTok = "";
let studentTok = "";
let sectionA = "";
let sectionB = "";
let books: { id: string; is_default: boolean }[] = [];

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const inject = (method: "GET" | "POST" | "PATCH", url: string, token: string | null, payload?: unknown) =>
  app.inject({ method, url, headers: token ? auth(token) : {}, ...(payload !== undefined ? { payload: payload as object } : {}) });

beforeAll(async () => {
  w = await resetWorld();
  const a = await setup(
    `insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), 'admin@octa-test.local', '{"role":"admin"}'::jsonb) returning id::text`,
  );
  adminId = a.rows[0].id as string;
  await setup(`insert into profiles (id, full_name, role) values ($1, 'The Admin', 'admin'::user_role)`, [adminId]);
  await setup(`insert into teacher_directory (employee_id, full_name, email, role, status, claimed_by, claimed_at)
               values ('EMP-0001', 'Instructor', 't@octa-test.local', 'teacher', 'claimed', $1, now())`, [w.teacher]);
  const secs = await setup(`select id::text, code from sections order by code`);
  sectionA = secs.rows.find((r) => r.code === "BSCPE-2A")!.id as string;
  sectionB = secs.rows.find((r) => r.code === "BSCPE-2B")!.id as string;
  books = (await setup(`select id::text, is_default from subject_books where subject_code = 'CPE 412' order by is_default desc`)).rows as typeof books;

  fake = new FakeAdmin();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
  } as NodeJS.ProcessEnv);
  app = await buildServer(env, null, fake);
  await app.ready();
  adminTok = mint(adminId, "admin");
  teacherTok = mint(w.teacher, "teacher");
  studentTok = mint(w.studentA, "student");
}, 60_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("every admin route refuses a teacher, a student and no token", () => {
  const routes: Array<["GET" | "POST" | "PATCH", string, unknown?]> = [
    ["GET", "/api/v1/console/teachers"],
    ["GET", "/api/v1/console/teachers/employee:EMP-0001"],
    ["POST", "/api/v1/console/teachers/import", { rows: [{ employeeId: "EMP-9", fullName: "X Y" }], apply: true }],
    ["POST", "/api/v1/console/teachers/employee:EMP-0001/status", { active: false, reason: "test", confirm: "EMP-0001" }],
    ["POST", "/api/v1/console/classes", { sectionId: "00000000-0000-0000-0000-000000000000", subjectCode: "CPE 412", term: "2026-9", teacherId: null, reason: "test" }],
    ["PATCH", "/api/v1/console/classes/00000000-0000-0000-0000-000000000000", { ended: true, reason: "test" }],
  ];
  for (const [method, url, body] of routes) {
    it(`${method} ${url}: teacher 403, student 403, no token 401`, async () => {
      expect((await inject(method, url, teacherTok, body)).statusCode).toBe(403);
      expect((await inject(method, url, studentTok, body)).statusCode).toBe(403);
      expect((await inject(method, url, null, body)).statusCode).toBe(401);
    });
  }
  it("and nothing was written by the refused calls", async () => {
    const n = await setup(`select (select count(*)::int from teacher_directory where employee_id = 'EMP-9') as roster,
                                  (select count(*)::int from classes where term = '2026-9') as classes`);
    expect(n.rows[0]).toEqual({ roster: 0, classes: 0 });
  });
});

describe("the admin's list and a teacher's page", () => {
  it("POSITIVE CONTROL: lists the admin (also a teacher) and the teacher, with counts", async () => {
    const r = await inject("GET", "/api/v1/console/teachers", adminTok);
    expect(r.statusCode).toBe(200);
    const body = r.json();
    const names = body.teachers.map((t: { fullName: string; role: string }) => `${t.fullName}:${t.role}`).sort();
    expect(names).toEqual(["Instructor:teacher", "The Admin:admin"]);
    expect(body.counts).toMatchObject({ total: 2, active: 2 });
    expect(body.subjects[0]).toMatchObject({ code: "CPE 412" });
    expect(body.subjects[0].books.length).toBeGreaterThanOrEqual(2);
  });
  it("opens one teacher by user id; an unknown key is 404", async () => {
    const r = await inject("GET", `/api/v1/console/teachers/${w.teacher}`, adminTok);
    expect(r.statusCode).toBe(200);
    expect(r.json().teacher).toMatchObject({ employeeId: "EMP-0001", status: "active" });
    expect(r.json().usage).toEqual([]);
    expect((await inject("GET", "/api/v1/console/teachers/employee:NOPE-1", adminTok)).statusCode).toBe(404);
  });
});

describe("the teacher roster import", () => {
  it("a dry run writes nothing and plans insert / conflict(claimed) / conflict(duplicate)", async () => {
    const r = await inject("POST", "/api/v1/console/teachers/import", adminTok, {
      rows: [
        { employeeId: "EMP-0100", fullName: "New Teacher", email: "new@octa-test.local" },
        { employeeId: "EMP-0001", fullName: "Renamed Instructor" },
        { employeeId: "EMP-0200", fullName: "Twice" },
        { employeeId: "EMP-0200", fullName: "Twice Again" },
      ],
    });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.dryRun).toBe(true);
    expect(b.plan.map((p: { action: string; why?: string }) => p.why ?? p.action)).toEqual(["insert", "claimed", "duplicate", "duplicate"]);
    expect((await setup(`select count(*)::int as n from teacher_directory where employee_id = 'EMP-0100'`)).rows[0].n).toBe(0);
  });
  it("applied, it writes the plan's inserts and audits them; a claimed row is untouched", async () => {
    const r = await inject("POST", "/api/v1/console/teachers/import", adminTok, {
      rows: [{ employeeId: "EMP-0100", fullName: "New Teacher", email: "new@octa-test.local" }, { employeeId: "EMP-0001", fullName: "Renamed" }],
      apply: true,
    });
    expect(r.statusCode).toBe(200);
    const rows = await setup(`select employee_id, full_name, status::text as status from teacher_directory order by 1`);
    expect(rows.rows).toEqual([
      { employee_id: "EMP-0001", full_name: "Instructor", status: "claimed" },
      { employee_id: "EMP-0100", full_name: "New Teacher", status: "unclaimed" },
    ]);
    const a = await setup(`select count(*)::int as n from audit_log where action = 'admin.teacher_import' and actor_id = $1`, [adminId]);
    expect(a.rows[0].n).toBe(1);
  });
});

describe("classes", () => {
  let classId = "";
  it("assigns a class to a teacher with a book of its subject", async () => {
    const r = await inject("POST", "/api/v1/console/classes", adminTok, {
      sectionId: sectionA, subjectCode: "CPE 412", term: "2026-1", teacherId: w.teacher, bookId: books[1]!.id, reason: "first term",
    });
    expect(r.statusCode).toBe(201);
    classId = r.json().id;
  });
  it("assigning the same section, subject and term again re-assigns it, never a second class", async () => {
    const r = await inject("POST", "/api/v1/console/classes", adminTok, {
      sectionId: sectionA, subjectCode: "CPE 412", term: "2026-1", teacherId: adminId, bookId: null, reason: "the admin takes it",
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().id).toBe(classId);
    const n = await setup(`select count(*)::int as n, max(teacher_id::text) as t from classes where section_id = $1`, [sectionA]);
    expect(n.rows[0]).toEqual({ n: 1, t: adminId });
  });
  it("many sections may take one subject", async () => {
    const r = await inject("POST", "/api/v1/console/classes", adminTok, {
      sectionId: sectionB, subjectCode: "CPE 412", term: "2026-1", teacherId: w.teacher, reason: "second section",
    });
    expect(r.statusCode).toBe(201);
  });
  it("refuses a student as a class's teacher, and a book of another subject", async () => {
    const s = await inject("POST", "/api/v1/console/classes", adminTok, {
      sectionId: sectionB, subjectCode: "CPE 412", term: "2026-3", teacherId: w.studentA, reason: "wrong",
    });
    expect(s.statusCode).toBe(400);
    await setup(`insert into subjects (code, title) values ('CPE 413', 'Another') on conflict do nothing`);
    const b = await inject("POST", "/api/v1/console/classes", adminTok, {
      sectionId: sectionB, subjectCode: "CPE 413", term: "2026-3", teacherId: w.teacher, bookId: books[0]!.id, reason: "wrong book",
    });
    expect(b.statusCode).toBe(400);
  });
  it("ends a class and changes its book, each audited", async () => {
    expect((await inject("PATCH", `/api/v1/console/classes/${classId}`, adminTok, { bookId: books[0]!.id, reason: "use the default" })).statusCode).toBe(200);
    expect((await inject("PATCH", `/api/v1/console/classes/${classId}`, adminTok, { ended: true, reason: "term over" })).statusCode).toBe(200);
    const c = await setup(`select book_id::text, ended_at is not null as ended from classes where id = $1`, [classId]);
    expect(c.rows[0]).toEqual({ book_id: books[0]!.id, ended: true });
    const a = await setup(`select count(*)::int as n from audit_log where action = 'admin.class_update'`);
    expect(a.rows[0].n).toBe(2);
  });
});

describe("disabling a teacher", () => {
  it("refuses a wrong confirmation, an admin, and yourself", async () => {
    const wrong = await inject("POST", `/api/v1/console/teachers/${w.teacher}/status`, adminTok, { active: false, reason: "left", confirm: "EMP-0002" });
    expect(wrong.statusCode).toBe(400);
    const self = await inject("POST", `/api/v1/console/teachers/${adminId}/status`, adminTok, { active: false, reason: "myself", confirm: "The Admin" });
    expect(self.statusCode).toBe(403);
  });
  it("disabled, the teacher is refused on their next request and their login is banned", async () => {
    expect((await inject("GET", "/api/v1/console/roster", teacherTok)).statusCode).toBe(200);
    const r = await inject("POST", `/api/v1/console/teachers/${w.teacher}/status`, adminTok, { active: false, reason: "left the department", confirm: "EMP-0001" });
    expect(r.statusCode).toBe(200);
    const after = await inject("GET", "/api/v1/console/roster", teacherTok);
    expect(after.statusCode).toBe(403);
    expect(after.json().error.message).toMatch(/disabled/);
    expect(fake.banned.get(w.teacher)).toBe(true);
  });
  it("re-enabled, they are back", async () => {
    const r = await inject("POST", `/api/v1/console/teachers/${w.teacher}/status`, adminTok, { active: true, reason: "returned", confirm: "EMP-0001" });
    expect(r.statusCode).toBe(200);
    expect((await inject("GET", "/api/v1/console/roster", teacherTok)).statusCode).toBe(200);
    expect(fake.banned.get(w.teacher)).toBe(false);
  });
  it("an unclaimed roster row disabled cannot be claimed", async () => {
    const r = await inject("POST", "/api/v1/console/teachers/employee:EMP-0100/status", adminTok, { active: false, reason: "not hired", confirm: "EMP-0100" });
    expect(r.statusCode).toBe(200);
    const c = await inject("POST", "/api/v1/auth/claim-teacher", null, {
      employeeId: "EMP-0100", fullName: "New Teacher", email: "new@octa-test.local", password: "a-long-password-1",
    });
    expect(c.statusCode).toBe(403);
    await inject("POST", "/api/v1/console/teachers/employee:EMP-0100/status", adminTok, { active: true, reason: "hired after all", confirm: "EMP-0100" });
  });
});

describe("POST /api/v1/auth/claim-teacher", () => {
  const claim = (b: object) => inject("POST", "/api/v1/auth/claim-teacher", null, b);
  it("unknown ID, claimed ID and a wrong name are ONE message", async () => {
    const unknown = await claim({ employeeId: "EMP-7777", fullName: "Nobody", email: "x1@octa-test.local", password: "a-long-password-1" });
    const taken = await claim({ employeeId: "EMP-0001", fullName: "Instructor", email: "x2@octa-test.local", password: "a-long-password-1" });
    const name = await claim({ employeeId: "EMP-0100", fullName: "Someone Else", email: "x3@octa-test.local", password: "a-long-password-1" });
    for (const r of [unknown, taken, name]) expect(r.statusCode).toBe(403);
    expect(new Set([unknown.body, taken.body, name.body]).size).toBe(1);
  });
  it("POSITIVE CONTROL: the roster's name (case and spacing aside) claims it, with the ROSTER's role", async () => {
    await setup(`insert into teacher_directory (employee_id, full_name, role) values ('EMP-0300', 'Second  Admin', 'admin')`);
    const r = await claim({ employeeId: "EMP-0300", fullName: "second admin", email: "second@octa-test.local", password: "a-long-password-1" });
    expect(r.statusCode).toBe(201);
    const row = await setup(
      `select d.status::text as status, p.role::text as role, u.raw_app_meta_data ->> 'role' as jwt_role
         from teacher_directory d join profiles p on p.id = d.claimed_by join auth.users u on u.id = p.id
        where d.employee_id = 'EMP-0300'`,
    );
    expect(row.rows[0]).toEqual({ status: "claimed", role: "admin", jwt_role: "admin" });
  });
});
