import { makeRng, deriveSeed, type Rng } from "./seed.js";
import type { BankItem } from "./resolve.js";

/**
 * The blueprint filler. This is the fairness argument, in code.
 *
 * Two students get different ITEMS but the same SHAPE of paper: the same count
 * from each act, at each Bloom level, of each type, with no objective
 * over-sampled. Uniqueness without equivalence is unfair, and "the blueprint is
 * the unit of equality, not the item" is the sentence that survives a thesis
 * defence.
 *
 * So this module never silently under-fills. If the bank cannot satisfy a cell,
 * it throws and names the cell and the shortfall -- because a paper that is
 * quietly 3 items short in `analyze` is a paper that measures something other
 * than what it claims to.
 */

export interface PoolItem extends BankItem {
  /** From `stages.act`. */
  readonly act: number;
  /** From `stages.gradeable`. Stage 00 is false and must never be sampled. */
  readonly gradeable: boolean;
}

export interface BlueprintConstraints {
  readonly by_act?: Readonly<Record<string, number>>;
  readonly by_bloom?: Readonly<Record<string, number>>;
  readonly by_type?: Readonly<Record<string, number>>;
  readonly max_per_objective?: number;
  readonly exclude_non_gradeable_stages?: boolean;
  readonly difficulty_target?: number;
}

export interface Blueprint {
  readonly id: string;
  readonly name: string;
  readonly scope: "stage" | "final";
  /**
   * The stage a `scope: "stage"` blueprint belongs to; null for a final.
   *
   * `fillBlueprint()` does NOT filter on this — it selects from whatever pool it
   * is handed. Narrowing the pool to one stage is the caller's job, and the
   * reason this field has to travel with the blueprint at all: without it the
   * caller cannot know which stage to narrow to, and a stage check silently
   * samples the entire live bank.
   */
  readonly stageId: string | null;
  readonly totalItems: number;
  readonly constraints: BlueprintConstraints;
}

/** Thrown when the live bank cannot satisfy the blueprint. Never swallowed. */
export class BlueprintUnsatisfiable extends Error {
  readonly dimension: string;
  readonly bucket: string;
  readonly needed: number;
  readonly available: number;

  constructor(dimension: string, bucket: string, needed: number, available: number, extra = "") {
    super(
      `Blueprint unsatisfiable: ${dimension}="${bucket}" needs ${needed} item(s) but only ` +
        `${available} are available in the live bank (short by ${needed - available}).` +
        (extra ? ` ${extra}` : ""),
    );
    this.name = "BlueprintUnsatisfiable";
    this.dimension = dimension;
    this.bucket = bucket;
    this.needed = needed;
    this.available = available;
  }
}

type Dim = "act" | "bloom" | "type";

const bucketOf = (item: PoolItem, dim: Dim): string => {
  switch (dim) {
    case "act":
      return String(item.act);
    case "bloom":
      return item.bloom;
    case "type":
      return item.type;
  }
};

interface Demand {
  readonly dim: Dim;
  readonly quotas: Map<string, number>;
}

function buildDemands(bp: Blueprint): Demand[] {
  const out: Demand[] = [];
  const c = bp.constraints;
  if (c.by_act) out.push({ dim: "act", quotas: new Map(Object.entries(c.by_act)) });
  if (c.by_bloom) out.push({ dim: "bloom", quotas: new Map(Object.entries(c.by_bloom)) });
  if (c.by_type) out.push({ dim: "type", quotas: new Map(Object.entries(c.by_type)) });
  return out;
}

/**
 * Check each dimension's totals against the blueprint's own item count, and each
 * bucket against raw supply. Runs BEFORE any sampling so the common failures are
 * reported precisely rather than as "greedy fill gave up".
 */
function preflight(bp: Blueprint, pool: readonly PoolItem[], demands: readonly Demand[]): void {
  for (const d of demands) {
    const sum = [...d.quotas.values()].reduce((a, b) => a + b, 0);
    if (sum !== bp.totalItems) {
      throw new BlueprintUnsatisfiable(
        d.dim,
        "(all buckets)",
        bp.totalItems,
        sum,
        `The ${d.dim} quotas sum to ${sum} but the blueprint total is ${bp.totalItems}. ` +
          `Every dimension must sum to the same total or no paper can satisfy all of them.`,
      );
    }

    for (const [bucket, needed] of d.quotas) {
      const available = pool.filter((i) => bucketOf(i, d.dim) === bucket).length;
      if (available < needed) {
        throw new BlueprintUnsatisfiable(d.dim, bucket, needed, available);
      }
    }
  }
}

