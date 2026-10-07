#!/usr/bin/env node
// OCTA -- export the chapters the Studio owns.
//
// A chapter the Studio publishes is no longer written from content/stages/NN.md:
// `stages.content_owner = 'console'`, and sync-content leaves it alone. Its text
// then lives ONLY in the database, and Supabase Free keeps no backups. This is
// the way it gets into git again (docs/STUDIO-EDITOR-PLAN.md, E1.4).
//
//   node scripts/export-content.mjs            write content/export/NN.json and NN.md
//   node scripts/export-content.mjs --check    say what would be written, write nothing
//
// Each chapter is written twice: NN.json (every block with its id, kind, body and
// meta, in order: enough to put the chapter back) and NN.md (the reader's own
// text, for reading a diff). Files are rewritten only when they differ, so a
// second run changes nothing and `git status` shows only real edits.
//
// Reads $DATABASE_URL (the local stack by default). Writes nothing to the database.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OCTA_EXPORT_DIR ?? resolve(HERE, "..", "content", "export");
const check = process.argv.includes("--check");

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

/** A block's text as the reader shows it: its body, and for a code block its fence. */
export function markdownOf(blocks) {
  return (
    blocks
      .map((b) => {
        if (b.kind === "code") return "```\n" + b.body + "\n```";
        if (b.kind === "quote") {
          const text = b.body.split("\n").map((l) => `> ${l}`).join("\n");
          return b.meta?.source ? `${text}\n>\n> (${b.meta.source})` : text;
        }
        if (b.kind === "figure") return `[figure ${b.meta?.id ?? ""}]`;
        return b.body;
      })
      .join("\n\n") + "\n"
  );
}

async function writeIfChanged(path, text) {
  let old = null;
  try {
    old = await readFile(path, "utf8");
  } catch {
    /* new file */
  }
  if (old === text) return false;
  if (!check) await writeFile(path, text, "utf8");
  return true;
}

async function main() {
  console.log(c.bold("\nOCTA -- export the Studio's chapters\n"));
  const conn = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa";
  const client = new pg.Client({
    connectionString: conn,
    connectionTimeoutMillis: 15000,
    ssl: conn.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await client.connect();
  } catch (err) {
    console.error(c.red(`  cannot reach the database: ${String(err.message).split("\n")[0]}\n`));
    process.exit(1);
  }

  try {
    const { rows: stages } = await client.query(
      "select id, title from stages where content_owner = 'console' order by id",
    );
    // A chapter's MOONS the Studio owns (edited, added or retired there, E2) are written too, as
    // NN.moons.json: every moon of the chapter with its status, so a retired one is kept.
    const { rows: moonStages } = await client.query(
      "select distinct stage_id from objectives where owner = 'console' order by stage_id",
    );
    if (stages.length === 0 && moonStages.length === 0) {
      console.log(c.dim("  No chapter is owned by the Studio yet: nothing to export. The files are the source.\n"));
      return;
    }
    if (!check) await mkdir(OUT, { recursive: true });
    let changed = 0;
    for (const s of stages) {
      const { rows } = await client.query(
        "select id, ordinal, kind, body_md, meta, version from content_blocks where stage_id = $1 order by ordinal",
        [s.id],
      );
      const blocks = rows.map((r) => ({ id: r.id, ordinal: Number(r.ordinal), kind: r.kind, body: r.body_md, meta: r.meta ?? {}, version: Number(r.version) }));
      const json = JSON.stringify({ stageId: s.id, title: s.title, blocks }, null, 2) + "\n";
      const a = await writeIfChanged(join(OUT, `${s.id}.json`), json);
      const b = await writeIfChanged(join(OUT, `${s.id}.md`), `# ${s.id} ${s.title}\n\n` + markdownOf(blocks));
      if (a || b) changed++;
      console.log(`  ${s.id}  ${blocks.length} block(s)  ${a || b ? c.green(check ? "would change" : "written") : c.dim("unchanged")}`);
    }
    for (const m of moonStages) {
      const { rows } = await client.query(
        `select id, status, owner, description, bloom_level, level, competency, retired_at
           from objectives where stage_id = $1
          order by split_part(id, '.', 1), split_part(id, '.', 2)::int`,
        [m.stage_id],
      );
      const moons = rows.map((r) => ({
        id: r.id, status: r.status, owner: r.owner, description: r.description, bloom: r.bloom_level,
        level: r.level === null ? null : Number(r.level), competency: r.competency,
        retiredAt: r.retired_at ? new Date(r.retired_at).toISOString() : null,
      }));
      const wrote = await writeIfChanged(join(OUT, `${m.stage_id}.moons.json`), JSON.stringify({ stageId: m.stage_id, moons }, null, 2) + "\n");
      if (wrote) changed++;
      console.log(`  ${m.stage_id}  ${moons.length} moon(s)  ${wrote ? c.green(check ? "would change" : "written") : c.dim("unchanged")}`);
    }
    console.log(
      c.dim(`\n  ${stages.length} chapter(s) and ${moonStages.length} chapter(s) of moons, ${changed} ${check ? "would change" : "changed"}. ${check ? "--check: nothing written." : `In ${OUT}. Commit them.`}\n`),
    );
  } finally {
    await client.end();
  }
}

// Run only as a script, so a test can import markdownOf.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(c.red(`\n  ${err.message}\n`));
    process.exit(1);
  });
}
