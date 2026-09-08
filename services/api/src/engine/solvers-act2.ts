/**
 * Act 2 (Midterm) parameterized solvers -- stages 05-08.
 *
 * Source: Stallings, chapters 5-8 (Internal Memory; External Memory; Input/
 * Output; Operating System Support). The Hamming check-bit inequality is section
 * 5.2, the disk timing model (seek + rotational delay + transfer) is section
 * 6.1, the RAID capacity arithmetic is section 6.2, and the paging address split
 * is section 8.3.
 *
 * The Midterm needs 13 P items from act 2 at no more than 3 per objective, so
 * this bank spans NINE objectives: 05.1, 05.5, 05.6, 06.3, 06.5, 06.7, 07.2,
 * 07.3, 08.3 and 08.5.
 */

import { type Distractor, type Solver, log2, round } from "./solver-core.js";

/* ============================================================
 * 05.5 · Hamming check bits.  smallest k with 2^k >= m + k + 1
 * Stallings section 5.2, Table 5.2.
 * ========================================================== */

const hammingCheckBits: Solver = {
  id: "hamming-check-bits",
  version: "1.0.0",
  objectiveHint: "05.5",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return { dataBits: rng.pick([8, 16, 32, 64, 128, 256]) };
  },

  solve(p) {
    const m = p.dataBits!;
    let k = 1;
    while (2 ** k < m + k + 1) k++;
    return k;
  },

  stem(p) {
    return (
      `A single-error-correcting Hamming code protects a ${p.dataBits}-bit data word. ` +
      `What is the minimum number of check bits required?`
    );
  },

  distractors(p, correct): Distractor[] {
    return [
      {
        value: log2(p.dataBits!),
        misconception: "used log2 of the data width, ignoring that the check bits count themselves",
      },
      {
        value: correct - 1,
        misconception: "solved 2^k >= m and dropped the k + 1 term from the inequality",
      },
      {
        value: correct + 1,
        misconception: "added a parity bit for SEC-DED when the question asked only for correction",
      },
      {
        value: p.dataBits! / 8,
        misconception: "assumed one check bit per byte of data",
      },
    ];
  },

  rationale(p, correct) {
    const m = p.dataBits!;
    return (
      `The check bits must identify which of the m + k bit positions failed, plus the ` +
      `no-error case: 2^k >= m + k + 1. With m = ${m}, k = ${correct} gives ` +
      `2^${correct} = ${2 ** correct} >= ${m + correct + 1}, while k = ${correct - 1} gives ` +
      `${2 ** (correct - 1)} < ${m + correct}. The k on the right-hand side is the subtlety: ` +
      `the check bits are themselves stored, so they must be covered too.`
    );
  },
};

/* ============================================================
 * 05.1 · Address lines for a memory of N words
 * ========================================================== */

