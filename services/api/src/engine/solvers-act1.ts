/**
 * Act 1 (Prelim) parameterized solvers -- stages 01-04.
 *
 * Source: Stallings, *Computer Organization and Architecture*, chapters 1-4
 * (Basic Concepts; Performance Issues; A Top-Level View of Computer Function and
 * Interconnection; Cache Memory). Every formula below is the book's: the
 * two-level memory equations are section 4.3, Amdahl's law is section 2.2, and
 * the cache address split is section 4.3.
 *
 * The Prelim blueprint asks for 13 P items drawn from act 1 with at most 3 per
 * objective, so this bank spans EIGHT objectives rather than piling variants
 * onto 02.8 -- 8 x 3 = 24 available against a demand of 13.
 */

import { type Distractor, type Solver, log2, round } from "./solver-core.js";

/* ============================================================
 * 02.8 · Cycles per instruction from an instruction mix
 * Stallings section 2.2: CPI = sum(CPI_i x I_i) / Ic
 * ========================================================== */

const cpiFromMix: Solver = {
  id: "cpi-from-mix",
  version: "1.0.0",
  objectiveHint: "02.8",
  unit: "",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      nAlu: rng.pick([2, 3, 4, 5, 6, 8, 10, 12]),
      nLoad: rng.pick([1, 2, 3, 4, 5, 6]),
      nBranch: rng.pick([1, 2, 3, 4]),
      cAlu: 1,
      cLoad: rng.pick([2, 3, 4]),
      cBranch: rng.pick([2, 3, 4, 5]),
    };
  },

  solve(p) {
    const total = p.nAlu! + p.nLoad! + p.nBranch!;
    return (p.nAlu! * p.cAlu! + p.nLoad! * p.cLoad! + p.nBranch! * p.cBranch!) / total;
  },

  stem(p) {
    return (
      `A program executes ${p.nAlu} million ALU instructions at ${p.cAlu} cycle each, ` +
      `${p.nLoad} million load/store instructions at ${p.cLoad} cycles each, and ` +
      `${p.nBranch} million branch instructions at ${p.cBranch} cycles each. ` +
      `What is the average CPI for this program?`
    );
  },

  distractors(p, correct): Distractor[] {
    const cycles = p.nAlu! * p.cAlu! + p.nLoad! * p.cLoad! + p.nBranch! * p.cBranch!;
    return [
      {
        // Averaged the three CPI values without weighting by instruction count.
        value: (p.cAlu! + p.cLoad! + p.cBranch!) / 3,
        misconception: "took an unweighted mean of the three CPI values",
      },
      {
        // Stopped at total cycles.
        value: cycles,
        misconception: "answered total cycles rather than cycles per instruction",
      },
      {
        // Divided by the number of classes rather than the instruction count.
        value: cycles / 3,
        misconception: "divided total cycles by the number of instruction classes",
      },
      {
        // Dropped the ALU class from the denominator only.
        value: cycles / (p.nLoad! + p.nBranch!),
        misconception: "omitted the ALU instructions from the instruction count",
      },
      {
        value: correct + 1,
        misconception: "added a cycle per instruction for the fetch, which CPI already includes",
      },
    ];
  },

  rationale(p, correct) {
    const total = p.nAlu! + p.nLoad! + p.nBranch!;
    const cycles = p.nAlu! * p.cAlu! + p.nLoad! * p.cLoad! + p.nBranch! * p.cBranch!;
    return (
      `CPI is a weighted mean: sum of (count x cycles) divided by total instructions. ` +
      `Cycles = ${p.nAlu}x${p.cAlu} + ${p.nLoad}x${p.cLoad} + ${p.nBranch}x${p.cBranch} = ${cycles} million. ` +
      `Instructions = ${total} million. CPI = ${cycles}/${total} = ${round(correct, 4)}. ` +
      `The weights matter: a rare 10-cycle instruction moves CPI far less than a common 2-cycle one.`
    );
  },
};

/* ============================================================
 * 02.8 · MIPS rate.  MIPS = f / (CPI x 10^6)
 * ========================================================== */

