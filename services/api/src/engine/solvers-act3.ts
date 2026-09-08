/**
 * Act 3 (Semi-final) parameterized solvers -- stages 09-12.
 *
 * Source: Stallings, chapters 9-12 (Computer Arithmetic; Instruction Sets:
 * Characteristics and Functions; Instruction Sets: Addressing Modes and Formats;
 * Processor Structure and Function). The IEEE 754 bias is section 10.4, the
 * instruction-format field arithmetic is section 12.4, and the pipeline speedup
 * relation is section 14.4's k-stage model.
 *
 * The Semi-final needs 13 P items from act 3 at no more than 3 per objective, so
 * this bank spans EIGHT objectives: 09.2, 09.3, 09.5, 09.6, 11.1, 11.3, 12.3 and
 * 12.4. The existing `twos-complement` solver adds a ninth entry on 09.2.
 */

import { type Distractor, type Solver, log2, round } from "./solver-core.js";

/** Bits needed to encode n distinct values. */
const bitsFor = (n: number): number => Math.ceil(Math.log2(n));

/* ============================================================
 * 09.2 · Largest positive value in n-bit two's complement
 * ========================================================== */

const twosComplementMax: Solver = {
  id: "twos-complement-max",
  version: "1.0.0",
  objectiveHint: "09.2",
  unit: "",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return { width: rng.pick([4, 8, 12, 16, 24, 32]) };
  },

  solve(p) {
    return 2 ** (p.width! - 1) - 1;
  },

  stem(p) {
    return (
      `What is the largest positive integer representable in ${p.width}-bit two's complement?`
    );
  },

  distractors(p): Distractor[] {
    const w = p.width!;
    return [
      {
        value: 2 ** (w - 1),
        misconception: "forgot that zero consumes one of the positive codes",
      },
      {
        value: 2 ** w - 1,
        misconception: "gave the unsigned maximum, ignoring the sign bit",
      },
      {
        value: 2 ** (w - 1) * -1,
        misconception: "gave the most negative value instead of the most positive",
      },
      {
        value: 2 ** w,
        misconception: "gave the number of representable values rather than the largest one",
      },
    ];
  },

  rationale(p, correct) {
    const w = p.width!;
    return (
      `One bit carries the sign, leaving ${w - 1} magnitude bits, so the positives run 0 to ` +
      `2^${w - 1} - 1 = ${correct}. The range is asymmetric: the most negative value is ` +
      `-${2 ** (w - 1)}, because zero takes one of the codes that would otherwise be positive. ` +
      `That asymmetry is why negating the most negative number overflows.`
    );
  },
};

/* ============================================================
 * 09.3 · Two's complement addition, wrapped to the word
 * ========================================================== */

const twosComplementSum: Solver = {
  id: "twos-complement-sum",
  version: "1.0.0",
  objectiveHint: "09.3",
  unit: "",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    const width = rng.pick([8, 16]);
    const limit = 2 ** (width - 1) - 1;
    return { width, a: rng.int(1, limit), b: -rng.int(1, limit) };
  },

  solve(p) {
    // a + b is in range by construction; render it as an unsigned bit pattern.
    const sum = p.a! + p.b!;
    return sum < 0 ? 2 ** p.width! + sum : sum;
  },

  stem(p) {
    return (
      `Compute ${p.a} + (${p.b}) in ${p.width}-bit two's complement. ` +
      `Give the resulting bit pattern as an unsigned decimal integer.`
    );
  },

  distractors(p): Distractor[] {
    const w = p.width!;
    const sum = p.a! + p.b!;
    return [
      {
        value: Math.abs(sum),
        misconception: "gave the magnitude and dropped the two's complement encoding of the sign",
      },
      {
        value: p.a! + Math.abs(p.b!),
        misconception: "added the magnitudes instead of subtracting",
      },
      {
        value: 2 ** w - Math.abs(sum) - 1,
        misconception: "took the one's complement, stopping before the final +1",
      },
      {
        value: sum < 0 ? 2 ** (w - 1) + sum : sum + 2 ** (w - 1),
        misconception: "used a bias of 2^(n-1) as if the format were excess-notation",
      },
    ];
  },

  rationale(p, correct) {
    const sum = p.a! + p.b!;
    return (
      `${p.a} + (${p.b}) = ${sum}. ` +
      (sum < 0
        ? `Negative results are stored as 2^${p.width} + value = ${2 ** p.width!} - ${Math.abs(sum)} = ${correct}. `
        : `The result is non-negative, so the bit pattern is just ${correct}. `) +
      `Two's complement needs no special subtraction hardware -- the same adder handles both signs, ` +
      `which is the whole reason the representation won.`
    );
  },
};

