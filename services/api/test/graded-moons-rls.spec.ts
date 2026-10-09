import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runAs,
  runAsSteps,
  setup,
  anon,
  authenticated,
  service,
  wasDenied,
  denialReason,
  closePool,
  type Actor,
} from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Graded moons: the database's half (docs/GRADED-MOONS-PLAN.md; db/addendum-graded-moons.sql).
 *
 * Whether a moon is graded changes every student's grade, so nobody writes it
 * from a client: `ob_staff` was dropped (E2), so the API is the only writer and
 * Publish the only path. The new blueprint scope 'moon' is constrained (one per
 * moon, and only a moon check names a moon besides a journey), and INV-12 treats
 * a moon check like a journey (its length follows the bank).
 *
 * Hard rule 8: written first, watched RED (8 Oct 2026) before the addendum existed.
 */

let w: World;
let studentA: Actor;
let teacher: Actor;
const LIVE = "03.91";
const DRAFT = "03.92";

beforeAll(async () => {
  w = await resetWorld();
  await setup(
    `insert into objectives (id, stage_id, code, bloom_level, description, status)
     values ($1, '03', $1, 'understand', 'A live moon, for the graded-moons spec.', 'live'),
            ($2, '03', $2, 'understand', 'A draft moon, for the graded-moons spec.', 'draft')`,
    [LIVE, DRAFT],
  );
  studentA = authenticated(w.studentA, "student", "studentA");
  teacher = authenticated(w.teacher, "teacher", "teacher");
}, 60_000);

afterAll(async () => {
  await closePool();
});

const moonBlueprint = (objective: string | null, scope = "moon", name = "Moon check") =>
  [
    `insert into blueprints (name, scope, stage_id, objective_id, total_items, constraints)
     values ($1, $2, '03', $3, 3, '{}'::jsonb) returning id`,
    [name, scope, objective],
  ] as [string, unknown[]];

describe("graded is the API's, never a client's", () => {
  it("every live moon starts graded (the instructor's ruling: everything is graded)", async () => {
    const res = await runAs(service, `select count(*)::int as n from objectives where graded is not true`);
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rows[0]!.n).toBe(0);
  });
  it("denies a student flipping a moon", async () => {
    const res = await runAs(studentA, `update objectives set graded = false where id = $1 returning id`, [LIVE]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies a teacher's token too: no staff write path (Publish is the API's)", async () => {
    const res = await runAs(teacher, `update objectives set graded = false where id = $1 returning id`, [LIVE]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies a teacher's token writing a pending change that flips it", async () => {
    const res = await runAs(
      teacher,
      `insert into objective_edits (objective_id, action, description, graded, base_hash)
       values ($1, 'edit', 'A new wording for the moon.', false, 'x') returning objective_id`,
      [LIVE],
    );
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies anon and a student creating a moon check blueprint", async () => {
    for (const a of [anon, studentA]) {
      const res = await runAs(a, ...moonBlueprint(LIVE));
      expect(wasDenied(res), `${a.label}: ${denialReason(res)}`).toBe(true);
    }
  });
  it("POSITIVE CONTROL: the API's connection flips it, and a pending change may carry it", async () => {
    const res = await runAsSteps(service, [
      [`update objectives set graded = false where id = $1`, [LIVE]],
      [`select graded from objectives where id = $1`, [LIVE]],
    ]);
    expect(res.error).toBeNull();
    expect(res.rows[0]!.graded).toBe(false);
    const edit = await runAs(
      service,
      `insert into objective_edits (objective_id, action, description, graded, base_hash)
       values ($1, 'edit', 'A new wording for the moon.', false, 'x') returning graded`,
      [LIVE],
    );
    expect(edit.error).toBeNull();
  });
});

