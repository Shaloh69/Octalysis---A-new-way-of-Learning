import { describe, it, expect } from "vitest";
import { makeAttemptSeed } from "../../src/engine/seed.js";
import {
  fillBlueprint,
  verifyAgainstBlueprint,
  BlueprintUnsatisfiable,
  type Blueprint,
  type PoolItem,
} from "../../src/engine/blueprint.js";

/**
 * The fairness guarantee. Two students get different items but the same shape of
 * paper -- and if the bank cannot deliver that shape, generation FAILS LOUDLY
 * rather than shipping a paper that is quietly three items short in `analyze`.
 */

const BLOOMS = ["remember", "understand", "apply", "analyze"] as const;
const TYPES = ["S", "P", "G"] as const;

/** Stage -> act, matching db/schema.sql's seed. */
const STAGE_ACT: Record<string, number> = {
  "00": 1, "01": 1, "02": 1, "03": 1, "04": 1, "05": 1,
  "06": 2, "07": 2, "08": 2, "09": 2, "10": 2,
  "11": 3, "12": 3, "13": 3, "14": 3, "15": 3,
  "16": 4, "17": 4,
};

/**
 * Build a bank with a realistic joint distribution: every (act, bloom, type)
 * combination is populated, which is what the real bank must look like for the
 * final blueprint to be satisfiable at all.
 */
function buildPool(perCell: number): PoolItem[] {
  const out: PoolItem[] = [];
  let n = 0;
  for (const [stageId, act] of Object.entries(STAGE_ACT)) {
    for (const bloom of BLOOMS) {
      for (const type of TYPES) {
        for (let k = 0; k < perCell; k++) {
          n++;
          out.push({
            id: `item-${String(n).padStart(6, "0")}`,
            slug: `${type}-${stageId}-${bloom}-${k}`,
            stageId,
            objectiveId: `${stageId}.${(k % 4) + 1}`,
            type,
            bloom,
            stemTemplate: `Question ${n}`,
            solverRef: type === "P" ? "cycle-time" : null,
            correctSpec: type === "G" ? { order: ["a", "b", "c", "d", "e"] } : { value: `ans-${n}` },
            distractorPool: type === "S" ? ["d1", "d2", "d3", "d4", "d5", "d6"] : [],
            act,
            gradeable: stageId !== "00",
          });
        }
      }
    }
  }
  return out;
}

const FINAL: Blueprint = {
  id: "bp-final",
  name: "Final Knowledge Check",
  scope: "final",
  totalItems: 70,
  constraints: {
    by_act: { "1": 18, "2": 20, "3": 20, "4": 12 },
    by_bloom: { remember: 14, understand: 21, apply: 25, analyze: 10 },
    by_type: { S: 38, P: 22, G: 10 },
    max_per_objective: 3,
    exclude_non_gradeable_stages: true,
    difficulty_target: 0.62,
  },
};

const seedFor = (studentId: string) =>
  makeAttemptSeed({ studentId, stageId: "final", attemptNo: 1, examSalt: "salt-2026" });

describe("blueprint arithmetic", () => {
  it("all three dimensions sum to 70", () => {
    const c = FINAL.constraints;
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(c.by_act!)).toBe(70);
    expect(sum(c.by_bloom!)).toBe(70);
    expect(sum(c.by_type!)).toBe(70);
  });
});

describe("fillBlueprint — conformance", () => {
  const pool = buildPool(6); // 18 stages x 4 blooms x 3 types x 6 = 1296 items

  it("satisfies every constraint cell exactly, 200 papers", () => {
    for (let i = 0; i < 200; i++) {
      const { items } = fillBlueprint(FINAL, pool, seedFor(`student-${i}`));
      const check = verifyAgainstBlueprint(FINAL, items);
      expect(check.problems, `student-${i}: ${check.problems.join("; ")}`).toEqual([]);
      expect(check.ok).toBe(true);
    }
  });

  it("never samples a non-gradeable stage — Stage 00 is orientation (INV-30)", () => {
    for (let i = 0; i < 100; i++) {
      const { items } = fillBlueprint(FINAL, pool, seedFor(`g-${i}`));
      expect(items.every((it) => it.gradeable)).toBe(true);
      expect(items.some((it) => it.stageId === "00")).toBe(false);
    }
  });

  it("never repeats an item on one paper", () => {
    for (let i = 0; i < 100; i++) {
      const { items } = fillBlueprint(FINAL, pool, seedFor(`d-${i}`));
      expect(new Set(items.map((x) => x.id)).size).toBe(items.length);
    }
  });

  it("respects max_per_objective", () => {
    for (let i = 0; i < 100; i++) {
      const { items } = fillBlueprint(FINAL, pool, seedFor(`o-${i}`));
      const counts = new Map<string, number>();
      for (const it of items) counts.set(it.objectiveId!, (counts.get(it.objectiveId!) ?? 0) + 1);
      for (const [, n] of counts) expect(n).toBeLessThanOrEqual(3);
    }
  });
});

describe("fillBlueprint — determinism", () => {
  const pool = buildPool(6);

  it("same seed produces the identical paper, 50 runs", () => {
    const seed = seedFor("21-0001");
    const ref = fillBlueprint(FINAL, pool, seed).items.map((i) => i.id).join(",");
    for (let i = 0; i < 50; i++) {
      expect(fillBlueprint(FINAL, pool, seed).items.map((x) => x.id).join(",")).toBe(ref);
    }
  });

  it("does not depend on the order the pool arrives from the database", () => {
    // Postgres returns rows in whatever order the planner chose. A paper that
    // changes when the planner changes is not reproducible.
    const seed = seedFor("21-0007");
    const a = fillBlueprint(FINAL, pool, seed).items.map((i) => i.id).join(",");
    const shuffledPool = [...pool].reverse();
    const b = fillBlueprint(FINAL, shuffledPool, seed).items.map((i) => i.id).join(",");
    expect(b).toBe(a);
  });
});

