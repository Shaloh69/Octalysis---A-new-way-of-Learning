import { describe, it, expect } from "vitest";
import type { StageSummary } from "../src/lib/api";
import { bold, canSave, characters, excerpt, levelsText, nextToReview, paragraphs, shapeOf } from "../src/lib/content-view";

const sum = (stageId: string, status: StageSummary["status"]): StageSummary => ({
  stageId, title: `Stage ${stageId}`, act: 1, draft: "x", hash: "h", status, note: null,
  reviewer: null, reviewedAt: null, updatedAt: "2026-09-28T00:00:00.000Z",
});

describe("the preview reads a block exactly as the student reader does", () => {
  it("splits paragraphs on a blank line and joins wrapped lines", () => {
    expect(paragraphs("one\ntwo\n\nthree")).toEqual([
      { type: "p", segs: [{ text: "one two", bold: false }] },
      { type: "p", segs: [{ text: "three", bold: false }] },
    ]);
  });
  it("a chunk of dash or star items is a list", () => {
    expect(paragraphs("- a\n* **b**")).toEqual([
      { type: "list", items: [[{ text: "a", bold: false }], [{ text: "b", bold: true }]] },
    ]);
  });
  it("a chunk mixing items and prose is a paragraph, as in the reader", () => {
    expect(paragraphs("lead-in:\n- a")[0]!.type).toBe("p");
  });
  it("bold is **x**, and nothing else is markdown", () => {
    expect(bold("a **b** c")).toEqual([
      { text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false },
    ]);
    expect(bold("*one star*")).toEqual([{ text: "*one star*", bold: false }]);
  });
  it("a ## heading stays literal: students see the hashes today", () => {
    expect(paragraphs("## The problem")).toEqual([{ type: "p", segs: [{ text: "## The problem", bold: false }] }]);
  });
  it("draws a block in one of the reader's five shapes", () => {
    expect(shapeOf("code", {})).toBe("code");
    expect(shapeOf("callout", { kind: "planned" })).toBe("planned");
    expect(shapeOf("callout", { kind: "scaffold" })).toBe("planned");
    expect(shapeOf("callout", {})).toBe("callout");
    expect(shapeOf("brief", {})).toBe("brief");
    expect(shapeOf("quote", { source: "ch-04.md 4.2" })).toBe("prose");
  });
});

describe("the editor offers Save only for a real change, with a reason", () => {
  it("unchanged text cannot be saved", () => {
    expect(canSave("Same.", "Same.  ", "typo fix")).toBe(false);
  });
  it("an empty block cannot be saved", () => {
    expect(canSave("Text.", "   ", "clear it")).toBe(false);
  });
  it("a reason under three characters is not a reason", () => {
    expect(canSave("Text.", "New text.", "ok")).toBe(false);
  });
  it("a change with a reason can", () => {
    expect(canSave("Text.", "New text.", "typo")).toBe(true);
  });
  it("counts characters in words", () => {
    expect(characters(1)).toBe("1 character");
    expect(characters(12)).toBe("12 characters");
  });
});

describe("a block's row names it by its first line", () => {
  it("drops heading, list and bold markers", () => {
    expect(excerpt("\n## **The** problem\nmore")).toBe("The problem");
  });
  it("cuts a long line at a word", () => {
    const e = excerpt("word ".repeat(40), 30);
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(31);
    expect(e).not.toMatch(/wor…$/);
  });
});

describe("after a review, focus goes to the next summary waiting", () => {
  const list = [sum("00", "approved"), sum("01", "draft"), sum("02", "sent_back"), sum("03", "draft"), sum("04", "draft")];
  it("the next draft after the one just done", () => {
    expect(nextToReview(list, "01")).toBe("03");
  });
  it("wraps to the first draft from the top", () => {
    expect(nextToReview(list, "04")).toBe("01");
  });
  it("none left is null", () => {
    expect(nextToReview([sum("00", "draft")], "00")).toBeNull();
  });
});

describe("a stage's levels", () => {
  it("a run is a range", () => {
    expect(levelsText([0, 1, 2, 3, 4, 5, 6])).toBe("L0–6");
  });
  it("anything else is listed, in the stage's order", () => {
    expect(levelsText([3, 2])).toBe("L3,2");
    expect(levelsText([6])).toBe("L6");
  });
});