describe("what a student reads of a moon", () => {
  it("a student reads a LIVE moon's graded flag, and no draft moon at all", async () => {
    const live = await runAs(studentA, `select id, graded from live_objectives where id = $1`, [LIVE]);
    expect(live.error, denialReason(live)).toBeNull();
    expect(live.rowCount).toBe(1);
    expect(typeof live.rows[0]!.graded).toBe("boolean");
    const draft = await runAs(studentA, `select id from live_objectives where id = $1`, [DRAFT]);
    expect(wasDenied(draft), denialReason(draft)).toBe(true);
    const table = await runAs(studentA, `select id from objectives where id = $1`, [DRAFT]);
    expect(wasDenied(table), denialReason(table)).toBe(true);
  });
  it("anon reads nothing", async () => {
    const res = await runAs(anon, `select id from live_objectives`);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
});

describe("a moon check's blueprint: the 'moon' scope is constrained", () => {
  it("is accepted for a moon, once", async () => {
    const res = await runAs(service, ...moonBlueprint(LIVE));
    expect(res.error, denialReason(res)).toBeNull();
    const twice = await runAsSteps(service, [moonBlueprint(LIVE), moonBlueprint(LIVE, "moon", "Moon check again")]);
    expect(twice.error?.message ?? "", "a second moon check for the same moon").toMatch(/blueprints_one_check_per_moon|duplicate key/);
  });
  it("must name its moon", async () => {
    const res = await runAs(service, ...moonBlueprint(null));
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/bp_objective_scoped/);
  });
  it("only a journey and a moon check may name a moon", async () => {
    const res = await runAs(service, ...moonBlueprint(LIVE, "stage", "A stage check naming a moon"));
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/bp_objective_scoped/);
  });
  it("is not any other scope", async () => {
    const res = await runAs(service, ...moonBlueprint(LIVE, "weekly", "Not a scope"));
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/blueprints_scope_known/);
  });
  it("coexists with the moon's journey: practice and the check are two blueprints", async () => {
    const res = await runAsSteps(service, [
      moonBlueprint(LIVE, "objective", "Moon journey"),
      moonBlueprint(LIVE, "moon", "Moon check"),
    ]);
    expect(res.error, denialReason(res)).toBeNull();
  });
});

describe("INV-12: a moon check, like a journey, is as long as the bank, not as its blueprint", () => {
  /** An attempt with `n` answered items on a blueprint of `total_items = 3`, of the given scope. */
  async function inv12(scope: "moon" | "stage"): Promise<number> {
    const name = `INV-12 ${scope} ${Math.random()}`;
    await setup(
      `with bp as (
         insert into blueprints (name, scope, stage_id, objective_id, total_items, constraints)
         values ($1, $2, '03', $3, 3, '{}'::jsonb) returning id),
       a as (insert into assessments (blueprint_id, title) select id, $1 from bp returning id),
       t as (insert into attempts (user_id, assessment_id, attempt_no, seed, status)
             select $4::uuid, id, 1, 'inv12-seed', 'in_progress' from a returning id)
       insert into attempt_items (attempt_id, ordinal, item_id, resolved_params, resolved_options, correct_value, points)
       select t.id, o, $5::uuid, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, 1 from t, generate_series(1, 2) o`,
      [name, scope, scope === "moon" ? "03.91" : null, w.studentA, w.itemId],
    );
    // Only the rows this call made: the world has other attempts, all consistent.
    const res = await runAs(service, `select count(*)::int as n from inv_12_item_count_matches_blueprint() x
                                       join attempts a on a.id = x.attempt_id
                                       join assessments s on s.id = a.assessment_id where s.title = $1`, [name]);
    expect(res.error, denialReason(res)).toBeNull();
    return Number(res.rows[0]!.n);
  }
  it("a moon check of 2 questions on a blueprint of 3 is NOT flagged", async () => {
    // The unique index allows one moon check per moon: use a moon that has none yet.
    await setup(`delete from assessments where blueprint_id in (select id from blueprints where objective_id = '03.91' and scope = 'moon')`);
    await setup(`delete from blueprints where objective_id = '03.91' and scope = 'moon'`);
    expect(await inv12("moon")).toBe(0);
  });
  it("CONTROL: a stage check of 2 questions on a blueprint of 3 IS flagged", async () => {
    expect(await inv12("stage")).toBe(1);
  });
});
