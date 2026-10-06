import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { closePool, setup } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * Leaving a paper submits it (instructor ruling 4, 6 Oct 2026;
 * services/api/src/sitting.ts). The page submits for itself when it can; the
 * server submits a paper that was LEFT the next time its student touches the
 * API. Every case here is a paper the page could not hand in.
 *
 * Left: full screen exited (at once), the page reported closed, away longer
 * than 15 s, or idle 2 hours. Not left: away for less than 15 s and back.
 * A submit uses the attempt; nothing is voided.
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
let tA = "";
let tT = "";
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function start(): Promise<{ attemptId: string; attemptNo: number; resumed: boolean }> {
  const res = await app.inject({ method: "POST", url: "/api/v1/attempts", headers: auth(tA), payload: { assessmentId: w.stageAssessmentId } });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}
const status = async (id: string) =>
  (await setup("select status::text as s from attempts where id = $1", [id])).rows[0].s as string;
const events = async (id: string) =>
  (await setup("select kind from attempt_events where attempt_id = $1 order by at, id", [id])).rows.map((r) => r.kind as string);
const event = (id: string, kind: string, secondsAgo = 0) =>
  setup(`insert into attempt_events (attempt_id, kind, at) values ($1, $2, now() - make_interval(secs => $3))`, [id, kind, secondsAgo]);

beforeAll(async () => {
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    JWT_AUDIENCE: "authenticated",
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env, null);
  await app.ready();
}, 120_000);

beforeEach(async () => {
  w = await seedItemBank();
  tA = mintToken(w.studentA, "student", "21-0001");
  tT = mintToken(w.teacher, "teacher", null);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("a paper left is submitted, and uses the attempt", () => {
  it("leaving full screen: the next Start submits it and begins attempt 2", async () => {
    const first = await start();
    await event(first.attemptId, "left_fullscreen");
    const second = await start();
    expect(await status(first.attemptId)).toBe("submitted");
    expect(await events(first.attemptId)).toEqual(["left_fullscreen", "auto_submitted"]);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(second.attemptNo).toBe(first.attemptNo + 1);
    expect(second.resumed).toBe(false);
  });

  it("a page reported closed (a reload, a closed tab): submitted on the next map load", async () => {
    const first = await start();
    await event(first.attemptId, "closed");
    const map = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tA) });
    expect(map.statusCode).toBe(200);
    expect(await status(first.attemptId)).toBe("submitted");
  });

  it("away longer than 15 seconds without coming back: submitted", async () => {
    const first = await start();
    await event(first.attemptId, "left_page", 20);
    await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tA) });
    expect(await status(first.attemptId)).toBe("submitted");
  });

  it("idle for two hours, nothing reported at all: submitted", async () => {
    const first = await start();
    await setup(`update attempts set started_at = now() - interval '3 hours' where id = $1`, [first.attemptId]);
    await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tA) });
    expect(await status(first.attemptId)).toBe("submitted");
    expect(await events(first.attemptId)).toEqual(["auto_submitted"]);
  });

  it("the auto-submit feeds the stage's progress like any submit", async () => {
    const first = await start();
    await event(first.attemptId, "left_fullscreen");
    await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tA) });
    const p = await setup(`select attempts from stage_progress where user_id = $1 and stage_id = $2`, [w.studentA, w.stageId]);
    expect(p.rows[0]?.attempts).toBe(1);
  });
});

describe("not left: the paper stays open", () => {
  it("away for less than 15 seconds: still open, and Start resumes it", async () => {
    const first = await start();
    await event(first.attemptId, "left_page", 5);
    const again = await start();
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.resumed).toBe(true);
    expect(await status(first.attemptId)).toBe("in_progress");
  });

  it("away, then back within the grace: a later sweep leaves it open", async () => {
    const first = await start();
    await event(first.attemptId, "left_page", 30);
    await event(first.attemptId, "returned", 20);
    await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tA) });
    expect(await status(first.attemptId)).toBe("in_progress");
  });

  it("a moon's journey is practice: never submitted by the sweep", async () => {
    const { rows } = await setup(`select id from objectives where stage_id = $1 limit 1`, [w.stageId]);
    const objectiveId = rows[0]?.id as string | undefined;
    expect(objectiveId, "the bank world has an objective").toBeTruthy();
    const j = await app.inject({ method: "POST", url: `/api/v1/objectives/${objectiveId}/journey`, headers: auth(tA) });
    expect(j.statusCode, j.body).toBe(200);
    const jid = j.json().attemptId as string;
    await setup(`update attempts set started_at = now() - interval '3 hours' where id = $1`, [jid]);
    await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tA) });
    expect(await status(jid)).toBe("in_progress");
  });
});

describe("the page hands it in because the student left", () => {
  it("records why, and that it was automatic", async () => {
    const first = await start();
    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${first.attemptId}/submit`, headers: auth(tA), payload: { left: "left_page" },
    });
    expect(res.statusCode).toBe(200);
    expect(await events(first.attemptId)).toEqual(["left_page", "auto_submitted"]);
  });

  it("twice (pagehide and a reload both fire) is one submit, recorded once", async () => {
    const first = await start();
    const go = () => app.inject({ method: "POST", url: `/api/v1/attempts/${first.attemptId}/submit`, headers: auth(tA), payload: { left: "closed" } });
    expect((await go()).statusCode).toBe(200);
    expect((await go()).json().alreadySubmitted).toBe(true);
    expect(await events(first.attemptId)).toEqual(["closed", "auto_submitted"]);
  });

  it("a reason that is not a leave is refused", async () => {
    const first = await start();
    const res = await app.inject({ method: "POST", url: `/api/v1/attempts/${first.attemptId}/submit`, headers: auth(tA), payload: { left: "bored" } });
    expect(res.statusCode).toBe(400);
    expect(await status(first.attemptId)).toBe("in_progress");
  });

  it("staff handing a paper in never records it as the student leaving", async () => {
    const first = await start();
    await app.inject({ method: "POST", url: `/api/v1/attempts/${first.attemptId}/submit`, headers: auth(tT), payload: { left: "closed" } });
    expect(await events(first.attemptId)).toEqual([]);
  });

  it("an ordinary submit, no body, records nothing about leaving", async () => {
    const first = await start();
    const res = await app.inject({ method: "POST", url: `/api/v1/attempts/${first.attemptId}/submit`, headers: auth(tA) });
    expect(res.statusCode).toBe(200);
    expect(await events(first.attemptId)).toEqual([]);
  });
});