const mipsRate: Solver = {
  id: "mips-rate",
  version: "1.0.0",
  objectiveHint: "02.8",
  unit: "MIPS",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      f: rng.pick([200, 400, 500, 800, 1000, 1200, 1600, 2000, 2400, 3000, 3200]),
      cpi: rng.pick([1.2, 1.5, 1.8, 2, 2.4, 2.5, 3, 3.5, 4]),
    };
  },

  solve(p) {
    // f is in MHz, so (f x 10^6) / (CPI x 10^6) = f / CPI directly in MIPS.
    return p.f! / p.cpi!;
  },

  stem(p) {
    return (
      `A processor runs at ${p.f} MHz and averages ${p.cpi} cycles per instruction. ` +
      `What is its MIPS rate?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.f! * p.cpi!,
        misconception: "multiplied by CPI instead of dividing",
      },
      {
        value: p.f!,
        misconception: "ignored CPI entirely and reported the clock rate",
      },
      {
        value: p.cpi! / p.f!,
        misconception: "inverted the ratio",
      },
      {
        value: p.f! / (p.cpi! * 1000),
        misconception: "answered in BIPS: divided by an extra factor of 1000",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `MIPS = f / (CPI x 10^6). With f = ${p.f} MHz = ${p.f} x 10^6 Hz the millions cancel, ` +
      `so MIPS = ${p.f} / ${p.cpi} = ${round(correct, 4)}. ` +
      `MIPS only compares machines running the SAME instruction set -- Stallings section 2.2 ` +
      `is explicit that it is not a cross-architecture measure.`
    );
  },
};

/* ============================================================
 * 02.8 · MFLOPS rate
 * ========================================================== */

const mflopsRate: Solver = {
  id: "mflops-rate",
  version: "1.0.0",
  objectiveHint: "02.8",
  unit: "MFLOPS",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      ops: rng.pick([50, 80, 100, 120, 200, 250, 400, 500, 750, 1000]),
      ms: rng.pick([2, 4, 5, 8, 10, 16, 20, 25, 40, 50]),
    };
  },

  solve(p) {
    // ops is in millions, ms in milliseconds -> MFLOPS = ops / (ms / 1000).
    return p.ops! / (p.ms! / 1000);
  },

  stem(p) {
    return (
      `A numerical kernel performs ${p.ops} million floating-point operations in ` +
      `${p.ms} ms. What is the MFLOPS rate?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.ops! / p.ms!,
        misconception: "left the time in milliseconds instead of converting to seconds",
      },
      {
        value: p.ops! * p.ms!,
        misconception: "multiplied by time instead of dividing",
      },
      {
        value: p.ops!,
        misconception: "reported the operation count rather than a rate",
      },
      {
        value: p.ops! / (p.ms! / 1000) / 1000,
        misconception: "answered in GFLOPS",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `MFLOPS = (floating-point operations in millions) / (execution time in seconds). ` +
      `${p.ms} ms = ${p.ms! / 1000} s, so MFLOPS = ${p.ops} / ${p.ms! / 1000} = ${round(correct, 4)}. ` +
      `The commonest slip is leaving the time in milliseconds, which inflates the rate 1000-fold.`
    );
  },
};

/* ============================================================
 * 02.8 · Execution time.  T = Ic x CPI / f
 * ========================================================== */

