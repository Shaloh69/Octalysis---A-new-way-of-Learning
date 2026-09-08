import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, afterAll } from "vitest";
import { pool, closePool } from "../helpers/rls.js";
import {
  DEFERRED_BLUEPRINTS,
  EXAMINABLE_ACTS,
  EXAMINABLE_BLUEPRINTS,
  EXAMINABLE_THROUGH_STAGE,
  isActExaminable,
  isBlueprintExaminable,
  isStageExaminable,
} from "../../src/engine/scope.js";

/**
 * The examinable-scope flag, held against the database rather than against
 * itself.
 *
 * A scope constant that only agrees with its own unit tests is decoration. What
 * makes this one load-bearing is that it is checked against the real `stages`
 * and `blueprints` rows: if someone widens the flag without authoring the bank,
 * or adds a fifth blueprint that the flag has never heard of, these fail.
 *
 * The one that matters most is the last: NO assessment may point at a deferred
 * blueprint. That is the property that stops a student pressing Start on an exam
 * whose act was never authored and meeting `BlueprintUnsatisfiable` instead of a
 * paper.
 *
 * NOTE ON WHERE THE BLUEPRINT NAMES COME FROM. The canonical four are read from
 * `db/schema.sql`, not from the `blueprints` table, and that is deliberate. The
 * API suite's own `resetAll()` truncates blueprints and `helpers/bank.ts`
 * inserts fixtures of its own, so a test that asked the database "what
 * blueprints exist" passed alone and failed inside the suite -- which is exactly
 * the order-dependence that made `pnpm qa` unreliable. The schema file is the
 * source of truth for what the course actually offers; the database is only
 * asked the question that genuinely belongs to it, which is whether any
 * assessment points somewhere it should not.
 */

/** The period exams as `db/schema.sql` seeds them -- the course's real offering. */
function canonicalBlueprints(): string[] {
  const sql = readFileSync(resolve(__dirname, "../../../../db/schema.sql"), "utf8");
  /*
   * The trailing item count is what makes this unambiguous. Matching only
   * `('name', 'final'` also caught the column's own CHECK constraint,
   * `check (scope in ('stage','final'))`, and reported a blueprint called
   * "stage". Only the INSERT rows carry a row count after the scope.
   */
  return [...sql.matchAll(/\('([^']+)',\s*'final',\s*\d+/g)].map((m) => m[1]!);
}

afterAll(async () => {
  await closePool();
});

describe("examinable scope", () => {
  it("the examinable acts are exactly the acts of the in-scope stages", async () => {
    const { rows } = await pool.query<{ act: number }>(
      "select distinct act from stages where gradeable and id <= $1 order by act",
      [EXAMINABLE_THROUGH_STAGE],
    );
    expect(rows.map((r) => Number(r.act))).toEqual([...EXAMINABLE_ACTS]);
  });

  it("no gradeable stage beyond the flag belongs to an examinable act", async () => {
    // If a later stage shared act 2, widening by stage would silently widen the
    // Midterm's pool to chapters the bank has no items for.
    const { rows } = await pool.query<{ id: string; act: number }>(
      "select id, act from stages where gradeable and id > $1 order by id",
      [EXAMINABLE_THROUGH_STAGE],
    );
    for (const r of rows) {
      expect(isActExaminable(Number(r.act)), `stage ${r.id} is act ${r.act}, which is in scope`).toBe(
        false,
      );
    }
  });

  it("every examinable blueprint is one the schema actually seeds", () => {
    const canonical = canonicalBlueprints();
    expect(canonical.length, "schema.sql should seed four period exams").toBe(4);
    for (const wanted of EXAMINABLE_BLUEPRINTS) {
      expect(canonical, `${wanted} is declared examinable but is not in schema.sql`).toContain(
        wanted,
      );
    }
  });

  it("every period exam is classified — none is silently neither", () => {
    // A fifth exam added to schema.sql that nobody classified would be offered
    // nowhere and deferred nowhere. This is the check that forces the decision.
    for (const name of canonicalBlueprints()) {
      const classified =
        EXAMINABLE_BLUEPRINTS.includes(name) || DEFERRED_BLUEPRINTS.includes(name);
      expect(classified, `blueprint "${name}" is in neither scope list`).toBe(true);
    }
  });

  it("no assessment points at a deferred blueprint", async () => {
    const { rows } = await pool.query<{ title: string; name: string }>(
      `select a.title, b.name
         from assessments a
         join blueprints b on b.id = a.blueprint_id
        where b.name = any($1)`,
      [[...DEFERRED_BLUEPRINTS]],
    );
    expect(
      rows.map((r) => `${r.title} -> ${r.name}`),
      "a student could start an exam whose act is not authored yet",
    ).toEqual([]);
  });

  it("classifies stages and blueprints the way the ruling says", () => {
    expect(isStageExaminable("00")).toBe(true);
    expect(isStageExaminable("08")).toBe(true);
    expect(isStageExaminable("09")).toBe(false);
    expect(isStageExaminable("18")).toBe(false);

    expect(isActExaminable(2)).toBe(true);
    expect(isActExaminable(3)).toBe(false);

    expect(isBlueprintExaminable("Midterm Examination")).toBe(true);
    expect(isBlueprintExaminable("Final Examination")).toBe(false);
  });

  it("the two scope lists do not overlap", () => {
    const overlap = EXAMINABLE_BLUEPRINTS.filter((n) => DEFERRED_BLUEPRINTS.includes(n));
    expect(overlap).toEqual([]);
  });
});
