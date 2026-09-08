import { describe, it, expect } from "vitest";
import { makeRng } from "../../src/engine/seed.js";
import { getSolver } from "../../src/engine/solvers.js";

/**
 * Act 1 solvers, checked against hand-computed values.
 *
 * The registry suite in `solvers.spec.ts` proves these do not crash, produce
 * finite answers, and interpolate their stems. It does NOT prove the arithmetic
 * is right, and a wrong solver is not a bug — it is a grading incident affecting
 * every student who drew that variant. So every solver here has at least one
 * case worked by hand, and where a real published figure exists (PCIe link
 * rates, Amdahl's textbook example) the test anchors to that instead of to my
 * own arithmetic.
 */

describe("act 1 — performance solvers", () => {
  it("cpi-from-mix weights by instruction count, not by class", () => {
    const s = getSolver("cpi-from-mix");
    // 4M x 1 + 2M x 3 + 1M x 4 = 14M cycles over 7M instructions = 2.00 CPI.
    expect(s.solve({ nAlu: 4, nLoad: 2, nBranch: 1, cAlu: 1, cLoad: 3, cBranch: 4 })).toBeCloseTo(2, 10);
    // The unweighted mean of 1, 3, 4 is 2.67 — deliberately different, so a
    // weighting bug cannot pass this case by coincidence.
    expect(s.solve({ nAlu: 10, nLoad: 1, nBranch: 1, cAlu: 1, cLoad: 4, cBranch: 4 })).toBeCloseTo(1.5, 10);
  });

  it("mips-rate divides the clock by CPI", () => {
    const s = getSolver("mips-rate");
    expect(s.solve({ f: 2000, cpi: 2.5 })).toBeCloseTo(800, 10);
    expect(s.solve({ f: 1000, cpi: 2 })).toBeCloseTo(500, 10);
  });

  it("mflops-rate converts milliseconds to seconds", () => {
    const s = getSolver("mflops-rate");
    // 100M ops in 10 ms = 100M / 0.01 s = 10,000 MFLOPS.
    expect(s.solve({ ops: 100, ms: 10 })).toBeCloseTo(10_000, 6);
    expect(s.solve({ ops: 50, ms: 25 })).toBeCloseTo(2000, 6);
  });

  it("exec-time answers in milliseconds", () => {
    const s = getSolver("exec-time");
    // 10M instructions x 2 cycles = 20M cycles at 1 GHz = 0.02 s = 20 ms.
    expect(s.solve({ ic: 10, cpi: 2, f: 1000 })).toBeCloseTo(20, 10);
    expect(s.solve({ ic: 100, cpi: 4, f: 2000 })).toBeCloseTo(200, 10);
  });

  it("clock-from-mips inverts the MIPS relation", () => {
    const s = getSolver("clock-from-mips");
    expect(s.solve({ mips: 500, cpi: 2 })).toBeCloseTo(1000, 10);
    // Round trip against mips-rate: the two must agree or one of them is wrong.
    const mips = getSolver("mips-rate");
    expect(mips.solve({ f: s.solve({ mips: 400, cpi: 2.5 }), cpi: 2.5 })).toBeCloseTo(400, 10);
  });

  it("amdahl-speedup matches the textbook 90%/10x case", () => {
    const s = getSolver("amdahl-speedup");
    // 1 / (0.10 + 0.90/10) = 1 / 0.19 = 5.263...
    expect(s.solve({ fpct: 90, k: 10 })).toBeCloseTo(5.263_157_9, 6);
    expect(s.solve({ fpct: 50, k: 2 })).toBeCloseTo(4 / 3, 10);
  });

  it("amdahl-speedup never exceeds the serial-fraction ceiling", () => {
    const s = getSolver("amdahl-speedup");
    const rng = makeRng("a".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const ceiling = 1 / (1 - p.fpct! / 100);
      expect(s.solve(p)).toBeLessThan(ceiling + 1e-9);
      expect(s.solve(p)).toBeGreaterThan(1);
    }
  });
});

