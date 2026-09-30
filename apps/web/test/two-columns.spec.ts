import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COLUMN_RULE, TWO_COLUMNS } from "../src/encounters/two-columns";

/**
 * Hard rule 5 for moon 01.2's Sort: every word a card shows, and every
 * sentence that places it, is in the file it cites. Whitespace and the
 * reading's markdown emphasis are folded; nothing else is.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fold = (s: string) => s.replace(/[*_`>]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const FILES = {
  book: fold(readFileSync(resolve(ROOT, "docs/source/book/ch-01.md"), "utf8")),
  stage: fold(readFileSync(resolve(ROOT, "content/stages/01.md"), "utf8")),
};

describe("Two Columns quotes its sources, word for word (hard rule 5)", () => {
  for (const card of TWO_COLUMNS) {
    it(`${card.id}: the card and the sentence that places it are in ${card.source.file}`, () => {
      const file = FILES[card.source.file];
      expect(file, `card text "${card.text}"`).toContain(fold(card.text));
      expect(file, `placing sentence for ${card.id}`).toContain(fold(card.why));
    });
  }

  it("the columns' own definitions are the book's", () => {
    for (const rule of Object.values(COLUMN_RULE)) expect(FILES.book).toContain(fold(rule.text));
  });

  it("the sort is balanced and every card is distinct", () => {
    const arch = TWO_COLUMNS.filter((c) => c.column === "architecture").length;
    expect(arch).toBe(TWO_COLUMNS.length - arch);
    expect(new Set(TWO_COLUMNS.map((c) => c.id)).size).toBe(TWO_COLUMNS.length);
    expect(new Set(TWO_COLUMNS.map((c) => c.text)).size).toBe(TWO_COLUMNS.length);
  });

  it("the placing sentence names the card's own column", () => {
    for (const c of TWO_COLUMNS) {
      const word = c.column === "architecture" ? /architectur/i : /organi[sz]ation/i;
      expect(c.why, c.id).toMatch(word);
    }
  });
});