describe("fillBlueprint — uniqueness across students", () => {
  const pool = buildPool(6);

  it("median item overlap between two students is under 15%, 1000 pairs", () => {
    // MASTER-PLAN 3.4: keep two 70-item papers from overlapping more than ~15%.
    const papers: string[][] = [];
    for (let i = 0; i < 100; i++) {
      papers.push(fillBlueprint(FINAL, pool, seedFor(`u-${i}`)).items.map((x) => x.id));
    }

    const overlaps: number[] = [];
    for (let a = 0; a < papers.length; a++) {
      for (let b = a + 1; b < papers.length; b++) {
        const setB = new Set(papers[b]!);
        const shared = papers[a]!.filter((id) => setB.has(id)).length;
        overlaps.push(shared / FINAL.totalItems);
      }
    }
    expect(overlaps.length).toBeGreaterThan(1000);

    overlaps.sort((x, y) => x - y);
    const median = overlaps[Math.floor(overlaps.length / 2)]!;
    const p95 = overlaps[Math.floor(overlaps.length * 0.95)]!;

    expect(median, `median overlap was ${(median * 100).toFixed(1)}%`).toBeLessThan(0.15);
    expect(p95, `p95 overlap was ${(p95 * 100).toFixed(1)}%`).toBeLessThan(0.25);
  });
});

describe("fillBlueprint — unsatisfiable blueprints throw, naming the cell", () => {
  it("names the dimension and bucket when a bucket is short", () => {
    // Only 1 item per cell: act 1 has 6 stages x 4 blooms x 3 types = 72, but
    // Stage 00 is excluded, so act 1 has 60. Ask for more than exists.
    const thin = buildPool(1);
    const greedy: Blueprint = {
      ...FINAL,
      constraints: { ...FINAL.constraints, by_act: { "1": 61, "2": 3, "3": 3, "4": 3 } },
    };
    let err: unknown;
    try {
      fillBlueprint(greedy, thin, seedFor("x"));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BlueprintUnsatisfiable);
    const b = err as BlueprintUnsatisfiable;
    expect(b.dimension).toBe("act");
    expect(b.bucket).toBe("1");
    expect(b.needed).toBe(61);
    expect(b.available).toBe(60);
    expect(b.message).toMatch(/short by 1/);
  });

  it("catches a dimension whose quotas do not sum to the total", () => {
    const broken: Blueprint = {
      ...FINAL,
      constraints: { ...FINAL.constraints, by_bloom: { remember: 1, understand: 1, apply: 1, analyze: 1 } },
    };
    expect(() => fillBlueprint(broken, buildPool(6), seedFor("y"))).toThrow(
      /quotas sum to 4 but the blueprint total is 70/,
    );
  });

  it("catches JOINT infeasibility that per-dimension checks miss", () => {
    // Constructing this correctly matters, and my first attempt at it did not.
    // Deleting every (act 4, analyze) item is NOT infeasible: the 10 analyze
    // items can come from acts 1-3, and act 4's 12 can be other blooms. The
    // marginals never force the empty cell, so the fill rightly succeeds.
    //
    // To make it genuinely infeasible the marginals have to collide:
    //   - analyze exists ONLY in act 4
    //   - the paper needs 14 analyze
    //   - but act 4 is capped at 12 items
    // 14 analyze must all come from act 4, and act 4 has room for 12. No paper
    // exists. Both per-dimension checks still pass: act 4 has plenty of items,
    // and the bank has plenty of analyze items.
    const pool = buildPool(6).filter((i) => i.bloom !== "analyze" || i.act === 4);
    const collide: Blueprint = {
      ...FINAL,
      constraints: {
        ...FINAL.constraints,
        by_bloom: { remember: 14, understand: 21, apply: 21, analyze: 14 },
      },
    };

    // Prove the per-dimension preflight really does pass.
    expect(pool.filter((i) => i.act === 4).length).toBeGreaterThanOrEqual(12);
    expect(pool.filter((i) => i.bloom === "analyze").length).toBeGreaterThanOrEqual(14);

    let err: unknown;
    try {
      fillBlueprint(collide, pool, seedFor("z"));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BlueprintUnsatisfiable);
    expect((err as Error).message).toMatch(/Blueprint unsatisfiable/);
  });

  it("refuses when the whole bank is smaller than the paper", () => {
    expect(() => fillBlueprint(FINAL, buildPool(6).slice(0, 10), seedFor("w"))).toThrow(
      /smaller than the paper/,
    );
  });

  it("never silently under-fills — an error is always thrown, never a short paper", () => {
    const thin = buildPool(1);
    const impossible: Blueprint = {
      ...FINAL,
      constraints: { ...FINAL.constraints, by_type: { S: 70, P: 0, G: 0 } },
    };
    let result: unknown = null;
    try {
      result = fillBlueprint(impossible, thin, seedFor("v")).items.length;
    } catch {
      result = "threw";
    }
    expect(result).toBe("threw");
  });
});

describe("verifyAgainstBlueprint", () => {
  it("reports every violated cell, not just the first", () => {
    const pool = buildPool(6);
    const { items } = fillBlueprint(FINAL, pool, seedFor("q"));
    const short = items.slice(0, 60);
    const check = verifyAgainstBlueprint(FINAL, short);
    expect(check.ok).toBe(false);
    expect(check.problems.length).toBeGreaterThan(1);
    expect(check.problems[0]).toMatch(/total: expected 70, got 60/);
  });
});
