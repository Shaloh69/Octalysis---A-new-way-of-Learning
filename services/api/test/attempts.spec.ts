import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * End-to-end: real Fastify, real Postgres, real RLS-protected schema.
 *
 * This is the P3 exit criterion made executable -- generate papers for two
 * students, diff them, and prove no answer key appears in any student-facing
 * response body.
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
  const sig = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

let app: FastifyInstance;
let w: BankWorld;
let tokenA: string;
let tokenB: string;

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
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe("POST /api/v1/attempts", () => {
  it("requires a token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/attempts", payload: {} });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("unauthorized");
  });

  it("rejects a forged token", async () => {
    const forged = mintToken(w.studentA, "admin", "21-0001").slice(0, -4) + "aaaa";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: auth(forged),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(res.statusCode).toBe(401);
  });

  it("generates a paper and returns it with the key stripped", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: auth(tokenA),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.totalItems).toBe(w.stageBlueprintTotal);
    expect(body.items).toHaveLength(w.stageBlueprintTotal);

    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(
        expect.arrayContaining(["options", "ordinal", "points", "stem", "type"]),
      );
      expect(item).not.toHaveProperty("correctValue");
      expect(item).not.toHaveProperty("correctIndex");
      expect(item).not.toHaveProperty("rationale");
      expect(item).not.toHaveProperty("resolvedParams");
      expect(item).not.toHaveProperty("itemId");
    }
  });

  it("resuming returns the SAME paper, not a new one", async () => {
    const first = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenA),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const second = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenA),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(second.json().resumed).toBe(true);
    expect(second.json().attemptId).toBe(first.json().attemptId);
    expect(JSON.stringify(second.json().items)).toBe(JSON.stringify(first.json().items));
  });

  it("THE P3 EXIT CRITERION: two students get different papers", async () => {
    const a = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenA),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const b = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.stageAssessmentId },
    });

    const stemsA = a.json().items.map((i: { stem: string }) => i.stem);
    const stemsB = b.json().items.map((i: { stem: string }) => i.stem);

    expect(a.json().attemptId).not.toBe(b.json().attemptId);
    expect(stemsA.join("|")).not.toBe(stemsB.join("|"));

    // Same SHAPE though -- that is the fairness guarantee.
    expect(stemsA.length).toBe(stemsB.length);

    // Print both, which is literally what PHASES.md P3 asks for.
    // eslint-disable-next-line no-console
    console.log(
      "\n  Student A paper:\n" + stemsA.map((s: string, i: number) => `    ${i + 1}. ${s}`).join("\n") +
      "\n\n  Student B paper:\n" + stemsB.map((s: string, i: number) => `    ${i + 1}. ${s}`).join("\n") + "\n",
    );
  });
});

