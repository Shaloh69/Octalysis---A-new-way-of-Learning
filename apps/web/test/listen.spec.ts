import { describe, it, expect } from "vitest";
import {
  maxCharsFor,
  planUtterances,
  progressOf,
  rankVoices,
  sentenceAt,
  speakable,
  speechText,
  splitSentences,
  wordIndexAt,
} from "../src/lib/listen";

/**
 * The audiobook's text and voice choice (docs/FIGURES-AND-AUDIO.md). Pure
 * functions; the speaking itself is the browser's. 6 Oct 2026: the instructor
 * found the voice "horrible", so the best voice is chosen and a paragraph is
 * spoken whole where the voice allows it. Later the same day: it follows the
 * voice SENTENCE by sentence, and word by word where the voice reports words.
 */

const text = (c: { spoken: readonly string[] }) => c.spoken.join(" ");

describe("speakable", () => {
  it("one chunk per paragraph, heading and list item, in order, each with its block", () => {
    const chunks = speakable([
      { kind: "brief", body: "Every stage so far has moved data around. This one does arithmetic." },
      { kind: "prose", body: "## The ALU\n\nOperands arrive in registers.\n\n- One zero\n- A lopsided range" },
    ]);
    expect(chunks.map(text)).toEqual([
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
    expect(chunks.map((c) => [c.block, text(c)])).toEqual([[1, "That is negation."]]);
  });

  it("reads a figure only as its caption (the body IS the caption)", () => {
    expect(speakable([{ kind: "figure", body: "The same word, one cell per bit." }]).map(text)).toEqual([
      "The same word, one cell per bit.",
    ]);
  });

  it("drops markdown emphasis and reads a table row by row, cells named by column", () => {
    const chunks = speakable([
      { kind: "callout", body: "**The formats**\n\n| | binary32 | binary64 |\n|---|---|---|\n| Exponent bits | 8 | 11 |" },
    ]);
    expect(chunks.map(text)).toEqual(["The formats.", "Exponent bits, binary32: 8, binary64: 11."]);
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

describe("splitSentences", () => {
  it("splits at sentence ends, keeping what the page shows", () => {
    expect(splitSentences("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
    expect(splitSentences("It said \"stop.\" Then it did.")).toEqual(['It said "stop."', "Then it did."]);
  });
  it("is not fooled by a decimal, an abbreviation, an initial, or a word ending in 'ed'", () => {
    expect(splitSentences("A 3.5 GHz clock, e.g. this one. J. von Neumann wrote it.")).toEqual([
      "A 3.5 GHz clock, e.g. this one.",
      "J. von Neumann wrote it.",
    ]);
    expect(splitSentences("The bus is shared. It is slow.")).toEqual(["The bus is shared.", "It is slow."]);
  });
  it("keeps the speakable sentences and the shown sentences in step", () => {
    const [c] = speakable([{ kind: "prose", body: "Add n × 2. Then stop" }]);
    expect(c!.sentences).toEqual(["Add n × 2.", "Then stop"]);
    expect(c!.spoken).toEqual(["Add n times 2.", "Then stop."]);
  });
  it("is empty for whitespace", () => {
    expect(splitSentences("   \n ")).toEqual([]);
  });
});

describe("planUtterances and following", () => {
  const [chunk] = speakable([{ kind: "prose", body: "One sentence here. Another one here. And a third." }]);
  it("puts whole sentences in one utterance up to the limit, and knows where each starts", () => {
    const [u] = planUtterances(chunk!, 1200);
    expect(u!.text).toBe("One sentence here. Another one here. And a third.");
    expect(u!.sentences).toEqual([0, 1, 2]);
    expect(u!.starts).toEqual([0, 19, 37]);
    expect(planUtterances(chunk!, 20).map((x) => x.sentences)).toEqual([[0], [1], [2]]);
  });
  it("maps a spoken character back to its sentence and word", () => {
    const [u] = planUtterances(chunk!, 1200);
    expect(sentenceAt(u!, 0)).toBe(0);
    expect(sentenceAt(u!, 25)).toBe(1);
    expect(sentenceAt(u!, 40)).toBe(2);
    expect(wordIndexAt("Another one here.", 0)).toBe(0);
    expect(wordIndexAt("Another one here.", 8)).toBe(1);
    expect(wordIndexAt("Another one here.", 12)).toBe(2);
  });
  it("measures progress through the whole lesson by spoken length", () => {
    const chunks = speakable([{ kind: "prose", body: "Abcd. Efgh." }, { kind: "prose", body: "Ijkl." }]);
    expect(progressOf(chunks, 0, 0)).toBe(0);
    expect(progressOf(chunks, 0, 1)).toBeCloseTo(1 / 3);
    expect(progressOf(chunks, 1, 0)).toBeCloseTo(2 / 3);
    expect(progressOf(chunks, 1, 1)).toBe(1);
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
