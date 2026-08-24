import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, pool, closePool } from "./helpers/rls.js";
import { resetAll } from "./helpers/reset.js";

const exec = promisify(execFile);

// Resolved from THIS FILE, not from process.cwd(). Vitest's cwd depends on how
// it was invoked (repo root via a filter, or services/api via --root), and a
// path that is right under one invocation is wrong under the other.
// test/ -> api/ -> services/ -> repo root
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Run the REAL content pipeline as part of setup.
 *
 * resetAll() clears content_blocks and objectives for isolation, so the reader
 * tests need content put back. Shelling out to scripts/sync-content.mjs rather
 * than hand-seeding rows means these tests also cover the pipeline: parsing the
 * markdown, verifying it against the decks, and writing it to the database.
 */
async function syncContent(): Promise<void> {
  await exec("node", [resolve(REPO_ROOT, "scripts/sync-content.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env },
  });
}

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId, aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role, student_id: "21-0001" },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

let app: FastifyInstance;
let studentId: string;
let teacherId: string;
let studentToken: string;
let teacherToken: string;

beforeAll(async () => {
  await resetAll();
  await syncContent();
  const { rows } = await setup(
    `with s as (insert into sections (code, term) values ('BSCPE-2A','2026-1') returning id),
          u as (insert into auth.users (id,email,raw_app_meta_data)
                values (gen_random_uuid(),'a@octa-test.local','{"role":"student"}'::jsonb) returning id),
          t as (insert into auth.users (id,email,raw_app_meta_data)
                values (gen_random_uuid(),'t@octa-test.local','{"role":"teacher"}'::jsonb) returning id),
          d as (insert into student_directory (student_id, full_name, section_id, status, claimed_by)
                select '21-0001','Student A',(select id from s),'claimed'::claim_status,(select id from u)
                returning student_id),
          p as (insert into profiles (id, student_id, full_name, section_id, role)
                select (select id from u),'21-0001','Student A',(select id from s),'student'::user_role
                union all
                select (select id from t), null,'Instructor',(select id from s),'teacher'::user_role
                returning id)
     select (select id from u) uid, (select id from t) tid`,
  );
  studentId = rows[0].uid;
  teacherId = rows[0].tid;
  studentToken = mintToken(studentId, "student");
  teacherToken = mintToken(teacherId, "teacher");

  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);

  app = await buildServer(env);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe("GET /api/v1/stages — the skill tree", () => {
  it("returns all 18 nodes and 21 edges, matching the seed exactly", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    expect(res.statusCode).toBe(200);
    const { nodes, edges } = res.json();

    // INV-32 / INV-33: the map may not invent or forget a node or an edge.
    expect(nodes).toHaveLength(18);
    expect(edges).toHaveLength(21);

    const ids = nodes.map((n: { id: string }) => n.id).sort();
    expect(ids[0]).toBe("00");
    expect(ids[ids.length - 1]).toBe("17");
  });

  it("every edge corresponds to a real prereq row in the database", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const { edges } = res.json();

    const { rows } = await pool.query(
      "select s.id as to_id, p as from_id from stages s, lateral unnest(s.prereq) p",
    );
    const dbEdges = new Set(rows.map((r) => `${r.from_id}->${r.to_id}`));
    for (const e of edges) {
      expect(dbEdges.has(`${e.from}->${e.to}`), `map invented ${e.from}->${e.to}`).toBe(true);
    }
    expect(edges.length).toBe(dbEdges.size);
  });

  it("Stage 08 is wired into Stage 17 — no node is a dead end (D1)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const { nodes, edges } = res.json();

    const s17 = nodes.find((n: { id: string }) => n.id === "17");
    expect(s17.prereq.sort()).toEqual(["08", "16"]);
    expect(edges).toContainEqual({ from: "08", to: "17" });

    // Only 15 and 17 should now be leaves.
    const hasDependents = new Set(edges.map((e: { from: string }) => e.from));
    const leaves = nodes
      .map((n: { id: string }) => n.id)
      .filter((id: string) => !hasDependents.has(id))
      .sort();
    expect(leaves).toEqual(["15", "17"]);
  });

  it("Stage 00 is available and Stage 05 is locked for a fresh student", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const nodes = res.json().nodes as Array<{ id: string; state: string }>;
    expect(nodes.find((n) => n.id === "00")!.state).toBe("available");
    expect(nodes.find((n) => n.id === "05")!.state).toBe("locked");
  });

  it("EVERY locked node states its reason and the distance", async () => {
    // DESIGN-MANDATE 1: a lock that does not say why and how far off fails the
    // legibility test.
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const nodes = res.json().nodes as Array<{
      id: string; state: string;
      lockReason: { message: string; kind: string; currentMastery?: number } | null;
    }>;

    const locked = nodes.filter((n) => n.state === "locked");
    expect(locked.length).toBeGreaterThan(0);

    for (const n of locked) {
      expect(n.lockReason, `stage ${n.id} is locked with no reason`).not.toBeNull();
      expect(n.lockReason!.message.length).toBeGreaterThan(20);
      if (n.lockReason!.kind === "prereq") {
        expect(n.lockReason!.message).toMatch(/Unlocks when Stage \d\d/);
        expect(n.lockReason!.message).toMatch(/You're at \d+%/);
      }
    }

    // And an unlocked node must NOT carry a reason.
    for (const n of nodes.filter((x) => x.state !== "locked")) {
      expect(n.lockReason).toBeNull();
    }
  });

  it("the lock state comes from is_stage_unlocked(), not from the client", async () => {
    // Prove it by changing the database and re-reading: mastery on 00 should
    // open 01 with no client involvement at all.
    await pool.query(
      `insert into stage_progress (user_id, stage_id, mastery) values ($1,'00',0.95)
       on conflict (user_id, stage_id) do update set mastery = 0.95`,
      [studentId],
    );
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const nodes = res.json().nodes as Array<{ id: string; state: string }>;
    expect(nodes.find((n) => n.id === "01")!.state).toBe("available");
  });

  it("a teacher override closes a stage the prerequisites would have opened", async () => {
    await pool.query(
      `insert into stage_locks (scope, scope_user_id, stage_id, state, reason, actor_id)
       values ('user', $1, '01', 'locked', 'makeup exam pending', $2)`,
      [studentId, teacherId],
    );
    const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const node = (res.json().nodes as Array<{ id: string; state: string; lockReason: { kind: string } }>)
      .find((n) => n.id === "01")!;
    expect(node.state).toBe("locked");
    expect(node.lockReason.kind).toBe("override");
    await pool.query("delete from stage_locks where scope_user_id = $1", [studentId]);
  });
});

