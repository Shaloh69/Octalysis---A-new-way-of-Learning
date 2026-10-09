import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { anon, authenticated, closePool, denialReason, runAs, setup, type Actor } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * "Has this person had the first-run tour?" lives in the database, per account
 * (instructor, 9 Oct 2026: "yes, in the database"; db/addendum-tour.sql), not in
 * a browser, so a second device or cleared site data does not show it again.
 *
 * It is a convenience, never a grade. What is still denied: nobody writes ANOTHER
 * person's flag, and an anonymous caller reads nothing. Hard rule 8: written
 * before the addendum existed and watched RED (every test failed on the
 * missing column and route).
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string, studentId: string | null): string {
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

let app: FastifyInstance;
let w: World;
let a: Actor;
let tA = "";
let tT = "";

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
  app = await buildServer(env, null, null, null);
  await app.ready();
  a = authenticated(w.studentA, "student", "studentA");
  tA = mintToken(w.studentA, "student", "21-0001");
  tT = mintToken(w.teacher, "teacher", null);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const seen = async (id: string) =>
  ((await setup(`select tour_seen_at from profiles where id = $1`, [id])).rows[0] as { tour_seen_at: Date | null }).tour_seen_at;

describe("the tour flag: the database", () => {
  it("denies a student setting ANOTHER person's flag (RLS: the row is not theirs)", async () => {
    const res = await runAs(a, `update profiles set tour_seen_at = now() where id = $1 returning id`, [w.studentB]);
    expect(res.rowCount, denialReason(res)).toBe(0);
    expect(await seen(w.studentB)).toBeNull();
  });
  it("denies anon reading it", async () => {
    const res = await runAs(anon, `select tour_seen_at from profiles`);
    expect(res.rowCount === 0 || res.error !== null, denialReason(res)).toBe(true);
  });
  it("POSITIVE CONTROL: it starts null for a new account", async () => {
    expect(await seen(w.studentA)).toBeNull();
  });
});

describe("GET /profile and POST /profile/tour", () => {
  it("a new account has not seen the tour", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/profile", headers: { authorization: `Bearer ${tA}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().tourSeenAt).toBeNull();
  });

  it("requires a token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/profile/tour" });
    expect(res.statusCode).toBe(401);
  });

  it("marks it seen, answers the fresh profile, and the day does not move on a second call", async () => {
    const first = await app.inject({ method: "POST", url: "/api/v1/profile/tour", headers: { authorization: `Bearer ${tA}` } });
    expect(first.statusCode).toBe(200);
    const t1 = first.json().tourSeenAt as string;
    expect(typeof t1).toBe("string");
    const again = await app.inject({ method: "POST", url: "/api/v1/profile/tour", headers: { authorization: `Bearer ${tA}` } });
    expect(again.json().tourSeenAt).toBe(t1);
    expect((await seen(w.studentA))?.toISOString()).toBe(t1);
  });

  it("it is the caller's own flag only: a teacher's call marks the teacher, nobody else", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/profile/tour", headers: { authorization: `Bearer ${tT}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(w.teacher);
    expect(await seen(w.studentB)).toBeNull();
  });

  it("refuses a body it does not expect (the route takes none)", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/profile/tour", headers: { authorization: `Bearer ${tA}` },
      payload: { userId: w.studentB },
    });
    expect(res.statusCode).toBe(200); // ignored, not obeyed: the flag it sets is the caller's
    expect(await seen(w.studentB)).toBeNull();
  });
});
