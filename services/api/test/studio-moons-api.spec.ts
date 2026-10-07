import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { loadLivePool } from "../src/repo/engine-repo.js";
import { setup, pool, closePool, runAs, authenticated, anon, service, wasDenied, denialReason } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * The Studio's moons, E2 (docs/STUDIO-EDITOR-PLAN.md "E2 -- the moons plan";
 * instructor approval, 8 Oct 2026): edit a moon's wording, add one as a DRAFT the
 * lock does not count, RETIRE one -- its evidence stays.
 *
 * Denials first (hard rule 8). A student and anon are refused every route; a STAFF
 * CLIENT can no longer write `objectives` (the API is the only writer, so Publish
 * cannot be bypassed with a token); a student cannot read a draft or retired moon;
 * a teacher of no subject types freely but cannot publish. Then the lock: a draft
 * moon does not hold a planet shut, a published one does (and the dry run says who
 * would see it close), a retired one opens planets and never closes them, and its
 * evidence survives. Everything is earned through the real routes: a journey,
 * Record, submit.
 *
 * Fixture, stage 01 (open to everyone) feeding stage 02:
 *   01.1, 01.2  live, three live questions each. A has mastered both (02 is open
 *   to A); B has mastered 01.1 only.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";
const mint = (userId: string, role: string, studentId: string | null = null): string => {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600,
    app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
  })).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
};
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

let app: FastifyInstance;
let w: World;
let admin = "";
let tNone = "";
let tokA = "";
let tokB = "";
let teacherTok = "";
let adminTok = "";
let noClassTok = "";

async function user(email: string, role: string, name: string): Promise<string> {
  const r = await setup(
    `insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), $1, $2::jsonb) returning id::text`,
    [email, JSON.stringify({ role })],
  );
  const id = r.rows[0].id as string;
  await setup(`insert into profiles (id, full_name, role) values ($1, $2, $3::user_role)`, [id, name, role]);
  return id;
}

async function addItems(objective: string, n: number, status: "live" | "review" = "live"): Promise<void> {
  await setup(
    `insert into items (slug, stage_id, objective_id, type, status, bloom, stem_template,
                        correct_spec, distractor_pool, reviewed_by, reviewed_at)
     select 'S-01-' || $1 || '-' || g || '-' || substr(md5(random()::text), 1, 6), '01', $1, 'S'::item_type,
            $3::item_status, 'remember', 'Moon ' || $1 || ' question ' || g || '?',
            jsonb_build_object('value', 'right ' || g),
            jsonb_build_array('wrong a' || g, 'wrong b' || g, 'wrong c' || g), $2, now()
       from generate_series(1, $4::int) g`,
    [objective, w.teacher, status, n],
  );
}

/** Enter a moon's journey and answer `right` of its questions correctly, the rest wrongly. */
async function practise(token: string, objective: string, right: number): Promise<void> {
  const res = await app.inject({ method: "POST", url: `/api/v1/objectives/${objective}/journey`, headers: auth(token) });
  expect(res.statusCode, res.body).toBe(200);
  const attemptId = res.json().attemptId as string;
  const { rows } = await pool.query(
    `select ordinal, (correct_value->>'index')::int as idx from attempt_items where attempt_id = $1 order by ordinal`,
    [attemptId],
  );
  for (const [k, r] of rows.entries()) {
    const index = k < right ? r.idx : (r.idx + 1) % 4;
    await app.inject({
      method: "POST", url: `/api/v1/attempts/${attemptId}/answer`, headers: auth(token),
      payload: { ordinal: r.ordinal, answer: { index } },
    });
  }
  await app.inject({ method: "POST", url: `/api/v1/attempts/${attemptId}/submit`, headers: auth(token) });
}

const unlocked = async (user: string, stage: string): Promise<boolean> =>
  (await setup("select is_stage_unlocked($1, $2) as u", [user, stage])).rows[0].u as boolean;

