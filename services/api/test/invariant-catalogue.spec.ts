import { describe, it, expect } from "vitest";
import {
  INVARIANT_CATALOGUE,
  presentInvariant,
  summariseRun,
  type Emptiness,
} from "../src/audit/invariants.js";

/**
 * `/system`, rebuilt 28 Sep 2026. Two rulings of that day live here:
 *
 *  - a check is a NOTICE only when the table it reads is truly empty. Before,
 *    INV-18/27/28/29 were notices whenever they had offenders, so the page
 *    filed "the Prelim has 0 of 40 live items" under "nothing yet to check"
 *  - every check says what it protects and what to do, from one catalogue
 */

const SEEDED: Emptiness = { items: false, contentBlocks: false, objectives: false };
const BARE: Emptiness = { items: true, contentBlocks: true, objectives: true };

const row = (id: string, name: string, severity: "fail" | "warn", count: number) => ({
  id, name, severity, offending_count: String(count), sample: count ? [{ x: 1 }] : [],
});

describe("a notice is a notice only on an empty table", () => {
  it("INV-18 on a bank that HAS items keeps its own severity", () => {
    const r = presentInvariant(row("INV-18", "inv_18_bank_starvation", "warn", 2), SEEDED);
    expect(r.severity).toBe("warn");
    expect(r.dbSeverity).toBe("warn");
    expect(r.noticeReason).toBeNull();
  });

  it("INV-18 on a bank with no items at all is a notice, and says why", () => {
    const r = presentInvariant(row("INV-18", "inv_18_bank_starvation", "warn", 2), BARE);
    expect(r.severity).toBe("notice");
    expect(r.dbSeverity).toBe("warn");
    expect(r.noticeReason).toMatch(/no items/i);
  });

  it("INV-28 at fail stays failing while objectives exist", () => {
    const r = presentInvariant(row("INV-28", "inv_28_objectives_tagged", "fail", 3), SEEDED);
    expect(r.severity).toBe("fail");
  });

  it("each relabel reads its OWN table, not the bank", () => {
    const onlyBank: Emptiness = { items: true, contentBlocks: false, objectives: false };
    expect(presentInvariant(row("INV-27", "inv_27_archetype_beats", "warn", 9), onlyBank).severity).toBe("warn");
    expect(presentInvariant(row("INV-29", "inv_29_grid_reachable", "warn", 12), onlyBank).severity).toBe("warn");
    const noBlocks: Emptiness = { items: false, contentBlocks: true, objectives: false };
    expect(presentInvariant(row("INV-27", "inv_27_archetype_beats", "warn", 9), noBlocks).severity).toBe("notice");
    const noObjectives: Emptiness = { items: false, contentBlocks: false, objectives: true };
    expect(presentInvariant(row("INV-28", "inv_28_objectives_tagged", "fail", 18), noObjectives).severity).toBe("notice");
    expect(presentInvariant(row("INV-29", "inv_29_grid_reachable", "warn", 21), noObjectives).severity).toBe("notice");
  });

  it("a check with nothing to report is never relabelled", () => {
    const r = presentInvariant(row("INV-18", "inv_18_bank_starvation", "warn", 0), BARE);
    expect(r.severity).toBe("warn");
    expect(r.noticeReason).toBeNull();
  });

  it("no other check is ever a notice, however empty the database", () => {
    const r = presentInvariant(row("INV-15", "inv_15_live_items_reviewed", "fail", 1), BARE);
    expect(r.severity).toBe("fail");
  });
});

describe("the catalogue says what each check is for", () => {
  it("every entry names a title, the rule, what it protects and what to do", () => {
    for (const [id, e] of Object.entries(INVARIANT_CATALOGUE)) {
      expect(e.title.length, id).toBeGreaterThan(5);
      expect(e.checks.length, id).toBeGreaterThan(20);
      expect(e.protects.length, id).toBeGreaterThan(20);
      expect(e.action.length, id).toBeGreaterThan(20);
    }
  });

  it("a check the catalogue does not know is still shown, and says it is undescribed", () => {
    const r = presentInvariant(row("INV-99", "inv_99_new", "fail", 0), SEEDED);
    expect(r.title).toBe("inv_99_new");
    expect(r.protects).toMatch(/not described/i);
  });

  it("the sample is always an array of rows", () => {
    const r = presentInvariant({ ...row("INV-01", "inv_01_rls_enabled", "fail", 0), sample: null }, SEEDED);
    expect(r.sample).toEqual([]);
  });
});

describe("a nightly run is read from its own stored results", () => {
  it("counts failing and warning ids by the severity stored with each result, not by `passed`", () => {
    const s = summariseRun([
      { id: "INV-01", severity: "fail", offending_count: 0 },
      { id: "INV-18", severity: "warn", offending_count: 2 },
      { id: "INV-28", severity: "fail", offending_count: 18 },
      { id: "INV-25", severity: "warn", offending_count: 5 },
    ]);
    expect(s).toEqual({ failing: ["INV-28"], warning: ["INV-18", "INV-25"], checks: 4 });
  });

  it("a malformed record reads as zero checks, not a crash", () => {
    expect(summariseRun(null)).toEqual({ failing: [], warning: [], checks: 0 });
    expect(summariseRun({})).toEqual({ failing: [], warning: [], checks: 0 });
  });
});