/* ============================================================
 * 09.3 · Sign extension to a wider word
 * ========================================================== */

const signExtend: Solver = {
  id: "sign-extend",
  version: "1.0.0",
  objectiveHint: "09.3",
  unit: "",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    const from = rng.pick([8, 16]);
    const to = from === 8 ? rng.pick([16, 32]) : 32;
    return { from, to, value: -rng.int(1, 2 ** (from - 1) - 1) };
  },

  solve(p) {
    return 2 ** p.to! + p.value!;
  },

  stem(p) {
    return (
      `The ${p.from}-bit two's complement value ${p.value} is sign-extended to ${p.to} bits. ` +
      `What is the resulting bit pattern, as an unsigned decimal integer?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: 2 ** p.from! + p.value!,
        misconception: "zero-extended the original pattern instead of sign-extending it",
      },
      {
        value: Math.abs(p.value!),
        misconception: "gave the magnitude rather than the encoded pattern",
      },
      {
        value: 2 ** p.to! - Math.abs(p.value!) - 1,
        misconception: "stopped at the one's complement",
      },
      {
        value: 2 ** (p.to! - 1) + p.value!,
        misconception: "extended to one bit fewer than the target width",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Sign extension copies the sign bit into every new high-order position, which leaves the ` +
      `VALUE unchanged: ${p.value} in ${p.to} bits is 2^${p.to} + (${p.value}) = ${correct}. ` +
      `Zero-extending instead would give ${2 ** p.from! + p.value!}, a large positive number -- ` +
      `which is exactly the bug that appears when a signed byte is widened with the wrong instruction.`
    );
  },
};

/* ============================================================
 * 09.5 · IEEE 754 stored exponent.  stored = actual + bias
 * ========================================================== */

const ieee754StoredExponent: Solver = {
  id: "ieee754-stored-exponent",
  version: "1.0.0",
  objectiveHint: "09.5",
  unit: "",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    const single = rng.pick([0, 1]);
    const expBits = single === 1 ? 8 : 11;
    const bias = 2 ** (expBits - 1) - 1;
    return { expBits, bias, actual: rng.int(-20, 20) };
  },

  solve(p) {
    return p.actual! + p.bias!;
  },

  stem(p) {
    return (
      `An IEEE 754 format uses an ${p.expBits}-bit exponent field with a bias of ${p.bias}. ` +
      `A number has an actual exponent of ${p.actual}. What value is stored in the exponent field?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.actual! - p.bias!,
        misconception: "subtracted the bias instead of adding it -- that decodes, it does not encode",
      },
      {
        value: p.actual!,
        misconception: "stored the actual exponent with no bias at all",
      },
      {
        value: p.bias!,
        misconception: "answered with the bias itself",
      },
      {
        value: p.actual! + p.bias! + 1,
        misconception: "used 2^(k-1) as the bias instead of 2^(k-1) - 1",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Biased (excess) notation stores actual + bias = ${p.actual} + ${p.bias} = ${correct}. ` +
      `The bias makes every stored exponent non-negative, so exponents can be compared with the same ` +
      `integer hardware that compares magnitudes -- which is why floating-point values sort correctly ` +
      `as if they were integers. The bias is 2^(k-1) - 1, not 2^(k-1).`
    );
  },
};

/* ============================================================
 * 09.6 · Decimal precision implied by a significand width
 * ========================================================== */

