import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Cosmetics } from "@octa/contracts";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { derivePlanetBiome } from "../src/routes/cosmetics.js";
import { setup, closePool } from "./helpers/rls.js";
import { resetAll } from "./helpers/reset.js";

/**
 * GET /api/v1/cosmetics, per planet (WEB-REMAKE.md §1, 30 Sep 2026): a biome
 * for EVERY stage the caller can see, from the same derivation the pure tests
 * in cosmetics.spec.ts cover, in the shape packages/contracts declares, and
 * with no effect on anything a student can do.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";
const STUDENT_NO = "23-0042";

function mintToken(userId: string, role: string, studentId?: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: studentId ? { role, student_id: studentId } : { role },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

let app: FastifyInstance;
let studentToken: string;
let teacherToken: string;

beforeAll(async () => {
  await resetAll();
  const { rows } = await setup(
    `with s as (insert into sections (code, term) values ('BSCPE-2C','2026-1') returning id),
          u as (insert into auth.users (id,email,raw_app_meta_data)
                values (gen_random_uuid(),'cos@octa-test.local','{"role":"student"}'::jsonb) returning id),
          t as (insert into auth.users (id,email,raw_app_meta_data)
                values (gen_random_uuid(),'cost@octa-test.local','{"role":"teacher"}'::jsonb) returning id),
          d as (insert into student_directory (student_id, full_name, section_id, status, claimed_by)
                select $1,'Student C',(select id from s),'claimed'::claim_status,(select id from u)
                returning student_id),
          p as (insert into profiles (id, student_id, full_name, section_id, role)
                select (select id from u),$1,'Student C',(select id from s),'student'::user_role
                union all
                select (select id from t), null,'Instructor',(select id from s),'teacher'::user_role
                returning id)
     select (select id from u) uid, (select id from t) tid`,
    [STUDENT_NO],
  );
  studentToken = mintToken(rows[0].uid, "student", STUDENT_NO);
  teacherToken = mintToken(rows[0].tid, "teacher");

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
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

async function publishedStageIds(): Promise<string[]> {
  const { rows } = await setup(`select id from stages where published order by ordinal`);
  return rows.map((r: { id: string }) => r.id);
}

describe("GET /api/v1/cosmetics — a biome for every planet", () => {
  it("denies a caller with no session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cosmetics" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty("error.code");
    expect(res.body).not.toContain("planetBiomes");
  });

  it("answers in the shape packages/contracts declares", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cosmetics", headers: auth(studentToken) });
    expect(res.statusCode).toBe(200);
    const parsed = Cosmetics.safeParse(res.json());
    expect(parsed.success, JSON.stringify(parsed.success ? "" : parsed.error.issues)).toBe(true);
  });

  it("names a biome for every stage the student can see, and only those", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cosmetics", headers: auth(studentToken) });
    const { planetBiomes } = res.json() as { planetBiomes: Record<string, string> };
    const ids = await publishedStageIds();
    expect(ids.length).toBeGreaterThanOrEqual(19);
    expect(Object.keys(planetBiomes).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(planetBiomes[id], id).toBe(derivePlanetBiome(STUDENT_NO, id));
  });

  it("gives the same student the same sky on every request", async () => {
    const a = await app.inject({ method: "GET", url: "/api/v1/cosmetics", headers: auth(studentToken) });
    const b = await app.inject({ method: "GET", url: "/api/v1/cosmetics", headers: auth(studentToken) });
    expect(a.json()).toEqual(b.json());
  });

  it("answers staff too, keyed on the user id, so the map is total", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cosmetics", headers: auth(teacherToken) });
    expect(res.statusCode).toBe(200);
    expect(Cosmetics.safeParse(res.json()).success).toBe(true);
  });

  it("changes nothing a student can do: the map's locks are identical after it", async () => {
    const before = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    await app.inject({ method: "GET", url: "/api/v1/cosmetics", headers: auth(studentToken) });
    const after = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const states = (r: typeof before) =>
      (r.json() as { nodes: Array<{ id: string; state: string; lockReason: unknown }> }).nodes.map(
        (n) => [n.id, n.state, JSON.stringify(n.lockReason ?? null)],
      );
    expect(states(after)).toEqual(states(before));
  });
});
