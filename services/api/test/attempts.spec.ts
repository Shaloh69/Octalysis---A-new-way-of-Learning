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

  /*
   * Hard rule 4, at Start. A stage check's correct answers count toward the
   * planet's moons (WEB-REVAMP 3.7a), so sitting a LOCKED planet's check would
   * master its moons and open the planet after it: a way round the prerequisite
   * that the reader never offers but the API used to allow.
   */
  it("DENIAL: a check on a LOCKED stage cannot be started or resumed", async () => {
    const flip = (state: string) =>
      setup("update stage_locks set state = $3 where scope = 'user' and scope_user_id = $1 and stage_id = $2", [
        w.studentB, w.stageId, state,
      ]);
    await flip("locked");
    try {
      const res = await app.inject({
        method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
        payload: { assessmentId: w.stageAssessmentId },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.message).toBe("This stage is locked.");
    } finally {
      await flip("unlocked");
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
    // objective_progress cites responses and is append-only too (3.7a).
    await setup(`
      alter table objective_progress disable trigger objective_progress_no_delete;
      delete from objective_progress where true;
      alter table objective_progress enable trigger objective_progress_no_delete;
      alter table responses disable trigger responses_no_delete;
      delete from responses where true;
      alter table responses enable trigger responses_no_delete;
    `);
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

  /*
   * Instructor ruling, 29 Sep 2026 (the /app/stage/:id/check revamp).
   *
   * `responses` is first-write-wins, and the verdict used to grade the NEW
   * answer anyway: a student who clicked a second option on a recorded
   * question was told "Correct." about an answer the paper never kept. The
   * verdict must describe the answer that COUNTS, and say which one that is.
   */
  it("a repeated answer is told the verdict of the RECORDED answer, and which answer that is", async () => {
    const ord = items[1]!.ordinal; // recorded as { index: 0 } above
    const { rows } = await pool.query(
      "select is_correct, raw_answer from responses where attempt_id = $1 and ordinal = $2",
      [attemptId, ord],
    );
    const recorded = rows[0] as { is_correct: boolean; raw_answer: unknown };

    // Every other option, so at least one of them grades differently from index 0.
    for (let k = 1; k < items[1]!.options.length; k++) {
      const res = await app.inject({
        method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
        payload: { ordinal: ord, answer: { index: k } },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.alreadyAnswered).toBe(true);
      expect(body.isCorrect, `option ${k}: the verdict described the new click`).toBe(recorded.is_correct);
      expect(body.answer).toEqual({ index: 0 });
    }
    expect(recorded.raw_answer).toEqual({ index: 0 });
  });

  it("a first answer says what was recorded", async () => {
    const ord = items[2]!.ordinal;
    const res = await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenA),
      payload: { ordinal: ord, answer: { index: 1 } },
    });
    expect(res.json().alreadyAnswered).toBe(false);
    expect(res.json().answer).toEqual({ index: 1 });
  });
});

describe("a resumed paper carries the student's own recorded answers", () => {
  /*
   * Instructor ruling, 29 Sep 2026: a reopened paper shows what the student
   * recorded and, on a stage check, the verdicts they were already shown. It
   * used to come back blank -- "0 / 8 answered" over a paper with answers --
   * which invited exactly the re-answer the test above is about.
   *
   * Runs after the answer block: student A has recorded ordinals 1-3 of this
   * stage paper.
   */
  it("on a stage check: each recorded answer, with its verdict, and nothing for the rest", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenA),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      resumed: boolean; attemptId: string;
      answered: Array<{ ordinal: number; answer: unknown; verdict?: { isCorrect: boolean; correctValue: string; rationale: string } }>;
    };
    expect(body.resumed).toBe(true);

    const { rows } = await pool.query(
      "select ordinal, raw_answer, is_correct from responses where attempt_id = $1 order by ordinal",
      [body.attemptId],
    );
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(body.answered.map((a) => a.ordinal)).toEqual(rows.map((r) => Number(r.ordinal)));
    for (const [i, a] of body.answered.entries()) {
      expect(a.answer).toEqual(rows[i].raw_answer);
      expect(a.verdict?.isCorrect).toBe(rows[i].is_correct);
      expect(typeof a.verdict?.correctValue).toBe("string");
    }

    // The key appears ONLY inside a recorded answer's verdict.
    const { answered: _answered, ...rest } = body;
    expect(JSON.stringify(rest)).not.toContain("correctValue");
    expect(JSON.stringify(rest)).not.toContain("rationale");
  });

  it("another student's paper carries none of them", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().answered).toEqual([]);
    expect(res.body).not.toContain("correctValue");
  });

  it("a fresh paper carries an empty list, not a missing field", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.finalAssessmentId },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().answered)).toBe(true);
  });
});

/*
 * WEB-REVAMP 3.7a (instructor decisions, 30 Sep 2026): a correct answer on a
 * stage check or a moon journey counts toward its moon; a final never does.
 * The grading service writes objective_progress in the same step that records
 * the response, and nothing else writes it.
 */
