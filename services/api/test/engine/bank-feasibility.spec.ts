import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { fillBlueprint, type Blueprint, type PoolItem } from "../../src/engine/blueprint.js";
import { EXAMINABLE_BLUEPRINTS, DEFERRED_BLUEPRINTS } from "../../src/engine/scope.js";

/**
 * CAN THE AUTHORED BANK ACTUALLY FILL THE PAPERS IT PROMISES?
 *
 * This is the test F-41 was really asking for. A bank that merely EXISTS is not
 * the fix — the failure mode it was reported for is a student pressing Start and
 * meeting `BlueprintUnsatisfiable` instead of a paper, and that happens when the
 * bank is present but does not satisfy some joint cell of the blueprint.
 *
 * It reads the REAL item files and the REAL blueprints from `db/schema.sql`, so
 * it fails if either drifts. It does not touch the database: `fillBlueprint`
 * takes a pool directly, and the API suite truncates `items` anyway — a test
 * that depended on rows another spec had left behind would be the same
 * order-dependence that made `pnpm qa` unreliable.
 *
 * WHAT IT ALREADY CAUGHT. Act 2's only `apply` items were its 14 parameterized
 * ones. The Midterm demands `apply: 14` AND `P: 13` simultaneously, so exactly
 * one apply item had to come from a non-P item — and there were none. The bank
 * looked complete by every per-dimension count and could not have produced a
 * single valid Midterm paper.
 */

const ROOT = resolve(__dirname, "../../../..");

/** Stage -> act and gradeable, read from the schema's own seed. */
function stageFacts(): Map<string, { act: number; gradeable: boolean }> {
  const sql = readFileSync(resolve(ROOT, "db/schema.sql"), "utf8");
  const out = new Map<string, { act: number; gradeable: boolean }>();
  // ('03',1,3,'Top Level View ...', 60, '{02}', true, true, 'A', '{1,0}')
  for (const m of sql.matchAll(/\('(\d\d)',\s*(\d)\s*,\s*\d+\s*,\s*'[^']*',[^)]*?(true|false),\s*(true|false),\s*'[A-D]'/g)) {
    out.set(m[1]!, { act: Number(m[2]), gradeable: m[3] === "true" });
  }
  return out;
}

/**
 * The stage checks, read from the schema's `insert ... select` over `stages`.
 *
 * They are generated rather than listed there, so this rebuilds them the same
 * way: one per gradeable stage, 8 items, `max_per_objective: 2`, and no type or
 * bloom constraint. F-44 is why they exist at all — without a stage-scoped
 * blueprint no mastery is ever written and nothing unlocks.
 */
function stageBlueprints(): Blueprint[] {
  const sql = readFileSync(resolve(ROOT, "db/schema.sql"), "utf8");
  const m = sql.match(/'Stage ' \|\| s\.id \|\| ' Check',[\s\S]*?(\d+),[\s\S]*?'(\{[^']*\})'::jsonb/);
  if (!m) throw new Error("stage-check blueprint not found in db/schema.sql");
  const total = Number(m[1]!);
  const constraints = JSON.parse(m[2]!);
  return [...stageFacts().entries()]
    .filter(([, f]) => f.gradeable)
    .map(([id]) => ({
      id: `stage-${id}`,
      name: `Stage ${id} Check`,
      scope: "stage" as const,
      stageId: id,
      totalItems: total,
      constraints,
    }));
}

/** The four period exams, read from the schema rather than restated here. */
function blueprints(): Blueprint[] {
  const sql = readFileSync(resolve(ROOT, "db/schema.sql"), "utf8");
  const out: Blueprint[] = [];
  for (const m of sql.matchAll(/\('([^']+)',\s*'final',\s*(\d+),\s*'(\{[\s\S]*?\})'::jsonb/g)) {
    out.push({
      id: m[1]!,
      name: m[1]!,
      scope: "final",
      stageId: null,
      totalItems: Number(m[2]),
      constraints: JSON.parse(m[3]!),
    });
  }
  return out;
}

