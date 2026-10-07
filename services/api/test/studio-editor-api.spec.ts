import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { blocksHash } from "../src/working-copy.js";
import { setup, closePool, runAs, authenticated, wasDenied, denialReason } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * The Studio as an editor, E1.1 (docs/STUDIO-EDITOR-PLAN.md; instructor rulings,
 * 8 Oct 2026): a chapter's WORKING COPY is a draft students never see; Publish
 * puts it live; the editing teacher may publish their own typed edit.
 *
 * Denials first (hard rule 8): a student and anon are refused every route; a
 * STAFF CLIENT can no longer write `content_blocks` (the API is the only
 * writer, so Publish cannot be bypassed with a token). Then what a save
 * refuses (a quote or a figure typed into existence), and every effect of
 * Publish: block ids kept so history follows the block, ordinals rewritten,
 * deletions archived, the chapter handed to the console, one audit row.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";
const mint = (userId: string, role: string): string => {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { role },
  })).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
};
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const FIG = "00-editor-probe";
const DRAWING = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="none" stroke="currentColor"/></svg>';
const QUOTE = "A verbatim quote from the book.";

let app: FastifyInstance;
let w: World;
let admin = "";
let tNone = "";
let teacherTok = "";
let adminTok = "";
let noClassTok = "";
let studentTok = "";

interface Row { id: string; ordinal: number; kind: string; body_md: string; meta: Record<string, string>; version: number }

async function user(email: string, role: string, name: string): Promise<string> {
  const r = await setup(
    `insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), $1, $2::jsonb) returning id::text`,
    [email, JSON.stringify({ role })],
  );
  const id = r.rows[0].id as string;
  await setup(`insert into profiles (id, full_name, role) values ($1, $2, $3::user_role)`, [id, name, role]);
  return id;
}

/** Stage 00 as five live topics: prose, a locked quote, code, prose, a locked figure. */
async function seedChapter(): Promise<Row[]> {
  await setup(`delete from chapter_drafts where stage_id = '00'`);
  await setup(`update stages set content_owner = 'files' where id = '00'`);
  await setup(`delete from content_blocks where stage_id = '00'`);
  await setup(`delete from figures where id = $1`, [FIG]);
  await setup(
    `insert into figures (id, stage_id, title, svg, svg_hash) values ($1, '00', 'Probe', $2, 'fixture-hash')`,
    [FIG, DRAWING],
  );
  const r = await setup(
    `insert into content_blocks (stage_id, ordinal, kind, body_md, meta) values
       ('00', 1, 'prose',  E'## Alpha\n\nFirst paragraph.', '{}'),
       ('00', 2, 'quote',  $1, '{"source":"ch-01.md 1.1"}'),
       ('00', 3, 'code',   'mov ax, bx', '{}'),
       ('00', 4, 'prose',  'Second paragraph.', '{}'),
       ('00', 5, 'figure', 'Caption of the probe figure.', jsonb_build_object('id', $2::text, 'after', '1.1'))
     returning id::text, ordinal, kind, body_md, meta, version`,
    [QUOTE, FIG],
  );
  return (r.rows as Row[]).sort((a, b) => a.ordinal - b.ordinal);
}

const asBlocks = (rows: Row[]) => rows.map((r) => ({ id: r.id, kind: r.kind, body: r.body_md, meta: r.meta }));
const get = (t: string | null) => app.inject({ method: "GET", url: "/api/v1/console/content/00/working", headers: t ? auth(t) : {} });
const put = (t: string | null, payload: unknown) =>
  app.inject({ method: "PUT", url: "/api/v1/console/content/00/working", headers: t ? auth(t) : {}, payload: payload as object });
const discard = (t: string | null) => app.inject({ method: "DELETE", url: "/api/v1/console/content/00/working", headers: t ? auth(t) : {} });
const publish = (t: string | null, payload: unknown) =>
  app.inject({ method: "POST", url: "/api/v1/console/content/00/publish", headers: t ? auth(t) : {}, payload: payload as object });

async function live(): Promise<Row[]> {
  const r = await setup(`select id::text, ordinal, kind, body_md, meta, version from content_blocks where stage_id = '00' order by ordinal`);
  return r.rows as Row[];
}

