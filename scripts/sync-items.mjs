#!/usr/bin/env node
/**
 * sync-items.mjs — the authored item bank, from `content/items/*.json` into `items`.
 *
 * This is the fix for **F-41**: nothing in this repo seeded `items`, so a clean
 * `pnpm db:reset` left the bank at zero, no student could sit a check, and the
 * only way to get an item bank locally was to run the API test suite and keep
 * its artefacts — a dependency nobody would guess.
 *
 * It is modelled on `sync-content.mjs`: content lives in files, git owns the
 * history, and the database is a projection of them.
 *
 * ## Three rules this script will not break
 *
 * 1. **It never touches a `live` or `retired` item.** Hard rule 6 says items are
 *    versioned, never edited in place, and `routes/items.ts` refuses to edit a
 *    live one at all. So a re-run after the instructor has approved something
 *    LEAVES IT ALONE and reports it as locked. Silently rewriting an approved
 *    item would replace a reviewed answer key with an unreviewed one, and
 *    nothing on screen would say so.
 *
 * 2. **Items land as `review`, with `author_id = NULL`.** NULL is not laziness:
 *    the fixture has one member of staff, so an item authored BY the instructor
 *    could only ever go live as a self-approval. With no author on record their
 *    approval is a genuine first review, which is the honest description of what
 *    it is — they really are the first person to check these.
 *
 * 3. **It refuses anything outside the examinable scope.** The stage ceiling is
 *    read from `services/api/src/engine/scope.ts` rather than duplicated here,
 *    so widening the flag and widening the bank cannot drift apart.
 *
 * Usage:
 *   node scripts/sync-items.mjs             apply
 *   node scripts/sync-items.mjs --check     validate only, touch nothing
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ITEM_DIR = resolve(ROOT, "content/items");
const SCOPE_TS = resolve(ROOT, "services/api/src/engine/scope.ts");
const SOLVER_GLOB = ["solvers.ts", "solvers-act1.ts", "solvers-act2.ts", "solvers-act3.ts", "solvers-act4.ts"];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const BLOOMS = new Set(["remember", "understand", "apply", "analyze"]);
const TYPES = new Set(["S", "P", "G"]);

/**
 * The scope ceiling, read from the flag rather than copied.
 * A copy here would let the bank and the flag disagree, which is the exact
 * failure `scope.spec.ts` exists to prevent on the other side.
 */
async function examinableThrough() {
  const src = await readFile(SCOPE_TS, "utf8");
  const m = src.match(/EXAMINABLE_THROUGH_STAGE\s*=\s*"(\d{2})"/);
  if (!m) throw new Error("Could not read EXAMINABLE_THROUGH_STAGE from scope.ts");
  return m[1];
}

/**
 * Registered solver ids, read from the engine source.
 *
 * Parsing TypeScript with a regex is not something to be proud of, but the
 * alternative is a build step in a seed script, and the failure mode here is
 * loud: a P item naming a solver that does not exist is reported and refused.
 * `resolve.ts` would throw at paper-generation time otherwise, which is the
 * moment a student presses Start.
 */
async function registeredSolvers() {
  const ids = new Set();
  for (const f of SOLVER_GLOB) {
    const src = await readFile(resolve(ROOT, "services/api/src/engine", f), "utf8");
    for (const m of src.matchAll(/^\s*id:\s*"([a-z0-9-]+)",/gm)) ids.add(m[1]);
  }
  return ids;
}

async function loadFiles() {
  let names;
  try {
    names = (await readdir(ITEM_DIR)).filter((f) => /^\d\d\.json$/.test(f)).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const raw = await readFile(resolve(ITEM_DIR, name), "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`${name} is not valid JSON: ${e.message}`);
    }
    out.push({ name, stage: name.slice(0, 2), ...parsed });
  }
  return out;
}