const execTime: Solver = {
  id: "exec-time",
  version: "1.0.0",
  objectiveHint: "02.8",
  unit: "ms",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      ic: rng.pick([2, 5, 10, 20, 25, 50, 100, 200]),
      cpi: rng.pick([1.5, 2, 2.5, 3, 3.5, 4]),
      f: rng.pick([500, 800, 1000, 1600, 2000, 2500, 3200]),
    };
  },

  solve(p) {
    // Ic in millions, f in MHz -> T = (Ic x 10^6 x CPI) / (f x 10^6) s = Ic x CPI / f s.
    return ((p.ic! * p.cpi!) / p.f!) * 1000;
  },

  stem(p) {
    return (
      `A program contains ${p.ic} million instructions, averages ${p.cpi} cycles per instruction, ` +
      `and runs on a ${p.f} MHz processor. What is its execution time, in milliseconds?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: (p.ic! * p.cpi!) / p.f!,
        misconception: "answered in seconds and did not convert to milliseconds",
      },
      {
        value: (p.ic! * p.f!) / p.cpi!,
        misconception: "multiplied by clock rate instead of dividing",
      },
      {
        value: (p.ic! / (p.cpi! * p.f!)) * 1000,
        misconception: "divided by CPI instead of multiplying",
      },
      {
        value: ((p.ic! * p.cpi!) / p.f!) * 1e6,
        misconception: "converted to nanoseconds while the question asked for milliseconds",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `T = Ic x CPI / f. The 10^6 in the instruction count cancels the 10^6 in MHz, so ` +
      `T = ${p.ic} x ${p.cpi} / ${p.f} = ${round((p.ic! * p.cpi!) / p.f!, 4)} s = ${round(correct, 4)} ms. ` +
      `This is Stallings' basic performance equation: all three factors matter, which is why a ` +
      `higher clock alone does not guarantee a faster machine.`
    );
  },
};

/* ============================================================
 * 02.8 · Clock rate implied by a MIPS figure.  f = MIPS x CPI
 * ========================================================== */

const clockFromMips: Solver = {
  id: "clock-from-mips",
  version: "1.0.0",
  objectiveHint: "02.8",
  unit: "MHz",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      mips: rng.pick([100, 200, 250, 400, 500, 600, 800, 1000, 1250]),
      cpi: rng.pick([1.5, 2, 2.5, 3, 3.2, 4]),
    };
  },

  solve(p) {
    return p.mips! * p.cpi!;
  },

  stem(p) {
    return (
      `A processor is rated at ${p.mips} MIPS while averaging ${p.cpi} cycles per instruction. ` +
      `What clock rate, in MHz, does that imply?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.mips! / p.cpi!,
        misconception: "divided by CPI instead of multiplying -- ran the MIPS formula backwards",
      },
      {
        value: p.mips!,
        misconception: "assumed one instruction per cycle regardless of the stated CPI",
      },
      {
        value: p.cpi!,
        misconception: "answered with CPI rather than a frequency",
      },
      {
        value: p.mips! * p.cpi! * 1000,
        misconception: "answered in kHz",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Rearranging MIPS = f / CPI gives f = MIPS x CPI = ${p.mips} x ${p.cpi} = ${round(correct, 4)} MHz. ` +
      `A machine retiring ${p.mips} million instructions per second while spending ${p.cpi} cycles on ` +
      `each must be issuing ${round(correct, 4)} million cycles per second.`
    );
  },
};

/* ============================================================
 * 02.3 · Amdahl's law.  S = 1 / ((1 - f) + f/k)
 * Stallings section 2.2.
 * ========================================================== */

const amdahlSpeedup: Solver = {
  id: "amdahl-speedup",
  version: "1.0.0",
  objectiveHint: "02.3",
  unit: "x",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      fpct: rng.pick([50, 60, 70, 75, 80, 85, 90, 95]),
      k: rng.pick([2, 4, 5, 8, 10, 16, 20, 32]),
    };
  },

  solve(p) {
    const f = p.fpct! / 100;
    return 1 / (1 - f + f / p.k!);
  },

  stem(p) {
    return (
      `${p.fpct}% of a program's execution time is spent in code that can be sped up by a factor ` +
      `of ${p.k}. The rest is unchanged. By Amdahl's law, what is the overall speedup?`
    );
  },

  distractors(p): Distractor[] {
    const f = p.fpct! / 100;
    return [
      {
        value: p.k!,
        misconception: "applied the enhancement's speedup to the whole program",
      },
      {
        value: 1 / (1 - f),
        misconception: "used the limiting speedup for infinite k, ignoring the stated factor",
      },
      {
        value: 1 - f + f / p.k!,
        misconception: "reported the fractional execution time instead of its reciprocal",
      },
      {
        value: 1 + f * p.k!,
        misconception: "added the weighted speedup instead of using the harmonic form",
      },
      {
        value: f * p.k!,
        misconception: "multiplied the enhanced fraction by the speedup factor",
      },
    ];
  },

  rationale(p, correct) {
    const f = p.fpct! / 100;
    return (
      `Amdahl's law: S = 1 / ((1 - f) + f/k) with f = ${f} and k = ${p.k}. ` +
      `S = 1 / (${round(1 - f, 4)} + ${round(f / p.k!, 4)}) = ${round(correct, 4)}. ` +
      `Note the ceiling: even with k infinite the speedup could not exceed ${round(1 / (1 - f), 4)}. ` +
      `The serial fraction, not the accelerator, sets the limit.`
    );
  },
};

