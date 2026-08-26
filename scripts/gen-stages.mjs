#!/usr/bin/env node
// OCTA -- generate the stage seed and the content scaffolds from the syllabus.
//
// Everything here is DERIVED from `CPE 412.docx.docx`, never invented. The
// unit outcomes and topic outlines are transcribed from the DOCX table cells;
// only three things are assigned by this script, and each is a mapping rule
// stated in code rather than a judgement hidden in prose:
//
//   archetype   what the chapter asks a student to DO (see ARCHETYPE below)
//   levels      which Computer Level Hierarchy strata the chapter touches
//   bloom       derived from the outcome's leading VERB
//
// Prose is NOT generated. Hard rule 5 forbids inventing course content, and the
// syllabus is a topic list, not teaching material. Each stage file carries its
// objectives and its topic outline, and the prose blocks are left for authoring
// from the cited open references in docs/CPE412-CURRICULUM.md 4.
//
//   node scripts/gen-stages.mjs           write content/stages/*.md
//   node scripts/gen-stages.mjs --seed    print the SQL seed rows

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Syllabus chapter -> BOOK chapter.
 *
 * These differ for ten of eighteen chapters, because the syllabus is written
 * against Stallings 9th ed and the available copy is the 10th. Citing the
 * syllabus number would send a student to a real chapter about the wrong
 * subject -- syllabus 15 is Control Unit Operation, book 15 is RISC.
 */
const BOOK_MAP = JSON.parse(readFileSync(resolve(ROOT, "content/book-map.json"), "utf8"));
const bookCite = (syllabusN) => {
  const m = BOOK_MAP.chapters.find((c) => c.syllabus === syllabusN);
  if (!m || m.book === null) return null;
  const also = m.also?.length ? ` and ch. ${m.also.join(", ch. ")}` : "";
  const secs = m.sections?.length ? ` §${m.sections.join(", §")}` : "";
  return `chapter ${m.book}${secs}${also}`;
};

/**
 * Per-chapter assignments. `n` is the syllabus chapter number.
 *
 * archetype  A concept / B computation / C artifact / D simulator
 * levels     Computer Level Hierarchy strata, 0 (gates) .. 6 (user)
 * minutes    PLATFORM time, not the syllabus's contact hours
 */
const ASSIGN = [
  { n: 1,  archetype: "A", levels: [0,1,2,3,4,5,6], minutes: 40, why: "org-vs-architecture is ABOUT the hierarchy, not in it" },
  { n: 2,  archetype: "B", levels: [6, 2],          minutes: 75, why: "CPI, MIPS, MFLOPS, Amdahl, Little -- all computation" },
  { n: 3,  archetype: "D", levels: [2, 1],          minutes: 70, why: "the instruction cycle is behaviour over time" },
  { n: 4,  archetype: "B", levels: [3, 2],          minutes: 80, why: "addresses, size, mapping, hit ratio, AMAT" },
  { n: 5,  archetype: "C", levels: [1, 0],          minutes: 60, why: "read a DRAM datasheet; encode ECC by hand" },
  { n: 6,  archetype: "C", levels: [3],             minutes: 55, why: "choose a RAID level against a real spec" },
  { n: 7,  archetype: "D", levels: [3, 1],          minutes: 70, why: "programmed vs interrupt vs DMA, traced" },
  { n: 8,  archetype: "D", levels: [3],             minutes: 70, why: "scheduling and paging are simulations" },
  { n: 9,  archetype: "B", levels: [2, 0],          minutes: 90, why: "two's complement and IEEE-754, the heaviest drill" },
  { n: 10, archetype: "C", levels: [2],             minutes: 60, why: "read and categorise real x86 listings" },
  { n: 11, archetype: "D", levels: [2],             minutes: 65, why: "encode an instruction field by field" },
  { n: 12, archetype: "D", levels: [1],             minutes: 80, why: "pipeline hazards are a space-time diagram" },
  { n: 13, archetype: "A", levels: [2, 1],          minutes: 60, why: "RISC vs CISC is a controversy, not a calculation" },
  { n: 14, archetype: "D", levels: [1],             minutes: 70, why: "dependency graphs and reordering" },
  { n: 15, archetype: "D", levels: [1],             minutes: 75, why: "micro-operations, cycle by cycle" },
  { n: 16, archetype: "D", levels: [1],             minutes: 65, why: "write microcode and run it" },
  { n: 17, archetype: "B", levels: [1, 0],          minutes: 60, why: "speedup and scaling -- Amdahl again, deliberately" },
  { n: 18, archetype: "A", levels: [6, 3],          minutes: 60, why: "architectures and standards, argued" },
];

