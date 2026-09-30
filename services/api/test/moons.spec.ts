import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, pool, closePool, runAs, authenticated } from "./helpers/rls.js";
import { resetAll } from "./helpers/reset.js";

/**
 * A moon's mastery, read (WEB-REVAMP 3.7a; instructor decisions 30 Sep 2026).
 *
 * A moon is mastered when the student has answered 2 DISTINCT questions of it
 * correctly, on a journey or a stage check, in any attempt that is not voided.
 * The count lives in the database (`moon_correct()`, `moon_mastered()`), ONE
 * definition that the API and `is_stage_unlocked()` both read.
 *
 * Fixture, stage 01 (open to everyone: Orientation never blocks):
 *   01.1  three live questions
 *   01.2  three live questions
 *   01.3  one question, at review: no live question (fail-closed)
 * Everything is earned through the real routes: a journey, Record, submit.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string, studentId: string | null): string {
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
let studentA: string;
let studentB: string;
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  await resetAll();
  const { rows } = await setup(`
    with
    sec as (insert into sections (code, term) values ('BSCPE-2A','2026-1') returning id),
    ua as (insert into auth.users (id, email, raw_app_meta_data)
           values (gen_random_uuid(), 'moon-a@octa-test.local', '{"role":"student"}') returning id),
    ub as (insert into auth.users (id, email, raw_app_meta_data)
           values (gen_random_uuid(), 'moon-b@octa-test.local', '{"role":"student"}') returning id),
    ut as (insert into auth.users (id, email, raw_app_meta_data)
           values (gen_random_uuid(), 'moon-t@octa-test.local', '{"role":"teacher"}') returning id),
    dir as (insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
            select '21-0101','Moon A',(select id from sec),'claimed'::claim_status,(select id from ua), now()
            union all
            select '21-0102','Moon B',(select id from sec),'claimed'::claim_status,(select id from ub), now()
            returning student_id),
    prof as (insert into profiles (id, student_id, full_name, section_id, role)
             select (select id from ua),'21-0101','Moon A',(select id from sec),'student'::user_role
             union all
             select (select id from ub),'21-0102','Moon B',(select id from sec),'student'::user_role
             union all
             select (select id from ut), null,'Instructor',(select id from sec),'teacher'::user_role
             returning id),
    obj as (insert into objectives (id, stage_id, code, bloom_level, level, competency, description)
            values ('01.1','01','01.1','remember',6,'read','Moon one'),
                   ('01.2','01','01.2','understand',6,'read','Moon two'),
                   ('01.3','01','01.3','understand',6,'read','Moon three, unwritten')
            returning id),
    its as (insert into items (slug, stage_id, objective_id, type, status, bloom, stem_template,
                               correct_spec, distractor_pool, reviewed_by, reviewed_at)
            select 'S-01-moon-' || o || '-' || g, '01', '01.' || o, 'S'::item_type,
                   (case when o = 3 then 'review' else 'live' end)::item_status, 'remember',
                   'Moon ' || o || ' question ' || g || '?',
                   jsonb_build_object('value', 'right ' || o || g),
                   jsonb_build_array('wrong a' || o || g, 'wrong b' || o || g, 'wrong c' || o || g),
                   (select id from ut), now()
              from generate_series(1,3) o cross join generate_series(1,3) g
             where o < 3 or g = 1
            returning id),
    bp as (insert into blueprints (name, scope, stage_id, total_items, constraints)
           values ('Stage 01 Check','stage','01',4,'{"max_per_objective":2}') returning id),
    a as (insert into assessments (blueprint_id, section_id, title, attempts_allowed)
          values ((select id from bp),(select id from sec),'Stage 01 Check',5) returning id),
    s as (insert into assessment_secrets (assessment_id, exam_salt)
          values ((select id from a), encode(gen_random_bytes(32),'hex')) returning assessment_id)
    select (select id from ua) a, (select id from ub) b, (select id from ut) t,
           (select count(*) from obj) + (select count(*) from its) + (select count(*) from s) n
  `);
  studentA = rows[0].a;
  studentB = rows[0].b;

  app = await buildServer(
    loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
      EXAM_SALT_SECRET: "x".repeat(40),
      SUPABASE_JWT_SECRET: JWT_SECRET,
      JWT_AUDIENCE: "authenticated",
      ENGINE_VERSION: "1.0.0",
    } as NodeJS.ProcessEnv),
  );
  await app.ready();
  tokenA = mintToken(studentA, "student", "21-0101");
  tokenB = mintToken(studentB, "student", "21-0102");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

type Moon = { id: string; correct: number; mastered: boolean; questions: number };
type Node = { id: string; objectives: Moon[]; moons: { mastered: number; total: number } | null };

async function planet(token: string, id: string): Promise<Node> {
  const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(token) });
  expect(res.statusCode).toBe(200);
  return (res.json().nodes as Node[]).find((n) => n.id === id)!;
}
const moonOf = (n: Node, id: string) => n.objectives.find((o) => o.id === id)!;

/** Enter a moon's journey and answer `right` of its questions correctly, the rest wrongly. */
async function practise(token: string, objective: string, right: number): Promise<string> {
  const res = await app.inject({ method: "POST", url: `/api/v1/objectives/${objective}/journey`, headers: auth(token) });
  expect(res.statusCode, res.body).toBe(200);
  const attemptId = res.json().attemptId as string;
  const { rows } = await pool.query(
    `select ordinal, (correct_value->>'index')::int as idx from attempt_items where attempt_id = $1 order by ordinal`,
    [attemptId],
  );
  for (const [k, r] of rows.entries()) {
    const index = k < right ? r.idx : (r.idx + 1) % 4;
    await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(token),
      payload: { ordinal: r.ordinal, answer: { index } },
    });
  }
  await app.inject({ method: "POST", url: `/api/v1/attempts/${attemptId}/submit`, headers: auth(token) });
  return attemptId;
}