/**
 * Diagnose a failed fill by finding the tightest JOINT cell -- the combination
 * of buckets that has demand but no supply. A per-dimension check passes
 * happily when act=2 needs 20 and bloom=analyze needs 10 but no Act II item is
 * tagged `analyze`.
 */
function diagnoseJoint(
  pool: readonly PoolItem[],
  demands: readonly Demand[],
  remaining: Map<Dim, Map<string, number>>,
): BlueprintUnsatisfiable {
  for (const d of demands) {
    for (const [bucket, need] of remaining.get(d.dim)!) {
      if (need <= 0) continue;
      const supply = pool.filter((i) => bucketOf(i, d.dim) === bucket).length;
      // Cross this bucket against every other dimension's outstanding demand.
      for (const other of demands) {
        if (other.dim === d.dim) continue;
        for (const [ob, oneed] of remaining.get(other.dim)!) {
          if (oneed <= 0) continue;
          const joint = pool.filter(
            (i) => bucketOf(i, d.dim) === bucket && bucketOf(i, other.dim) === ob,
          ).length;
          if (joint === 0) {
            return new BlueprintUnsatisfiable(
              `${d.dim}+${other.dim}`,
              `${bucket}+${ob}`,
              Math.min(need, oneed),
              0,
              `No live item is both ${d.dim}="${bucket}" and ${other.dim}="${ob}", but the ` +
                `blueprint still needs ${need} of the former and ${oneed} of the latter. ` +
                `Author items in that combination, or relax one of the two quotas.`,
            );
          }
        }
      }
      return new BlueprintUnsatisfiable(
        d.dim,
        bucket,
        need,
        supply,
        `Ran out while filling. Remaining demand could not be met without violating ` +
          `another dimension or the max_per_objective cap.`,
      );
    }
  }
  return new BlueprintUnsatisfiable("(unknown)", "(unknown)", 0, 0, "Fill failed with no outstanding demand, which is a bug.");
}

interface Attempt {
  chosen: PoolItem[];
  remaining: Map<Dim, Map<string, number>>;
  perObjective: Map<string, number>;
}

function tryFill(
  bp: Blueprint,
  pool: readonly PoolItem[],
  demands: readonly Demand[],
  rng: Rng,
): { ok: true; attempt: Attempt } | { ok: false; attempt: Attempt } {
  const maxPerObjective = bp.constraints.max_per_objective ?? Number.POSITIVE_INFINITY;

  const remaining = new Map<Dim, Map<string, number>>(
    demands.map((d) => [d.dim, new Map(d.quotas)]),
  );
  const perObjective = new Map<string, number>();
  const chosen: PoolItem[] = [];
  const used = new Set<string>();

  for (let picked = 0; picked < bp.totalItems; picked++) {
    // Eligible = every unused item whose every dimension still has demand and
    // whose objective is not already at its cap.
    const eligible = pool.filter((item) => {
      if (used.has(item.id)) return false;
      for (const d of demands) {
        if ((remaining.get(d.dim)!.get(bucketOf(item, d.dim)) ?? 0) <= 0) return false;
      }
      if (item.objectiveId) {
        if ((perObjective.get(item.objectiveId) ?? 0) >= maxPerObjective) return false;
      }
      return true;
    });

    // Dead end. Hand back the PARTIAL state -- the diagnostic needs to know what
    // demand was still outstanding, not what it was at the start.
    if (eligible.length === 0) {
      return { ok: false, attempt: { chosen, remaining, perObjective } };
    }

    // Scarcity-first. Score each candidate by how tight the tightest dimension
    // it serves is: remaining demand divided by remaining supply. Filling scarce
    // cells early is what stops the greedy walk from painting itself into a
    // corner on the last five items.
    //
    // Supply is counted ONCE per pick, not once per candidate. Doing it inside
    // the candidate loop makes this O(n^2) per pick, which at a realistic bank
    // size of ~1300 items turns a 70-item paper into tens of millions of
    // comparisons and the whole suite into minutes.
    const supplyByDim = new Map<Dim, Map<string, number>>();
    for (const d of demands) {
      const counts = new Map<string, number>();
      for (const e of eligible) {
        const b = bucketOf(e, d.dim);
        counts.set(b, (counts.get(b) ?? 0) + 1);
      }
      supplyByDim.set(d.dim, counts);
    }

    let best: PoolItem[] = [];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const item of eligible) {
      let score = Number.NEGATIVE_INFINITY;
      for (const d of demands) {
        const bucket = bucketOf(item, d.dim);
        const need = remaining.get(d.dim)!.get(bucket) ?? 0;
        if (need <= 0) continue;
        const supply = supplyByDim.get(d.dim)!.get(bucket) ?? 0;
        const tightness = need / Math.max(1, supply);
        if (tightness > score) score = tightness;
      }
      if (score > bestScore) {
        bestScore = score;
        best = [item];
      } else if (score === bestScore) {
        best.push(item);
      }
    }

    // Break ties randomly so two students filling identical blueprints from the
    // same bank still get different papers.
    const item = rng.pick(best);

    used.add(item.id);
    chosen.push(item);
    for (const d of demands) {
      const b = bucketOf(item, d.dim);
      remaining.get(d.dim)!.set(b, (remaining.get(d.dim)!.get(b) ?? 0) - 1);
    }
    if (item.objectiveId) {
      perObjective.set(item.objectiveId, (perObjective.get(item.objectiveId) ?? 0) + 1);
    }
  }

  return { ok: true, attempt: { chosen, remaining, perObjective } };
}