/** Every structural check that does not need the database. */
function validateShape(files, solvers, through) {
  const errors = [];
  const slugs = new Map();

  for (const f of files) {
    if (f.stage > through) {
      errors.push(
        `${f.name}: stage ${f.stage} is beyond the examinable scope (through ${through}). ` +
          `Widen EXAMINABLE_THROUGH_STAGE in scope.ts first, and only once the bank covers it.`,
      );
      continue;
    }
    if (f.stage !== f.stageId) {
      errors.push(`${f.name}: declares stageId "${f.stageId}" but is named for stage ${f.stage}`);
    }
    if (!Array.isArray(f.items)) {
      errors.push(`${f.name}: no "items" array`);
      continue;
    }

    for (const it of f.items) {
      const at = `${f.name}:${it.slug ?? "(no slug)"}`;
      if (!it.slug || !/^[a-z0-9-]{6,80}$/.test(it.slug)) {
        errors.push(`${at}: slug must be 6-80 chars of a-z, 0-9 and hyphen`);
      } else if (slugs.has(it.slug)) {
        errors.push(`${at}: duplicate slug, also in ${slugs.get(it.slug)}`);
      } else {
        slugs.set(it.slug, f.name);
      }

      if (!TYPES.has(it.type)) errors.push(`${at}: type must be S, P or G`);
      if (!BLOOMS.has(it.bloom)) errors.push(`${at}: bloom must be one of ${[...BLOOMS].join(", ")}`);
      if (!it.objective) errors.push(`${at}: no objective — it would be invisible to coverage`);
      if (!it.source) errors.push(`${at}: no source. Every item cites where it came from`);

      if (it.type === "S") {
        if (!it.stem || it.stem.length < 10) errors.push(`${at}: S needs a stem`);
        if (it.correct === undefined || it.correct === null || it.correct === "") {
          errors.push(`${at}: S with no correct answer would grade every student wrong`);
        }
        if (!Array.isArray(it.distractors) || it.distractors.length < 3) {
          errors.push(`${at}: S needs at least 3 distractors`);
        } else {
          if (it.distractors.includes(it.correct)) {
            errors.push(`${at}: the correct answer also appears as a distractor`);
          }
          if (new Set(it.distractors).size !== it.distractors.length) {
            errors.push(`${at}: duplicate distractors`);
          }
        }
      }

      if (it.type === "P") {
        if (!it.solver) errors.push(`${at}: P needs a solver`);
        else if (!solvers.has(it.solver)) {
          errors.push(`${at}: unknown solver "${it.solver}". resolve.ts would throw at paper time`);
        }
      }

      if (it.type === "G") {
        if (!it.stem || it.stem.length < 10) errors.push(`${at}: G needs a stem`);
        if (!Array.isArray(it.order) || it.order.length < 3) {
          errors.push(`${at}: G needs an "order" of at least 3 steps (resolve.ts enforces this)`);
        } else if (new Set(it.order).size !== it.order.length) {
          errors.push(`${at}: duplicate steps in "order" — the ordering would be ambiguous`);
        }
      }
    }
  }
  return errors;
}

