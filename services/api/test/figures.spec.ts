import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { toStudentPaper } from "../src/serialize/student.js";
import type { ResolvedItem } from "../src/engine/resolve.js";
import { setup, closePool } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Figures (instructor rulings, 6 Oct 2026; docs/FIGURES-AND-AUDIO.md). A
 * figure is drawn for this course and synced as a DRAFT; students see it only
 * once an instructor approves that exact drawing, on /content or /items. A
 * question that needs a figure cannot go live without it.
 *
 * Stage 00 stands in for a chapter: it is open to every student, so "a student
 * sees it once approved, and not before" is observable. Denials first.
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

const FIG = "00-api-probe";
const DRAWING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>The probe figure</title><desc>Two boxes joined by a line.</desc><rect x="10" y="10" width="60" height="40" class="fig-box"/></svg>`;
const REDRAWN = DRAWING.replace('width="60"', 'width="80"');
const CAPTION = "A caption students must not see before the drawing is approved.";
const hashOf = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

let app: FastifyInstance;
let w: World;
let teacher: string;
let student: string;
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

const studentStage = async () => {
  const res = await app.inject({ method: "GET", url: "/api/v1/stages/00", headers: auth(student) });
  expect(res.statusCode).toBe(200);
  return res.json().blocks as Array<{ kind: string; body: string; figure?: { id: string; svg: string; title: string } }>;
};
const approve = (token: string, hash: string, id = FIG) =>
  app.inject({ method: "POST", url: `/api/v1/console/figures/${id}/approve`, headers: auth(token), payload: { hash } });
const sendBack = (token: string, reason: string) =>
  app.inject({ method: "POST", url: `/api/v1/console/figures/${FIG}/send-back`, headers: auth(token), payload: { reason } });
const row = async () =>
  (await setup("select status, approved_svg, approved_hash, ever_approved, note from figures where id = $1", [FIG])).rows[0] as {
    status: string; approved_svg: string | null; approved_hash: string | null; ever_approved: boolean; note: string | null;
  };

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
  // As sync writes it: the drawing as a draft, and a figure block naming it.
  await setup("delete from items where slug = '00-figure-probe'");
  await setup(
    `insert into figures (id, stage_id, title, svg, svg_hash) values ($1, '00', 'The probe figure', $2, $3)
     on conflict (id) do update set svg = excluded.svg, svg_hash = excluded.svg_hash, status = 'draft',
       approved_hash = null, approved_svg = null, ever_approved = false, note = null`,
    [FIG, DRAWING, hashOf(DRAWING)],
  );
  await setup(
    `insert into content_blocks (stage_id, ordinal, kind, body_md, meta) values ('00', 900, 'figure', $1, $2::jsonb)
     on conflict (stage_id, ordinal) do update set kind = excluded.kind, body_md = excluded.body_md, meta = excluded.meta`,
    [CAPTION, JSON.stringify({ id: FIG, after: "1.1" })],
  );
}, 120_000);

afterAll(async () => {
  await setup("delete from content_blocks where stage_id = '00' and ordinal = 900");
  await setup("delete from items where slug = '00-figure-probe'");
  await setup("delete from figures where id = $1", [FIG]);
  await app?.close();
  await closePool();
});

describe("denials first: no drawing reaches students without the instructor", () => {
  it("an unapproved figure is absent from the stage, caption and all", async () => {
    const blocks = await studentStage();
    expect(blocks.some((b) => b.kind === "figure")).toBe(false);
    expect(JSON.stringify(blocks)).not.toContain(CAPTION);
    expect(JSON.stringify(blocks)).not.toContain("<svg");
  });

  it("a student cannot approve it, and nothing changes", async () => {
    const res = await approve(student, hashOf(DRAWING));
    expect(res.statusCode).toBe(403);
    expect((await row()).status).toBe("draft");
    expect((await row()).approved_svg).toBeNull();
  });

  it("a student cannot send it back either", async () => {
    expect((await sendBack(student, "I do not like it")).statusCode).toBe(403);
    expect((await row()).status).toBe("draft");
  });

  it("an approval names the drawing it approves: a stale hash is refused", async () => {
    const res = await approve(teacher, "not-the-drawing-on-screen");
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/redrawn since you opened it/i);
    expect((await row()).approved_svg).toBeNull();
  });

  it("sending back needs a reason", async () => {
    expect((await sendBack(teacher, " ")).statusCode).toBe(400);
  });

  it("an unknown figure is a 404, and a malformed id never reaches the database", async () => {
    expect((await approve(teacher, "x", "00-no-such-figure")).statusCode).toBe(404);
    expect((await approve(teacher, "x", "DROP TABLE")).statusCode).toBe(404);
  });

  it("a question that needs the figure cannot go live while it is unapproved", async () => {
    const ins = await setup(
      `insert into items (slug, stage_id, type, status, version, bloom, stem_template, correct_spec, distractor_pool, figure_id)
       values ('00-figure-probe', '00', 'S', 'review', 1, 'remember', 'Which shape does the probe figure draw?',
               '{"value":"A box"}', '["A circle","A line","A star"]', $1) returning id`,
      [FIG],
    );
    const itemId = ins.rows[0].id as string;
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/items/${itemId}/status`,
      headers: auth(teacher),
      payload: { status: "live" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(new RegExp(`needs figure ${FIG}`));
    expect((await setup("select status from items where id = $1", [itemId])).rows[0].status).toBe("review");
  });
});