/** Bloom from the leading verb. The syllabus writes outcomes verb-first. */
const BLOOM = {
  remember: ["Define","List","Identify","Name","State","Enumerate","Outline","Recall"],
  understand: ["Discuss","Explain","Describe","Differentiate","Distinguish","Illustrate",
               "Summarize","Understand","Elaborate","Present","Provide","Interpret"],
  apply: ["Compute","Draw","Apply","Demonstrate","Determine","Examine","Solve","Use"],
  analyze: ["Compare","Analyze","Classify","Design","Evaluate","Assess","Justify"],
};

/** What the student physically does. read < trace < build. */
const COMPETENCY = { remember: "read", understand: "read", apply: "trace", analyze: "build" };

function bloomOf(outcome) {
  const verb = outcome.trim().split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "") ?? "";
  for (const [level, verbs] of Object.entries(BLOOM)) {
    if (verbs.some((v) => v.toLowerCase() === verb.toLowerCase())) return level;
  }
  return "understand";
}

function extractChapters() {
  const raw = execFileSync("node", [resolve(ROOT, "scripts/extract-syllabus.mjs"), "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const rows = JSON.parse(raw);

  const chapters = [];
  let cur = null;
  for (const r of rows) {
    const hasTime = /^\d+\s*hrs?$/.test(r.time.trim());
    const title = r.topics[0] ?? "";
    const isChapter =
      hasTime && title && !/Orientation/.test(title) && !/^Topics/.test(title);
    if (isChapter) {
      cur = {
        rawTitle: title,
        time: r.time.trim(),
        cilo: r.cilo,
        outcomes: [...r.outcomes],
        topics: r.topics.slice(1),
      };
      chapters.push(cur);
    } else if (cur) {
      cur.outcomes.push(...r.outcomes);
      cur.topics.push(...r.topics);
    }
  }
  return chapters;
}

/** Strip a leading "12. " and normalise the one typo in the source. */
const cleanTitle = (t) =>
  t.replace(/^\d+\.\s*/, "").replace(/^Instructions Sets:/, "Instruction Sets:").trim();

/** Short title for the map, where 40 characters is already generous. */
function shortTitle(t) {
  const map = {
    "Top Level View of Computer Function and Interconnection": "Top Level View and Interconnection",
    "Instruction Sets: Characteristics and Function": "Instruction Sets: Characteristics",
    "Instruction Sets: Addressing Modes and Format": "Instruction Sets: Addressing and Formats",
    "Instruction Level Parallelism and Superscalar Parallelism": "Instruction Level Parallelism",
    "Multicore Computer": "Multicore Computers",
  };
  return map[t] ?? t;
}

const chapters = extractChapters();
if (chapters.length !== 18) {
  console.error(`Expected 18 chapters, extracted ${chapters.length}. Refusing to guess.`);
  process.exit(1);
}

/** ACT == GRADING PERIOD. 18 chapters over four periods: 5 / 4 / 4 / 5. */
const actOf = (n) => (n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4);

if (process.argv.includes("--seed")) {
  const rows = [
    ` ('00',1, 0,'Orientation',${" ".repeat(41)}20, '{}',      true, false, 'A', '{6}'),`,
  ];
  chapters.forEach((ch, i) => {
    const n = i + 1;
    const a = ASSIGN[i];
    const id = String(n).padStart(2, "0");
    const prev = String(n - 1).padStart(2, "0");
    const title = shortTitle(cleanTitle(ch.rawTitle));
    rows.push(
      ` ('${id}',${actOf(n)},${String(n).padStart(2)},'${title}',${" ".repeat(Math.max(1, 44 - title.length))}${a.minutes}, '{${prev}}',    true, true,  '${a.archetype}', '{${a.levels.join(",")}}')${n === 18 ? ";" : ","}`,
    );
  });
  console.log(rows.join("\n"));
  process.exit(0);
}

// ---------- write the content scaffolds ----------
mkdirSync(resolve(ROOT, "content/stages"), { recursive: true });

const FORCE = process.argv.includes("--force");
const skipped = [];

/**
 * NEVER overwrite an authored chapter.
 *
 * A scaffold announces itself: `gen-stages` writes a callout carrying
 * `kind="scaffold"`, and authoring a chapter means replacing it. So a file
 * WITHOUT that marker is somebody's writing, and regenerating would destroy it
 * silently -- the worst possible failure here, because the syllabus extraction
 * would still succeed and the run would report a cheerful "wrote 19 files".
 *
 * `--force` overrides, for when the syllabus itself changes and every chapter
 * genuinely has to be re-derived.
 */
function isAuthored(file) {
  if (!existsSync(file)) return false;
  return !readFileSync(file, "utf8").includes('kind="scaffold"');
}

const orientation = `---
stage: "00"
title: Orientation
archetype: A
levels: [6]
gradeable: false
objectives: []
---

<!-- block: prose -->
CPE 412 — Computer Architecture and Organization.

Eighteen chapters across four grading periods, from what separates organization
from architecture to how a distributed system is put together.

This stage is orientation. Nothing here is graded.

<!-- block: callout -->
**How stages work.** Each chapter opens when the one before it reaches 70%.
A locked chapter always tells you why and how far off you are. Your instructor
can open any chapter for you at any time.

<!-- block: prose -->
The strip along the top is the **Register Bar**. It idles for now.

The gauge down the left edge is not a progress bar and is not counting points.
What it measures is named later in the course.

The map is the course. Every connection on it is a real prerequisite.
`;

writeFileSync(resolve(ROOT, "content/stages/00.md"), orientation, "utf8");

let objectiveCount = 0;
chapters.forEach((ch, i) => {
  const n = i + 1;
  const a = ASSIGN[i];
  const id = String(n).padStart(2, "0");
  const title = shortTitle(cleanTitle(ch.rawTitle));

  const objectives = ch.outcomes.map((o, k) => {
    const bloom = bloomOf(o);
    return {
      id: `${id}.${k + 1}`,
      bloom,
      level: a.levels[a.levels.length - 1],
      competency: COMPETENCY[bloom],
      description: o.replace(/\s+/g, " ").replace(/"/g, "'").trim(),
    };
  });
  objectiveCount += objectives.length;

  const fm = [
    "---",
    `stage: "${id}"`,
    `title: ${title}`,
    `archetype: ${a.archetype}`,
    `levels: [${a.levels.join(", ")}]`,
    "objectives:",
    ...objectives.flatMap((o) => [
      `  - id: "${o.id}"`,
      `    bloom: ${o.bloom}`,
      `    level: ${o.level}`,
      `    competency: ${o.competency}`,
      `    description: ${o.description}`,
    ]),
    "---",
    "",
  ].join("\n");

  const topics = ch.topics.filter((t) => t && t.length > 1);

  const body = [
    "<!-- block: brief -->",
    `Chapter ${n} of the syllabus. ${ch.time} of contact time; archetype ` +
      `${a.archetype} because ${a.why}.`,
    "",
    '<!-- block: callout kind="scaffold" -->',
    "**This chapter has no lesson prose yet.**",
    "",
    "The objectives above and the topic outline below are transcribed from the",
    "course syllabus. The teaching text is authored from the references listed",
    "at the end of this file, and until it exists this stage shows its shape",
    "rather than pretending to content it does not have.",
    "",
    "<!-- block: prose -->",
    "**Topic outline**, from the syllabus:",
    "",
    ...topics.map((t) => `- ${t}`),
    "",
    "<!-- block: callout -->",
    "**References for this chapter.**",
    ...(bookCite(n)
      ? [
          "Primary: Stallings, *Computer Organization and Architecture: Designing",
          `for Performance*, **10th ed.**, ${bookCite(n)}.`,
          "",
          "Your syllabus is written against the 9th edition, where this material",
          `carries a different number for ten of the eighteen chapters. See`,
          "`content/book-map.json`.",
        ]
      : [
          "**Stallings does not cover this chapter, in either edition.** Its three",
          "open sources are listed in `docs/CPE412-CURRICULUM.md` §4.1 — they are",
          "not a convenience here, they are the only material this chapter has.",
        ]),
    "",
    "Additional per-chapter sources with author credits are in",
    "`docs/CPE412-CURRICULUM.md` §4.",
    "",
  ].join("\n");

  const target = resolve(ROOT, `content/stages/${id}.md`);
  if (!FORCE && isAuthored(target)) {
    skipped.push(id);
    return;
  }
  writeFileSync(target, fm + body, "utf8");
});

console.log(`\nWrote ${19 - skipped.length} stage file(s) of 19.`);
console.log(`${objectiveCount} objectives transcribed from the syllabus.`);
if (skipped.length > 0) {
  console.log(
    `\nSKIPPED ${skipped.length} authored chapter(s): ${skipped.join(", ")}\n` +
      `They hold real prose and were left alone. --force re-derives every chapter\n` +
      `from the syllabus, which DISCARDS that writing.`,
  );
}
console.log(`\nProse is never generated -- hard rule 5. See content/stages/README.md.\n`);