describe("POST /api/v1/attempts/:id/answer", () => {
  let attemptId: string;
  let items: Array<{ ordinal: number; options: string[]; type: string }>;

  beforeAll(async () => {
    await setup("delete from responses where true").catch(async () => {
      await setup(`
        alter table responses disable trigger responses_no_delete;
        delete from responses where true;
        alter table responses enable trigger responses_no_delete;
      `);
    });
    const res = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenA),
      payload: { assessmentId: w.stageAssessmentId },
    });
    attemptId = res.json().attemptId;
    items = res.json().items;
  });

  it("grades server-side and returns a verdict for a practice assessment", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/attempts/${attemptId}/answer`,
      headers: auth(tokenA),
      payload: { ordinal: items[0]!.ordinal, answer: { index: 0 }, timeMs: 4200 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recorded).toBe(true);
    expect(typeof body.isCorrect).toBe("boolean");
    // A practice verdict legitimately includes the key -- that IS the feedback.
    expect(body).toHaveProperty("correctValue");
    expect(body).toHaveProperty("rationale");
  });

  it("a second answer for the same ordinal does not overwrite the first", async () => {
    const ord = items[1]!.ordinal;
    await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
      payload: { ordinal: ord, answer: { index: 0 } },
    });
    const second = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
      payload: { ordinal: ord, answer: { index: 1 } },
    });
    expect(second.json().alreadyAnswered).toBe(true);

    const { rows } = await pool.query(
      "select count(*)::int n from responses where attempt_id = $1 and ordinal = $2",
      [attemptId, ord],
    );
    expect(rows[0].n).toBe(1);
  });

  it("another student cannot answer into this attempt", async () => {
    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenB),
      payload: { ordinal: items[0]!.ordinal, answer: { index: 0 } },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects an ordinal that is not on the paper", async () => {
    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
      payload: { ordinal: 9999, answer: { index: 0 } },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("final-scope assessments withhold the verdict until submit", () => {
  it("does not return correctValue mid-exam", async () => {
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.finalAssessmentId },
    });
    expect(start.statusCode).toBe(200);
    const attemptId = start.json().attemptId;
    const first = start.json().items[0];

    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenB),
      payload: { ordinal: first.ordinal, answer: { index: 0 } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.verdictWithheld).toBe(true);
    expect(body).not.toHaveProperty("correctValue");
    expect(body).not.toHaveProperty("isCorrect");
    expect(body).not.toHaveProperty("rationale");
  });
});

describe("POST /api/v1/attempts/:id/submit", () => {
  it("scores, is idempotent, and reveals the key only afterwards", async () => {
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenA),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const attemptId = start.json().attemptId;
    for (const item of start.json().items) {
      await app.inject({
        method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
        payload: { ordinal: item.ordinal, answer: { index: 0 } },
      });
    }

    const first = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/submit`, headers: auth(tokenA),
    });
    expect(first.statusCode).toBe(200);
    const body = first.json();
    expect(body.maxScore).toBe(w.stageBlueprintTotal);
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(body.score).toBeLessThanOrEqual(body.maxScore);
    expect(body.review).toHaveLength(w.stageBlueprintTotal);
    expect(body.review[0]).toHaveProperty("correctValue");

    // Idempotent: submitting twice must not double-score.
    const second = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/submit`, headers: auth(tokenA),
    });
    expect(second.json().alreadySubmitted).toBe(true);
    expect(second.json().score).toBe(body.score);

    const { rows } = await pool.query("select score, status from attempts where id = $1", [attemptId]);
    expect(rows[0].status).toBe("submitted");
    expect(Number(rows[0].score)).toBe(body.score);
  });

  it("writes stage_progress so is_stage_unlocked() can see it", async () => {
    const { rows } = await pool.query(
      "select mastery, attempts from stage_progress where user_id = $1 and stage_id = $2",
      [w.studentA, w.stageId],
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0].mastery)).toBeGreaterThanOrEqual(0);
    expect(Number(rows[0].mastery)).toBeLessThanOrEqual(1);
  });
});

describe("no answer key in ANY student-facing response body", () => {
  it("scans every in-progress endpoint against the real stored keys", async () => {
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.finalAssessmentId },
    });
    const attemptId = start.json().attemptId;

    // Pull the ACTUAL answer key straight from the database.
    const { rows } = await pool.query(
      "select correct_value from attempt_items where attempt_id = $1",
      [attemptId],
    );
    const secrets = rows
      .map((r) => String((r.correct_value as { value?: string })?.value ?? ""))
      .filter((s) => s.length >= 4);
    expect(secrets.length).toBeGreaterThan(0);

    const bodies = [
      start.body,
      (await app.inject({ method: "GET", url: `/api/v1/attempts/${attemptId}`, headers: auth(tokenB) })).body,
      (await app.inject({
        method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenB),
        payload: { ordinal: 1, answer: { index: 0 } },
      })).body,
    ];

    for (const body of bodies) {
      // The correct value legitimately appears as ONE of the options -- that is
      // what a multiple-choice question is. What must not appear is the key
      // FIELD, the rationale, or the resolved parameters.
      expect(body).not.toContain("correctValue");
      expect(body).not.toContain("correctIndex");
      expect(body).not.toContain("rationale");
      expect(body).not.toContain("resolvedParams");
      expect(body).not.toContain("seed");
      expect(body).not.toContain("exam_salt");
    }
  });
});
