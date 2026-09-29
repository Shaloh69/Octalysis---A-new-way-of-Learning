import { describe, it, expect } from "vitest";
import { parseBlocks, parseInline, sectionsOf, sourceLabel, longestLine, type Block, type Inline } from "../src/lib/markdown";

/**
 * The stage reader's markdown, as the content actually writes it.
 *
 * Every fixture below is copied from a real `content_blocks.body_md` (stages
 * 01, 03, 04, 07), because the defects this replaces (NEXT-SESSION §0j.3) were
 * all in real content: `## ` read with its hashes, a list whose items wrap was
 * one run-on paragraph with literal dashes, a table was raw pipes.
 */

const text = (c: Inline[]): string =>
  c.map((n) => ("v" in n ? n.v : text(n.c))).join("");

const LF = String.fromCharCode(10);
const lines = (...l: string[]) => l.join(LF);

describe("parseBlocks: headings", () => {
  it("## and ### are headings, never text with hashes", () => {
    const b = parseBlocks(lines("## The sequences those four functions allow", "", "Because there are four."));
    expect(b[0]).toMatchObject({ t: "h", level: 2 });
    expect(text((b[0] as Extract<Block, { t: "h" }>).c)).toBe("The sequences those four functions allow");
    const h3 = parseBlocks("### 1. Programmed I/O — the processor asks, repeatedly")[0];
    expect(h3).toMatchObject({ t: "h", level: 3 });
    expect(JSON.stringify(b)).not.toContain("##");
  });
});

describe("parseBlocks: lists", () => {
  it("a wrapped bullet item is ONE item, not a run-on paragraph (stage 04.8)", () => {
    const b = parseBlocks(lines(
      "Two flavours, both true of nearly all real code:",
      "",
      "- **Temporal locality** — a word used now is likely to be used again soon. Loop",
      "  counters, the top of the stack.",
      "- **Spatial locality** — a word near one just used is likely to be next. Array",
      "  traversal, sequential instructions.",
      "",
      "This is why a cache fetches a whole **block**, not a single word.",
    ));
    expect(b.map((x) => x.t)).toEqual(["p", "list", "p"]);
    const list = b[1] as Extract<Block, { t: "list" }>;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(text(list.items[0]!)).toBe(
      "Temporal locality — a word used now is likely to be used again soon. Loop counters, the top of the stack.",
    );
    expect(text(list.items[1]!)).not.toMatch(/^-/);
  });

  it("a wrapped ordered item keeps its number and its continuation (stage 01.13)", () => {
    const b = parseBlocks(lines(
      "1. **Move data from one place to another.** Nothing is computed. Copying a",
      "   buffer, reading a key, sending a byte to the screen.",
      "2. **Store data, or retrieve stored data.** Movement where one end is memory.",
    ));
    expect(b).toHaveLength(1);
    const list = b[0] as Extract<Block, { t: "list" }>;
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(1);
    expect(list.items).toHaveLength(2);
    expect(text(list.items[0]!)).toContain("Copying a buffer, reading a key");
  });
});

describe("parseBlocks: quotes and tables", () => {
  it("> is a blockquote with its own inline markup (stage 01.17)", () => {
    const b = parseBlocks(lines("One question:", "", "> **Is this visible to the program, or is it a choice underneath?**"));
    expect(b[1]).toMatchObject({ t: "quote" });
    const inner = (b[1] as Extract<Block, { t: "quote" }>).c[0] as Extract<Block, { t: "p" }>;
    expect(inner.c[0]).toMatchObject({ t: "strong" });
  });

  it("a table is a table; an empty header row is no header (stage 03.5)", () => {
    const b = parseBlocks(lines(
      "| | |",
      "|---|---|",
      "| **PC** | Program Counter — *where next* |",
      "| **IR** | Instruction Register — *what now* |",
    ));
    const t = b[0] as Extract<Block, { t: "table" }>;
    expect(t.t).toBe("table");
    expect(t.head).toBeNull();
    expect(t.rows).toHaveLength(2);
    expect(text(t.rows[0]![1]!)).toBe("Program Counter — where next");
  });

  it("a header row with words is kept (stage 07.15)", () => {
    const t = parseBlocks(lines(
      "| | Who waits | Who moves the data | Interrupts per block |",
      "|---|---|---|---|",
      "| Programmed | Processor | Processor | none |",
    ))[0] as Extract<Block, { t: "table" }>;
    expect(t.head!.map(text)).toEqual(["", "Who waits", "Who moves the data", "Interrupts per block"]);
    expect(t.rows[0]!.map(text)).toEqual(["Programmed", "Processor", "Processor", "none"]);
  });
});

describe("parseInline", () => {
  it("bold, both italics and code, with no marker left in the text", () => {
    const c = parseInline("Comparing *methods* will. Track _avg = H × T_ and `LOAD` **hard**.");
    expect(c.map((n) => n.t)).toContain("em");
    expect(c.map((n) => n.t)).toContain("code");
    expect(c.map((n) => n.t)).toContain("strong");
    expect(text(c)).toBe("Comparing methods will. Track avg = H × T and LOAD hard.");
  });

  it("a number in running text is its own mono token; the sentence is not", () => {
    const c = parseInline("A 7200 rpm disk turns once every 8.33 ms, about 70% of Stage 04.");
    const nums = c.filter((n) => n.t === "num").map((n) => ("v" in n ? n.v : ""));
    expect(nums).toEqual(["7200", "8.33", "70%", "04"]);
    expect(text(c)).toBe("A 7200 rpm disk turns once every 8.33 ms, about 70% of Stage 04.");
  });

  it("a snake_case word is not italic", () => {
    expect(parseInline("see stage_progress now").every((n) => n.t !== "em")).toBe(true);
  });
});

describe("sections, sources, figures", () => {
  it("the rail's sections are the ## headings, in order, h3 excluded", () => {
    const s = sectionsOf([
      { kind: "brief", body: "One hour." },
      { kind: "prose", body: lines("## Why a disk is slow", "", "### Seek", "text") },
      { kind: "code", body: "## not a heading inside a figure" },
      { kind: "prose", body: "## RAID: what to do when a disk dies" },
    ]);
    // The brief is section 0, so the first ## is 1: the rail and the anchors share this numbering.
    expect(s).toEqual([
      { section: 1, label: "Why a disk is slow" },
      { section: 2, label: "RAID: what to do when a disk dies" },
    ]);
    expect(sectionsOf([{ kind: "prose", body: "## Only" }])).toEqual([{ section: 0, label: "Only" }]);
  });

  it("a quote's source reads as a chapter and section", () => {
    expect(sourceLabel("ch-04.md 4.2")).toBe("Chapter 4, §4.2");
    expect(sourceLabel("something else")).toBe("something else");
  });

  it("a figure's width is its longest line, in characters", () => {
    expect(longestLine(lines("seek   move", "rotational wait for the sector"))).toBe(30);
    expect(longestLine("─────")).toBe(5);
  });
});