describe("GET /api/v1/stages/:id — the reader", () => {
  it("returns content for an unlocked, published stage", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages/00", headers: auth(studentToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locked).toBe(false);
    expect(body.blocks.length).toBeGreaterThan(0);
    expect(body.blocks[0]).toHaveProperty("kind");
    expect(body.blocks[0]).toHaveProperty("body");
  });

  it("carries the deck content verbatim through to the reader", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages/04", headers: auth(teacherToken) });
    const bodies = res.json().blocks.map((b: { body: string }) => b.body).join("\n");
    // Figure 1.3, straight from the instructor's own deck.
    expect(bodies).toContain("gross = hours * rate");
    expect(bodies).toContain("net = gross - fwt - socsec - state");
  });

  it("a LOCKED stage returns its objectives but NOT its content", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/stages/05", headers: auth(studentToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locked).toBe(true);
    // Read-only preview of what is next is deliberate. The prose is not.
    expect(body.objectives.length).toBeGreaterThan(0);
    expect(body.blocks).toEqual([]);
    expect(res.body).not.toContain("Advantages of Assembly Language");
  });

  it("an unpublished stage is invisible to a student and visible to staff", async () => {
    await pool.query("update stages set published = false where id = '17'");
    const asStudent = await app.inject({ method: "GET", url: "/api/v1/stages/17", headers: auth(studentToken) });
    const asTeacher = await app.inject({ method: "GET", url: "/api/v1/stages/17", headers: auth(teacherToken) });
    expect(asStudent.statusCode).toBe(404);
    expect(asTeacher.statusCode).toBe(200);
    await pool.query("update stages set published = true where id = '17'");
  });
});

describe("GET /api/v1/progress — the 7x3 competency grid", () => {
  it("returns all 21 cells, every time", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/progress", headers: auth(studentToken) });
    expect(res.statusCode).toBe(200);
    const { grid, depth } = res.json();
    expect(grid).toHaveLength(21);
    expect(new Set(grid.map((g: { level: number }) => g.level)).size).toBe(7);
    expect(depth).toBeGreaterThanOrEqual(0);
    expect(depth).toBeLessThanOrEqual(6);
  });

  it("has no XP, points, or score anywhere in the payload", async () => {
    // The three progression axes are depth, competency and hardware. There is
    // no fourth, and no currency.
    const res = await app.inject({ method: "GET", url: "/api/v1/progress", headers: auth(studentToken) });
    expect(res.body.toLowerCase()).not.toContain("xp");
    expect(res.body.toLowerCase()).not.toContain("points");
  });
});