/** Put the moons back to the fixture: only 01.1 and 01.2, live, owned by the file. */
async function reseed(): Promise<void> {
  // The audit log refuses a delete; fixtures suspend that trigger by name, as the others do.
  await setup(`alter table audit_log disable trigger audit_log_no_delete;
               delete from audit_log where action like 'moon.%';
               alter table audit_log enable trigger audit_log_no_delete`);
  await setup(`delete from objective_edits`);
  await setup(`delete from blueprints where scope = 'stage' and stage_id = '01'`);
  await setup(`delete from items where objective_id not in ('01.1','01.2') or status <> 'live'`);
  await setup(`delete from objectives where id not in ('01.1','01.2')`);
  await setup(
    `update objectives set status = 'live', owner = 'file', retired_at = null, level = 6, competency = 'read',
            bloom_level = case id when '01.1' then 'remember' else 'understand' end,
            description = case id when '01.1' then 'Moon one, as the syllabus words it' else 'Moon two, as the syllabus words it' end
      where id in ('01.1','01.2')`,
  );
}

const get = (t: string | null, stage = "01") =>
  app.inject({ method: "GET", url: `/api/v1/console/content/${stage}/moons`, headers: t ? auth(t) : {} });
const add = (t: string | null, body: unknown, stage = "01") =>
  app.inject({ method: "POST", url: `/api/v1/console/content/${stage}/moons`, headers: t ? auth(t) : {}, payload: body as object });
const putPending = (t: string | null, id: string, body: unknown) =>
  app.inject({ method: "PUT", url: `/api/v1/console/content/moons/${id}/pending`, headers: t ? auth(t) : {}, payload: body as object });
const delPending = (t: string | null, id: string) =>
  app.inject({ method: "DELETE", url: `/api/v1/console/content/moons/${id}/pending`, headers: t ? auth(t) : {} });
const delMoon = (t: string | null, id: string) =>
  app.inject({ method: "DELETE", url: `/api/v1/console/content/moons/${id}`, headers: t ? auth(t) : {} });
const publish = (t: string | null, body: unknown, stage = "01") =>
  app.inject({ method: "POST", url: `/api/v1/console/content/${stage}/moons/publish`, headers: t ? auth(t) : {}, payload: body as object });

interface Moon {
  id: string; status: string; owner: string; description: string; bloom: string; level: number | null;
  competency: string | null; questions: number; notLive: number; publishable: boolean; game: string | null;
  removable: boolean; pending: null | { action: string; version: number; description: string | null };
}
const moonsOf = async (t = teacherTok): Promise<{ hash: string; moons: Moon[] }> => {
  const res = await get(t);
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
};
const moon = async (id: string): Promise<Moon> => (await moonsOf()).moons.find((m) => m.id === id)!;

const NEW_MOON = { description: "Explain what a new moon asks of a student", bloom: "understand", level: 5, competency: "read" };

/** The student's map: the moons it lists for a planet. */
async function mapMoons(token: string, stage = "01"): Promise<string[]> {
  const res = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(token) });
  expect(res.statusCode).toBe(200);
  const node = (res.json().nodes as Array<{ id: string; objectives: Array<{ id: string }> }>).find((n) => n.id === stage)!;
  return node.objectives.map((o) => o.id);
}

