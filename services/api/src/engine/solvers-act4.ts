/**
 * Act 4 (Finals) parameterized solvers -- stages 13-18.
 *
 * Source: Stallings, chapters on RISC, Instruction-Level Parallelism and
 * Superscalar Processors, Control Unit Operation, Microprogrammed Control,
 * Multicore Computers and Distributed Systems. (This act's syllabus chapters map
 * onto DIFFERENT book chapter numbers in the 10th edition -- `pnpm book:map`
 * owns that mapping and reports 10 of 18 chapters renumbered.)
 *
 * Act 4 has no period exam of its own: it is examined only through the Finals,
 * which draws 24 of its 50 items from here. This bank spans TWELVE objectives so
 * the Finals' joint act/type/bloom constraints have room to resolve.
 */

import { type Distractor, type Solver, log2, round } from "./solver-core.js";

/* ============================================================
 * 13.3 · Physical registers behind a windowed register file
 * ========================================================== */

const registerWindowTotal: Solver = {
  id: "register-window-total",
  version: "1.0.0",
  objectiveHint: "13.3",
  unit: "registers",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      globals: rng.pick([6, 8, 10, 16]),
      windows: rng.pick([4, 6, 8, 16, 32]),
      perWindow: rng.pick([8, 16, 24, 32]),
    };
  },

  solve(p) {
    return p.globals! + p.windows! * p.perWindow!;
  },

  stem(p) {
    return (
      `A RISC processor provides ${p.globals} global registers plus ${p.windows} non-overlapping ` +
      `register windows of ${p.perWindow} registers each. How many physical registers does the ` +
      `register file contain?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.globals! + p.perWindow!,
        misconception: "counted what one procedure SEES rather than what the file physically holds",
      },
      {
        value: p.windows! * p.perWindow!,
        misconception: "omitted the globals, which exist once and are visible from every window",
      },
      {
        value: (p.globals! + p.perWindow!) * p.windows!,
        misconception: "replicated the globals once per window",
      },
      {
        value: p.windows! + p.perWindow!,
        misconception: "added the window count to the window size",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `The globals exist once: ${p.globals}. Each of the ${p.windows} windows adds ${p.perWindow} more, ` +
      `so the file holds ${p.globals} + ${p.windows} x ${p.perWindow} = ${correct} registers. ` +
      `A procedure only ever SEES ${p.globals! + p.perWindow!} of them -- the rest belong to suspended ` +
      `callers. That is the trade: a large, expensive file buys call/return without memory traffic.`
    );
  },
};

/* ============================================================
 * 13.4 · Spills when live variables exceed the register file
 * ========================================================== */

const compilerRegisterSpill: Solver = {
  id: "compiler-register-spill",
  version: "1.0.0",
  objectiveHint: "13.4",
  unit: "variables",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    const registers = rng.pick([8, 12, 16, 24, 32]);
    // Always more live variables than registers, or the item has no work in it.
    return { registers, liveVars: registers + rng.pick([1, 2, 3, 4, 6, 8, 12, 16]) };
  },

  solve(p) {
    return Math.max(0, p.liveVars! - p.registers!);
  },

  stem(p) {
    return (
      `A compiler must keep ${p.liveVars} variables live simultaneously in a region of code, but the ` +
      `machine has only ${p.registers} allocatable registers. At minimum, how many variables must be ` +
      `spilled to memory?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.liveVars!,
        misconception: "spilled every live variable rather than only the excess",
      },
      {
        value: p.registers!,
        misconception: "answered with the register count",
      },
      {
        value: p.liveVars! + p.registers!,
        misconception: "added the two counts instead of subtracting",
      },
      {
        value: Math.max(0, p.liveVars! - p.registers! - 1),
        misconception: "off by one: left one variable unaccounted for",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `${p.liveVars} live values compete for ${p.registers} registers, so at least ` +
      `${p.liveVars} - ${p.registers} = ${correct} must live in memory. ` +
      `Graph-colouring register allocation is exactly this problem, and each spill costs a store and ` +
      `at least one reload -- which is why RISC designs spend transistors on large register files.`
    );
  },
};