const floatPrecisionDigits: Solver = {
  id: "float-precision-digits",
  version: "1.0.0",
  objectiveHint: "09.6",
  unit: "digits",
  tolerance: 0.01,
  sigFigs: 4,

  draw(rng) {
    return { sigBits: rng.pick([11, 24, 53, 64, 113]) };
  },

  solve(p) {
    return p.sigBits! * Math.log10(2);
  },

  stem(p) {
    return (
      `A floating-point format carries ${p.sigBits} bits of significand, including the implied ` +
      `leading bit. Approximately how many decimal digits of precision does that give?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.sigBits! / 4,
        misconception: "used 4 bits per decimal digit, which is BCD packing not binary precision",
      },
      {
        value: p.sigBits! * Math.log10(10),
        misconception: "multiplied by log10(10) = 1, leaving the bit count unchanged",
      },
      {
        value: p.sigBits! / Math.log10(2),
        misconception: "divided by log10(2) instead of multiplying",
      },
      {
        value: p.sigBits! / 8,
        misconception: "converted bits to bytes rather than to decimal digits",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Each bit contributes log10(2) = 0.301 decimal digits, so ${p.sigBits} bits give ` +
      `${p.sigBits} x 0.301 = ${round(correct, 4)} digits. ` +
      `This is why single precision (24 bits) is quoted as "about 7 digits" and double (53 bits) ` +
      `as "about 16" -- and why accumulating millions of single-precision sums loses visible accuracy.`
    );
  },
};

/* ============================================================
 * 11.3 · Opcode field width for a given instruction count
 * ========================================================== */

const opcodeBits: Solver = {
  id: "opcode-bits",
  version: "1.0.0",
  objectiveHint: "11.3",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return { opcodes: rng.pick([12, 20, 33, 40, 60, 100, 150, 200]) };
  },

  solve(p) {
    return bitsFor(p.opcodes!);
  },

  stem(p) {
    return (
      `An instruction set defines ${p.opcodes} distinct operations. ` +
      `What is the minimum opcode field width, in bits?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: Math.floor(Math.log2(p.opcodes!)),
        misconception: "rounded log2 down instead of up, leaving some opcodes unencodable",
      },
      {
        value: bitsFor(p.opcodes!) + 1,
        misconception: "added a spare bit that the stated count does not require",
      },
      {
        value: p.opcodes!,
        misconception: "used one bit per operation, which is one-hot encoding not a binary field",
      },
      {
        value: Math.ceil(p.opcodes! / 8),
        misconception: "converted the operation count to bytes",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `An n-bit field encodes 2^n operations, so n = ceil(log2(${p.opcodes})) = ${correct}, ` +
      `giving ${2 ** correct} codes -- enough for ${p.opcodes} with ${2 ** correct - p.opcodes!} spare. ` +
      `${correct - 1} bits would give only ${2 ** (correct - 1)}. Always round UP: a fractional bit ` +
      `does not exist, and the spare codes are what later extensions use.`
    );
  },
};

/* ============================================================
 * 11.3 · Address field left over in a fixed-width instruction
 * ========================================================== */

const instructionAddressBits: Solver = {
  id: "instruction-address-bits",
  version: "1.0.0",
  objectiveHint: "11.3",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    /*
     * The fields must LEAVE something behind. Drawing all four independently did
     * not guarantee that: 16-bit instructions with a 4-bit opcode and three
     * 4-bit register fields consume the whole word and leave an address field of
     * ZERO bits -- a question with no answer, on a graded paper. Caught by the
     * property test in `solvers-act34.spec.ts`.
     *
     * Each choice is therefore constrained by the ones already made, keeping at
     * least 4 bits for the address field. The stream is still consumed in a
     * fixed order, so determinism holds.
     */
    const instrBits = rng.pick([16, 24, 32]);
    const regs = rng.pick([8, 16, 32]);
    const regBits = log2(regs);
    const smallestOpcode = 4;
    const regFields = rng.pick(
      [1, 2, 3].filter((n) => instrBits - smallestOpcode - n * regBits >= 4),
    );
    const opcodeBits = rng.pick(
      [4, 5, 6, 8].filter((o) => instrBits - o - regFields * regBits >= 4),
    );
    return { instrBits, opcodeBits, regFields, regs };
  },

  solve(p) {
    return p.instrBits! - p.opcodeBits! - p.regFields! * log2(p.regs!);
  },

  stem(p) {
    return (
      `A machine uses ${p.instrBits}-bit fixed-width instructions with a ${p.opcodeBits}-bit opcode ` +
      `and ${p.regFields} register field(s), each selecting one of ${p.regs} registers. ` +
      `How many bits remain for the address or immediate field?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.instrBits! - p.opcodeBits!,
        misconception: "subtracted the opcode but forgot the register fields",
      },
      {
        value: p.instrBits! - p.opcodeBits! - log2(p.regs!),
        misconception: "counted only one register field when the format has several",
      },
      {
        value: p.instrBits! - p.opcodeBits! - p.regFields! * p.regs!,
        misconception: "used the register COUNT as a bit width instead of its log2",
      },
      {
        value: p.regFields! * log2(p.regs!),
        misconception: "answered with the register fields' total width",
      },
    ];
  },

  rationale(p, correct) {
    const regBits = p.regFields! * log2(p.regs!);
    return (
      `Each register field needs log2(${p.regs}) = ${log2(p.regs!)} bits, and there are ` +
      `${p.regFields}, so ${regBits} bits go to registers. ` +
      `Remaining = ${p.instrBits} - ${p.opcodeBits} - ${regBits} = ${correct} bits. ` +
      `Every bit spent on opcodes or registers is a bit unavailable for reach -- that trade is the ` +
      `whole of instruction format design.`
    );
  },
};