/* ============================================================
 * 02.3 · Average cost per unit of a two-level memory
 * Stallings section 4.3: Cs = (C1.S1 + C2.S2) / (S1 + S2)
 * ========================================================== */

const memCostPerBit: Solver = {
  id: "mem-cost-per-bit",
  version: "1.0.0",
  objectiveHint: "02.3",
  unit: "cents/MiB",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      c1: rng.pick([50, 60, 75, 80, 100, 120]),
      s1: rng.pick([1, 2, 4, 8]),
      c2: rng.pick([1, 2, 3, 4, 5]),
      s2: rng.pick([512, 1024, 2048, 4096]),
    };
  },

  solve(p) {
    return (p.c1! * p.s1! + p.c2! * p.s2!) / (p.s1! + p.s2!);
  },

  stem(p) {
    return (
      `A two-level memory pairs ${p.s1} MiB of cache costing ${p.c1} cents/MiB with ` +
      `${p.s2} MiB of main memory costing ${p.c2} cents/MiB. ` +
      `What is the average cost per MiB of the combined memory?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: (p.c1! + p.c2!) / 2,
        misconception: "took an unweighted mean of the two costs, ignoring the sizes",
      },
      {
        value: p.c1! * p.s1! + p.c2! * p.s2!,
        misconception: "reported total cost rather than cost per MiB",
      },
      {
        value: p.c2!,
        misconception: "assumed the large cheap level sets the price outright",
      },
      {
        value: (p.c1! * p.s1! + p.c2! * p.s2!) / p.s2!,
        misconception: "divided by the main-memory size only, omitting the cache",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Cs = (C1.S1 + C2.S2) / (S1 + S2) = ` +
      `(${p.c1}x${p.s1} + ${p.c2}x${p.s2}) / (${p.s1} + ${p.s2}) = ${round(correct, 4)} cents/MiB. ` +
      `The result sits very close to C2 because S2 >> S1 -- which is the economic argument for a ` +
      `memory hierarchy: near-cache speed at near-main-memory cost.`
    );
  },
};

/* ============================================================
 * 02.3 · Hit ratio required to meet an access-time target
 * Inverts Ts = T1 + (1 - H).T2.
 * ========================================================== */

