
/**
 * The parameterized-item solver registry.
 *
 * Two rules govern everything in this file.
 *
 * 1. **Every distractor comes from a real student misconception**, never a random
 *    number near the answer. Each one names its misconception in a comment. A
 *    distractor nobody picks is dead weight; a distractor that only *weak*
 *    students pick is doing its job; a distractor that *strong* students pick
 *    means the item is broken. None of that analysis is possible if the wrong
 *    answers are noise.
 *
 * 2. **Solvers are versioned and never mutated in place.** `attempts.engine_version`
 *    pins which registry generated a paper. Changing the maths of a live solver
 *    silently invalidates every stored seed that used it — the seed still
 *    regenerates *a* paper, just not the one the student sat. Add a new version.
 */

/*
 * The types and `round` live in `solver-core.ts` so the per-act banks below can
 * share them without importing this file back. This module stays the ONLY
 * public surface -- `resolve.ts` and the tests import from here -- so the types
 * are re-exported rather than moved out of reach.
 */
export type { Distractor, Solver, SolverParams } from "./solver-core.js";
import { type Solver, round } from "./solver-core.js";

import { ACT1_SOLVERS } from "./solvers-act1.js";
import { ACT2_SOLVERS } from "./solvers-act2.js";
import { ACT3_SOLVERS } from "./solvers-act3.js";
import { ACT4_SOLVERS } from "./solvers-act4.js";

/* ============================================================
 * P-07 · Cycle time.  t = 1 / f
 *
 * The flagship parameterized item. Stage 07 is the drill week, and this is the
 * calculation the source deck works through directly.
 * ========================================================== */

const cycleTime: Solver = {
  id: "cycle-time",
  version: "1.0.0",
  objectiveHint: "07.3",
  unit: "ns",
  tolerance: 0.01,
  sigFigs: 4,

  draw(rng) {
    // Real bus and clock frequencies a student would plausibly meet, from the
    // 1990s PCI era through modern DDR. Kept as a curated list rather than a
    // uniform range: 3,317 MHz is not a number anyone has ever seen on a spec
    // sheet, and unrealistic inputs make the drill feel like arithmetic homework
    // instead of engineering.
    const mhz = [
      33, 50, 66, 100, 133, 166, 200, 233, 266, 300, 333, 400, 466, 533, 600,
      666, 733, 800, 866, 933, 1000, 1200, 1333, 1600, 1866, 2133, 2400, 2666,
      2933, 3200, 3600, 4000, 4200, 4800,
    ];
    return { f: rng.pick(mhz) };
  },

  solve(p) {
    // f is in MHz (1e6 Hz); the answer is in ns (1e-9 s).
    // t = 1/(f x 1e6) s = (1/f) x 1e-6 s = (1000/f) ns
    return 1000 / p.f!;
  },

  stem(p) {
    return `A system bus operates at ${p.f} MHz. What is its cycle time, in nanoseconds?`;
  },

  distractors(p, correct) {
    const f = p.f!;
    return [
      {
        // Treated MHz as Hz — the single most common unit-scale error.
        value: 1_000_000 / f,
        misconception: "wrong unit scale: treated MHz as Hz",
      },
      {
        // Multiplied instead of taking the reciprocal.
        value: f / 1000,
        misconception: "inverted the relationship: computed f/1000 instead of 1000/f",
      },
      {
        // Correct reciprocal, forgot to convert seconds to nanoseconds.
        value: 1 / f,
        misconception: "dropped the nano prefix: answered in microseconds",
      },
      {
        // Off by one metric step - picoseconds instead of nanoseconds.
        value: correct * 1000,
        misconception: "off by one metric step: answered in picoseconds",
      },
      {
        // Divided by 2 somewhere - confusing cycle time with half-period, which
        // students pick up from double-data-rate memory descriptions.
        value: correct / 2,
        misconception: "halved the period: confused cycle time with DDR half-period",
      },
    ];
    // NOTE: at f = 1000 MHz, f/1000 and 1000/f are both 1 - a genuine collision.
    // Candidates are deduplicated against the correct value and each other in
    // resolve.ts, which is where the no-duplicate-options guarantee lives.
  },

  rationale(p, correct) {
    const f = p.f!;
    return (
      `Cycle time is the reciprocal of frequency. ` +
      `t = 1 / (${f} x 10^6 Hz) = ${(1 / (f * 1e6)).toExponential(3)} s. ` +
      `Converting to nanoseconds: ${round(correct, 4)} ns. ` +
      `Shortcut: t(ns) = 1000 / f(MHz).`
    );
  },
};