describe("a moon's mastery, as the map reads it", () => {
  it("a fresh student: every moon not started, each with its live question count", async () => {
    const p = await planet(tokenA, "01");
    expect(moonOf(p, "01.1")).toMatchObject({ correct: 0, mastered: false, questions: 3 });
    expect(moonOf(p, "01.3")).toMatchObject({ correct: 0, mastered: false, questions: 0 });
    expect(p.moons).toEqual({ mastered: 0, total: 3 });
  });

  it("Orientation has no moons: a non-gradeable planet carries none to master", async () => {
    const p = await planet(tokenA, "00");
    expect(p.moons).toBeNull();
  });

  it("one right is not mastered; a second DIFFERENT question right is", async () => {
    await practise(tokenA, "01.1", 1);
    expect(moonOf(await planet(tokenA, "01"), "01.1")).toMatchObject({ correct: 1, mastered: false });
    // A new journey: the same moon's questions again; one more right (a
    // different family, since the first is already counted) masters it.
    await practise(tokenA, "01.1", 3);
    const p = await planet(tokenA, "01");
    expect(moonOf(p, "01.1")).toMatchObject({ correct: 3, mastered: true });
    expect(p.moons).toEqual({ mastered: 1, total: 3 });
  });

  it("the same question right twice counts once", async () => {
    // B answers only the FIRST question right, on two journeys.
    await practise(tokenB, "01.2", 1);
    await practise(tokenB, "01.2", 1);
    const m = moonOf(await planet(tokenB, "01"), "01.2");
    // The seed orders each journey differently, so the two firsts may be two
    // questions or one. Whatever they were, the count is distinct questions.
    const { rows } = await pool.query(
      "select count(distinct family_id)::int n from objective_progress where user_id = $1 and objective_id = '01.2'",
      [studentB],
    );
    expect(m.correct).toBe(rows[0].n);
    expect(m.mastered).toBe(rows[0].n >= 2);
  });

  it("DENIAL: one student's moons are not another's", async () => {
    expect(moonOf(await planet(tokenB, "01"), "01.1")).toMatchObject({ correct: 0, mastered: false });
  });

  it("a VOIDED attempt stops counting, with nothing deleted", async () => {
    const before = await pool.query("select count(*)::int n from objective_progress where user_id = $1", [studentA]);
    await setup("update attempts set status = 'voided' where user_id = $1", [studentA]);
    try {
      expect(moonOf(await planet(tokenA, "01"), "01.1")).toMatchObject({ correct: 0, mastered: false });
      const after = await pool.query("select count(*)::int n from objective_progress where user_id = $1", [studentA]);
      expect(after.rows[0].n).toBe(before.rows[0].n);
    } finally {
      await setup("update attempts set status = 'submitted' where user_id = $1", [studentA]);
    }
    expect(moonOf(await planet(tokenA, "01"), "01.1").mastered).toBe(true);
  });

  it("the reader carries the same per-moon mastery", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages/01", headers: auth(tokenA) });
    const o = (res.json().objectives as Moon[]).find((x) => x.id === "01.1")!;
    expect(o).toMatchObject({ correct: 3, mastered: true, questions: 3 });
  });

  it("DENIAL: a student cannot call the mastery functions for anyone, themselves included", async () => {
    const a = authenticated(studentA, "student", "moonA");
    const other = await runAs(a, "select moon_correct($1, '01.1') as n", [studentB]);
    expect(other.error?.message).toMatch(/permission denied for function moon_correct/);
    const own = await runAs(a, "select moon_mastered($1, '01.1') as ok", [studentA]);
    expect(own.error?.message).toMatch(/permission denied for function moon_mastered/);
  });
});
