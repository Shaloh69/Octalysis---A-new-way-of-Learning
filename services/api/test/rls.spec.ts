import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runAs,
  runAsSteps,
  setup,
  anon,
  authenticated,
  service,
  assertIdentity,
  wasDenied,
  denialReason,
  closePool,
  type Actor,
} from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * P0 — the security harness.
 *
 * docs/PHASES.md names six denial tests. VERIFICATION.md V-15 adds three more,
 * and hard rule 7 adds one. Every one of them is paired with a POSITIVE CONTROL:
 * the identical query, run by someone who should succeed. Without the control, a
 * typo'd table name produces a passing denial test against an open database.
 *
 * Hard rule 8: watch these fail before you make them pass. To do that, break one
 * policy in db/schema.sql, run `pnpm db:reset && pnpm test:rls`, and confirm the
 * matching test goes red. A denial test you have never seen fail is a test you
 * do not know works.
 */

let w: World;
let studentA: Actor;
let studentB: Actor;
let teacher: Actor;

beforeAll(async () => {
  w = await resetWorld();
  studentA = authenticated(w.studentA, "student", "studentA");
  studentB = authenticated(w.studentB, "student", "studentB");
  teacher = authenticated(w.teacher, "teacher", "teacher");

  // If the harness is not really authenticating, nothing below means anything.
  await assertIdentity(anon);
  await assertIdentity(studentA);
  await assertIdentity(studentB);
  await assertIdentity(teacher);
}, 60_000);

afterAll(async () => {
  await closePool();
});

/* ============================================================
 * 0. Harness integrity — these guard every other test in the file
 * ========================================================== */

describe("harness integrity", () => {
  it("a student is subject to RLS, not bypassing it", async () => {
    const res = await runAs(studentA, "select current_user as cur, auth.uid()::text as uid");
    expect(res.error).toBeNull();
    expect(res.rows[0]).toMatchObject({ cur: "authenticated", uid: w.studentA });
  });

  it("service_role bypasses RLS, which is why grading runs there and only there", async () => {
    const res = await runAs(service, "select count(*)::int as n from items");
    expect(res.error).toBeNull();
    expect(Number((res.rows[0] as { n: number }).n)).toBeGreaterThan(0);
  });

  it("the fixture answer key actually exists, so hiding it is a real test", async () => {
    const res = await setup("select count(*)::int as n from attempt_items where correct_value is not null");
    expect(Number(res.rows[0].n)).toBeGreaterThan(0);
  });
});

/* ============================================================
 * 1. The six from PHASES.md P0
 * ========================================================== */