/* ============================================================
 * 11.1 · Effective address, base + index x scale + displacement
 * ========================================================== */

const effectiveAddressIndexed: Solver = {
  id: "effective-address-indexed",
  version: "1.0.0",
  objectiveHint: "11.1",
  unit: "",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      base: rng.pick([1000, 2000, 4096, 8192, 16_384]),
      index: rng.int(1, 40),
      scale: rng.pick([1, 2, 4, 8]),
      disp: rng.pick([0, 4, 8, 12, 16, 32, 64]),
    };
  },

  solve(p) {
    return p.base! + p.index! * p.scale! + p.disp!;
  },

  stem(p) {
    return (
      `An x86 scaled-index instruction computes its effective address as base + (index x scale) + ` +
      `displacement. With base = ${p.base}, index = ${p.index}, scale = ${p.scale} and ` +
      `displacement = ${p.disp}, what is the effective address?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.base! + p.index! + p.disp!,
        misconception: "ignored the scale factor",
      },
      {
        value: (p.base! + p.index!) * p.scale! + p.disp!,
        misconception: "applied the scale to the base as well as the index",
      },
      {
        value: p.base! + p.index! * p.scale!,
        misconception: "omitted the displacement",
      },
      {
        value: p.index! * p.scale! + p.disp!,
        misconception: "omitted the base register",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `EA = base + index x scale + displacement = ${p.base} + ${p.index} x ${p.scale} + ${p.disp} ` +
      `= ${p.base} + ${p.index! * p.scale!} + ${p.disp} = ${correct}. ` +
      `The scale exists so an array index can stay a plain element count: with ${p.scale}-byte ` +
      `elements the hardware does the multiply, not the compiler.`
    );
  },
};

/* ============================================================
 * 11.1 · PC-relative effective address
 * ========================================================== */

const effectiveAddressRelative: Solver = {
  id: "effective-address-relative",
  version: "1.0.0",
  objectiveHint: "11.1",
  unit: "",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      pc: rng.pick([1000, 2048, 4096, 10_000, 20_480]),
      instrBytes: rng.pick([2, 4]),
      disp: rng.pick([-64, -32, -16, 8, 16, 32, 64, 128]),
    };
  },

  solve(p) {
    // The PC has already advanced past the instruction when the branch resolves.
    return p.pc! + p.instrBytes! + p.disp!;
  },

  stem(p) {
    return (
      `A ${p.instrBytes}-byte PC-relative branch sits at address ${p.pc} and carries a displacement ` +
      `of ${p.disp}. The program counter has already advanced past the instruction when the branch ` +
      `is taken. What is the target address?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.pc! + p.disp!,
        misconception: "used the branch's own address, forgetting the PC has already been incremented",
      },
      {
        value: p.pc! - p.disp!,
        misconception: "subtracted the displacement instead of adding it",
      },
      {
        value: p.disp!,
        misconception: "treated the displacement as an absolute address",
      },
      {
        value: p.pc! + p.instrBytes!,
        misconception: "gave the next sequential instruction, ignoring the displacement",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `The PC points at ${p.pc} + ${p.instrBytes} = ${p.pc! + p.instrBytes!} by the time the branch ` +
      `executes, so the target is ${p.pc! + p.instrBytes!} + (${p.disp}) = ${correct}. ` +
      `The already-incremented PC is the detail that trips people up, and it is why the same ` +
      `displacement means different things on machines with different instruction lengths. ` +
      `PC-relative addressing is what makes code position-independent.`
    );
  },
};

