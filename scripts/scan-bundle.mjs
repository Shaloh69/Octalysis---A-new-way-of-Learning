#!/usr/bin/env node
// OCTA — client bundle scan.
//
// This is the permanent guard against the bug the whole project exists to fix.
// The app OCTA replaces shipped src/data/lessonData.js with every answer in it,
// readable from devtools. A build that reintroduces that must fail, not ship.
//
// Three checks, in increasing order of how much they need a database:
//
//   1. FORBIDDEN TOKENS  -- service-role names, answer-key column names, and
//      engine internals must not appear in any client bundle. Static, always runs.
//   2. LIVE ANSWER KEYS  -- if the local database is reachable, pull every
//      distinct correct_value / correct_spec and grep the bundle for it.
//   3. SOURCEMAP LEAK    -- production bundles must not ship .map files that
//      would hand a reader the original module names.
//
// Wired as a PostToolUse hook on `pnpm build*` in .claude/settings.json, and
// runnable directly: `pnpm scan:bundle`.
//
// Exit 0 clean, exit 1 on any finding.

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/**
 * TWO BUNDLES, TWO RULES. Conflating them makes this scanner useless in both
 * directions, so the distinction is the most important thing in this file.
 *
 * `apps/web` is the STUDENT bundle. It must not contain the DATABASE column
 * names or the engine's internal shapes -- seeing either means something has
 * reached past `serialize/student.ts`. It MAY contain `correctValue`, because a
 * student legitimately receives one after submitting; see the note on
 * FORBIDDEN_STUDENT below for why that exception exists and what replaced it.
 *
 * `apps/console` is STAFF-ONLY and its whole purpose is showing the key: the
 * attempt drill-down renders `correctValue` beside what the student answered,
 * and `ai_after_submit` grants staff that read in the database too. Flagging it
 * there would be crying wolf, and a scanner that cries wolf gets switched off.
 *
 * What stays forbidden in BOTH: secrets, service-role names, and engine
 * internals. No browser needs the exam salt or the solver registry, whoever is
 * driving it.
 *
 * And the check that matters most runs against BOTH regardless of profile: a
 * live answer VALUE baked into any bundle is a leak, because a bundle is a
 * static file and a static file has no idea who is asking.
 */
const FORBIDDEN_ALWAYS = [
  "SERVICE_ROLE",
  "service_role",
  "exam_salt",
  "EXAM_SALT_SECRET",
  "assessment_secrets",
  "engine/solvers",
  "solver_ref",
  "examSalt",
  "solverRef",
  // The original sin, by name.
  "lessonData",
];

/**
 * Additionally forbidden in the STUDENT bundle only.
 *
 * `correctValue` IS NOT ON THIS LIST, and that is a deliberate correction.
 *
 * It used to be. The rule was written when the student app had no way to sit an
 * assessment, so any mention of the answer key in that bundle was, correctly, a
 * red flag. Building the attempt runner made the assumption false: a student
 * legitimately receives `correctValue` once they submit -- `ai_after_submit` in
 * db/schema.sql grants exactly that read, and `StudentVerdict` in
 * serialize/student.ts is the payload that carries it.
 *
 * So the FIELD NAME is now expected in the student bundle. What is not, and
 * never will be, is a live answer VALUE baked into a static file -- and that
 * check is untouched below, runs against both bundles, and is the one carrying
 * the weight. Keeping a name-based rule that the design had outgrown would have
 * meant either a permanently red gate or an engineer renaming a field to get
 * past it, and both are worse than checking the thing that actually matters.
 *
 * Everything still listed here is engine or authoring surface that no student
 * payload contains at any point in the lifecycle.
 */
const FORBIDDEN_STUDENT = [
  // The snake_case DB columns. The student app never speaks SQL, so seeing a
  // column name there means something is reaching past the serializer.
  "correct_value",
  "correct_spec",
  // camelCase engine internals. The planted `{"correctValue":"An assembler"}`
  // that found V-45 is now covered by the live-value check instead.
  "correctIndex",
  "correctSpec",
  "resolvedParams",
  "rationaleTemplate",
];

const BUNDLES = [
  { dir: "apps/web/dist", audience: "student", forbidden: [...FORBIDDEN_ALWAYS, ...FORBIDDEN_STUDENT] },
  { dir: "apps/console/dist", audience: "staff", forbidden: FORBIDDEN_ALWAYS },
];
const SCANNABLE = new Set([".js", ".mjs", ".cjs", ".css", ".html", ".json", ".txt"]);