beforeAll(async () => {
  w = await resetWorld();
  admin = await user("moons-admin@octa-test.local", "admin", "The Admin");
  tNone = await user("moons-none@octa-test.local", "teacher", "Teacher With No Class");
  await setup(`insert into student_directory (student_id, full_name, section_id, status) values ('21-0001', 'x', $1, 'unclaimed') on conflict do nothing`, [w.sectionId]);
  await setup(
    `insert into objectives (id, stage_id, code, bloom_level, level, competency, description) values
       ('01.1','01','01.1','remember',6,'read','Moon one, as the syllabus words it'),
       ('01.2','01','01.2','understand',6,'read','Moon two, as the syllabus words it')`,
  );
  await addItems("01.1", 3);
  await addItems("01.2", 3);
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
  tokA = mint(w.studentA, "student", "21-0001");
  tokB = mint(w.studentB, "student", "21-0002");
  teacherTok = mint(w.teacher, "teacher"); // holds a CPE 412 class (the fixture)
  adminTok = mint(admin, "admin");
  noClassTok = mint(tNone, "teacher");
  await practise(tokA, "01.1", 3);
  await practise(tokA, "01.2", 3);
  await practise(tokB, "01.1", 3);
}, 180_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

beforeEach(reseed);

/* ---------------------------------------------------------------- denials */

describe("denials first: a client cannot write a moon, and a student cannot read an unpublished one", () => {
  it("fixture sanity: A holds both moons, so 02 is open to A; B holds one, so it is shut", async () => {
    expect(await unlocked(w.studentA, "02")).toBe(true);
    expect(await unlocked(w.studentB, "02")).toBe(false);
  });

  it("a student token cannot insert, update or delete a moon or a pending change, and nothing moved", async () => {
    const s = authenticated(w.studentA, "student");
    const ins = await runAs(s, `insert into objectives (id, stage_id, code, bloom_level, description) values ('01.8','01','01.8','apply','Sneaked in by a student')`);
    expect(wasDenied(ins), denialReason(ins)).toBe(true);
    const upd = await runAs(s, `update objectives set description = 'Sneaked in' where id = '01.1' returning id`);
    expect(upd.rowCount, "an update got through RLS").toBe(0);
    const del = await runAs(s, `delete from objectives where id = '01.2' returning id`);
    expect(del.rowCount, "a delete got through RLS").toBe(0);
    const edit = await runAs(s, `insert into objective_edits (objective_id, action, base_hash) values ('01.1', 'retire', 'x')`);
    expect(wasDenied(edit), denialReason(edit)).toBe(true);
    const after = await setup(`select id, description, status from objectives where stage_id = '01' order by id`);
    expect(after.rows.map((r) => r.description)).toEqual(["Moon one, as the syllabus words it", "Moon two, as the syllabus words it"]);
    expect((await setup(`select count(*)::int n from objective_edits`)).rows[0].n).toBe(0);
  });

  it("A STAFF token cannot either: ob_staff is gone, so Publish cannot be bypassed with a teacher's token", async () => {
    const t = authenticated(w.teacher, "teacher");
    const upd = await runAs(t, `update objectives set description = 'Sneaked in by a token', status = 'retired', retired_at = now() where id = '01.1' returning id`);
    expect(upd.error, denialReason(upd)).toBeNull();
    expect(upd.rowCount, "a staff update got through RLS").toBe(0);
    const ins = await runAs(t, `insert into objectives (id, stage_id, code, bloom_level, description) values ('01.8','01','01.8','apply','Sneaked in by a token')`);
    expect(wasDenied(ins), denialReason(ins)).toBe(true);
    const del = await runAs(t, `delete from objectives where id = '01.2' returning id`);
    expect(del.rowCount, "a staff delete got through RLS").toBe(0);
    const edit = await runAs(t, `insert into objective_edits (objective_id, action, base_hash) values ('01.1', 'retire', 'x')`);
    expect(wasDenied(edit), denialReason(edit)).toBe(true);
    expect((await moon("01.1")).status).toBe("live");
  });

  it("POSITIVE CONTROL: staff still READ every moon and pending change, and the service role still writes", async () => {
    const t = authenticated(w.teacher, "teacher");
    const read = await runAs(t, `select count(*)::int n from objectives where stage_id = '01'`);
    expect(read.error).toBeNull();
    expect(read.rows[0]!.n).toBe(2);
    const write = await runAs(service, `update objectives set description = 'By the API' where id = '01.1' returning id`);
    expect(write.error, denialReason(write)).toBeNull();
    expect(write.rowCount).toBe(1);
  });

  it("a student reads a LIVE moon, and neither a draft nor a retired one; staff read all; anon none", async () => {
    await setup(`insert into objectives (id, stage_id, code, bloom_level, level, competency, description, status, owner)
                 values ('01.7','01','01.7','apply',4,'trace','A draft moon nobody may see','draft','console')`);
    await setup(`insert into objectives (id, stage_id, code, bloom_level, level, competency, description, status, owner, retired_at)
                 values ('01.8','01','01.8','apply',4,'trace','A retired moon nobody may see','retired','console', now())`);
    const s = authenticated(w.studentA, "student");
    const seen = await runAs(s, `select id from objectives where stage_id = '01' order by id`);
    expect(seen.rows.map((r) => r.id)).toEqual(["01.1", "01.2"]);
    const view = await runAs(s, `select id from live_objectives where stage_id = '01' order by id`);
    expect(view.rows.map((r) => r.id)).toEqual(["01.1", "01.2"]);
    const staff = await runAs(authenticated(w.teacher, "teacher"), `select id from objectives where stage_id = '01' order by id`);
    expect(staff.rows.map((r) => r.id)).toEqual(["01.1", "01.2", "01.7", "01.8"]);
    const nobody = await runAs(anon, `select id from objectives`);
    expect(wasDenied(nobody), denialReason(nobody)).toBe(true);
    // And through the routes a student actually uses.
    expect(await mapMoons(tokA)).toEqual(["01.1", "01.2"]);
    const stage = await app.inject({ method: "GET", url: "/api/v1/stages/01", headers: auth(tokA) });
    expect(JSON.stringify(stage.json())).not.toContain("nobody may see");
  });

  it("a student and anon are refused every moons route; a teacher with no class types but cannot publish", async () => {
    const studentTok = tokA;
    for (const [name, call] of [
      ["GET", (t: string | null) => get(t)],
      ["POST add", (t: string | null) => add(t, NEW_MOON)],
      ["PUT pending", (t: string | null) => putPending(t, "01.1", { action: "retire", version: 0 })],
      ["DELETE pending", (t: string | null) => delPending(t, "01.1")],
      ["DELETE moon", (t: string | null) => delMoon(t, "01.1")],
      ["POST publish", (t: string | null) => publish(t, { hash: "x", reason: "a reason", ids: ["01.1"] })],
    ] as const) {
      expect((await call(studentTok)).statusCode, `${name} student`).toBe(403);
      expect((await call(null)).statusCode, `${name} anon`).toBe(401);
    }
    expect((await moon("01.1")).pending).toBeNull();

    // Typing changes nothing a student reads, so any staff may type ...
    expect((await putPending(noClassTok, "01.1", { action: "edit", version: 0, description: "A tightened sentence for moon one", bloom: "remember", level: 6, competency: "read" })).statusCode).toBe(200);
    // ... but Publish is a teacher OF THE SUBJECT's, and nothing changes when it is refused.
    const { hash } = await moonsOf(noClassTok);
    const refused = await publish(noClassTok, { hash, reason: "tightened", ids: ["01.1"] });
    expect(refused.statusCode).toBe(403);
    expect(refused.json().error.message).toMatch(/teacher of CPE 412 or the admin/);
    expect((await moon("01.1")).description).toBe("Moon one, as the syllabus words it");
    expect((await setup(`select count(*)::int n from audit_log where action = 'moon.publish'`)).rows[0].n).toBe(0);
  });
});

/* ------------------------------------------------------------------- read */

describe("GET the moons of a chapter", () => {
  it("lists them with their questions, minigame, owner and publishability; a non-gradeable chapter has none to edit", async () => {
    await addItems("01.2", 1, "review");
    const r = await moonsOf();
    expect(r).toMatchObject({ stageId: "01", gradeable: true, minQuestions: 3 });
    const m1 = r.moons.find((m) => m.id === "01.1")!;
    const m2 = r.moons.find((m) => m.id === "01.2")!;
    expect(m1).toMatchObject({ status: "live", owner: "file", questions: 3, notLive: 0, game: null, pending: null, removable: false });
    expect(m2).toMatchObject({ questions: 3, notLive: 1, game: "Two Columns" });
    const g = await get(teacherTok, "00");
    expect(g.statusCode).toBe(200);
    expect(g.json()).toMatchObject({ stageId: "00", gradeable: false, moons: [] });
    expect((await get(teacherTok, "7")).statusCode).toBe(404);
  });
});

/* -------------------------------------------------------------------- add */

describe("adding a moon: a draft the lock does not count", () => {
  it("any staff adds one: id is the next free, status draft, owned by the console; students see nothing", async () => {
    const res = await add(noClassTok, NEW_MOON);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, id: "01.3" });
    expect(await moon("01.3")).toMatchObject({ status: "draft", owner: "console", level: 5, competency: "read", bloom: "understand", questions: 0, publishable: false, removable: true });
    const again = await add(teacherTok, { ...NEW_MOON, description: "Trace the second new moon by hand" });
    expect(again.json().id).toBe("01.4");
    expect(await mapMoons(tokA)).toEqual(["01.1", "01.2"]);
    expect((await setup(`select count(*)::int n from audit_log where action = 'moon.add'`)).rows[0].n).toBe(2);
  });

  it("refuses a bad body, a stage that does not exist, and an orientation chapter (no questions can exist there)", async () => {
    expect((await add(teacherTok, { ...NEW_MOON, level: 9 })).statusCode).toBe(400);
    expect((await add(teacherTok, { ...NEW_MOON, description: "short" })).statusCode).toBe(400);
    expect((await add(teacherTok, { ...NEW_MOON, extra: 1 })).statusCode).toBe(400);
    expect((await add(teacherTok, NEW_MOON, "77")).statusCode).toBe(404);
    const orientation = await add(teacherTok, NEW_MOON, "00");
    expect(orientation.statusCode).toBe(409);
    expect(orientation.json().error.message).toMatch(/orientation|not graded/i);
  });

  it("a draft with no questions and no evidence is deleted outright; one with questions is not", async () => {
    await add(teacherTok, NEW_MOON);
    expect((await delMoon(teacherTok, "01.3")).statusCode).toBe(200);
    expect((await setup(`select count(*)::int n from objectives where id = '01.3'`)).rows[0].n).toBe(0);
    await add(teacherTok, NEW_MOON);
    await addItems("01.3", 1, "review");
    const refused = await delMoon(teacherTok, "01.3");
    expect(refused.statusCode).toBe(409);
    expect((await moon("01.3")).status).toBe("draft");
    // A LIVE moon is never deleted, only retired.
    expect((await delMoon(teacherTok, "01.1")).statusCode).toBe(409);
    expect((await moon("01.1")).status).toBe("live");
  });
});