/* ============================================================
 * 12.3 · Cycles to drain a k-stage pipeline.  k + (n - 1)
 * ========================================================== */

const pipelineCycles: Solver = {
  id: "pipeline-cycles",
  version: "1.0.0",
  objectiveHint: "12.3",
  unit: "cycles",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      stages: rng.pick([4, 5, 6, 8, 12]),
      instructions: rng.pick([10, 20, 50, 100, 500, 1000]),
    };
  },

  solve(p) {
    return p.stages! + p.instructions! - 1;
  },

  stem(p) {
    return (
      `A ${p.stages}-stage pipeline with no hazards executes ${p.instructions} instructions. ` +
      `How many clock cycles does it take?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.stages! * p.instructions!,
        misconception: "charged every instruction the full pipeline depth, which is the unpipelined cost",
      },
      {
        value: p.instructions!,
        misconception: "assumed a perfectly pipelined machine with no fill cost at all",
      },
      {
        value: p.stages! + p.instructions!,
        misconception: "off by one: the first instruction's fill overlaps the remaining n - 1",
      },
      {
        value: p.instructions! - 1,
        misconception: "counted only the steady state and omitted the fill entirely",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `The first instruction takes ${p.stages} cycles to traverse the pipeline; each of the remaining ` +
      `${p.instructions! - 1} then completes one per cycle. ` +
      `Total = ${p.stages} + ${p.instructions} - 1 = ${correct}. ` +
      `Unpipelined the same work would cost ${p.stages! * p.instructions!} cycles -- the fill is paid once, ` +
      `not per instruction.`
    );
  },
};

/* ============================================================
 * 12.3 · Pipeline speedup.  nk / (k + n - 1)
 * ========================================================== */

const pipelineSpeedup: Solver = {
  id: "pipeline-speedup",
  version: "1.0.0",
  objectiveHint: "12.3",
  unit: "x",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      stages: rng.pick([4, 5, 6, 8, 12]),
      instructions: rng.pick([10, 20, 50, 100, 500, 1000]),
    };
  },

  solve(p) {
    return (p.instructions! * p.stages!) / (p.stages! + p.instructions! - 1);
  },

  stem(p) {
    return (
      `Compared with an unpipelined machine, what speedup does a ${p.stages}-stage pipeline achieve ` +
      `over ${p.instructions} instructions, assuming no hazards?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.stages!,
        misconception: "assumed the speedup equals the pipeline depth, which is only the limit as n grows",
      },
      {
        value: (p.instructions! * p.stages!) / (p.stages! + p.instructions!),
        misconception: "dropped the -1 from the pipelined cycle count",
      },
      {
        value: p.instructions! / p.stages!,
        misconception: "inverted the ratio",
      },
      {
        value: p.stages! + p.instructions! - 1,
        misconception: "answered with the pipelined cycle count rather than a speedup",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Unpipelined: ${p.instructions} x ${p.stages} = ${p.instructions! * p.stages!} cycles. ` +
      `Pipelined: ${p.stages} + ${p.instructions} - 1 = ${p.stages! + p.instructions! - 1} cycles. ` +
      `Speedup = ${round(correct, 4)}. It approaches but never reaches ${p.stages} -- the fill cost ` +
      `never fully disappears, and real hazards push it further below the depth.`
    );
  },
};

/* ============================================================
 * 12.4 · Effective CPI with branch penalties
 * ========================================================== */

const branchPenaltyCpi: Solver = {
  id: "branch-penalty-cpi",
  version: "1.0.0",
  objectiveHint: "12.4",
  unit: "",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      branchPct: rng.pick([10, 15, 18, 20, 25, 30]),
      takenPct: rng.pick([50, 60, 70, 75, 80]),
      penalty: rng.pick([1, 2, 3, 4]),
    };
  },

  solve(p) {
    // Only taken branches flush the pipeline.
    return 1 + (p.branchPct! / 100) * (p.takenPct! / 100) * p.penalty!;
  },

  stem(p) {
    return (
      `On a pipelined machine with a base CPI of 1, ${p.branchPct}% of instructions are branches and ` +
      `${p.takenPct}% of those are taken. Each taken branch costs a ${p.penalty}-cycle penalty. ` +
      `What is the effective CPI?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: 1 + (p.branchPct! / 100) * p.penalty!,
        misconception: "penalised every branch rather than only the taken ones",
      },
      {
        value: (p.branchPct! / 100) * (p.takenPct! / 100) * p.penalty!,
        misconception: "reported the stall contribution and forgot to add the base CPI of 1",
      },
      {
        value: 1 + p.penalty!,
        misconception: "applied the full penalty to every instruction",
      },
      {
        value: 1 + (p.takenPct! / 100) * p.penalty!,
        misconception: "used the taken fraction as if all instructions were branches",
      },
    ];
  },

  rationale(p, correct) {
    const stall = (p.branchPct! / 100) * (p.takenPct! / 100) * p.penalty!;
    return (
      `Taken branches are ${p.branchPct}% x ${p.takenPct}% = ${round((p.branchPct! * p.takenPct!) / 100, 4)}% ` +
      `of instructions, each costing ${p.penalty} cycles: ${round(stall, 4)} extra cycles per instruction. ` +
      `Effective CPI = 1 + ${round(stall, 4)} = ${round(correct, 4)}. ` +
      `Branch prediction attacks the ${p.takenPct}% term, not the penalty -- which is why deep pipelines ` +
      `need good predictors rather than shorter flushes.`
    );
  },
};

