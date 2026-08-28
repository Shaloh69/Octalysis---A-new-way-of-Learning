import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * Lecture Mode — the projector view.
 *
 * `apps/console/CLAUDE.md`: **no names, ever.** That is a promise about a
 * payload, so it is tested against the payload: the response body is searched
 * for every real student's name, student ID and user ID, and must contain none
 * of them. A UI that "does not render the name" is not the same guarantee.
 *
 * The second rule is quieter and matters just as much: an aggregate over a
 * handful of people is not anonymous. Four students in a room, "3 of 4 chose
 * B", and one visible face identifies everyone. Below the threshold the server
 * sends no distribution at all.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string, studentId?: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

let app: FastifyInstance;
let w: BankWorld;
let teacherToken: string;
let studentToken: string;

beforeAll(async () => {
  w = await seedItemBank();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
  teacherToken = mintToken(w.teacher, "teacher");
  studentToken = mintToken(w.studentA, "student", "21-0001");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe("the projector payload carries NO identifying field", () => {
  it("contains no name, no student ID, and no user ID", async () => {
    // Give the room something to aggregate.
    await app.inject({
      method: "POST", url: "/api/v1/attempts",
      headers: auth(studentToken), payload: { assessmentId: w.stageAssessmentId },
    });

    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live", headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);

    const body = res.body;

    // Every real identifier in the fixture world, searched for literally.
    const { rows } = await pool.query(
      "select id, full_name, student_id from profiles where full_name is not null",
    );
    expect(rows.length).toBeGreaterThan(0);

    for (const r of rows) {
      expect(body, `leaked a name: ${r.full_name}`).not.toContain(r.full_name);
      if (r.student_id) {
        expect(body, `leaked a student id: ${r.student_id}`).not.toContain(r.student_id);
      }
      expect(body, `leaked a user id: ${r.id}`).not.toContain(r.id);
    }

    // And the field names themselves, so a future join cannot sneak one in
    // without this failing.
    for (const field of ["full_name", "fullName", "student_id", "studentId", "user_id", "userId"]) {
      expect(body, `payload mentions ${field}`).not.toContain(field);
    }
  });

  it("is staff-only", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live", headers: auth(studentToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("a small cohort is suppressed rather than shown", () => {
  it("withholds the distribution below the threshold", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live", headers: auth(teacherToken),
    });
    const body = res.json();

    // The fixture world has two students, which is well under the floor.
    expect(body.cohort).toBeLessThan(body.minCohort);
    expect(body.suppressed).toBe(true);
    // Not "sent and hidden by CSS" -- not sent.
    expect(body.spread).toEqual([]);
  });

  it("tells the student view the same thing", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/live", headers: auth(studentToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().suppressed).toBe(true);
  });

  it("refuses the student view to anyone signed out", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/live" });
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
  });
});

describe("the health strip", () => {
  it("reports what a teacher needs mid-lecture, and nothing about individuals", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live/health", headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b).toHaveProperty("inProgress");
    expect(b).toHaveProperty("submittedRecently");
    // A spike in reports during a lecture usually means ONE broken item rather
    // than forty confused students, which is worth seeing immediately.
    expect(b).toHaveProperty("reportsRecently");
    expect(Object.keys(b)).toHaveLength(3);
  });
});
