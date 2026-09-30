import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOOK_IC,
  BOOK_MHZ,
  BOOK_MIX,
  cpuTimeMs,
  cycleTimeNs,
  mipsRate,
  mixWithMisses,
  RELATIONS,
  weightedCpi,
} from "../src/encounters/clock-bench";

/**
 * Moon 02.8's Clock Bench: the book's situation, quoted (hard rule 5), and the
 * book's arithmetic, reproduced (Example 2.2: CPI 2.24, MIPS about 178).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fold = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const BOOK = fold(readFileSync(resolve(ROOT, "docs/source/book/ch-02.md"), "utf8"));

describe("Clock Bench quotes the book (hard rule 5)", () => {
  it("each relation it shows is the book's sentence", () => {
    for (const [k, r] of Object.entries(RELATIONS)) expect(BOOK, k).toContain(fold(r.text));
  });
  it("each relation sits inside the section it cites: §2.4, Basic Measures of Computer Performance", () => {
    const raw = readFileSync(resolve(ROOT, "docs/source/book/ch-02.md"), "utf8");
    // The chapter opens with a table of contents naming every section once;
    // the section itself is the heading's LAST occurrence.
    const start = raw.lastIndexOf("\n 2.4 Basic Measures of Computer Performance");
    const end = raw.indexOf("\n 2.5 Calculating the Mean", start);
    expect(start).toBeGreaterThan(0);
    const section = fold(raw.slice(start, end));
    for (const [k, r] of Object.entries(RELATIONS)) {
      expect(r.cite, k).toMatch(/§2\.4/);
      expect(section, k).toContain(fold(r.text));
    }
  });

  it("the table is Example 2.2's, row for row", () => {
    for (const t of BOOK_MIX) expect(BOOK).toContain(fold(`${t.name} ${t.cpi} ${t.mix}`));
    expect(BOOK).toContain("2 million instructions on a 400-mhz processor");
  });
});

describe("Clock Bench's arithmetic is the book's", () => {
  it("at the book's settings: CPI 2.24, MIPS about 178, t = 2.5 ns", () => {
    const cpi = weightedCpi(BOOK_MIX);
    expect(cpi).toBeCloseTo(2.24, 10);
    expect(mipsRate(BOOK_MHZ, cpi)).toBeCloseTo(178.57, 2);
    expect(Math.floor(mipsRate(BOOK_MHZ, cpi))).toBe(178);
    expect(cycleTimeNs(BOOK_MHZ)).toBe(2.5);
    // T = Ic × CPI × t = 2,000,000 × 2.24 × 2.5 ns = 11.2 ms
    expect(cpuTimeMs(BOOK_IC, cpi, BOOK_MHZ)).toBeCloseTo(11.2, 10);
  });

  it("turning the cache-miss share keeps the mix at 100% and moves CPI by 7 cycles per point", () => {
    for (const miss of [0, 5, 10, 20, 30]) {
      const mix = mixWithMisses(miss);
      expect(mix.reduce((s, t) => s + t.mix, 0)).toBe(100);
      // each point of misses (CPI 8) replaces a point of arithmetic (CPI 1)
      expect(weightedCpi(mix)).toBeCloseTo(2.24 + (miss - 10) * 0.07, 10);
    }
  });

  it("the book's own table is untouched by the bench", () => {
    mixWithMisses(30);
    expect(BOOK_MIX[3]!.mix).toBe(10);
    expect(BOOK_MIX[0]!.mix).toBe(60);
  });
});
