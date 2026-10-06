import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import type { SupabaseAdmin } from "../src/routes/auth.js";
import { temporaryPassword } from "../src/routes/passwords.js";
import { closePool, setup } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Password resets (instructor ruling, 6 Oct 2026: "both, the console tool
 * first"). Denial first: a student resetting anyone, staff without a reason,
 * a staff account or a deactivated student as the target, a student changing
 * someone else's password, no Supabase project. The Admin API is a fake that
 * records what it was asked to do; its real twin is the one the console's
 * own credential change already uses on the deployment.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";
function mint(userId: string, role: string, studentId: string | null): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

class FakeAdmin implements SupabaseAdmin {
  readonly updates: Array<{ id: string; input: Parameters<SupabaseAdmin["updateUser"]>[1] }> = [];
  async createUser(): Promise<{ id: string }> {
    throw new Error("not used");
  }
  async deleteUser(): Promise<void> {}
  async updateUser(id: string, input: Parameters<SupabaseAdmin["updateUser"]>[1]): Promise<void> {
    this.updates.push({ id, input });
  }
}

let app: FastifyInstance;
let bare: FastifyInstance;
let w: World;
const admin = new FakeAdmin();
let tA = "";
let tB = "";
let tT = "";
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const reset = (userId: string, t: string, payload: object, on = app) =>
  on.inject({ method: "POST", url: `/api/v1/console/students/${userId}/password`, headers: auth(t), payload });
const own = (t: string, payload: object, on = app) =>
  on.inject({ method: "POST", url: "/api/v1/account/password", headers: auth(t), payload });

beforeAll(async () => {
  w = await resetWorld();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    JWT_AUDIENCE: "authenticated",
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env, null, admin);
  bare = await buildServer(env, null, null);
  await app.ready();
  await bare.ready();
  tA = mint(w.studentA, "student", "21-0001");
  tB = mint(w.studentB, "student", "21-0002");
  tT = mint(w.teacher, "teacher", null);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await bare?.close();
  await closePool();
});

describe("temporaryPassword", () => {
  it("is three groups of four, with no characters that read alike", () => {
    for (let i = 0; i < 200; i++) {
      const p = temporaryPassword();
      expect(p).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
      expect(p).not.toMatch(/[01ILO]/);
    }
  });
});

describe("POST /console/students/:userId/password — the instructor's reset", () => {
  it("a student cannot reset anyone's password, their own included", async () => {
    expect((await reset(w.studentB, tA, { reason: "forgot it" })).statusCode).toBe(403);
    expect((await reset(w.studentA, tA, { reason: "forgot it" })).statusCode).toBe(403);
    expect(admin.updates).toHaveLength(0);
  });
  it("needs a reason", async () => {
    expect((await reset(w.studentA, tT, {})).statusCode).toBe(400);
    expect((await reset(w.studentA, tT, { reason: "x" })).statusCode).toBe(400);
  });
  it("only a registered, active student: never a staff account", async () => {
    expect((await reset(w.teacher, tT, { reason: "testing" })).statusCode).toBe(404);
    expect((await reset("00000000-0000-4000-8000-000000000000", tT, { reason: "testing" })).statusCode).toBe(404);
  });
  it("not a deactivated student", async () => {
    await setup(`update profiles set deleted_at = now() where id = $1`, [w.studentB]);
    expect((await reset(w.studentB, tT, { reason: "forgot it" })).statusCode).toBe(404);
    await setup(`update profiles set deleted_at = null where id = $1`, [w.studentB]);
  });
  it("with no Supabase project, it says so rather than pretending", async () => {
    const res = await reset(w.studentA, tT, { reason: "forgot it" }, bare);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/Supabase project/);
  });

  it("POSITIVE CONTROL: a temporary password, once; role and student ID kept; the change flagged; audited without it", async () => {
    const res = await reset(w.studentA, tT, { reason: "locked out before the check" });
    expect(res.statusCode).toBe(200);
    const { temporaryPassword: temp, studentId } = res.json();
    expect(temp).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(studentId).toBe("21-0001");
    expect(admin.updates.at(-1)).toEqual({
      id: w.studentA,
      input: { password: temp, appMetadata: { role: "student", student_id: "21-0001", must_change_password: true } },
    });
    const a = await setup(`select payload::text as p from audit_log where action = 'roster.password_reset' and target_id = '21-0001'`);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].p).toContain("locked out before the check");
    expect(a.rows[0].p, "the password itself is never recorded").not.toContain(temp);
  });
});

describe("POST /account/password — the student's own new password", () => {
  it("staff are sent to the console's own credential change", async () => {
    expect((await own(tT, { password: "a-long-enough-password" })).statusCode).toBe(403);
  });
  it("is at least 10 characters", async () => {
    expect((await own(tB, { password: "short" })).statusCode).toBe(400);
  });
  it("cannot be pointed at another account: the body takes no user", async () => {
    const res = await own(tB, { password: "a-long-enough-password", userId: w.studentA });
    expect(res.statusCode).toBe(400);
  });
  it("with no Supabase project, it says so", async () => {
    expect((await own(tB, { password: "a-long-enough-password" }, bare)).statusCode).toBe(409);
  });
  it("POSITIVE CONTROL: sets the caller's own password and clears the flag", async () => {
    const before = admin.updates.length;
    const res = await own(tB, { password: "a-long-enough-password" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, reauthRequired: true });
    expect(admin.updates.slice(before)).toEqual([
      {
        id: w.studentB,
        input: { password: "a-long-enough-password", appMetadata: { role: "student", student_id: "21-0002", must_change_password: false } },
      },
    ]);
  });
});
