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

/** The four period exams, read from the schema rather than restated here. */
function blueprints(): Blueprint[] {
  const sql = readFileSync(resolve(ROOT, "db/schema.sql"), "utf8");
  const out: Blueprint[] = [];
  for (const m of sql.matchAll(/\('([^']+)',\s*'final',\s*(\d+),\s*'(\{[\s\S]*?\})'::jsonb/g)) {
    out.push({
      id: m[1]!,
      name: m[1]!,
      scope: "final",
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
