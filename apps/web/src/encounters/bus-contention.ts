/**
 * Bus Contention: moon 03.9, "Enumerate the elements of Bus design"
 * (WEB-REVAMP 3.6, approved 30 Sep 2026; GAME-DESIGN.md §11, stage 03).
 *
 * HARD RULE 5. Everything the bench says about a bus is Stallings ch. 3,
 * §3.3-3.5 (`docs/source/book/ch-03.md`), quoted: the bus is a shared medium
 * and only one device transmits at a time; its lines fall into three groups,
 * data, address and control; the data bus's width sets how many bits move at
 * once (a 64-bit instruction over 32 lines is two accesses, the book's own
 * example); a module must obtain the bus before it transfers; and the control
 * signals it does that with are the book's list. `test/bus-contention.spec.ts`
 * checks every quote against the file and every rule against the model.
 *
 * WHAT THE BENCH SIMPLIFIES, SAID OUT LOUD: grants go in the order asked (the
 * book names arbitration and leaves its methods to Appendix C, which the
 * sources do not carry), and an I/O module's direct-memory transfer takes one
 * bus cycle. Neither is stated as a fact about buses; the bench says both.
 *
 * NOT FROM THE 9th EDITION'S TABLE: the extract is the edition whose §3.4 has
 * no "Elements of Bus Design" table (type, arbitration, timing, width, data
 * transfer type), so the bench teaches the elements the extract does carry.
 *
 * IT GRADES NOTHING: nothing to answer, nothing marked, recorded or sent.
 */

export interface Quote {
  text: string;
  cite: string;
}

export type ModuleId = "cpu" | "mem" | "io1" | "io2";
export type GroupId = "data" | "address" | "control";

/** Figure 3.16's modules: a CPU, memory and I/O (one memory is enough here). */
export const MODULES: ReadonlyArray<{ id: ModuleId; kind: "cpu" | "memory" | "io"; name: string; short: string }> = [
  { id: "cpu", kind: "cpu", name: "Processor", short: "CPU" },
  { id: "mem", kind: "memory", name: "Memory", short: "MEM" },
  { id: "io1", kind: "io", name: "I/O module 1", short: "I/O 1" },
  { id: "io2", kind: "io", name: "I/O module 2", short: "I/O 2" },
];

export const moduleName = (id: ModuleId): string => MODULES.find((m) => m.id === id)!.name;

/** The book's three functional groups of lines, in its order. */
export const GROUPS: ReadonlyArray<{ id: GroupId; name: string; quote: Quote }> = [
  {
    id: "data",
    name: "Data lines",
    quote: { text: "The data lines provide a path for moving data among system modules.", cite: "Stallings, ch. 3, §3.4" },
  },
  {
    id: "address",
    name: "Address lines",
    quote: {
      text: "The address lines are used to designate the source or destination of the data on the data bus.",
      cite: "Stallings, ch. 3, §3.4",
    },
  },
  {
    id: "control",
    name: "Control lines",
    quote: {
      text: "The control lines are used to control the access to and the use of the data and address lines.",
      cite: "Stallings, ch. 3, §3.4",
    },
  },
];

export const groupName = (id: GroupId): string => GROUPS.find((g) => g.id === id)!.name;

export const QUOTES = {
  shared: {
    text: "A key characteristic of a bus is that it is a shared transmission medium.",
    cite: "Stallings, ch. 3, §3.4",
  },
  garbled: {
    text: "If two devices transmit during the same time period, their signals will overlap and become garbled. Thus, only one device at a time can successfully transmit.",
    cite: "Stallings, ch. 3, §3.4",
  },
  groups: {
    text: "on any bus the lines can be classified into three functional groups (Figure 3.16): data, address, and control lines.",
    cite: "Stallings, ch. 3, §3.4",
  },
  width: {
    text: "Because each line can carry only one bit at a time, the number of lines determines how many bits can be transferred at a time.",
    cite: "Stallings, ch. 3, §3.4",
  },
  widthExample: {
    text: "if the data bus is 32 bits wide and each instruction is 64 bits long, then the processor must access the memory module twice during each instruction cycle.",
    cite: "Stallings, ch. 3, §3.4",
  },
  operation: {
    text: "If one module wishes to send data to another, it must do two things: (1) obtain the use of the bus, and (2) transfer data via the bus.",
    cite: "Stallings, ch. 3, §3.4",
  },
  arbitration: {
    text: "This eliminates the need for arbitration found in shared transmission systems.",
    cite: "Stallings, ch. 3, §3.5",
  },
} as const satisfies Record<string, Quote>;

