#!/usr/bin/env node
// OCTA — reset the local database from scratch.
//
// Drops and recreates the `octa` database, then applies the SQL files in the
// order that is load-bearing:
//
//   local-bootstrap.sql   auth schema + the three roles (LOCAL ONLY)
//   schema.sql            tables, functions, RLS, grants, seed
//   addendum-feedback.sql feedback + sus_score()
//   addendum-submissions.sql labs/project/participation -- 40% of the grade
//   addendum-audit.sql    invariants + run_invariants()   <- calls sus_score()
//
// Then runs the invariant suite and reports. Exits non-zero if any FAIL-severity
// invariant has offending rows, so CI can gate on it.
//
// Usage: pnpm db:reset

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "octa-db";

const FILES = [
  "db/local-bootstrap.sql",
  "db/schema.sql",
  "db/addendum-feedback.sql",
  // BEFORE audit, and the order is load-bearing: run_invariants() registers
  // INV-31, whose function is defined in this file.
  "db/addendum-submissions.sql",
  "db/addendum-audit.sql",
  // Scheduled work. pg_cron and pg_net are guarded inside, so this applies
  // cleanly to plain Postgres -- the functions are created either way, only the
  // scheduling needs Supabase.
  "db/addendum-cron.sql",
];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function docker(args, opts = {}) {
  return exec("docker", args, { cwd: ROOT, maxBuffer: 32 * 1024 * 1024, ...opts });
}

/** Run SQL text inside the container as the postgres superuser. */
async function psql(db, sql, { quiet = false } = {}) {
  const args = [
    "compose", "exec", "-T",
    "-e", "PGPASSWORD=postgres",
    "db", "psql",
    "-U", "postgres",
    "-d", db,
    "-v", "ON_ERROR_STOP=1",
    "--no-psqlrc",
  ];
  if (quiet) args.push("-tA");
  args.push("-c", sql);
  return docker(args);
}

/** Pipe a local .sql file into psql inside the container. */
async function psqlFile(db, relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) throw new Error(`missing SQL file: ${relPath}`);

  // `docker compose exec -T` reads stdin, so we stream the file in rather than
  // copying it into the container.
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(abs, "utf8");

  return new Promise((res, rej) => {
    const child = execFile(
      "docker",
      [
        "compose", "exec", "-T",
        "-e", "PGPASSWORD=postgres",
        "db", "psql",
        "-U", "postgres",
        "-d", db,
        "-v", "ON_ERROR_STOP=1",
        "--no-psqlrc",
        "-f", "-",
      ],
      { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => (err ? rej(Object.assign(err, { stdout, stderr })) : res({ stdout, stderr })),
    );
    child.stdin.end(sql);
  });
}

async function waitForDb(attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      await docker(["compose", "exec", "-T", "db", "pg_isready", "-U", "postgres"]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Postgres did not become ready. Is Docker running? Try `pnpm db:up`.");
}

async function main() {
  console.log(c.bold("\nOCTA — database reset\n"));

  // 0. container up
  process.stdout.write("  starting container ... ");
  await docker(["compose", "up", "-d", "db"]);
  await waitForDb();
  console.log(c.green("ready"));

  // 1. drop + recreate. Connect to `postgres` so we can drop `octa`.
  process.stdout.write("  dropping database  ... ");
  await psql("postgres", "drop database if exists octa with (force);");
  await psql("postgres", "create database octa;");
  console.log(c.green("recreated"));

  // 2. apply, in order
  for (const f of FILES) {
    process.stdout.write(`  ${f.padEnd(30)} ... `);
    try {
      await psqlFile("octa", f);
      console.log(c.green("ok"));
    } catch (err) {
      console.log(c.red("FAILED"));
      console.error(c.red(`\n${err.stderr || err.message}\n`));
      process.exit(1);
    }
  }

  // 3. invariants
  console.log("\n  " + c.bold("invariants"));
  const { stdout } = await psql(
    "octa",
    `select id || '|' || severity || '|' || offending_count
       from run_invariants()
      where offending_count > 0
      order by severity desc, id;`,
    { quiet: true },
  );

  const rows = stdout.trim().split("\n").filter(Boolean).map((l) => {
    const [id, severity, count] = l.split("|");
    return { id, severity, count: Number(count) };
  });

  if (rows.length === 0) {
    console.log("    " + c.green("all clear"));
  } else {
    const EXPECTED = new Set(["INV-18", "INV-27", "INV-28", "INV-29"]);
    for (const r of rows) {
      const tag = EXPECTED.has(r.id)
        ? c.dim("note")
        : r.severity === "fail"
          ? c.red("FAIL")
          : c.yellow("warn");
      const note = EXPECTED.has(r.id) ? c.dim(" (expected on an unseeded database)") : "";
      console.log(`    ${tag}  ${r.id}  ${r.count} offending row(s)${note}`);
    }
  }

  const fails = rows.filter((r) => r.severity === "fail");

  // On a fresh database the bank-health checks legitimately have nothing to
  // check. Anything else failing is a real structural problem.
  const EXPECTED_EMPTY_DB = new Set(["INV-18", "INV-27", "INV-28", "INV-29"]);
  const real = fails.filter((r) => !EXPECTED_EMPTY_DB.has(r.id));

  console.log("");
  if (real.length > 0) {
    console.log(c.red(`  ${real.length} structural invariant(s) failing. That is a defect, not an empty database.`));
    process.exit(1);
  }
  console.log(c.green("  Database ready.") + c.dim("  postgres://postgres:postgres@localhost:15432/octa\n"));
}

main().catch((err) => {
  console.error(c.red(`\n${err.stack || err.message}\n`));
  if (err.stderr) console.error(err.stderr);
  process.exit(1);
});
