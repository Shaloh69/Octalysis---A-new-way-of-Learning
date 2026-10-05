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
//   node scripts/sync-content.mjs --pull       also write console edits back into the files
//   node scripts/sync-content.mjs --take-file  resolve a conflict: the file's text wins
//
// A block only bumps its version when its BODY changed. Version churn on every
// run would make `content_blocks.version` meaningless as an edit record. The
// bump itself, and the copy of the text it replaced, are the archive trigger's
// job (db/schema.sql `archive_content_block`), so sync, the console editor and
// a direct write all keep history the same way.
//
// THE CONSOLE CAN EDIT A BLOCK TOO (instructor ruling, 28 Sep 2026), so this
// script no longer assumes the database only ever holds what it last wrote:
//
//   file unchanged, console edited   KEEP the console text; list it. `--pull`
//                                    writes it into the file, so it reaches git
//                                    and `--verify`
//   file changed, console edited     CONFLICT: keep the console text, report
//                                    both. `--take-file` lets the file win
//   file changed, console untouched  the file wins, as it always has
//
// "File unchanged" means: the .md body hashes to `source_hash`, the hash of
// the body this script last wrote.
//
// DRAFTED LESSON TEXT (instructor ruling, 5 Oct 2026). A chapter may have a
// `NN.draft.md` beside `NN.md`: lesson text drafted from the textbook for a
// chapter the syllabus outline alone covered. Its blocks go to the staff-only
// `chapter_drafts`, never to `content_blocks`: students go on reading NN.md
// until the instructor approves the draft on /content, and the approval (an
// API write with an audit row) is what copies it in. A changed draft withdraws
// its approval; the text students read stays the last approved one. Once a
// chapter has EVER been approved, this script leaves its blocks alone, so a
// later run can never put NN.md's stub back over reviewed text.
//
// PLANET SUMMARIES are no longer approved here. Each `summary:` is written to
// `stage_summaries` as a draft and approved on /content, bound to its text; a
// changed draft withdraws its approval. A `summary_status:` line is refused.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// OCTA_STAGE_DIR is for the API's test suite, which syncs a temporary copy.
const STAGE_DIR = process.env.OCTA_STAGE_DIR
  ? resolve(process.env.OCTA_STAGE_DIR)
  : resolve(ROOT, "content/stages");

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

  const fm = { objectives: [], _raw: m[0] };
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
    const end = i + 1 < marks.length ? marks[i + 1].start : body.length;
    const text = body.slice(mark.end, end);
    const meta = {};
    for (const a of mark.attrs.matchAll(/(\w+)="([^"]*)"/g)) meta[a[1]] = a[2];
    // `span` is where the block's text sits in `body`, so --pull can put a
    // console edit back exactly there, whitespace around it untouched.
    blocks.push({ kind: mark.kind, body: text.trim(), meta, span: { start: mark.end, end } });
  }
  return blocks;
}

/** The file's text with some blocks' bodies replaced; `edits` maps block index to new body. */
function rewriteBlocks(stage, edits) {
  let body = stage.body;
  const order = [...edits.keys()].sort((a, b) => b - a); // last first: earlier offsets stay valid
  for (const i of order) {
    const { start, end } = stage.blocks[i].span;
    const raw = body.slice(start, end);
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.match(/\s*$/)[0];
    body = body.slice(0, start) + lead + edits.get(i) + trail + body.slice(end);
  }
  return stage.frontMatter + body;
}

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

