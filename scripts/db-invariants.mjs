#!/usr/bin/env node
// OCTA -- run the invariant suite and report.
// Exits non-zero if any FAIL-severity invariant has offending rows, so CI and
// the pre-deploy step can gate on it.
//
// On a fresh, empty database the bank-health checks legitimately have nothing to
// check; those are listed in EXPECTED_EMPTY_DB and downgraded to notices.

import pg from "pg";

const conn = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa";
const EXPECTED_EMPTY_DB = new Set(["INV-18", "INV-27", "INV-28", "INV-29"]);

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const client = new pg.Client({ connectionString: conn, connectionTimeoutMillis: 5000 });

try {
  await client.connect();
} catch (err) {
  console.error(c.red(`\nCannot reach the database at ${conn}`));
  console.error(c.dim(`  ${err.message.split("\n")[0]}`));
  console.error(c.dim("  Is Docker Desktop running? Try: pnpm db:up\n"));
  process.exit(1);
}

const { rows } = await client.query(
  "select id, name, severity, offending_count, sample from run_invariants() order by id"
);
await client.end();

console.log(c.bold("\nOCTA -- invariants\n"));

let fails = 0;
let warns = 0;
let notices = 0;

for (const r of rows) {
  const n = Number(r.offending_count);
  if (n === 0) continue;

  if (r.severity === "fail" && !EXPECTED_EMPTY_DB.has(r.id)) {
    fails++;
    console.log(`  ${c.red("FAIL")}   ${r.id}  ${r.name}  ${c.dim(n + " row(s)")}`);
    console.log(`         ${c.dim(JSON.stringify(r.sample).slice(0, 160))}`);
  } else if (EXPECTED_EMPTY_DB.has(r.id)) {
    notices++;
    console.log(`  ${c.dim("note")}   ${r.id}  ${c.dim("expected on an unseeded database")}`);
  } else {
    warns++;
    console.log(`  ${c.yellow("warn")}   ${r.id}  ${r.name}  ${c.dim(n + " row(s)")}`);
  }
}

const clean = rows.length - fails - warns - notices;
console.log(c.dim(`\n  ${clean} clean, ${warns} warning(s), ${notices} notice(s), ${fails} failure(s)\n`));

if (fails > 0) {
  console.log(c.red("  Structural invariants are failing. That is a defect.\n"));
  process.exit(1);
}
console.log(c.green("  Database is in a legal state.\n"));
