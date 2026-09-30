/**
 * Clock Bench: moon 02.8, "Compute for Cycles per Instruction (CPI), MIPS Rate
 * and MFLOPS Rate based on a given computer system situation" (GAME-DESIGN.md
 * §11; WEB-REVAMP 3.6, approved 30 Sep 2026).
 *
 * HARD RULE 5: the situation is the book's own. Example 2.2 (Stallings ch. 2,
 * `docs/source/book/ch-02.md`): four instruction types, each CPI and its share
 * of the mix, on a 400-MHz processor. The relations are the book's too. The
 * bench only lets a student turn two of the book's own numbers and watch the
 * book's formulas answer. `test/clock-bench.spec.ts` checks every quoted
 * string against the source, and that the arithmetic reproduces the book's
 * result (CPI 2.24, MIPS about 178) at the book's settings.
 *
 * IT GRADES NOTHING. It is a bench, not a quiz: nothing to answer, nothing
 * marked, nothing recorded or sent. The graded, re-rolled drill for this moon
 * is its questions, solved and marked by the server.
 */

export interface InstructionType {
  /** The book's name for it, quoted. */
  name: string;
  /** Cycles per instruction of this type (the book's table). */
  cpi: number;
  /** Its share of the mix in the book's trace, percent. */
  mix: number;
}

/** Example 2.2's table, as printed. The cache-miss row is the one the bench turns. */
export const BOOK_MIX: readonly InstructionType[] = [
  { name: "Arithmetic and logic", cpi: 1, mix: 60 },
  { name: "Load/store with cache hit", cpi: 2, mix: 18 },
  { name: "Branch", cpi: 4, mix: 12 },
  { name: "Memory reference with cache miss", cpi: 8, mix: 10 },
];

/** The book's clock, in MHz. */
export const BOOK_MHZ = 400;
/** The book's instruction count. */
export const BOOK_IC = 2_000_000;

/** Quoted from the book, each with where it is (the test checks both). */
export const RELATIONS = {
  cycle: { text: "a constant cycle time t, where t = 1/f", cite: "Stallings, ch. 2, §2.4" },
  time: { text: "T = Ic * CPI * t", cite: "Stallings, ch. 2, §2.4" },
  mips: {
    text: "the rate at which instructions are executed, expressed as millions of instructions per second (MIPS)",
    cite: "Stallings, ch. 2, §2.4",
  },
  example: {
    text: "The average CPI when the program is executed on a uniprocessor with the above trace results is CPI = 0.6 + (2 * 0.18) + (4 * 0.12) + (8 * 0.1) = 2.24.",
    cite: "Stallings, ch. 2, §2.4, Example 2.2",
  },
} as const;

/**
 * The mix with the cache-miss share set to `missPct`, the difference taken
 * from (or given to) arithmetic and logic, so the mix still totals 100%:
 * "Fix the cache and you move that number more than any clock increase would"
 * (stage 02's reading).
 */
export function mixWithMisses(missPct: number): InstructionType[] {
  const base = BOOK_MIX.map((t) => ({ ...t }));
  const miss = base[3]!;
  const alu = base[0]!;
  const delta = missPct - miss.mix;
  miss.mix = missPct;
  alu.mix = alu.mix - delta;
  return base;
}

/** CPI = Σ (CPIᵢ × fractionᵢ). */
export function weightedCpi(mix: readonly InstructionType[]): number {
  return mix.reduce((sum, t) => sum + t.cpi * (t.mix / 100), 0);
}

/** t = 1/f, in nanoseconds, for f in MHz. */
export function cycleTimeNs(mhz: number): number {
  return 1000 / mhz;
}

/** MIPS rate = f / (CPI × 10⁶), f in MHz so the 10⁶ cancels. */
export function mipsRate(mhz: number, cpi: number): number {
  return mhz / cpi;
}

/** T = Ic × CPI × t, in milliseconds. */
export function cpuTimeMs(ic: number, cpi: number, mhz: number): number {
  return (ic * cpi * cycleTimeNs(mhz)) / 1e6;
}