beforeAll(async () => {
  w = await resetWorld();
  admin = await user("editor-admin@octa-test.local", "admin", "The Admin");
  tNone = await user("editor-none@octa-test.local", "teacher", "Teacher With No Class");
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
  teacherTok = mint(w.teacher, "teacher"); // holds a CPE 412 class (the fixture)
  adminTok = mint(admin, "admin");
  noClassTok = mint(tNone, "teacher");
  studentTok = mint(w.studentA, "student");
}, 120_000);

afterAll(async () => {
  await setup(`delete from chapter_drafts where stage_id = '00'`);
  await setup(`update stages set content_owner = 'files' where id = '00'`);
  await setup(`delete from figures where id = $1`, [FIG]);
  await app?.close();
  await closePool();
});

/* ---------------------------------------------------------------- denials */

describe("denials first: a student and anon are refused every working-copy route", () => {
  it("student 403, no token 401, on all four, and nothing is written", async () => {
    await seedChapter();
    const body = { version: 0, blocks: [{ kind: "prose", body: "x", meta: {} }] };
    for (const [name, call] of [
      ["GET", (t: string | null) => get(t)],
      ["PUT", (t: string | null) => put(t, body)],
      ["DELETE", (t: string | null) => discard(t)],
      ["POST publish", (t: string | null) => publish(t, { hash: "x", reason: "a reason" })],
    ] as const) {
      expect((await call(studentTok)).statusCode, `${name} student`).toBe(403);
      expect((await call(null)).statusCode, `${name} anon`).toBe(401);
    }
    const n = await setup(`select count(*)::int n from chapter_drafts where stage_id = '00'`);
    expect(n.rows[0].n).toBe(0);
  });
});

describe("denials first: a staff client can no longer write the chapter students read", () => {
  it("a teacher's own token cannot update, insert or delete content_blocks, and the text is unchanged", async () => {
    await seedChapter();
    const t = authenticated(w.teacher, "teacher");
    const upd = await runAs(t, "update content_blocks set body_md = 'Sneaked in.' where stage_id = '00' returning id");
    expect(upd.error, denialReason(upd)).toBeNull();
    expect(upd.rowCount, "an update got through RLS").toBe(0);
    const ins = await runAs(t, "insert into content_blocks (stage_id, ordinal, kind, body_md) values ('00', 99, 'prose', 'Sneaked in.')");
    expect(wasDenied(ins), denialReason(ins)).toBe(true);
    const del = await runAs(t, "delete from content_blocks where stage_id = '00' returning id");
    expect(del.rowCount, "a delete got through RLS").toBe(0);
    const after = await live();
    expect(after).toHaveLength(5);
    expect(after.map((r) => r.body_md)).not.toContain("Sneaked in.");
  });

  it("POSITIVE CONTROL: a teacher still READS the chapter, and the service role still writes it", async () => {
    await seedChapter();
    const read = await runAs(authenticated(w.teacher, "teacher"), "select count(*)::int n from content_blocks where stage_id = '00'");
    expect(read.error).toBeNull();
    expect(read.rows[0]!.n).toBe(5);
    const { service } = await import("./helpers/rls.js");
    const write = await runAs(service, "update content_blocks set body_md = 'By the API.' where stage_id = '00' and ordinal = 4 returning id");
    expect(write.error, denialReason(write)).toBeNull();
    expect(write.rowCount).toBe(1);
  });
});

/* ------------------------------------------------------------------- read */

describe("GET the working copy", () => {
  beforeEach(async () => { await seedChapter(); });

  it("with nothing unpublished it is the live chapter: version 0, ids, quotes and figures locked", async () => {
    const res = await get(teacherTok);
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b).toMatchObject({ stageId: "00", source: "live", origin: null, version: 0, owner: "files", stale: false });
    expect(b.blocks.map((x: { kind: string; locked: boolean }) => [x.kind, x.locked])).toEqual([
      ["prose", false], ["quote", true], ["code", false], ["prose", false], ["figure", true],
    ]);
    expect(b.blocks.every((x: { id: string | null }) => typeof x.id === "string")).toBe(true);
    const rows = await live();
    expect(b.liveHash).toBe(blocksHash(asBlocks(rows)));
    expect(b.hash).toBe(b.liveHash);
  });
});

/* ------------------------------------------------------------------- save */

