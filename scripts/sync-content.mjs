#!/usr/bin/env node
// OCTA -- content pipeline.
//
// Parses content/stages/*.md into `content_blocks` and `objectives`.
//
// The database is the RUNTIME source of truth, so the instructor can fix a typo
// without a redeploy. These files are the AUTHORING source of truth, so content
// is reviewable in git. This script is the bridge, and it is idempotent: running
// it twice produces zero changes the second time.
//
//   node scripts/sync-content.mjs              apply to $DATABASE_URL
//   node scripts/sync-content.mjs --check      report drift, change nothing
//   node scripts/sync-content.mjs --verify     check quoted spans against the decks
//
// A block only bumps its version when its BODY changed. Version churn on every
// run would make `content_blocks.version` meaningless as an edit record.

import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAGE_DIR = resolve(ROOT, "content/stages");

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/* ---------- a deliberately small YAML subset ---------- */
// Only what the front matter actually uses. A full YAML parser is a dependency
// and an attack surface we do not need for six keys.
function parseFrontMatter(raw) {
  // Normalise line endings first. These files are edited on Windows and on
  // Linux; a CRLF must not change how content parses, nor whether a block is
  // considered edited on the next sync.
  const text = raw.replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) throw new Error("missing front matter");
  const body = text.slice(m[0].length);

  const fm = { objectives: [] };
  const lines = m[1].split("\n");
  let i = 0;

  const scalar = (raw) => {
    const v = raw.trim();
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^\[.*\]$/.test(v)) {
      return v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map(Number);
    }
    if (/^-?\d+$/.test(v)) return Number(v);
    return v.replace(/^["']|["']$/g, "");
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) { i++; continue; }

    if (line.startsWith("objectives:")) {
      i++;
      let current = null;
      while (i < lines.length && /^\s+/.test(lines[i])) {
        const l = lines[i];
        const item = /^\s*-\s*(\w+):\s*(.*)$/.exec(l);
        const cont = /^\s+(\w+):\s*(.*)$/.exec(l);
        if (item) {
          if (current) fm.objectives.push(current);
          current = { [item[1]]: scalar(item[2]) };
        } else if (cont && current) {
          current[cont[1]] = scalar(cont[2]);
        }
        i++;
      }
      if (current) fm.objectives.push(current);
      continue;
    }

    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = scalar(kv[2]);
    i++;
  }
  return { fm, body };
}

/** Split the body on `<!-- block: kind attr="v" -->` markers. */
function parseBlocks(body) {
  const re = /<!--\s*block:\s*(\w+)([^>]*?)-->/g;
  const blocks = [];
  const marks = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    marks.push({ kind: m[1], attrs: m[2] ?? "", start: m.index, end: re.lastIndex });
  }
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    const text = body.slice(mark.end, i + 1 < marks.length ? marks[i + 1].start : body.length);
    const meta = {};
    for (const a of mark.attrs.matchAll(/(\w+)="([^"]*)"/g)) meta[a[1]] = a[2];
    blocks.push({ kind: mark.kind, body: text.trim(), meta });
  }
  return blocks;
}

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

async function loadStageFiles() {
  const names = (await readdir(STAGE_DIR)).filter((f) => /^\d\d\.md$/.test(f)).sort();
  const out = [];
  for (const name of names) {
    const raw = await readFile(resolve(STAGE_DIR, name), "utf8");
    const { fm, body } = parseFrontMatter(raw);
    const blocks = parseBlocks(body);
    if (blocks.length === 0) throw new Error(`${name}: no blocks found`);
    out.push({ file: name, stageId: fm.stage ?? name.slice(0, 2), fm, blocks });
  }
  return out;
}

