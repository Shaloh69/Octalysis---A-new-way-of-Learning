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

/* ============================================================
 * Moons open the next planet (WEB-REVAMP 3.7, 3.7a; R4.6)
 *
 * is_stage_unlocked() step 4: every GRADEABLE prerequisite has every one of
 * its moons mastered. stage_progress stops gating; it keeps its other job,
 * the check's recorded result. A moon with no live question cannot be
 * mastered, so its planet does not open the next (fail-closed), and a
 * gradeable prerequisite with no moons at all opens nothing either.
 *
 * Fresh students C and D, so nothing above leaks in. The reason is printed
 * verbatim by the map and the reader, so it is asserted word for word.
 * ========================================================== */

describe("moons open the next planet", () => {
  let studentC: string;
  let studentD: string;
  let teacherId: string;
  let tokenC: string;
  let tokenD: string;

  beforeAll(async () => {
    const { rows } = await setup(`
      with
      sec as (select id from sections where code = 'BSCPE-2A'),
      uc as (insert into auth.users (id, email, raw_app_meta_data)
             values (gen_random_uuid(), 'moon-c@octa-test.local', '{"role":"student"}') returning id),
      ud as (insert into auth.users (id, email, raw_app_meta_data)
             values (gen_random_uuid(), 'moon-d@octa-test.local', '{"role":"student"}') returning id),
      dir as (insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
              select '21-0103','Moon C',(select id from sec),'claimed'::claim_status,(select id from uc), now()
              union all
              select '21-0104','Moon D',(select id from sec),'claimed'::claim_status,(select id from ud), now()
              returning student_id),
      prof as (insert into profiles (id, student_id, full_name, section_id, role)
               select (select id from uc),'21-0103','Moon C',(select id from sec),'student'::user_role
               union all
               select (select id from ud),'21-0104','Moon D',(select id from sec),'student'::user_role
               returning id)
      select (select id from uc) c, (select id from ud) d,
             (select id from profiles where role = 'teacher' limit 1) t,
             (select count(*) from prof) + (select count(*) from dir) n
    `);
    studentC = rows[0].c;
    studentD = rows[0].d;
    teacherId = rows[0].t;
    tokenC = mintToken(studentC, "student", "21-0103");
    tokenD = mintToken(studentD, "student", "21-0104");
  });

  const unlocked = async (user: string, stage: string) =>
    (await setup("select is_stage_unlocked($1, $2) as ok", [user, stage])).rows[0].ok as boolean;
  const reason = async (token: string, stage: string) => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(token) });
    return (res.json().nodes as Array<{ id: string; state: string; lockReason: Record<string, unknown> | null }>)
      .find((n) => n.id === stage)!;
  };

  it("DENIAL: stage 02 stays shut with 01 at 100% stage mastery and its moons not mastered", async () => {
    await setup(
      `insert into stage_progress (user_id, stage_id, mastery, attempts) values ($1, '01', 1.0, 1)`,
      [studentC],
    );
    expect(await unlocked(studentC, "02")).toBe(false);
    const n = await reason(tokenC, "02");
    expect(n.state).toBe("locked");
    expect(n.lockReason).toMatchObject({
      kind: "prereq",
      blockingStages: ["01"],
      moonsMastered: 0,
      moonsTotal: 3,
      missingMoons: ["01.1", "01.2", "01.3"],
      unwrittenMoons: ["01.3"],
    });
    expect(n.lockReason!.message).toBe(
      "Unlocks when every moon of Stage 01 (Introduction) is mastered: 0 of 3 are. " +
        "Still to master: 01.1, 01.2, 01.3. 01.3 has no questions yet.",
    );
  });

  it("DENIAL (fail-closed): its answered moons mastered, an unwritten moon still holds it shut", async () => {
    await practise(tokenC, "01.1", 3);
    await practise(tokenC, "01.2", 3);
    expect(await unlocked(studentC, "02")).toBe(false);
    const n = await reason(tokenC, "02");
    expect(n.lockReason).toMatchObject({ moonsMastered: 2, moonsTotal: 3, missingMoons: ["01.3"] });
    expect(n.lockReason!.message).toBe(
      "Unlocks when every moon of Stage 01 (Introduction) is mastered: 2 of 3 are. " +
        "Still to master: 01.3. 01.3 has no questions yet.",
    );
  });

  it("opens the moment every moon is mastered, with no stage check at all", async () => {
    // 01.3's questions are written and approved: now it can be practised.
    await setup(
      `insert into items (slug, stage_id, objective_id, type, status, bloom, stem_template,
                          correct_spec, distractor_pool)
       values ('S-01-moon-3-2','01','01.3','S','live','remember','Moon 3 question 2?',
               '{"value":"right 32"}','["wrong a32","wrong b32","wrong c32"]')`,
    );
    await setup("update items set status = 'live' where slug = 'S-01-moon-3-1'");
    await practise(tokenC, "01.3", 2);
    expect(await unlocked(studentC, "02")).toBe(true);
    const n = await reason(tokenC, "02");
    expect(n.state).not.toBe("locked");
    expect(n.lockReason).toBeNull();
    // Nothing about the check moved: stage_progress was never written by practice.
    const sp = await pool.query("select mastery from stage_progress where user_id = $1 and stage_id = '01'", [studentC]);
    expect(Number(sp.rows[0].mastery)).toBe(1);
  });

  it("DENIAL: a VOIDED attempt stops counting, and the planet shuts again", async () => {
    const { rows } = await pool.query(
      `select distinct op.attempt_id from objective_progress op
        where op.user_id = $1 and op.objective_id = '01.3'`,
      [studentC],
    );
    await setup("update attempts set status = 'voided' where id = any($1)", [rows.map((r) => r.attempt_id)]);
    try {
      expect(await unlocked(studentC, "02")).toBe(false);
      expect((await reason(tokenC, "02")).lockReason).toMatchObject({ missingMoons: ["01.3"] });
    } finally {
      await setup("update attempts set status = 'submitted' where id = any($1)", [rows.map((r) => r.attempt_id)]);
    }
    expect(await unlocked(studentC, "02")).toBe(true);
  });

  it("a stage check's correct answers count toward the moons too (decision 1)", async () => {
    // D sits Stage 01's check and answers everything right; practice nothing.
    const { rows: a } = await pool.query("select id from assessments where title = 'Stage 01 Check'");
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(tokenD), payload: { assessmentId: a[0].id },
    });
    expect(start.statusCode, start.body).toBe(200);
    const attemptId = start.json().attemptId as string;
    const { rows } = await pool.query(
      `select ai.ordinal, (ai.correct_value->>'index')::int as idx, i.objective_id
         from attempt_items ai join items i on i.id = ai.item_id where ai.attempt_id = $1`,
      [attemptId],
    );
    for (const r of rows) {
      await app.inject({
        method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(tokenD),
        payload: { ordinal: r.ordinal, answer: { index: r.idx } },
      });
    }
    const counted = await pool.query(
      "select count(*)::int n from objective_progress where user_id = $1 and attempt_id = $2",
      [studentD, attemptId],
    );
    expect(counted.rows[0].n).toBe(rows.length);
    const p = await planet(tokenD, "01");
    const perMoon = new Map<string, number>();
    for (const r of rows) perMoon.set(r.objective_id, (perMoon.get(r.objective_id) ?? 0) + 1);
    for (const [moon, n] of perMoon) expect(moonOf(p, moon).correct).toBe(n);
  });

  it("an instructor's override still opens a planet whose moons are not mastered", async () => {
    await setup(
      `insert into stage_locks (scope, scope_user_id, stage_id, state, reason, actor_id)
       values ('user', $1, '02', 'unlocked', 'opened by hand', $2)`,
      [studentD, teacherId],
    );
    try {
      expect(await unlocked(studentD, "02")).toBe(true);
    } finally {
      await setup("delete from stage_locks where scope_user_id = $1", [studentD]);
    }
    expect(await unlocked(studentD, "02")).toBe(false);
  });

  it("DENIAL: a gradeable prerequisite with no moons at all opens nothing", async () => {
    // Stage 02 has no objectives in this fixture, so 03 must stay shut even for
    // a student with every moon there is: an empty bank never opens the course.
    await setup(
      `insert into stage_locks (scope, scope_user_id, stage_id, state, reason, actor_id)
       values ('user', $1, '02', 'unlocked', 'opened by hand', $2)`,
      [studentC, teacherId],
    );
    try {
      expect(await unlocked(studentC, "03")).toBe(false);
      const n = await reason(tokenC, "03");
      expect(n.lockReason!.message).toBe(
        "Unlocks when Stage 02 (Computer Evolution and Performance) has its moons: none are published yet.",
      );
    } finally {
      await setup("delete from stage_locks where scope_user_id = $1", [studentC]);
    }
  });

  it("the reader prints the same reason as the map", async () => {
    const map = await reason(tokenD, "02");
    const res = await app.inject({ method: "GET", url: "/api/v1/stages/02", headers: auth(tokenD) });
    expect(res.json().lockReason).toEqual(map.lockReason);
  });
});