describe("saving the working copy", () => {
  beforeEach(async () => { await seedChapter(); });

  it("the first save makes a console draft of the whole chapter, based on the live text", async () => {
    const rows = await live();
    const blocks = asBlocks(rows);
    blocks[0] = { ...blocks[0]!, body: "## Alpha\n\nFirst paragraph, tightened." };
    const res = await put(teacherTok, { version: 0, blocks });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, version: 1 });
    const d = await setup(`select origin, version, status, base_hash, edited_by::text, draft_hash from chapter_drafts where stage_id = '00'`);
    expect(d.rows[0]).toMatchObject({ origin: "console", version: 1, status: "draft", edited_by: w.teacher });
    expect(d.rows[0].base_hash).toBe(blocksHash(asBlocks(rows)));
    expect(d.rows[0].draft_hash).toBe(res.json().hash);
    // Students read the live text, untouched.
    expect((await live())[0]!.body_md).toBe("## Alpha\n\nFirst paragraph.");
    const g = (await get(teacherTok)).json();
    expect(g).toMatchObject({ source: "draft", origin: "console", version: 1, stale: false });
  });

  it("a save that names an old version is refused (409) and changes nothing", async () => {
    const blocks = asBlocks(await live());
    expect((await put(teacherTok, { version: 0, blocks })).statusCode).toBe(200);
    const again = await put(adminTok, { version: 0, blocks: [...blocks, { id: randomUUID(), kind: "prose", body: "Mine.", meta: {} }] });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.message).toMatch(/saved .* since you opened it|reload/i);
    const d = await setup(`select version, jsonb_array_length(blocks) n from chapter_drafts where stage_id = '00'`);
    expect(d.rows[0]).toEqual({ version: 1, n: 5 });
  });

  it("saving the same text again keeps the version (an autosave that changed nothing)", async () => {
    const blocks = asBlocks(await live());
    await put(teacherTok, { version: 0, blocks });
    const r = await put(teacherTok, { version: 1, blocks });
    expect(r.statusCode).toBe(200);
    expect(r.json().version).toBe(1);
  });

  it("a change from version 1 is version 2", async () => {
    const blocks = asBlocks(await live());
    await put(teacherTok, { version: 0, blocks });
    const r = await put(teacherTok, { version: 1, blocks: [...blocks].reverse() });
    expect(r.json().version).toBe(2);
  });

  it("typing is free for any teacher: one with no class may save a draft (publishing is what is gated)", async () => {
    const blocks = asBlocks(await live());
    expect((await put(noClassTok, { version: 0, blocks })).statusCode).toBe(200);
  });

  describe("a quote and a figure are locked", () => {
    it("a quote's words cannot change", async () => {
      const blocks = asBlocks(await live());
      blocks[1] = { ...blocks[1]!, body: "A quote the teacher improved." };
      const r = await put(teacherTok, { version: 0, blocks });
      expect(r.statusCode).toBe(400);
      expect(r.json().error.message).toMatch(/quote/i);
    });
    it("a quote cannot be typed into existence", async () => {
      const blocks = asBlocks(await live());
      const r = await put(teacherTok, {
        version: 0,
        blocks: [...blocks, { id: randomUUID(), kind: "quote", body: "Words nobody checked.", meta: { source: "ch-01.md 1.9" } }],
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().error.message).toMatch(/quote/i);
    });
    it("only a quote carries a source: a prose topic with one is refused", async () => {
      const blocks = asBlocks(await live());
      blocks[3] = { ...blocks[3]!, meta: { source: "ch-01.md 1.1" } };
      expect((await put(teacherTok, { version: 0, blocks })).statusCode).toBe(400);
    });
    it("a quote and a figure may be moved or deleted", async () => {
      const blocks = asBlocks(await live());
      const moved = [blocks[1]!, blocks[4]!, blocks[0]!, blocks[3]!]; // the code topic is deleted
      const r = await put(teacherTok, { version: 0, blocks: moved });
      expect(r.statusCode).toBe(200);
    });
    it("a quote deleted in the draft can be put back, because live still has it", async () => {
      const blocks = asBlocks(await live());
      const without = blocks.filter((b) => b.kind !== "quote");
      expect((await put(teacherTok, { version: 0, blocks: without })).statusCode).toBe(200);
      expect((await put(teacherTok, { version: 1, blocks })).statusCode).toBe(200);
    });
    it("a figure's caption cannot change", async () => {
      const blocks = asBlocks(await live());
      blocks[4] = { ...blocks[4]!, body: "A different caption." };
      expect((await put(teacherTok, { version: 0, blocks })).statusCode).toBe(400);
    });
  });

  describe("what else a save refuses", () => {
    it("a new figure topic (only moving or deleting one is allowed)", async () => {
      const blocks = asBlocks(await live());
      const r = await put(teacherTok, { version: 0, blocks: [...blocks, { id: randomUUID(), kind: "figure", body: "x", meta: { id: FIG } }] });
      expect(r.statusCode).toBe(400);
    });
    it("metadata an editor has no business setting", async () => {
      const blocks = asBlocks(await live());
      blocks[0] = { ...blocks[0]!, meta: { id: "00-anything" } };
      expect((await put(teacherTok, { version: 0, blocks })).statusCode).toBe(400);
    });
    it("two topics with one id", async () => {
      const blocks = asBlocks(await live());
      const id = randomUUID();
      const r = await put(teacherTok, {
        version: 0,
        blocks: [...blocks, { id, kind: "prose", body: "a", meta: {} }, { id, kind: "prose", body: "b", meta: {} }],
      });
      expect(r.statusCode).toBe(400);
    });
    it("a chapter with no topics at all", async () => {
      expect((await put(teacherTok, { version: 0, blocks: [] })).statusCode).toBe(400);
    });
    it("POSITIVE CONTROL: a new prose, callout and code topic are fine", async () => {
      const blocks = asBlocks(await live());
      const r = await put(teacherTok, {
        version: 0,
        blocks: [
          ...blocks,
          { id: randomUUID(), kind: "prose", body: "## New\n\nA new topic.", meta: {} },
          { id: randomUUID(), kind: "callout", body: "Worth knowing.", meta: { kind: "note" } },
          { id: randomUUID(), kind: "code", body: "add ax, 1", meta: {} },
        ],
      });
      expect(r.statusCode).toBe(200);
    });
  });
});