const memoryAddressLines: Solver = {
  id: "memory-address-lines",
  version: "1.0.0",
  objectiveHint: "05.1",
  unit: "lines",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      kwords: rng.pick([1, 4, 16, 64, 256, 1024, 4096, 16_384]),
      wordBits: rng.pick([8, 16, 32]),
    };
  },

  solve(p) {
    return log2(p.kwords! * 1024);
  },

  stem(p) {
    return (
      `A memory holds ${p.kwords}K words of ${p.wordBits} bits each, where 1K = 1024. ` +
      `How many address lines does it need?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: log2(p.kwords! * 1024) + log2(p.wordBits!),
        misconception: "added the bits needed to index within a word, which addressing does not do here",
      },
      {
        value: log2(p.kwords!),
        misconception: "took log2 of the K figure without expanding it by 1024",
      },
      {
        value: p.kwords! * 1024,
        misconception: "answered with the number of words rather than the address lines",
      },
      {
        value: p.wordBits!,
        misconception: "answered with the word width, which sets the DATA lines not the address lines",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `${p.kwords}K words = ${p.kwords! * 1024} words, and n address lines select 2^n locations. ` +
      `log2(${p.kwords! * 1024}) = ${correct} lines. ` +
      `The ${p.wordBits}-bit word width sets the number of DATA lines and does not affect the ` +
      `address lines at all -- separating those two is the point of the question.`
    );
  },
};

/* ============================================================
 * 05.6 · Chips needed to build a memory module
 * ========================================================== */

const dramChipCount: Solver = {
  id: "dram-chip-count",
  version: "1.0.0",
  objectiveHint: "05.6",
  unit: "chips",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      moduleMiB: rng.pick([64, 128, 256, 512, 1024]),
      chipDepthM: rng.pick([16, 32, 64, 128]),
      chipWidth: rng.pick([4, 8, 16]),
    };
  },

  solve(p) {
    // Module bits / chip bits, with the 2^20 in each cancelling.
    return (p.moduleMiB! * 8) / (p.chipDepthM! * p.chipWidth!);
  },

  stem(p) {
    return (
      `A ${p.moduleMiB} MiB memory module is built from DRAM chips organised as ` +
      `${p.chipDepthM}M x ${p.chipWidth} bits. How many chips does the module need?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.moduleMiB! / p.chipDepthM!,
        misconception: "compared MiB against the chip's depth and ignored its bit width",
      },
      {
        value: (p.moduleMiB! * 8) / p.chipDepthM!,
        misconception: "converted the module to bits but forgot the chip's width",
      },
      {
        value: p.moduleMiB! / (p.chipDepthM! * p.chipWidth!),
        misconception: "left the module in bytes while the chip capacity was in bits",
      },
      {
        value: p.chipWidth!,
        misconception: "answered with the chip width rather than a chip count",
      },
    ];
  },

  rationale(p, correct) {
    const chipMiB = (p.chipDepthM! * p.chipWidth!) / 8;
    return (
      `Each chip stores ${p.chipDepthM}M x ${p.chipWidth} bits = ${p.chipDepthM! * p.chipWidth!} Mibit ` +
      `= ${chipMiB} MiB. Chips = ${p.moduleMiB} / ${chipMiB} = ${correct}. ` +
      `Equivalently, work in bits throughout: the 2^20 cancels top and bottom. ` +
      `The x${p.chipWidth} organisation is what students drop -- a x4 chip holds half as much as a x8 of the same depth.`
    );
  },
};

/* ============================================================
 * 05.6 · DRAM refresh overhead
 * ========================================================== */

const dramRefreshOverhead: Solver = {
  id: "dram-refresh-overhead",
  version: "1.0.0",
  objectiveHint: "05.6",
  unit: "%",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      rows: rng.pick([2048, 4096, 8192, 16_384]),
      periodMs: rng.pick([32, 64]),
      refreshNs: rng.pick([50, 60, 75, 100, 120]),
    };
  },

  solve(p) {
    // Total refresh time per period, as a percentage of that period.
    const busyNs = p.rows! * p.refreshNs!;
    return (busyNs / (p.periodMs! * 1e6)) * 100;
  },

  stem(p) {
    return (
      `A DRAM has ${p.rows} rows and every row must be refreshed once per ${p.periodMs} ms. ` +
      `Each row refresh occupies the array for ${p.refreshNs} ns. ` +
      `What percentage of total time is spent refreshing?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: (p.rows! * p.refreshNs!) / p.periodMs! / 100,
        misconception: "mixed nanoseconds with milliseconds instead of converting",
      },
      {
        value: (p.refreshNs! / (p.periodMs! * 1e6)) * 100,
        misconception: "costed a single row refresh rather than all rows",
      },
      {
        value: (p.rows! * p.refreshNs!) / 1e6,
        misconception: "reported the refresh time in ms rather than as a percentage",
      },
      {
        value: (p.rows! / (p.periodMs! * 1000)) * 100,
        misconception: "ignored how long each refresh actually takes",
      },
    ];
  },

  rationale(p, correct) {
    const busyNs = p.rows! * p.refreshNs!;
    return (
      `Every ${p.periodMs} ms the array spends ${p.rows} x ${p.refreshNs} ns = ${busyNs} ns ` +
      `= ${round(busyNs / 1e6, 4)} ms refreshing. As a fraction of the period: ` +
      `${round(busyNs / 1e6, 4)} / ${p.periodMs} = ${round(correct, 4)}%. ` +
      `Refresh is the price DRAM pays for using one transistor per cell; SRAM needs none of it, ` +
      `which is why it is faster and dearer.`
    );
  },
};

/* ============================================================
 * 06.5 · Average rotational latency.  half a revolution
 * ========================================================== */

const diskRotationalLatency: Solver = {
  id: "disk-rotational-latency",
  version: "1.0.0",
  objectiveHint: "06.5",
  unit: "ms",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return { rpm: rng.pick([3600, 4200, 5400, 7200, 10_000, 15_000]) };
  },

  solve(p) {
    // One revolution takes 60000/rpm ms; the average wait is half of it.
    return 30_000 / p.rpm!;
  },

  stem(p) {
    return (
      `A disk spins at ${p.rpm} RPM. What is its average rotational latency, in milliseconds?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: 60_000 / p.rpm!,
        misconception: "used a full revolution instead of the average half revolution",
      },
      {
        value: p.rpm! / 60_000,
        misconception: "inverted the ratio",
      },
      {
        value: 30_000 / p.rpm! / 1000,
        misconception: "answered in seconds while the question asked for milliseconds",
      },
      {
        value: p.rpm! / 60,
        misconception: "answered with revolutions per second rather than a latency",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `At ${p.rpm} RPM one revolution takes 60000/${p.rpm} = ${round(60_000 / p.rpm!, 4)} ms. ` +
      `The head waits on average half a revolution for the sector to arrive, so the average ` +
      `rotational latency is ${round(correct, 4)} ms. ` +
      `The "half" is the part to remember: the sector is equally likely to be anywhere under the head.`
    );
  },
};

