#!/usr/bin/env node
/**
 * OCTA — backup, and the restore rehearsal that makes it real.
 *
 * `DELIVERY.md`: Supabase Free has **no backups**. The backup is one you own.
 * `PHASES.md` P10, a launch exit criterion: *"Restore-from-backup rehearsed
 * successfully."* And the line that matters most, from the same page:
 *
 *   > A backup you haven't restored is a guess, and that does not stop being
 *   > true because the vendor stopped supplying the backup.
 *
 * So this script does both halves, and the second half is not optional:
 *
 *   node scripts/backup.mjs              dump, then REHEARSE the restore
 *   node scripts/backup.mjs --dump-only  dump and stop (for a cron job)
 *   node scripts/backup.mjs --verify <f> rehearse an existing dump
 *
 * THE REHEARSAL IS THE POINT. It restores into a scratch database, then proves
 * the restored copy is usable rather than merely present:
 *
 *   1. every table that had rows still has them, and the counts match
 *   2. `run_invariants()` returns the SAME verdict as the source
 *   3. RLS is still ON for every table in `public`
 *   4. the append-only triggers on `responses` survived
 *   5. the answer key is still RLS-protected
 *
 * Check 2 compares rather than asserts health, and that distinction is the
 * whole point of the check. A restore is correct when the copy MATCHES THE
 * SOURCE — including its problems. Asserting "no failing invariants" instead
 * would fail this script whenever the source database happened to be mid-test
 * or mid-authoring, which trains everyone to ignore it, and it would also pass
 * a restore that silently *fixed* something, which would mean the dump was not
 * faithful.
 *
 * Check 3 exists because `pg_dump` without `--no-acl` is not the risk — the
 * risk is a restore into a database whose `ALTER DEFAULT PRIVILEGES` differ, which
 * is exactly how `db:push:reset` broke the live project once (V-31 in
 * VERIFICATION.md). A restore that produces a readable database with no RLS is
 * worse than no restore, because it looks like success.
 */

import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "db", "dumps"); // gitignored
const CONTAINER = process.env.OCTA_DB_CONTAINER ?? "octa-db";
const SOURCE_DB = process.env.OCTA_DB_NAME ?? "octa";
const SCRATCH_DB = "octa_restore_rehearsal";
const KEEP = 7; // daily dumps to retain locally

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

