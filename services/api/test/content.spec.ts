import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import { consoleEdit, resetWorld, type World } from "./helpers/fixtures.js";

/**
 * `/content`: the block editor and summary review (instructor rulings, 28 Sep
 * 2026; `design/templates/console/content/SPEC.md`).
 *
 * The denials come first. Both writes change what students read: an edit
 * changes a chapter's text now, and an approval puts a summary on the map.
 * A student token must be refused on every route AND the database must be
 * unchanged afterwards, because a 403 that still wrote is the worst result.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

const DRAFT = "Orientation: how the course runs, what the map shows, and how a stage opens.";
const DRAFT_HASH = "fixture-hash-00";

let app: FastifyInstance;
let w: World;
let teacherToken: string;
let studentToken: string;
let proseId: string;
let quoteId: string;

async function block(id: string) {
  const { rows } = await setup(
    "select body_md, version, console_edited from content_blocks where id = $1",
    [id],
  );
  return rows[0] as { body_md: string; version: number; console_edited: boolean };
}

async function summaryRow() {
  const { rows } = await setup(
    `select ss.status, ss.note, ss.reviewed_by, s.summary
       from stage_summaries ss join stages s on s.id = ss.stage_id where ss.stage_id = '00'`,
  );
  return rows[0] as { status: string; note: string | null; reviewed_by: string | null; summary: string | null };
}

beforeAll(async () => {
  w = await resetWorld();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
  teacherToken = mintToken(w.teacher, "teacher");
  studentToken = mintToken(w.studentA, "student");

  const { rows } = await setup(
    `with q as (
       insert into content_blocks (stage_id, ordinal, kind, body_md, meta)
       values ('00', 2, 'quote', 'A quoted definition, verbatim from the book.', '{"source":"ch-01.md 1.1"}')
       returning id
     )
     select (select id from content_blocks where stage_id = '00' and ordinal = 1) as prose,
            (select id from q) as quote`,
  );
  proseId = rows[0].prose;
  quoteId = rows[0].quote;
  await setup(
    `insert into stage_summaries (stage_id, draft, draft_hash) values ('00', $1, $2)`,
    [DRAFT, DRAFT_HASH],
  );
}, 60_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const as = (token: string) => ({ authorization: `Bearer ${token}` });

describe("denials — a student reaches none of it, and nothing changes", () => {
  it("cannot open a chapter's editor", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/00", headers: as(studentToken) });
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain(DRAFT);
  });

  it("cannot read a block's history", async () => {
    const res = await app.inject({
      method: "GET", url: `/api/v1/console/content/blocks/${proseId}/history`, headers: as(studentToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it("cannot edit a block, and the block is unchanged", async () => {
    const before = await block(proseId);
    const res = await app.inject({
      method: "PUT", url: `/api/v1/console/content/blocks/${proseId}`, headers: as(studentToken),
      payload: { body: "Vandalised.", version: before.version, reason: "because I can" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(await block(proseId)).toEqual(before);
  });

  it("cannot approve a summary, and it stays off students' screens", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/00/approve", headers: as(studentToken),
      payload: { hash: DRAFT_HASH },
    });
    expect(res.statusCode).toBe(403);
    expect(await summaryRow()).toMatchObject({ status: "draft", summary: null });
  });

  it("cannot send one back", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/00/send-back", headers: as(studentToken),
      payload: { reason: "I do not like it" },
    });
    expect(res.statusCode).toBe(403);
    expect((await summaryRow()).status).toBe("draft");
  });

  it("an unauthenticated request is refused outright", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/00" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /console/content/:stageId — one chapter", () => {
  it("returns its blocks in order, says which are editable, and carries the summary", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/00", headers: as(teacherToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.stage.id).toBe("00");
    expect(body.blocks.map((b: { ordinal: number }) => b.ordinal)).toEqual([1, 2]);
    const [prose, quote] = body.blocks;
    expect(prose).toMatchObject({ id: proseId, editable: true, consoleEdited: false });
    expect(quote).toMatchObject({ id: quoteId, editable: false, source: "ch-01.md 1.1" });
    expect(body.summary).toMatchObject({ draft: DRAFT, hash: DRAFT_HASH, status: "draft" });
  });

  it("carries the chapter's objectives, verbatim and in order, for the Studio's Objectives tab", async () => {
    await setup(
      `insert into objectives (id, stage_id, code, bloom_level, level, competency, description) values
         ('00.2', '00', '00.2', 'understand', 6, 'read', 'Say how a stage opens'),
         ('00.1', '00', '00.1', 'remember', 6, 'read', 'Name the parts of the map')
       on conflict (id) do nothing`,
    );
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/00", headers: as(teacherToken) });
    expect(res.json().objectives).toEqual([
      { code: "00.1", description: "Name the parts of the map", bloom: "remember", level: 6, competency: "read" },
      { code: "00.2", description: "Say how a stage opens", bloom: "understand", level: 6, competency: "read" },
    ]);
  });

  it("answers 404 for a stage that does not exist", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/42", headers: as(teacherToken) });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBeDefined();
  });

  it("the chapter list counts summaries and edits not yet in git", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content", headers: as(teacherToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const s00 = body.stages.find((s: { id: string }) => s.id === "00");
    expect(s00.summaryStatus).toBe("draft");
    expect(s00.consoleEdited).toBe(0);
    expect(body.summary.summaries).toMatchObject({ draft: 1, approved: 0, sentBack: 0 });
  });
});

describe("a block has no live edit: Draft, then Publish (the Studio editor, 8 Oct 2026)", () => {
  it("a teacher's PUT to a block answers 404 and the block is unchanged: nothing reaches students without Publish", async () => {
    const before = await block(proseId);
    const res = await app.inject({
      method: "PUT", url: `/api/v1/console/content/blocks/${proseId}`, headers: as(teacherToken),
      payload: { body: "Welcome to the **boot** sequence.", version: before.version, reason: "bold the key word" },
    });
    expect(res.statusCode).toBe(404);
    expect(await block(proseId)).toEqual(before);
  });

  it("the history lists what was replaced, newest first, with who and why", async () => {
    const before = await block(proseId);
    await consoleEdit(proseId, "Welcome to the **boot** sequence.", "bold the key word", w.teacher);
    const res = await app.inject({
      method: "GET", url: `/api/v1/console/content/blocks/${proseId}/history`, headers: as(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const [latest] = res.json().versions;
    expect(latest).toMatchObject({ via: "console", reason: "bold the key word", body: before.body_md });
  });

  it("a history of a block that does not exist is empty, not an error", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/content/blocks/00000000-0000-4000-8000-000000000000/history",
      headers: as(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().versions).toEqual([]);
  });
});

describe("summary review — approval is of one exact text", () => {
  it("refuses an approval of a text the reviewer did not see", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/00/approve", headers: as(teacherToken),
      payload: { hash: "some-older-draft" },
    });
    expect(res.statusCode).toBe(409);
    expect(await summaryRow()).toMatchObject({ status: "draft", summary: null });
  });

  it("approves: the text goes on stages.summary, with an audit row", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/00/approve", headers: as(teacherToken),
      payload: { hash: DRAFT_HASH },
    });
    expect(res.statusCode).toBe(200);
    expect(await summaryRow()).toMatchObject({ status: "approved", summary: DRAFT, reviewed_by: w.teacher });
    const { rows } = await setup("select count(*)::int as n from audit_log where action = 'summary.approve' and target_id = '00'");
    expect(rows[0].n).toBe(1);
  });

  it("sending back needs a reason", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/00/send-back", headers: as(teacherToken),
      payload: { reason: "" },
    });
    expect(res.statusCode).toBe(400);
    expect((await summaryRow()).status).toBe("approved");
  });

  it("sending back an approved summary takes it off students' screens and keeps the reason", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/00/send-back", headers: as(teacherToken),
      payload: { reason: "Say that stage 01 opens from the start." },
    });
    expect(res.statusCode).toBe(200);
    expect(await summaryRow()).toMatchObject({
      status: "sent_back", summary: null, note: "Say that stage 01 opens from the start.",
    });
    const { rows } = await setup(
      "select payload from audit_log where action = 'summary.send_back' and target_id = '00'",
    );
    expect(rows[0].payload).toMatchObject({ reason: "Say that stage 01 opens from the start.", wasLive: true });
  });

  it("answers 404 for a stage with no summary", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/content/summaries/05/approve", headers: as(teacherToken),
      payload: { hash: "x" },
    });
    expect(res.statusCode).toBe(404);
  });
});