export interface FillResult {
  readonly items: PoolItem[];
  /** Restarts consumed. Useful as a bank-health signal: high means barely feasible. */
  readonly restarts: number;
}

/**
 * Select exactly `blueprint.totalItems` items satisfying every constraint cell.
 *
 * Deterministic: same seed + same pool + same blueprint = same selection.
 */
export function fillBlueprint(
  bp: Blueprint,
  rawPool: readonly PoolItem[],
  attemptSeed: string,
  maxRestarts = 40,
): FillResult {
  // INV-30 / engine rule 7: Stage 00 is orientation and is never sampled.
  const pool =
    bp.constraints.exclude_non_gradeable_stages === false
      ? [...rawPool]
      : rawPool.filter((i) => i.gradeable);

  if (pool.length < bp.totalItems) {
    throw new BlueprintUnsatisfiable(
      "total",
      "(whole bank)",
      bp.totalItems,
      pool.length,
      "The gradeable live bank is smaller than the paper.",
    );
  }

  const demands = buildDemands(bp);
  preflight(bp, pool, demands);

  // Sort for determinism: the pool arrives from Postgres in whatever order the
  // planner chose, and the fill must not depend on that.
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Keep the DEEPEST failure seen. That attempt got furthest before dead-ending,
  // so its outstanding demand is the most informative description of what the
  // bank is actually missing.
  let deepest: Attempt | null = null;

  for (let restart = 0; restart < maxRestarts; restart++) {
    const rng = makeRng(deriveSeed(attemptSeed, `blueprint:${bp.id}:${restart}`));
    const result = tryFill(bp, sorted, demands, rng);
    if (result.ok) {
      // Order the paper itself, deterministically but not by id.
      const orderRng = makeRng(deriveSeed(attemptSeed, `paper-order:${bp.id}`));
      return { items: orderRng.shuffle(result.attempt.chosen), restarts: restart };
    }
    if (deepest === null || result.attempt.chosen.length > deepest.chosen.length) {
      deepest = result.attempt;
    }
  }

  throw diagnoseJoint(sorted, demands, deepest!.remaining);
}

/** Verify a selection against its blueprint. Used in tests and by the audit route. */
export function verifyAgainstBlueprint(
  bp: Blueprint,
  items: readonly PoolItem[],
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];

  if (items.length !== bp.totalItems) {
    problems.push(`total: expected ${bp.totalItems}, got ${items.length}`);
  }

  for (const d of buildDemands(bp)) {
    for (const [bucket, needed] of d.quotas) {
      const got = items.filter((i) => bucketOf(i, d.dim) === bucket).length;
      if (got !== needed) {
        problems.push(`${d.dim}="${bucket}": expected ${needed}, got ${got}`);
      }
    }
  }

  const cap = bp.constraints.max_per_objective;
  if (cap !== undefined) {
    const counts = new Map<string, number>();
    for (const i of items) {
      if (!i.objectiveId) continue;
      counts.set(i.objectiveId, (counts.get(i.objectiveId) ?? 0) + 1);
    }
    for (const [obj, n] of counts) {
      if (n > cap) problems.push(`objective ${obj}: ${n} items, cap is ${cap}`);
    }
  }

  if (bp.constraints.exclude_non_gradeable_stages !== false) {
    const bad = items.filter((i) => !i.gradeable);
    if (bad.length > 0) {
      problems.push(`${bad.length} item(s) from non-gradeable stages (INV-30)`);
    }
  }

  const dupes = items.length - new Set(items.map((i) => i.id)).size;
  if (dupes > 0) problems.push(`${dupes} duplicate item(s) on one paper`);

  return { ok: problems.length === 0, problems };
}
