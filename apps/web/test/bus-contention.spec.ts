import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  accessesFor,
  canRequest,
  GROUPS,
  initialBus,
  INSTRUCTION_BITS,
  MODULES,
  QUOTES,
  request,
  SIGNALS,
  step,
  TRANSFERS,
  wire,
  WIDTHS,
  type BusState,
} from "../src/encounters/bus-contention";

/**
 * Moon 03.9's Bus Contention: every sentence it quotes is the book's (hard
 * rule 5, ch. 3 §3.3-3.5), and the bus behaves as those sentences say.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// Folds whitespace and the extract's markdown emphasis ("**Memory** read").
const fold = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const BOOK = fold(readFileSync(resolve(ROOT, "docs/source/book/ch-03.md"), "utf8"));

const everyQuote = [
  ...Object.values(QUOTES),
  ...GROUPS.map((g) => g.quote),
  ...Object.values(SIGNALS).map((s) => s.quote),
  ...Object.values(TRANSFERS).map((t) => t.quote),
];

describe("Bus Contention quotes the book (hard rule 5)", () => {
  for (const q of everyQuote) {
    it(`${q.cite}: "${q.text.slice(0, 48)}…" is in ch-03.md`, () => {
      expect(q.cite).toMatch(/^Stallings, ch\. 3, §3\.[345]/);
      expect(BOOK).toContain(fold(q.text));
    });
  }

  it("the three groups are the book's three, in its order", () => {
    expect(GROUPS.map((g) => g.id)).toEqual(["data", "address", "control"]);
    expect(BOOK).toContain("three functional groups (figure 3.16): data, address, and control lines");
  });

  it("the width relation is the book's: a 64-bit instruction on a 32-bit bus is two accesses", () => {
    expect(INSTRUCTION_BITS).toBe(64);
    expect(accessesFor(32)).toBe(2);
    expect(BOOK).toContain("if the data bus is 32 bits wide and each instruction is 64 bits long");
    expect(WIDTHS).toContain(32);
  });

  it("the modules are Figure 3.16's: a CPU, memory and I/O", () => {
    expect(MODULES.map((m) => m.kind)).toEqual(["cpu", "memory", "io", "io"]);
    expect(BOOK).toContain("cpu memory - - - memory i/o - - - i/o");
  });
});

/** Every module on every group. */
function wiredBus(over: Partial<BusState> = {}): BusState {
  let s = initialBus();
  for (const m of MODULES) for (const g of GROUPS) s = wire(s, m.id, g.id);
  return { ...s, ...over };
}

describe("wiring the bus", () => {
  it("opens unwired, and nothing can ask for the bus", () => {
    const s = initialBus();
    for (const m of MODULES) expect(s.wired[m.id]).toEqual([]);
    expect(canRequest(s, "cpu").ok).toBe(false);
  });

  it("a module asks for the bus only on all three groups, and only with memory on them too", () => {
    let s = initialBus();
    for (const g of GROUPS) s = wire(s, "cpu", g.id);
    const noMemory = canRequest(s, "cpu");
    expect(noMemory.ok).toBe(false);
    expect(noMemory.reason).toMatch(/Memory/);
    for (const g of ["data", "address"] as const) s = wire(s, "mem", g);
    expect(canRequest(s, "cpu").reason).toMatch(/control/);
    s = wire(s, "mem", "control");
    expect(canRequest(s, "cpu")).toEqual({ ok: true, reason: null });
  });

  it("without its control lines a module cannot raise a bus request, and the reason says so", () => {
    let s = initialBus();
    for (const g of GROUPS) s = wire(s, "mem", g.id);
    s = wire(wire(s, "io1", "data"), "io1", "address");
    const r = canRequest(s, "io1");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/control lines/);
  });

  it("wiring toggles: a second press takes the tap off again", () => {
    const s = wire(wire(initialBus(), "cpu", "data"), "cpu", "data");
    expect(s.wired.cpu).toEqual([]);
  });

  it("memory never asks for the bus: it answers", () => {
    expect(canRequest(wiredBus(), "mem").ok).toBe(false);
  });
});

describe("one transmitter at a time (arbitration on)", () => {
  it("grants in the order asked, and the others wait", () => {
    let s = wiredBus({ width: 64 });
    s = request(request(request(s, "io1"), "cpu"), "io2");
    s = step(s);
    expect(s.last!.transmitters).toEqual(["io1"]);
    expect(s.last!.granted).toBe("io1");
    expect(s.last!.waiting).toEqual(["cpu", "io2"]);
    expect(s.last!.garbled).toBe(false);
    s = step(s);
    expect(s.last!.transmitters).toEqual(["cpu"]);
    s = step(s);
    expect(s.last!.transmitters).toEqual(["io2"]);
    s = step(s);
    expect(s.last!.transmitters).toEqual([]);
    expect(s.queue).toEqual([]);
  });

  it("a narrow data bus holds the bus longer: 64 bits over 16 lines is four accesses", () => {
    let s = request(request(wiredBus({ width: 16 }), "cpu"), "io1");
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      s = step(s);
      seen.push(s.last!.transmitters.join(","));
    }
    expect(seen).toEqual(["cpu", "cpu", "cpu", "cpu", "io1"]);
    expect(accessesFor(16)).toBe(4);
    expect(accessesFor(8)).toBe(8);
    expect(accessesFor(64)).toBe(1);
  });

  it("each cycle names the book's signals: request, grant, the command, and the ACK", () => {
    let s = request(request(wiredBus({ width: 32 }), "cpu"), "io2");
    s = step(s);
    expect(s.last!.control).toEqual(["Bus request", "Bus grant", "Memory read", "Transfer ACK"]);
    expect(s.last!.address).toBe("Memory");
    expect(s.last!.data).toMatch(/bits 0–31 of 64/);
    s = step(s);
    expect(s.last!.data).toMatch(/bits 32–63 of 64/);
    s = step(s);
    expect(s.last!.control).toContain("Memory write");
    for (const name of s.last!.control) expect(Object.keys(SIGNALS)).toContain(name);
  });
});

describe("no arbitration: two at once garble", () => {
  it("two requests in one cycle both drive the lines, and nothing is transferred", () => {
    let s = request(request(wiredBus({ width: 64, arbitration: false }), "cpu"), "io1");
    s = step(s);
    expect(s.last!.garbled).toBe(true);
    expect(s.last!.transmitters).toEqual(["cpu", "io1"]);
    expect(s.last!.control).not.toContain("Transfer ACK");
    expect(s.queue.map((q) => q.id)).toEqual(["cpu", "io1"]);
  });

  it("a lone transmitter still gets through without a grant", () => {
    let s = request(wiredBus({ width: 64, arbitration: false }), "io2");
    s = step(s);
    expect(s.last!.garbled).toBe(false);
    expect(s.last!.control).not.toContain("Bus grant");
    expect(s.queue).toEqual([]);
  });
});

describe("it grades nothing", () => {
  it("the state carries no score, verdict or tally", () => {
    const keys = Object.keys(step(request(wiredBus(), "cpu")));
    expect(keys.join(" ")).not.toMatch(/score|correct|grade|points/i);
  });

  it("a module holds at most three requests", () => {
    let s = wiredBus();
    for (let i = 0; i < 5; i++) s = request(s, "io1");
    expect(s.queue.filter((q) => q.id === "io1")).toHaveLength(3);
  });
});