/** The control signals the bench raises: names and meanings are the book's list. */
export const SIGNALS = {
  "Bus request": {
    quote: { text: "Bus request: indicates that a module needs to gain control of the bus.", cite: "Stallings, ch. 3, §3.4" },
  },
  "Bus grant": {
    quote: {
      text: "Bus grant: indicates that a requesting module has been granted control of the bus.",
      cite: "Stallings, ch. 3, §3.4",
    },
  },
  "Memory read": {
    quote: { text: "Memory read: causes data from the addressed location to be placed on the bus.", cite: "Stallings, ch. 3, §3.4" },
  },
  "Memory write": {
    quote: {
      text: "Memory write: causes data on the bus to be written into the addressed location.",
      cite: "Stallings, ch. 3, §3.4",
    },
  },
  "Transfer ACK": {
    quote: {
      text: "Transfer ACK: indicates that data have been accepted from or placed on the bus.",
      cite: "Stallings, ch. 3, §3.4",
    },
  },
} as const satisfies Record<string, { quote: Quote }>;

export type SignalName = keyof typeof SIGNALS;

/** The transfers each asking module makes: the book's list in §3.3. */
export const TRANSFERS = {
  cpu: {
    command: "Memory read" as SignalName,
    what: "an instruction",
    quote: {
      text: "Memory to processor: The processor reads an instruction or a unit of data from memory.",
      cite: "Stallings, ch. 3, §3.3",
    },
  },
  io: {
    command: "Memory write" as SignalName,
    what: "a unit of data",
    quote: {
      text: "an I/O module is allowed to exchange data directly with memory, without going through the processor, using direct memory access.",
      cite: "Stallings, ch. 3, §3.3",
    },
  },
} as const;

/** The book's instruction length in its width example. */
export const INSTRUCTION_BITS = 64;
/** Data bus widths on the dial ("32, 64, 128, or even more"; 8 and 16 below them). */
export const WIDTHS = [8, 16, 32, 64] as const;
export type Width = (typeof WIDTHS)[number];

/** Accesses to move one 64-bit instruction over `width` data lines. */
export function accessesFor(width: number): number {
  return Math.ceil(INSTRUCTION_BITS / width);
}

/** Requests one module may hold at once (the riders waiting at its stop). */
export const MAX_PENDING = 3;

export interface Pending {
  id: ModuleId;
  /** Accesses still to make; set when the request is raised. */
  left: number;
  /** Accesses in all, for "bits 32–63 of 64". */
  of: number;
}

export interface CycleReport {
  cycle: number;
  /** Control signals asserted this cycle, in the order they happen. */
  control: SignalName[];
  /** The destination named on the address lines, if anything is sent. */
  address: string | null;
  /** What is on the data lines, or null if they are idle. */
  data: string | null;
  garbled: boolean;
  /** Every module that drove the bus this cycle. */
  transmitters: ModuleId[];
  granted: ModuleId | null;
  /** Modules with a request raised that did not transmit this cycle. */
  waiting: ModuleId[];
}

export interface BusState {
  wired: Record<ModuleId, GroupId[]>;
  width: Width;
  /** Bus request and bus grant in use: false lets every asker drive the lines. */
  arbitration: boolean;
  /** Raised requests in the order asked; the head holds the bus. */
  queue: Pending[];
  cycle: number;
  last: CycleReport | null;
}

export function initialBus(): BusState {
  return { wired: { cpu: [], mem: [], io1: [], io2: [] }, width: 32, arbitration: true, queue: [], cycle: 0, last: null };
}

/** Taps a module onto a group of lines, or takes the tap off. */
export function wire(s: BusState, id: ModuleId, group: GroupId): BusState {
  const has = s.wired[id].includes(group);
  const next = has ? s.wired[id].filter((g) => g !== group) : GROUPS.map((g) => g.id).filter((g) => g === group || s.wired[id].includes(g));
  // A module taken off a group can no longer finish what it asked for; with
  // Memory off, nobody can.
  const queue = !has ? s.queue : id === "mem" ? [] : s.queue.filter((q) => q.id !== id);
  return { ...s, wired: { ...s.wired, [id]: next }, queue };
}

const missing = (s: BusState, id: ModuleId): GroupId[] => GROUPS.map((g) => g.id).filter((g) => !s.wired[id].includes(g));