describe("the console shows the drawing under review", () => {
  it("the chapter read carries each figure, drawn, with its hash and status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content/00", headers: auth(teacher) });
    expect(res.statusCode).toBe(200);
    const f = (res.json().figures as Array<{ id: string }>).find((x) => x.id === FIG);
    expect(f).toMatchObject({ id: FIG, svg: DRAWING, hash: hashOf(DRAWING), status: "draft", served: false });
  });

  it("the item preview carries the figure too, so it can be approved on /items", async () => {
    const id = (await setup("select id from items where slug = '00-figure-probe'")).rows[0].id as string;
    const res = await app.inject({ method: "GET", url: `/api/v1/console/items/${id}/preview`, headers: auth(teacher) });
    expect(res.statusCode).toBe(200);
    expect(res.json().figure).toMatchObject({ id: FIG, hash: hashOf(DRAWING), status: "draft" });
  });

  it("the index counts figures waiting", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/content", headers: auth(teacher) });
    expect(res.json().summary.figures.waiting).toBeGreaterThanOrEqual(1);
  });
});

describe("sent back, then approved, then redrawn", () => {
  it("sending back keeps the reason, and students still see nothing", async () => {
    expect((await sendBack(teacher, "Label the second box.")).statusCode).toBe(200);
    expect(await row()).toMatchObject({ status: "sent_back", note: "Label the second box." });
    expect((await studentStage()).some((b) => b.kind === "figure")).toBe(false);
  });

  it("approving serves exactly that drawing and leaves one audit row", async () => {
    const res = await approve(teacher, hashOf(DRAWING));
    expect(res.statusCode).toBe(200);
    expect(await row()).toMatchObject({ status: "approved", approved_svg: DRAWING, approved_hash: hashOf(DRAWING), ever_approved: true });
    const audit = await setup("select payload from audit_log where action = 'figure.approve' and target_id = $1", [FIG]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].payload.hash).toBe(hashOf(DRAWING));
  });

  it("students now see the figure, with its caption and its drawing", async () => {
    const fig = (await studentStage()).find((b) => b.kind === "figure");
    expect(fig?.body).toBe(CAPTION);
    expect(fig?.figure).toEqual({ id: FIG, title: "The probe figure", svg: DRAWING });
  });

  it("approving again changes nothing and writes no second audit row", async () => {
    const res = await approve(teacher, hashOf(DRAWING));
    expect(res.json().alreadyApproved).toBe(true);
    const n = await setup("select count(*)::int n from audit_log where action = 'figure.approve' and target_id = $1", [FIG]);
    expect(n.rows[0].n).toBe(1);
  });

  it("the question may now go live", async () => {
    const id = (await setup("select id from items where slug = '00-figure-probe'")).rows[0].id as string;
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/items/${id}/status`,
      headers: auth(teacher),
      payload: { status: "live" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("a redrawn figure withdraws its approval, and students keep the drawing that was approved", async () => {
    // As sync writes a changed file.
    await setup(
      "update figures set svg = $2, svg_hash = $3, status = 'draft', note = null where id = $1",
      [FIG, REDRAWN, hashOf(REDRAWN)],
    );
    expect((await row()).status).toBe("draft");
    const fig = (await studentStage()).find((b) => b.kind === "figure");
    expect(fig?.figure?.svg).toBe(DRAWING);
    expect(JSON.stringify(await studentStage())).not.toContain('width="80"');
  });
});

describe("a question's figure on the paper", () => {
  const item = {
    itemId: "11111111-1111-4111-8111-111111111111",
    ordinal: 1,
    type: "S",
    stageId: "00",
    objectiveId: null,
    bloom: "remember",
    stem: "Which shape does the probe figure draw?",
    options: ["A box", "A circle"],
    resolvedParams: {},
    points: 1,
    correctValue: "A box",
    correctIndex: 0,
    rationale: "It draws a box.",
  } as unknown as ResolvedItem;

  it("the one serializer carries the figure, and still never the key", () => {
    const [out] = toStudentPaper([item], new Map([[item.itemId, { title: "The probe figure", svg: DRAWING }]]));
    expect(out!.figure).toEqual({ title: "The probe figure", svg: DRAWING });
    expect(JSON.stringify(out)).not.toMatch(/correctValue|correctIndex|rationale|It draws a box/);
  });

  it("an item with no figure carries no figure field at all", () => {
    const [out] = toStudentPaper([item]);
    expect("figure" in out!).toBe(false);
  });
});
