import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * `sync-content` and the console editor, together (instructor ruling, 28 Sep
 * 2026: keep, report, pull back). The script is run for real, against a
 * temporary copy of `content/stages/` (OCTA_STAGE_DIR), so what is tested is
 * what an instructor runs.
 *
 * The property that matters most is the first one below: **a console edit is
 * never silently overwritten by a sync.** Before this, every sync rewrote the
 * database from the files, and a typo fixed in the console would have been
 * undone by the next deploy without a word.
 */

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT = resolve(ROOT, "scripts/sync-content.mjs");
const DB = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa";
const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

let app: FastifyInstance;
let w: World;
let dir: string;
let token: string;

const SUMMARY = "How the course runs and how a stage opens.";

function stageFile(summary: string, b1: string, b2: string, extra = ""): string {
  return `---
stage: "00"
title: Orientation
summary: "${summary}"
${extra}---

<!-- block: prose -->
${b1}

<!-- block: prose -->
${b2}
`;
}

async function sync(...flags: string[]): Promise<string> {
  const { stdout } = await run(process.execPath, [SCRIPT, ...flags], {
    env: { ...process.env, DATABASE_URL: DB, OCTA_STAGE_DIR: dir, OCTA_FIGURE_DIR: join(dir, "figures") },
  });
  return stdout;
}

async function blockAt(ordinal: number) {
  const { rows } = await setup(
    "select id, body_md, version, console_edited from content_blocks where stage_id = '00' and ordinal = $1",
    [ordinal],
  );
  return rows[0] as { id: string; body_md: string; version: number; console_edited: boolean };
}

