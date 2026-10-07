import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHash, createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool, runAs, authenticated, service, denialReason } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Course Studio, CS1: THE APPROVAL RULE (docs/COURSE-STUDIO-PLAN.md §3;
 * rulings 6 and the admin's, 7 Oct 2026, night).
 *
 *   An approver is a teacher OF THE SUBJECT (an un-ended class of it) and
 *   never the author of the version approved. The ADMIN may approve their own
 *   edit, and every such approval is recorded as self-approved.
 *
 * For chapter drafts, summaries, figures and items. Held in the database
 * (db/addendum-studio.sql) so no route, script or service-role statement goes
 * round it, and checked by the API first so the refusal says why.
 *
 * Denials first (hard rule 8): watched red with no rule, then green.
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

const DRAWING = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="none" stroke="currentColor"/></svg>';
const FIG_HASH = createHash("sha256").update(DRAWING).digest("hex").slice(0, 16);
const FIG = "00-approval-probe";
const SUMMARY = "Orientation: how the course runs, what the map shows, and how a stage opens.";
const DRAFTED = [{ kind: "prose", body: "Drafted teaching text for the approval probe.", meta: {} }];

let app: FastifyInstance;
let w: World;
let admin = "";
let tAuthor = "";   // holds a CPE 412 class
let tOther = "";    // holds a CPE 412 class
let tNone = "";     // a teacher with NO class
const tok: Record<string, string> = {};

async function user(email: string, role: string, name: string): Promise<string> {
  const r = await setup(
    `insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), $1, $2::jsonb) returning id::text`,
    [email, JSON.stringify({ role })],
  );
  const id = r.rows[0].id as string;
  await setup(`insert into profiles (id, full_name, role) values ($1, $2, $3::user_role)`, [id, name, role]);
  return id;
}

/** Fresh approvable rows of all four kinds, each as the author given (or none, as sync writes them). */
async function seed(author: string | null): Promise<{ item: string }> {
  await setup(`delete from stage_summaries where stage_id = '00'`);
  await setup(`update stages set summary = null where id = '00'`);
  await setup(`insert into stage_summaries (stage_id, draft, draft_hash, authored_by) values ('00', $1, 'h1', $2)`, [SUMMARY, author]);
  await setup(`delete from chapter_drafts where stage_id = '00'`);
  await setup(`insert into chapter_drafts (stage_id, blocks, draft_hash, authored_by) values ('00', $1::jsonb, 'h2', $2)`, [JSON.stringify(DRAFTED), author]);
  await setup(`delete from items where slug = 'S-00-approval-probe'`);
  await setup(`delete from figures where id = $1`, [FIG]);
  await setup(`insert into figures (id, stage_id, title, svg, svg_hash, authored_by) values ($1, '00', 'Probe', $2, $3, $4)`, [FIG, DRAWING, FIG_HASH, author]);
  const i = await setup(
    `insert into items (slug, stage_id, type, status, version, bloom, stem_template, correct_spec, distractor_pool, author_id)
     values ('S-00-approval-probe', '00', 'S', 'review', 1, 'remember', 'A probe question?', '{"value":"yes"}', '["a","b","c"]', $1) returning id::text`,
    [author],
  );
  return { item: i.rows[0].id as string };
}

const approveSummary = (t: string) => app.inject({ method: "POST", url: "/api/v1/console/content/summaries/00/approve", headers: auth(t), payload: { hash: "h1" } });
const approveDraft = (t: string) => app.inject({ method: "POST", url: "/api/v1/console/content/drafts/00/approve", headers: auth(t), payload: { hash: "h2" } });
const approveFigure = (t: string) => app.inject({ method: "POST", url: `/api/v1/console/figures/${FIG}/approve`, headers: auth(t), payload: { hash: FIG_HASH } });
const approveItem = (t: string, id: string, extra: object = {}) =>
  app.inject({ method: "PATCH", url: `/api/v1/console/items/${id}/status`, headers: auth(t), payload: { status: "live", ...extra } });

beforeAll(async () => {
  w = await resetWorld();
  admin = await user("studio-admin@octa-test.local", "admin", "The Admin");
  tAuthor = await user("studio-author@octa-test.local", "teacher", "Author Teacher");
  tOther = await user("studio-other@octa-test.local", "teacher", "Other Teacher");
  tNone = await user("studio-none@octa-test.local", "teacher", "Teacher With No Class");
  // Two sections, each a CPE 412 class of one teacher; tNone holds nothing.
  await setup(`insert into classes (section_id, subject_code, teacher_id, term) values ($1, 'CPE 412', $2, '2026-1'), ($3, 'CPE 412', $4, '2026-1')
               on conflict (section_id, subject_code, term) do update set teacher_id = excluded.teacher_id, ended_at = null`,
    [w.sectionId, tAuthor, w.otherSectionId, tOther]);
  for (const [k, id, role] of [["admin", admin, "admin"], ["author", tAuthor, "teacher"], ["other", tOther, "teacher"], ["none", tNone, "teacher"]] as const) {
    tok[k] = mint(id, role);
  }
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await setup(`delete from items where slug = 'S-00-approval-probe'`);
  await setup(`delete from figures where id = $1`, [FIG]);
  await app?.close();
  await closePool();
});

describe("a teacher with no class of the subject approves nothing", () => {
  beforeEach(async () => { await seed(null); });

  it("is refused on a summary, a drafted chapter, a figure and an item, and nothing changes", async () => {
    const { item } = await seed(null);
    for (const [name, res] of [
      ["summary", await approveSummary(tok.none!)],
      ["draft", await approveDraft(tok.none!)],
      ["figure", await approveFigure(tok.none!)],
      ["item", await approveItem(tok.none!, item)],
    ] as const) {
      expect(res.statusCode, name).toBe(403);
      expect(res.json().error.message, name).toMatch(/teacher of CPE 412 or the admin/i);
    }
    const rows = await setup(
      `select (select status from stage_summaries where stage_id = '00') s,
              (select status from chapter_drafts where stage_id = '00') d,
              (select status from figures where id = $1) f,
              (select status::text from items where id = $2) i`, [FIG, item]);
    expect(rows.rows[0]).toEqual({ s: "draft", d: "draft", f: "draft", i: "review" });
  });

  it("a teacher of the subject approves all four, and the rows say who", async () => {
    const { item } = await seed(null);
    expect((await approveSummary(tok.other!)).statusCode).toBe(200);
    expect((await approveDraft(tok.other!)).statusCode).toBe(200);
    expect((await approveFigure(tok.other!)).statusCode).toBe(200);
    expect((await approveItem(tok.other!, item)).statusCode).toBe(200);
    const r = await setup(
      `select (select reviewed_by::text from stage_summaries where stage_id = '00') s,
              (select reviewed_by::text from chapter_drafts where stage_id = '00') d,
              (select reviewed_by::text from figures where id = $1) f,
              (select reviewed_by::text from items where id = $2) i`, [FIG, item]);
    expect(Object.values(r.rows[0])).toEqual([tOther, tOther, tOther, tOther]);
  });

  it("a class that has ended no longer makes its teacher a teacher of the subject", async () => {
    await seed(null);
    await setup(`update classes set ended_at = now() where teacher_id = $1`, [tOther]);
    try {
      expect((await approveSummary(tok.other!)).statusCode).toBe(403);
    } finally {
      await setup(`update classes set ended_at = null where teacher_id = $1`, [tOther]);
    }
  });
});

describe("nobody but the admin approves their own version", () => {
  it("the author is refused on all four, in words, and nothing changes", async () => {
    const { item } = await seed(tAuthor);
    for (const [name, res] of [
      ["summary", await approveSummary(tok.author!)],
      ["draft", await approveDraft(tok.author!)],
      ["figure", await approveFigure(tok.author!)],
      ["item", await approveItem(tok.author!, item)],
    ] as const) {
      expect(res.statusCode, name).toBe(403);
      expect(res.json().error.message, name).toMatch(/you wrote this version/i);
    }
  });

  it("the author's acknowledgement does not open it (it only ever applied to the admin)", async () => {
    const { item } = await seed(tAuthor);
    expect((await approveItem(tok.author!, item, { selfApproved: true })).statusCode).toBe(403);
  });

  it("another teacher of the subject approves the author's version", async () => {
    const { item } = await seed(tAuthor);
    expect((await approveSummary(tok.other!)).statusCode).toBe(200);
    expect((await approveItem(tok.other!, item)).statusCode).toBe(200);
    const r = await setup(`select self_approved from stage_summaries where stage_id = '00'`);
    expect(r.rows[0].self_approved).toBe(false);
  });

  it("the admin may approve their own edit, and it is recorded as self-approved", async () => {
    const { item } = await seed(admin);
    expect((await approveSummary(tok.admin!)).statusCode).toBe(200);
    expect((await approveDraft(tok.admin!)).statusCode).toBe(200);
    expect((await approveFigure(tok.admin!)).statusCode).toBe(200);
    // An item still needs the admin's own acknowledgement that the key was re-checked.
    expect((await approveItem(tok.admin!, item)).statusCode).toBe(400);
    expect((await approveItem(tok.admin!, item, { selfApproved: true })).statusCode).toBe(200);
    const r = await setup(
      `select (select self_approved from stage_summaries where stage_id = '00') s,
              (select self_approved from chapter_drafts where stage_id = '00') d,
              (select self_approved from figures where id = $1) f,
              (select self_approved from items where id = $2) i`, [FIG, item]);
    expect(r.rows[0]).toEqual({ s: true, d: true, f: true, i: true });
    const a = await setup(`select payload from audit_log where action = 'summary.approve' and target_id = '00' order by at desc limit 1`);
    expect(a.rows[0].payload.selfApproved).toBe(true);
  });

  it("the admin approving someone else's version is not self-approved", async () => {
    await seed(tAuthor);
    expect((await approveSummary(tok.admin!)).statusCode).toBe(200);
    const r = await setup(`select self_approved from stage_summaries where stage_id = '00'`);
    expect(r.rows[0].self_approved).toBe(false);
  });
});

describe("the database holds the rule, for every role, the service role included", () => {
  const txn = (as: string, sql: string, params: unknown[] = []) =>
    runAs(as === "service" ? service : authenticated(as, "teacher"), sql, params);

  it("refuses a summary approved by a teacher who is not of the subject", async () => {
    await seed(null);
    const res = await txn("service",
      `update stage_summaries set status = 'approved', approved_hash = draft_hash, reviewed_by = $1 where stage_id = '00'`, [tNone]);
    expect(res.error, denialReason(res)).not.toBeNull();
    expect(res.error?.message).toMatch(/not a teacher of|may not approve/i);
  });

  it("refuses an approval by the author, on each of the four tables", async () => {
    const { item } = await seed(tAuthor);
    const statements: Array<[string, string, unknown[]]> = [
      ["summary", `update stage_summaries set status = 'approved', approved_hash = draft_hash, reviewed_by = $1 where stage_id = '00'`, [tAuthor]],
      ["draft", `update chapter_drafts set status = 'approved', approved_hash = draft_hash, reviewed_by = $1 where stage_id = '00'`, [tAuthor]],
      ["figure", `update figures set status = 'approved', approved_hash = svg_hash, approved_svg = svg, reviewed_by = $2 where id = $1`, [FIG, tAuthor]],
      ["item", `update items set status = 'live', reviewed_by = $2 where id = $1`, [item, tAuthor]],
    ];
    for (const [name, sql, params] of statements) {
      const res = await txn("service", sql, params);
      expect(res.error, `${name}: ${denialReason(res)}`).not.toBeNull();
    }
  });

  it("the database sets self_approved itself: a client cannot claim it", async () => {
    await seed(tAuthor);
    const res = await txn("service",
      `update stage_summaries set status = 'approved', approved_hash = draft_hash, reviewed_by = $1, self_approved = true where stage_id = '00' returning self_approved`, [tOther]);
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rows[0]!.self_approved).toBe(false);
  });

  it("POSITIVE CONTROL: a teacher of the subject, not the author, may approve", async () => {
    await seed(tAuthor);
    const res = await txn("service",
      `update stage_summaries set status = 'approved', approved_hash = draft_hash, reviewed_by = $1 where stage_id = '00' returning status`, [tOther]);
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rows[0]!.status).toBe("approved");
  });
});
