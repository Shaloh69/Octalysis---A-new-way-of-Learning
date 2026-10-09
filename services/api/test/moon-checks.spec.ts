import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * A graded moon's CHECK (docs/GRADED-MOONS-PLAN.md, ruled 8 Oct 2026): the paper
 * a student sits on one moon, scope 'moon'. A paper under hard rule 9: five
 * attempts, the best counts, it closes the chat, and nothing of it exists until
 * Start. Its correct answers still count toward the moon, as a stage check's do.
 *
 * Denial first: no token, a locked planet, a moon that is not graded, a moon
 * with no question, staff. The bank fixture's stage 07 has four moons with live
 * questions (07.1-07.4); 07.2 is switched to not graded here.
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
  await setup(`update objectives set graded = false where id = '07.2'`);

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
const ask = (objective: string, token: string) =>
  app.inject({ method: "POST", url: `/api/v1/objectives/${objective}/check`, headers: auth(token) });
const start = (assessmentId: string, token: string) =>
  app.inject({ method: "POST", url: "/api/v1/attempts", headers: auth(token), payload: { assessmentId } });
const submit = (attemptId: string, token: string) =>
  app.inject({ method: "POST", url: `/api/v1/attempts/${attemptId}/submit`, headers: auth(token) });
const count = async (sql: string, params: unknown[] = []) => Number((await pool.query(sql, params)).rows[0].n);
const checksOf = (objective: string) =>
  count("select count(*)::int n from blueprints where scope = 'moon' and objective_id = $1", [objective]);

describe("asking for a moon's check", () => {
  it("requires a token", async () => {
    expect((await app.inject({ method: "POST", url: "/api/v1/objectives/07.1/check" })).statusCode).toBe(401);
  });

  it("a moon that does not exist is not found", async () => {
    expect((await ask("07.9", tokenA)).statusCode).toBe(404);
    expect((await ask("nonsense", tokenA)).statusCode).toBe(404);
  });

  it("DENIAL: a moon of a LOCKED planet has no check to sit, and nothing is created", async () => {
    const flip = (state: string) =>
      setup("update stage_locks set state = $2 where scope = 'user' and scope_user_id = $1 and stage_id = '07'", [
        w.studentB, state,
      ]);
    await flip("locked");
    try {
      const res = await ask("07.1", tokenB);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.message).toBe("This moon's planet is locked.");
      expect(await checksOf("07.1")).toBe(0);
    } finally {
      await flip("unlocked");
    }
  });

  it("DENIAL: a moon that is NOT GRADED has no check: practise it instead", async () => {
    const res = await ask("07.2", tokenA);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/not graded/i);
    expect(await checksOf("07.2")).toBe(0);
  });

  it("DENIAL (fail-closed): a moon with no live question has nothing to sit", async () => {
    const res = await ask("07.5", tokenA);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toBe("This moon has no questions yet.");
    expect(await checksOf("07.5")).toBe(0);
  });

  it("DENIAL: staff have no student ID, so no check", async () => {
    expect((await ask("07.1", tokenT)).statusCode).toBe(403);
  });

  it("answers with the assessment to open, creates the paper once, and creates NO attempt", async () => {
    const res = await ask("07.1", tokenA);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      objectiveId: "07.1", title: "Moon 07.1 check", attemptsAllowed: 5, attemptsUsed: 0, best: null, inProgress: false,
    });
    expect(body.assessmentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await checksOf("07.1")).toBe(1);
    // Under hard rule 9 nothing of a paper exists until Start.
    expect(await count("select count(*)::int n from attempts where user_id = $1 and assessment_id = $2", [w.studentA, body.assessmentId])).toBe(0);
    // Idempotent: the same moon, the same paper, for anyone.
    const again = await ask("07.1", tokenB);
    expect(again.json().assessmentId).toBe(body.assessmentId);
    expect(await checksOf("07.1")).toBe(1);
  });

  it("the check and the journey are two papers on one moon", async () => {
    const check = (await ask("07.1", tokenA)).json().assessmentId as string;
    const j = await app.inject({ method: "POST", url: "/api/v1/objectives/07.1/journey", headers: auth(tokenA) });
    expect(j.statusCode).toBe(200);
    const journeys = await count("select count(*)::int n from blueprints where scope = 'objective' and objective_id = '07.1'");
    expect(journeys).toBe(1);
    const sameAssessment = await count(
      `select count(*)::int n from assessments a join blueprints b on b.id = a.blueprint_id
        where a.id = $1 and b.scope = 'objective'`, [check]);
    expect(sameAssessment).toBe(0);
  });
});