/* ---------------------------------------------------------------- discard */

describe("discarding a working copy", () => {
  beforeEach(async () => { await seedChapter(); });

  it("a console draft is thrown away, audited, and the chapter reads live again", async () => {
    await put(teacherTok, { version: 0, blocks: asBlocks(await live()) });
    const r = await discard(teacherTok);
    expect(r.statusCode).toBe(200);
    const n = await setup(`select count(*)::int n from chapter_drafts where stage_id = '00'`);
    expect(n.rows[0].n).toBe(0);
    expect((await get(teacherTok)).json().source).toBe("live");
    const a = await setup(`select actor_id::text from audit_log where action = 'chapter.discard' and target_id = '00' order by at desc limit 1`);
    expect(a.rows[0].actor_id).toBe(w.teacher);
  });

  it("a drafted chapter waiting for review is not discarded here (send it back instead)", async () => {
    await setup(
      `insert into chapter_drafts (stage_id, blocks, draft_hash, origin) values ('00', $1::jsonb, 'file-hash', 'file')`,
      [JSON.stringify([{ kind: "prose", body: "Drafted from the book.", meta: {} }])],
    );
    const r = await discard(teacherTok);
    expect(r.statusCode).toBe(409);
    expect(r.json().error.message).toMatch(/send it back/i);
    const n = await setup(`select count(*)::int n from chapter_drafts where stage_id = '00'`);
    expect(n.rows[0].n).toBe(1);
  });

  it("nothing to discard is a 404", async () => {
    expect((await discard(teacherTok)).statusCode).toBe(404);
  });
});

/* ---------------------------------------------------------------- publish */