/** Whether a module may raise a bus request, and if not, why in words. */
export function canRequest(s: BusState, id: ModuleId): { ok: boolean; reason: string | null } {
  if (id === "mem") return { ok: false, reason: "Memory answers requests; it does not raise them." };
  const own = missing(s, id);
  if (own.length) {
    const first = own.includes("control") ? "control" : own[0]!;
    return {
      ok: false,
      reason:
        first === "control"
          ? `Tap ${moduleName(id)} onto the control lines first: a bus request travels on them.`
          : `Tap ${moduleName(id)} onto the ${groupName(first).toLowerCase()} first.`,
    };
  }
  const mem = missing(s, "mem");
  if (mem.length) return { ok: false, reason: `Tap Memory onto the ${groupName(mem.includes("control") ? "control" : mem[0]!).toLowerCase()} too: every transfer here goes to or from it.` };
  if (s.queue.filter((q) => q.id === id).length >= MAX_PENDING) {
    return { ok: false, reason: `${moduleName(id)} already has ${MAX_PENDING} requests waiting.` };
  }
  return { ok: true, reason: null };
}

/** Raises a request for the bus, if the module may. */
export function request(s: BusState, id: ModuleId): BusState {
  if (!canRequest(s, id).ok) return s;
  const of = id === "cpu" ? accessesFor(s.width) : 1;
  return { ...s, queue: [...s.queue, { id, left: of, of }] };
}

function describeData(p: Pending, width: number): string {
  if (p.id !== "cpu") return `${TRANSFERS.io.what}, from ${moduleName(p.id)}`;
  const k = p.of - p.left;
  const lo = k * width;
  const hi = Math.min(lo + width, INSTRUCTION_BITS) - 1;
  return `${TRANSFERS.cpu.what}, bits ${lo}–${hi} of ${INSTRUCTION_BITS}`;
}

const commandFor = (id: ModuleId): SignalName => (id === "cpu" ? TRANSFERS.cpu.command : TRANSFERS.io.command);

/** One bus cycle. */
export function step(s: BusState): BusState {
  const cycle = s.cycle + 1;
  const askers = [...new Set(s.queue.map((q) => q.id))];
  if (s.queue.length === 0) {
    const last: CycleReport = { cycle, control: [], address: null, data: null, garbled: false, transmitters: [], granted: null, waiting: [] };
    return { ...s, cycle, last };
  }

  if (!s.arbitration) {
    // Nobody asks, nobody is granted: every module with something to send drives the lines.
    const firsts = askers.map((id) => s.queue.find((q) => q.id === id)!);
    if (firsts.length > 1) {
      const last: CycleReport = {
        cycle,
        control: [...new Set(firsts.map((p) => commandFor(p.id)))],
        address: "Memory",
        data: "garbled: the signals overlap",
        garbled: true,
        transmitters: askers,
        granted: null,
        waiting: [],
      };
      return { ...s, cycle, last };
    }
    const head = firsts[0]!;
    return advance(s, head, cycle, [commandFor(head.id), "Transfer ACK"], null);
  }

  const head = s.queue[0]!;
  return advance(s, head, cycle, ["Bus request", "Bus grant", commandFor(head.id), "Transfer ACK"], head.id);
}

function advance(s: BusState, head: Pending, cycle: number, control: SignalName[], granted: ModuleId | null): BusState {
  const data = describeData(head, s.width);
  const left = head.left - 1;
  const idx = s.queue.indexOf(head);
  const queue = left > 0 ? s.queue.map((q, i) => (i === idx ? { ...q, left } : q)) : s.queue.filter((_, i) => i !== idx);
  const waiting = [...new Set(s.queue.filter((q) => q.id !== head.id).map((q) => q.id))];
  // A bus request is raised only while someone is asking: alone and unarbitrated, it is not.
  const last: CycleReport = { cycle, control, address: "Memory", data, garbled: false, transmitters: [head.id], granted, waiting };
  return { ...s, queue, cycle, last };
}

/** Everyone asks at once: one request from each module that may. */
export function everyoneAsks(s: BusState): BusState {
  return MODULES.reduce((acc, m) => request(acc, m.id), s);
}

export function setWidth(s: BusState, width: Width): BusState {
  // Requests already raised keep the accesses they were raised with.
  return { ...s, width };
}

export function setArbitration(s: BusState, on: boolean): BusState {
  return { ...s, arbitration: on };
}

/** Clears the queue and the cycle count; the wiring and the dials stay. */
export function clearTraffic(s: BusState): BusState {
  return { ...s, queue: [], cycle: 0, last: null };
}
