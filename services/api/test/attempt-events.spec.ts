import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { authenticated, closePool, runAs, service, setup } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * Sitting a paper: a leave is recorded (instructor ruling 3, 30 Sep 2026;
 * docs/redesign/WEB-REMAKE.md §4a). POST /api/v1/attempts/:id/events and the
 * append-only `attempt_events` table behind it.
 *
 * Denial first, per hard rule 8: another student, staff, a submitted paper, a
 * client-supplied time, and every database path that could edit or forge the
 * record.
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
let w: BankWorld;
let tokenA: string;
let tokenB: string;
let tokenT: string;
let attemptId: string;

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const post = (id: string, token: string, payload: unknown) =>
  app.inject({ method: "POST", url: `/api/v1/attempts/${id}/events`, headers: auth(token), payload: payload as object });
const count = async (id: string) =>
  Number((await setup("select count(*)::int as n from attempt_events where attempt_id = $1", [id])).rows[0].n);

beforeAll(async () => {
  w = await seedItemBank();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    JWT_AUDIENCE: "authenticated",
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
  tokenA = mintToken(w.studentA, "student", "21-0001");
  tokenB = mintToken(w.studentB, "student", "21-0002");
  tokenT = mintToken(w.teacher, "teacher", null);

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/attempts",
    headers: auth(tokenA),
    payload: { assessmentId: w.stageAssessmentId },
  });
  expect(res.statusCode).toBe(200);
  attemptId = res.json().attemptId;
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("POST /api/v1/attempts/:id/events — who may record a leave", () => {
  it("requires a token", async () => {
    const res = await app.inject({ method: "POST", url: `/api/v1/attempts/${attemptId}/events`, payload: { kind: "left_page" } });
    expect(res.statusCode).toBe(401);
  });

  it("another student cannot record a leave on this attempt, and learns nothing about it", async () => {
    const before = await count(attemptId);
    const res = await post(attemptId, tokenB, { kind: "left_fullscreen" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
    expect(await count(attemptId)).toBe(before);
  });

  it("staff cannot record one either: a sitting is read by staff, never written", async () => {
    const before = await count(attemptId);
    const res = await post(attemptId, tokenT, { kind: "left_fullscreen" });
    expect(res.statusCode).toBe(404);
    expect(await count(attemptId)).toBe(before);
  });

  it("an unknown kind, or a client-supplied time, is refused", async () => {
    expect((await post(attemptId, tokenA, { kind: "cheated" })).statusCode).toBe(400);
    expect((await post(attemptId, tokenA, { kind: "left_page", at: "2020-01-01T00:00:00Z" })).statusCode).toBe(400);
  });

  it("a malformed id is not found, never a 500", async () => {
    expect((await post("not-a-uuid", tokenA, { kind: "left_page" })).statusCode).toBe(404);
  });

  it("the owner records a leave and a return, stamped by the server", async () => {
    const before = await count(attemptId);
    const t0 = Date.now();
    expect((await post(attemptId, tokenA, { kind: "left_fullscreen" })).statusCode).toBe(201);
    expect((await post(attemptId, tokenA, { kind: "returned" })).statusCode).toBe(201);
    expect(await count(attemptId)).toBe(before + 2);
    const { rows } = await setup("select kind, at from attempt_events where attempt_id = $1 order by id desc limit 2", [attemptId]);
    expect(rows.map((r) => r.kind)).toEqual(["returned", "left_fullscreen"]);
    expect(new Date(rows[1].at).getTime()).toBeGreaterThanOrEqual(t0 - 5_000);
  });

  it("the console shows staff the leaves: a count on the record, the events on the attempt", async () => {
    const rec = await app.inject({ method: "GET", url: `/api/v1/console/students/${w.studentA}`, headers: auth(tokenT) });
    expect(rec.statusCode).toBe(200);
    const row = (rec.json().attempts as Array<{ attemptId: string; leaves: number }>).find((a) => a.attemptId === attemptId);
    expect(row?.leaves).toBeGreaterThanOrEqual(1);
    const att = await app.inject({ method: "GET", url: `/api/v1/console/attempts/${attemptId}`, headers: auth(tokenT) });
    expect(att.statusCode).toBe(200);
    expect((att.json().events as Array<{ kind: string }>).map((e) => e.kind)).toContain("left_fullscreen");
  });

  it("a student cannot read the console's view of their own leaves", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/console/attempts/${attemptId}`, headers: auth(tokenA) });
    expect(res.statusCode).toBe(403);
  });

  it("after submit there is nothing to leave: 409, nothing written", async () => {
    const sub = await app.inject({ method: "POST", url: `/api/v1/attempts/${attemptId}/submit`, headers: auth(tokenA) });
    expect(sub.statusCode).toBe(200);
    const before = await count(attemptId);
    const res = await post(attemptId, tokenA, { kind: "left_page" });
    expect(res.statusCode).toBe(409);
    expect(await count(attemptId)).toBe(before);
  });
});

describe("attempt_events in the database — denial", () => {
  it("a student can neither read nor write it directly (no client path, like responses)", async () => {
    const actor = authenticated(w.studentA, "student");
    const read = await runAs(actor, "select * from attempt_events");
    expect(read.error === null ? read.rows.length : 0).toBe(0);
    const write = await runAs(actor, "insert into attempt_events (attempt_id, kind) values ($1, 'returned')", [attemptId]);
    expect(write.error, "a student-side insert succeeded: CRITICAL").not.toBeNull();
  });

  it("staff read it through RLS", async () => {
    const res = await runAs(authenticated(w.teacher, "teacher"), "select count(*)::int as n from attempt_events where attempt_id = $1", [attemptId]);
    expect(res.error).toBeNull();
    expect(Number((res.rows[0] as { n: number }).n)).toBeGreaterThan(0);
  });

  it("append-only for service_role too: no update, no delete, no truncate", async () => {
    for (const sql of [
      "update attempt_events set kind = 'returned' where attempt_id = $1",
      "delete from attempt_events where attempt_id = $1",
    ]) {
      const res = await runAs(service, sql, [attemptId]);
      expect(res.error?.message, sql).toMatch(/append-only/);
    }
    const t = await runAs(service, "truncate attempt_events");
    expect(t.error).not.toBeNull();
  });
});