/* ---------- verify quoted spans against the source decks ---------- */
async function verifyAgainstSource(stages) {
  const decks = {};
  for (const d of ["day1-deck.md", "chapter1-deck.md"]) {
    try {
      decks[d] = await readFile(resolve(ROOT, "docs/source", d), "utf8");
    } catch { /* deck absent; nothing to verify against */ }
  }

  const problems = [];
  let checked = 0;

  // Normalise the punctuation that differs between a PowerPoint export and
  // hand-typed markdown: curly apostrophes, en/em dashes, and the "--" that
  // stands in for an en dash in plain text.
  // Dash SPACING is normalised away as well, applied symmetrically to both
  // sides. The deck contains "a high –level language" with a stray space, and
  // reproducing that in student-facing text would be worse than not matching it
  // character for character. This check exists to catch INVENTED content, not
  // to enforce whitespace fidelity to a PowerPoint export.
  const normalise = (s) =>
    s
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/–|—|--/g, "-")
      .replace(/\s*-\s*/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  for (const stage of stages) {
    for (const b of stage.blocks) {
      if (!b.meta.source) continue;
      const deckName = b.meta.source.split(" ")[0];
      const deck = decks[deckName];
      if (!deck) continue;
      checked++;

      const haystack = normalise(deck);

      // Getting this granularity right took three attempts, so the reasoning is
      // written down.
      //
      //   Sentence-based  -- meaningless for a code listing. Flagged Figure 1.3
      //                      as drift when it was verbatim.
      //   Line-based      -- wrong for prose, because the markdown is hard
      //                      wrapped at 80 columns while the deck has each
      //                      paragraph on one long line. No individual line
      //                      matches.
      //
      // So: code is compared line by line, because each line is independently
      // meaningful. Everything else is compared in UNITS -- a paragraph rejoined
      // across its wrapped lines, or a single bullet. Units under 40 characters
      // are skipped: those are lead-ins like "Advantages of Assembly Language:",
      // which restate a slide title rather than quoting body text.
      const rawLines = b.body.split(/\r?\n/);
      let units;

      if (b.kind === "code") {
        units = rawLines.map((l) => l.trim()).filter((l) => l.length >= 12);
      } else {
        units = [];
        let para = [];
        const flush = () => {
          if (para.length) units.push(para.join(" "));
          para = [];
        };
        for (const line of rawLines) {
          const t = line.trim();
          if (!t) { flush(); continue; }
          if (/^[-*]\s+/.test(t)) { flush(); units.push(t.replace(/^[-*]\s+/, "")); continue; }
          para.push(t);
        }
        flush();
        units = units.filter((u) => u.length >= 40);
      }

      if (units.length === 0) continue;

      const missing = units.filter((l) => !haystack.includes(normalise(l)));
      if (missing.length > 0) {
        problems.push({
          file: stage.file,
          kind: b.kind,
          source: b.meta.source,
          excerpt: missing[0].slice(0, 90),
          count: missing.length,
        });
      }
    }
  }

  return { checked, problems };
}

