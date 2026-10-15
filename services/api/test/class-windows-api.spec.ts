import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import type { SupabaseAdmin } from "../src/routes/auth.js";
import { seedScopeWorld, type ScopeWorld } from "./helpers/scope-world.js";

/**
 * T2 5.10, the API's door: PUT /console/assessments/:id/classes/:classId/window (instructor, 15 Oct 2026:
 * build it now; only the class's own teacher; moon checks follow). And the rule it moves is the rule
 * Start obeys: the same shared paper, closed for one class and open for another.
 *
 * Hard rule 8: watched red first, 15 Oct 2026, against an API without the route (every PUT 404, and Start
 * still read the shared window).
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string, studentId?: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId, aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

class FakeAdmin implements SupabaseAdmin {
  async createUser(): Promise<{ id: string }> { throw new Error("not used"); }
  async deleteUser(): Promise<void> {}
  async updateUser(): Promise<void> {}
}

let app: FastifyInstance;
let sw: ScopeWorld;
const tok: Record<string, string> = {};
let stageCheck = "";
let exam = "";
const cls: Record<string, string> = {};

function call(actor: string, method: "GET" | "PUT" | "POST", url: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${tok[actor]}` }, ...(payload ? { payload } : {}) });
}
const put = (actor: string, assessment: string, klass: string, body: object) =>
  call(actor, "PUT", `/api/v1/console/assessments/${assessment}/classes/${klass}/window`, { reason: "a test", ...body });

const NEXT_MONTH = new Date(Date.now() + 30 * 86_400_000).toISOString();
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

beforeAll(async () => {
  sw = await seedScopeWorld();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    JWT_AUDIENCE: "authenticated",
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env, null, new FakeAdmin());
  await app.ready();

  // A SHARED stage check on stage 03 that closed yesterday, and a global exam.
  const bp = (await setup(`insert into blueprints (name, scope, stage_id, total_items, constraints)
                           values ('cw api stage', 'stage', '03', 1, '{"by_type":{"S":1}}'::jsonb) returning id::text`)).rows[0]!.id;
  stageCheck = (await setup(`insert into assessments (blueprint_id, section_id, title, closes_at, attempts_allowed)
                             values ($1, null, 'Stage 03 Check (shared)', $2, 5) returning id::text`, [bp, YESTERDAY])).rows[0]!.id as string;
  const fb = (await setup(`insert into blueprints (name, scope, total_items, constraints)
                           values ('cw api final', 'final', 1, '{"by_type":{"S":1}}'::jsonb) returning id::text`)).rows[0]!.id;
  exam = (await setup(`insert into assessments (blueprint_id, section_id, title) values ($1, null, 'Prelim (shared)') returning id::text`, [fb])).rows[0]!.id as string;
  await setup(`insert into assessment_secrets (assessment_id, exam_salt) values ($1, 'salt-cw'), ($2, 'salt-cw2')`, [stageCheck, exam]);
  for (const [k, sec] of [["A", sw.st.A.section], ["B", sw.st.B.section], ["E", sw.st.E.section], ["D", sw.st.D.section]] as const) {
    cls[k] = (await setup(`select id::text from classes where section_id = $1`, [sec])).rows[0]!.id as string;
  }
  // Students B and D may open stage 03 (the lock is not what is tested here).
  await setup(`insert into stage_locks (scope, scope_user_id, stage_id, state) values ('user', $1, '03', 'unlocked'), ('user', $2, '03', 'unlocked')`,
    [sw.st.B.user, sw.st.D.user]);

  tok.teacherA = mintToken(sw.w.teacher, "teacher");
  tok.teacherB = mintToken(sw.teacherBId, "teacher");
  tok.teacherEnded = mintToken(sw.teacherEId, "teacher");
  tok.teacherNone = mintToken(sw.teacherNoneId, "teacher");
  tok.admin = mintToken(sw.adminId, "admin");
  tok.studentB = mintToken(sw.st.B.user, "student", "22-9066");
  tok.studentD = mintToken(sw.st.D.user, "student", "22-9068");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("who may set a class's window", () => {
  it("another teacher's class is not found; a teacher with no class finds nothing", async () => {
    expect((await put("teacherA", stageCheck, cls.B!, { attemptsAllowed: 7 })).statusCode).toBe(404);
    expect((await put("teacherNone", stageCheck, cls.B!, { attemptsAllowed: 7 })).statusCode).toBe(404);
  });
  it("the admin reads another teacher's class and is refused (403), not given it", async () => {
    const r = await put("admin", stageCheck, cls.B!, { attemptsAllowed: 7 });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.message).toMatch(/own teacher/);
  });
  it("an ended class is read-only, for its own teacher too", async () => {
    expect((await put("teacherEnded", stageCheck, cls.E!, { attemptsAllowed: 7 })).statusCode).toBe(403);
  });
  it("a student is refused", async () => {
    expect((await put("studentB", stageCheck, cls.B!, { attemptsAllowed: 7 })).statusCode).toBe(403);
  });
  it("an exam is refused: the exams are the course's (ruling 4)", async () => {
    const r = await put("teacherB", exam, cls.B!, { attemptsAllowed: 7 });
    expect(r.statusCode).toBe(400);
  });
  it("a reason is required", async () => {
    const r = await call("teacherB", "PUT", `/api/v1/console/assessments/${stageCheck}/classes/${cls.B}/window`, { attemptsAllowed: 7 });
    expect(r.statusCode).toBe(400);
  });
  it("nothing was written by any refused call", async () => {
    const n = await setup(`select count(*)::int n from class_assessment_windows`);
    expect(n.rows[0]!.n).toBe(0);
  });
});

describe("the class's own teacher moves the window, and Start obeys it", () => {
  it("before: the shared paper is closed for students B and D alike", async () => {
    for (const s of ["studentB", "studentD"]) {
      const r = await call(s, "POST", "/api/v1/attempts", { assessmentId: stageCheck });
      expect(r.statusCode, s).toBe(403);
      expect(r.json().error.message, s).toMatch(/closed/);
    }
  });
  it("teacher B extends it for class B, audited with the reason", async () => {
    const r = await put("teacherB", stageCheck, cls.B!, { closesAt: NEXT_MONTH });
    expect(r.statusCode, r.body).toBe(200);
    const log = await setup(`select payload from audit_log where action = 'assessment.class_window' and target_id = $1`, [stageCheck]);
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.payload.reason).toBe("a test");
  });
  it("after: student B starts the paper; student D, another class, still finds it closed", async () => {
    const b = await call("studentB", "POST", "/api/v1/attempts", { assessmentId: stageCheck });
    expect(b.statusCode, b.body).toBeLessThan(300);
    const d = await call("studentD", "POST", "/api/v1/attempts", { assessmentId: stageCheck });
    expect(d.statusCode).toBe(403);
  });
  it("the console shows teacher B their class's window, and only their own classes", async () => {
    const r = await call("teacherB", "GET", "/api/v1/console/assessments");
    const row = r.json().assessments.find((a: { id: string }) => a.id === stageCheck);
    expect(row.classWindows).toHaveLength(1);
    expect(row.classWindows[0].classId).toBe(cls.B);
    const ids = r.json().classes.map((c: { id: string }) => c.id);
    expect(ids).toEqual([cls.B]);
    expect(r.json().classes[0].canSetWindow).toBe(true);
    const a = await call("teacherA", "GET", "/api/v1/console/assessments");
    const rowA = a.json().assessments.find((x: { id: string }) => x.id === stageCheck);
    expect(rowA.classWindows, "teacher A saw class B's window").toEqual([]);
  });
  it("the limit cannot go below an attempt the class has already sat", async () => {
    await setup(`update attempts set attempt_no = 3 where assessment_id = $1 and user_id = $2`, [stageCheck, sw.st.B.user]);
    const r = await put("teacherB", stageCheck, cls.B!, { attemptsAllowed: 2 });
    expect(r.statusCode).toBe(400);
    expect((await put("teacherB", stageCheck, cls.B!, { attemptsAllowed: 3 })).statusCode).toBe(200);
  });
  it("all three cleared returns the class to the shared paper", async () => {
    const r = await put("teacherB", stageCheck, cls.B!, { closesAt: null, attemptsAllowed: null });
    expect(r.statusCode).toBe(200);
    expect(r.json().cleared).toBe(true);
    const n = await setup(`select count(*)::int n from class_assessment_windows where class_id = $1`, [cls.B]);
    expect(n.rows[0]!.n).toBe(0);
  });
});