describe("act 1 — memory-hierarchy solvers", () => {
  it("mem-cost-per-bit is dominated by the larger, cheaper level", () => {
    const s = getSolver("mem-cost-per-bit");
    // (100x1 + 2x1024) / 1025 = 2148 / 1025 = 2.0956...
    expect(s.solve({ c1: 100, s1: 1, c2: 2, s2: 1024 })).toBeCloseTo(2.095_609_7, 6);
    // The result must always sit between the two unit costs.
    const rng = makeRng("b".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const v = s.solve(p);
      expect(v).toBeGreaterThan(Math.min(p.c1!, p.c2!));
      expect(v).toBeLessThan(Math.max(p.c1!, p.c2!));
    }
  });

  it("required-hit-ratio inverts the two-level access equation", () => {
    const s = getSolver("required-hit-ratio");
    // Ts = T1 + (1-H).T2 -> 4 = 2 + (1-H).100 -> H = 0.98.
    expect(s.solve({ t1: 2, t2: 100, target: 4 })).toBeCloseTo(98, 10);
  });

  it("required-hit-ratio always draws a satisfiable target", () => {
    // A drawn target below T1, or above T1 + T2, would demand a hit ratio
    // outside [0, 1] and put an impossible question on a real paper.
    const s = getSolver("required-hit-ratio");
    const rng = makeRng("c".repeat(64));
    for (let i = 0; i < 3000; i++) {
      const p = s.draw(rng);
      const h = s.solve(p) / 100;
      expect(h, `unsatisfiable draw ${JSON.stringify(p)}`).toBeGreaterThan(0);
      expect(h, `unsatisfiable draw ${JSON.stringify(p)}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("act 1 — interconnection solvers", () => {
  it("bus-bandwidth converts bits to bytes", () => {
    const s = getSolver("bus-bandwidth");
    // 64 bits = 8 bytes per clock at 100 MHz = 800 MB/s.
    expect(s.solve({ widthBits: 64, mhz: 100 })).toBeCloseTo(800, 10);
    expect(s.solve({ widthBits: 32, mhz: 33 })).toBeCloseTo(132, 10);
  });

  it("pcie-throughput matches the published link rates", () => {
    const s = getSolver("pcie-throughput");
    // These are the real figures, not my arithmetic: PCIe 1.0 x1 is 250 MB/s
    // and PCIe 2.0 x16 is 8 GB/s. Both fall straight out of 8b/10b.
    expect(s.solve({ lanes: 1, gts: 2.5 })).toBeCloseTo(250, 6);
    expect(s.solve({ lanes: 16, gts: 5 })).toBeCloseTo(8000, 6);
    expect(s.solve({ lanes: 4, gts: 2.5 })).toBeCloseTo(1000, 6);
  });

  it("memory-references counts the instruction fetch", () => {
    const s = getSolver("memory-references");
    expect(s.solve({ instructions: 10, withOperand: 4, stores: 2 })).toBe(16);
    // Never fewer references than instructions — every instruction is fetched.
    const rng = makeRng("d".repeat(64));
    for (let i = 0; i < 1000; i++) {
      const p = s.draw(rng);
      expect(s.solve(p)).toBeGreaterThanOrEqual(p.instructions!);
    }
  });

  it("interrupt-saving converts the handler from microseconds", () => {
    const s = getSolver("interrupt-saving");
    // 100 ops x 10 ms = 1000 ms busy; 100 x 100 us = 10 ms driven; saving 990 ms.
    expect(s.solve({ ops: 100, waitMs: 10, handlerUs: 100 })).toBeCloseTo(990, 10);
  });

  it("interrupt-saving is always positive for the drawn ranges", () => {
    // A negative saving would claim interrupts are slower than busy waiting,
    // which the drawn ranges must never produce.
    const s = getSolver("interrupt-saving");
    const rng = makeRng("e".repeat(64));
    for (let i = 0; i < 2000; i++) {
      expect(s.solve(s.draw(rng))).toBeGreaterThan(0);
    }
  });
});

describe("act 1 — cache address solvers", () => {
  it("cache-lines divides total bytes by line size", () => {
    const s = getSolver("cache-lines");
    expect(s.solve({ cacheKiB: 64, lineBytes: 32 })).toBe(2048);
    expect(s.solve({ cacheKiB: 8, lineBytes: 16 })).toBe(512);
  });

  it("cache-direct-tag-bits splits the address exactly", () => {
    const s = getSolver("cache-direct-tag-bits");
    // 64 KiB / 32 B = 2048 lines = 11 bits; 32 B line = 5 bits; 32 - 11 - 5 = 16.
    expect(s.solve({ addrBits: 32, cacheKiB: 64, lineBytes: 32 })).toBe(16);
  });

  it("the three cache address fields always sum to the address width", () => {
    // This is the property the whole item rests on. If tag + line + word ever
    // failed to reconstruct the address, the item would be teaching a falsehood.
    const s = getSolver("cache-direct-tag-bits");
    const rng = makeRng("f".repeat(64));
    for (let i = 0; i < 3000; i++) {
      const p = s.draw(rng);
      const lines = (p.cacheKiB! * 1024) / p.lineBytes!;
      const lineBits = Math.round(Math.log2(lines));
      const wordBits = Math.round(Math.log2(p.lineBytes!));
      expect(s.solve(p) + lineBits + wordBits).toBe(p.addrBits!);
      expect(s.solve(p), `non-positive tag from ${JSON.stringify(p)}`).toBeGreaterThan(0);
    }
  });

  it("cache-set-bits accounts for associativity", () => {
    const s = getSolver("cache-set-bits");
    // 64 KiB / 32 B = 2048 lines; 4-way -> 512 sets -> 9 bits.
    expect(s.solve({ cacheKiB: 64, lineBytes: 32, ways: 4 })).toBe(9);
    // Doubling associativity removes exactly one set bit.
    expect(s.solve({ cacheKiB: 64, lineBytes: 32, ways: 8 })).toBe(8);
  });

  it("cache-line-number wraps the block number into the cache", () => {
    const s = getSolver("cache-line-number");
    // floor(10000 / 32) = 312; 312 mod 256 = 56.
    expect(s.solve({ lineBytes: 32, lines: 256, address: 10_000 })).toBe(56);
  });

  it("cache-line-number always lands inside the cache", () => {
    const s = getSolver("cache-line-number");
    const rng = makeRng("0".repeat(64));
    for (let i = 0; i < 3000; i++) {
      const p = s.draw(rng);
      const v = s.solve(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(p.lines!);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
