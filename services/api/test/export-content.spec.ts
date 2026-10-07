import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setup, closePool } from "./helpers/rls.js";
import { resetWorld } from "./helpers/fixtures.js";

/**
 * `scripts/export-content.mjs` (E1.4, docs/STUDIO-EDITOR-PLAN.md): the way a
 * chapter the Studio owns gets back into git. A chapter published from the
 * editor lives only in the database, and Supabase Free keeps no backups, so
 * the export is the backup. Run for real, into a temporary folder.
 */

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT = resolve(ROOT, "scripts/export-content.mjs");
const DB = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa";

let out: string;

async function exportContent(...flags: string[]): Promise<string> {
  const { stdout } = await run(process.execPath, [SCRIPT, ...flags], {
    env: { ...process.env, DATABASE_URL: DB, OCTA_EXPORT_DIR: out },
  });
  return stdout.replace(/\x1b\[[0-9;]*m/g, "");
}

beforeAll(async () => {
  await resetWorld();
  out = await mkdtemp(join(tmpdir(), "octa-export-"));
  await setup(`update stages set content_owner = 'files'`);
  await setup(
    `insert into content_blocks (stage_id, ordinal, kind, body_md, meta) values
       ('00', 1, 'prose', 'Welcome to the boot sequence.', '{}'),
       ('00', 2, 'quote', 'the exact words', '{"source":"ch-00.md 0.1"}'::jsonb)
     on conflict do nothing`,
  );
}, 60_000);

afterAll(async () => {
  await rm(out, { recursive: true, force: true });
  await closePool();
});

describe("export-content", () => {
  it("says there is nothing to export, and writes nothing, while no chapter is the Studio's", async () => {
    const text = await exportContent();
    expect(text).toContain("nothing to export");
    expect(await readdir(out)).toEqual([]);
  });

  it("writes a chapter the Studio owns, as JSON that can put it back and markdown that can be read in a diff", async () => {
    await setup(`update stages set content_owner = 'console' where id = '00'`);
    await exportContent();
    expect((await readdir(out)).sort()).toEqual(["00.json", "00.md"]);
    const json = JSON.parse(await readFile(join(out, "00.json"), "utf8"));
    expect(json.stageId).toBe("00");
    expect(json.blocks.map((b: { ordinal: number }) => b.ordinal)).toEqual([...json.blocks.map((b: { ordinal: number }) => b.ordinal)].sort((a, b) => a - b));
    const prose = json.blocks.find((b: { body: string }) => b.body === "Welcome to the boot sequence.");
    expect(prose).toMatchObject({ kind: "prose", meta: {} });
    expect(prose.id).toMatch(/^[0-9a-f-]{36}$/);
    const quote = json.blocks.find((b: { kind: string }) => b.kind === "quote");
    expect(quote.meta).toEqual({ source: "ch-00.md 0.1" });
    const md = await readFile(join(out, "00.md"), "utf8");
    expect(md).toContain("Welcome to the boot sequence.");
    expect(md).toContain("> the exact words");
    expect(md).toContain("(ch-00.md 0.1)");
  });

  it("a second run changes nothing, so git shows only real edits; a real edit changes one chapter", async () => {
    expect(await exportContent()).toContain("0 changed");
    await setup(`update content_blocks set body_md = 'Welcome back.' where stage_id = '00' and ordinal = 1`);
    const text = await exportContent();
    expect(text).toContain("1 changed");
    expect(await readFile(join(out, "00.md"), "utf8")).toContain("Welcome back.");
  });

  it("--check says what would change and writes nothing", async () => {
    await setup(`update content_blocks set body_md = 'Changed again.' where stage_id = '00' and ordinal = 1`);
    const text = await exportContent("--check");
    expect(text).toContain("would change");
    expect(await readFile(join(out, "00.md"), "utf8")).not.toContain("Changed again.");
  });

  it("leaves a chapter the files still own alone", async () => {
    await setup(`update stages set content_owner = 'files' where id = '00'`);
    const before = await readFile(join(out, "00.json"), "utf8");
    const text = await exportContent();
    expect(text).toContain("nothing to export");
    expect(await readFile(join(out, "00.json"), "utf8")).toBe(before);
  });

  it("writes the moons the Studio owns, retired ones too, and nothing for moons the file still owns", async () => {
    await setup(`insert into objectives (id, stage_id, code, bloom_level, level, competency, description, status, owner, retired_at) values
      ('01.1','01','01.1','remember',6,'read','Still the file''s moon','live','file',null),
      ('01.2','01','01.2','understand',5,'trace','A moon a teacher reworded','live','console',null),
      ('01.3','01','01.3','apply',4,'trace','A moon a teacher retired','retired','console', now())`);
    const text = await exportContent();
    expect(text).toContain("01  3 moon(s)");
    const json = JSON.parse(await readFile(join(out, "01.moons.json"), "utf8"));
    expect(json.stageId).toBe("01");
    expect(json.moons.map((m: { id: string; status: string }) => [m.id, m.status])).toEqual([["01.1", "live"], ["01.2", "live"], ["01.3", "retired"]]);
    expect(json.moons[2].retiredAt).toMatch(/^[0-9]{4}-/);
    expect((await readdir(out)).includes("00.json")).toBe(true);
    expect(await exportContent()).toContain("0 changed");
  });
});