/* ============================================================
 * P-07 · Powers of 10 vs powers of 2
 *
 * The deck makes this point explicitly and students consistently miss it: disk
 * manufacturers sell decimal gigabytes, operating systems report binary ones.
 * ========================================================== */

const unitConvert: Solver = {
  id: "unit-convert",
  version: "1.0.0",
  objectiveHint: "07.2",
  unit: "GiB",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return { gb: rng.pick([120, 128, 250, 256, 320, 500, 512, 750, 1000, 2000, 4000]) };
  },

  solve(p) {
    // Advertised GB is decimal (1e9 bytes). Reported GiB is binary (2^30 bytes).
    return (p.gb! * 1e9) / 2 ** 30;
  },

  stem(p) {
    return (
      `A drive is advertised as ${p.gb} GB, where the manufacturer means 10^9 bytes. ` +
      `How many GiB does the operating system report, to two decimal places?`
    );
  },

  distractors(p) {
    const gb = p.gb!;
    return [
      {
        // Assumed the two units are the same thing.
        value: gb,
        misconception: "treated decimal GB and binary GiB as identical",
      },
      {
        // Converted the wrong direction.
        value: (gb * 2 ** 30) / 1e9,
        misconception: "converted in the wrong direction: multiplied by 2^30 and divided by 10^9",
      },
      {
        // Used 1024^2 — off by one binary power.
        value: (gb * 1e9) / 2 ** 20,
        misconception: "off by one binary power: divided by 2^20 (MiB) instead of 2^30",
      },
      {
        // Off by one binary power the other way - answered in TiB.
        value: (gb * 1e9) / 2 ** 40,
        misconception: "off by one binary power: divided by 2^40 (TiB) instead of 2^30",
      },
    ];
  },

  rationale(p, correct) {
    const gb = p.gb!;
    return (
      `The manufacturer's ${gb} GB is ${gb} x 10^9 = ${(gb * 1e9).toExponential(3)} bytes. ` +
      `The operating system divides by 2^30 = 1,073,741,824. ` +
      `${(gb * 1e9).toExponential(3)} / 2^30 = ${round(correct, 4)} GiB. ` +
      `This gap is why a "500 GB" drive shows as about 465 GiB — nothing is missing.`
    );
  },
};

/* ============================================================
 * P-09 · Two's complement
 * ========================================================== */

const twosComplement: Solver = {
  id: "twos-complement",
  version: "1.0.0",
  objectiveHint: "09.2",
  unit: "",
  tolerance: 0, // exact: this is an integer answer
  sigFigs: 12,

  draw(rng) {
    const width = rng.pick([8, 16]);
    const max = 2 ** (width - 1) - 1;
    // Negative values only — the whole point is the sign handling.
    const value = -rng.int(1, max);
    return { width, value };
  },

  solve(p) {
    const width = p.width!;
    // Two's complement of a negative number, as an unsigned integer.
    return (1 << width) + p.value!;
  },

  stem(p) {
    return (
      `Represent ${p.value} in ${p.width}-bit two's complement. ` +
      `Give the result as an unsigned decimal integer.`
    );
  },

  distractors(p, correct) {
    const width = p.width!;
    const magnitude = Math.abs(p.value!);
    return [
      {
        // One's complement: inverted the bits but forgot to add 1.
        value: correct - 1,
        misconception: "one's complement: inverted the bits but did not add 1",
      },
      {
        // Sign-magnitude: set the sign bit on the raw magnitude.
        value: 2 ** (width - 1) + magnitude,
        misconception: "sign-magnitude: set the sign bit rather than negating",
      },
      {
        // Ignored the sign entirely.
        value: magnitude,
        misconception: "dropped the sign: encoded the magnitude only",
      },
      {
        // Added one too many.
        value: correct + 1,
        misconception: "off by one: added 2 instead of 1 after inverting",
      },
    ];
  },

  rationale(p, correct) {
    const width = p.width!;
    const magnitude = Math.abs(p.value!);
    const bits = correct.toString(2).padStart(width, "0");
    return (
      `Start with |${p.value}| = ${magnitude} = ${magnitude.toString(2).padStart(width, "0")}. ` +
      `Invert every bit, then add 1. ` +
      `Equivalently: 2^${width} - ${magnitude} = ${correct}. ` +
      `As bits: ${bits}. The leading 1 marks it negative.`
    );
  },
};

