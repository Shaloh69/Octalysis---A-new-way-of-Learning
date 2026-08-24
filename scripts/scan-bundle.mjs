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

/** Names that must never survive into a browser bundle. */
const FORBIDDEN = [
  "SERVICE_ROLE",
  "service_role",
  "correct_value",
  "correct_spec",
  "exam_salt",
  "EXAM_SALT_SECRET",
  "assessment_secrets",
  "engine/solvers",
  "solver_ref",
  // The original sin, by name.
  "lessonData",
];

const BUNDLE_DIRS = ["apps/web/dist", "apps/console/dist"];
const SCANNABLE = new Set([".js", ".mjs", ".cjs", ".css", ".html", ".json", ".txt"]);

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

  const present = BUNDLE_DIRS.filter((d) => existsSync(resolve(ROOT, d)));
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

  for (const dir of present) {
    const abs = resolve(ROOT, dir);
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

      for (const token of FORBIDDEN) {
        if (text.includes(token)) {
          findings.push({ file, kind: "forbidden token", detail: token });
        }
      }
      for (const answer of live.values) {
        if (text.includes(answer)) {
          findings.push({ file, kind: "ANSWER KEY", detail: answer.slice(0, 60) });
        }
      }
    }
  }

  console.log(c.dim(`  ${scanned} file(s) scanned across ${present.length} bundle(s)\n`));

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
