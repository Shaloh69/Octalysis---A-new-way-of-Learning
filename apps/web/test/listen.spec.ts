import { describe, it, expect } from "vitest";
import { sentences, speakable } from "../src/lib/listen";

/**
 * The audiobook's text (docs/FIGURES-AND-AUDIO.md): what the voice is given,
 * and what it is not. Pure functions; the speaking itself is the browser's.
 */

describe("speakable", () => {
  it("reads prose, headings and list items in order, and keeps each block's index", () => {
    const chunks = speakable([
      { kind: "brief", body: "Every stage so far has moved data around." },
      { kind: "prose", body: "## The ALU\n\nOperands arrive in registers.\n\n- One zero.\n- A lopsided range." },
    ]);
    expect(chunks.map((c) => c.text)).toEqual([
      "Every stage so far has moved data around.",
      "The ALU",
      "Operands arrive in registers.",
      "One zero.",
      "A lopsided range.",
    ]);
    expect(chunks.map((c) => c.block)).toEqual([0, 1, 1, 1, 1]);
  });

  it("never reads a code listing", () => {
    const chunks = speakable([
      { kind: "code", body: "+45 = 0010 1101\nflip = 1101 0010" },
      { kind: "prose", body: "That is negation." },
    ]);
    expect(chunks).toEqual([{ block: 1, text: "That is negation." }]);
  });

  it("reads a figure only as its caption (the body IS the caption)", () => {
    const chunks = speakable([{ kind: "figure", body: "The same word, one cell per bit." }]);
    expect(chunks).toEqual([{ block: 0, text: "The same word, one cell per bit." }]);
  });

  it("drops markdown emphasis and reads a table row by row, cells named by column", () => {
    const chunks = speakable([
      {
        kind: "callout",
        body: "**The formats**\n\n| | binary32 | binary64 |\n|---|---|---|\n| Exponent bits | 8 | 11 |",
      },
    ]);
    expect(chunks.map((c) => c.text)).toEqual(["The formats", "Exponent bits, binary32: 8, binary64: 11"]);
  });
});

describe("sentences", () => {
  it("splits at sentence ends", () => {
    expect(sentences("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
  });
  it("splits a very long sentence at commas or spaces, never mid-word", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(", ") + ".";
    const parts = sentences(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(220);
      expect(p).toMatch(/^word\d+/);
    }
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long);
  });
  it("is empty for whitespace", () => {
    expect(sentences("   \n ")).toEqual([]);
  });
});