async function edit(ordinal: number, body: string) {
  const b = await blockAt(ordinal);
  const res = await app.inject({
    method: "PUT", url: `/api/v1/console/content/blocks/${b.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { body, version: b.version, reason: "fix in the console" },
  });
  expect(res.statusCode, res.body).toBe(200);
}

function mintToken(userId: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600,
    app_metadata: { role: "teacher" },
  })).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

beforeAll(async () => {
  w = await resetWorld();
  app = await buildServer(loadEnv({
    NODE_ENV: "test", DATABASE_URL: DB, EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET, ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv));
  await app.ready();
  token = mintToken(w.teacher);
  dir = await mkdtemp(join(tmpdir(), "octa-stages-"));
  await writeFile(join(dir, "00.md"), stageFile(SUMMARY, "The first block.", "The second block."));
}, 60_000);

afterAll(async () => {
  // Before the pool closes: a query after closePool() fails without a word.
  await setup("delete from figures where id like '00-sync-%'");
  await app?.close();
  await closePool();
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("sync-content and the console editor", () => {
  it("a first sync writes the blocks and a DRAFT summary, and puts nothing on stages.summary", async () => {
    await sync();
    expect((await blockAt(1)).body_md).toBe("The first block.");
    expect((await blockAt(2)).body_md).toBe("The second block.");
    const { rows } = await setup(
      "select ss.status, ss.draft, s.summary from stage_summaries ss join stages s on s.id = ss.stage_id where ss.stage_id = '00'",
    );
    expect(rows[0]).toEqual({ status: "draft", draft: SUMMARY, summary: null });
  });

  it("a console edit SURVIVES the next sync, and sync says so", async () => {
    await edit(1, "The first block, fixed in the console.");
    const out = await sync();
    expect((await blockAt(1))).toMatchObject({ body_md: "The first block, fixed in the console.", console_edited: true });
    expect(out).toMatch(/1 console edit\(s\) kept/);
    expect(out).toContain("00.md block 1");
  });

  it("--pull writes the edit into the file, and the next sync is idempotent", async () => {
    const before = await blockAt(1);
    const out = await sync("--pull");
    expect(out).toMatch(/1 console edit\(s\)\s+written into the files/);
    const file = await readFile(join(dir, "00.md"), "utf8");
    expect(file).toContain("<!-- block: prose -->\nThe first block, fixed in the console.\n\n<!-- block: prose -->");
    expect(file).toContain(`summary: "${SUMMARY}"`); // the front matter is untouched
    // No new version: the text did not change, only where it is recorded.
    expect(await blockAt(1)).toMatchObject({ console_edited: false, version: before.version });
    expect(await sync()).toMatch(/Idempotent/);
  });

  it("an edit in BOTH places is a conflict: the console text is kept and named", async () => {
    await edit(2, "The second block, from the console.");
    await writeFile(join(dir, "00.md"), (await readFile(join(dir, "00.md"), "utf8"))
      .replace("The second block.", "The second block, revised in the file."));
    const out = await sync();
    expect(out).toMatch(/1 conflict\(s\)/);
    expect((await blockAt(2)).body_md).toBe("The second block, from the console.");
    // --pull does not resolve a conflict: it would throw away the file's change.
    await sync("--pull");
    expect((await blockAt(2)).body_md).toBe("The second block, from the console.");
  });

  it("--take-file lets the file win, and the console text is kept in history", async () => {
    await sync("--take-file");
    expect(await blockAt(2)).toMatchObject({ body_md: "The second block, revised in the file.", console_edited: false });
    const { rows } = await setup(
      `select body_md, replaced_via from content_block_versions
        where block_id = $1 order by version desc limit 1`,
      [(await blockAt(2)).id],
    );
    expect(rows[0]).toEqual({ body_md: "The second block, from the console.", replaced_via: "sync" });
  });

  it("a summary whose text changes loses its approval, and leaves students' screens", async () => {
    const { rows } = await setup("select draft_hash from stage_summaries where stage_id = '00'");
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/00/approve",
      headers: { authorization: `Bearer ${token}` }, payload: { hash: rows[0].draft_hash },
    });
    expect(res.statusCode).toBe(200);
    expect(await sync()).not.toMatch(/withdrawn/); // unchanged text keeps its approval

    await writeFile(join(dir, "00.md"), (await readFile(join(dir, "00.md"), "utf8"))
      .replace(SUMMARY, "A revised summary nobody has read yet."));
    const out = await sync();
    expect(out).toMatch(/stage 00: its summary changed, so its approval was withdrawn/);
    const { rows: after } = await setup(
      "select ss.status, ss.draft, s.summary from stage_summaries ss join stages s on s.id = ss.stage_id where ss.stage_id = '00'",
    );
    expect(after[0]).toEqual({ status: "draft", draft: "A revised summary nobody has read yet.", summary: null });
  });

  it("refuses a summary_status line: approval no longer lives in the file", async () => {
    await writeFile(join(dir, "00.md"), stageFile(SUMMARY, "a", "b", "summary_status: approved\n"));
    await expect(sync()).rejects.toMatchObject({ stderr: expect.stringMatching(/summary_status is no longer read/) });
  });
});

/*
 * Drafted lesson text (instructor ruling, 5 Oct 2026): `NN.draft.md` beside
 * `NN.md` goes to the staff-only `chapter_drafts`, never to `content_blocks`,
 * until the instructor approves it on /content.
 */
describe("sync-content and drafted lesson text", () => {
  const DRAFT = (b1: string, b2: string, extra = "") => `---
stage: "00"
title: Orientation
---

<!-- block: prose -->
${b1}

<!-- block: prose${extra} -->
${b2}
`;
  const bodies = async () =>
    (await setup("select body_md from content_blocks where stage_id = '00' order by ordinal")).rows.map((r) => r.body_md);
  const draftRow = async () =>
    (await setup("select status, ever_approved, draft_hash from chapter_drafts where stage_id = '00'")).rows[0];

  it("a draft goes to chapter_drafts for review; students keep reading NN.md", async () => {
    await writeFile(join(dir, "00.md"), stageFile(SUMMARY, "Stub one.", "Stub two."));
    await writeFile(join(dir, "00.draft.md"), DRAFT("Drafted one.", "Drafted two."));
    const out = await sync("--take-file");
    expect(out).toMatch(/drafted lesson text: 0 chapter\(s\) approved, 1 to review on \/content/);
    expect(await bodies()).toEqual(["Stub one.", "Stub two."]);
    expect(await draftRow()).toMatchObject({ status: "draft", ever_approved: false });
  });

  it("once approved, sync never puts the stub back over the reviewed text", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/drafts/00/approve",
      headers: { authorization: `Bearer ${token}` }, payload: { hash: (await draftRow()).draft_hash },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(await bodies()).toEqual(["Drafted one.", "Drafted two."]);
    const out = await sync();
    expect(out).toMatch(/approved chapters left as reviewed: 00/);
    expect(await bodies()).toEqual(["Drafted one.", "Drafted two."]);
  });

  it("a changed draft withdraws its approval; students keep the last approved text", async () => {
    await writeFile(join(dir, "00.draft.md"), DRAFT("Drafted one, revised.", "Drafted two."));
    const out = await sync();
    expect(out).toMatch(/stage 00: its drafted text changed, so its approval was withdrawn/);
    expect(await draftRow()).toMatchObject({ status: "draft", ever_approved: true });
    expect(await bodies()).toEqual(["Drafted one.", "Drafted two."]);
  });

  it("a draft that misquotes the book fails like any other block", async () => {
    const book = resolve(ROOT, "docs/source/book/ch-10.md");
    let present = true;
    try {
      await readFile(book, "utf8");
    } catch {
      present = false;
    }
    if (!present) return; // the book is gitignored; `--verify` says so itself
    await writeFile(
      join(dir, "00.draft.md"),
      DRAFT("Drafted one.", "Two's complement is a representation that this textbook never once describes in these words at all.", ' source="ch-10.md 10.2"'),
    );
    await expect(sync()).rejects.toMatchObject({ stdout: expect.stringMatching(/do not match their cited source/) });
    await rm(join(dir, "00.draft.md"));
  });
});

/* ============================================================
 * Figures (6 Oct 2026, docs/FIGURES-AND-AUDIO.md): sync checks each drawing
 * and writes it as a DRAFT. A drawing that fails the check stops the whole
 * sync, and nothing of it is written.
 * ========================================================== */
describe("sync-content and figures", () => {
  const FIG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
  <title>The sync probe</title>
  <desc>One box.</desc>
  <rect x="10" y="10" width="60" height="40" class="fig-box"/>
</svg>
`;
  const withFigure = (id: string) =>
    stageFile(SUMMARY, "The first block.", "The second block.") +
    `
<!-- block: figure id="${id}" after="1.1" -->
A box, drawn for the sync test.
`;

  it("a figure file and a block naming it: the drawing is written as a draft, never served", async () => {
    await setup("delete from figures where id like '00-sync-%'");
    await mkdir(join(dir, "figures"), { recursive: true });
    await writeFile(join(dir, "figures", "00-sync-probe.svg"), FIG_SVG);
    await writeFile(join(dir, "00.md"), withFigure("00-sync-probe"));
    const out = await sync();
    expect(out).toMatch(/figures: 1 new/);
    const r = (await setup("select status, approved_svg, title from figures where id = '00-sync-probe'")).rows[0];
    expect(r).toMatchObject({ status: "draft", approved_svg: null, title: "The sync probe" });
    expect(await sync()).toMatch(/Idempotent/);
  });

  it("a block naming a figure with no file fails the sync", async () => {
    await writeFile(join(dir, "00.md"), withFigure("00-sync-missing"));
    await expect(sync("--verify")).rejects.toMatchObject({ stdout: expect.stringMatching(/has no content\/figures\/00-sync-missing\.svg/) });
  });

  it("a drawing carrying a script fails the sync, and nothing of it is written", async () => {
    await writeFile(join(dir, "figures", "00-sync-hostile.svg"), FIG_SVG.replace("</svg>", "<script>alert(1)</script></svg>"));
    await writeFile(join(dir, "00.md"), withFigure("00-sync-probe"));
    await expect(sync()).rejects.toMatchObject({ stdout: expect.stringMatching(/<script> is not a drawing element/) });
    expect((await setup("select count(*)::int n from figures where id = '00-sync-hostile'")).rows[0].n).toBe(0);
    await rm(join(dir, "figures", "00-sync-hostile.svg"));
  });

  it("a redrawn figure withdraws its approval; the approved drawing stays served", async () => {
    await setup(
      "update figures set status = 'approved', approved_hash = svg_hash, approved_svg = svg, ever_approved = true where id = '00-sync-probe'",
    );
    await writeFile(join(dir, "figures", "00-sync-probe.svg"), FIG_SVG.replace('width="60"', 'width="90"'));
    const out = await sync();
    expect(out).toMatch(/figure 00-sync-probe: its drawing changed, so its approval was withdrawn/);
    const r = (await setup("select status, svg, approved_svg from figures where id = '00-sync-probe'")).rows[0];
    expect(r.status).toBe("draft");
    expect(r.svg).toContain('width="90"');
    expect(r.approved_svg).toContain('width="60"');
  });
});

/* ============================================================
 * sync-content and the Studio's editor (8 Oct 2026; docs/STUDIO-EDITOR-PLAN.md)
 *
 * Typing in the Studio makes a WORKING COPY (a chapter_drafts row, origin
 * 'console'); publishing it hands the chapter to the console
 * (stages.content_owner = 'console'). Sync must never undo either: it used to
 * delete any draft whose file had gone, and rewrite live blocks from the file.
 * ========================================================== */
describe("sync-content and the Studio's editor", () => {
  beforeAll(async () => {
    await rm(join(dir, "00.draft.md"), { force: true });
    await writeFile(join(dir, "00.md"), stageFile(SUMMARY, "File block one.", "File block two."));
    await setup("delete from chapter_drafts where stage_id = '00'");
    await setup("update stages set content_owner = 'files' where id = '00'");
    await sync("--take-file");
  });

  it("a teacher's working copy survives a sync even though no draft file exists", async () => {
    await setup(
      `insert into chapter_drafts (stage_id, blocks, draft_hash, origin, version, base_hash, edited_by, edited_at)
       values ('00', $1::jsonb, 'typed-in-the-studio', 'console', 1, 'base', $2, now())`,
      [JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", kind: "prose", body: "Typed in the Studio.", meta: {} }]), w.teacher],
    );
    const out = await sync();
    const { rows } = await setup("select draft_hash, origin, version from chapter_drafts where stage_id = '00'");
    expect(rows).toEqual([{ draft_hash: "typed-in-the-studio", origin: "console", version: 1 }]);
    expect(out).toMatch(/working copies being typed in the Studio, left alone: 00/);
  });

  it("a drafted chapter a teacher has taken over is not overwritten by its file", async () => {
    await writeFile(join(dir, "00.draft.md"), `---\nstage: "00"\ntitle: Orientation\n---\n\n<!-- block: prose -->\nThe file's draft text.\n`);
    await sync();
    const { rows } = await setup("select draft_hash, origin from chapter_drafts where stage_id = '00'");
    expect(rows).toEqual([{ draft_hash: "typed-in-the-studio", origin: "console" }]);
    await rm(join(dir, "00.draft.md"), { force: true });
  });

  it("a chapter the Studio owns is never rewritten from a file, and sync says so", async () => {
    await setup("delete from chapter_drafts where stage_id = '00'");
    await setup("update stages set content_owner = 'console' where id = '00'");
    const before = await setup("select ordinal, body_md, version from content_blocks where stage_id = '00' order by ordinal");
    await writeFile(join(dir, "00.md"), stageFile(SUMMARY, "A file edit sync must not apply.", "Nor this one."));
    const out = await sync("--take-file");
    const after = await setup("select ordinal, body_md, version from content_blocks where stage_id = '00' order by ordinal");
    expect(after.rows).toEqual(before.rows);
    expect(out).toMatch(/chapters the Studio owns, left alone: 00/);
    await setup("update stages set content_owner = 'files' where id = '00'");
  });
});
