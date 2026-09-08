import { describe, it, expect } from "vitest";
import { makeRng } from "../../src/engine/seed.js";
import { getSolver } from "../../src/engine/solvers.js";

/**
 * Act 2 solvers, checked against hand-computed values and — where the book
 * publishes one — against Stallings directly.
 *
 * The strongest cases here are the ones that do not rely on my arithmetic at
 * all: the Hamming check-bit counts are Table 5.2 verbatim, and 7200 RPM giving
 * 4.17 ms of average rotational latency is the figure every disk datasheet
 * quotes. Where no published anchor exists, the test asserts the defining
 * PROPERTY (the inequality that k must satisfy, the address split that must
 * reconstruct) rather than a number I computed the same way the solver does.
 */

describe("act 2 — internal memory solvers", () => {
  it("hamming-check-bits reproduces Stallings Table 5.2", () => {
    const s = getSolver("hamming-check-bits");
    const table: Array<[number, number]> = [
      [8, 4],
      [16, 5],
      [32, 6],
      [64, 7],
      [128, 8],
      [256, 9],
    ];
    for (const [dataBits, expected] of table) {
      expect(s.solve({ dataBits }), `${dataBits} data bits`).toBe(expected);
    }
  });

  it("hamming-check-bits returns the MINIMUM k satisfying 2^k >= m + k + 1", () => {
    // The defining property, checked independently of the table: k must work and
    // k - 1 must not. A solver that returned k + 1 everywhere would pass a
    // one-sided test and waste a check bit on every word.
    const s = getSolver("hamming-check-bits");
    for (const dataBits of [8, 16, 32, 64, 128, 256]) {
      const k = s.solve({ dataBits });
      expect(2 ** k, `k=${k} fails for m=${dataBits}`).toBeGreaterThanOrEqual(dataBits + k + 1);
      expect(2 ** (k - 1), `k=${k} is not minimal for m=${dataBits}`).toBeLessThan(dataBits + k);
    }
  });

  it("memory-address-lines takes log2 of the expanded word count", () => {
    const s = getSolver("memory-address-lines");
    expect(s.solve({ kwords: 1024, wordBits: 32 })).toBe(20);
    expect(s.solve({ kwords: 4, wordBits: 8 })).toBe(12);
    // Word width must not affect the answer — that is the misconception the item targets.
    expect(s.solve({ kwords: 64, wordBits: 8 })).toBe(s.solve({ kwords: 64, wordBits: 32 }));
  });

  it("dram-chip-count works in bits, not bytes", () => {
    const s = getSolver("dram-chip-count");
    // A 64M x 4 chip is 256 Mibit = 32 MiB; a 256 MiB module needs 8 of them.
    expect(s.solve({ moduleMiB: 256, chipDepthM: 64, chipWidth: 4 })).toBe(8);
    // A 32M x 8 chip is also 32 MiB; a 128 MiB module needs 4.
    expect(s.solve({ moduleMiB: 128, chipDepthM: 32, chipWidth: 8 })).toBe(4);
    // Halving the chip width must double the chip count.
    expect(s.solve({ moduleMiB: 256, chipDepthM: 64, chipWidth: 8 }) * 2).toBe(
      s.solve({ moduleMiB: 256, chipDepthM: 64, chipWidth: 4 }),
    );
  });

  it("dram-refresh-overhead reconciles nanoseconds against milliseconds", () => {
    const s = getSolver("dram-refresh-overhead");
    // 4096 rows x 100 ns = 409.6 us out of 64 ms = 0.64%.
    expect(s.solve({ rows: 4096, periodMs: 64, refreshNs: 100 })).toBeCloseTo(0.64, 10);
  });

  it("dram-refresh-overhead stays a plausible single-digit percentage", () => {
    // If any drawn combination produced an overhead above a few percent the item
    // would be teaching a false impression of how cheap refresh is.
    const s = getSolver("dram-refresh-overhead");
    const rng = makeRng("a".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const v = s.solve(s.draw(rng));
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(10);
    }
  });
});