async function main() {
  const check = process.argv.includes("--check");
  console.log(c.bold("\nOCTA -- item bank\n"));

  const through = await examinableThrough();
  const solvers = await registeredSolvers();
  const files = await loadFiles();

  if (files.length === 0) {
    console.log(c.yellow("  No item files in content/items/. Nothing to do.\n"));
    return;
  }

  const total = files.reduce((n, f) => n + (f.items?.length ?? 0), 0);
  console.log(
    c.dim(`  ${files.length} file(s), ${total} item(s), scope through stage ${through}, ` +
      `${solvers.size} solver(s) registered`),
  );

  const errors = validateShape(files, solvers, through);
  if (errors.length > 0) {
    console.log(c.red(`\n  ${errors.length} problem(s):\n`));
    for (const e of errors) console.log(c.red(`    ${e}`));
    console.log("");
    process.exitCode = 1;
    return;
  }
  console.log(c.dim("  shape ok"));

  if (check) {
    console.log(c.green("\n  Valid. Nothing written (--check).\n"));
    return;
  }

  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
  });
  await client.connect();

  let inserted = 0;
  let updated = 0;
  let locked = 0;
  const lockedSlugs = [];
  const missingObjectives = [];

  try {
    await client.query("begin");

    for (const f of files) {
      for (const it of f.items) {
        // An objective that does not exist would make the item unsampleable.
        const obj = await client.query("select 1 from objectives where id = $1", [it.objective]);
        if (obj.rowCount === 0) {
          missingObjectives.push(`${it.slug} -> ${it.objective}`);
          continue;
        }

        const existing = await client.query(
          "select id, status from items where slug = $1 order by version desc limit 1",
          [it.slug],
        );

        if (existing.rowCount > 0 && ["live", "retired"].includes(existing.rows[0].status)) {
          /*
           * Rule 1. An approved item is the instructor's, not this script's.
           * Editing it here would swap a reviewed key for an unreviewed one
           * with nothing on screen to say so.
           */
          locked++;
          lockedSlugs.push(`${it.slug} (${existing.rows[0].status})`);
          continue;
        }

        const fields = [
          it.slug,
          f.stageId,
          it.objective,
          it.type,
          it.bloom,
          it.difficulty ?? 0.6,
          it.type === "P" ? `Parameterized — the stem comes from solver "${it.solver}".` : it.stem,
          it.type === "P" ? it.solver : null,
          it.type === "P" ? "1.0.0" : null,
          JSON.stringify(
            it.type === "S"
              ? { value: it.correct }
              : it.type === "G"
                ? { order: it.order, ...(it.take ? { take: it.take } : {}) }
                : {},
          ),
          JSON.stringify(it.type === "S" ? it.distractors : []),
          it.rationale ?? null,
        ];

        if (existing.rowCount > 0) {
          /*
           * `slug=$1` looks redundant — it is the value we matched on — but the
           * UPDATE must REFERENCE every parameter it is given. Leaving $1 unused
           * made Postgres fail with "could not determine data type of parameter
           * $1", because nothing in the statement told it what type to infer.
           * Assigning the slug to itself is the honest fix; renumbering the
           * placeholders would make this list disagree with the INSERT's.
           */
          await client.query(
            `update items set slug=$1, stage_id=$2, objective_id=$3, type=$4::item_type, bloom=$5,
                    target_difficulty=$6, stem_template=$7, solver_ref=$8, solver_version=$9,
                    correct_spec=$10::jsonb, distractor_pool=$11::jsonb, rationale_template=$12,
                    status='review'
              where id = $13`,
            [...fields, existing.rows[0].id],
          );
          updated++;
        } else {
          await client.query(
            `insert into items
               (slug, stage_id, objective_id, type, status, version, bloom, target_difficulty,
                stem_template, solver_ref, solver_version, correct_spec, distractor_pool,
                rationale_template, author_id)
             values ($1,$2,$3,$4::item_type,'review',1,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,null)`,
            fields,
          );
          inserted++;
        }
      }
    }

    if (missingObjectives.length > 0) {
      await client.query("rollback");
      console.log(c.red(`\n  ${missingObjectives.length} item(s) name an objective that does not exist:\n`));
      for (const m of missingObjectives) console.log(c.red(`    ${m}`));
      console.log(c.dim("\n  Run `node scripts/sync-content.mjs` first — objectives come from content/stages.\n"));
      process.exitCode = 1;
      return;
    }

    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }

  console.log("");
  console.log(`  ${String(inserted).padStart(5)}  ${c.dim("inserted (review)")}`);
  console.log(`  ${String(updated).padStart(5)}  ${c.dim("updated")}`);
  if (locked > 0) {
    console.log(`  ${String(locked).padStart(5)}  ${c.yellow("left alone — already approved or retired")}`);
    for (const s of lockedSlugs.slice(0, 10)) console.log(c.dim(`         ${s}`));
    if (lockedSlugs.length > 10) console.log(c.dim(`         ... and ${lockedSlugs.length - 10} more`));
  }
  console.log(c.green("\n  Item bank synced. Review and approve in the console at /items.\n"));
}

main().catch((e) => {
  console.error(c.red(`\n  ${e.message}\n`));
  process.exitCode = 1;
});