/* ============================================================
 * INV-12 and a journey's length (30 Sep 2026)
 *
 * INV-12 says an attempt holds exactly its blueprint's item count: the
 * fairness check that no exam paper is silently short. A moon's journey takes
 * EVERY live question the moon has at Start, so its length follows the bank,
 * and the first journey after a question is approved would have been called
 * short. The invariant binds checks and exams; a journey is not a paper.
 * ========================================================== */

describe("INV-12 binds papers, not a moon's journey", () => {
  const offenders = async (scope: string) =>
    Number(
      (
        await pool.query(
          `select count(*)::int n from inv_12_item_count_matches_blueprint() x
             join attempts a on a.id = x.attempt_id
             join assessments s on s.id = a.assessment_id
             join blueprints b on b.id = s.blueprint_id
            where b.scope = $1`,
          [scope],
        )
      ).rows[0].n,
    );

  it("a journey's length follows its moon's bank, and INV-12 does not call that short", async () => {
    // The journey exists (created at three questions) before a fourth is approved.
    await practise(tokenA, "01.1", 0);
    await setup(
      `insert into items (slug, stage_id, objective_id, type, status, bloom, stem_template,
                          correct_spec, distractor_pool)
       values ('S-01-moon-1-4','01','01.1','S','live','remember','Moon 1 question 4?',
               '{"value":"right 14"}','["wrong a14","wrong b14","wrong c14"]')`,
    );
    const attemptId = await practise(tokenA, "01.1", 0);
    const { rows } = await pool.query(
      `select count(*)::int n, max(b.total_items) as total from attempt_items ai
         join attempts a on a.id = ai.attempt_id
         join assessments s on s.id = a.assessment_id
         join blueprints b on b.id = s.blueprint_id
        where ai.attempt_id = $1`,
      [attemptId],
    );
    expect(rows[0].n).toBe(4);
    expect(Number(rows[0].total)).toBe(3);
    expect(await offenders("objective")).toBe(0);
  });

  it("DENIAL: a stage check that is short is still an INV-12 offender", async () => {
    const before = await offenders("stage");
    await setup(
      `with a as (
         insert into attempts (user_id, assessment_id, attempt_no, seed, status)
         select $1, s.id, 5, 'short-paper', 'submitted'
           from assessments s where s.title = 'Stage 01 Check'
         returning id)
       insert into attempt_items (attempt_id, ordinal, item_id, correct_value)
       select (select id from a), 1, i.id, '{"value":"x"}' from items i where i.slug = 'S-01-moon-1-1'`,
      [studentB],
    );
    expect(await offenders("stage")).toBe(before + 1);
  });
});