/* --------------------------------------------------- the lock and the draft */

describe("a draft moon does not hold a planet shut, and a published one does", () => {
  it("DENIAL: a draft moon with no questions leaves 02 open to A (watched red against the old lock)", async () => {
    await add(teacherTok, NEW_MOON);
    expect(await unlocked(w.studentA, "02")).toBe(true);
    expect(await unlocked(w.studentB, "02")).toBe(false);
  });

  it("a draft moon's approved questions are in no draw until the moon is live", async () => {
    await add(teacherTok, NEW_MOON);
    await addItems("01.3", 3);
    const pool = await loadLivePool(app.db, { stageId: "01" });
    expect(new Set(pool.map((p) => p.objectiveId))).toEqual(new Set(["01.1", "01.2"]));
    const all = await loadLivePool(app.db);
    expect(all.some((p) => p.objectiveId === "01.3")).toBe(false);
    // ... and a student cannot enter its journey.
    const j = await app.inject({ method: "POST", url: "/api/v1/objectives/01.3/journey", headers: auth(tokA) });
    expect(j.statusCode).toBe(404);
  });

  it("Publish refuses a draft named with two live questions (409, in words) and publishes it with three", async () => {
    await add(teacherTok, NEW_MOON);
    await addItems("01.3", 2);
    const { hash } = await moonsOf();
    const refused = await publish(teacherTok, { hash, reason: "ready", ids: ["01.3"] });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.message).toMatch(/01\.3/);
    expect(refused.json().error.message).toMatch(/3/);
    expect((await moon("01.3")).status).toBe("draft");

    await addItems("01.3", 1);
    expect((await moon("01.3")).publishable).toBe(true);
    const ok = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "ready", ids: ["01.3"] });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, dryRun: false, applied: [{ id: "01.3", change: "publish" }], selfApproved: true });
    expect((await moon("01.3")).status).toBe("live");
  });

  it("the DRY RUN says who would see a planet close, and changes nothing", async () => {
    await add(teacherTok, NEW_MOON);
    await addItems("01.3", 3);
    const { hash } = await moonsOf();
    const dry = await publish(teacherTok, { hash, reason: "preview", ids: ["01.3"], dryRun: true });
    expect(dry.statusCode, dry.body).toBe(200);
    expect(dry.json()).toMatchObject({ dryRun: true, impact: { relocked: 1, stages: [{ stageId: "02", students: 1 }] } });
    expect((await moon("01.3")).status).toBe("draft");
    expect(await unlocked(w.studentA, "02")).toBe(true);
    expect((await setup(`select count(*)::int n from audit_log where action = 'moon.publish'`)).rows[0].n).toBe(0);
  });

  it("PUBLISHED, the moon holds 02 shut for A until A masters it; the map shows it; the response counted A", async () => {
    await add(teacherTok, NEW_MOON);
    await addItems("01.3", 3);
    const done = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "A new moon for the chapter", ids: ["01.3"] });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json().impact).toMatchObject({ relocked: 1, stages: [{ stageId: "02", students: 1 }] });
    expect(await unlocked(w.studentA, "02")).toBe(false);
    expect(await mapMoons(tokA)).toEqual(["01.1", "01.2", "01.3"]);
    const audit = await setup(`select payload from audit_log where action = 'moon.publish'`);
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].payload).toMatchObject({ reason: "A new moon for the chapter", relocked: 1 });
  });

  it("the old rule survives: a LIVE moon nobody has mastered still holds the planet shut (B has 01.1 only)", async () => {
    expect(await unlocked(w.studentB, "02")).toBe(false);
  });
});