/* ============================================================
 * 06.5 · Total disk access time.  seek + rotational + transfer
 * Stallings section 6.1.
 * ========================================================== */

const diskAccessTime: Solver = {
  id: "disk-access-time",
  version: "1.0.0",
  objectiveHint: "06.5",
  unit: "ms",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      seekMs: rng.pick([2, 3, 4, 5, 8, 10]),
      rpm: rng.pick([5400, 7200, 10_000, 15_000]),
      sectors: rng.pick([1, 2, 4, 8, 16]),
      sectorsPerTrack: rng.pick([256, 500, 512, 1000]),
    };
  },

  solve(p) {
    const revMs = 60_000 / p.rpm!;
    return p.seekMs! + revMs / 2 + (p.sectors! / p.sectorsPerTrack!) * revMs;
  },

  stem(p) {
    return (
      `A disk has an average seek time of ${p.seekMs} ms, spins at ${p.rpm} RPM, and stores ` +
      `${p.sectorsPerTrack} sectors per track. What is the average time to read ${p.sectors} ` +
      `consecutive sector(s), in milliseconds?`
    );
  },

  distractors(p): Distractor[] {
    const revMs = 60_000 / p.rpm!;
    return [
      {
        value: p.seekMs! + revMs / 2,
        misconception: "omitted the transfer time",
      },
      {
        value: revMs / 2 + (p.sectors! / p.sectorsPerTrack!) * revMs,
        misconception: "omitted the seek time",
      },
      {
        value: p.seekMs! + revMs + (p.sectors! / p.sectorsPerTrack!) * revMs,
        misconception: "used a full revolution for the rotational delay instead of half",
      },
      {
        value: p.seekMs! + revMs / 2 + p.sectors! * revMs,
        misconception: "charged a full revolution per sector rather than a fraction of a track",
      },
    ];
  },

  rationale(p, correct) {
    const revMs = 60_000 / p.rpm!;
    return (
      `Access time = seek + rotational delay + transfer. Seek = ${p.seekMs} ms. ` +
      `One revolution = ${round(revMs, 4)} ms, so the average rotational delay is ${round(revMs / 2, 4)} ms. ` +
      `Transfer covers ${p.sectors}/${p.sectorsPerTrack} of a track = ${round((p.sectors! / p.sectorsPerTrack!) * revMs, 4)} ms. ` +
      `Total = ${round(correct, 4)} ms. Seek and rotation dominate, which is why sequential access ` +
      `on a spinning disk is so much cheaper per byte than random access.`
    );
  },
};

