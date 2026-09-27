import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    env: { ...process.env, DATABASE_URL: DB, OCTA_STAGE_DIR: dir },
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