/* ------------------------------------------------------------------- edit */

describe("editing a moon's wording", () => {
  const edit = { action: "edit", version: 0, description: "Define the term more carefully than the syllabus does", bloom: "remember", level: 6, competency: "read" } as const;

  it("a save is a pending change students never see; Publish makes it live, hands the moon to the console, and audits it", async () => {
    const put = await putPending(teacherTok, "01.1", edit);
    expect(put.statusCode, put.body).toBe(200);
    expect(put.json()).toMatchObject({ ok: true, version: 1 });
    expect((await moon("01.1")).pending).toMatchObject({ action: "edit", version: 1, description: edit.description });
    expect((await moon("01.1")).description).toBe("Moon one, as the syllabus words it");
    const stage = await app.inject({ method: "GET", url: "/api/v1/stages/01", headers: auth(tokA) });
    expect(JSON.stringify(stage.json())).not.toContain("more carefully");

    const done = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "A clearer verb", ids: ["01.1"] });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json()).toMatchObject({ applied: [{ id: "01.1", change: "edit" }], selfApproved: true, impact: { relocked: 0 } });
    expect(await moon("01.1")).toMatchObject({ description: edit.description, owner: "console", status: "live", pending: null });
    const after = await app.inject({ method: "GET", url: "/api/v1/stages/01", headers: auth(tokA) });
    expect(JSON.stringify(after.json())).toContain("more carefully");
    expect((await setup(`select count(*)::int n from audit_log where action = 'moon.publish'`)).rows[0].n).toBe(1);
  });

  it("an edit changes nothing else: questions, mastery and the lock stay as they were", async () => {
    await putPending(teacherTok, "01.1", edit);
    await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "A clearer verb", ids: ["01.1"] });
    expect((await moon("01.1")).questions).toBe(3);
    expect(await unlocked(w.studentA, "02")).toBe(true);
    expect((await setup(`select count(distinct family_id)::int n from objective_progress where objective_id = '01.1' and user_id = $1`, [w.studentA])).rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it("a change of ring is said in words, because the moon moves on the map", async () => {
    await putPending(teacherTok, "01.1", { ...edit, level: 4, competency: "trace" });
    const dry = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "A move", ids: ["01.1"], dryRun: true });
    expect(dry.json().applied[0].moves.join(" ")).toMatch(/ring 6.*ring 4/);
    expect(dry.json().applied[0].moves.join(" ")).toMatch(/read.*trace/);
  });

  it("the admin publishes too; the editing teacher publishing their own edit is recorded as self-approved", async () => {
    await putPending(adminTok, "01.2", { ...edit, description: "Describe the structure and the function of a computer" });
    const done = await publish(adminTok, { hash: (await moonsOf()).hash, reason: "admin edit", ids: ["01.2"] });
    expect(done.statusCode, done.body).toBe(200);
    const audit = await setup(`select payload from audit_log where action = 'moon.publish'`);
    expect(audit.rows[0].payload).toMatchObject({ selfApproved: true });
  });

  it("discarding a pending change leaves the live moon exactly as it was", async () => {
    await putPending(teacherTok, "01.1", edit);
    expect((await delPending(teacherTok, "01.1")).statusCode).toBe(200);
    expect((await moon("01.1")).pending).toBeNull();
    expect((await moon("01.1")).description).toBe("Moon one, as the syllabus words it");
  });

  it("a stale save is a 409 and keeps the other teacher's change; a publish of a moved hash is a 409", async () => {
    await putPending(teacherTok, "01.1", edit);
    const stale = await putPending(adminTok, "01.1", { ...edit, version: 0, description: "Another teacher's sentence for this moon" });
    expect(stale.statusCode).toBe(409);
    expect((await moon("01.1")).pending?.description).toBe(edit.description);
    const { hash } = await moonsOf();
    await putPending(teacherTok, "01.1", { ...edit, version: 1, description: "A second revision of the same sentence" });
    const moved = await publish(teacherTok, { hash, reason: "old read", ids: ["01.1"] });
    expect(moved.statusCode).toBe(409);
    expect((await moon("01.1")).description).toBe("Moon one, as the syllabus words it");
  });

  it("a publish naming a moon with nothing pending is refused, and so are bodies that are wrong", async () => {
    const { hash } = await moonsOf();
    expect((await publish(teacherTok, { hash, reason: "nothing", ids: ["01.1"] })).statusCode).toBe(409);
    expect((await publish(teacherTok, { hash, reason: "x", ids: ["01.1"] })).statusCode).toBe(400);
    expect((await publish(teacherTok, { hash, reason: "fine reason", ids: [] })).statusCode).toBe(400);
    expect((await putPending(teacherTok, "01.1", { action: "edit", version: 0, description: "ok description here" })).statusCode).toBe(400);
    expect((await putPending(teacherTok, "09.9", { action: "retire", version: 0 })).statusCode).toBe(404);
  });
});