/* ============================================================
 * 06.3 · Disk capacity from its geometry
 * ========================================================== */

const diskCapacity: Solver = {
  id: "disk-capacity",
  version: "1.0.0",
  objectiveHint: "06.3",
  unit: "MiB",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      surfaces: rng.pick([2, 4, 6, 8, 10]),
      tracks: rng.pick([1024, 2048, 4096, 8192]),
      sectors: rng.pick([32, 64, 128, 256]),
      sectorBytes: 512,
    };
  },

  solve(p) {
    return (p.surfaces! * p.tracks! * p.sectors! * p.sectorBytes!) / 2 ** 20;
  },

  stem(p) {
    return (
      `A disk has ${p.surfaces} recording surfaces, ${p.tracks} tracks per surface, ` +
      `${p.sectors} sectors per track and ${p.sectorBytes} bytes per sector. ` +
      `What is its total capacity, in MiB?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: (p.tracks! * p.sectors! * p.sectorBytes!) / 2 ** 20,
        misconception: "computed one surface only and ignored the rest",
      },
      {
        value: (p.surfaces! * p.tracks! * p.sectors! * p.sectorBytes!) / 1e6,
        misconception: "used 10^6 bytes per MB instead of 2^20 per MiB",
      },
      {
        value: p.surfaces! * p.tracks! * p.sectors!,
        misconception: "counted sectors rather than converting to bytes",
      },
      {
        value: (p.surfaces! * p.tracks! * p.sectors! * p.sectorBytes!) / 2 ** 30,
        misconception: "answered in GiB",
      },
    ];
  },

  rationale(p, correct) {
    const total = p.surfaces! * p.tracks! * p.sectors! * p.sectorBytes!;
    return (
      `Capacity = surfaces x tracks x sectors x bytes/sector = ` +
      `${p.surfaces} x ${p.tracks} x ${p.sectors} x ${p.sectorBytes} = ${total} bytes. ` +
      `Dividing by 2^20 gives ${round(correct, 4)} MiB. ` +
      `This is the constant-sectors-per-track model; multiple zone recording packs more sectors ` +
      `onto the outer tracks and beats it.`
    );
  },
};

/* ============================================================
 * 06.7 · RAID 5 usable capacity.  (n - 1) x disk size
 * ========================================================== */

const raid5Capacity: Solver = {
  id: "raid5-capacity",
  version: "1.0.0",
  objectiveHint: "06.7",
  unit: "TB",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      disks: rng.pick([3, 4, 5, 6, 8, 10, 12]),
      diskTb: rng.pick([1, 2, 4, 6, 8]),
    };
  },

  solve(p) {
    return (p.disks! - 1) * p.diskTb!;
  },

  stem(p) {
    return (
      `A RAID 5 array is built from ${p.disks} disks of ${p.diskTb} TB each. ` +
      `What is its usable capacity, in TB?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.disks! * p.diskTb!,
        misconception: "ignored the parity overhead -- that is RAID 0, not RAID 5",
      },
      {
        value: (p.disks! * p.diskTb!) / 2,
        misconception: "halved the array, which is the RAID 1 mirroring overhead not RAID 5",
      },
      {
        value: (p.disks! - 2) * p.diskTb!,
        misconception: "reserved two disks for parity -- that is RAID 6",
      },
      {
        value: p.diskTb!,
        misconception: "answered with a single disk's capacity",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `RAID 5 distributes parity across all ${p.disks} disks, but the parity costs the equivalent ` +
      `of exactly one disk. Usable = (${p.disks} - 1) x ${p.diskTb} = ${correct} TB. ` +
      `The parity is spread, not stored on a dedicated disk -- that is what separates RAID 5 from ` +
      `RAID 4 -- but the capacity arithmetic is the same either way.`
    );
  },
};

/* ============================================================
 * 06.7 · RAID 5 parity overhead as a percentage
 * ========================================================== */

