import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * Reading an ungraded stage to its end completes it (instructor, 5 Oct 2026:
 * "if orientation is done reading, automatically mark it as mastered then
 * move to the next stage"). Orientation (00) is the one ungraded stage. The
 * server records it; the client never decides it (hard rule 4 in spirit: a
 * state a student sees is the database's). Every way to misuse the route is
 * denied first, and denied without writing a row.
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
let tokenT: string;

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
  tokenT = mintToken(w.teacher, "teacher", null);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const read = (stage: string, token?: string) =>
  app.inject({ method: "POST", url: `/api/v1/stages/${stage}/read`, headers: token ? auth(token) : {} });
const progress = async (user: string, stage: string) =>
  (await pool.query("select mastery::float as mastery from stage_progress where user_id = $1 and stage_id = $2", [user, stage])).rows;

describe("POST /api/v1/stages/:id/read — denials first", () => {
  it("refuses without a token, and writes nothing", async () => {
    const res = await read("00");
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBeTruthy();
  });

  it("refuses a GRADED stage: reading never masters a planet with moons", async () => {
    const before = await progress(w.studentA, "01");
    const res = await read("01", tokenA);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/graded/i);
    expect(await progress(w.studentA, "01")).toEqual(before);
  });

  it("refuses a stage that does not exist", async () => {
    expect((await read("99", tokenA)).statusCode).toBe(404);
    expect((await read("x'; drop table stages; --", tokenA)).statusCode).toBe(404);
  });

  it("refuses staff without a student ID: no progress row for a teacher", async () => {
    const res = await read("00", tokenT);
    expect(res.statusCode).toBe(403);
    expect(await progress(w.teacher, "00")).toEqual([]);
  });
});

describe("POST /api/v1/stages/:id/read — a student finishing Orientation", () => {
  it("records Orientation mastered for THAT student only, and names the next stage", async () => {
    const res = await read("00", tokenA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ stageId: "00", state: "mastered", next: "01" });
    expect(await progress(w.studentA, "00")).toEqual([{ mastery: 1 }]);
    expect(await progress(w.studentB, "00")).toEqual([]);
  });

  it("is idempotent: a second read changes nothing", async () => {
    const res = await read("00", tokenA);
    expect(res.statusCode).toBe(200);
    expect(await progress(w.studentA, "00")).toEqual([{ mastery: 1 }]);
  });

  it("the map then shows Orientation mastered, from the server", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tokenA) });
    const node = res.json().nodes.find((n: { id: string }) => n.id === "00");
    expect(node.state).toBe("mastered");
  });
});