const requiredHitRatio: Solver = {
  id: "required-hit-ratio",
  version: "1.0.0",
  objectiveHint: "02.3",
  unit: "%",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    const t1 = rng.pick([1, 2, 4, 5]);
    const t2 = rng.pick([50, 60, 80, 100, 120]);
    // The target must sit strictly between T1 and T1 + T2, or no hit ratio satisfies it.
    const target = t1 + rng.pick([2, 3, 4, 5, 6, 8, 10]);
    return { t1, t2, target };
  },

  solve(p) {
    // Ts = T1 + (1 - H).T2  =>  H = 1 - (Ts - T1)/T2
    return (1 - (p.target! - p.t1!) / p.t2!) * 100;
  },

  stem(p) {
    return (
      `A two-level memory has a cache access time of ${p.t1} ns and a main-memory access time of ` +
      `${p.t2} ns, where a miss costs the cache access plus the main-memory access. ` +
      `What hit ratio, as a percentage, gives an average access time of ${p.target} ns?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: ((p.target! - p.t1!) / p.t2!) * 100,
        misconception: "solved for the MISS ratio and reported it as the hit ratio",
      },
      {
        value: (p.t1! / p.target!) * 100,
        misconception: "took the ratio of cache time to target time",
      },
      {
        value: (1 - p.target! / p.t2!) * 100,
        misconception: "omitted the cache access time from the numerator",
      },
      {
        value: (1 - (p.target! - p.t1!) / (p.t1! + p.t2!)) * 100,
        misconception: "used T1 + T2 as the miss penalty instead of T2",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `On a miss the cost is T1 + T2, so Ts = H.T1 + (1 - H).(T1 + T2) = T1 + (1 - H).T2. ` +
      `Rearranging: H = 1 - (Ts - T1)/T2 = 1 - (${p.target} - ${p.t1})/${p.t2} = ${round(correct, 4)}%. ` +
      `Note how close to 100% this has to be -- the steepness of that curve is why cache design ` +
      `obsesses over the last percent of hit ratio.`
    );
  },
};

/* ============================================================
 * 03.9 · Bus bandwidth.  BW = width(bytes) x clock
 * ========================================================== */

const busBandwidth: Solver = {
  id: "bus-bandwidth",
  version: "1.0.0",
  objectiveHint: "03.9",
  unit: "MB/s",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      widthBits: rng.pick([8, 16, 32, 64, 128]),
      mhz: rng.pick([33, 66, 100, 133, 200, 266, 400, 533, 800]),
    };
  },

  solve(p) {
    return (p.widthBits! / 8) * p.mhz!;
  },

  stem(p) {
    return (
      `A synchronous bus is ${p.widthBits} bits wide and clocked at ${p.mhz} MHz, transferring ` +
      `one word per clock. What is its peak bandwidth, in MB/s?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.widthBits! * p.mhz!,
        misconception: "left the width in bits, so the answer is in Mbit/s not MB/s",
      },
      {
        value: p.mhz! / (p.widthBits! / 8),
        misconception: "divided by the width instead of multiplying",
      },
      {
        value: (p.widthBits! / 8) * p.mhz! * 2,
        misconception: "assumed double data rate when the question says one word per clock",
      },
      {
        value: p.widthBits! / 8,
        misconception: "reported the width in bytes and ignored the clock",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Each clock moves ${p.widthBits} bits = ${p.widthBits! / 8} bytes, and there are ${p.mhz} million ` +
      `clocks per second. BW = ${p.widthBits! / 8} x ${p.mhz} = ${round(correct, 4)} MB/s. ` +
      `Watch the units: bits/s and bytes/s differ by a factor of 8 and it is the commonest error here.`
    );
  },
};

/* ============================================================
 * 03.4 · Memory references in a program execution trace
 * Stallings section 3.2: fetch every instruction, plus operand traffic.
 * ========================================================== */

const memoryReferences: Solver = {
  id: "memory-references",
  version: "1.0.0",
  objectiveHint: "03.4",
  unit: "references",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      instructions: rng.pick([6, 8, 10, 12, 15, 20, 24, 30]),
      withOperand: rng.pick([2, 3, 4, 5, 6, 8]),
      stores: rng.pick([1, 2, 3, 4]),
    };
  },

  solve(p) {
    // One fetch per instruction, one read per operand-bearing instruction, one write per store.
    return p.instructions! + p.withOperand! + p.stores!;
  },

  stem(p) {
    return (
      `A program executes ${p.instructions} instructions. Of these, ${p.withOperand} read one memory ` +
      `operand each and ${p.stores} write one result each to memory. Counting instruction fetches as ` +
      `well, how many memory references does the program make in total?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.instructions!,
        misconception: "counted instruction fetches only and ignored operand traffic",
      },
      {
        value: p.withOperand! + p.stores!,
        misconception: "counted data references only and forgot that every instruction must be fetched",
      },
      {
        value: p.instructions! + p.withOperand!,
        misconception: "omitted the memory writes",
      },
      {
        value: p.instructions! * 2,
        misconception: "assumed every instruction makes exactly one data reference",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Every instruction must be fetched: ${p.instructions} references. Operand reads add ` +
      `${p.withOperand} and result writes add ${p.stores}. ` +
      `Total = ${p.instructions} + ${p.withOperand} + ${p.stores} = ${correct}. ` +
      `The instruction fetch is the reference students forget -- it is why the fetch-execute cycle ` +
      `touches memory at least once per instruction even for register-only operations.`
    );
  },
};

/* ============================================================
 * 03.8 · Processor time freed by interrupt-driven I/O
 * ========================================================== */

const interruptSaving: Solver = {
  id: "interrupt-saving",
  version: "1.0.0",
  objectiveHint: "03.8",
  unit: "ms",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      ops: rng.pick([10, 20, 25, 40, 50, 100]),
      waitMs: rng.pick([2, 4, 5, 8, 10]),
      handlerUs: rng.pick([50, 100, 150, 200, 250]),
    };
  },

  solve(p) {
    // Busy waiting burns the full device wait; interrupts burn only the handler.
    return p.ops! * p.waitMs! - p.ops! * (p.handlerUs! / 1000);
  },

  stem(p) {
    return (
      `A program performs ${p.ops} I/O operations, each taking ${p.waitMs} ms at the device. ` +
      `With programmed I/O the processor busy-waits for the whole transfer; with interrupt-driven I/O ` +
      `it instead runs a ${p.handlerUs} microsecond handler per operation and does useful work otherwise. ` +
      `How much processor time, in ms, does interrupt-driven I/O free up?`
    );
  },

  distractors(p): Distractor[] {
    const busy = p.ops! * p.waitMs!;
    return [
      {
        value: busy,
        misconception: "reported the busy-wait time rather than the difference",
      },
      {
        value: p.ops! * (p.handlerUs! / 1000),
        misconception: "reported the interrupt handler cost rather than the time saved",
      },
      {
        value: busy - p.ops! * p.handlerUs!,
        misconception: "subtracted microseconds from milliseconds without converting",
      },
      {
        value: p.waitMs! - p.handlerUs! / 1000,
        misconception: "computed the saving for a single operation only",
      },
    ];
  },

  rationale(p, correct) {
    const busy = p.ops! * p.waitMs!;
    const driven = p.ops! * (p.handlerUs! / 1000);
    return (
      `Busy waiting costs ${p.ops} x ${p.waitMs} = ${busy} ms of processor time. ` +
      `Interrupt-driven costs ${p.ops} x ${p.handlerUs} us = ${round(driven, 4)} ms. ` +
      `Saving = ${busy} - ${round(driven, 4)} = ${round(correct, 4)} ms. ` +
      `The processor is not made faster -- it is stopped from waiting, which is the point of interrupts.`
    );
  },
};

/* ============================================================
 * 03.10 · PCIe throughput, 8b/10b encoded (gen 1 and 2)
 * ========================================================== */

const pcieThroughput: Solver = {
  id: "pcie-throughput",
  version: "1.0.0",
  objectiveHint: "03.10",
  unit: "MB/s",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      lanes: rng.pick([1, 2, 4, 8, 16]),
      gts: rng.pick([2.5, 5]),
    };
  },

  solve(p) {
    // 8b/10b: 8 payload bits per 10 transferred, then bits -> bytes.
    return (p.gts! * 1000 * p.lanes! * 0.8) / 8;
  },

  stem(p) {
    return (
      `A PCI Express link uses ${p.lanes} lane(s) at ${p.gts} GT/s with 8b/10b encoding. ` +
      `What is its usable throughput in one direction, in MB/s?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: (p.gts! * 1000 * p.lanes!) / 8,
        misconception: "ignored the 8b/10b encoding overhead",
      },
      {
        value: p.gts! * 1000 * p.lanes! * 0.8,
        misconception: "left the answer in Mbit/s instead of MB/s",
      },
      {
        value: (p.gts! * 1000 * 0.8) / 8,
        misconception: "computed one lane and ignored the lane count",
      },
      {
        value: (p.gts! * 1000 * p.lanes! * 0.8) / 10,
        misconception: "divided by 10 for the encoding a second time instead of by 8 for bytes",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Each lane carries ${p.gts} GT/s = ${p.gts! * 1000} Mbit/s raw. 8b/10b delivers 8 useful bits ` +
      `per 10, so 80% survives, and ${p.lanes} lane(s) run in parallel: ` +
      `${p.gts! * 1000} x ${p.lanes} x 0.8 = ${round(p.gts! * 1000 * p.lanes! * 0.8, 4)} Mbit/s. ` +
      `Dividing by 8 gives ${round(correct, 4)} MB/s. PCIe is point-to-point and serial, so lanes ` +
      `scale bandwidth linearly.`
    );
  },
};

/* ============================================================
 * 04.5 · Number of cache lines
 * ========================================================== */

const cacheLines: Solver = {
  id: "cache-lines",
  version: "1.0.0",
  objectiveHint: "04.5",
  unit: "lines",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      cacheKiB: rng.pick([8, 16, 32, 64, 128, 256, 512]),
      lineBytes: rng.pick([16, 32, 64, 128]),
    };
  },

  solve(p) {
    return (p.cacheKiB! * 1024) / p.lineBytes!;
  },

  stem(p) {
    return (
      `A cache holds ${p.cacheKiB} KiB of data and uses a line size of ${p.lineBytes} bytes. ` +
      `How many lines does it contain?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.cacheKiB! / p.lineBytes!,
        misconception: "divided KiB by bytes without converting the cache size to bytes",
      },
      {
        value: p.cacheKiB! * 1024 * p.lineBytes!,
        misconception: "multiplied by the line size instead of dividing",
      },
      {
        value: (p.cacheKiB! * 1000) / p.lineBytes!,
        misconception: "used 1000 bytes per KiB instead of 1024",
      },
      {
        value: p.lineBytes!,
        misconception: "answered with the line size rather than the line count",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `${p.cacheKiB} KiB = ${p.cacheKiB! * 1024} bytes. Lines = total bytes / line size = ` +
      `${p.cacheKiB! * 1024} / ${p.lineBytes} = ${correct}. ` +
      `Both figures are powers of two, so the result is a power of two -- if yours is not, ` +
      `a unit conversion went wrong.`
    );
  },
};

