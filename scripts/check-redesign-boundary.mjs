#!/usr/bin/env node
/**
 * OCTA -- the solar-system redesign's scope boundary, as a check rather than a
 * promise.
 *
 *   node scripts/check-redesign-boundary.mjs
 *
 * WHY THIS EXISTS. `docs/redesign/REDESIGN-CLAUDE.md` §1 states a boundary the
 * redesign must not cross, and R0.2 asks for it to be "technically enforceable,
 * not just written down." A grep pasted into a progress file is a snapshot; it
 * is true on the day it is written and says nothing afterwards. This runs.
 *
 * All three checks PASS as of R0, against the repo before any solar-system code
 * exists. That is the point -- a failure later is attributable to this track
 * specifically, not inherited from something that was already broken.
 *
 * These are cheap textual checks, not a type-level proof. They catch the
 * accident (someone reaches for the convenient import) rather than the
 * determined workaround, which is the realistic failure mode across a
 * six-session redesign where the boundary erodes by momentum.
 */

import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** Every source file under `dir`, skipping the usual noise. */
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(full)) out.push(full);
  }
  return out;
}

/** Strip comments so a rule stated in prose does not read as a violation. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const failures = [];
const notes = [];

/* --------------------------------------------------------------------------
 * 1. The exam seed never leaves services/api.
 *
 * `services/api/src/engine/seed.ts` builds sha256(studentId | stageId |
 * attemptNo | examSalt) and embeds EXAM_SALT_SECRET. The hash construction is
 * public -- it is written out in SOLAR-SYSTEM-SPEC.md §3 -- so any value
 * derived from it and computed in a browser is a bruteforce oracle against the
 * salt. Cosmetics derive from `student_id` ALONE, behind their own endpoint.
 * ----------------------------------------------------------------------- */
{
  const offenders = [];

  // Importing the seed module, or calling its builder, is out of bounds
  // anywhere outside services/api -- including shared packages.
  const DERIVES = /from\s+["'][^"']*engine\/seed|\bmakeAttemptSeed\b|\bderiveSeed\b/;

  // Reading the salt's VALUE is out of bounds in a client bundle. Naming it is
  // not: `packages/contracts` lists EXAM_SALT_SECRET in ServerEnv and in
  // SERVER_ONLY_SECRETS, which is the deny-list `pnpm check:env` enforces --
  // that mention is the guard against this exact leak, so matching on the bare
  // string here would fail the file that prevents the problem. Match an actual
  // env read instead.
  const READS_SALT = /(import\.meta\.env|process\.env)[^;\n]{0,30}EXAM_SALT/;

  for (const dir of ["apps/web/src", "apps/console/src", "packages"]) {
    for (const file of walk(resolve(ROOT, dir))) {
      const src = code(readFileSync(file, "utf8"));
      const inApp = dir.startsWith("apps/");
      if (DERIVES.test(src) || (inApp && READS_SALT.test(src))) {
        offenders.push(relative(ROOT, file).split(sep).join("/"));
      }
    }
  }
  if (offenders.length) {
    failures.push({
      name: "exam seed reached a client bundle or a shared package",
      detail: offenders,
      why: "Vite inlines these at build time. Deriving anything from the attempt seed client-side ships a value computed from EXAM_SALT_SECRET.",
    });
  } else {
    notes.push("exam-attempt seed stays inside services/api");
  }
}

/* --------------------------------------------------------------------------
 * 2. The client renders a lock, it never computes one (hard rule 4, INV-34).
 *
 * The server sends a resolved `state` per node, from is_stage_unlocked().
 * Comparing a mastery number against a threshold in the browser is the
 * regression this guards -- it looks harmless and it silently forks the
 * curriculum away from the database.
 * ----------------------------------------------------------------------- */
{
  const offenders = [];
  // A mastery value compared against a numeric threshold, in client code.
  const CLIENT_LOCK = /\bmastery\b[^;\n]{0,40}(>=|>|<=|<)\s*0?\.\d+|(>=|>|<=|<)\s*0?\.\d+[^;\n]{0,40}\bmastery\b/;
  for (const dir of ["apps/web/src", "apps/console/src"]) {
    for (const file of walk(resolve(ROOT, dir))) {
      const src = code(readFileSync(file, "utf8"));
      if (CLIENT_LOCK.test(src)) offenders.push(relative(ROOT, file).split(sep).join("/"));
    }
  }
  if (offenders.length) {
    failures.push({
      name: "a lock or mastery threshold is being computed client-side",
      detail: offenders,
      why: "CLAUDE.md hard rule 4 and SKILL-TREE-3D.md INV-34. Call is_stage_unlocked(); render its answer.",
    });
  } else {
    notes.push("no client-side lock or mastery threshold comparison");
  }
}

/* --------------------------------------------------------------------------
 * 3. The redesign is a presentation change. It does not edit the schema.
 *
 * Not a code check -- a reminder with teeth. If db/schema.sql moves during this
 * track, that is a boundary crossing that must be argued for explicitly
 * (REDESIGN-CLAUDE.md §1), not slipped in while building a map. The hash is
 * recorded at R0 so a later session can tell.
 * ----------------------------------------------------------------------- */
{
  const { createHash } = await import("node:crypto");
  const schema = readFileSync(resolve(ROOT, "db/schema.sql"));
  const hash = createHash("sha256").update(schema).digest("hex").slice(0, 16);
  const R0_HASH = process.env.OCTA_R0_SCHEMA_HASH ?? "";
  if (R0_HASH && R0_HASH !== hash) {
    failures.push({
      name: "db/schema.sql changed during the redesign track",
      detail: [`R0 recorded ${R0_HASH}, now ${hash}`],
      why: "The schema is outside this redesign's scope. If the change is genuinely needed, say so out loud and record why -- do not let it land silently.",
    });
  } else {
    notes.push(`db/schema.sql fingerprint ${hash}`);
  }
}

/* ---------------------------------- report ------------------------------- */
console.log(c.bold("\nOCTA -- redesign scope boundary\n"));
for (const n of notes) console.log(`  ${c.green("ok")}  ${c.dim(n)}`);
for (const f of failures) {
  console.log(`\n  ${c.red("FAIL")}  ${c.bold(f.name)}`);
  for (const d of f.detail) console.log(`        ${d}`);
  console.log(`        ${c.yellow(f.why)}`);
}
console.log(
  failures.length
    ? c.red(`\n  ${failures.length} boundary violation(s).\n`)
    : c.green("\n  Boundary holds.\n"),
);
process.exit(failures.length ? 1 : 0);
