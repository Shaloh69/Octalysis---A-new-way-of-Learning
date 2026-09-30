import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * A moon's journey (WEB-REVAMP 3.2 item 5, 3.7a; instructor decisions 30 Sep
 * 2026): practice on one objective's own live questions, never graded, whose
 * correct answers count toward the moon.
 *
 * The bank fixture's stage 07 has four moons with live questions (07.1-07.4).
 * The prerequisite chain shuts it; the fixture opens it for both students by a
 * per-student override, and the denial below shuts it again for student B.
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

beforeAll(async () => {
  w = await seedItemBank();
  await setup(
    `insert into objectives (id, stage_id, code, bloom_level, level, competency, description)
     values ('07.5','07','07.5','understand',6,'read','A moon nobody has written questions for')`,
  );

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
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const enter = (objective: string, token: string) =>
  app.inject({ method: "POST", url: `/api/v1/objectives/${objective}/journey`, headers: auth(token) });
const journeysOf = async (objective: string) =>
  Number(
    (
      await pool.query(
        "select count(*)::int n from blueprints where scope = 'objective' and objective_id = $1",
        [objective],
      )
    ).rows[0].n,
  );

describe("entering a moon's journey", () => {
  it("requires a token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/objectives/07.1/journey" });
    expect(res.statusCode).toBe(401);
  });

  it("a moon that does not exist is not found", async () => {
    expect((await enter("07.9", tokenA)).statusCode).toBe(404);
    expect((await enter("nonsense", tokenA)).statusCode).toBe(404);
  });

  it("DENIAL: a moon of a LOCKED planet cannot be entered, and nothing is created", async () => {
    const flip = (state: string) =>
      setup("update stage_locks set state = $2 where scope = 'user' and scope_user_id = $1 and stage_id = '07'", [
        w.studentB, state,
      ]);
    await flip("locked");
    try {
      const res = await enter("07.1", tokenB);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.message).toBe("This moon's planet is locked.");
      expect(await journeysOf("07.1")).toBe(0);
    } finally {
      await flip("unlocked");
    }
  });

  it("DENIAL (fail-closed): a moon with no live question has nothing to enter", async () => {
    const res = await enter("07.5", tokenA);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toBe("This moon has no questions yet.");
    expect(await journeysOf("07.5")).toBe(0);
  });

  it("DENIAL: staff have no student ID, so no journey", async () => {
    expect((await enter("07.1", tokenT)).statusCode).toBe(403);
  });

  it("begins practice on EVERY live question of that moon, and nothing else, key stripped", async () => {
    const res = await enter("07.1", tokenA);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.objectiveId).toBe("07.1");
    expect(body.resumed).toBe(false);
    expect(body.answered).toEqual([]);

    const live = await pool.query(
      "select count(*)::int n from items where objective_id = '07.1' and status = 'live'",
    );
    expect(body.totalItems).toBe(live.rows[0].n);
    expect(body.items).toHaveLength(live.rows[0].n);

    for (const item of body.items) {
      expect(item).not.toHaveProperty("correctValue");
      expect(item).not.toHaveProperty("correctIndex");
      expect(item).not.toHaveProperty("rationale");
      expect(item).not.toHaveProperty("itemId");
    }

    const drawn = await pool.query(
      `select distinct i.objective_id from attempt_items ai join items i on i.id = ai.item_id
        where ai.attempt_id = $1`,
      [body.attemptId],
    );
    expect(drawn.rows.map((r) => r.objective_id)).toEqual(["07.1"]);
    expect(await journeysOf("07.1")).toBe(1);
  });

  it("entering again resumes the same journey, with the answers already given", async () => {
    const first = await enter("07.1", tokenA);
    const attemptId = first.json().attemptId as string;
    const item = first.json().items[0];
    await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
      payload: { ordinal: item.ordinal, answer: { index: 0 } },
    });
    const again = await enter("07.1", tokenA);
    expect(again.json().resumed).toBe(true);
    expect(again.json().attemptId).toBe(attemptId);
    expect(again.json().answered.map((a: { ordinal: number }) => a.ordinal)).toEqual([item.ordinal]);
    // Practice: the verdict is immediate, and a resumed journey carries it.
    expect(again.json().answered[0].verdict).toHaveProperty("isCorrect");
  });
});