/* ----------------------------------------------------------------- retire */

describe("retiring a moon: it disappears, the evidence stays", () => {
  const retire = { action: "retire", version: 0 } as const;

  it("a retired moon leaves the map, the journeys and the lock's count; it OPENS a planet and closes none", async () => {
    // B holds 01.1 only: 02 is shut for B because 01.2 is unmastered.
    expect(await unlocked(w.studentB, "02")).toBe(false);
    await putPending(teacherTok, "01.2", retire);
    const done = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "Out of scope this year", ids: ["01.2"] });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json()).toMatchObject({ applied: [{ id: "01.2", change: "retire" }], impact: { relocked: 0 } });
    expect(await moon("01.2")).toMatchObject({ status: "retired", owner: "console", pending: null });
    expect(await unlocked(w.studentB, "02")).toBe(true);
    expect(await unlocked(w.studentA, "02")).toBe(true);
    expect(await mapMoons(tokA)).toEqual(["01.1"]);
    const j = await app.inject({ method: "POST", url: "/api/v1/objectives/01.2/journey", headers: auth(tokA) });
    expect(j.statusCode).toBe(404);
    const grid = await app.inject({ method: "GET", url: "/api/v1/progress", headers: auth(tokA) });
    const cell = (grid.json().grid as Array<{ level: number; competency: string; objectives: number }>).find((g) => g.level === 6 && g.competency === "read")!;
    expect(cell.objectives).toBe(1);
  });

  it("DENIAL: the evidence survives -- progress, items, the journey and its attempts are all still there, and still append-only", async () => {
    const before = {
      progress: (await setup(`select count(*)::int n from objective_progress where objective_id = '01.2'`)).rows[0].n as number,
      items: (await setup(`select count(*)::int n from items where objective_id = '01.2'`)).rows[0].n as number,
      journeys: (await setup(`select count(*)::int n from blueprints where scope = 'objective' and objective_id = '01.2'`)).rows[0].n as number,
    };
    expect(before.progress).toBeGreaterThan(0);
    await putPending(teacherTok, "01.2", retire);
    await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "Out of scope this year", ids: ["01.2"] });
    expect((await setup(`select count(*)::int n from objective_progress where objective_id = '01.2'`)).rows[0].n).toBe(before.progress);
    expect((await setup(`select count(*)::int n from items where objective_id = '01.2'`)).rows[0].n).toBe(before.items);
    expect((await setup(`select count(*)::int n from blueprints where scope = 'objective' and objective_id = '01.2'`)).rows[0].n).toBe(before.journeys);
    // Rule 7: even the service role cannot rewrite history.
    const upd = await runAs(service, `update objective_progress set objective_id = '01.1' where objective_id = '01.2'`);
    expect(wasDenied(upd), denialReason(upd)).toBe(true);
    const del = await runAs(service, `delete from objective_progress where objective_id = '01.2'`);
    expect(wasDenied(del), denialReason(del)).toBe(true);
    // And no draw takes its questions any more.
    const pool = await loadLivePool(app.db, { stageId: "01" });
    expect(pool.some((p) => p.objectiveId === "01.2")).toBe(false);
    expect(pool.length).toBe(3);
  });

  it("the last live moon of a graded chapter cannot be retired (its planets would never open)", async () => {
    await putPending(teacherTok, "01.2", retire);
    await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "Out of scope", ids: ["01.2"] });
    await putPending(teacherTok, "01.1", retire);
    const refused = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "Out of scope", ids: ["01.1"] });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.message).toMatch(/last|only/i);
    expect((await moon("01.1")).status).toBe("live");
  });

  it("a retirement that leaves a stage check unable to fill is refused, and nothing is retired", async () => {
    // Four questions, at most two per moon: six live questions in two moons just fill it.
    await setup(`insert into blueprints (name, scope, stage_id, total_items, constraints)
                 values ('Stage 01 Check', 'stage', '01', 4, '{"max_per_objective":2}')`);
    await putPending(teacherTok, "01.2", retire);
    const refused = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "Out of scope", ids: ["01.2"] });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.message).toMatch(/check/i);
    expect((await moon("01.2")).status).toBe("live");
    expect((await moon("01.2")).pending).not.toBeNull();
  });

  it("a moon with a minigame says which one leaves the map", async () => {
    await putPending(teacherTok, "01.2", retire);
    const dry = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "Out of scope", ids: ["01.2"], dryRun: true });
    expect(dry.json().gamesRemoved).toEqual([{ id: "01.2", name: "Two Columns" }]);
    expect((await moon("01.2")).status).toBe("live");
  });

  it("a never-published draft with questions is retired (not deleted) through a pending retirement", async () => {
    await add(teacherTok, NEW_MOON);
    await addItems("01.3", 1, "review");
    await putPending(teacherTok, "01.3", retire);
    const done = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "Dropped", ids: ["01.3"] });
    expect(done.statusCode, done.body).toBe(200);
    expect((await moon("01.3")).status).toBe("retired");
    expect((await setup(`select count(*)::int n from items where objective_id = '01.3'`)).rows[0].n).toBe(1);
  });
});