describe("publishing", () => {
  beforeEach(async () => { await seedChapter(); });

  /** A real edit of every kind: reorder, edit, delete, insert. Returns what Publish should make. */
  async function typeAnEdit(token = teacherTok) {
    const rows = await live();
    const [prose1, quote, , prose2, fig] = asBlocks(rows) as [ReturnType<typeof asBlocks>[number], ...ReturnType<typeof asBlocks>];
    const fresh = { id: randomUUID(), kind: "prose", body: "## Added\n\nA brand new topic.", meta: {} };
    const edited = { ...prose1!, body: "## Alpha\n\nFirst paragraph, tightened." };
    const blocks = [fig!, edited, fresh, quote!, prose2!]; // the code topic is deleted
    const saved = await put(token, { version: 0, blocks });
    expect(saved.statusCode, saved.body).toBe(200);
    return { rows, blocks, hash: saved.json().hash as string, fresh };
  }

  it("needs a working copy", async () => {
    const r = await publish(teacherTok, { hash: "x", reason: "nothing to publish" });
    expect(r.statusCode).toBe(404);
  });

  it("is refused to a teacher who holds no class of the subject, and nothing changes", async () => {
    const { hash } = await typeAnEdit(noClassTok);
    const before = await live();
    const r = await publish(noClassTok, { hash, reason: "my edit" });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.message).toMatch(/teacher of CPE 412 or the admin/i);
    expect(await live()).toEqual(before);
    const n = await setup(`select count(*)::int n from chapter_drafts where stage_id = '00'`);
    expect(n.rows[0].n).toBe(1);
  });

  it("needs a reason", async () => {
    const { hash } = await typeAnEdit();
    expect((await publish(teacherTok, { hash, reason: "" })).statusCode).toBe(400);
    expect((await publish(teacherTok, { hash })).statusCode).toBe(400);
  });

  it("is of the text the teacher read: a draft that changed since is refused (409)", async () => {
    const { hash, blocks } = await typeAnEdit();
    await put(adminTok, { version: 1, blocks: [...blocks, { id: randomUUID(), kind: "prose", body: "Someone else's addition.", meta: {} }] });
    const before = await live();
    const r = await publish(teacherTok, { hash, reason: "what I read" });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.message).toMatch(/changed since you opened it/i);
    expect(await live()).toEqual(before);
  });

  it("is refused if the published chapter changed since the draft began (409)", async () => {
    const { hash } = await typeAnEdit();
    await setup(`update content_blocks set body_md = 'Changed live meanwhile.' where stage_id = '00' and ordinal = 4`);
    const r = await publish(teacherTok, { hash, reason: "my edit" });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.message).toMatch(/published chapter changed/i);
    const g = (await get(teacherTok)).json();
    expect(g.stale).toBe(true);
  });

  it("makes the draft live, keeping each block's id and history, and hands the chapter to the console", async () => {
    const { rows, blocks, hash, fresh } = await typeAnEdit();
    const [prose1, quote, code, prose2, fig] = rows as [Row, Row, Row, Row, Row];
    const r = await publish(teacherTok, { hash, reason: "Tighten the opening, add a topic, drop the listing" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, added: 1, removed: 1, edited: 1 });

    const after = await live();
    expect(after.map((x) => x.ordinal)).toEqual([1, 2, 3, 4, 5]);
    expect(after.map((x) => x.id)).toEqual([fig.id, prose1.id, fresh.id, quote.id, prose2.id]);
    expect(after.map((x) => x.kind)).toEqual(["figure", "prose", "prose", "quote", "prose"]);
    expect(after[1]!.body_md).toBe("## Alpha\n\nFirst paragraph, tightened.");
    expect(after.map((x) => x.body_md)).toEqual(blocks.map((b) => b.body));

    // The edited block kept its id, so its history follows it: version 2, the old text archived with the reason.
    expect(after[1]!.version).toBe(2);
    const h = await setup(`select version, body_md, replaced_via, reason, replaced_by::text from content_block_versions where block_id = $1`, [prose1.id]);
    expect(h.rows).toEqual([{
      version: 1, body_md: "## Alpha\n\nFirst paragraph.", replaced_via: "console",
      reason: "Tighten the opening, add a topic, drop the listing", replaced_by: w.teacher,
    }]);
    // A moved block with unchanged text is not a new version.
    expect(after[3]!.version).toBe(quote.version);
    // The deleted topic is archived, not lost.
    const gone = await setup(`select version, body_md from content_block_versions where block_id = $1`, [code.id]);
    expect(gone.rows).toEqual([{ version: 1, body_md: "mov ax, bx" }]);

    const d = await setup(`select count(*)::int n from chapter_drafts where stage_id = '00'`);
    expect(d.rows[0].n).toBe(0);
    const s = await setup(`select content_owner from stages where id = '00'`);
    expect(s.rows[0].content_owner).toBe("console");
    expect((await get(teacherTok)).json()).toMatchObject({ source: "live", owner: "console" });
  });

  it("writes one audit row that says the editor published their own edit", async () => {
    const { hash } = await typeAnEdit();
    await publish(teacherTok, { hash, reason: "my own edit" });
    // The audit log is append-only: earlier tests' rows stay, so this one is found by its hash.
    const a = await setup(`select actor_id::text, payload from audit_log where action = 'chapter.publish' and target_id = '00' and payload->>'hash' = $1`, [hash]);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].actor_id).toBe(w.teacher);
    expect(a.rows[0].payload).toMatchObject({ reason: "my own edit", hash, origin: "console", selfApproved: true, added: 1, removed: 1, edited: 1 });
  });

  it("the admin may publish a teacher's draft, and it is not self-approved", async () => {
    const { hash } = await typeAnEdit(teacherTok);
    const r = await publish(adminTok, { hash, reason: "reviewed and published" });
    expect(r.statusCode, r.body).toBe(200);
    const a = await setup(`select payload from audit_log where action = 'chapter.publish' and target_id = '00' and payload->>'hash' = $1`, [hash]);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].payload.selfApproved).toBeFalsy();
  });

  it("refuses a topic whose id belongs to another chapter's live text", async () => {
    const rows = await live();
    const other = await setup(`select id::text from content_blocks where stage_id = '05' limit 1`);
    const blocks = [...asBlocks(rows), { id: other.rows[0].id as string, kind: "prose", body: "Not mine.", meta: {} }];
    await setup(
      `insert into chapter_drafts (stage_id, blocks, draft_hash, origin, version, base_hash, edited_by, edited_at)
       values ('00', $1::jsonb, 'clash-hash', 'console', 1, $2, $3, now())`,
      [JSON.stringify(blocks), blocksHash(asBlocks(rows)), w.teacher],
    );
    const r = await publish(teacherTok, { hash: "clash-hash", reason: "a stolen id" });
    expect(r.statusCode).toBe(400);
    expect(await live()).toHaveLength(5);
  });
});

