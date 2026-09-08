import { describe, it, expect } from "vitest";
import { makeRng } from "../../src/engine/seed.js";
import { getSolver } from "../../src/engine/solvers.js";

/**
 * Acts 3 and 4 solvers, checked against hand-computed values and defining
 * properties.
 *
 * Same discipline as acts 1 and 2: where a published constant exists (the IEEE
 * 754 single-precision bias of 127, "about 7 decimal digits" for a 24-bit
 * significand) the test anchors to it. Otherwise it asserts the property that
 * makes the item true — the ceiling relation an opcode field must satisfy, the
 * bound a speedup can never cross — rather than recomputing the solver's own
 * arithmetic and calling that a check.
 */

describe("act 3 — arithmetic solvers", () => {
  it("twos-complement-max is 2^(n-1) - 1", () => {
    const s = getSolver("twos-complement-max");
    expect(s.solve({ width: 8 })).toBe(127);
    expect(s.solve({ width: 16 })).toBe(32_767);
    expect(s.solve({ width: 4 })).toBe(7);
  });

  it("twos-complement-sum encodes a negative result as a bit pattern", () => {
    const s = getSolver("twos-complement-sum");
    // Positive result passes through unchanged.
    expect(s.solve({ width: 8, a: 50, b: -20 })).toBe(30);
    // Negative result wraps: 256 - 30 = 226.
    expect(s.solve({ width: 8, a: 20, b: -50 })).toBe(226);
  });

  it("twos-complement-sum never produces a pattern outside the word", () => {
    const s = getSolver("twos-complement-sum");
    const rng = makeRng("1".repeat(64));
    for (let i = 0; i < 3000; i++) {
      const p = s.draw(rng);
      const v = s.solve(p);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v, `pattern overflows ${p.width} bits`).toBeLessThan(2 ** p.width!);
    }
  });

  it("sign-extend preserves the value", () => {
    const s = getSolver("sign-extend");
    // -5 in 16 bits is 65531.
    expect(s.solve({ from: 8, to: 16, value: -5 })).toBe(65_531);
    // The decoded value must equal the original for every draw — that IS sign extension.
    const rng = makeRng("2".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      expect(s.solve(p) - 2 ** p.to!).toBe(p.value!);
    }
  });

  it("ieee754-stored-exponent uses the published biases", () => {
    const s = getSolver("ieee754-stored-exponent");
    // Single precision: 8-bit exponent, bias 127. Double: 11-bit, bias 1023.
    expect(s.solve({ expBits: 8, bias: 127, actual: 5 })).toBe(132);
    expect(s.solve({ expBits: 8, bias: 127, actual: -10 })).toBe(117);
    expect(s.solve({ expBits: 11, bias: 1023, actual: 0 })).toBe(1023);
  });

  it("ieee754-stored-exponent only ever draws the two real biases", () => {
    const s = getSolver("ieee754-stored-exponent");
    const rng = makeRng("3".repeat(64));
    for (let i = 0; i < 1000; i++) {
      const p = s.draw(rng);
      expect([127, 1023]).toContain(p.bias!);
      expect(p.bias!).toBe(2 ** (p.expBits! - 1) - 1);
      // A stored exponent must stay inside the field and clear of the reserved codes.
      const stored = s.solve(p);
      expect(stored).toBeGreaterThan(0);
      expect(stored).toBeLessThan(2 ** p.expBits! - 1);
    }
  });

  it("float-precision-digits reproduces the familiar 7 and 16 digit figures", () => {
    const s = getSolver("float-precision-digits");
    expect(s.solve({ sigBits: 24 })).toBeCloseTo(7.2247, 4);
    expect(s.solve({ sigBits: 53 })).toBeCloseTo(15.9546, 4);
  });
});