/* ============================================================
 * P-16 · Average Memory Access Time
 *
 * AMAT = hit time + (miss rate x miss penalty)
 * ========================================================== */

const amat: Solver = {
  id: "amat",
  version: "1.0.0",
  objectiveHint: "16.3",
  unit: "ns",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      hitTime: rng.pick([1, 2, 3, 4, 5]),
      // Stored as a percentage so the stem reads naturally.
      hitRatePct: rng.pick([85, 88, 90, 92, 94, 95, 96, 97, 98, 99]),
      missPenalty: rng.pick([20, 30, 40, 50, 60, 80, 100, 120, 150, 200]),
    };
  },

  solve(p) {
    const missRate = (100 - p.hitRatePct!) / 100;
    return p.hitTime! + missRate * p.missPenalty!;
  },

  stem(p) {
    return (
      `A cache has a hit time of ${p.hitTime} ns, a hit rate of ${p.hitRatePct}%, ` +
      `and a miss penalty of ${p.missPenalty} ns. What is the average memory access time, in ns?`
    );
  },

  distractors(p) {
    const hitTime = p.hitTime!;
    const hitRate = p.hitRatePct! / 100;
    const missRate = 1 - hitRate;
    const penalty = p.missPenalty!;
    return [
      {
        // Used the hit rate where the miss rate belongs. The most common error
        // on this formula by a wide margin.
        value: hitTime + hitRate * penalty,
        misconception: "used the hit rate instead of the miss rate",
      },
      {
        // Charged the miss penalty on every access.
        value: hitTime + penalty,
        misconception: "applied the miss penalty unconditionally, ignoring the rate",
      },
      {
        // Weighted the hit time as well — a plausible but wrong reading of the
        // formula as a full weighted average.
        value: hitRate * hitTime + missRate * penalty,
        misconception: "weighted the hit time by the hit rate; hit time is paid on every access",
      },
      {
        // Forgot the hit time entirely.
        value: missRate * penalty,
        misconception: "omitted the hit time",
      },
    ];
  },

  rationale(p, correct) {
    const missRate = (100 - p.hitRatePct!) / 100;
    return (
      `AMAT = hit time + (miss rate x miss penalty). ` +
      `The miss rate is 100% - ${p.hitRatePct}% = ${(missRate * 100).toFixed(0)}% = ${missRate}. ` +
      `AMAT = ${p.hitTime} + (${missRate} x ${p.missPenalty}) = ${round(correct, 4)} ns. ` +
      `Note the hit time is paid on every access, hit or miss — only the penalty is conditional.`
    );
  },
};

/* ============================================================
 * Registry
 * ========================================================== */

/*
 * The four original solvers, plus the per-act banks.
 *
 * ADDING to 1.0.0 is safe and is why the banks land here rather than behind a
 * new engine_version: a stored seed only ever references a ref that already
 * existed, so new ids cannot change any paper already sat. MUTATING one of the
 * four below would not be safe, and none of them is touched.
 */
const REGISTRY_1_0_0: ReadonlyMap<string, Solver> = new Map(
  [cycleTime, unitConvert, twosComplement, amat, ...ACT1_SOLVERS, ...ACT2_SOLVERS, ...ACT3_SOLVERS, ...ACT4_SOLVERS].map((s) => [s.id, s] as const),
);

/**
 * Registries are keyed by engine_version and kept FOREVER. An attempt stores the
 * version it was generated under; regenerating it dispatches to that registry.
 * Deleting an old version breaks every paper that used it.
 */
const REGISTRIES: ReadonlyMap<string, ReadonlyMap<string, Solver>> = new Map([
  ["1.0.0", REGISTRY_1_0_0],
]);

export function getSolver(ref: string, engineVersion = "1.0.0"): Solver {
  const registry = REGISTRIES.get(engineVersion);
  if (!registry) {
    throw new Error(
      `Unknown engine_version "${engineVersion}". Known: ${[...REGISTRIES.keys()].join(", ")}. ` +
        `Registries are never deleted — if this version existed, it should still be here.`,
    );
  }
  const solver = registry.get(ref);
  if (!solver) {
    throw new Error(
      `Unknown solver_ref "${ref}" in engine ${engineVersion}. ` +
        `Known: ${[...registry.keys()].join(", ")}.`,
    );
  }
  return solver;
}

export function listSolvers(engineVersion = "1.0.0"): Solver[] {
  const registry = REGISTRIES.get(engineVersion);
  if (!registry) throw new Error(`Unknown engine_version "${engineVersion}"`);
  return [...registry.values()];
}

export { round };