/**
 * Whole-token match, not substring.
 *
 * A plain `includes()` is useless here: the answer "tera" matched inside
 * `iterate` in the three.js bundle, and "peta" matched a minified identifier.
 * Three false positives on a clean build, and a scanner that cries wolf gets
 * switched off -- which is worse than no scanner, because this one is the
 * permanent guard against the bug the whole project exists to fix.
 *
 * So: the value must appear bounded by something that is not an identifier
 * character. A real leak looks like `"An assembler"` or `,"tera",` in a JSON
 * blob or a string literal; both satisfy this. `iterate` does not.
 */
const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;

function matchesWholeToken(haystack, needle) {
  const escaped = needle.replace(RE_SPECIAL, "\\$&");
  // Node 20+ supports lookbehind, which keeps this exact and readable.
  const re = new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`);
  return re.test(haystack);
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

/** Pull every live answer value out of the local database, if it is reachable. */
async function liveAnswerStrings() {
  const conn = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa";
  let pg;
  try {
    ({ default: pg } = await import("pg"));
  } catch {
    return { available: false, values: [], reason: "pg not installed" };
  }

  const client = new pg.Client({ connectionString: conn, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    const { rows } = await client.query(`
      select distinct v from (
        select correct_value #>> '{value}' as v from attempt_items
        union all
        select correct_spec  #>> '{value}' as v from items
      ) t where v is not null and length(v) >= 4
    `);
    return { available: true, values: rows.map((r) => r.v), reason: null };
  } catch (err) {
    return { available: false, values: [], reason: err.message.split("\n")[0] };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  console.log(c.bold("\nOCTA — client bundle scan\n"));

  const present = BUNDLES.filter((b) => existsSync(resolve(ROOT, b.dir)));
  if (present.length === 0) {
    console.log(c.dim("  No client bundles found. Nothing to scan — build first.\n"));
    process.exit(0);
  }

  const findings = [];
  let scanned = 0;

  const live = await liveAnswerStrings();
  if (live.available) {
    console.log(c.dim(`  ${live.values.length} live answer value(s) pulled from the database`));
  } else {
    console.log(c.yellow(`  Database unreachable (${live.reason}) — running static checks only.`));
    console.log(c.yellow("  This is a WEAKER scan. Run it against a seeded database before release."));
  }

  for (const bundle of present) {
    const abs = resolve(ROOT, bundle.dir);
    for (const file of await walk(abs)) {
      const ext = extname(file);

      if (ext === ".map") {
        findings.push({ file, kind: "sourcemap", detail: "source map shipped in a production bundle" });
        continue;
      }
      if (!SCANNABLE.has(ext)) continue;

      const info = await stat(file);
      if (info.size > 25 * 1024 * 1024) continue;

      const text = await readFile(file, "utf8");
      scanned++;

      for (const token of bundle.forbidden) {
        if (text.includes(token)) {
          findings.push({
            file,
            kind: "forbidden token",
            detail: `${token}  (${bundle.audience} bundle)`,
          });
        }
      }
      for (const answer of live.values) {
        if (matchesWholeToken(text, answer)) {
          findings.push({ file, kind: "ANSWER KEY", detail: answer.slice(0, 60) });
        }
      }
    }
  }

  console.log(
    c.dim(
      `  ${scanned} file(s) scanned across ${present.length} bundle(s): ` +
        present.map((b) => `${b.dir} (${b.audience})`).join(", ") +
        "\n",
    ),
  );

  if (findings.length === 0) {
    console.log(c.green("  Clean. No answer keys, no server-only names, no source maps.\n"));
    process.exit(0);
  }

  console.log(c.red(`  ${findings.length} finding(s):\n`));
  for (const f of findings) {
    const rel = f.file.replace(ROOT, "").replace(/^[\\/]/, "");
    const tag = f.kind === "ANSWER KEY" ? c.red("ANSWER KEY") : c.yellow(f.kind);
    console.log(`    ${tag}  ${rel}`);
    console.log(`      ${c.dim(f.detail)}`);
  }
  console.log(
    c.red(
      "\n  This is the exact bug OCTA exists to fix. Do not ship this build.\n" +
        "  See docs/AUDITS.md §3.4 and hard rule 1.\n",
    ),
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(c.red(`\nbundle scan failed: ${err.stack || err.message}\n`));
  process.exit(1);
});