describe("act 3 — instruction format and addressing solvers", () => {
  it("opcode-bits rounds up", () => {
    const s = getSolver("opcode-bits");
    expect(s.solve({ opcodes: 12 })).toBe(4);
    expect(s.solve({ opcodes: 33 })).toBe(6);
    expect(s.solve({ opcodes: 200 })).toBe(8);
  });

  it("opcode-bits is the MINIMUM field that fits", () => {
    const s = getSolver("opcode-bits");
    for (const opcodes of [12, 20, 33, 40, 60, 100, 150, 200]) {
      const n = s.solve({ opcodes });
      expect(2 ** n, `${opcodes} opcodes do not fit in ${n} bits`).toBeGreaterThanOrEqual(opcodes);
      expect(2 ** (n - 1), `${n} bits is not minimal for ${opcodes}`).toBeLessThan(opcodes);
    }
  });

  it("instruction-address-bits subtracts every field", () => {
    const s = getSolver("instruction-address-bits");
    // 32 - 6 opcode - 2 x log2(16) = 32 - 6 - 8 = 18.
    expect(s.solve({ instrBits: 32, opcodeBits: 6, regFields: 2, regs: 16 })).toBe(18);
  });

  it("instruction-address-bits always leaves a usable address field", () => {
    // A negative address field would be an unanswerable question on a real paper.
    const s = getSolver("instruction-address-bits");
    const rng = makeRng("4".repeat(64));
    for (let i = 0; i < 3000; i++) {
      const p = s.draw(rng);
      expect(
        s.solve(p),
        `unusable address field from ${JSON.stringify(p)}`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("effective-address-indexed scales only the index", () => {
    const s = getSolver("effective-address-indexed");
    expect(s.solve({ base: 1000, index: 10, scale: 4, disp: 8 })).toBe(1048);
  });

  it("effective-address-relative uses the already-incremented PC", () => {
    const s = getSolver("effective-address-relative");
    expect(s.solve({ pc: 1000, instrBytes: 4, disp: 16 })).toBe(1020);
    // A backward branch must land before the instruction itself.
    expect(s.solve({ pc: 1000, instrBytes: 4, disp: -64 })).toBe(940);
  });
});

describe("act 3 — pipeline solvers", () => {
  it("pipeline-cycles is k + n - 1", () => {
    const s = getSolver("pipeline-cycles");
    expect(s.solve({ stages: 5, instructions: 100 })).toBe(104);
    expect(s.solve({ stages: 4, instructions: 10 })).toBe(13);
  });

  it("pipeline-speedup approaches but never reaches the depth", () => {
    const s = getSolver("pipeline-speedup");
    // 100 x 5 / 104 = 4.8077.
    expect(s.solve({ stages: 5, instructions: 100 })).toBeCloseTo(4.8077, 4);
    const rng = makeRng("5".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const v = s.solve(p);
      expect(v).toBeGreaterThan(1);
      expect(v, "speedup cannot reach the pipeline depth").toBeLessThan(p.stages!);
    }
  });

  it("pipeline-speedup and pipeline-cycles describe the same machine", () => {
    const cycles = getSolver("pipeline-cycles");
    const speedup = getSolver("pipeline-speedup");
    for (const p of [
      { stages: 5, instructions: 100 },
      { stages: 8, instructions: 20 },
      { stages: 4, instructions: 1000 },
    ]) {
      expect(speedup.solve(p)).toBeCloseTo((p.instructions * p.stages) / cycles.solve(p), 10);
    }
  });

  it("branch-penalty-cpi penalises only taken branches", () => {
    const s = getSolver("branch-penalty-cpi");
    // 1 + 0.20 x 0.75 x 2 = 1.30.
    expect(s.solve({ branchPct: 20, takenPct: 75, penalty: 2 })).toBeCloseTo(1.3, 10);
  });

  it("hazard-stall-cpi is always above 1 and below the worst case", () => {
    const s = getSolver("hazard-stall-cpi");
    expect(s.solve({ loadPct: 30, dependentPct: 50, stall: 1 })).toBeCloseTo(1.15, 10);
    const rng = makeRng("6".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const v = s.solve(p);
      expect(v).toBeGreaterThan(1);
      expect(v).toBeLessThan(1 + p.stall!);
    }
  });
});

describe("act 4 — RISC and ILP solvers", () => {
  it("register-window-total counts the globals once", () => {
    const s = getSolver("register-window-total");
    expect(s.solve({ globals: 10, windows: 8, perWindow: 16 })).toBe(138);
  });

  it("compiler-register-spill is the excess only", () => {
    const s = getSolver("compiler-register-spill");
    expect(s.solve({ registers: 16, liveVars: 20 })).toBe(4);
    // The draw must always create real pressure, or the item is vacuous.
    const rng = makeRng("7".repeat(64));
    for (let i = 0; i < 2000; i++) {
      expect(s.solve(s.draw(rng))).toBeGreaterThan(0);
    }
  });

  it("superscalar-cycles keeps the fill cost unscaled", () => {
    const s = getSolver("superscalar-cycles");
    // 6 + ceil(99/2) = 6 + 50 = 56.
    expect(s.solve({ stages: 6, instructions: 100, width: 2 })).toBe(56);
  });

  it("superscalar-speedup stays below the issue width", () => {
    const s = getSolver("superscalar-speedup");
    // 105 / 56 = 1.875.
    expect(s.solve({ stages: 6, instructions: 100, width: 2 })).toBeCloseTo(1.875, 6);
    const rng = makeRng("8".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const v = s.solve(p);
      expect(v).toBeGreaterThan(1);
      expect(v, "speedup cannot reach the issue width").toBeLessThan(p.width!);
    }
  });

  it("issue-utilization never reports a full or impossible machine", () => {
    const s = getSolver("issue-utilization");
    expect(s.solve({ width: 4, ipcTenths: 24 })).toBeCloseTo(60, 10);
    const rng = makeRng("9".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const v = s.solve(s.draw(rng));
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(100);
    }
  });
});

describe("act 4 — control unit solvers", () => {
  it("micro-ops-total sums the phases", () => {
    const s = getSolver("micro-ops-total");
    expect(s.solve({ fetch: 3, indirect: 2, execute: 4, interrupt: 3 })).toBe(12);
  });

  it("control-memory-bits converts bits to KiB", () => {
    const s = getSolver("control-memory-bits");
    // 1024 x 64 = 65,536 bits = 8192 bytes = 8 KiB.
    expect(s.solve({ words: 1024, widthBits: 64 })).toBeCloseTo(8, 10);
  });

  it("control-address-bits addresses the whole control memory", () => {
    const s = getSolver("control-address-bits");
    expect(s.solve({ words: 1024 })).toBe(10);
    expect(s.solve({ words: 8192 })).toBe(13);
  });

  it("vertical-encoding-bits leaves room for the no-op code", () => {
    const s = getSolver("vertical-encoding-bits");
    expect(s.solve({ signals: 12 })).toBe(4);
    // 7 signals + 1 no-op = 8 codes = exactly 3 bits; 15 + 1 = 16 = exactly 4.
    expect(s.solve({ signals: 7 })).toBe(3);
    expect(s.solve({ signals: 15 })).toBe(4);
    // The defining property, over every drawn value.
    for (const signals of [7, 12, 15, 20, 31, 40, 63]) {
      const bits = s.solve({ signals });
      expect(2 ** bits).toBeGreaterThanOrEqual(signals + 1);
      expect(2 ** (bits - 1)).toBeLessThan(signals + 1);
    }
  });
});

describe("act 4 — multicore and distributed solvers", () => {
  it("multicore-efficiency divides speedup by cores", () => {
    const s = getSolver("multicore-efficiency");
    expect(s.solve({ cores: 8, speedupTenths: 64 })).toBeCloseTo(80, 10);
    // Efficiency above 100% would claim superlinear speedup, which the draw must never imply.
    const rng = makeRng("a".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const v = s.solve(s.draw(rng));
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(100);
    }
  });

  it("multicore-cache-total counts L3 once and L2 per core", () => {
    const s = getSolver("multicore-cache-total");
    // 4 x 256 KiB = 1 MiB of L2, plus 8 MiB of shared L3 = 9 MiB.
    expect(s.solve({ cores: 4, l2KiB: 256, l3MiB: 8 })).toBeCloseTo(9, 10);
  });

  it("bandwidth-delay-product multiplies rate by time", () => {
    const s = getSolver("bandwidth-delay-product");
    // 100 Mbit/s x 20 ms = 2,000,000 bits = 250,000 bytes = 244.14 KiB.
    expect(s.solve({ mbps: 100, rttMs: 20 })).toBeCloseTo(244.1406, 3);
  });

  it("message-latency adds propagation and transmission", () => {
    const s = getSolver("message-latency");
    // 1000 km / 2e8 m/s = 5 ms; 1500 bytes at 100 Mbit/s = 0.12 ms; total 5.12 ms.
    expect(s.solve({ bytes: 1500, mbps: 100, km: 1000 })).toBeCloseTo(5.12, 8);
  });

  it("message-latency is always dominated by whichever term the numbers favour", () => {
    // Both components must be strictly positive, or one of the two ideas the item
    // teaches has silently vanished from the answer.
    const s = getSolver("message-latency");
    const rng = makeRng("b".repeat(64));
    for (let i = 0; i < 2000; i++) {
      const p = s.draw(rng);
      const propagation = ((p.km! * 1000) / 2e8) * 1000;
      const transmission = ((p.bytes! * 8) / (p.mbps! * 1e6)) * 1000;
      expect(propagation).toBeGreaterThan(0);
      expect(transmission).toBeGreaterThan(0);
      expect(s.solve(p)).toBeCloseTo(propagation + transmission, 10);
    }
  });
});
