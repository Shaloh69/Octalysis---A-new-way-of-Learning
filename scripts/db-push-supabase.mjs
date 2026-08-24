#!/usr/bin/env node
// OCTA — apply the schema to a Supabase project.
//
// THREE files, not four. `db/local-bootstrap.sql` is LOCAL ONLY: Supabase
// already provides the auth schema, auth.uid(), and the anon/authenticated/
// service_role roles. Applying it there would shadow the real ones and every RLS
// test would silently become a lie. This script refuses to load it.
//
//   node scripts/db-push-supabase.mjs            apply
//   node scripts/db-push-supabase.mjs --check    connect + report state, change nothing
//   node scripts/db-push-supabase.mjs --reset    DROP the public schema first
//
// Connection comes from SUPABASE_DB_SESSION in .env (session pooler, port 5432).
// The transaction pooler on 6543 cannot run DDL reliably — use session mode.

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = ["db/schema.sql", "db/addendum-feedback.sql", "db/addendum-audit.sql"];
const FORBIDDEN = "local-bootstrap";

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function loadEnvFile() {
  try {
    const raw = await readFile(resolve(ROOT, ".env"), "utf8");
    return Object.fromEntries(
      raw
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const env = { ...(await loadEnvFile()), ...process.env };
  const conn = env.SUPABASE_DB_SESSION;

  if (!conn) {
    console.error(c.red("\nSUPABASE_DB_SESSION is not set in .env.\n"));
    process.exit(1);
  }
  if (conn.includes(":6543")) {
    console.error(
      c.red("\nThat is the transaction pooler (:6543). DDL needs session mode (:5432).\n"),
    );
    process.exit(1);
  }

  console.log(c.bold("\nOCTA — apply schema to Supabase\n"));
  console.log(c.dim(`  host  ${conn.replace(/:[^:@]*@/, ":****@")}`));

  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    statement_timeout: 120000,
  });

  try {
    await client.connect();
  } catch (err) {
    console.error(c.red(`\n  cannot connect: ${String(err.message).split("\n")[0]}\n`));
    process.exit(1);
  }

  const who = await client.query(
    "select current_user cu, current_database() db, version() v",
  );
  console.log(
    c.green(`  connected`) + c.dim(`  user=${who.rows[0].cu} db=${who.rows[0].db}`),
  );
  console.log(c.dim(`  ${who.rows[0].v.split(" on ")[0]}`));

  // Sanity: this must be a real Supabase project, not a local database that
  // would then get the wrong file set.
  const authCheck = await client.query(
    "select count(*)::int n from information_schema.tables where table_schema='auth' and table_name='users'",
  );
  if (authCheck.rows[0].n === 0) {
    console.error(
      c.red("\n  auth.users not found. This does not look like a Supabase project."),
    );
    console.error(c.red("  Refusing to apply — a local database needs db:reset instead.\n"));
    await client.end();
    process.exit(1);
  }
  console.log(c.green("  auth.users present") + c.dim("  (confirmed Supabase)"));

  const existing = await client.query(
    "select count(*)::int n from information_schema.tables where table_schema='public'",
  );
  console.log(c.dim(`  public tables currently: ${existing.rows[0].n}`));

  if (args.has("--check")) {
    console.log(c.dim("\n  --check: nothing applied.\n"));
    await client.end();
    return;
  }

  if (args.has("--reset")) {
    console.log(c.yellow("\n  --reset: dropping the public schema"));
    await client.query("drop schema public cascade; create schema public;");
    await client.query(
      "grant usage on schema public to anon, authenticated, service_role; " +
        "grant all on schema public to postgres;",
    );
    console.log(c.green("  public schema recreated"));
  } else if (existing.rows[0].n > 0) {
    console.log(
      c.yellow(
        `\n  ${existing.rows[0].n} table(s) already exist. Re-applying will fail on CREATE TYPE.`,
      ),
    );
    console.log(c.yellow("  Re-run with --reset to start clean.\n"));
    await client.end();
    process.exit(1);
  }

  console.log("");
  for (const f of FILES) {
    if (f.includes(FORBIDDEN)) {
      console.error(c.red(`  refusing to apply ${f} to a Supabase project`));
      process.exit(1);
    }
    process.stdout.write(`  ${f.padEnd(30)} ... `);
    const sql = await readFile(resolve(ROOT, f), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log(c.green("ok"));
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.log(c.red("FAILED"));
      console.error(c.red(`\n  ${String(err.message).split("\n")[0]}`));
      if (err.position) console.error(c.dim(`  at character ${err.position}`));
      await client.end();
      process.exit(1);
    }
  }

  // Invariants
  console.log("\n  " + c.bold("invariants"));
  const EXPECTED = new Set(["INV-18", "INV-27", "INV-28", "INV-29"]);
  const inv = await client.query(
    "select id, name, severity, offending_count from run_invariants() where offending_count > 0 order by id",
  );
  let fails = 0;
  for (const r of inv.rows) {
    const n = Number(r.offending_count);
    if (EXPECTED.has(r.id)) {
      console.log(`    ${c.dim("note")}  ${r.id} ${c.dim("(expected on an unseeded database)")}`);
    } else if (r.severity === "fail") {
      fails++;
      console.log(`    ${c.red("FAIL")}  ${r.id}  ${r.name}  ${n} row(s)`);
    } else {
      console.log(`    ${c.yellow("warn")}  ${r.id}  ${r.name}  ${n} row(s)`);
    }
  }
  if (inv.rows.length === 0) console.log("    " + c.green("all clear"));

  const stages = await client.query("select count(*)::int n from stages");
  const edges = await client.query(
    "select count(*)::int n from stages s, lateral unnest(s.prereq) p",
  );
  console.log(
    c.dim(`\n  seeded: ${stages.rows[0].n} stages, ${edges.rows[0].n} prerequisite edges`),
  );

  await client.end();

  if (fails > 0) {
    console.log(c.red(`\n  ${fails} structural invariant(s) failing.\n`));
    process.exit(1);
  }
  console.log(c.green("\n  Supabase schema applied and legal.\n"));
}

main().catch((err) => {
  console.error(c.red(`\n${err.stack || err.message}\n`));
  process.exit(1);
});
