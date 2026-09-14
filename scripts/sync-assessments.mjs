#!/usr/bin/env node
/**
 * sync-assessments.mjs — one assessment per examinable blueprint.
 *
 * The last piece of **F-41**. The bank alone does not let a student sit
 * anything: `routes/stages.ts` looks for an `assessments` row whose blueprint is
 * scoped to the stage, and with none the reader renders no "start the check"
 * link at all.
 *
 * ## The instructor's ruling, 9 September 2026
 *
 *   - **Prelim and Midterm**, both. The other two are behind the scope flag.
 *   - **Five attempts**, not one. The engine reseeds every attempt, so a second
 *     sitting is a different paper from the same blueprint rather than a second
 *     look at the same questions.
 *   - **Open to everyone** — `section_id` is NULL, which the schema comment
 *     calls "every section".
 *   - **No dates.** `opens_at` and `closes_at` are left NULL, and the instructor
 *     sets them in the console. `engine-repo.ts` treats a NULL bound as no
 *     bound, so both exams are OPEN from the moment they are seeded. That is
 *     the ruling, and it is called out in the summary rather than left implicit.
 *
 * ## What it will not do
 *
 * **It never touches an assessment that already exists.** Re-running after the
 * instructor has set a window in the console must not silently reset it — the
 * same rule `sync-items.mjs` applies to an approved item, for the same reason.
 * Only the absence of a row is filled in.
 *
 * The exam salt comes from the column's own `gen_random_bytes(32)` default
 * rather than being derived here, so this script never needs to see
 * `EXAM_SALT_SECRET`.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE_TS = resolve(ROOT, "services/api/src/engine/scope.ts");

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** Read the examinable blueprints from the flag rather than restating them. */
function examinableBlueprints() {
  const src = readFileSync(SCOPE_TS, "utf8");
  const block = src.match(
    /export const EXAMINABLE_BLUEPRINTS: readonly string\[\] = \[([\s\S]*?)\];/,
  );
  if (!block) throw new Error("Could not read EXAMINABLE_BLUEPRINTS from scope.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** The last stage the authored bank covers, read from the flag not restated. */
function examinableThroughStage() {
  const src = readFileSync(SCOPE_TS, "utf8");
  const m = src.match(/EXAMINABLE_THROUGH_STAGE\s*=\s*"(\d{2})"/);
  if (!m) throw new Error("Could not read EXAMINABLE_THROUGH_STAGE from scope.ts");
  return m[1];
}

const ATTEMPTS_ALLOWED = 5;

async function main() {
  console.log(c.bold("\nOCTA -- assessments\n"));
  const finals = examinableBlueprints();
  const through = examinableThroughStage();
  console.log(c.dim(`  ${finals.length} examinable exam(s): ${finals.join(", ")}`));
  console.log(c.dim(`  stage checks through stage ${through}`));

  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa",
  });
  await client.connect();

  /*
   * STAGE CHECKS ARE WHAT MAKE THE COURSE MOVE (F-44).
   *
   * `stage_progress.mastery` is written only for a STAGE-scoped attempt, and
   * `is_stage_unlocked()` needs every prerequisite at >= 70% of it. Without
   * these, a student reads stage 00 and never reaches stage 01.
   *
   * Only stages inside the examinable scope get one. A stage blueprint exists
   * for all eighteen -- blueprints are the plan -- but offering an assessment
   * for a stage with no items would put an unfillable paper in front of a
   * student, which is the failure the scope flag exists to prevent.
   */
  const stageChecks = await client.query(
    `select name from blueprints
      where scope = 'stage' and stage_id is not null and stage_id <= $1
        and exists (select 1 from items i where i.stage_id = blueprints.stage_id)
      order by stage_id`,
    [through],
  );
  const wanted = [...finals, ...stageChecks.rows.map((r) => r.name)];
  console.log(c.dim(`  ${stageChecks.rowCount} stage check(s) with a bank behind them`));

  let created = 0;
  const existing = [];
  const missingBlueprints = [];

  try {
    await client.query("begin");

    for (const name of wanted) {
      const bp = await client.query("select id from blueprints where name = $1", [name]);
      if (bp.rowCount === 0) {
        missingBlueprints.push(name);
        continue;
      }
      const blueprintId = bp.rows[0].id;

      const have = await client.query(
        "select id, opens_at, closes_at from assessments where blueprint_id = $1",
        [blueprintId],
      );
      if (have.rowCount > 0) {
        // Already there. Its window is the instructor's, not this script's.
        const r = have.rows[0];
        const window =
          r.opens_at || r.closes_at
            ? `window set`
            : `no dates yet`;
        existing.push(`${name} (${window})`);
        continue;
      }

      const ins = await client.query(
        `insert into assessments
           (blueprint_id, section_id, title, opens_at, closes_at, attempts_allowed)
         values ($1, null, $2, null, null, $3)
         returning id`,
        [blueprintId, name, ATTEMPTS_ALLOWED],
      );
      // exam_salt defaults to encode(gen_random_bytes(32),'hex') in the schema.
      await client.query("insert into assessment_secrets (assessment_id) values ($1)", [
        ins.rows[0].id,
      ]);
      created++;
    }

    /*
     * A MISSING BLUEPRINT IS A WARNING, NOT A FAILURE.
     *
     * `pnpm verify` runs the API suite, which truncates `blueprints` and
     * substitutes its own fixtures; restoring afterwards with `db-demo` is the
     * documented recovery. Failing hard here took the WHOLE seed down for a
     * condition that is both routine and self-inflicted, leaving the operator
     * with no items either. Say what is wrong and let the rest land.
     */
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }

  console.log("");
  if (missingBlueprints.length > 0) {
    console.log(
      c.yellow(
        `  ${String(missingBlueprints.length).padStart(3)}  blueprint(s) missing, skipped: ` +
          missingBlueprints.join(", "),
      ),
    );
    console.log(
      c.dim(
        "       Blueprints come from db/schema.sql, and the API suite truncates them.\n" +
          "       Run `pnpm db:reset` and then this again to get the exams back.",
      ),
    );
  }
  console.log(`  ${String(created).padStart(5)}  ${c.dim(`created, ${ATTEMPTS_ALLOWED} attempts, every section`)}`);
  if (existing.length > 0) {
    console.log(`  ${String(existing.length).padStart(5)}  ${c.dim("already present, left untouched")}`);
    for (const e of existing) console.log(c.dim(`         ${e}`));
  }
  if (created > 0) {
    console.log(
      c.yellow(
        "\n  Both exams are OPEN — no opens_at or closes_at is set, and a NULL bound\n" +
          "  is no bound. Set the window at /assessments in the console.",
      ),
    );
  }
  console.log(c.green("\n  Assessments ready.\n"));
}

main().catch((e) => {
  console.error(c.red(`\n  ${e.message}\n`));
  process.exitCode = 1;
});