/* ============================================================
 * 14.1 · Cycles on a superscalar machine of issue width m
 * ========================================================== */

const superscalarCycles: Solver = {
  id: "superscalar-cycles",
  version: "1.0.0",
  objectiveHint: "14.1",
  unit: "cycles",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      stages: rng.pick([4, 5, 6, 8]),
      instructions: rng.pick([20, 40, 100, 200, 1000]),
      width: rng.pick([2, 3, 4]),
    };
  },

  solve(p) {
    return p.stages! + Math.ceil((p.instructions! - 1) / p.width!);
  },

  stem(p) {
    return (
      `A ${p.stages}-stage superscalar pipeline issues up to ${p.width} instructions per cycle. ` +
      `Ignoring hazards, how many cycles does it need for ${p.instructions} instructions?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.stages! + p.instructions! - 1,
        misconception: "used the scalar pipeline formula, ignoring the issue width entirely",
      },
      {
        value: Math.ceil(p.instructions! / p.width!),
        misconception: "omitted the pipeline fill cost",
      },
      {
        value: Math.ceil((p.stages! + p.instructions! - 1) / p.width!),
        misconception: "divided the whole scalar cycle count by the width, shrinking the fill too",
      },
      {
        value: p.stages! + Math.ceil(p.instructions! / p.width!),
        misconception: "off by one: the first instruction's fill already overlaps the rest",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `The first instruction still takes ${p.stages} cycles to fill the pipeline. The remaining ` +
      `${p.instructions! - 1} then retire ${p.width} per cycle: ceil(${p.instructions! - 1}/${p.width}) = ` +
      `${Math.ceil((p.instructions! - 1) / p.width!)} cycles. Total = ${correct}. ` +
      `Width multiplies the steady-state rate, not the fill -- superscalar widens the pipe, ` +
      `superpipelining shortens the stages.`
    );
  },
};

/* ============================================================
 * 14.1 · Superscalar speedup over the scalar pipeline
 * ========================================================== */

const superscalarSpeedup: Solver = {
  id: "superscalar-speedup",
  version: "1.0.0",
  objectiveHint: "14.1",
  unit: "x",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      stages: rng.pick([4, 5, 6, 8]),
      instructions: rng.pick([20, 40, 100, 200, 1000]),
      width: rng.pick([2, 3, 4]),
    };
  },

  solve(p) {
    const scalar = p.stages! + p.instructions! - 1;
    const wide = p.stages! + Math.ceil((p.instructions! - 1) / p.width!);
    return scalar / wide;
  },

  stem(p) {
    return (
      `Compared with a scalar ${p.stages}-stage pipeline, what speedup does a ${p.width}-way ` +
      `superscalar version of the same pipeline achieve over ${p.instructions} instructions, ` +
      `ignoring hazards?`
    );
  },

  distractors(p): Distractor[] {
    const scalar = p.stages! + p.instructions! - 1;
    return [
      {
        value: p.width!,
        misconception: "assumed the speedup equals the issue width, which the fill cost prevents",
      },
      {
        value: scalar / Math.ceil(p.instructions! / p.width!),
        misconception: "dropped the pipeline fill from the superscalar cycle count",
      },
      {
        value: scalar,
        misconception: "answered with the scalar cycle count rather than a ratio",
      },
      {
        value: p.width! * p.stages!,
        misconception: "multiplied width by depth",
      },
    ];
  },

  rationale(p, correct) {
    const scalar = p.stages! + p.instructions! - 1;
    const wide = p.stages! + Math.ceil((p.instructions! - 1) / p.width!);
    return (
      `Scalar: ${p.stages} + ${p.instructions} - 1 = ${scalar} cycles. ` +
      `${p.width}-way: ${p.stages} + ceil(${p.instructions! - 1}/${p.width}) = ${wide} cycles. ` +
      `Speedup = ${scalar}/${wide} = ${round(correct, 4)}. ` +
      `It stays below ${p.width} because the fill is not parallelised, and real dependencies push it ` +
      `lower still -- that gap is what ILP research is about.`
    );
  },
};

/* ============================================================
 * 14.4 · Issue-slot utilisation
 * ========================================================== */

const issueUtilization: Solver = {
  id: "issue-utilization",
  version: "1.0.0",
  objectiveHint: "14.4",
  unit: "%",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    const width = rng.pick([2, 4, 6, 8]);
    // Achieved IPC must be below the width, or there is nothing to explain.
    return { width, ipcTenths: rng.int(8, width * 10 - 2) };
  },

  solve(p) {
    return (p.ipcTenths! / 10 / p.width!) * 100;
  },

  stem(p) {
    return (
      `A ${p.width}-issue superscalar processor sustains ${p.ipcTenths! / 10} instructions per cycle ` +
      `on a real workload. What percentage of its issue slots is actually used?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.ipcTenths! / 10,
        misconception: "reported the IPC rather than converting it to a percentage of the width",
      },
      {
        value: (p.width! / (p.ipcTenths! / 10)) * 100,
        misconception: "inverted the ratio",
      },
      {
        value: 100 - (p.ipcTenths! / 10 / p.width!) * 100,
        misconception: "reported the wasted fraction rather than the used one",
      },
      {
        value: p.ipcTenths! / 10 / p.width!,
        misconception: "gave the fraction and forgot to scale it to a percentage",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Utilisation = achieved IPC / issue width = ${p.ipcTenths! / 10} / ${p.width} = ` +
      `${round(correct, 4)}%. The shortfall is dependencies, branch mispredictions and cache misses -- ` +
      `not a shortage of functional units. Widening the machine past the point the code can feed it ` +
      `buys nothing, which is why issue widths stopped growing and core counts started.`
    );
  },
};

/* ============================================================
 * 15.2 · Micro-operations in a complete instruction cycle
 * ========================================================== */

const microOpsTotal: Solver = {
  id: "micro-ops-total",
  version: "1.0.0",
  objectiveHint: "15.2",
  unit: "micro-operations",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      fetch: 3,
      indirect: rng.pick([0, 2]),
      execute: rng.pick([2, 3, 4, 5]),
      interrupt: rng.pick([0, 3]),
    };
  },

  solve(p) {
    return p.fetch! + p.indirect! + p.execute! + p.interrupt!;
  },

  stem(p) {
    return (
      `An instruction cycle comprises a fetch phase of ${p.fetch} micro-operations, an indirect phase ` +
      `of ${p.indirect}, an execute phase of ${p.execute} and an interrupt phase of ${p.interrupt}. ` +
      `How many micro-operations does the complete cycle take?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.fetch! + p.execute!,
        misconception: "counted only fetch and execute, omitting the optional phases",
      },
      {
        value: p.execute!,
        misconception: "counted the execute phase alone",
      },
      {
        value: p.fetch! + p.indirect! + p.execute!,
        misconception: "omitted the interrupt phase",
      },
      {
        value: 4,
        misconception: "counted the number of phases rather than the micro-operations in them",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Summing the phases: ${p.fetch} + ${p.indirect} + ${p.execute} + ${p.interrupt} = ${correct}. ` +
      `Fetch and execute always run; the indirect phase appears only for indirect addressing and the ` +
      `interrupt phase only when an interrupt is pending, which is why the same instruction can cost ` +
      `different numbers of micro-operations on different cycles.`
    );
  },
};

/* ============================================================
 * 16.3 · Control memory size
 * ========================================================== */

const controlMemoryBits: Solver = {
  id: "control-memory-bits",
  version: "1.0.0",
  objectiveHint: "16.3",
  unit: "KiB",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      words: rng.pick([256, 512, 1024, 2048, 4096]),
      widthBits: rng.pick([24, 32, 48, 64, 96, 128]),
    };
  },

  solve(p) {
    return (p.words! * p.widthBits!) / 8 / 1024;
  },

  stem(p) {
    return (
      `A microprogrammed control unit has a control memory of ${p.words} microinstructions, each ` +
      `${p.widthBits} bits wide. What is the size of the control memory, in KiB?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: (p.words! * p.widthBits!) / 1024,
        misconception: "reported kilobits, not kibibytes -- never divided by 8",
      },
      {
        value: p.words! * p.widthBits!,
        misconception: "gave the raw bit count with no conversion",
      },
      {
        value: (p.words! * p.widthBits!) / 8 / 1000,
        misconception: "used 1000 bytes per KiB instead of 1024",
      },
      {
        value: p.widthBits! / 8,
        misconception: "sized one microinstruction and ignored how many there are",
      },
    ];
  },

  rationale(p, correct) {
    const bits = p.words! * p.widthBits!;
    return (
      `${p.words} x ${p.widthBits} = ${bits} bits = ${bits / 8} bytes = ${round(correct, 4)} KiB. ` +
      `Horizontal microinstructions are wide and fast; vertical ones encode the control fields and ` +
      `trade decoding time for a much smaller control memory. This number is the cost side of that trade.`
    );
  },
};