describe("P0 denial test 1 — a student cannot SELECT from items", () => {
  const q = "select id, stem_template, correct_spec from items";

  it("denies studentA", async () => {
    const res = await runAs(studentA, q);
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("POSITIVE CONTROL: the identical query returns rows for a teacher", async () => {
    const res = await runAs(teacher, q);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBeGreaterThan(0);
  });
});

describe("P0 denial test 2 — the answer key is hidden while the attempt is in progress", () => {
  const q = "select correct_value from attempt_items where attempt_id = $1";

  it("denies studentA on their OWN in-progress attempt", async () => {
    const res = await runAs(studentA, q, [w.inProgressAttemptId]);
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("the secret string appears nowhere in the response", async () => {
    const res = await runAs(studentA, q, [w.inProgressAttemptId]);
    expect(JSON.stringify(res.rows)).not.toContain(w.secretAnswer);
  });
});

describe("P0 denial test 3 — POSITIVE CONTROL: the same student CAN read it after submitting", () => {
  it("allows studentA on their submitted attempt", async () => {
    const res = await runAs<{ correct_value: { value: string } }>(
      studentA,
      "select correct_value from attempt_items where attempt_id = $1",
      [w.submittedAttemptId],
    );
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
    expect(res.rows[0]!.correct_value.value).toBe(w.secretAnswer);
  });

  it("which proves test 2 was denying on status, not on a broken query", async () => {
    const inProgress = await runAs(studentA, "select correct_value from attempt_items where attempt_id = $1", [
      w.inProgressAttemptId,
    ]);
    const submitted = await runAs(studentA, "select correct_value from attempt_items where attempt_id = $1", [
      w.submittedAttemptId,
    ]);
    expect(inProgress.rowCount).toBe(0);
    expect(submitted.rowCount).toBe(1);
  });
});

describe("P0 denial test 4 — a student cannot UPDATE their own profiles.role", () => {
  it("denies self-promotion to teacher", async () => {
    const res = await runAs(studentA, "update profiles set role = 'teacher' where id = $1 returning role", [
      w.studentA,
    ]);
    expect(res.error, "expected the trigger to raise").not.toBeNull();
    expect(res.error!.message).toMatch(/role changes must go through the admin API/i);
  });

  it("and the row is genuinely unchanged afterwards", async () => {
    const res = await setup("select role from profiles where id = $1", [w.studentA]);
    expect(res.rows[0].role).toBe("student");
  });

  it("POSITIVE CONTROL: a student CAN update a harmless own-row field", async () => {
    const res = await runAs(studentA, "update profiles set theme = 'phosphor' where id = $1 returning theme", [
      w.studentA,
    ]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
});

describe("P0 denial test 5 — a student cannot read content_blocks for a locked stage", () => {
  const q = "select body_md from content_blocks where stage_id = $1";

  it("denies the prereq-locked stage", async () => {
    const res = await runAs(studentA, q, [w.lockedStage]);
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("denies an UNPUBLISHED stage too — unlocked is not the same as published (V-7)", async () => {
    const res = await runAs(studentA, q, [w.unpublishedStage]);
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("POSITIVE CONTROL: the same student CAN read an unlocked published stage", async () => {
    const res = await runAs(studentA, q, [w.unlockedStage]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
});

describe("P0 denial test 6 — a student cannot read another student's attempts", () => {
  const q = "select id, status from attempts where user_id = $1";

  it("denies studentB reading studentA's attempts", async () => {
    const res = await runAs(studentB, q, [w.studentA]);
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("POSITIVE CONTROL: studentA can read their own", async () => {
    const res = await runAs(studentA, q, [w.studentA]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBeGreaterThan(0);
  });

  it("and studentB cannot read studentA's responses either", async () => {
    const res = await runAs(studentB, "select raw_answer from responses where attempt_id = $1", [
      w.inProgressAttemptId,
    ]);
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });
});

/* ============================================================
 * 2. V-15 — the second door. These are the three that failed
 *    on the schema as originally shipped.
 * ========================================================== */

describe("V-15a — anon cannot read assessments", () => {
  it("denies anon", async () => {
    const res = await runAs(anon, "select id, title from assessments");
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("denies anon on every table in public, not just this one", async () => {
    for (const table of ["sections", "objectives", "stages", "profiles", "attempts", "items"]) {
      const res = await runAs(anon, `select * from ${table} limit 1`);
      expect(wasDenied(res), `anon read ${table}: ${denialReason(res)}`).toBe(true);
    }
  });
});

describe("V-15b — the exam salt is unreachable, and so is the seed", () => {
  it("no client role can read assessment_secrets at all", async () => {
    for (const actor of [anon, studentA, teacher]) {
      const res = await runAs(actor, "select exam_salt from assessment_secrets");
      expect(wasDenied(res), `${actor.label} read the salt: ${denialReason(res)}`).toBe(true);
    }
  });

  it("service_role CAN — the grading service needs it to derive the seed", async () => {
    const res = await runAs<{ exam_salt: string }>(service, "select exam_salt from assessment_secrets limit 1");
    expect(res.error).toBeNull();
    expect(res.rows[0]!.exam_salt).toBe(w.examSalt);
  });

  it("a student cannot read attempts.seed even on their own attempt", async () => {
    const res = await runAs(studentA, "select seed from attempts where id = $1", [w.inProgressAttemptId]);
    expect(res.error, "expected a column privilege error").not.toBeNull();
    expect(res.error!.message).toMatch(/permission denied|column/i);
  });

  it("nor via select * — the column revoke covers the wildcard", async () => {
    const res = await runAs(studentA, "select * from attempts where id = $1", [w.inProgressAttemptId]);
    expect(wasDenied(res), `select * leaked the seed: ${denialReason(res)}`).toBe(true);
  });

  it("POSITIVE CONTROL: they can still read the non-secret columns of their attempt", async () => {
    const res = await runAs(studentA, "select id, status, score from attempts where id = $1", [
      w.inProgressAttemptId,
    ]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
});

describe("V-15c — anon cannot read objectives for an unpublished stage", () => {
  it("denies anon outright", async () => {
    const res = await runAs(anon, "select id from objectives");
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("denies an authenticated student the objectives of an unpublished stage", async () => {
    await setup(
      `insert into objectives (id, stage_id, code, bloom_level, level, competency, description)
       values ('99.1','99','99.1','remember',6,'read','Draft objective')
       on conflict (id) do nothing`,
    );
    const res = await runAs(studentA, "select id from objectives where stage_id = $1", [w.unpublishedStage]);
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });
});

/* ============================================================
 * 3. Hard rule 7 — the write path does not exist for clients
 * ========================================================== */

describe("hard rule 7 — responses and attempt_items are service-role only", () => {
  it("CRITICAL: a student cannot INSERT their own response", async () => {
    const res = await runAs(
      studentA,
      `insert into responses (attempt_id, ordinal, raw_answer, is_correct, points)
       values ($1, 99, '{"value":"anything"}'::jsonb, true, 1) returning ordinal`,
      [w.inProgressAttemptId],
    );
    expect(res.error, "a student writing is_correct = true is a critical finding").not.toBeNull();
  });

  it("CRITICAL: a student cannot INSERT an attempt_items row", async () => {
    const res = await runAs(
      studentA,
      `insert into attempt_items (attempt_id, ordinal, item_id, correct_value)
       values ($1, 98, $2, '{"value":"forged"}'::jsonb) returning ordinal`,
      [w.inProgressAttemptId, w.itemId],
    );
    expect(res.error).not.toBeNull();
  });

  it("responses are append-only, for service_role too", async () => {
    const upd = await runAs(service, "update responses set is_correct = true where attempt_id = $1", [
      w.inProgressAttemptId,
    ]);
    expect(upd.error?.message).toMatch(/append-only/i);

    const del = await runAs(service, "delete from responses where attempt_id = $1", [w.inProgressAttemptId]);
    expect(del.error?.message).toMatch(/append-only/i);
  });
});

/* ============================================================
 * 4. V-22 — the final exam does not leak a running score
 * ========================================================== */

describe("V-22 — verdicts are immediate for practice, withheld for the final", () => {
  it("a practice response verdict is readable in progress", async () => {
    const res = await runAs(studentA, "select is_correct from responses where attempt_id = $1", [
      w.inProgressAttemptId,
    ]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });

  it("a FINAL response verdict is NOT readable before submit", async () => {
    const res = await runAs(studentA, "select is_correct from responses where attempt_id = $1", [
      w.finalAttemptId,
    ]);
    expect(wasDenied(res), `running score leaked mid-exam: ${denialReason(res)}`).toBe(true);
  });
});

/* ============================================================
 * 5. V-16 — lock_at actually closes a window
 * ========================================================== */

describe("V-16 — is_stage_unlocked() honours lock_at", () => {
  it("an override with lock_at in the past is LOCKED", async () => {
    await setup(
      `insert into stage_locks (scope, scope_user_id, stage_id, state, unlock_at, lock_at, reason, actor_id)
       values ('user', $1, '05', 'unlocked', now() - interval '2 days', now() - interval '1 day', 'test window', $2)
       on conflict do nothing`,
      [w.studentA, w.teacher],
    );
    const res = await setup("select is_stage_unlocked($1,'05') as ok", [w.studentA]);
    expect(res.rows[0].ok).toBe(false);
    await setup("delete from stage_locks where scope_user_id = $1", [w.studentA]);
  });

  it("the same override with lock_at in the future is UNLOCKED", async () => {
    await setup(
      `insert into stage_locks (scope, scope_user_id, stage_id, state, unlock_at, lock_at, reason, actor_id)
       values ('user', $1, '05', 'unlocked', now() - interval '1 day', now() + interval '1 day', 'test window', $2)`,
      [w.studentA, w.teacher],
    );
    const res = await setup("select is_stage_unlocked($1,'05') as ok", [w.studentA]);
    expect(res.rows[0].ok).toBe(true);
    await setup("delete from stage_locks where scope_user_id = $1", [w.studentA]);
  });

  it("global exam mode locks practice content for everyone", async () => {
    await setup(
      `insert into stage_locks (scope, stage_id, state, lock_at, reason, actor_id)
       values ('global', '00', 'locked', null, 'exam mode', $1)`,
      [w.teacher],
    );
    const res = await setup("select is_stage_unlocked($1,'00') as ok", [w.studentA]);
    expect(res.rows[0].ok).toBe(false);
    await setup("delete from stage_locks where scope = 'global'");
  });
});

/* ============================================================
 * 5b. WEB-REVAMP §3.7 — a non-gradeable prerequisite never blocks
 *
 * Instructor ruling, 25 Sep 2026. Orientation (00) is gradeable = false: it
 * has no questions, so no mastery can ever be earned there, and requiring 70%
 * of it kept stage 01 shut for every student by no path that exists. The rule
 * is narrow on purpose: it removes an unsatisfiable edge and nothing else. A
 * gradeable prerequisite still blocks, an override still wins, and nothing a
 * student can write moves a lock.
 * ========================================================== */

describe("§3.7 — a non-gradeable prerequisite never blocks", () => {
  it("stage 01 is open to a student with no progress anywhere (its only prereq is 00)", async () => {
    const res = await setup("select is_stage_unlocked($1,'01') as ok", [w.studentA]);
    expect(res.rows[0].ok).toBe(true);
  });

  it("DENIAL: a gradeable prerequisite still blocks — stage 02 stays shut without 01", async () => {
    const res = await setup("select is_stage_unlocked($1,'02') as ok", [w.studentA]);
    expect(res.rows[0].ok).toBe(false);
  });

  it("DENIAL: beside a gradeable prereq, a non-gradeable one excuses nothing", async () => {
    // No seeded stage has two prerequisites, so borrow the unpublished fixture
    // stage: is_stage_unlocked() does not read `published`, cb_read does.
    await setup("update stages set prereq = '{00,01}' where id = '99'");
    try {
      const shut = await setup("select is_stage_unlocked($1,'99') as ok", [w.studentA]);
      expect(shut.rows[0].ok).toBe(false);

      // Since 30 Sep 2026 moons open planets (3.7a), and stage mastery opens
      // nothing, not even 100% of it. The open half, earned through real
      // journeys and checks, is `moons.spec.ts`.
      await setup(
        `insert into stage_progress (user_id, stage_id, mastery) values ($1,'01',1.0)`,
        [w.studentA],
      );
      const still = await setup("select is_stage_unlocked($1,'99') as ok", [w.studentA]);
      expect(still.rows[0].ok).toBe(false);
    } finally {
      await setup("delete from stage_progress where user_id = $1", [w.studentA]);
      await setup("update stages set prereq = '{}' where id = '99'");
    }
  });

  it("DENIAL: a global override still closes stage 01 (exam mode is not excused)", async () => {
    await setup(
      `insert into stage_locks (scope, stage_id, state, reason, actor_id)
       values ('global', '01', 'locked', 'exam mode', $1)`,
      [w.teacher],
    );
    try {
      const res = await setup("select is_stage_unlocked($1,'01') as ok", [w.studentA]);
      expect(res.rows[0].ok).toBe(false);
    } finally {
      await setup("delete from stage_locks where scope = 'global'");
    }
  });

  /*
   * The new rule gives a student one more thing to aim at: make a prerequisite
   * look non-gradeable. Every path by which they could write their way past a
   * lock is tried here, and each must be refused.
   */
  it("DENIAL: a student cannot mark stage 01 non-gradeable to open stage 02", async () => {
    const res = await runAs(studentA, "update stages set gradeable = false where id = '01'");
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
    const still = await setup("select gradeable from stages where id = '01'");
    expect(still.rows[0].gradeable).toBe(true);
  });

  it("DENIAL: a student cannot clear stage 02's prerequisites", async () => {
    const res = await runAs(studentA, "update stages set prereq = '{}' where id = '02'");
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("DENIAL: a student cannot write their own stage_progress", async () => {
    const res = await runAs(
      studentA,
      "insert into stage_progress (user_id, stage_id, mastery) values (auth.uid(), '01', 1)",
    );
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("DENIAL: a student cannot write themselves an unlock override", async () => {
    const res = await runAs(
      studentA,
      `insert into stage_locks (scope, scope_user_id, stage_id, state, reason, actor_id)
       values ('user', auth.uid(), '02', 'unlocked', 'self-service', auth.uid())`,
    );
    expect(wasDenied(res), `expected denial, got ${denialReason(res)}`).toBe(true);
  });

  it("and after every attempt above, stage 02 is still shut", async () => {
    const res = await setup("select is_stage_unlocked($1,'02') as ok", [w.studentA]);
    expect(res.rows[0].ok).toBe(false);
  });
});

/* ============================================================
 * 5c. WEB-REVAMP §3.7a — objective_progress, a moon's mastery
 *
 * Instructor decisions, 30 Sep 2026. One row per correct answer that counts
 * toward a moon, keyed to the response itself, written by the grading service
 * alone. A correct answer on a stage check or a moon journey counts; a final
 * never does. Append-only like `responses`, for service_role too. A student
 * reads their own rows, staff read all, and NOBODY writes through a client:
 * unlike `stage_progress`, staff have no write policy, because a hand-set
 * mastery would be a second author of a fact the responses already hold.
 *
 * Every denial asserts its exact error, never just `wasDenied()`: that helper
 * counts "relation does not exist" as a denial, so without the message match
 * these tests would pass before the table existed.
 * ========================================================== */

describe("§3.7a — objective_progress is written by grading alone", () => {
  // ordinal 1: correct, 03.1 · ordinal 2: WRONG, 03.1 · ordinal 3: correct, 03.2
  // ordinal 4: correct, 03.1, left unrecorded so the mismatches have a target
  let checkAttempt: string;
  let fam1: string;
  let fam2: string;
  let fam3: string;
  const REFUSED_TO_CLIENT =
    /permission denied for table objective_progress|row-level security policy for table "objective_progress"/;

  const insertAs = (actor: Actor, ordinal: number, objective: string, family: string, user?: string) =>
    runAs(
      actor,
      `insert into objective_progress (attempt_id, ordinal, user_id, objective_id, family_id)
       values ($1, $2, $3, $4, $5) returning ordinal`,
      [checkAttempt, ordinal, user ?? w.studentA, objective, family],
    );

  beforeAll(async () => {
    const { rows } = await setup(
      `
      with
      obj as (
        insert into objectives (id, stage_id, code, bloom_level, level, competency, description)
        values ('03.1','03','03.1','understand',6,'read','Fixture moon one'),
               ('03.2','03','03.2','understand',6,'read','Fixture moon two')
        returning id
      ),
      i1 as (
        insert into items (slug, stage_id, objective_id, type, status, bloom, stem_template, correct_spec)
        values ('S-03-moon-1','03','03.1','S','live','understand','Moon one, question one','{"value":"yes"}')
        returning id, family_id
      ),
      i2 as (
        insert into items (slug, stage_id, objective_id, type, status, bloom, stem_template, correct_spec)
        values ('S-03-moon-2','03','03.1','S','live','understand','Moon one, question two','{"value":"yes"}')
        returning id, family_id
      ),
      i3 as (
        insert into items (slug, stage_id, objective_id, type, status, bloom, stem_template, correct_spec)
        values ('S-03-moon-3','03','03.2','S','live','understand','Moon two, question one','{"value":"yes"}')
        returning id, family_id
      ),
      at as (
        insert into attempts (user_id, assessment_id, attempt_no, seed, status)
        values ($1, $2, 3, 'seed-moons', 'in_progress')
        returning id
      ),
      ai as (
        insert into attempt_items (attempt_id, ordinal, item_id, correct_value)
        values ((select id from at), 1, (select id from i1), '{"value":"yes"}'),
               ((select id from at), 2, (select id from i2), '{"value":"yes"}'),
               ((select id from at), 3, (select id from i3), '{"value":"yes"}'),
               ((select id from at), 4, (select id from i1), '{"value":"yes"}'),
               ($3::uuid,             2, (select id from i1), '{"value":"yes"}')
        returning attempt_id
      ),
      rs as (
        insert into responses (attempt_id, ordinal, raw_answer, is_correct, points)
        values ((select id from at), 1, '{"value":"yes"}', true,  1),
               ((select id from at), 2, '{"value":"no"}',  false, 0),
               ((select id from at), 3, '{"value":"yes"}', true,  1),
               ((select id from at), 4, '{"value":"yes"}', true,  1),
               ($3::uuid,             2, '{"value":"yes"}', true,  1)
        returning attempt_id
      )
      select (select id from at) as attempt,
             (select family_id from i1) as f1,
             (select family_id from i2) as f2,
             (select family_id from i3) as f3,
             (select count(*) from obj) + (select count(*) from ai) + (select count(*) from rs) as n
      `,
      [w.studentA, w.practiceAssessmentId, w.finalAttemptId],
    );
    checkAttempt = rows[0].attempt;
    fam1 = rows[0].f1;
    fam2 = rows[0].f2;
    fam3 = rows[0].f3;
  });

  it("POSITIVE CONTROL: the grading service records a correct stage-check answer", async () => {
    const res = await insertAs(service, 1, "03.1", fam1);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
    const again = await insertAs(service, 3, "03.2", fam3);
    expect(again.error).toBeNull();

    // runAs always rolls back, so the rows the tests below read are committed
    // here, by the owner, through the same earned-trigger.
    await setup(
      `insert into objective_progress (attempt_id, ordinal, user_id, objective_id, family_id)
       values ($1, 1, $2, '03.1', $3), ($1, 3, $2, '03.2', $4)`,
      [checkAttempt, w.studentA, fam1, fam3],
    );
  });

  it("DENIAL: a student cannot write their own row, even for a correct answer", async () => {
    const res = await runAs(
      studentA,
      `insert into objective_progress (attempt_id, ordinal, user_id, objective_id, family_id)
       values ($1, 4, auth.uid(), '03.1', $2) returning ordinal`,
      [checkAttempt, fam1],
    );
    expect(res.error?.message ?? "succeeded").toMatch(REFUSED_TO_CLIENT);
  });

  it("DENIAL: staff cannot write it either — no hand-set mastery", async () => {
    const res = await insertAs(teacher, 4, "03.1", fam1);
    expect(res.error?.message ?? "succeeded").toMatch(REFUSED_TO_CLIENT);
    const upd = await runAs(teacher, "update objective_progress set objective_id = '03.2' returning ordinal");
    expect(upd.error?.message ?? `updated ${upd.rowCount}`).toMatch(REFUSED_TO_CLIENT);
    const del = await runAs(teacher, "delete from objective_progress returning ordinal");
    expect(del.error?.message ?? `deleted ${del.rowCount}`).toMatch(REFUSED_TO_CLIENT);
  });

  it("DENIAL: append-only — service_role cannot UPDATE, DELETE or TRUNCATE it", async () => {
    const upd = await runAs(service, "update objective_progress set objective_id = '03.2' where attempt_id = $1", [
      checkAttempt,
    ]);
    expect(upd.error?.message).toMatch(/objective_progress is append-only/);
    const del = await runAs(service, "delete from objective_progress where attempt_id = $1", [checkAttempt]);
    expect(del.error?.message).toMatch(/objective_progress is append-only/);
    const tru = await runAs(service, "truncate objective_progress");
    expect(tru.error?.message).toMatch(/objective_progress is append-only/);
    const still = await setup("select count(*)::int n from objective_progress where attempt_id = $1", [checkAttempt]);
    expect(still.rows[0].n).toBe(2);
  });

  it("DENIAL: a row for an INCORRECT response is refused, for service_role too", async () => {
    const res = await insertAs(service, 2, "03.1", fam2);
    expect(res.error?.message).toMatch(/not a correct answer/);
  });

  it("DENIAL: a row with no response behind it is refused", async () => {
    const res = await insertAs(service, 9, "03.1", fam1);
    expect(res.error?.message).toMatch(/no recorded response/);
  });

  it("DENIAL: the user, the objective and the question must be the answer's own", async () => {
    const wrongUser = await insertAs(service, 4, "03.1", fam1, w.studentB);
    expect(wrongUser.error?.message).toMatch(/does not match/);
    const wrongMoon = await insertAs(service, 4, "03.2", fam1);
    expect(wrongMoon.error?.message).toMatch(/does not match/);
    const wrongQuestion = await insertAs(service, 4, "03.1", fam3);
    expect(wrongQuestion.error?.message).toMatch(/does not match/);
  });

  it("DENIAL: a final never counts, even a correct answer", async () => {
    const res = await runAs(
      service,
      `insert into objective_progress (attempt_id, ordinal, user_id, objective_id, family_id)
       values ($1, 2, $2, '03.1', $3) returning ordinal`,
      [w.finalAttemptId, w.studentA, fam1],
    );
    expect(res.error?.message).toMatch(/a final never counts/);
  });

  it("POSITIVE CONTROL: a student reads their own rows, staff read all", async () => {
    const own = await runAs(studentA, "select ordinal from objective_progress where attempt_id = $1", [checkAttempt]);
    expect(own.error).toBeNull();
    expect(own.rowCount).toBe(2);
    const staff = await runAs(teacher, "select ordinal from objective_progress where attempt_id = $1", [checkAttempt]);
    expect(staff.error).toBeNull();
    expect(staff.rowCount).toBe(2);
  });

  it("DENIAL: student B cannot read student A's rows", async () => {
    // A's rows exist, or "B sees none" would pass on an empty table.
    const there = await setup("select count(*)::int n from objective_progress where user_id = $1", [w.studentA]);
    expect(there.rows[0].n).toBeGreaterThan(0);
    const res = await runAs(studentB, "select ordinal from objective_progress where user_id = $1", [w.studentA]);
    expect(res.error).toBeNull(); // the table exists and B may query it...
    expect(res.rowCount).toBe(0); // ...and sees none of A's rows
  });

  it("DENIAL: anon reads nothing", async () => {
    const res = await runAs(anon, "select ordinal from objective_progress");
    expect(res.error?.message).toMatch(/permission denied for table objective_progress/);
  });
});

/* ============================================================
 * 6. V-20 — soft delete is the supported deactivation path
 * ========================================================== */

describe("V-20 — soft delete", () => {
  it("a soft-deleted student loses access to their own profile", async () => {
    await setup("update profiles set deleted_at = now() where id = $1", [w.studentB]);
    const res = await runAs(studentB, "select id from profiles where id = $1", [w.studentB]);
    expect(wasDenied(res), `soft-deleted user still readable: ${denialReason(res)}`).toBe(true);
    await setup("update profiles set deleted_at = null where id = $1", [w.studentB]);
  });

  it("hard-deleting an auth user with history is refused", async () => {
    let err: { message: string } | null = null;
    try {
      await setup("delete from auth.users where id = $1", [w.studentA]);
    } catch (e) {
      err = e as { message: string };
    }

    expect(err, "a student with graded history must not be hard-deletable").not.toBeNull();

    // Which constraint fires first is worth knowing and is NOT the append-only
    // trigger: student_directory.claimed_by references auth.users with no ON
    // DELETE action, so the FK blocks the delete before the cascade ever reaches
    // `responses`. The user is protected either way, but the error names
    // student_directory — which is why V-20 says soft delete must be the
    // documented path rather than something people discover from a stack trace.
    expect(err!.message).toMatch(/violates foreign key constraint|append-only/i);
  });

  it("and the responses trigger blocks deletion directly, for service_role too", async () => {
    const res = await runAs(service, "delete from responses where attempt_id = $1", [
      w.inProgressAttemptId,
    ]);
    expect(res.error?.message).toMatch(/append-only/i);
  });
});

/* ============================================================
 * Content review — /content, 28 Sep 2026
 *
 * A draft summary is UNREVIEWED text. `stages` is readable by every student
 * for a published stage, and RLS is per row, not per column, so a draft kept
 * on `stages` would be a draft any student can read through supabase-js. It
 * lives in `stage_summaries`, staff-only, and reaches `stages.summary` only
 * once approved, which a trigger enforces for every role.
 *
 * Every denial asserts the OUTCOME, not just `wasDenied()`: that helper counts
 * any error as a denial, "relation does not exist" included, so a denial test
 * on a table that does not exist yet would pass. Each has a positive control.
 * ========================================================== */
describe("content review — drafts and history are staff-only", () => {
  const DRAFT = "An unreviewed draft summary of orientation.";

  beforeAll(async () => {
    await setup(
      `insert into stage_summaries (stage_id, draft, draft_hash)
       values ('00', $1, 'hash-of-draft-00')
       on conflict (stage_id) do update
         set draft = excluded.draft, draft_hash = excluded.draft_hash,
             status = 'draft', approved_hash = null, note = null`,
      [DRAFT],
    );
    // A superuser write, as sync makes: the archive trigger must fire for it too.
    await setup(
      "update content_blocks set body_md = 'Welcome to the boot sequence, revised.' where stage_id = '00' and ordinal = 1",
    );
  });

  it("a student cannot read a draft summary", async () => {
    const res = await runAs<{ draft: string }>(studentA, "select draft from stage_summaries");
    expect(res.error, `expected a silent RLS filter, got ${denialReason(res)}`).toBeNull();
    expect(res.rowCount).toBe(0);
  });

  it("POSITIVE CONTROL: a teacher can read it", async () => {
    const res = await runAs<{ draft: string }>(teacher, "select draft from stage_summaries where stage_id = '00'");
    expect(res.error).toBeNull();
    expect(res.rows.map((r) => r.draft)).toEqual([DRAFT]);
  });

  it("a student cannot read the versions a block replaced", async () => {
    const res = await runAs(studentA, "select body_md from content_block_versions where stage_id = '00'");
    expect(res.error, `expected a silent RLS filter, got ${denialReason(res)}`).toBeNull();
    expect(res.rowCount).toBe(0);
  });

  it("POSITIVE CONTROL: a teacher can, and the superuser write above was archived", async () => {
    const res = await runAs<{ body_md: string; replaced_via: string }>(
      teacher,
      "select body_md, replaced_via from content_block_versions where stage_id = '00' and ordinal = 1",
    );
    expect(res.error).toBeNull();
    expect(res.rows).toEqual([{ body_md: "Welcome to the boot sequence.", replaced_via: "direct" }]);
  });

  it("a teacher cannot approve a summary behind the API's back", async () => {
    const res = await runAs(
      teacher,
      "update stage_summaries set status = 'approved', approved_hash = draft_hash where stage_id = '00'",
    );
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rowCount, "an approval with no audit row got through").toBe(0);
  });

  it("no role can put an unreviewed summary in front of students — service_role included", async () => {
    for (const actor of [teacher, service]) {
      const res = await runAs(actor, "update stages set summary = $1 where id = '00'", [DRAFT]);
      expect(res.error?.message, `${actor.label} wrote an unreviewed summary`).toMatch(/not been approved/i);
    }
  });

  it("POSITIVE CONTROL: the approved text itself is allowed onto stages", async () => {
    const res = await runAsSteps(service, [
      ["update stage_summaries set status = 'approved', approved_hash = draft_hash where stage_id = '00'"],
      ["update stages set summary = $1 where id = '00'", [DRAFT]],
    ]);
    expect(res.error, denialReason(res)).toBeNull();
  });

  it("clearing a summary is always allowed: withdrawing must never be blocked", async () => {
    const res = await runAs(teacher, "update stages set summary = null where id = '00'");
    expect(res.error, denialReason(res)).toBeNull();
  });

  it("a block's history is append-only, for service_role too", async () => {
    const upd = await runAs(service, "update content_block_versions set body_md = 'rewritten' where stage_id = '00'");
    expect(upd.error?.message).toMatch(/append-only/i);
    const del = await runAs(service, "delete from content_block_versions where stage_id = '00'");
    expect(del.error?.message).toMatch(/append-only/i);
  });

  it("a staff write straight to content_blocks keeps the text it replaced, and bumps the version", async () => {
    const res = await runAsSteps(teacher, [
      ["update content_blocks set body_md = 'A direct edit.' where stage_id = '00' and ordinal = 1"],
      [`select v.body_md, v.version, v.replaced_via,
                (select version from content_blocks where stage_id = '00' and ordinal = 1) as now_version
           from content_block_versions v
          where v.stage_id = '00' and v.ordinal = 1
          order by v.version desc limit 1`],
    ]);
    expect(res.error, denialReason(res)).toBeNull();
    const row = res.rows[0] as unknown as { body_md: string; version: number; replaced_via: string; now_version: number };
    expect(row.body_md).toBe("Welcome to the boot sequence, revised.");
    expect(row.replaced_via).toBe("direct");
    expect(Number(row.now_version)).toBe(Number(row.version) + 1);
  });
});

/* ============================================================
 * The audit log is the evidence — append-only, for every role
 *
 * PAGE-SPECS.md §/console/audit: "Immutable ... If a grade is ever challenged,
 * this is the evidence." Until 28 Sep 2026 only RLS stood behind that: staff
 * could SELECT and nobody else could do anything, but service_role, the API's
 * own connection and a dashboard SQL editor could rewrite or delete any row.
 * The same triggers as `responses` now refuse it (instructor, 28 Sep 2026).
 * ========================================================== */
describe("the audit log is append-only, for service_role too", () => {
  let rowId: string;

  beforeAll(async () => {
    const { rows } = await setup(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1, 'lock.set', 'stage', '05', '{"reason":"the evidence under test"}'::jsonb)
       returning id`,
      [w.teacher],
    );
    rowId = String(rows[0].id);
  });

  it("POSITIVE CONTROL: service_role can still append", async () => {
    const res = await runAs(
      service,
      `insert into audit_log (action, target_type, target_id) values ('lock.window', 'stage', '06') returning id`,
    );
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rowCount).toBe(1);
  });

  it("service_role cannot UPDATE an entry", async () => {
    const res = await runAs(service, "update audit_log set payload = '{}'::jsonb where id = $1 returning id", [rowId]);
    expect(res.error?.message, denialReason(res)).toMatch(/append-only/i);
  });

  it("service_role cannot DELETE an entry", async () => {
    const res = await runAs(service, "delete from audit_log where id = $1 returning id", [rowId]);
    expect(res.error?.message, denialReason(res)).toMatch(/append-only/i);
  });

  it("service_role cannot TRUNCATE the log", async () => {
    const res = await runAs(service, "truncate audit_log");
    expect(res.error?.message, denialReason(res)).toMatch(/append-only/i);
  });

  it("a teacher can read it and change nothing", async () => {
    const read = await runAs(teacher, "select id from audit_log where id = $1", [rowId]);
    expect(read.rowCount, "POSITIVE CONTROL: staff read the log").toBe(1);

    await runAs(teacher, "update audit_log set payload = '{}'::jsonb where id = $1", [rowId]);
    await runAs(teacher, "delete from audit_log where id = $1", [rowId]);
    const { rows } = await setup("select payload->>'reason' as reason from audit_log where id = $1", [rowId]);
    expect(rows[0]?.reason, "the entry survived a teacher's update and delete, unchanged").toBe(
      "the evidence under test",
    );
  });

  it("a student cannot read it", async () => {
    const res = await runAs(studentA, "select id from audit_log where id = $1", [rowId]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
});

/*
 * `/system` reads `audit_runs` from 28 Sep 2026: the nightly invariant record,
 * whose samples carry student ids and item slugs. Staff only (`ar_admin`). The
 * table existed before this and had no denial test.
 *
 * Watched failing: with `ar_admin` changed to `using (true)` and the database
 * reset, the first test went red (a student read the row).
 */
describe("the nightly invariant record is staff-only", () => {
  let runId: string;

  beforeAll(async () => {
    const { rows } = await setup(
      `insert into audit_runs (finished_at, triggered_by, results, passed)
       values (now(), 'cron', '[{"id":"INV-05","severity":"fail","offending_count":1,"sample":[{"student_id":"21-0001"}]}]', false)
       returning id::text as id`,
    );
    runId = rows[0].id as string;
  });

  afterAll(async () => {
    await setup("delete from audit_runs where id = $1::bigint", [runId]);
  });

  it("a student cannot read a nightly run", async () => {
    const res = await runAs(studentA, "select id from audit_runs where id = $1::bigint", [runId]);
    expect(res.error, `expected a silent RLS filter, got ${denialReason(res)}`).toBeNull();
    expect(res.rowCount, "a student read the invariant record").toBe(0);
  });

  it("POSITIVE CONTROL: a teacher can", async () => {
    const res = await runAs(teacher, "select id from audit_runs where id = $1::bigint", [runId]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });

  it("a teacher cannot write one: the record is the scheduler's", async () => {
    const res = await runAs(teacher, "insert into audit_runs (triggered_by) values ('forged') returning id");
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
});

/*
 * Lecture Mode — /live, 29 Sep 2026
 *
 * A session is started and ended by the API with an audit row, and an answer
 * will be written by the grading service alone, as `responses` is. So both
 * tables are staff-READ and client-write-never, and neither is readable by a
 * student: what a student may see of a question reaches them through the API's
 * one serializer. An ended session is a record, and answers are append-only,
 * for service_role too.
 *
 * Every denial asserts the OUTCOME and has a positive control: `wasDenied()`
 * counts "relation does not exist" as a denial.
 */
describe("Lecture Mode — sessions and answers are staff-read, client-write-never", () => {
  let sessionId: string;

  beforeAll(async () => {
    const { rows } = await setup(
      `insert into live_sessions (item_id, section_id, started_by)
       values ($1, $2, $3) returning id::text as id`,
      [w.itemId, w.sectionId, w.teacher],
    );
    sessionId = rows[0].id as string;
    await setup(
      `insert into live_responses (session_id, user_id, raw_answer, is_correct)
       values ($1, $2, '"B"'::jsonb, true)`,
      [sessionId, w.studentB],
    );
  });

  it("a student cannot read a session", async () => {
    const res = await runAs(studentA, "select id from live_sessions");
    expect(res.error, `expected a silent RLS filter, got ${denialReason(res)}`).toBeNull();
    expect(res.rowCount).toBe(0);
  });

  it("a student cannot read anyone's answer, their classmate's included", async () => {
    const res = await runAs(studentA, "select user_id from live_responses");
    expect(res.error, `expected a silent RLS filter, got ${denialReason(res)}`).toBeNull();
    expect(res.rowCount).toBe(0);
  });

  it("POSITIVE CONTROL: a teacher reads both", async () => {
    const s = await runAs(teacher, "select id from live_sessions where id = $1", [sessionId]);
    expect(s.error, denialReason(s)).toBeNull();
    expect(s.rowCount).toBe(1);
    const r = await runAs(teacher, "select user_id from live_responses where session_id = $1", [sessionId]);
    expect(r.error, denialReason(r)).toBeNull();
    expect(r.rowCount).toBe(1);
  });

  it("a student cannot write an answer, not even their own", async () => {
    const res = await runAs(
      studentA,
      `insert into live_responses (session_id, user_id, raw_answer, is_correct)
       values ($1, $2, '"A"'::jsonb, true)`,
      [sessionId, w.studentA],
    );
    expect(wasDenied(res), "a student wrote their own verdict").toBe(true);
    const { rows } = await setup("select count(*)::int as n from live_responses where user_id = $1", [w.studentA]);
    expect(rows[0].n, "the student's row is in the table").toBe(0);
  });

  it("a teacher cannot start or end a session behind the API's back", async () => {
    const ins = await runAs(
      teacher,
      "insert into live_sessions (item_id, started_by) values ($1, $2)",
      [w.itemId, w.teacher],
    );
    expect(wasDenied(ins), "a session started with no audit row").toBe(true);

    const end = await runAs(
      teacher,
      "update live_sessions set ended_at = now(), ended_by = $2 where id = $1",
      [sessionId, w.teacher],
    );
    expect(end.error, denialReason(end)).toBeNull();
    expect(end.rowCount, "a session ended with no audit row").toBe(0);
  });

  it("POSITIVE CONTROL: the grading service can append an answer while the session is open", async () => {
    const res = await runAs(
      service,
      `insert into live_responses (session_id, user_id, raw_answer, is_correct)
       values ($1, $2, '"C"'::jsonb, false)`,
      [sessionId, w.studentA],
    );
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rowCount).toBe(1);
  });

  it("an answer is never rewritten or removed, for service_role too", async () => {
    const upd = await runAs(service, "update live_responses set is_correct = true where session_id = $1", [sessionId]);
    expect(upd.error?.message, denialReason(upd)).toMatch(/append-only/i);
    const del = await runAs(service, "delete from live_responses where session_id = $1", [sessionId]);
    expect(del.error?.message, denialReason(del)).toMatch(/append-only/i);
    const tru = await runAs(service, "truncate live_responses");
    expect(tru.error?.message, denialReason(tru)).toMatch(/append-only/i);
  });

  it("a session is never deleted, and only ever ended", async () => {
    const del = await runAs(service, "delete from live_sessions where id = $1", [sessionId]);
    expect(del.error?.message, denialReason(del)).toMatch(/never deleted/i);
    const edit = await runAs(service, "update live_sessions set item_id = item_id, section_id = null where id = $1", [
      sessionId,
    ]);
    expect(edit.error?.message, denialReason(edit)).toMatch(/only be ended/i);
  });

  it("only one question runs at a time", async () => {
    const res = await runAs(service, "insert into live_sessions (item_id, started_by) values ($1, $2)", [
      w.itemId,
      w.teacher,
    ]);
    expect(res.error?.message, denialReason(res)).toMatch(/live_sessions_one_open/);
  });

  it("POSITIVE CONTROL: ending is the one update allowed", async () => {
    const end = await runAs(service, "update live_sessions set ended_at = now(), ended_by = $2 where id = $1", [
      sessionId,
      w.teacher,
    ]);
    expect(end.error, denialReason(end)).toBeNull();
    expect(end.rowCount).toBe(1);
  });

  // runAs rolls every call back, so an end and what follows it must share one
  // transaction: the first draft ended the session in one call and answered it
  // in the next, by which time the end had been undone.
  const ENDED: [string, unknown[]?] = ["update live_sessions set ended_at = now(), ended_by = $2 where id = $1"];

  it("an ended session takes no more answers", async () => {
    const late = await runAsSteps(service, [
      [ENDED[0], [sessionId, w.teacher]],
      [
        `insert into live_responses (session_id, user_id, raw_answer, is_correct)
         values ($1, $2, '"A"'::jsonb, true)`,
        [sessionId, w.teacher],
      ],
    ]);
    expect(late.error?.message, denialReason(late)).toMatch(/has ended/i);
  });

  it("an ended session cannot change, not even to reopen it", async () => {
    const reopen = await runAsSteps(service, [
      [ENDED[0], [sessionId, w.teacher]],
      ["update live_sessions set ended_at = null, ended_by = null where id = $1", [sessionId]],
    ]);
    expect(reopen.error?.message, denialReason(reopen)).toMatch(/cannot change/i);
  });
});
