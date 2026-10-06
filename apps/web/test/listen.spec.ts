import { describe, it, expect } from "vitest";
import { maxCharsFor, rankVoices, sentences, speakable, speechText } from "../src/lib/listen";

/**
 * The audiobook's text and voice choice (docs/FIGURES-AND-AUDIO.md). Pure
 * functions; the speaking itself is the browser's. 6 Oct 2026: the instructor
 * found the voice "horrible", so the best voice is chosen and a paragraph is
 * spoken whole where the voice allows it.
 */

describe("speakable", () => {
  it("one chunk per paragraph, heading and list item, in order, each with its block", () => {
    const chunks = speakable([
      { kind: "brief", body: "Every stage so far has moved data around. This one does arithmetic." },
      { kind: "prose", body: "## The ALU\n\nOperands arrive in registers.\n\n- One zero\n- A lopsided range" },
    ]);
    expect(chunks.map((c) => c.text)).toEqual([
      "Every stage so far has moved data around. This one does arithmetic.",
      "The ALU.",
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
    expect(speakable([{ kind: "figure", body: "The same word, one cell per bit." }])).toEqual([
      { block: 0, text: "The same word, one cell per bit." },
    ]);
  });

  it("drops markdown emphasis and reads a table row by row, cells named by column", () => {
    const chunks = speakable([
      { kind: "callout", body: "**The formats**\n\n| | binary32 | binary64 |\n|---|---|---|\n| Exponent bits | 8 | 11 |" },
    ]);
    expect(chunks.map((c) => c.text)).toEqual(["The formats.", "Exponent bits, binary32: 8, binary64: 11."]);
  });
});

describe("speechText", () => {
  it("says symbols as words", () => {
    expect(speechText("n × 2 − 1 ≈ 3, e.g. this")).toBe("n times 2 minus 1 about 3, for example this.");
  });
  it("ends with a pause, and leaves an ended sentence alone", () => {
    expect(speechText("Overflow")).toBe("Overflow.");
    expect(speechText("Is it?")).toBe("Is it?");
  });
});

describe("sentences", () => {
  it("keeps whole sentences together up to the limit", () => {
    expect(sentences("One. Two? Three!", 200)).toEqual(["One. Two? Three!"]);
    expect(sentences("One sentence here. Another one here.", 20)).toEqual(["One sentence here.", "Another one here."]);
  });
  it("splits a very long sentence at commas or spaces, never mid-word", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(", ") + ".";
    const parts = sentences(long, 200);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(200);
      expect(p).toMatch(/^word\d+/);
    }
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long);
  });
  it("is empty for whitespace", () => {
    expect(sentences("   \n ")).toEqual([]);
  });
});

describe("rankVoices", () => {
  const v = (name: string, lang = "en-US", localService = true) => ({ name, lang, localService });
  it("puts natural and online voices first, the old robotic ones last, and drops other languages", () => {
    const ranked = rankVoices([
      v("Microsoft David - English (United States)"),
      v("eSpeak English", "en"),
      v("Microsoft Aria Online (Natural) - English (United States)", "en-US", false),
      v("Google US English", "en-US", false),
      v("Google français", "fr-FR", false),
    ]).map((x) => x.name);
    expect(ranked[0]).toBe("Microsoft Aria Online (Natural) - English (United States)");
    expect(ranked[1]).toBe("Google US English");
    expect(ranked.at(-1)).toMatch(/David|eSpeak/);
    expect(ranked).not.toContain("Google français");
  });
  it("Google's online voices get short utterances (they stop after ~15 s); others a whole paragraph", () => {
    expect(maxCharsFor(v("Google US English"))).toBe(200);
    expect(maxCharsFor(v("Microsoft Aria Online (Natural)"))).toBe(1200);
    expect(maxCharsFor(null)).toBe(1200);
  });
});
