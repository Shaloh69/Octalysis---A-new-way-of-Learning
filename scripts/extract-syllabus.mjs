#!/usr/bin/env node
// OCTA -- extract the CPE 412 teaching plan from the syllabus DOCX.
//
// WHY DOCX AND NOT THE PDF.
//
// The PDF is a landscape table. `pdftotext -layout` interleaves the columns, so
// a unit outcome comes out fused to an unrelated topic heading:
//
//     "Differentiate Computer Organization 1.2 Structure and Function"
//
// 93 fragments, none cleanly transcribable. Rendering the pages to images and
// reading them visually would work, but it is slower and a vision model can
// hallucinate table structure -- a documented weakness for exactly this task.
//
// The DOCX keeps table cells as discrete XML. Column 1 is the unit outcomes,
// column 2 is the topics, and each bullet is its own paragraph. No ambiguity,
// no reconstruction, no possibility of inventing content -- which matters,
// because hard rule 5 forbids exactly that.
//
//   node scripts/extract-syllabus.mjs            print the plan
//   node scripts/extract-syllabus.mjs --json     machine-readable
//
// Requires: python with `python-docx` (already installed for this repo).

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCX = resolve(ROOT, "docs", "source", "CPE 412.docx");
const SCRIPT = resolve(ROOT, "scripts", "extract_syllabus.py");


if (!existsSync(DOCX)) {
  console.error(`\nSyllabus DOCX not found at ${DOCX}\n`);
  process.exit(1);
}

const raw = execFileSync("python", [SCRIPT, DOCX], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
const rows = JSON.parse(raw);

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

console.log(c.bold("\nCPE 412 -- teaching plan, extracted from the DOCX\n"));
let n = 0;
for (const r of rows) {
  n++;
  const title = r.topics[0] ?? "(untitled)";
  console.log(c.green(`  [${String(n).padStart(2, "0")}] ${title}`) + c.dim(`   ${r.time}`));
  console.log(c.dim(`       CILO ${r.cilo || "-"}`));
  console.log(c.dim(`       ${r.outcomes.length} outcome(s), ${r.topics.length - 1} sub-topic(s)`));
}
console.log(
  c.dim(
    `\n  ${rows.length} plan rows, ` +
      `${rows.reduce((a, r) => a + r.outcomes.length, 0)} unit outcomes, ` +
      `${rows.reduce((a, r) => a + r.topics.length, 0)} topic lines\n`,
  ),
);
