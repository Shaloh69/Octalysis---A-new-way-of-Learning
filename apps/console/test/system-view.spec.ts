import { describe, it, expect } from "vitest";
import type { InvariantResult } from "@octa/contracts";
import {
  attention, byArea, cell, countWords, counts, rerunToast, rows, runWords, sampleColumns, stamp, stateOf, trigger,
} from "../src/lib/system-view";

const r = (over: Partial<InvariantResult>): InvariantResult => ({
  id: "INV-01", name: "inv_01_rls_enabled", severity: "fail", dbSeverity: "fail", offendingCount: 0, sample: [],
  area: "security", title: "t", checks: "c", protects: "p", action: "a", noticeReason: null, ...over,
});

describe("a check's state is a word", () => {
  it("passing whenever nothing was found, whatever its severity", () => {
    expect(stateOf(r({ severity: "fail", offendingCount: 0 }))).toBe("passing");
    expect(stateOf(r({ severity: "notice", offendingCount: 0 }))).toBe("passing");
  });
  it("otherwise its severity, in words", () => {
    expect(stateOf(r({ severity: "fail", offendingCount: 1 }))).toBe("failing");
    expect(stateOf(r({ severity: "warn", offendingCount: 1 }))).toBe("warning");
    expect(stateOf(r({ severity: "notice", offendingCount: 1 }))).toBe("notice");
  });
});

describe("needs attention", () => {
  it("failing first, then warnings, then notices; by id within each, numerically", () => {
    const list = attention([
      r({ id: "INV-29", severity: "warn", offendingCount: 3 }),
      r({ id: "INV-28", severity: "notice", offendingCount: 3 }),
      r({ id: "INV-01", offendingCount: 0 }),
      r({ id: "INV-9", severity: "warn", offendingCount: 1 }),
      r({ id: "INV-15", severity: "fail", offendingCount: 2 }),
    ]);
    expect(list.map((x) => x.id)).toEqual(["INV-15", "INV-9", "INV-29", "INV-28"]);
  });
});

describe("counts, never a verdict", () => {
  it("names every state with its number, zero included, in the right plural", () => {
    const c = counts([r({ offendingCount: 0 }), r({ severity: "warn", offendingCount: 1 })]);
    expect(countWords(c).map((w) => `${w.n} ${w.word}`)).toEqual(["0 failing", "1 warning", "0 notices", "1 passing"]);
  });
  it("rows", () => {
    expect(rows(1)).toBe("1 row");
    expect(rows(1200)).toBe("1,200 rows");
  });
});

describe("areas keep the schema's order and hide none that have checks", () => {
  it("orders areas and ids", () => {
    const g = byArea([
      r({ id: "INV-25", area: "feedback" }),
      r({ id: "INV-18", area: "bank" }),
      r({ id: "INV-15", area: "bank" }),
      r({ id: "INV-02", area: "security" }),
    ]);
    expect(g.map((x) => x.label)).toEqual(["Security", "Item bank", "Feedback"]);
    expect(g[1]!.checks.map((x) => x.id)).toEqual(["INV-15", "INV-18"]);
  });
});

describe("time is evidence", () => {
  it("is a date and a time to the second, never 'Sept'", () => {
    const iso = new Date(2026, 8, 28, 16, 4, 9).toISOString();
    expect(stamp(iso)).toBe("28 Sep 2026, 16:04:09");
  });
});

describe("samples", () => {
  it("uses every column any row returns, in order", () => {
    expect(sampleColumns([{ a: 1, b: 2 }, { a: 3, c: 4 }])).toEqual(["a", "b", "c"]);
  });
  it("prints values as the database would", () => {
    expect(cell(null)).toBe("null");
    expect(cell(40)).toBe("40");
    expect(cell({ x: 1 })).toBe('{"x":1}');
  });
});

describe("nightly runs in words", () => {
  it("says what failed and what warned, by id", () => {
    expect(runWords({ failing: ["INV-15"], warning: ["INV-18", "INV-25"] })).toBe("1 failing: INV-15 · 2 warnings: INV-18, INV-25");
    expect(runWords({ failing: [], warning: [] })).toBe("Nothing failing");
    expect(runWords({ failing: [], warning: ["INV-18"] })).toBe("Nothing failing · 1 warning: INV-18");
  });
  it("names what ran it", () => {
    expect(trigger("cron")).toBe("Nightly");
    expect(trigger("dddddddd-0000-4000-8000-000000000001")).toBe("By a staff member");
  });
  it("the re-run toast", () => {
    const iso = new Date(2026, 8, 28, 16, 41, 3).toISOString();
    expect(rerunToast(iso, { failing: 1, warning: 4, notice: 0, passing: 23 })).toBe("Checked again at 16:41:03: 1 failing, 4 warnings");
  });
});
