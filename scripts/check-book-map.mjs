#!/usr/bin/env node
/**
 * OCTA — prove `content/book-map.json` matches the book that is actually here.
 *
 * The syllabus is written against Stallings 9th ed. The available copy is the
 * 10th, which splits chapter 1 in two, inserts Number Systems and Digital Logic
 * as chapters 9 and 11, and moves the control-unit chapters to the end. **Ten of
 * eighteen syllabus chapters carry a different number in the book.**
 *
 * That is the kind of fact that is right the day it is written down and wrong
 * six months later when someone swaps the PDF for a different edition. So it is
 * checked rather than trusted:
 *
 *   1. every mapped book chapter exists in the extracted manifest
 *   2. its TITLE still plausibly matches what the map says it covers
 *   3. every syllabus chapter 1..18 is mapped exactly once
 *   4. any chapter mapped to `null` is DECLARED as having no book coverage,
 *      rather than having been forgotten
 *
 * Check 2 is the one that catches an edition swap. If someone drops the 9th ed
 * in, `book: 20` will resolve to a chapter that is not Control Unit Operation,
 * and this fails loudly instead of every stage-15 lesson quietly citing the
 * wrong chapter at a student holding the book.
 *
 * Skips cleanly when the book has not been extracted — it is gitignored, so a
 * fresh clone has no copy. Says so rather than passing silently.
 *
 * Run: node scripts/check-book-map.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAP = resolve(ROOT, "content", "book-map.json");
const MANIFEST = resolve(ROOT, "docs", "source", "book", "manifest.json");

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/** Words that must appear in the book chapter's title for the map to hold. */
const TITLE_KEYS = {
  1: ["basic", "evolution"],
  2: ["performance"],
  3: ["top-level", "interconnection"],
  4: ["cache"],
  5: ["internal", "memory"],
  6: ["external", "memory"],
  9: ["number"],
  10: ["arithmetic"],
  12: ["instruction sets", "characteristics"],
  13: ["addressing modes"],
  14: ["processor structure"],
  15: ["reduced instruction"],
  16: ["superscalar"],
  17: ["parallel processing"],
  18: ["multicore"],
  20: ["control unit"],
  21: ["microprogrammed"],
};

const map = JSON.parse(readFileSync(MAP, "utf8"));

console.log(c.bold("\nOCTA — syllabus ↔ textbook chapter map\n"));
console.log(
  c.dim(
    `  ${map.edition.author}, ${map.edition.edition} ed. ` +
      `(syllabus prescribes the ${map.edition.syllabusPrescribes})`,
  ),
);

if (!existsSync(MANIFEST)) {
  console.log(
    c.yellow(
      "\n  The book has not been extracted, so the map cannot be checked against it.\n" +
        "  It is gitignored (copyrighted), so this is normal on a fresh clone.\n" +
        "  Run `pnpm book:extract` with your own copy to enable this check.\n",
    ),
  );
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const byNumber = new Map(manifest.map((m) => [m.n, m]));
const findings = [];
let renumbered = 0;

/* 3 — every syllabus chapter mapped exactly once */
const seen = new Set();
for (const ch of map.chapters) {
  if (seen.has(ch.syllabus)) findings.push(`syllabus chapter ${ch.syllabus} is mapped twice`);
  seen.add(ch.syllabus);
}
for (let n = 1; n <= 18; n++) {
  if (!seen.has(n)) findings.push(`syllabus chapter ${n} is not mapped at all`);
}

for (const ch of map.chapters) {
  /* 4 — an unmapped chapter must SAY it has no coverage */
  if (ch.book === null) {
    if (!ch.note || !/not in the book/i.test(ch.note)) {
      findings.push(
        `syllabus ${ch.syllabus} maps to null without declaring why — ` +
          "an unmapped chapter must say it has no book coverage, not just omit one",
      );
    }
    console.log(
      `  ${c.yellow("none")}  syllabus ${String(ch.syllabus).padStart(2)} ` +
        `${ch.title.slice(0, 40).padEnd(40)} ${c.dim("no coverage in either edition")}`,
    );
    continue;
  }

  const all = [ch.book, ...(ch.also ?? [])];
  for (const b of all) {
    /* 1 — the chapter exists */
    if (!byNumber.has(b)) {
      findings.push(`syllabus ${ch.syllabus} maps to book chapter ${b}, which is not in the book`);
      continue;
    }
    /* 2 — its title still means what the map assumes */
    const actual = byNumber.get(b).title.toLowerCase();
    const keys = TITLE_KEYS[b];
    if (keys && !keys.some((k) => actual.includes(k))) {
      findings.push(
        `book chapter ${b} is "${byNumber.get(b).title}" — expected something matching ` +
          `[${keys.join(", ")}]. Has the edition changed?`,
      );
    }
  }

  if (ch.book !== ch.syllabus) renumbered++;
  const alsoTxt = ch.also?.length ? ` + ch${ch.also.join(", ch")}` : "";
  console.log(
    `  ${ch.book === ch.syllabus ? c.dim("same") : c.yellow("moved")}  ` +
      `syllabus ${String(ch.syllabus).padStart(2)} ${ch.title.slice(0, 40).padEnd(40)} ` +
      `→ book ch${ch.book}${alsoTxt}`,
  );
}

console.log(
  c.dim(
    `\n  ${renumbered} of ${map.chapters.length} chapters carry a different number in this edition.`,
  ),
);

if (findings.length === 0) {
  console.log(c.green("\n  Map is consistent with the extracted book.\n"));
  process.exit(0);
}

console.log(c.red(`\n  ${findings.length} problem(s):\n`));
for (const f of findings) console.log(`    ${c.red("·")} ${f}`);
console.log(c.dim("\n  Fix content/book-map.json, or re-extract with the right edition.\n"));
process.exit(1);