describe("practising on a moon", () => {
  let attemptId: string;

  beforeAll(async () => {
    attemptId = (await enter("07.1", tokenA)).json().attemptId;
  });

  it("a correct answer is recorded toward the moon, with its verdict at once", async () => {
    const { rows } = await pool.query(
      `select ai.ordinal, (ai.correct_value->>'index')::int as index
         from attempt_items ai
        where ai.attempt_id = $1
          and not exists (select 1 from responses r where r.attempt_id = ai.attempt_id and r.ordinal = ai.ordinal)
        order by ai.ordinal limit 1`,
      [attemptId],
    );
    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
      payload: { ordinal: rows[0].ordinal, answer: { index: rows[0].index } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().isCorrect).toBe(true);
    const moon = await pool.query(
      "select objective_id from objective_progress where attempt_id = $1 and ordinal = $2",
      [attemptId, rows[0].ordinal],
    );
    expect(moon.rows).toEqual([{ objective_id: "07.1" }]);
  });

  it("DENIAL: another student cannot answer into it", async () => {
    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenB),
      payload: { ordinal: 1, answer: { index: 0 } },
    });
    expect(res.statusCode).toBe(404);
  });

  it("submitting never writes stage_progress: a journey is never the gradebook's", async () => {
    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/submit`, headers: auth(tokenA),
    });
    expect(res.statusCode).toBe(200);
    const sp = await pool.query("select 1 from stage_progress where user_id = $1", [w.studentA]);
    expect(sp.rowCount).toBe(0);
  });

  it("once submitted, the next entry is a new paper, and there is no attempt limit", async () => {
    for (let n = 0; n < 11; n++) {
      const res = await enter("07.1", tokenA);
      expect(res.statusCode, `entry ${n + 2}`).toBe(200);
      expect(res.json().resumed).toBe(false);
      const id = res.json().attemptId as string;
      expect(id).not.toBe(attemptId);
      const sub = await app.inject({
        method: "POST", url: `/api/v1/attempts/${id}/submit`, headers: auth(tokenA),
      });
      expect(sub.statusCode).toBe(200);
    }
  });
});

describe("a journey is not a teacher's assessment", () => {
  it("the console's assessments list does not show it, nor its blueprint", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/assessments", headers: auth(tokenT),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assessments.map((a: { scope: string }) => a.scope)).not.toContain("objective");
    expect(res.json().blueprints.map((b: { scope: string }) => b.scope)).not.toContain("objective");
  });

  it("DENIAL: a teacher cannot build an assessment on a journey's blueprint", async () => {
    const { rows } = await pool.query(
      "select id from blueprints where scope = 'objective' and objective_id = '07.1'",
    );
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/assessments", headers: auth(tokenT),
      payload: { blueprintId: rows[0].id, title: "Sneaky exam" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("the instructor's record of a student is their graded work", () => {
  it("lists checks and exams, and no moon's journey (practice is never graded)", async () => {
    const res = await app.inject({
      method: "GET", url: `/api/v1/console/students/${w.studentA}`, headers: auth(tokenT),
    });
    expect(res.statusCode).toBe(200);
    const scopes = (res.json().attempts as Array<{ scope: string }>).map((a) => a.scope);
    const journeys = await pool.query(
      `select count(*)::int n from attempts a join assessments s on s.id = a.assessment_id
         join blueprints b on b.id = s.blueprint_id where a.user_id = $1 and b.scope = 'objective'`,
      [w.studentA],
    );
    expect(journeys.rows[0].n, "the fixture has journeys, or this proves nothing").toBeGreaterThan(0);
    expect(scopes).not.toContain("objective");
  });
});