/* ============================================================
 * 16.4 · Address field width for the control memory
 * ========================================================== */

const controlAddressBits: Solver = {
  id: "control-address-bits",
  version: "1.0.0",
  objectiveHint: "16.4",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return { words: rng.pick([256, 512, 1024, 2048, 4096, 8192]) };
  },

  solve(p) {
    return log2(p.words!);
  },

  stem(p) {
    return (
      `A control memory holds ${p.words} microinstructions. How many bits does a microinstruction's ` +
      `next-address field need in order to branch anywhere in it?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.words!,
        misconception: "answered with the number of microinstructions rather than a bit width",
      },
      {
        value: log2(p.words!) + 1,
        misconception: "added a spare bit the address space does not need",
      },
      {
        value: p.words! / 8,
        misconception: "converted the word count to bytes",
      },
      {
        value: log2(p.words!) - 1,
        misconception: "off by one: half the control memory would be unreachable",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `An n-bit address reaches 2^n locations, so n = log2(${p.words}) = ${correct} bits. ` +
      `One bit fewer would reach only ${p.words! / 2} of the ${p.words} microinstructions. ` +
      `In an explicit-sequencing design this field sits in every microinstruction, so its width is ` +
      `multiplied across the whole control memory.`
    );
  },
};

/* ============================================================
 * 16.2 · Vertical (encoded) control field width
 * ========================================================== */

const verticalEncodingBits: Solver = {
  id: "vertical-encoding-bits",
  version: "1.0.0",
  objectiveHint: "16.2",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return { signals: rng.pick([7, 12, 15, 20, 31, 40, 63]) };
  },

  solve(p) {
    // +1 for the "no signal asserted this cycle" code.
    return Math.ceil(Math.log2(p.signals! + 1));
  },

  stem(p) {
    return (
      `A vertical microinstruction encodes ${p.signals} mutually exclusive control signals in one ` +
      `field, which must also be able to encode "no signal asserted". How many bits does the field need?`
    );
  },

  distractors(p, correct): Distractor[] {
    return [
      {
        value: p.signals!,
        misconception: "used one bit per signal, which is horizontal encoding not vertical",
      },
      {
        value: Math.ceil(Math.log2(p.signals!)),
        misconception: "forgot the extra code needed for the no-operation case",
      },
      {
        value: correct + 1,
        misconception: "rounded up a second time after already taking the ceiling",
      },
      {
        value: Math.floor(Math.log2(p.signals!)),
        misconception: "rounded down, leaving some signals unencodable",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `The field must encode ${p.signals} signals plus a no-op: ${p.signals! + 1} codes, needing ` +
      `ceil(log2(${p.signals! + 1})) = ${correct} bits. Horizontal encoding would spend ${p.signals} bits ` +
      `on the same signals. Vertical encoding is far denser but requires a decoder, and only works ` +
      `because the signals are mutually exclusive -- signals that must fire together cannot share a field.`
    );
  },
};

/* ============================================================
 * 17.2 · Parallel efficiency
 * ========================================================== */

const multicoreEfficiency: Solver = {
  id: "multicore-efficiency",
  version: "1.0.0",
  objectiveHint: "17.2",
  unit: "%",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    const cores = rng.pick([2, 4, 8, 16, 32]);
    // Speedup in tenths, always below the core count.
    return { cores, speedupTenths: rng.int(12, cores * 10 - 3) };
  },

  solve(p) {
    return (p.speedupTenths! / 10 / p.cores!) * 100;
  },

  stem(p) {
    return (
      `A parallel program achieves a speedup of ${p.speedupTenths! / 10}x on ${p.cores} cores. ` +
      `What is its parallel efficiency, as a percentage?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.speedupTenths! / 10,
        misconception: "reported the speedup rather than the efficiency",
      },
      {
        value: (p.cores! / (p.speedupTenths! / 10)) * 100,
        misconception: "inverted the ratio",
      },
      {
        value: 100 - (p.speedupTenths! / 10 / p.cores!) * 100,
        misconception: "reported the lost fraction rather than the efficiency",
      },
      {
        value: p.cores!,
        misconception: "answered with the core count",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Efficiency = speedup / cores = ${p.speedupTenths! / 10} / ${p.cores} = ${round(correct, 4)}%. ` +
      `Perfect scaling would be 100%, and Amdahl's law makes that impossible for any code with a ` +
      `serial fraction. Efficiency falling as cores are added is the normal, expected shape -- ` +
      `it is why core counts alone do not predict performance.`
    );
  },
};

