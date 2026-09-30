import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLES, exampleAt, fields, GIVENS, sizeWords } from "../src/encounters/cache-tuner";

/**
 * Moon 04.5's Cache Tuner: every worked example it quotes is in the file it
 * cites (hard rule 5), and the arithmetic gives the fields the source states.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
// Folds whitespace, the book's "kB"/"KB" and the stage's markdown emphasis.
const fold = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const FILES = {
  book: fold(readFileSync(resolve(ROOT, "docs/source/book/ch-04.md"), "utf8")),
  stage: fold(readFileSync(resolve(ROOT, "content/stages/04.md"), "utf8")),
};

describe("Cache Tuner quotes its sources (hard rule 5)", () => {
  for (const e of EXAMPLES) {
    it(`${e.cite}: the quoted words are in ${e.file}`, () => {
      expect(FILES[e.file]).toContain(fold(e.quote));
    });
  }
  it("the givens are the book's Example 4.2", () => {
    expect(FILES.book).toContain(fold(GIVENS.text));
    expect(FILES.book).toContain("the cache can hold 64 kb");
    expect(FILES.book).toContain("in blocks of 4 bytes each");
  });
});

describe("Cache Tuner's arithmetic gives the sources' fields", () => {
  for (const e of EXAMPLES) {
    it(`${e.cite}: tag ${e.expect.tag}, index ${e.expect.index}, word ${e.expect.word}`, () => {
      const f = fields(e.cacheBytes, e.lineBytes, e.ways);
      expect({ tag: f.tag, index: f.index, word: f.word }).toEqual(e.expect);
      expect(f.tag + f.index + f.word).toBe(24);
    });
  }

  it("the book's direct example has 16K lines; its 2-way example 8K sets", () => {
    expect(fields(65536, 4, 1).lines).toBe(16384);
    expect(fields(65536, 4, 2).sets).toBe(8192);
    expect(fields(65536, 4, Infinity)).toMatchObject({ sets: 1, index: 0, indexName: null });
  });

  it("finds a sourced example only where the dials match one exactly", () => {
    expect(exampleAt(65536, 4, 1)?.cite).toMatch(/4\.2a/);
    expect(exampleAt(65536, 16, 4)?.file).toBe("stage");
    expect(exampleAt(65536, 8, 1)).toBeNull();
  });

  it("names sizes in words", () => {
    expect(sizeWords(65536)).toBe("64 KB");
    expect(sizeWords(1048576)).toBe("1 MB");
    expect(sizeWords(16)).toBe("16 B");
  });
});