const raid5Overhead: Solver = {
  id: "raid5-overhead",
  version: "1.0.0",
  objectiveHint: "06.7",
  unit: "%",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return { disks: rng.pick([3, 4, 5, 6, 8, 10, 16]) };
  },

  solve(p) {
    return (1 / p.disks!) * 100;
  },

  stem(p) {
    return (
      `A RAID 5 array uses ${p.disks} disks. What percentage of the raw capacity is consumed by parity?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: ((p.disks! - 1) / p.disks!) * 100,
        misconception: "reported the usable fraction rather than the parity overhead",
      },
      {
        value: 50,
        misconception: "assumed mirroring overhead, which is RAID 1",
      },
      {
        value: (1 / (p.disks! - 1)) * 100,
        misconception: "divided by the data disks instead of the total disks",
      },
      {
        value: (2 / p.disks!) * 100,
        misconception: "costed two parity disks, which is RAID 6",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `Parity costs one disk out of ${p.disks}: 1/${p.disks} = ${round(correct, 4)}%. ` +
      `The overhead falls as the array grows, which is the argument for wide RAID 5 sets -- ` +
      `and the counter-argument is rebuild time and the risk of a second failure during it.`
    );
  },
};

/* ============================================================
 * 07.3 · DMA transfer time
 * ========================================================== */

const dmaTransferTime: Solver = {
  id: "dma-transfer-time",
  version: "1.0.0",
  objectiveHint: "07.3",
  unit: "ms",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      kib: rng.pick([4, 8, 16, 32, 64, 128]),
      rateMBs: rng.pick([20, 33, 50, 66, 100, 133, 200]),
    };
  },

  solve(p) {
    // KiB / (MB/s) -> ms.  (kib x 1024 bytes) / (rate x 10^6 B/s) x 1000 ms.
    return ((p.kib! * 1024) / (p.rateMBs! * 1e6)) * 1000;
  },

  stem(p) {
    return (
      `A DMA controller moves a ${p.kib} KiB block to memory over a channel sustaining ` +
      `${p.rateMBs} MB/s. How long does the transfer take, in milliseconds?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: p.kib! / p.rateMBs!,
        misconception: "divided KiB by MB/s without reconciling the units",
      },
      {
        value: ((p.kib! * 1024) / (p.rateMBs! * 1e6)) * 1e6,
        misconception: "answered in nanoseconds",
      },
      {
        value: (p.kib! * 1024) / (p.rateMBs! * 1e6),
        misconception: "answered in seconds while the question asked for milliseconds",
      },
      {
        value: ((p.kib! * 1000) / (p.rateMBs! * 1e6)) * 1000,
        misconception: "used 1000 bytes per KiB instead of 1024",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `${p.kib} KiB = ${p.kib! * 1024} bytes. At ${p.rateMBs} MB/s = ${p.rateMBs! * 1e6} bytes/s, ` +
      `the transfer takes ${p.kib! * 1024} / ${p.rateMBs! * 1e6} s = ${round(correct, 4)} ms. ` +
      `The processor is uninvolved for all of it except the setup and the completion interrupt -- ` +
      `that is exactly what DMA buys.`
    );
  },
};

/* ============================================================
 * 07.2 · Programmed I/O processor cost versus interrupt-driven
 * ========================================================== */

