import { describe, it, expect } from "vitest";
import { chapterPath, isTab, outlineNote, reviewCount, subjectFromSlug, subjectPath, subjectSlug, tabsFor } from "../src/lib/studio-view";
import { gateFor } from "../src/lib/approval-gate";

describe("a subject's address", () => {
  it("is its code lowercased, the space a hyphen", () => {
    expect(subjectSlug("CPE 412")).toBe("cpe-412");
    expect(subjectSlug("CPE 413A")).toBe("cpe-413a");
    expect(subjectPath("CPE 412")).toBe("/studio/cpe-412");
    expect(chapterPath("04")).toBe("/studio/cpe-412/04");
  });
  it("finds the subject from the address, and none from a stranger", () => {
    expect(subjectFromSlug("cpe-413", ["CPE 412", "CPE 413"])).toBe("CPE 413");
    expect(subjectFromSlug("CPE-412", ["CPE 412"])).toBe("CPE 412");
    expect(subjectFromSlug("cpe-999", ["CPE 412"])).toBeNull();
  });
});

const sum = (status: "draft" | "approved" | "sent_back") => ({ status }) as never;
const fig = (status: "draft" | "approved" | "sent_back") => ({ status }) as never;

describe("a chapter's tabs", () => {
  it("always has Blocks, Summary and Objectives", () => {
    expect(tabsFor({ summary: null, draft: null, figures: [] }).map((t) => t.id)).toEqual(["blocks", "summary", "objectives"]);
  });
  it("adds Draft and Figures only when the chapter has them, in the SPEC's order", () => {
    const t = tabsFor({ summary: sum("approved"), draft: sum("draft"), figures: [fig("approved")] });
    expect(t.map((x) => x.id)).toEqual(["blocks", "summary", "draft", "figures", "objectives"]);
  });
  it("says which tab has something waiting", () => {
    const t = tabsFor({ summary: sum("draft"), draft: sum("approved"), figures: [fig("approved"), fig("draft")] });
    expect(t.filter((x) => x.waiting).map((x) => x.id)).toEqual(["summary", "figures"]);
  });
  it("recognises its own tab names, and nothing else", () => {
    expect(isTab("draft")).toBe(true);
    expect(isTab("history")).toBe(false);
    expect(isTab(null)).toBe(false);
  });
});

describe("what is waiting", () => {
  it("counts summaries, drafted chapters and figures to review, and not what is approved or sent back", () => {
    expect(reviewCount({
      summaries: { draft: 19, approved: 3, sentBack: 2, none: 0 },
      chapters: { draft: 6, approved: 1, sentBack: 1 },
      figures: { waiting: 17, approved: 4 },
    } as never)).toBe(42);
  });
  it("marks a chapter 'to review' when any of the three waits", () => {
    expect(outlineNote({ summaryStatus: "draft", draftStatus: null, figuresWaiting: 0 })).toBe("to review");
    expect(outlineNote({ summaryStatus: "approved", draftStatus: "draft", figuresWaiting: 0 })).toBe("to review");
    expect(outlineNote({ summaryStatus: null, draftStatus: null, figuresWaiting: 2 })).toBe("to review");
    expect(outlineNote({ summaryStatus: "approved", draftStatus: "approved", figuresWaiting: 0 })).toBeNull();
    expect(outlineNote({ summaryStatus: "sent_back", draftStatus: "sent_back", figuresWaiting: 0 })).toBeNull();
  });
});

describe("the approval gate says why in words (it decides what to render, never what is allowed)", () => {
  const teacher = { userId: "t1", role: "teacher" as const, approves: ["CPE 412"] };
  it("outside the Studio nothing is gated", () => {
    expect(gateFor(null, "anyone")).toEqual({ allowed: true, reason: null, selfApproved: false });
  });
  it("a teacher with no class of the subject may not, and is told so", () => {
    const g = gateFor({ ...teacher, approves: [] }, null);
    expect(g.allowed).toBe(false);
    expect(g.reason).toMatch(/teacher of CPE 412 or the admin/);
  });
  it("a teacher may not approve a version they wrote, and is told so", () => {
    const g = gateFor(teacher, "t1");
    expect(g.allowed).toBe(false);
    expect(g.reason).toMatch(/You wrote this version/);
  });
  it("a teacher may approve another's version, or one nobody wrote (from the files)", () => {
    expect(gateFor(teacher, "t2").allowed).toBe(true);
    expect(gateFor(teacher, null).allowed).toBe(true);
    expect(gateFor(teacher, undefined).allowed).toBe(true);
  });
  it("the admin may approve their own edit, and it says it is recorded as self-approved", () => {
    const admin = { userId: "a1", role: "admin" as const, approves: ["CPE 412"] };
    expect(gateFor(admin, "a1")).toEqual({ allowed: true, reason: null, selfApproved: true });
    expect(gateFor(admin, "t1").selfApproved).toBe(false);
  });
});