/* ============================================================
 * 04.5 · Direct-mapped cache: tag field width
 * Stallings section 4.3: address = tag | line | word
 * ========================================================== */

const cacheDirectTagBits: Solver = {
  id: "cache-direct-tag-bits",
  version: "1.0.0",
  objectiveHint: "04.5",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      addrBits: rng.pick([24, 26, 28, 32]),
      cacheKiB: rng.pick([8, 16, 32, 64, 128]),
      lineBytes: rng.pick([16, 32, 64]),
    };
  },

  solve(p) {
    const lines = (p.cacheKiB! * 1024) / p.lineBytes!;
    return p.addrBits! - log2(lines) - log2(p.lineBytes!);
  },

  stem(p) {
    return (
      `A direct-mapped cache of ${p.cacheKiB} KiB with ${p.lineBytes}-byte lines sits on a machine ` +
      `with ${p.addrBits}-bit addresses. How many bits wide is the tag field?`
    );
  },

  distractors(p): Distractor[] {
    const lines = (p.cacheKiB! * 1024) / p.lineBytes!;
    return [
      {
        value: p.addrBits! - log2(lines),
        misconception: "subtracted the line-number field but forgot the word/offset field",
      },
      {
        value: p.addrBits! - log2(p.lineBytes!),
        misconception: "subtracted the word field but forgot the line-number field",
      },
      {
        value: log2(lines),
        misconception: "answered with the line-number field width rather than the tag",
      },
      {
        value: log2(p.lineBytes!),
        misconception: "answered with the word field width",
      },
    ];
  },

  rationale(p, correct) {
    const lines = (p.cacheKiB! * 1024) / p.lineBytes!;
    return (
      `The address splits into tag | line | word. Lines = ${p.cacheKiB} KiB / ${p.lineBytes} B = ${lines}, ` +
      `needing ${log2(lines)} bits. The word field selects a byte within a line: ${log2(p.lineBytes!)} bits. ` +
      `Tag = ${p.addrBits} - ${log2(lines)} - ${log2(p.lineBytes!)} = ${correct} bits. ` +
      `The three fields must account for every address bit -- that is the check to run on your answer.`
    );
  },
};