const programmedIoCost: Solver = {
  id: "programmed-io-cost",
  version: "1.0.0",
  objectiveHint: "07.2",
  unit: "%",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    const bytes = rng.pick([512, 1024, 2048, 4096]);
    const pollUs = rng.pick([1, 2, 4, 5]);
    /*
     * The window must be LONGER than the polling it contains. Drawing it
     * independently did not guarantee that: 4096 bytes at 5 us is 20.48 ms, and
     * against a 10 ms window the item asked for 163.84% of the processor --
     * an impossible answer, on a graded paper, that every student would have had
     * to either accept or argue with. Caught by the property test in
     * `solvers-act2.spec.ts`, not by reading the code.
     *
     * The stream is still consumed in a fixed order (bytes, pollUs, window), so
     * determinism is unaffected.
     */
    const busyMs = (bytes * pollUs) / 1000;
    const windows = [10, 20, 50, 100, 200, 500].filter((w) => w >= busyMs * 2);
    return { bytes, pollUs, totalMs: rng.pick(windows) };
  },

  solve(p) {
    // Programmed I/O polls once per byte; express that as a share of the window.
    const busyMs = (p.bytes! * p.pollUs!) / 1000;
    return (busyMs / p.totalMs!) * 100;
  },

  stem(p) {
    return (
      `With programmed I/O the processor transfers ${p.bytes} bytes one at a time, spending ` +
      `${p.pollUs} microsecond(s) per byte polling and moving data. Over a ${p.totalMs} ms window, ` +
      `what percentage of processor time does this consume?`
    );
  },

  distractors(p): Distractor[] {
    return [
      {
        value: ((p.bytes! * p.pollUs!) / p.totalMs!) * 100,
        misconception: "compared microseconds against milliseconds without converting",
      },
      {
        value: (p.bytes! * p.pollUs!) / 1000,
        misconception: "reported the busy time in ms rather than as a percentage",
      },
      {
        value: (p.pollUs! / p.totalMs!) * 100,
        misconception: "costed a single byte rather than the whole block",
      },
      {
        value: (p.bytes! / (p.totalMs! * 1000)) * 100,
        misconception: "ignored the per-byte cost",
      },
    ];
  },

  rationale(p, correct) {
    const busyMs = (p.bytes! * p.pollUs!) / 1000;
    return (
      `Polling costs ${p.bytes} x ${p.pollUs} us = ${round(busyMs, 4)} ms of processor time. ` +
      `Over a ${p.totalMs} ms window that is ${round(correct, 4)}%. ` +
      `DMA reduces this to a setup and a single completion interrupt regardless of block size, ` +
      `which is why programmed I/O does not scale to disk-sized transfers.`
    );
  },
};

/* ============================================================
 * 08.3 · Paging: offset and page-number field widths
 * ========================================================== */

const pageOffsetBits: Solver = {
  id: "page-offset-bits",
  version: "1.0.0",
  objectiveHint: "08.3",
  unit: "bits",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      addrBits: rng.pick([16, 24, 32]),
      pageKiB: rng.pick([1, 2, 4, 8, 16]),
    };
  },

  solve(p) {
    return log2(p.pageKiB! * 1024);
  },

  stem(p) {
    return (
      `A system uses ${p.addrBits}-bit logical addresses and a page size of ${p.pageKiB} KiB. ` +
      `How many bits of the address form the offset within a page?`
    );
  },

  distractors(p): Distractor[] {
    const off = log2(p.pageKiB! * 1024);
    return [
      {
        value: p.addrBits! - off,
        misconception: "answered with the page-number field rather than the offset",
      },
      {
        value: log2(p.pageKiB!),
        misconception: "took log2 of the KiB figure without expanding it by 1024",
      },
      {
        value: p.addrBits!,
        misconception: "used the whole address width",
      },
      {
        value: p.pageKiB! * 1024,
        misconception: "answered with the page size in bytes rather than a bit count",
      },
    ];
  },

  rationale(p, correct) {
    return (
      `The offset must address every byte in a page: ${p.pageKiB} KiB = ${p.pageKiB! * 1024} bytes, ` +
      `so the offset is log2(${p.pageKiB! * 1024}) = ${correct} bits. ` +
      `The remaining ${p.addrBits! - correct} bits are the page number. ` +
      `Paging splits the address at a FIXED point, which is precisely why paging suffers no external ` +
      `fragmentation and segmentation does.`
    );
  },
};

/* ============================================================
 * 08.5 · Page table entries for a virtual address space
 * ========================================================== */