describe("objective_progress: grading records each correct answer toward its moon", () => {
  type Key = { ordinal: number; index: number; objective_id: string; family_id: string };
  const keyOf = async (attemptId: string): Promise<Key[]> =>
    (
      await pool.query(
        `select ai.ordinal, (ai.correct_value->>'index')::int as index, i.objective_id, i.family_id
           from attempt_items ai join items i on i.id = ai.item_id
          where ai.attempt_id = $1 and (ai.correct_value->>'index')::int >= 0
            and not exists (select 1 from responses r
                             where r.attempt_id = ai.attempt_id and r.ordinal = ai.ordinal)
          order by ai.ordinal`,
        [attemptId],
      )
    ).rows as Key[];
  const rowsFor = async (attemptId: string) =>
    (
      await pool.query(
        "select ordinal, user_id, objective_id, family_id from objective_progress where attempt_id = $1 order by ordinal",
        [attemptId],
      )
    ).rows;
  const answer = (attemptId: string, token: string, ordinal: number, index: number) =>
    app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(token),
      payload: { ordinal, answer: { index } },
    });

  it("a correct stage-check answer is recorded toward its moon, copied from the item", async () => {
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const attemptId = start.json().attemptId as string;
    const [k] = await keyOf(attemptId);
    expect(k, "the paper has an unanswered option question").toBeDefined();

    const res = await answer(attemptId, tokenB, k!.ordinal, k!.index);
    expect(res.json().isCorrect).toBe(true);

    expect(await rowsFor(attemptId)).toEqual([
      { ordinal: k!.ordinal, user_id: w.studentB, objective_id: k!.objective_id, family_id: k!.family_id },
    ]);
  });

  it("a wrong answer records nothing, and a repeated correct one records once", async () => {
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const attemptId = start.json().attemptId as string;
    const before = (await rowsFor(attemptId)).length;
    const [wrong, right] = await keyOf(attemptId);

    const miss = await answer(attemptId, tokenB, wrong!.ordinal, wrong!.index === 0 ? 1 : 0);
    expect(miss.json().isCorrect).toBe(false);
    expect((await rowsFor(attemptId)).length).toBe(before);

    await answer(attemptId, tokenB, right!.ordinal, right!.index);
    const again = await answer(attemptId, tokenB, right!.ordinal, right!.index);
    expect(again.json().alreadyAnswered).toBe(true);
    expect((await rowsFor(attemptId)).length).toBe(before + 1);
  });

  it("a final never counts, even a correct answer", async () => {
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenA),
      payload: { assessmentId: w.finalAssessmentId },
    });
    const attemptId = start.json().attemptId as string;
    const [k] = await keyOf(attemptId);
    const res = await answer(attemptId, tokenA, k!.ordinal, k!.index);
    expect(res.statusCode).toBe(200);
    expect(res.json().verdictWithheld).toBe(true);
    const { rows } = await pool.query(
      "select is_correct from responses where attempt_id = $1 and ordinal = $2",
      [attemptId, k!.ordinal],
    );
    expect(rows[0].is_correct, "the answer really was correct").toBe(true);
    expect(await rowsFor(attemptId)).toEqual([]);
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

    // Resumed mid-exam: the student's own answer comes back, the verdict does not.
    const resumed = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
      payload: { assessmentId: w.finalAssessmentId },
    });
    const again = resumed.json() as { answered: Array<Record<string, unknown>> };
    expect(again.answered).toEqual([{ ordinal: first.ordinal, answer: { index: 0 } }]);
    expect(resumed.body).not.toContain("correctValue");
    expect(resumed.body).not.toContain("isCorrect");
    expect(resumed.body).not.toContain("rationale");
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

  /*
   * Ruling 4, found live 7 Oct 2026: a paper handed in by a reload came back
   * with "What you missed" listing answers but no questions, because the page
   * had nothing but the submit result. The reloaded page reads the paper here.
   */
  it("a submitted paper reads back with its questions and the student's own answers", async () => {
    const { rows: at } = await pool.query(
      "select id from attempts where user_id = $1 and status = 'submitted' order by submitted_at desc limit 1",
      [w.studentA],
    );
    const attemptId = at[0].id as string;
    const res = await app.inject({ method: "GET", url: `/api/v1/attempts/${attemptId}`, headers: auth(tokenA) });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      status: string;
      items: Array<{ ordinal: number; stem: string }>;
      answered: Array<{ ordinal: number; answer: unknown; verdict?: { isCorrect: boolean } }>;
    };
    expect(body.status).toBe("submitted");
    expect(body.items.every((i) => i.stem.length > 0)).toBe(true);
    const { rows } = await pool.query(
      "select ordinal, raw_answer, is_correct from responses where attempt_id = $1 order by ordinal",
      [attemptId],
    );
    expect(rows.length).toBe(w.stageBlueprintTotal);
    expect(body.answered.map((a) => a.ordinal)).toEqual(rows.map((r) => Number(r.ordinal)));
    for (const [i, a] of body.answered.entries()) {
      expect(a.answer).toEqual(rows[i].raw_answer);
      expect(a.verdict?.isCorrect).toBe(rows[i].is_correct);
    }
  });

  it("DENIAL: another student cannot read that submitted paper or its answers", async () => {
    const { rows: at } = await pool.query(
      "select id from attempts where user_id = $1 and status = 'submitted' limit 1",
      [w.studentA],
    );
    const res = await app.inject({ method: "GET", url: `/api/v1/attempts/${at[0].id}`, headers: auth(tokenB) });
    expect([403, 404]).toContain(res.statusCode);
    expect(res.body).not.toContain("answered");
    expect(res.body).not.toContain("stem");
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
      // A resume, now that one answer is recorded (29 Sep 2026: it carries answers).
      (await app.inject({
        method: "POST", url: "/api/v1/attempts", headers: auth(tokenB),
        payload: { assessmentId: w.finalAssessmentId },
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