/* ============================================================
 * 04.5 · Set-associative cache: set field width
 * ========================================================== */

const cacheSetAssocBits: Solver = {
  id: "cache-set-bits",
  version: "1.0.0",
  objectiveHint: "04.5",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      cacheKiB: rng.pick([16, 32, 64, 128, 256]),
      lineBytes: rng.pick([32, 64]),
      ways: rng.pick([2, 4, 8, 16]),
    };
  },

  solve(p) {
    const lines = (p.cacheKiB! * 1024) / p.lineBytes!;
    return log2(lines / p.ways!);
  },

  stem(p) {
    return (
      `A ${p.ways}-way set-associative cache holds ${p.cacheKiB} KiB with ${p.lineBytes}-byte lines. ` +
      `How many bits are needed for the set field of the address?`
    );
  },

  distractors(p): Distractor[] {
    const lines = (p.cacheKiB! * 1024) / p.lineBytes!;
    return [
      {
        value: log2(lines),
        misconception: "treated the cache as direct-mapped and used the line count as the set count",
      },
      {
        value: log2(lines * p.ways!),
        misconception: "multiplied by associativity instead of dividing",
      },
      {
        value: log2(p.ways!),
        misconception: "answered with the bits needed to select a way within a set",
      },
      {
        value: lines / p.ways!,
        misconception: "gave the number of sets rather than the bits needed to address them",
      },
    ];
  },

  rationale(p, correct) {
    const lines = (p.cacheKiB! * 1024) / p.lineBytes!;
    return (
      `Lines = ${p.cacheKiB} KiB / ${p.lineBytes} B = ${lines}. A ${p.ways}-way cache groups them into ` +
      `sets of ${p.ways}, so sets = ${lines} / ${p.ways} = ${lines / p.ways!}, needing ` +
      `log2(${lines / p.ways!}) = ${correct} bits. Raising associativity shrinks the set field and grows ` +
      `the tag: the address bits move between fields, they are never created or destroyed.`
    );
  },
};