const pageTableEntries: Solver = {
  id: "page-table-entries",
  version: "1.0.0",
  objectiveHint: "08.5",
  unit: "entries",
  tolerance: 0,
  sigFigs: 12,

  draw(rng) {
    return {
      addrBits: rng.pick([16, 20, 24, 28, 32]),
      pageKiB: rng.pick([1, 2, 4, 8]),
    };
  },

  solve(p) {
    return 2 ** (p.addrBits! - log2(p.pageKiB! * 1024));
  },

  stem(p) {
    return (
      `A process has a ${p.addrBits}-bit virtual address space and the page size is ${p.pageKiB} KiB. ` +
      `How many entries does its page table need?`
    );
  },

  distractors(p): Distractor[] {
    const off = log2(p.pageKiB! * 1024);
    return [
      {
        value: p.addrBits! - off,
        misconception: "answered with the width of the page-number field, not the number of entries",
      },
      {
        value: 2 ** p.addrBits! / p.pageKiB!,
        misconception: "divided by the page size in KiB rather than in bytes",
      },
      {
        value: 2 ** p.addrBits!,
        misconception: "counted one entry per addressable byte",
      },
      {
        value: 2 ** off,
        misconception: "used the offset field instead of the page-number field",
      },
    ];
  },

  rationale(p, correct) {
    const off = log2(p.pageKiB! * 1024);
    return (
      `The page number occupies ${p.addrBits} - ${off} = ${p.addrBits! - off} bits, and the table needs ` +
      `one entry per possible page number: 2^${p.addrBits! - off} = ${correct} entries. ` +
      `Equivalently, address space / page size. This number is why single-level page tables become ` +
      `impractical at 32 bits and beyond, and why multi-level tables exist.`
    );
  },
};

/* ============================================================
 * 08.5 · Effective access time with a TLB
 * ========================================================== */

const tlbEffectiveAccess: Solver = {
  id: "tlb-effective-access",
  version: "1.0.0",
  objectiveHint: "08.5",
  unit: "ns",
  tolerance: 0.005,
  sigFigs: 4,

  draw(rng) {
    return {
      hitPct: rng.pick([80, 85, 90, 92, 95, 98, 99]),
      tlbNs: rng.pick([1, 2, 5, 10, 20]),
      memNs: rng.pick([60, 80, 100, 120, 150]),
    };
  },

  solve(p) {
    const h = p.hitPct! / 100;
    // Hit: TLB lookup + one memory access. Miss: TLB lookup + page table read + memory access.
    return h * (p.tlbNs! + p.memNs!) + (1 - h) * (p.tlbNs! + 2 * p.memNs!);
  },

  stem(p) {
    return (
      `A TLB lookup takes ${p.tlbNs} ns and a memory access takes ${p.memNs} ns. ` +
      `On a TLB hit the mapping is known immediately; on a miss the page table must be read from ` +
      `memory first. With a ${p.hitPct}% hit ratio, what is the effective memory access time, in ns?`
    );
  },

  distractors(p): Distractor[] {
    const h = p.hitPct! / 100;
    return [
      {
        value: p.tlbNs! + p.memNs!,
        misconception: "costed the hit path only and ignored misses entirely",
      },
      {
        value: h * p.memNs! + (1 - h) * 2 * p.memNs!,
        misconception: "omitted the TLB lookup time from both paths",
      },
      {
        value: p.tlbNs! + 2 * p.memNs!,
        misconception: "costed the miss path only",
      },
      {
        value: h * (p.tlbNs! + p.memNs!) + (1 - h) * (p.tlbNs! + p.memNs!),
        misconception: "charged a miss the same as a hit, so the hit ratio had no effect",
      },
    ];
  },

  rationale(p, correct) {
    const h = p.hitPct! / 100;
    return (
      `EAT = h(TLB + mem) + (1 - h)(TLB + 2.mem) = ` +
      `${h}(${p.tlbNs} + ${p.memNs}) + ${round(1 - h, 4)}(${p.tlbNs} + ${2 * p.memNs!}) = ${round(correct, 4)} ns. ` +
      `A miss costs an EXTRA memory reference, not a replacement one -- the page table itself lives ` +
      `in memory. That doubling is why TLB hit ratios are engineered so close to 100%.`
    );
  },
};

export const ACT2_SOLVERS: readonly Solver[] = [
  hammingCheckBits,
  memoryAddressLines,
  dramChipCount,
  dramRefreshOverhead,
  diskRotationalLatency,
  diskAccessTime,
  diskCapacity,
  raid5Capacity,
  raid5Overhead,
  dmaTransferTime,
  programmedIoCost,
  pageOffsetBits,
  pageTableEntries,
  tlbEffectiveAccess,
];