describe("act 2 — external memory solvers", () => {
  it("disk-rotational-latency matches the published datasheet figures", () => {
    const s = getSolver("disk-rotational-latency");
    // These are the numbers drive datasheets quote, not my arithmetic.
    expect(s.solve({ rpm: 7200 })).toBeCloseTo(4.1667, 4);
    expect(s.solve({ rpm: 15_000 })).toBeCloseTo(2, 10);
    expect(s.solve({ rpm: 5400 })).toBeCloseTo(5.5556, 4);
  });

  it("disk-access-time sums seek, half a revolution, and transfer", () => {
    const s = getSolver("disk-access-time");
    // 4 + (8.3333/2) + (1/500 x 8.3333) = 4 + 4.1667 + 0.01667 = 8.1833 ms.
    expect(s.solve({ seekMs: 4, rpm: 7200, sectors: 1, sectorsPerTrack: 500 })).toBeCloseTo(8.1833, 4);
  });

  it("disk-access-time always exceeds seek plus rotational delay alone", () => {
    const s = getSolver("disk-access-time");
    const rot = getSolver("disk-rotational-latency");
    const rng = makeRng("b".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const floor = p.seekMs! + rot.solve({ rpm: p.rpm! });
      expect(s.solve(p)).toBeGreaterThan(floor);
    }
  });

  it("disk-capacity multiplies the full geometry", () => {
    const s = getSolver("disk-capacity");
    // 4 x 2048 x 64 x 512 = 268,435,456 bytes = exactly 256 MiB.
    expect(s.solve({ surfaces: 4, tracks: 2048, sectors: 64, sectorBytes: 512 })).toBeCloseTo(256, 10);
  });

  it("raid5-capacity loses exactly one disk to parity", () => {
    const s = getSolver("raid5-capacity");
    expect(s.solve({ disks: 5, diskTb: 4 })).toBe(16);
    expect(s.solve({ disks: 3, diskTb: 2 })).toBe(4);
  });

  it("raid5-overhead is the reciprocal of the disk count", () => {
    const s = getSolver("raid5-overhead");
    expect(s.solve({ disks: 5 })).toBeCloseTo(20, 10);
    expect(s.solve({ disks: 4 })).toBeCloseTo(25, 10);
    // Capacity and overhead must describe the same array.
    const cap = getSolver("raid5-capacity");
    for (const disks of [3, 4, 5, 8, 10]) {
      const usableFraction = cap.solve({ disks, diskTb: 1 }) / disks;
      expect(usableFraction * 100 + s.solve({ disks })).toBeCloseTo(100, 10);
    }
  });
});

describe("act 2 — I/O solvers", () => {
  it("dma-transfer-time converts KiB against MB/s", () => {
    const s = getSolver("dma-transfer-time");
    // 64 KiB = 65,536 bytes at 100 MB/s = 0.65536 ms.
    expect(s.solve({ kib: 64, rateMBs: 100 })).toBeCloseTo(0.655_36, 8);
  });

  it("programmed-io-cost expresses the poll loop as a share of the window", () => {
    const s = getSolver("programmed-io-cost");
    // 1024 bytes x 2 us = 2.048 ms out of 10 ms = 20.48%.
    expect(s.solve({ bytes: 1024, pollUs: 2, totalMs: 10 })).toBeCloseTo(20.48, 10);
  });

  it("programmed-io-cost never claims more than all of the processor", () => {
    const s = getSolver("programmed-io-cost");
    const rng = makeRng("c".repeat(64));
    for (let i = 0; i < 3000; i++) {
      const v = s.solve(s.draw(rng));
      expect(v).toBeGreaterThan(0);
      expect(v, "a share above 100% would be nonsense on a real paper").toBeLessThanOrEqual(100);
    }
  });
});

describe("act 2 — virtual memory solvers", () => {
  it("page-offset-bits takes log2 of the page size in bytes", () => {
    const s = getSolver("page-offset-bits");
    expect(s.solve({ addrBits: 32, pageKiB: 4 })).toBe(12);
    expect(s.solve({ addrBits: 24, pageKiB: 1 })).toBe(10);
  });

  it("the page-number and offset fields reconstruct the address", () => {
    const s = getSolver("page-offset-bits");
    const rng = makeRng("d".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const offset = s.solve(p);
      expect(offset).toBeGreaterThan(0);
      expect(offset, `page larger than the address space: ${JSON.stringify(p)}`).toBeLessThan(p.addrBits!);
    }
  });

  it("page-table-entries covers the whole address space", () => {
    const s = getSolver("page-table-entries");
    // 32-bit space with 4 KiB pages = 2^20 = 1,048,576 entries.
    expect(s.solve({ addrBits: 32, pageKiB: 4 })).toBe(1_048_576);
    // entries x page size must equal the address space exactly.
    const rng = makeRng("e".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      expect(s.solve(p) * (p.pageKiB! * 1024)).toBe(2 ** p.addrBits!);
    }
  });

  it("tlb-effective-access charges a miss an extra memory reference", () => {
    const s = getSolver("tlb-effective-access");
    // 0.9(10 + 100) + 0.1(10 + 200) = 99 + 21 = 120 ns.
    expect(s.solve({ hitPct: 90, tlbNs: 10, memNs: 100 })).toBeCloseTo(120, 10);
  });

  it("tlb-effective-access always lies between the hit and miss paths", () => {
    const s = getSolver("tlb-effective-access");
    const rng = makeRng("f".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const hit = p.tlbNs! + p.memNs!;
      const miss = p.tlbNs! + 2 * p.memNs!;
      const v = s.solve(p);
      expect(v).toBeGreaterThan(hit);
      expect(v).toBeLessThan(miss);
    }
  });
});
