import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBlocks as consoleParse, parseInline as consoleInline } from "../src/lib/reader-markdown";
import { parseBlocks as readerParse, parseInline as readerInline } from "../../web/src/lib/markdown";

/**
 * The console's preview parses a chapter with a COPY of the student reader's
 * markdown (`src/lib/reader-markdown.ts`). This holds the copy to the original
 * over every block of every chapter and every drafted chapter, so the preview
 * a reviewer approves from is what a student will read. The last mirror
 * drifted for a week unnoticed (5 Oct 2026).
 */

const STAGES = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content", "stages");

function bodies(): Array<{ where: string; body: string }> {
  const out: Array<{ where: string; body: string }> = [];
  for (const f of readdirSync(STAGES).filter((n) => /^\d\d(\.draft)?\.md$/.test(n))) {
    const text = readFileSync(resolve(STAGES, f), "utf8").replace(/\r\n/g, "\n");
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, "");
    const parts = body.split(/<!-- block: [^>]*-->/).slice(1);
    parts.forEach((b, i) => out.push({ where: `${f} block ${i + 1}`, body: b.trim() }));
  }
  return out;
}

describe("the preview's markdown is the reader's", () => {
  const all = bodies();

  it("reads real chapters, drafts included, so nothing passes on nothing", () => {
    expect(all.length).toBeGreaterThan(200);
    expect(all.some((b) => b.where.includes(".draft.md"))).toBe(true);
  });

  it("every block parses to exactly what the student reader produces", () => {
    for (const b of all) expect(consoleParse(b.body), b.where).toEqual(readerParse(b.body));
  });

  it("inline rules agree on the hard cases: bold inside italics, snake_case, numbers, code", () => {
    for (const s of ["*a **b** c*", "stage_progress stays one word", "8.33 and 1,000 and x86-16 and 40%", "`**not bold**` here"]) {
      expect(consoleInline(s), s).toEqual(readerInline(s));
    }
  });
});
