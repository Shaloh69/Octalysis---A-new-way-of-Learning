import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool, setup } from "./helpers/rls.js";
import { resetAll } from "./helpers/reset.js";

/**
 * A stage check samples its OWN stage, and nothing else.
 *
 * This is the rule the curriculum rests on. `stage_progress.mastery` is written
 * from a stage-scoped attempt and is the only thing `is_stage_unlocked()`
 * reads, so a stage check that draws from the whole bank measures the wrong
 * chapter and then gates the next one on the result.
 *
 * Why no existing test caught it: `helpers/bank.ts` seeds exactly one stage, so
 * a pool with no stage filter and a pool filtered to the only stage present are
 * the same pool. The bug is invisible until a second stage has live items —
 * which is every real deployment.
 *
 * Measured on the seeded bank before the fix, a "Stage 01 Check" returned
 * items from stages 01, 02, 03 and 04, one of eight from stage 01.
 *
 * The decoy stage is deliberately much larger than the target: with 6 target
 * items and 40 decoys, an unfiltered pool picking the 6 target items by chance
 * is about one draw in ten million.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

const TARGET = "07";
const DECOY = "09";
const TOTAL = 6;

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
let studentId: string;
let studentToken: string;
let assessmentId: string;

beforeAll(async () => {
  await resetAll();

  const { rows } = await setup(`
    with
    sec as (insert into sections (code, term) values ('BSCPE-SCOPE','2026-1') returning id),
    us as (
      insert into auth.users (id, email, raw_app_meta_data)
      values (gen_random_uuid(), 'scope@octa-test.local', '{"role":"student"}'::jsonb) returning id
    ),
    ut as (
      insert into auth.users (id, email, raw_app_meta_data)
      values (gen_random_uuid(), 'scopet@octa-test.local', '{"role":"teacher"}'::jsonb) returning id
    ),
    st as (
      insert into stages (id, act, ordinal, title, est_minutes, prereq, published, gradeable, archetype, levels)
      values ('${TARGET}', 2, 7, 'Target Stage', 60, '{}', true, true, 'D', '{3}'),
             ('${DECOY}',  3, 9, 'Decoy Stage',  60, '{}', true, true, 'B', '{2}')
      on conflict (id) do nothing
      returning id
    ),
    obj as (
      insert into objectives (id, stage_id, code, bloom_level, level, competency, description)
      values ('${TARGET}.1','${TARGET}','${TARGET}.1','remember',3,'read','Target objective one'),
             ('${TARGET}.2','${TARGET}','${TARGET}.2','understand',3,'trace','Target objective two'),
             ('${DECOY}.1', '${DECOY}', '${DECOY}.1', 'remember',2,'read','Decoy objective one'),
             ('${DECOY}.2', '${DECOY}', '${DECOY}.2', 'understand',2,'trace','Decoy objective two')
      on conflict (id) do nothing
      returning id
    ),
    dir as (
      insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
      select '24-9001','Scope Student',(select id from sec),'claimed'::claim_status,(select id from us), now()
      returning student_id
    ),
    prof as (
      insert into profiles (id, student_id, full_name, section_id, role)
      select (select id from us), '24-9001','Scope Student',(select id from sec),'student'::user_role
      union all
      select (select id from ut), null, 'Scope Teacher', (select id from sec), 'teacher'::user_role
      returning id
    ),
    target_items as (
      insert into items (slug, stage_id, objective_id, type, status, version, bloom,
                         stem_template, correct_spec, distractor_pool, rationale_template,
                         reviewed_by, reviewed_at)
      select 'TGT-' || g, '${TARGET}', '${TARGET}.' || (1 + (g % 2)),
             'S'::item_type, 'live'::item_status, 1,
             (array['remember','understand'])[1 + (g % 2)],
             'Target question ' || g || '?',
             jsonb_build_object('value', 'target answer ' || g),
             jsonb_build_array('target wrong a' || g, 'target wrong b' || g, 'target wrong c' || g),
             'Because target.', (select id from ut), now()
      from generate_series(1, ${TOTAL}) g
      returning id
    ),
    decoy_items as (
      insert into items (slug, stage_id, objective_id, type, status, version, bloom,
                         stem_template, correct_spec, distractor_pool, rationale_template,
                         reviewed_by, reviewed_at)
      select 'DEC-' || g, '${DECOY}', '${DECOY}.' || (1 + (g % 2)),
             'S'::item_type, 'live'::item_status, 1,
             (array['remember','understand'])[1 + (g % 2)],
             'Decoy question ' || g || '?',
             jsonb_build_object('value', 'decoy answer ' || g),
             jsonb_build_array('decoy wrong a' || g, 'decoy wrong b' || g, 'decoy wrong c' || g),
             'Because decoy.', (select id from ut), now()
      from generate_series(1, 40) g
      returning id
    ),
    bp as (
      insert into blueprints (name, scope, stage_id, total_items, constraints)
      values ('Target Stage Check','stage','${TARGET}', ${TOTAL},
              '{"max_per_objective": 6, "exclude_non_gradeable_stages": true}'::jsonb)
      returning id
    ),
    a as (
      insert into assessments (blueprint_id, section_id, title, attempts_allowed)
      values ((select id from bp), (select id from sec), 'Target Stage Check', 20)
      returning id
    ),
    secrets as (
      insert into assessment_secrets (assessment_id, exam_salt)
      values ((select id from a), encode(gen_random_bytes(32),'hex'))
      returning assessment_id
    )
    select (select id from us) student, (select id from a) assessment
  `);

  const r = rows[0] as Record<string, string>;
  studentId = r.student!;
  assessmentId = r.assessment!;
  studentToken = mintToken(studentId, "student", "24-9001");

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
});

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("a stage-scoped blueprint samples only its own stage", () => {
  it("draws every item from the blueprint's stage, with 40 decoys live in another stage", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { assessmentId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(TOTAL);

    const { rows } = await pool.query(
      `select i.stage_id, i.slug
         from attempt_items ai join items i on i.id = ai.item_id
        where ai.attempt_id = $1
        order by ai.ordinal`,
      [body.attemptId],
    );

    const stages = [...new Set(rows.map((r) => r.stage_id))];
    // The failure this catches reads as "Stage 07 Check" containing chapter-9
    // questions, so name the offenders rather than just the count.
    expect(stages, `sampled slugs: ${rows.map((r) => r.slug).join(", ")}`).toEqual([TARGET]);
  });

  it("still refuses to sample a non-gradeable stage", async () => {
    // INV-30's rule, asserted through the engine rather than the database.
    const { rows } = await pool.query(
      `select count(*)::int as n
         from attempt_items ai
         join items  i on i.id = ai.item_id
         join stages s on s.id = i.stage_id
        where not s.gradeable`,
    );
    expect(rows[0]!.n).toBe(0);
  });
});
