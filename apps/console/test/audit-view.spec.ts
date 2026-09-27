import { describe, it, expect } from "vitest";
import type { AuditEntry } from "@octa/contracts";
import { apiParams, detailFields, entryDay, entryTime, filterWords, hasFilter, readFilters } from "../src/lib/audit-view";

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: "1", at: "2026-09-28T06:03:00.000Z", action: "lock.set", family: "locks", what: "",
  actor: null, subject: null, target: null, reason: null, payload: {}, ...over,
});

describe("the filter lives in the address", () => {
  it("reads what it understands and drops what it does not", () => {
    const f = readFilters(new URLSearchParams("family=locks&actor=system&q=%20Juan%20&from=2026-09-01&to=nope"));
    expect(f).toEqual({ family: "locks", actor: "system", q: "Juan", from: "2026-09-01", to: "" });
    expect(readFilters(new URLSearchParams("family=grades")).family).toBeNull();
    expect(hasFilter(readFilters(new URLSearchParams("")))).toBe(false);
  });
});

describe("a day is the teacher's day", () => {
  it("sends local midnight to the midnight after the last day, so one day is 24 hours", () => {
    const p = apiParams(readFilters(new URLSearchParams("from=2026-09-28&to=2026-09-28")));
    const [from, to] = [p.get("from")!, p.get("to")!];
    expect(new Date(from).getHours()).toBe(0);
    expect(new Date(from).getDate()).toBe(28);
    expect(Date.parse(to) - Date.parse(from)).toBe(86_400_000);
  });
  it("asks 100 at a time and passes the cursor", () => {
    const p = apiParams(readFilters(new URLSearchParams("")), "412");
    expect(p.get("limit")).toBe("100");
    expect(p.get("before")).toBe("412");
  });
});

describe("dates", () => {
  it("are built by hand, with the time", () => {
    const iso = new Date(2026, 8, 28, 14, 3).toISOString();
    expect(entryDay(iso)).toBe("28 Sep 2026");
    expect(entryTime(iso)).toBe("14:03");
  });
  it("say the filter in words", () => {
    const f = readFilters(new URLSearchParams("family=content&actor=abc&q=Juan&from=2026-09-01&to=2026-09-30"));
    expect(filterWords(f, () => "Prof. Bontuyan")).toBe(
      "Content & summaries · by Prof. Bontuyan · about “Juan” · from 1 Sep 2026 to 30 Sep 2026",
    );
    expect(filterWords(readFilters(new URLSearchParams("actor=system&from=2026-09-28&to=2026-09-28")), String))
      .toBe("by System (scheduled) · on 28 Sep 2026");
  });
});

describe("details: every recorded field, in words", () => {
  it("an approval shows the whole text it approved, as a quote", () => {
    const f = detailFields(entry({ action: "summary.approve", payload: { hash: "ab12", text: "The whole summary." } }));
    expect(f).toContainEqual({ label: "Text approved", value: "The whole summary.", quote: true });
    expect(f).toContainEqual({ label: "Text hash", value: "ab12", mono: true });
  });
  it("a send-back says whether it came off students' screens", () => {
    const f = detailFields(entry({ action: "summary.send_back", payload: { reason: "x", wasLive: true } }));
    expect(f[0]!.value).toMatch(/took it off/);
    expect(f.some((x) => x.label === "Reason"), "the reason has its own column").toBe(false);
  });
  it("a window change reads from → to for each part", () => {
    const f = detailFields(entry({
      action: "assessment.window",
      payload: { title: "Prelim", from: { opensAt: null, attemptsAllowed: 3 }, to: { opensAt: null, attemptsAllowed: 5 } },
    }));
    expect(f).toContainEqual({ label: "Attempts allowed", value: "3 → 5", mono: true });
    expect(f).toContainEqual({ label: "Opens", value: "not set → not set", mono: true });
    expect(f.some((x) => x.label === "Title")).toBe(true);
  });
  it("a lock keeps its ids, and a field it has no words for is still listed", () => {
    const f = detailFields(entry({ payload: { scope: "user", state: "auto", userId: "dddddddd-1111", newThing: 3 } }));
    expect(f).toContainEqual({ label: "For", value: "One student" });
    expect(f).toContainEqual({ label: "Now", value: "Back to its prerequisites" });
    expect(f).toContainEqual({ label: "User Id", value: "dddddddd-1111", mono: true });
    expect(f).toContainEqual({ label: "New Thing", value: "3", mono: true });
  });
  it("an import lists the student IDs it added", () => {
    const f = detailFields(entry({ action: "roster.import", payload: { inserted: ["1", "2"], updated: [] } }));
    expect(f).toContainEqual({ label: "Added", value: "2: 1, 2", mono: true });
    expect(f).toContainEqual({ label: "Updated", value: "0", mono: true });
  });
});
