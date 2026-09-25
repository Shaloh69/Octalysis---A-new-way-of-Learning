#!/usr/bin/env node
/**
 * Restore the demo fixtures — BOTH halves, in the right order.
 *
 * WHY THIS EXISTS. `pnpm verify` runs the API suite, which calls `resetAll()`
 * and truncates the tables, leaving its own two fixtures behind. Restoring is
 * two steps, and the second one is easy to forget:
 *
 *   1. `db/demo-seed.sql`     — profiles, sections, progress
 *   2. `scripts/sync-content.mjs` — the 115 objectives, from
 *                                    `content/stages/*.md` front matter
 *
 * Running only the first leaves the database with **4 objectives instead of
 * 115**, which does not look like an error. It looks like a map with almost no
 * moons, a stage list with nothing under it, and a handful of specs failing for
 * reasons that appear to be about the map. That cost three separate diagnosis
 * detours in one session — twice after `pnpm verify`, once after re-seeding to
 * check an unrelated fixture.
 *
 * `DESIGN-REVIEW-01.md` documented step 1 and not step 2. Writing the second
 * step down turned out not to be enough, so it is a command now.
 *
 * Deliberately NOT part of `pnpm verify`: verify's truncation is the API
 * suite's own setup doing its job, and re-seeding inside it would hide that.
 * This is the thing you run afterwards, and `pnpm qa` is the thing that tells
 * you that you forgot.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);

const c = {
  bold: (s) => `[1m${s}[0m`,
  green: (s) => `[32m${s}[0m`,
  red: (s) => `[31m${s}[0m`,
  dim: (s) => `[2m${s}[0m`,
};

/** Pipe a local .sql file into psql inside the container. Same as db-reset. */
function psqlFile(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) throw new Error(`missing SQL file: ${relPath}`);

  return readFile(abs, "utf8").then(
    (sql) =>
      new Promise((res, rej) => {
        const child = execFile(
          "docker",
          [
            "compose", "exec", "-T",
            "-e", "PGPASSWORD=postgres",
            "db", "psql",
            "-U", "postgres",
            "-d", "octa",
            "-v", "ON_ERROR_STOP=1",
            "--no-psqlrc",
            "-f", "-",
          ],
          { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 },
          (err, stdout, stderr) =>
            err ? rej(Object.assign(err, { stdout, stderr })) : res({ stdout, stderr }),
        );
        child.stdin.end(sql);
      }),
  );
}

async function count(what, sql) {
  const { stdout } = await run(
    "docker",
    [
      "compose", "exec", "-T",
      "-e", "PGPASSWORD=postgres",
      "db", "psql", "-U", "postgres", "-d", "octa",
      "-tAc", sql,
    ],
    { cwd: ROOT },
  );
  return { what, n: Number(stdout.trim()) };
}

/*
 * Refuse to seed over foreign attempt history, and say why.
 *
 * `responses` is append-only (root CLAUDE.md hard rule 7) and a trigger enforces
 * it against `service_role` too. The seed used to try to purge other users'
 * attempt history, which that trigger correctly refused -- aborting psql
 * PARTWAY THROUGH and leaving a half-fixtured database: profiles present,
 * stage_locks and progress missing.
 *
 * The visible symptom was "stage 00 is locked", which reads as an app bug and
 * sent two rounds of biome captures chasing a rendering problem. The seed's own
 * output had said FAILED both times, and nobody read it.
 *
 * So the check runs up front and the message names the fix. This is not a
 * limitation to work around: history surviving a re-seed is the entire point of
 * an append-only table.
 */
async function foreignHistory() {
  const { n } = await count(
    "foreign responses",
    "select count(*) from responses r join attempts a on a.id = r.attempt_id " +
      "join profiles p on p.id = a.user_id where p.id::text not like 'dddddddd-%'",
  );
  return n;
}