/* ---------- apply ---------- */
async function sync(client, stages, { dryRun }) {
  let inserted = 0, updated = 0, unchanged = 0, removed = 0, objectives = 0;

  for (const stage of stages) {
    const { rows: stageRows } = await client.query("select id from stages where id = $1", [
      stage.stageId,
    ]);
    if (stageRows.length === 0) {
      throw new Error(
        `${stage.file}: stage "${stage.stageId}" is not seeded in db/schema.sql. ` +
          `Content may not invent a stage.`,
      );
    }

    // Objectives
    for (const o of stage.fm.objectives ?? []) {
      objectives++;
      if (dryRun) continue;
      await client.query(
        `insert into objectives (id, stage_id, code, bloom_level, level, competency, description)
         values ($1, $2, $1, $3, $4, $5, $6)
         on conflict (id) do update
           set bloom_level = excluded.bloom_level,
               level       = excluded.level,
               competency  = excluded.competency,
               description = excluded.description`,
        [o.id, stage.stageId, o.bloom, o.level ?? null, o.competency ?? null, o.description],
      );
    }

    // Blocks
    const { rows: existing } = await client.query(
      "select ordinal, kind, body_md, meta, version from content_blocks where stage_id = $1",
      [stage.stageId],
    );
    const byOrdinal = new Map(existing.map((r) => [Number(r.ordinal), r]));

    for (let i = 0; i < stage.blocks.length; i++) {
      const ordinal = i + 1;
      const b = stage.blocks[i];
      const prev = byOrdinal.get(ordinal);

      if (!prev) {
        inserted++;
        if (!dryRun) {
          await client.query(
            `insert into content_blocks (stage_id, ordinal, kind, body_md, meta, version)
             values ($1, $2, $3, $4, $5, 1)`,
            [stage.stageId, ordinal, b.kind, b.body, JSON.stringify(b.meta)],
          );
        }
        continue;
      }

      // Only the BODY and KIND decide whether this is an edit. Bumping the
      // version on every run would make it useless as an edit record.
      if (prev.body_md === b.body && prev.kind === b.kind) {
        unchanged++;
        continue;
      }

      updated++;
      if (!dryRun) {
        await client.query(
          `update content_blocks
              set kind = $3, body_md = $4, meta = $5,
                  version = version + 1, updated_at = now()
            where stage_id = $1 and ordinal = $2`,
          [stage.stageId, ordinal, b.kind, b.body, JSON.stringify(b.meta)],
        );
      }
    }

    // Blocks deleted from the file
    for (const [ordinal] of byOrdinal) {
      if (ordinal > stage.blocks.length) {
        removed++;
        if (!dryRun) {
          await client.query(
            "delete from content_blocks where stage_id = $1 and ordinal = $2",
            [stage.stageId, ordinal],
          );
        }
      }
    }
  }

  return { inserted, updated, unchanged, removed, objectives };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--check");
  const verifyOnly = args.has("--verify");

  console.log(c.bold("\nOCTA -- content sync\n"));

  const stages = await loadStageFiles();
  console.log(
    c.dim(
      `  ${stages.length} stage file(s), ` +
        `${stages.reduce((a, s) => a + s.blocks.length, 0)} block(s), ` +
        `${stages.reduce((a, s) => a + (s.fm.objectives?.length ?? 0), 0)} objective(s)`,
    ),
  );

  // Content fidelity: the highest-risk failure of building this with an LLM is
  // plausible-sounding invented lecture text. AUDITS.md 3.6.
  const { checked, problems } = await verifyAgainstSource(stages);
  console.log(c.dim(`  ${checked} sourced block(s) checked against the decks`));
  if (problems.length > 0) {
    console.log(c.red(`\n  ${problems.length} block(s) do not match their cited source:\n`));
    for (const p of problems) {
      console.log(`    ${c.red(p.file)} ${c.dim(p.kind)} cites ${p.source}`);
      console.log(`      ${c.dim(p.excerpt)}...`);
    }
    console.log(
      c.red("\n  Content must come from the decks verbatim. Do not invent lecture text.\n"),
    );
    process.exit(1);
  }
  console.log(c.green("  all sourced blocks match the decks"));

  if (verifyOnly) {
    console.log(c.dim("\n  --verify: nothing written.\n"));
    return;
  }

  const conn = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa";
  const client = new pg.Client({
    connectionString: conn,
    connectionTimeoutMillis: 15000,
    ssl: conn.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
  } catch (err) {
    console.error(c.red(`\n  cannot reach the database: ${String(err.message).split("\n")[0]}`));
    console.error(c.dim("  Is Docker running? Try: pnpm db:up\n"));
    process.exit(1);
  }

  try {
    await client.query("begin");
    const s = await sync(client, stages, { dryRun });
    if (dryRun) await client.query("rollback");
    else await client.query("commit");

    console.log("");
    console.log(`  ${c.green(String(s.inserted))} inserted   ${c.yellow(String(s.updated))} updated   ` +
      `${c.dim(String(s.unchanged) + " unchanged")}   ${s.removed} removed`);
    console.log(c.dim(`  ${s.objectives} objective(s) upserted`));

    if (dryRun) {
      console.log(c.dim("\n  --check: rolled back, nothing written.\n"));
    } else if (s.inserted === 0 && s.updated === 0 && s.removed === 0) {
      console.log(c.green("\n  Idempotent: a second run changed nothing.\n"));
    } else {
      console.log(c.green("\n  Content synced.\n"));
    }
  } catch (err) {
    await client.query("rollback").catch(() => {});
    console.error(c.red(`\n  ${err.message}\n`));
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(c.red(`\n${err.stack || err.message}\n`));
  process.exit(1);
});