describe("sitting a moon's check: a paper under hard rule 9", () => {
  let assessmentId = "";
  beforeAll(async () => {
    assessmentId = (await ask("07.3", tokenA)).json().assessmentId as string;
  });

  it("Start gives every live question of that moon, key stripped, and resumes while open", async () => {
    const res = await start(assessmentId, tokenA);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const live = await count("select count(*)::int n from items where objective_id = '07.3' and status = 'live'");
    expect(body.items).toHaveLength(live);
    for (const item of body.items) {
      expect(item).not.toHaveProperty("correctValue");
      expect(item).not.toHaveProperty("correctIndex");
      expect(item).not.toHaveProperty("rationale");
    }
    const again = await start(assessmentId, tokenA);
    expect(again.json().attemptId).toBe(body.attemptId);
    expect((await ask("07.3", tokenA)).json()).toMatchObject({ attemptsUsed: 1, inProgress: true });
    await submit(body.attemptId, tokenA);
  });

  it("an open moon check closes the chat, like any paper; a journey does not", async () => {
    const open = (await start(assessmentId, tokenA)).json().attemptId as string;
    expect(await count("select (chat_paper_open($1))::int n", [w.studentA])).toBe(1);
    await submit(open, tokenA);
    expect(await count("select (chat_paper_open($1))::int n", [w.studentA])).toBe(0);
    const j = await app.inject({ method: "POST", url: "/api/v1/objectives/07.4/journey", headers: auth(tokenA) });
    expect(j.statusCode).toBe(200);
    expect(await count("select (chat_paper_open($1))::int n", [w.studentA])).toBe(0);
  });

  it("DENIAL: it is limited to five attempts, unlike the journey", async () => {
    const used = (await ask("07.3", tokenA)).json().attemptsUsed as number;
    for (let i = used; i < 5; i += 1) {
      const s = await start(assessmentId, tokenA);
      expect(s.statusCode, `attempt ${i + 1}`).toBe(200);
      await submit(s.json().attemptId, tokenA);
    }
    const sixth = await start(assessmentId, tokenA);
    expect(sixth.statusCode).toBe(403);
    expect(sixth.json().error.message).toMatch(/all 5 attempt/);
  });

  it("DENIAL: it is sat only while its planet is open", async () => {
    const id = (await ask("07.4", tokenB)).json().assessmentId as string;
    await setup("update stage_locks set state = 'locked' where scope = 'user' and scope_user_id = $1 and stage_id = '07'", [w.studentB]);
    try {
      expect((await start(id, tokenB)).statusCode).toBe(403);
    } finally {
      await setup("update stage_locks set state = 'unlocked' where scope = 'user' and scope_user_id = $1 and stage_id = '07'", [w.studentB]);
    }
  });
});

describe("its answers and its score", () => {
  it("a correct answer on a moon check counts toward the moon, exactly as a stage check's does", async () => {
    const id = (await ask("07.1", tokenB)).json().assessmentId as string;
    const s = (await start(id, tokenB)).json();
    const before = await count("select moon_correct($1, '07.1') n", [w.studentB]);
    const keys = (await pool.query(
      "select ordinal, correct_value->>'index' as idx from attempt_items where attempt_id = $1 and correct_value->>'index' is not null order by ordinal",
      [s.attemptId],
    )).rows;
    expect(keys.length).toBeGreaterThan(0);
    const r = await app.inject({
      method: "POST", url: `/api/v1/attempts/${s.attemptId}/answer`, headers: auth(tokenB),
      payload: { ordinal: Number(keys[0].ordinal), answer: { index: Number(keys[0].idx) } },
    });
    expect(r.statusCode).toBe(200);
    expect(await count("select moon_correct($1, '07.1') n", [w.studentB])).toBe(before + 1);
    await submit(s.attemptId, tokenB);
  });

  it("the best submitted sitting is reported as a share of its maximum, and the paper reaches the graded list as scope 'moon'", async () => {
    const id = (await ask("07.1", tokenB)).json().assessmentId as string;
    const s = (await start(id, tokenB)).json();
    const keys = (await pool.query(
      "select ordinal, correct_value->>'index' as idx from attempt_items where attempt_id = $1 and correct_value->>'index' is not null",
      [s.attemptId],
    )).rows;
    for (const k of keys) {
      await app.inject({
        method: "POST", url: `/api/v1/attempts/${s.attemptId}/answer`, headers: auth(tokenB),
        payload: { ordinal: Number(k.ordinal), answer: { index: Number(k.idx) } },
      });
    }
    expect((await submit(s.attemptId, tokenB)).statusCode).toBe(200);
    const state = (await ask("07.1", tokenB)).json();
    expect(state.best).toBeGreaterThan(0);
    expect(state.best).toBeLessThanOrEqual(1);
    const scope = await pool.query(
      `select b.scope from attempts a join assessments s on s.id = a.assessment_id join blueprints b on b.id = s.blueprint_id where a.id = $1`,
      [s.attemptId],
    );
    expect(scope.rows[0].scope).toBe("moon");
  });
});

describe("what the map is told of each moon", () => {
  it("every moon says whether it is graded; the one switched off says false", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tokenA) });
    expect(res.statusCode).toBe(200);
    const stage = (res.json().nodes as Array<{ id: string; objectives: Array<{ id: string; graded: boolean }> }>).find((s) => s.id === "07")!;
    const byId = new Map(stage.objectives.map((o) => [o.id, o.graded]));
    expect(byId.get("07.1")).toBe(true);
    expect(byId.get("07.2")).toBe(false);
    for (const o of stage.objectives) expect(typeof o.graded).toBe("boolean");
  });
});