/* ============================================================
 * 12.4 · Effective CPI with data-hazard stalls
 * ========================================================== */

const hazardStallCpi: Solver = {
  id: "hazard-stall-cpi",
  version: "1.0.0",
  objectiveHint: "12.4",
  unit: "",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      loadPct: rng.pick([20, 25, 30, 35, 40]),
      dependentPct: rng.pick([20, 25, 30, 40, 50]),
      stall: rng.pick([1, 2]),
    };
  },

  solve(p) {
    return 1 + (p.loadPct! / 100) * (p.dependentPct! / 100) * p.stall!;
  },

  stem(p) {
    return (
      `In a pipeline with a base CPI of 1, ${p.loadPct}% of instructions are loads, and ` +
      `${p.dependentPct}% of those are immediately followed by an instruction that uses the loaded ` +
      `value, costing a ${p.stall}-cycle stall. What is the effective CPI?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: 1 + (p.loadPct! / 100) * p.stall!,
        misconception: "stalled on every load rather than only the dependent ones",
      },
      {
        value: (p.loadPct! / 100) * (p.dependentPct! / 100) * p.stall!,
        misconception: "omitted the base CPI of 1",
      },
      {
        value: 1 + (p.dependentPct! / 100) * p.stall!,
        misconception: "treated the dependency rate as a share of all instructions",
      },
      {
        value: 1 + p.stall!,
        misconception: "applied the stall to every instruction",
      },
    ];
  },

  rationale(p, correct) {
    const stall = (p.loadPct! / 100) * (p.dependentPct! / 100) * p.stall!;
    return (
      `The stalling instructions are ${p.loadPct}% x ${p.dependentPct}% = ` +
      `${round((p.loadPct! * p.dependentPct!) / 100, 4)}% of the stream, each costing ${p.stall} cycle(s): ` +
      `${round(stall, 4)} per instruction. Effective CPI = ${round(correct, 4)}. ` +
      `Forwarding removes most data hazards but not the load-use case -- the value simply is not ` +
      `available yet, so this stall is the one the compiler must schedule around.`
    );
  },
};

export const ACT3_SOLVERS: readonly Solver[] = [
  twosComplementMax,
  twosComplementSum,
  signExtend,
  ieee754StoredExponent,
  floatPrecisionDigits,
  opcodeBits,
  instructionAddressBits,
  effectiveAddressIndexed,
  effectiveAddressRelative,
  pipelineCycles,
  pipelineSpeedup,
  branchPenaltyCpi,
  hazardStallCpi,
];