/* ============================================================
 * 04.7 · Direct-mapped line number for a given address
 * ========================================================== */

const cacheLineNumber: Solver = {
  id: "cache-line-number",
  version: "1.0.0",
  objectiveHint: "04.7",
  unit: "",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    const lineBytes = rng.pick([16, 32, 64]);
    const lines = rng.pick([64, 128, 256, 512]);
    return { lineBytes, lines, address: rng.int(1, lines * lineBytes * 8) };
  },

  solve(p) {
    return Math.floor(p.address! / p.lineBytes!) % p.lines!;
  },

  stem(p) {
    return (
      `A direct-mapped cache has ${p.lines} lines of ${p.lineBytes} bytes each. ` +
      `Into which line number does main-memory byte address ${p.address} map?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.address! % p.lines!,
        misconception: "took the address modulo the line count without first dividing by the line size",
      },
      {
        value: Math.floor(p.address! / p.lineBytes!),
        misconception: "computed the memory block number and forgot to wrap it into the cache",
      },
      {
        value: p.address! % p.lineBytes!,
        misconception: "computed the byte offset within the line rather than the line number",
      },
      {
        value: Math.floor(p.address! / p.lines!) % p.lineBytes!,
        misconception: "swapped the roles of line count and line size",
      },
    ];
  },

  rationale(p, correct) {
    const block = Math.floor(p.address! / p.lineBytes!);
    return (
      `First find the memory block: floor(${p.address} / ${p.lineBytes}) = ${block}. ` +
      `Direct mapping wraps blocks onto lines modulo the number of lines: ${block} mod ${p.lines} = ${correct}. ` +
      `Every block whose number is congruent to ${correct} modulo ${p.lines} competes for this one line -- ` +
      `that contention is exactly why direct mapping suffers conflict misses.`
    );
  },
};

export const ACT1_SOLVERS: readonly Solver[] = [
  cpiFromMix,
  mipsRate,
  mflopsRate,
  execTime,
  clockFromMips,
  amdahlSpeedup,
  memCostPerBit,
  requiredHitRatio,
  busBandwidth,
  memoryReferences,
  interruptSaving,
  pcieThroughput,
  cacheLines,
  cacheDirectTagBits,
  cacheSetAssocBits,
  cacheLineNumber,
];
