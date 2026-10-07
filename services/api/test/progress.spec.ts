import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * GET /api/v1/console/progress — the course-readiness half of the console's
 * /changelog (instructor, 7 Oct 2026, night: "all the progress of the entire
 * system"). Staff only: it counts unreviewed questions and drafts.
 *
 * Denials first (a student 403, no token 401), watched red with no route
 * (404), then green. The Prelim's five conditions come back with HOW each is
 * known: measured here, proved by a test, or checked by a person. It never
 * says "ready" on the strength of the parts it cannot measure.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mint(userId: string, role: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { role },
  })).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

let app: FastifyInstance;
let w: World;
const URL = "/api/v1/console/progress";

beforeAll(async () => {
  w = await resetWorld();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("the progress route refuses everyone but staff", () => {
  it("a student is refused (403)", async () => {
    const res = await app.inject({ method: "GET", url: URL, headers: { authorization: `Bearer ${mint(w.studentA, "student")}` } });
    expect(res.statusCode).toBe(403);
  });
  it("no token is refused (401)", async () => {
    const res = await app.inject({ method: "GET", url: URL });
    expect(res.statusCode).toBe(401);
  });
});

describe("what it says about the Prelim", () => {
  it("names the five conditions, each with how it is known", async () => {
    const res = await app.inject({ method: "GET", url: URL, headers: { authorization: `Bearer ${mint(w.teacher, "teacher")}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.prelim.conditions).toHaveLength(5);
    for (const c of body.prelim.conditions) {
      expect(["measured", "test", "person"]).toContain(c.how);
      expect(typeof c.label).toBe("string");
    }
    expect(body.prelim.stages.map((s: { id: string }) => s.id)).toEqual(["00", "01", "02", "03", "04"]);
  });

  it("counts act 1's live questions against its bank, and is not ready while one waits", async () => {
    await setup(`insert into items (slug, stage_id, type, status, version, bloom, stem_template, correct_spec, distractor_pool)
                 values ('S-02-waiting', '02', 'S', 'review', 1, 'remember', 'A question waiting', '{"value":"x"}', '["a","b","c"]')`);
    const res = await app.inject({ method: "GET", url: URL, headers: { authorization: `Bearer ${mint(w.teacher, "teacher")}` } });
    const { prelim } = res.json();
    expect(prelim.act1.bank).toBeGreaterThan(prelim.act1.live);
    const items = prelim.conditions.find((c: { id: string }) => c.id === "items");
    expect(items.ok).toBe(false);
    expect(prelim.measuredOk).toBe(false);
  });
});
