#!/usr/bin/env node
/**
 * OCTA — put the syllabus's own objectives back into an authored chapter.
 *
 * WHY THIS EXISTS. `gen-stages.mjs` writes each stage's front matter straight
 * from the DOCX, verbatim. Authoring a chapter means replacing the scaffold
 * body -- and it is very easy to retype the front matter while you are there,
 * which is how chapter 3 came to have **7 paraphrased objectives where the
 * syllabus has 11**. Four outcomes the course is accountable for had quietly
 * stopped existing.
 *
 * The objectives are the syllabus's contract, not the author's prose. They are
 * transcribed, never reworded, and this script is what makes that recoverable
 * rather than a thing to be careful about.
 *
 *   node scripts/sync-objectives.mjs           check every chapter, exit 1 on drift
 *   node scripts/sync-objectives.mjs --fix     rewrite front matter from the syllabus
 *
 * The BODY is never touched. Only the block between the two `---` markers.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

/** Bloom from the leading verb — the same table `gen-stages.mjs` uses. */
const BLOOM = {
  remember: ["Define", "List", "Identify", "Name", "State", "Enumerate", "Outline", "Recall"],
  understand: ["Discuss", "Explain", "Describe", "Differentiate", "Distinguish", "Illustrate",
               "Summarize", "Understand", "Elaborate", "Present", "Provide", "Interpret"],
  apply: ["Compute", "Draw", "Apply", "Demonstrate", "Determine", "Examine", "Solve", "Use"],
  analyze: ["Compare", "Analyze", "Classify", "Design", "Evaluate", "Assess", "Justify"],
};
const COMPETENCY = { remember: "read", understand: "read", apply: "trace", analyze: "build" };

function bloomOf(outcome) {
  const verb = outcome.trim().split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "") ?? "";
  for (const [level, verbs] of Object.entries(BLOOM)) {
    if (verbs.some((v) => v.toLowerCase() === verb.toLowerCase())) return level;
  }
  return "understand";
}

function syllabusChapters() {
  const rows = JSON.parse(
    execFileSync("node", [resolve(ROOT, "scripts/extract-syllabus.mjs"), "--json"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }),
  );
  const chapters = [];
  let cur = null;
  for (const r of rows) {
    const hasTime = /^\d+\s*hrs?$/.test(r.time.trim());
    const title = r.topics[0] ?? "";
    if (hasTime && title && !/Orientation/.test(title)) {
      cur = { outcomes: [...r.outcomes] };
      chapters.push(cur);
    } else if (cur) {
      cur.outcomes.push(...r.outcomes);
    }
  }
  return chapters;
}

const chapters = syllabusChapters();
if (chapters.length !== 18) {
  console.error(`Expected 18 chapters, got ${chapters.length}. Refusing to guess.`);
  process.exit(1);
}

const fix = process.argv.includes("--fix");
const problems = [];
let total = 0;

console.log(c.bold("\nOCTA — stage objectives vs the syllabus\n"));

chapters.forEach((ch, i) => {
  const n = i + 1;
  const id = String(n).padStart(2, "0");
  const file = resolve(ROOT, `content/stages/${id}.md`);
  const text = readFileSync(file, "utf8");

  const end = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---") || end < 0) {
    problems.push(`${id}.md has no front matter`);
    return;
  }
  const head = text.slice(4, end);
  // `end` points at the newline BEFORE the closing `---`, so the body begins
  // five characters later. Getting this off by one joined the closing marker
  // to the first block: `---<!-- block: brief -->` on a single line.
  const body = text.slice(end + 5);

  // What the file currently claims.
  const have = [...head.matchAll(/^    description: (.+)$/gm)].map((m) => m[1].trim());
  const want = ch.outcomes.map((o) => o.replace(/\s+/g, " ").replace(/"/g, "'").trim());
  total += want.length;

  const same =
    have.length === want.length && have.every((h, k) => h === want[k]);

  if (same) {
    console.log(c.dim(`  ok    ${id}  ${want.length} objective(s)`));
    return;
  }

  const missing = want.filter((w) => !have.includes(w));
  problems.push(
    `${id}.md has ${have.length} objective(s), the syllabus has ${want.length}` +
      (missing.length ? ` — ${missing.length} not present verbatim` : " — wording differs"),
  );
  console.log(c.red(`  DRIFT ${id}  file ${have.length}, syllabus ${want.length}`));
  for (const m of missing.slice(0, 4)) console.log(c.dim(`          missing: ${m}`));

  if (!fix) return;

  // Rebuild ONLY the objectives block; keep every other front-matter key.
  const keep = head
    .split("\n")
    .filter((l) => l.trim() && !/^\s{2,}/.test(l) && !/^objectives:/.test(l))
    .join("\n");

  const rebuilt = [
    "---",
    keep,
    "objectives:",
    ...want.flatMap((d, k) => {
      const bloom = bloomOf(d);
      const levels = /levels:\s*\[([^\]]*)\]/.exec(head)?.[1] ?? "6";
      const level = levels.split(",").map((x) => x.trim()).filter(Boolean).pop() ?? "6";
      return [
        `  - id: "${id}.${k + 1}"`,
        `    bloom: ${bloom}`,
        `    level: ${level}`,
        `    competency: ${COMPETENCY[bloom]}`,
        `    description: ${d}`,
      ];
    }),
    "---",
  ].join("\n");

  writeFileSync(file, `${rebuilt}\n${body}`, "utf8");
  console.log(c.green(`          fixed — ${want.length} objective(s) restored verbatim`));
});

console.log("");
if (problems.length === 0) {
  console.log(c.green(`  Every chapter matches the syllabus. ${total} objectives.\n`));
  process.exit(0);
}

if (fix) {
  console.log(c.green(`  Rewrote ${problems.length} chapter(s) from the syllabus.\n`));
  process.exit(0);
}

console.log(c.red(`  ${problems.length} chapter(s) drifted from the syllabus:\n`));
for (const p of problems) console.log(`    ${c.red("·")} ${p}`);
console.log(
  c.dim(
    "\n  Objectives are transcribed, never reworded — they are what the course is\n" +
      "  accountable for. Run with --fix to restore them.\n",
  ),
);
process.exit(1);
