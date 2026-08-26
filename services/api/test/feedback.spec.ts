import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * P8 — feedback, and the console's content-status endpoint.
 *
 * The denial tests come first, per `.claude/rules/rls.md`: proving the right
 * user succeeds proves nothing.
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
let studentAToken: string;
let studentBToken: string;

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
  studentAToken = mintToken(w.studentA, "student", "21-0001");
  studentBToken = mintToken(w.studentB, "student", "21-0002");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/* ----------------------------------------------------------- denial first */

describe("feedback triage is staff-only", () => {
  it("refuses a student token on the console feedback list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/feedback",
      headers: auth(studentAToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("forbidden");
  });

  it("refuses a student token on triage", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/console/feedback/00000000-0000-0000-0000-000000000000",
      headers: auth(studentAToken),
      payload: { status: "shipped" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("refuses an unauthenticated request outright", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/feedback" });
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
  });
});

describe("console content status is staff-only", () => {
  it("refuses a student token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/content",
      headers: auth(studentAToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

/* ---------------------------------------------------------------- reports */

describe("a content report carries the exact variant the student saw", () => {
  it("attaches the resolved instance from the student's own attempt", async () => {
    const started = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: auth(studentAToken),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(started.statusCode, JSON.stringify(started.json())).toBe(200);
    const attemptId = started.json().attemptId as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback",
      headers: auth(studentAToken),
      payload: {
        channel: "content_report",
        category: "broken",
        body: "The units in this one look wrong.",
        attemptId,
        ordinal: 1,
      },
    });
    expect(res.statusCode).toBe(201);
    // The whole point: "question 1 is wrong" is unactionable when every student
    // gets different numbers. The variant is what makes it a bug report.
    expect(res.json().variantAttached).toBe(true);

    const seen = await app.inject({
      method: "GET",
      url: "/api/v1/console/feedback",
      headers: auth(teacherToken),
    });
    const entry = seen.json().entries.find((e: { body: string }) =>
      e.body === "The units in this one look wrong.",
    );
    expect(entry).toBeDefined();
    expect(entry.resolvedVariant).toBeTruthy();
    expect(entry.resolvedVariant.stem).toBeTruthy();
    expect(entry.itemId).toBeTruthy();
  });

  it("REFUSES to attach a variant from someone else's attempt", async () => {
    // Reporting on another student's paper must not confirm the paper exists,
    // and must never copy their resolved item into a row a teacher will read as
    // if the reporter had seen it.
    const started = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: auth(studentAToken),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const otherAttempt = started.json().attemptId as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback",
      headers: auth(studentBToken),
      payload: { channel: "content_report", attemptId: otherAttempt, ordinal: 1, body: "probe" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().variantAttached).toBe(false);

    const { rows } = await pool.query(
      "select item_id, resolved_variant from feedback where body = 'probe'",
    );
    expect(rows[0]!.item_id).toBeNull();
    expect(rows[0]!.resolved_variant).toBeNull();
  });
});

/* -------------------------------------------------------------------- SUS */

describe("SUS is scored in the database, and the arithmetic is right", () => {
  it("all 5s scores 100", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback/sus",
      headers: auth(studentAToken),
      payload: { answers: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().score).toBe(50);
  });

  it("the alternating pattern scores 100 — the real best case", async () => {
    // SUS alternates polarity: odd items are positive, even items negative.
    // A user who agrees with every positive and disagrees with every negative
    // is the maximum. Answering 5 to ALL ten is self-contradictory and scores
    // 50, which the previous test pins deliberately -- getting that backwards
    // is the classic SUS implementation bug.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback/sus",
      headers: auth(studentBToken),
      payload: { answers: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1] },
    });
    expect(res.json().score).toBe(100);
  });

  it("the inverse pattern scores 0", async () => {
    const { rows } = await pool.query("select sus_score(array[1,5,1,5,1,5,1,5,1,5]) as s");
    expect(Number(rows[0]!.s)).toBe(0);
  });

  it("all 3s scores 50", async () => {
    const { rows } = await pool.query("select sus_score(array[3,3,3,3,3,3,3,3,3,3]) as s");
    expect(Number(rows[0]!.s)).toBe(50);
  });

  it("rejects anything that is not exactly ten answers of 1..5", async () => {
    for (const answers of [
      [5, 5, 5, 5, 5, 5, 5, 5, 5],
      [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      [5, 5, 5, 5, 5, 5, 5, 5, 5, 6],
      [0, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    ]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/feedback/sus",
        headers: auth(studentAToken),
        payload: { answers },
      });
      expect(res.statusCode, JSON.stringify(answers)).toBe(400);
    }
  });
});

describe("the SUS prompt does not nag", () => {
  it("never shows before three sessions and one completed attempt", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/feedback/prompt",
      headers: auth(mintToken(w.studentB, "student", "21-0002")),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // studentB has just answered, so `show` must be false regardless of counts.
    expect(body.show).toBe(false);
  });

  it("stops asking after two dismissals", async () => {
    const fresh = mintToken(w.studentA, "student", "21-0001");
    for (let i = 0; i < 2; i++) {
      const d = await app.inject({
        method: "POST",
        url: "/api/v1/feedback/prompt/dismiss",
        headers: auth(fresh),
      });
      expect(d.statusCode).toBe(200);
    }
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/feedback/prompt",
      headers: auth(fresh),
    });
    expect(res.json().show).toBe(false);
  });
});

/* -------------------------------------------------------- content status */

describe("content status tells the truth about what is authored", () => {
  it("reports every seeded stage, with a three-state authoring verdict", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/content",
      headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const { stages, summary } = res.json();

    expect(stages.length).toBe(summary.total);
    expect(summary.total).toBeGreaterThan(0);
    for (const s of stages) {
      expect(["authored", "scaffold", "empty"]).toContain(s.authoring);
    }
    // authored + scaffold + empty must account for every stage. A fourth state
    // appearing silently would make the page under-report the gap.
    expect(summary.authored + summary.scaffold + summary.empty).toBe(summary.total);
  });

  it("sets the item target from GRADEABLE stages only", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/console/content",
      headers: auth(teacherToken),
    });
    const { stages, summary } = res.json();
    const gradeable = stages.filter((s: { gradeable: boolean }) => s.gradeable).length;
    // Stage 00 is orientation and is never sampled (V-1). Counting it toward
    // the bank target would overstate the work by 40 items.
    expect(summary.itemTarget).toBe(gradeable * 40);
    expect(gradeable).toBeLessThan(summary.total);
  });
});