/** Run psql inside the container and return stdout. */
function psql(db, sql, { quiet = true } = {}) {
  return execFileSync(
    "docker",
    ["exec", "-e", "PGPASSWORD=postgres", CONTAINER, "psql", "-U", "postgres", "-d", db,
     ...(quiet ? ["-At"] : []), "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

/** Tables that carry real state, in the order a human would sanity-check them. */
const COUNTED = [
  "stages", "objectives", "content_blocks", "items", "blueprints", "assessments",
  "sections", "student_directory", "profiles", "attempts", "attempt_items",
  "responses", "stage_progress", "stage_locks", "audit_log", "feedback",
];

function counts(db) {
  const sql = COUNTED.map((t) => `select '${t}' as t, count(*)::int as n from ${t}`).join(" union all ");
  const out = psql(db, sql);
  const map = {};
  for (const line of out.trim().split("\n")) {
    if (!line) continue;
    const [t, n] = line.split("|");
    map[t] = Number(n);
  }
  return map;
}

function dump() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(OUT_DIR, `octa-${stamp}.sql`);

  console.log(c.dim(`  dumping ${SOURCE_DB} from container ${CONTAINER}…`));
  // Plain SQL, not custom format: it is greppable, diffable, and restorable with
  // psql alone. A backup that needs a matching pg_restore binary to read is a
  // backup with a dependency, and dependencies are what fail at 2am.
  execSync(
    `docker exec -e PGPASSWORD=postgres ${CONTAINER} pg_dump -U postgres ` +
      `--clean --if-exists --no-owner --no-privileges ${SOURCE_DB} > "${file}"`,
    { stdio: ["ignore", "ignore", "inherit"], shell: true },
  );

  const size = statSync(file).size;
  if (size < 1024) {
    console.error(c.red(`\n  Dump is ${size} bytes. That is not a backup.\n`));
    process.exit(1);
  }
  console.log(c.green(`  wrote ${file}  (${(size / 1024).toFixed(0)} KB)`));
  return file;
}

function prune() {
  const files = readdirSync(OUT_DIR)
    .filter((f) => f.startsWith("octa-") && f.endsWith(".sql"))
    .sort()
    .reverse();
  for (const f of files.slice(KEEP)) {
    unlinkSync(join(OUT_DIR, f));
    console.log(c.dim(`  pruned ${f}`));
  }
}

function rehearse(file) {
  console.log(c.bold("\n  Restore rehearsal\n"));

  const before = counts(SOURCE_DB);

  console.log(c.dim(`  recreating ${SCRATCH_DB}…`));
  psql("postgres", `drop database if exists ${SCRATCH_DB}`);
  psql("postgres", `create database ${SCRATCH_DB}`);

  // The dump has no roles in it (--no-owner --no-privileges), and a Supabase
  // restore lands in a database that already has them. Locally they must be
  // supplied, exactly as local-bootstrap.sql does for a fresh database.
  console.log(c.dim("  applying local role bootstrap…"));
  execSync(
    `docker exec -i -e PGPASSWORD=postgres ${CONTAINER} psql -U postgres -d ${SCRATCH_DB} ` +
      `-v ON_ERROR_STOP=1 --no-psqlrc < "${resolve(ROOT, "db", "local-bootstrap.sql")}"`,
    { stdio: ["ignore", "ignore", "pipe"], shell: true },
  );

  console.log(c.dim(`  restoring ${file}…`));
  try {
    execSync(
      `docker exec -i -e PGPASSWORD=postgres ${CONTAINER} psql -U postgres -d ${SCRATCH_DB} ` +
        `--no-psqlrc -q < "${file}"`,
      { stdio: ["ignore", "ignore", "pipe"], shell: true },
    );
  } catch (err) {
    console.error(c.red("\n  Restore FAILED.\n"));
    console.error(String(err.stderr ?? err).slice(0, 2000));
    process.exit(1);
  }

  const findings = [];

  /* 1 — row counts match */
  //
  // A TRUNCATED DUMP LANDS HERE, and it must land as a finding rather than as a
  // stack trace. psql restores what it can and exits 0, so a half-written dump
  // produces a database missing most of its tables; querying one then throws
  // `relation "stages" does not exist` from deep inside execFileSync. That read
  // as a crash, which is exactly the shape someone dismisses as "the backup
  // script is broken" rather than "the backup is broken".
  let after;
  try {
    after = counts(SCRATCH_DB);
  } catch (err) {
    const msg = String(err.stderr ?? err.message ?? err).split("\n")[0];
    console.log(`  ${c.red("FAIL")} row counts — ` + c.dim("the restored database is unusable"));
    console.log(c.dim(`       ${msg}`));
    return [`the restore did not produce a usable database: ${msg}`];
  }

  for (const t of COUNTED) {
    if (before[t] !== after[t]) {
      findings.push(`${t}: ${before[t]} rows before, ${after[t]} after`);
    }
  }
  const restoredRows = Object.values(after).reduce((a, b) => a + b, 0);
  console.log(
    `  ${findings.length === 0 ? c.green("OK  ") : c.red("FAIL")} row counts — ` +
      c.dim(`${restoredRows} rows across ${COUNTED.length} tables`),
  );

  /* 2 — invariants return the same verdict as the source */
  const invSql =
    "select id || '=' || offending_count from run_invariants() order by id";
  let invOk = false;
  let invLine = "";
  try {
    const src = psql(SOURCE_DB, invSql).trim();
    const dst = psql(SCRATCH_DB, invSql).trim();
    if (src !== dst) {
      const a = new Set(src.split("\n"));
      const b = new Set(dst.split("\n"));
      const diff = [...new Set([...a, ...b])].filter((x) => !a.has(x) || !b.has(x));
      findings.push(`invariants differ after restore: ${diff.join(", ")}`);
      invLine = `${diff.length} differ`;
    } else {
      invOk = true;
      const failing = src.split("\n").filter((l) => !l.endsWith("=0")).length;
      invLine =
        failing === 0
          ? "identical to source, all clean"
          : `identical to source (${failing} pre-existing, not a restore problem)`;
    }
  } catch {
    findings.push("run_invariants() is missing from the restored database");
    invLine = "function missing";
  }
  console.log(`  ${invOk ? c.green("OK  ") : c.red("FAIL")} invariants — ` + c.dim(invLine));

  /* 3 — RLS is still on for every table in public */
  const noRls = psql(
    SCRATCH_DB,
    `select coalesce(string_agg(tablename, ', '), '') from pg_tables
      where schemaname = 'public' and not rowsecurity`,
  ).trim();
  if (noRls) findings.push(`RLS is OFF after restore for: ${noRls}`);
  console.log(
    `  ${noRls ? c.red("FAIL") : c.green("OK  ")} RLS enabled on every public table` +
      (noRls ? c.red(` — ${noRls}`) : ""),
  );

  /* 4 — the append-only triggers survived */
  const trig = psql(
    SCRATCH_DB,
    `select count(*)::int from pg_trigger
      where tgrelid = 'responses'::regclass
        and tgname in ('responses_no_update','responses_no_delete')`,
  ).trim();
  if (Number(trig) !== 2) findings.push(`responses append-only triggers: expected 2, found ${trig}`);
  console.log(
    `  ${Number(trig) === 2 ? c.green("OK  ") : c.red("FAIL")} responses is still append-only — ` +
      c.dim(`${trig}/2 triggers`),
  );

  /* 5 — the answer key is still protected */
  const keyPolicies = psql(
    SCRATCH_DB,
    `select count(*)::int from pg_policies
      where schemaname = 'public' and tablename = 'attempt_items'`,
  ).trim();
  if (Number(keyPolicies) === 0) findings.push("attempt_items has no RLS policy after restore");
  console.log(
    `  ${Number(keyPolicies) > 0 ? c.green("OK  ") : c.red("FAIL")} attempt_items keeps its policies — ` +
      c.dim(`${keyPolicies} policy(ies)`),
  );

  return findings;
}

function main() {
  const args = process.argv.slice(2);
  console.log(c.bold("\nOCTA — backup\n"));

  // Fail loudly if the container is not up, rather than writing a 0-byte file.
  try {
    execFileSync("docker", ["inspect", CONTAINER], { stdio: "ignore" });
  } catch {
    console.error(c.red(`  Container "${CONTAINER}" is not running. \`pnpm db:up\` first.\n`));
    process.exit(1);
  }

  let file;
  const verifyIdx = args.indexOf("--verify");
  if (verifyIdx !== -1) {
    file = resolve(args[verifyIdx + 1] ?? "");
    if (!existsSync(file)) {
      console.error(c.red(`  No such dump: ${file}\n`));
      process.exit(1);
    }
  } else {
    file = dump();
    prune();
  }

  if (args.includes("--dump-only")) {
    console.log(
      c.yellow("\n  --dump-only: the restore was NOT rehearsed. This backup is unproven.\n"),
    );
    process.exit(0);
  }

  const findings = rehearse(file);

  console.log("");
  if (findings.length === 0) {
    console.log(c.green("  Restore rehearsed successfully. This backup is real.\n"));
    console.log(c.dim(`  Scratch copy left at ${SCRATCH_DB} for inspection; the next run drops it.\n`));
    process.exit(0);
  }

  console.log(c.red(`  ${findings.length} problem(s) with the restored copy:\n`));
  for (const f of findings) console.log(`    ${c.red("·")} ${f}`);
  console.log(
    c.dim("\n  A backup that restores into a broken database is not a backup.\n"),
  );
  process.exit(1);
}

main();
