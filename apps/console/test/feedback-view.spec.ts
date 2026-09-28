import { describe, it, expect } from "vitest";
import type { FeedbackReport } from "@octa/contracts";
import { apiParams, attached, day, readFilters, triageToast, variantOf, when } from "../src/lib/feedback-view";

const report = (over: Partial<FeedbackReport>): FeedbackReport => ({
  id: "1", reporterName: null, role: "student", createdAt: "2026-09-28T08:00:00.000Z", route: null,
  appVersion: null, category: null, rating: null, context: {}, resolvedVariant: null, ...over,
});

describe("the filter lives in the address", () => {
  it("reads what it understands and drops what it does not", () => {
    expect(readFilters(new URLSearchParams("status=shipped&kind=csat"))).toEqual({ status: "shipped", kind: "csat" });
    expect(readFilters(new URLSearchParams("status=bogus&kind=sus"))).toEqual({ status: null, kind: null });
  });
  it("writes only what is set, and the cursor", () => {
    expect(apiParams({ status: null, kind: "flag" }).toString()).toBe("kind=flag");
    expect(apiParams({ status: "new", kind: null }, "123.g:abc").toString()).toBe("status=new&before=123.g%3Aabc");
  });
});

describe("time is evidence", () => {
  it("never writes 'Sept', and carries the minute", () => {
    const iso = new Date(2026, 8, 28, 16, 4).toISOString();
    expect(day(iso)).toBe("28 Sep 2026");
    expect(when(iso)).toBe("28 Sep 2026, 16:04");
  });
});

describe("the variant is stored JSON, read defensively", () => {
  it("reads a stem, lettered options and numbers", () => {
    expect(variantOf({ stem: "Find it.", options: ["6 ns", "8 ns"], params: { hit: 2 } })).toEqual({
      stem: "Find it.", options: ["6 ns", "8 ns"], params: [["hit", "2"]],
    });
  });
  it("an empty or foreign value is no variant, never a blank panel", () => {
    expect(variantOf(null)).toBeNull();
    expect(variantOf("x")).toBeNull();
    expect(variantOf({ stem: "  " })).toBeNull();
  });
});

describe("what was attached", () => {
  it("lists route, version and every non-empty context key", () => {
    expect(attached(report({ route: "/app", appVersion: "0.9.3", context: { viewport: "1440×900", lastApiError: null, ui: { a: 1 } } }))).toEqual([
      ["route", "/app"], ["app version", "0.9.3"], ["viewport", "1440×900"], ["ui", '{"a":1}'],
    ]);
  });
});

describe("the triage toast says what happened to how many", () => {
  it("counts, names the state, and adds severity and release only when set", () => {
    expect(triageToast(5, "shipped", "high", "1.4")).toEqual({ title: "5 reports moved to shipped", body: "Severity high. Released in 1.4." });
    expect(triageToast(1, "wont_fix", undefined, null)).toEqual({ title: "Report moved to won't fix" });
    expect(triageToast(2, "triaged", null, undefined)).toEqual({ title: "2 reports moved to triaged", body: "Severity cleared." });
  });
});