async function loadStageFiles() {
  const all = await readdir(STAGE_DIR);
  const names = all.filter((f) => /^\d\d\.md$/.test(f)).sort();
  const out = [];
  for (const name of names) {
    const raw = await readFile(resolve(STAGE_DIR, name), "utf8");
    const { fm, body } = parseFrontMatter(raw);
    const blocks = parseBlocks(body);
    if (blocks.length === 0) throw new Error(`${name}: no blocks found`);
    if ("summary_status" in fm) {
      throw new Error(
        `${name}: summary_status is no longer read. A summary is approved on the console's ` +
          `/content page, bound to its exact text (28 Sep 2026). Delete the line.`,
      );
    }
    // The chapter's drafted lesson text, if any (ruling of 5 Oct 2026).
    let draft = null;
    const draftName = `${name.slice(0, 2)}.draft.md`;
    if (all.includes(draftName)) {
      const draw = await readFile(resolve(STAGE_DIR, draftName), "utf8");
      const d = parseFrontMatter(draw);
      const dblocks = parseBlocks(d.body).map(({ kind, body: b, meta }) => ({ kind, body: b, meta }));
      if (dblocks.length === 0) throw new Error(`${draftName}: no blocks found`);
      if (d.fm.title && fm.title && d.fm.title !== fm.title) {
        throw new Error(`${draftName}: its title "${d.fm.title}" is not its chapter's, "${fm.title}".`);
      }
      draft = { file: draftName, blocks: dblocks, hash: hash(JSON.stringify(dblocks)) };
    }
    out.push({
      file: name,
      path: resolve(STAGE_DIR, name),
      stageId: fm.stage ?? name.slice(0, 2),
      fm,
      blocks,
      body,
      frontMatter: fm._raw,
      draft,
    });
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

  // THE TEXTBOOK IS A SOURCE TOO, one file per chapter, named `ch-04.md` and so
  // on. A block written from the book carries `source="ch-04.md 4.3"` and every
  // quoted span in it is then proved to appear in that chapter, character for
  // character, exactly as the lecture decks already were.
  //
  // The chapter number is the BOOK's, not the syllabus's -- they differ for ten
  // of eighteen chapters in this edition. `content/book-map.json` is the
  // translation and `scripts/check-book-map.mjs` proves it still holds.
  //
  // The book is gitignored (it is copyrighted), so on a fresh clone there is
  // nothing here and blocks citing it are simply not checked. That is a real
  // weakening and `--verify` says so rather than reporting a clean run.
  let bookChapters = 0;
  for (let n = 1; n <= 21; n++) {
    const f = `ch-${String(n).padStart(2, "0")}.md`;
    try {
      decks[f] = await readFile(resolve(ROOT, "docs/source/book", f), "utf8");
      bookChapters++;
    } catch { /* not extracted; see above */ }
  }
  if (bookChapters === 0) {
    console.log(
      c.yellow(
        "  The textbook is not extracted, so blocks citing it cannot be verified.\n" +
        "  It is gitignored by design. Run `pnpm book:extract` with your own copy.",
      ),
    );
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

  // A drafted chapter (5 Oct 2026) is held to the same proof as an authored
  // one: every block citing the book must quote it, before anyone reviews it.
  const sourced = stages.flatMap((stage) => [
    { file: stage.file, blocks: stage.blocks },
    ...(stage.draft ? [{ file: stage.draft.file, blocks: stage.draft.blocks }] : []),
  ]);
  for (const stage of sourced) {
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
async function sync(client, stages, { dryRun, pull = false, takeFile = false }) {
  let inserted = 0, updated = 0, unchanged = 0, removed = 0, objectives = 0;
  let summariesLive = 0, summariesPending = 0;
  let chaptersLive = 0, chaptersPending = 0;
  const chaptersWithdrawn = [], chaptersKept = [];
  const summariesWithdrawn = [], kept = [], conflicts = [], pulled = [], filesToWrite = [];

  // Every block this run replaces is archived as a SYNC change, not 'direct'.
  await client.query("select set_config('app.edit_via', 'sync', true)");

  for (const stage of stages) {
    const { rows: stageRows } = await client.query("select id, title from stages where id = $1", [
      stage.stageId,
    ]);
    if (stageRows.length === 0) {
      throw new Error(
        `${stage.file}: stage "${stage.stageId}" is not seeded in db/schema.sql. ` +
          `Content may not invent a stage.`,
      );
    }

    // THE FILE'S TITLE MUST MATCH THE SEEDED TITLE.
    //
    // Stage ids are positional, so a curriculum change RENAMES what "01" means
    // while the file keeps its filename. Without this check, switching from the
    // old course to CPE 412 would have silently written "What Programming Is"
    // into the stage now seeded as "Introduction" -- correct-looking content on
    // the wrong chapter, which is worse than no content because nothing appears
    // broken. Caught during the CPE 412 migration; this is the guard.
    const seededTitle = stageRows[0].title;
    if (stage.fm.title && stage.fm.title !== seededTitle) {
      throw new Error(
        `${stage.file}: front matter says "${stage.fm.title}" but stage ${stage.stageId} is ` +
          `seeded as "${seededTitle}". Stage ids are positional -- a curriculum change renames ` +
          `what an id means. Fix the file, or move it to docs/source/superseded-course/.`,
      );
    }

    // THE PLANET SUMMARY — shown in the map sidebar, and only once approved.
    //
    // Instructor ruling, 25 Sep 2026: summaries may be DRAFTED from each
    // stage's own authored brief and objectives, as a narrow exception to hard
    // rule 5, because the instructor reviews every one before students see it.
    //
    // Ruling of 28 Sep 2026: that review happens on /content, in the database,
    // and an approval is of ONE text. So this script writes the draft to
    // `stage_summaries` and never approves anything. If the draft's text has
    // changed, its status goes back to draft and `stages.summary` is cleared:
    // a revised summary is unreviewed until someone reads it again. A trigger
    // on `stages` refuses any summary that is not the approved text.
    const draft = stage.fm.summary ? String(stage.fm.summary).trim() : "";
    const { rows: sumRows } = await client.query(
      "select draft_hash, status from stage_summaries where stage_id = $1",
      [stage.stageId],
    );
    const had = sumRows[0];
    if (!draft) {
      if (had && !dryRun) {
        await client.query("update stages set summary = null where id = $1", [stage.stageId]);
        await client.query("delete from stage_summaries where stage_id = $1", [stage.stageId]);
      }
    } else if (!had) {
      summariesPending++;
      if (!dryRun) {
        await client.query(
          "insert into stage_summaries (stage_id, draft, draft_hash) values ($1, $2, $3)",
          [stage.stageId, draft, hash(draft)],
        );
      }
    } else if (had.draft_hash !== hash(draft)) {
      summariesPending++;
      if (had.status === "approved") summariesWithdrawn.push(stage.stageId);
      if (!dryRun) {
        await client.query("update stages set summary = null where id = $1", [stage.stageId]);
        await client.query(
          `update stage_summaries
              set draft = $2, draft_hash = $3, status = 'draft', approved_hash = null,
                  note = null, reviewed_by = null, reviewed_at = null, updated_at = now()
            where stage_id = $1`,
          [stage.stageId, draft, hash(draft)],
        );
      }
    } else if (had.status === "approved") {
      summariesLive++;
    } else {
      summariesPending++;
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

    // Drafted lesson text: written for review, never straight to students.
    const { rows: draftRows } = await client.query(
      "select draft_hash, status, ever_approved from chapter_drafts where stage_id = $1",
      [stage.stageId],
    );
    const dRow = draftRows[0];
    if (stage.draft) {
      if (!dRow) {
        chaptersPending++;
        if (!dryRun) {
          await client.query(
            "insert into chapter_drafts (stage_id, blocks, draft_hash) values ($1, $2::jsonb, $3)",
            [stage.stageId, JSON.stringify(stage.draft.blocks), stage.draft.hash],
          );
        }
      } else if (dRow.draft_hash !== stage.draft.hash) {
        chaptersPending++;
        if (dRow.status === "approved") chaptersWithdrawn.push(stage.stageId);
        if (!dryRun) {
          await client.query(
            `update chapter_drafts
                set blocks = $2::jsonb, draft_hash = $3, status = 'draft', approved_hash = null,
                    note = null, reviewed_by = null, reviewed_at = null, updated_at = now()
              where stage_id = $1`,
            [stage.stageId, JSON.stringify(stage.draft.blocks), stage.draft.hash],
          );
        }
      } else if (dRow.status === "approved") {
        chaptersLive++;
      } else {
        chaptersPending++;
      }
    } else if (dRow && !dRow.ever_approved && !dryRun) {
      // The draft file is gone and nothing of it was ever approved: nothing to keep.
      await client.query("delete from chapter_drafts where stage_id = $1", [stage.stageId]);
    }
    if (dRow?.ever_approved) {
      // Students read reviewed text here, written by the approval. Never overwrite it.
      chaptersKept.push(stage.stageId);
      continue;
    }

    // Blocks
    const { rows: existing } = await client.query(
      `select ordinal, kind, body_md, meta, version, source_hash, console_edited
         from content_blocks where stage_id = $1`,
      [stage.stageId],
    );
    const byOrdinal = new Map(existing.map((r) => [Number(r.ordinal), r]));
    const pullEdits = new Map(); // block index -> console text, for --pull

    for (let i = 0; i < stage.blocks.length; i++) {
      const ordinal = i + 1;
      const b = stage.blocks[i];
      const fileHash = hash(b.body);
      const prev = byOrdinal.get(ordinal);
      const where = `${stage.file} block ${ordinal}`;

      if (!prev) {
        inserted++;
        if (!dryRun) {
          await client.query(
            `insert into content_blocks (stage_id, ordinal, kind, body_md, meta, version, source_hash)
             values ($1, $2, $3, $4, $5, 1, $6)`,
            [stage.stageId, ordinal, b.kind, b.body, JSON.stringify(b.meta), fileHash],
          );
        }
        continue;
      }

      // A CONSOLE EDIT is never overwritten silently.
      if (prev.console_edited) {
        const fileUnchanged = prev.source_hash === fileHash;
        if (fileUnchanged && pull) {
          pullEdits.set(i, prev.body_md);
          pulled.push(where);
          if (!dryRun) {
            // The text does not change, so the trigger records no new version.
            await client.query(
              `update content_blocks set source_hash = $3, console_edited = false
                where stage_id = $1 and ordinal = $2`,
              [stage.stageId, ordinal, hash(prev.body_md)],
            );
          }
          continue;
        }
        if (fileUnchanged) {
          kept.push(where);
          continue;
        }
        if (!takeFile) {
          conflicts.push(where);
          continue;
        }
        // --take-file: the file wins, and the console text goes to history.
      } else if (prev.body_md === b.body && prev.kind === b.kind) {
        // Only the BODY and KIND decide whether this is an edit. Bumping the
        // version on every run would make it useless as an edit record.
        unchanged++;
        if (prev.source_hash !== fileHash && !dryRun) {
          await client.query(
            "update content_blocks set source_hash = $3 where stage_id = $1 and ordinal = $2",
            [stage.stageId, ordinal, fileHash],
          );
        }
        continue;
      }

      updated++;
      if (!dryRun) {
        // The archive trigger bumps `version` and keeps the replaced text.
        await client.query(
          `update content_blocks
              set kind = $3, body_md = $4, meta = $5, source_hash = $6, console_edited = false
            where stage_id = $1 and ordinal = $2`,
          [stage.stageId, ordinal, b.kind, b.body, JSON.stringify(b.meta), fileHash],
        );
      }
    }

    // Blocks deleted from the file. A console edit is kept even here: removing
    // it would lose text nobody has put in git.
    for (const [ordinal, prev] of byOrdinal) {
      if (ordinal > stage.blocks.length) {
        if (prev.console_edited && !takeFile) {
          conflicts.push(`${stage.file} block ${ordinal} (gone from the file)`);
          continue;
        }
        removed++;
        if (!dryRun) {
          await client.query(
            "delete from content_blocks where stage_id = $1 and ordinal = $2",
            [stage.stageId, ordinal],
          );
        }
      }
    }

    if (pullEdits.size > 0) filesToWrite.push({ path: stage.path, text: rewriteBlocks(stage, pullEdits) });
  }

  return {
    inserted, updated, unchanged, removed, objectives, summariesLive, summariesPending,
    summariesWithdrawn, kept, conflicts, pulled, filesToWrite,
    chaptersLive, chaptersPending, chaptersWithdrawn, chaptersKept,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--check");
  const verifyOnly = args.has("--verify");
  const pull = args.has("--pull");
  const takeFile = args.has("--take-file");

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

  const conn = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa";
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
    const s = await sync(client, stages, { dryRun, pull, takeFile });
    if (dryRun) await client.query("rollback");
    else await client.query("commit");

    // Files are written only after the database committed, so a failed sync
    // never leaves a file claiming an edit the database does not hold.
    if (!dryRun) {
      for (const f of s.filesToWrite) await writeFile(f.path, f.text, "utf8");
    }

    console.log("");
    console.log(`  ${c.green(String(s.inserted))} inserted   ${c.yellow(String(s.updated))} updated   ` +
      `${c.dim(String(s.unchanged) + " unchanged")}   ${s.removed} removed`);
    console.log(c.dim(`  ${s.objectives} objective(s) upserted`));
    console.log(
      c.dim(
        `  planet summaries: ${s.summariesLive} approved, ${s.summariesPending} to review on /content`,
      ),
    );
    console.log(
      c.dim(`  drafted lesson text: ${s.chaptersLive} chapter(s) approved, ${s.chaptersPending} to review on /content`),
    );
    for (const id of s.chaptersWithdrawn) {
      console.log(c.yellow(`  stage ${id}: its drafted text changed, so its approval was withdrawn. Students keep the last approved text.`));
    }
    if (s.chaptersKept.length > 0) {
      console.log(c.dim(`  approved chapters left as reviewed: ${s.chaptersKept.join(", ")}`));
    }
    for (const id of s.summariesWithdrawn) {
      console.log(c.yellow(`  stage ${id}: its summary changed, so its approval was withdrawn. Review it again.`));
    }
    if (s.pulled.length > 0) {
      console.log(c.green(`\n  ${s.pulled.length} console edit(s) ${dryRun ? "would be" : ""} written into the files:`));
      for (const w of s.pulled) console.log(`    ${w}`);
    }
    if (s.kept.length > 0) {
      console.log(c.yellow(`\n  ${s.kept.length} console edit(s) kept, not yet in the files. Run with --pull:`));
      for (const w of s.kept) console.log(`    ${w}`);
    }
    if (s.conflicts.length > 0) {
      console.log(c.red(`\n  ${s.conflicts.length} conflict(s): edited in the console AND changed in the file.`));
      console.log(c.red("  The console text was kept. Merge by hand, or run with --take-file to let the file win:"));
      for (const w of s.conflicts) console.log(`    ${w}`);
    }

    if (dryRun) {
      console.log(c.dim("\n  --check: rolled back, nothing written.\n"));
    } else if (s.inserted === 0 && s.updated === 0 && s.removed === 0 && s.pulled.length === 0) {
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