/* ============================================================
 * 17.3 · Total on-chip cache across a multicore organisation
 * ========================================================== */

const multicoreCacheTotal: Solver = {
  id: "multicore-cache-total",
  version: "1.0.0",
  objectiveHint: "17.3",
  unit: "MiB",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      cores: rng.pick([2, 4, 6, 8, 16]),
      l2KiB: rng.pick([256, 512, 1024]),
      l3MiB: rng.pick([4, 6, 8, 12, 16, 24]),
    };
  },

  solve(p) {
    return (p.cores! * p.l2KiB!) / 1024 + p.l3MiB!;
  },

  stem(p) {
    return (
      `A multicore chip has ${p.cores} cores, each with a private ${p.l2KiB} KiB L2 cache, plus a ` +
      `shared ${p.l3MiB} MiB L3. What is the total on-chip L2 + L3 cache, in MiB?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.l2KiB! / 1024 + p.l3MiB!,
        misconception: "counted one core's L2 rather than every core's",
      },
      {
        value: p.cores! * (p.l2KiB! / 1024 + p.l3MiB!),
        misconception: "replicated the shared L3 once per core",
      },
      {
        value: p.cores! * p.l2KiB! + p.l3MiB!,
        misconception: "added KiB to MiB without converting",
      },
      {
        value: p.l3MiB!,
        misconception: "counted the shared L3 only",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `L2 is private, so it multiplies: ${p.cores} x ${p.l2KiB} KiB = ${p.cores! * p.l2KiB!} KiB = ` +
      `${round((p.cores! * p.l2KiB!) / 1024, 4)} MiB. L3 is SHARED and counted once: ${p.l3MiB} MiB. ` +
      `Total = ${round(correct, 4)} MiB. Which levels are private and which are shared is the ` +
      `defining choice in a multicore organisation, and it is what the cache-coherence protocol has to police.`
    );
  },
};

/* ============================================================
 * 18.1 · Bandwidth-delay product
 * ========================================================== */

const bandwidthDelayProduct: Solver = {
  id: "bandwidth-delay-product",
  version: "1.0.0",
  objectiveHint: "18.1",
  unit: "KiB",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      mbps: rng.pick([10, 45, 100, 155, 622, 1000]),
      rttMs: rng.pick([10, 20, 40, 50, 80, 100]),
    };
  },

  solve(p) {
    // bits in flight = rate x time, then to KiB.
    return (p.mbps! * 1e6 * (p.rttMs! / 1000)) / 8 / 1024;
  },

  stem(p) {
    return (
      `A distributed system communicates over a ${p.mbps} Mbit/s link with a ${p.rttMs} ms round-trip ` +
      `time. What is the bandwidth-delay product, in KiB?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: (p.mbps! * 1e6 * (p.rttMs! / 1000)) / 1024,
        misconception: "left the result in bits, never dividing by 8",
      },
      {
        value: p.mbps! * p.rttMs!,
        misconception: "multiplied the raw figures without reconciling Mbit/s against milliseconds",
      },
      {
        value: (p.mbps! * 1e6) / (p.rttMs! / 1000) / 8 / 1024,
        misconception: "divided by the delay instead of multiplying",
      },
      {
        value: (p.mbps! * 1e6 * (p.rttMs! / 1000)) / 8 / 1e6,
        misconception: "converted to MB rather than KiB",
      },
    ];
  },

  rationale(p, correct) {
    const bits = p.mbps! * 1e6 * (p.rttMs! / 1000);
    return (
      `BDP = rate x round-trip time = ${p.mbps} Mbit/s x ${p.rttMs} ms = ${round(bits, 4)} bits ` +
      `= ${round(correct, 4)} KiB. ` +
      `This is how much data can be in flight and unacknowledged. A protocol whose window is smaller ` +
      `than the BDP cannot fill the link no matter how fast it is -- which is why latency, not just ` +
      `bandwidth, sets distributed-system throughput.`
    );
  },
};