/* ---------------------------------------------------------- the sync guard */

describe("sync-content stops overwriting a moon a teacher owns", () => {
  it("the file's upsert changes a file-owned moon and leaves a console-owned one alone, retired or not", async () => {
    // The statement sync-content runs for every objective in a chapter's front matter.
    const upsert = (id: string, text: string) => setup(
      `insert into objectives (id, stage_id, code, bloom_level, level, competency, description)
       values ($1, '01', $1, 'remember', 6, 'read', $2)
       on conflict (id) do update
         set bloom_level = excluded.bloom_level, level = excluded.level,
             competency = excluded.competency, description = excluded.description
       where objectives.owner = 'file'`,
      [id, text],
    );
    await upsert("01.1", "The file reworded it");
    expect((await moon("01.1")).description).toBe("The file reworded it");
    await setup(`update objectives set owner = 'console', description = 'A teacher reworded it' where id = '01.1'`);
    await upsert("01.1", "The file reworded it again");
    expect((await moon("01.1")).description).toBe("A teacher reworded it");
    await setup(`update objectives set status = 'retired', retired_at = now() where id = '01.2'`);
    await setup(`update objectives set owner = 'console' where id = '01.2'`);
    await upsert("01.2", "The file would revive it");
    expect((await moon("01.2")).status).toBe("retired");
  });
});

/* ------------------------------------------------- last: it leaves evidence */

describe("mastering a published moon reopens the planet it had shut (kept last: it leaves a journey behind)", () => {
  it("A masters 01.3 through its journey and 02 opens again", async () => {
    await add(teacherTok, NEW_MOON);
    await addItems("01.3", 3);
    const done = await publish(teacherTok, { hash: (await moonsOf()).hash, reason: "A new moon for the chapter", ids: ["01.3"] });
    expect(done.statusCode, done.body).toBe(200);
    expect(await unlocked(w.studentA, "02")).toBe(false);
    await practise(tokA, "01.3", 3);
    expect(await unlocked(w.studentA, "02")).toBe(true);
  });
});
