import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Drafted lesson text (instructor ruling, 5 Oct 2026): a chapter drafted from
 * the textbook sits in the staff-only `chapter_drafts` until the instructor
 * approves it on /content. The approval is bound to the draft's exact text,
 * copies it into `content_blocks` (archived, as every edit is), and leaves an
 * audit row. Denials first; every one asserts nothing changed.
 *
 * Stage 00 stands in for a drafted chapter: it is open to every student, so
 * "a student reads it once approved, and not before" is observable.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";
function mintToken(userId: string, role: string, studentId?: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

const DRAFTED = [
  { kind: "brief", body: "A drafted brief nobody has reviewed yet.", meta: {} },
  { kind: "prose", body: "## Two's complement\n\nDrafted teaching text, waiting for the instructor.", meta: {} },
];
const HASH = "fixture-draft-hash-00";

let app: FastifyInstance;
let w: World;
let teacher: string;
let student: string;
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const row = async () =>
  (await setup("select status, approved_hash, ever_approved, note, reviewed_by from chapter_drafts where stage_id = '00'")).rows[0] as {
    status: string; approved_hash: string | null; ever_approved: boolean; note: string | null; reviewed_by: string | null;
  };
const liveBodies = async () =>
  (await setup("select body_md from content_blocks where stage_id = '00' order by ordinal")).rows.map((r) => r.body_md as string);
const studentReads = async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/stages/00", headers: auth(student) });
  return (res.json().blocks as Array<{ body: string }>).map((b) => b.body).join("\n");
};
const approve = (token: string, hash: string) =>
  app.inject({ method: "POST", url: "/api/v1/console/content/drafts/00/approve", headers: auth(token), payload: { hash } });
const sendBack = (token: string, reason: string) =>
  app.inject({ method: "POST", url: "/api/v1/console/content/drafts/00/send-back", headers: auth(token), payload: { reason } });

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
  teacher = mintToken(w.teacher, "teacher");
  student = mintToken(w.studentA, "student", "21-0001");
  await setup(
    `insert into chapter_drafts (stage_id, blocks, draft_hash) values ('00', $1::jsonb, $2)
     on conflict (stage_id) do update set blocks = excluded.blocks, draft_hash = excluded.draft_hash,
       status = 'draft', approved_hash = null, ever_approved = false, note = null`,
    [JSON.stringify(DRAFTED), HASH],
  );
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("denials first: nothing reaches students without the instructor", () => {
  it("a student never sees the draft: not on the stage, not on the console", async () => {
    expect(await studentReads()).not.toContain("Drafted teaching text");
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/00", headers: auth(student) });
    expect(res.statusCode).toBe(403);
  });

  it("a student cannot approve it, and nothing changes", async () => {
    const before = await liveBodies();
    const res = await approve(student, HASH);
    expect(res.statusCode).toBe(403);
    expect((await row()).status).toBe("draft");
    expect(await liveBodies()).toEqual(before);
  });

  it("an approval names the text it approves: a stale hash is refused", async () => {
    const res = await approve(teacher, "not-the-text-on-screen");
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/changed since you opened it/i);
    expect((await row()).status).toBe("draft");
  });

  it("sending back needs a reason", async () => {
    expect((await sendBack(teacher, "  ")).statusCode).toBe(400);
    expect((await row()).status).toBe("draft");
  });

  it("an unknown chapter, or one with no draft, is a 404", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/console/content/drafts/77/approve", headers: auth(teacher), payload: { hash: HASH } });
    expect(res.statusCode).toBe(404);
  });
});

describe("the console shows the draft beside the live text", () => {
  it("the chapter read carries the draft, its hash and its status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/00", headers: auth(teacher) });
    expect(res.statusCode).toBe(200);
    const d = res.json().draft;
    expect(d).toMatchObject({ status: "draft", hash: HASH, everApproved: false });
    expect(d.blocks.map((b: { body: string }) => b.body)).toEqual(DRAFTED.map((b) => b.body));
  });

  it("the index counts chapters waiting", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content", headers: auth(teacher) });
    expect(res.json().stages.find((s: { id: string }) => s.id === "00").draftStatus).toBe("draft");
    expect(res.json().summary.chapters.draft).toBeGreaterThanOrEqual(1);
  });
});

describe("sent back, then approved", () => {
  it("sending back keeps the reason, and students still never see it", async () => {
    const res = await sendBack(teacher, "Section 2 needs the book's own example.");
    expect(res.statusCode).toBe(200);
    expect(await row()).toMatchObject({ status: "sent_back", note: "Section 2 needs the book's own example." });
    expect(await studentReads()).not.toContain("Drafted teaching text");
  });

  it("approving copies the exact text in, archives what it replaced, and leaves an audit row", async () => {
    const before = await liveBodies();
    const res = await approve(teacher, HASH);
    expect(res.statusCode).toBe(200);
    expect(await row()).toMatchObject({ status: "approved", approved_hash: HASH, ever_approved: true, reviewed_by: w.teacher });
    expect(await liveBodies()).toEqual(DRAFTED.map((b) => b.body));
    const hist = await setup("select count(*)::int n from content_block_versions where stage_id = '00' and replaced_via = 'console'");
    expect(hist.rows[0].n).toBeGreaterThanOrEqual(Math.min(before.length, DRAFTED.length));
    const audit = await setup("select payload from audit_log where action = 'chapter.approve' and target_id = '00'");
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].payload.hash).toBe(HASH);
  });

  it("students now read the approved text", async () => {
    expect(await studentReads()).toContain("Drafted teaching text, waiting for the instructor.");
  });

  it("approving again changes nothing and writes no second audit row", async () => {
    const res = await approve(teacher, HASH);
    expect(res.statusCode).toBe(200);
    expect(res.json().alreadyApproved).toBe(true);
    const audit = await setup("select count(*)::int n from audit_log where action = 'chapter.approve' and target_id = '00'");
    expect(audit.rows[0].n).toBe(1);
  });
});