/* ============================================================
 * 18.2 · Message latency: propagation plus transmission
 * ========================================================== */

const messageLatency: Solver = {
  id: "message-latency",
  version: "1.0.0",
  objectiveHint: "18.2",
  unit: "ms",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      bytes: rng.pick([64, 512, 1500, 4096, 8192]),
      mbps: rng.pick([10, 100, 155, 1000]),
      km: rng.pick([10, 100, 500, 1000, 2000, 5000]),
    };
  },

  solve(p) {
    // Signal propagation in fibre is about 2 x 10^8 m/s.
    const propagationMs = ((p.km! * 1000) / 2e8) * 1000;
    const transmissionMs = ((p.bytes! * 8) / (p.mbps! * 1e6)) * 1000;
    return propagationMs + transmissionMs;
  },

  stem(p) {
    return (
      `A ${p.bytes}-byte request travels ${p.km} km over a ${p.mbps} Mbit/s link. Taking signal ` +
      `propagation as 2 x 10^8 m/s, what is the one-way latency in milliseconds, counting both ` +
      `propagation and transmission time?`
    );
  },

  distractors(p): Distractor[] {
    const propagationMs = ((p.km! * 1000) / 2e8) * 1000;
    const transmissionMs = ((p.bytes! * 8) / (p.mbps! * 1e6)) * 1000;
    return [
      {
        value: propagationMs,
        misconception: "counted propagation only and ignored the time to clock the bits out",
      },
      {
        value: transmissionMs,
        misconception: "counted transmission only and ignored the distance",
      },
      {
        value: ((p.bytes! / (p.mbps! * 1e6)) * 1000) + propagationMs,
        misconception: "left the message in bytes while the rate was in bits per second",
      },
      {
        value: 2 * (propagationMs + transmissionMs),
        misconception: "gave the round trip when the question asked for one way",
      },
    ];
  },

  rationale(p, correct) {
    const propagationMs = ((p.km! * 1000) / 2e8) * 1000;
    const transmissionMs = ((p.bytes! * 8) / (p.mbps! * 1e6)) * 1000;
    return (
      `Propagation = ${p.km} km / 2x10^8 m/s = ${round(propagationMs, 4)} ms. ` +
      `Transmission = ${p.bytes} x 8 bits / ${p.mbps} Mbit/s = ${round(transmissionMs, 4)} ms. ` +
      `Total = ${round(correct, 4)} ms. ` +
      `Propagation depends on distance and NOTHING else -- no amount of bandwidth reduces it, which ` +
      `is the hard limit every distributed architecture is designed around.`
    );
  },
};

export const ACT4_SOLVERS: readonly Solver[] = [
  registerWindowTotal,
  compilerRegisterSpill,
  superscalarCycles,
  superscalarSpeedup,
  issueUtilization,
  microOpsTotal,
  controlMemoryBits,
  controlAddressBits,
  verticalEncodingBits,
  multicoreEfficiency,
  multicoreCacheTotal,
  bandwidthDelayProduct,
  messageLatency,
];