/** The authored bank, as the engine would see it once approved and live. */
function pool(): PoolItem[] {
  const dir = resolve(ROOT, "content/items");
  const facts = stageFacts();
  const items: PoolItem[] = [];
  for (const name of readdirSync(dir).filter((f) => /^\d\d\.json$/.test(f)).sort()) {
    const file = JSON.parse(readFileSync(resolve(dir, name), "utf8"));
    const stage = file.stageId as string;
    const f = facts.get(stage);
    if (!f) throw new Error(`stage ${stage} is not seeded in db/schema.sql`);
    for (const it of file.items) {
      items.push({
        id: it.slug,
        slug: it.slug,
        stageId: stage,
        objectiveId: it.objective,
        type: it.type,
        bloom: it.bloom,
        stemTemplate: it.stem ?? `parameterized:${it.solver}`,
        solverRef: it.solver ?? null,
        correctSpec: it.type === "S" ? { value: it.correct } : it.type === "G" ? { order: it.order } : {},
        distractorPool: it.type === "S" ? it.distractors : [],
        rationaleTemplate: it.rationale ?? null,
        act: f.act,
        gradeable: f.gradeable,
      });
    }
  }
  return items;
}

describe("the authored bank fills every examinable paper", () => {
  const bank = pool();
  const all = blueprints();

  it("reads a real bank and the real blueprints", () => {
    expect(bank.length, "no items were loaded — the paths are wrong").toBeGreaterThan(100);
    expect(all.length, "schema.sql should seed four period exams").toBe(4);
  });

  for (const name of EXAMINABLE_BLUEPRINTS) {
    it(`${name} can be filled, and every constraint cell is met exactly`, () => {
      const bp = all.find((b) => b.name === name);
      expect(bp, `${name} is declared examinable but not seeded`).toBeDefined();

      const result = fillBlueprint(bp!, bank, `feasibility-${name}`);
      expect(result.items.length).toBe(bp!.totalItems);

      // Every dimension the blueprint constrains must land EXACTLY, not merely close.
      const c = bp!.constraints;
      const tally = (get: (i: PoolItem) => string) =>
        result.items.reduce<Record<string, number>>((a, i) => {
          const k = get(i);
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {});

      for (const [bucket, want] of Object.entries(c.by_act ?? {})) {
        expect(tally((i) => String(i.act))[bucket] ?? 0, `act ${bucket}`).toBe(want);
      }
      for (const [bucket, want] of Object.entries(c.by_bloom ?? {})) {
        expect(tally((i) => i.bloom)[bucket] ?? 0, `bloom ${bucket}`).toBe(want);
      }
      for (const [bucket, want] of Object.entries(c.by_type ?? {})) {
        expect(tally((i) => i.type)[bucket] ?? 0, `type ${bucket}`).toBe(want);
      }

      // max_per_objective is the constraint a naive bank passes on totals and fails in practice.
      if (c.max_per_objective) {
        const perObjective = tally((i) => i.objectiveId ?? "(none)");
        for (const [obj, n] of Object.entries(perObjective)) {
          expect(n, `objective ${obj} appears ${n} times`).toBeLessThanOrEqual(c.max_per_objective);
        }
      }

      // Stage 00 is orientation and must never be sampled (INV-30, engine rule 7).
      expect(result.items.some((i) => i.stageId === "00")).toBe(false);
    });

    it(`${name} fills for many different students, not just one lucky seed`, () => {
      const bp = all.find((b) => b.name === name)!;
      for (let s = 0; s < 60; s++) {
        expect(() => fillBlueprint(bp, bank, `student-${s}`)).not.toThrow();
      }
    });

    it(`${name} has real headroom — two students do not get the same paper`, () => {
      const bp = all.find((b) => b.name === name)!;
      const a = new Set(fillBlueprint(bp, bank, "student-a").items.map((i) => i.slug));
      const b = fillBlueprint(bp, bank, "student-b").items.map((i) => i.slug);
      const overlap = b.filter((s) => a.has(s)).length / b.length;
      // A bank with no slack would hand every student an identical paper.
      expect(overlap, `papers overlap ${Math.round(overlap * 100)}%`).toBeLessThan(0.95);
    });
  }

  /*
   * EVERY STAGE CHECK MUST FILL, for the stages the bank covers.
   *
   * This is the test F-44 should have had from the start. A stage check that
   * cannot be filled is worse than none: the reader offers the student a link,
   * and the engine throws when they press it.
   *
   * The stage blueprints deliberately carry no by_type or by_bloom, and this is
   * the evidence for why — stage 01 holds zero P items and stage 08 holds a
   * single `remember` one, so any uniform mix would be unsatisfiable somewhere.
   */
  describe("stage checks", () => {
    const inScope = [...new Set(bank.map((i) => i.stageId))].sort();

    for (const bp of stageBlueprints()) {
      const stage = bp.name.match(/Stage (\d\d)/)![1]!;
      if (!inScope.includes(stage)) continue;

      /*
       * The pool is filtered to the stage BEFORE sampling, because that is what
       * production does: `engine-repo.ts:41` adds `and i.stage_id = $n` when the
       * blueprint is stage-scoped, and `routes/assessments.ts:152` does the same
       * for the feasibility check. `fillBlueprint` itself takes whatever pool it
       * is handed and has no opinion about stages.
       *
       * Feeding it the whole bank passed — and drew stage 08 items into a stage
       * 01 check. The paper filled, so a test that only asserted `.length` would
       * have been green while the product graded students on material they had
       * not reached.
       */
      const stagePool = bank.filter((i) => i.stageId === stage);

      it(`${bp.name} fills, and never leans on one objective`, () => {
        const result = fillBlueprint(bp, stagePool, `check-${stage}`);
        expect(result.items.length).toBe(bp.totalItems);

        // Every item must come from THIS stage. A stage check drawing on a
        // neighbour would grade a student on material they have not reached.
        expect([...new Set(result.items.map((i) => i.stageId))]).toEqual([stage]);

        const perObjective = result.items.reduce<Record<string, number>>((a, i) => {
          const k = i.objectiveId ?? "(none)";
          a[k] = (a[k] ?? 0) + 1;
          return a;
        }, {});
        for (const [obj, n] of Object.entries(perObjective)) {
          expect(n, `objective ${obj} appears ${n} times`).toBeLessThanOrEqual(
            bp.constraints.max_per_objective!,
          );
        }
      });

      it(`${bp.name} gives different students different papers`, () => {
        const a = new Set(fillBlueprint(bp, stagePool, `s-a-${stage}`).items.map((i) => i.slug));
        const b = fillBlueprint(bp, stagePool, `s-b-${stage}`).items.map((i) => i.slug);
        const overlap = b.filter((x) => a.has(x)).length / b.length;
        expect(overlap, `stage ${stage} papers overlap ${Math.round(overlap * 100)}%`).toBeLessThan(1);
      });
    }

    it("covers every stage the bank holds items for", () => {
      const covered = stageBlueprints()
        .map((b) => b.name.match(/Stage (\d\d)/)![1]!)
        .filter((s) => inScope.includes(s));
      expect(covered.sort()).toEqual(inScope);
    });
  });

  for (const name of DEFERRED_BLUEPRINTS) {
    it(`${name} is correctly NOT fillable yet — the scope flag is honest`, () => {
      /*
       * The deferred exams draw on acts 3 and 4, which have no items. This
       * asserts the flag is telling the truth: if someone authored those acts
       * and forgot to widen the scope, this test would fail and say so.
       */
      const bp = all.find((b) => b.name === name)!;
      expect(() => fillBlueprint(bp, bank, "deferred")).toThrow();
    });
  }
});