async function main() {
  console.log("\n  " + c.bold("OCTA — demo fixtures"));

  const stale = await foreignHistory();
  if (stale > 0) {
    console.log(
      c.red(`
  ${stale} response(s) belong to non-demo users.`) +
        `
  Nothing here can remove them: \`responses\` is append-only and a` +
        `
  trigger blocks DELETE for every role, which is correct and deliberate.` +
        `

  Run ` + c.bold("pnpm db:reset") + ` first -- it drops and recreates` +
        `
  the database -- then run this again. Seeding on top would half-apply,` +
        `
  and show up as a locked stage rather than as an error.
`,
    );
    process.exit(1);
  }

  process.stdout.write("  demo-seed.sql       ... ");
  try {
    await psqlFile("db/demo-seed.sql");
    console.log(c.green("ok"));
  } catch (err) {
    console.log(c.red("FAILED"));
    console.error(c.red(`\n${err.stderr || err.message}\n`));
    process.exit(1);
  }

  process.stdout.write("  sync-content.mjs    ... ");
  try {
    await run("node", [resolve(ROOT, "scripts/sync-content.mjs")], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
      },
      maxBuffer: 32 * 1024 * 1024,
    });
    console.log(c.green("ok"));
  } catch (err) {
    console.log(c.red("FAILED"));
    console.error(c.red(`\n${err.stderr || err.message}\n`));
    process.exit(1);
  }

  process.stdout.write("  sync-items.mjs      ... ");
  try {
    /*
     * The item bank -- the actual fix for F-41. Before this step existed nothing
     * in the repo seeded `items`, so a clean `pnpm db:reset` left the bank at
     * zero and the only way to get one was to run the API test suite and keep
     * its artefacts.
     *
     * It runs AFTER sync-content because every item names an objective, and
     * sync-items refuses an item whose objective does not exist yet.
     */
    await run("node", [resolve(ROOT, "scripts/sync-items.mjs")], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
      },
      maxBuffer: 32 * 1024 * 1024,
    });
    console.log(c.green("ok"));
  } catch (err) {
    console.log(c.red("FAILED"));
    console.error(c.red(`
${err.stderr || err.message}
`));
    process.exit(1);
  }

  process.stdout.write("  sync-assessments    ... ");
  try {
    /*
     * One assessment per examinable blueprint. Runs AFTER sync-items because an
     * assessment with no bank behind it is an exam a student can start and the
     * sampler cannot fill.
     */
    await run("node", [resolve(ROOT, "scripts/sync-assessments.mjs")], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
      },
      maxBuffer: 32 * 1024 * 1024,
    });
    console.log(c.green("ok"));
  } catch (err) {
    console.log(c.red("FAILED"));
    console.error(c.red(`
${err.stderr || err.message}
`));
    process.exit(1);
  }

  process.stdout.write("  demo-item-stats     ... ");
  try {
    /*
     * The one flagged item, for `/items`. AFTER sync-items, because it attaches
     * stats to an item by slug and the bank does not exist until that step. It
     * used to live in demo-seed.sql, which runs first, so it matched nothing --
     * silently -- and the flagged-item spec had nothing to find.
     */
    await psqlFile("db/demo-item-stats.sql");
    console.log(c.green("ok"));
  } catch (err) {
    console.log(c.red("FAILED"));
    console.error(c.red(`
${err.stderr || err.message}
`));
    process.exit(1);
  }

  /*
   * Counted, not assumed. The failure this script exists to prevent is SILENT:
   * a seeded database with 4 objectives looks fine until the map is empty, so
   * the numbers are printed and the objective count is checked.
   *
   * The threshold below is a belt-and-braces check on the sync having actually
   * taken, and it is UNEXERCISED -- the happy path is verified, but making
   * `sync-content.mjs` fail silently enough to trip it is not worth
   * simulating. Treat it as a smoke alarm, not as tested code.
   */
  const rows = await Promise.all([
    count("profiles", "select count(*) from profiles"),
    count("stages", "select count(*) from stages"),
    count("objectives", "select count(*) from objectives"),
    count("stage_progress", "select count(*) from stage_progress"),
    count("items (review)", "select count(*) from items where status = 'review'"),
    count("assessments", "select count(*) from assessments"),
    count("flagged items", "select count(*) from item_stats where flagged"),
  ]);

  console.log("");
  for (const { what, n } of rows) {
    console.log(`  ${String(n).padStart(5)}  ${c.dim(what)}`);
  }

  const objectives = rows.find((r) => r.what === "objectives")?.n ?? 0;
  if (objectives < 100) {
    console.error(
      c.red(
        `\n  Only ${objectives} objectives. The content sync did not take — ` +
          `the map will render almost no moons.\n`,
      ),
    );
    process.exit(1);
  }

  console.log(c.green("\n  Demo fixtures restored.\n"));
}

main().catch((err) => {
  console.error(c.red(`\n${err.stack || err.message}\n`));
  process.exit(1);
});