/* ----------------------------------------------------- the database's rule */

describe("the database holds who may publish, for every role, the service role included", () => {
  const draft = async (origin: string, extra: Record<string, string | null> = {}) => {
    await setup(`delete from chapter_drafts where stage_id = '00'`);
    await setup(
      `insert into chapter_drafts (stage_id, blocks, draft_hash, origin, authored_by, edited_by, edited_at)
       values ('00', $1::jsonb, 'h', $2, $3, $4, now())`,
      [JSON.stringify([{ kind: "prose", body: "x", meta: {} }]), origin, extra.authored ?? null, extra.edited ?? null],
    );
  };
  const approveAs = async (who: string) => {
    const { service } = await import("./helpers/rls.js");
    return runAs(service, `update chapter_drafts set status = 'approved', approved_hash = draft_hash, reviewed_by = $1 where stage_id = '00' returning self_approved`, [who]);
  };

  it("a teacher with no class cannot approve any draft", async () => {
    await draft("console", { edited: tNone });
    const r = await approveAs(tNone);
    expect(r.error?.message, denialReason(r)).toMatch(/not a teacher of/i);
  });

  it("a typed draft may be approved by its own editor, and the row records it", async () => {
    await draft("console", { edited: w.teacher });
    const r = await approveAs(w.teacher);
    expect(r.error, denialReason(r)).toBeNull();
    expect(r.rows[0]!.self_approved).toBe(true);
  });

  it("a draft written by someone else (the files, the AI) may NOT be approved by its author", async () => {
    await draft("file", { authored: w.teacher });
    const r = await approveAs(w.teacher);
    expect(r.error?.message, denialReason(r)).toMatch(/author of a version cannot approve/i);
  });

  it("POSITIVE CONTROL: another teacher of the subject approves it, not self-approved", async () => {
    await draft("file", { authored: w.teacher });
    // The admin is always a teacher of every subject.
    const r = await approveAs(admin);
    expect(r.error, denialReason(r)).toBeNull();
    expect(r.rows[0]!.self_approved).toBe(false);
  });
});
