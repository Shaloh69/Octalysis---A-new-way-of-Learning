import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * Lecture Mode — the projector view.
 *
 * `apps/console/CLAUDE.md`: **no names, ever.** That is a promise about a
 * payload, so it is tested against the payload: the response body is searched
 * for every real student's name, student ID and user ID, and must contain none
 * of them. A UI that "does not render the name" is not the same guarantee.
 *
 * The second rule is quieter and matters just as much: an aggregate over a
 * handful of people is not anonymous. Four students in a room, "3 of 4 chose
 * B", and one visible face identifies everyone. Below the threshold the server
 * sends no distribution at all.
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

let app: FastifyInstance;
let w: BankWorld;
let teacherToken: string;
let studentToken: string;

beforeAll(async () => {
  w = await seedItemBank();
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
  studentToken = mintToken(w.studentA, "student", "21-0001");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe("the projector payload carries NO identifying field", () => {
  it("contains no name, no student ID, and no user ID", async () => {
    // Give the room something to aggregate.
    await app.inject({
      method: "POST", url: "/api/v1/attempts",
      headers: auth(studentToken), payload: { assessmentId: w.stageAssessmentId },
    });

    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live", headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);

    const body = res.body;

    // Every real identifier in the fixture world, searched for literally.
    const { rows } = await pool.query(
      "select id, full_name, student_id from profiles where full_name is not null",
    );
    expect(rows.length).toBeGreaterThan(0);

    for (const r of rows) {
      expect(body, `leaked a name: ${r.full_name}`).not.toContain(r.full_name);
      if (r.student_id) {
        expect(body, `leaked a student id: ${r.student_id}`).not.toContain(r.student_id);
      }
      expect(body, `leaked a user id: ${r.id}`).not.toContain(r.id);
    }

    // And the field names themselves, so a future join cannot sneak one in
    // without this failing.
    for (const field of ["full_name", "fullName", "student_id", "studentId", "user_id", "userId"]) {
      expect(body, `payload mentions ${field}`).not.toContain(field);
    }
  });

  it("is staff-only", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live", headers: auth(studentToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("a small cohort is suppressed rather than shown", () => {
  it("withholds the distribution below the threshold", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live", headers: auth(teacherToken),
    });
    const body = res.json();

    // The fixture world has two students, which is well under the floor.
    expect(body.cohort).toBeLessThan(body.minCohort);
    // Until 29 Sep 2026 a top-level `spread` grouped answers by question NUMBER
    // across every open paper, so "question 3" mixed different questions, and
    // it was never drawn. The distribution now belongs to the one question
    // running (`session.correct`, below); the old field is gone, not kept.
    expect(body).not.toHaveProperty("spread");
    // Not "sent and hidden by CSS" -- not sent.
    for (const s of body.stages) {
      if (s.students < body.minCohort) expect(s.avgMastery, `stage ${s.stageId}`).toBeNull();
    }
  });

  it("tells the student view the same thing", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/live", headers: auth(studentToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().suppressed).toBe(true);
  });

  it("refuses the student view to anyone signed out", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/live" });
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
  });
});

describe("the health strip", () => {
  it("reports what a teacher needs mid-lecture, and nothing about individuals", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/live/health", headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b).toHaveProperty("inProgress");
    expect(b).toHaveProperty("submittedRecently");
    // A spike in reports during a lecture usually means ONE broken item rather
    // than forty confused students, which is worth seeing immediately.
    expect(b).toHaveProperty("reportsRecently");
    expect(Object.keys(b)).toHaveLength(3);
  });
});

/* ------------------------------------------------------------------
 * 29 Sep 2026 rebuild: the per-stage small-cell rule, "working now" by
 * activity, and the server half of "push an item" (instructor rulings).
 * ---------------------------------------------------------------- */

/** Students who exist only for these tests, cleaned by resetAll (octa-test.local). */
async function extraStudents(n: number, tag: string): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const { rows } = await pool.query(
      `with u as (
         insert into auth.users (id, email, raw_app_meta_data)
         values (gen_random_uuid(), $1, '{"role":"student"}'::jsonb) returning id
       )
       insert into profiles (id, full_name, role)
       select id, $2, 'student'::user_role from u returning id::text as id`,
      [`${tag}-${i}@octa-test.local`, `Live Test ${tag} ${i}`],
    );
    ids.push(rows[0].id as string);
  }
  return ids;
}

const snapshot = async () =>
  (await app.inject({ method: "GET", url: "/api/v1/console/live", headers: auth(teacherToken) })).json();

describe("a stage's average is withheld below the threshold, the whole class included", () => {
  it("sends the count of people and no average when fewer than five have progress", async () => {
    const four = await extraStudents(4, "few");
    for (const id of four) {
      await pool.query("insert into stage_progress (user_id, stage_id, mastery) values ($1, '05', 0.9)", [id]);
    }
    const s = (await snapshot()).stages.find((x: { stageId: string }) => x.stageId === "05");
    expect(s, "stage 05 is missing from the snapshot").toBeTruthy();
    expect(s.students).toBe(4);
    // With four people, "05 · 90%" is each of their scores on a projector.
    expect(s.avgMastery).toBeNull();
  });

  it("POSITIVE CONTROL: at five, the average is sent", async () => {
    const [fifth] = await extraStudents(1, "fifth");
    await pool.query("insert into stage_progress (user_id, stage_id, mastery) values ($1, '05', 0.4)", [fifth]);
    const s = (await snapshot()).stages.find((x: { stageId: string }) => x.stageId === "05");
    expect(s.students).toBe(5);
    expect(s.avgMastery).toBe(80);
    expect(typeof s.title).toBe("string");
  });
});

describe("working now counts activity, not only a start", () => {
  it("counts a student 25 minutes into a paper who answered two minutes ago", async () => {
    const before = (await snapshot()).cohort;
    const [late] = await extraStudents(1, "active");
    const { rows } = await pool.query(
      `insert into attempts (user_id, assessment_id, seed, started_at)
       values ($1, $2, 'test-seed', now() - interval '25 minutes') returning id`,
      [late, w.stageAssessmentId],
    );
    await pool.query(
      `insert into responses (attempt_id, ordinal, raw_answer, is_correct, answered_at)
       values ($1, 1, '"A"'::jsonb, false, now() - interval '2 minutes')`,
      [rows[0].id],
    );
    expect((await snapshot()).cohort).toBe(before + 1);
  });

  it("and not one who started 25 minutes ago and has done nothing since", async () => {
    const before = (await snapshot()).cohort;
    const [idle] = await extraStudents(1, "idle");
    await pool.query(
      `insert into attempts (user_id, assessment_id, seed, started_at)
       values ($1, $2, 'test-seed', now() - interval '25 minutes')`,
      [idle, w.stageAssessmentId],
    );
    expect((await snapshot()).cohort).toBe(before);
  });
});

describe("a question put to the room: staff only, audited, one at a time", () => {
  let liveItem: { id: string; slug: string };
  let draftItemId: string;

  beforeAll(async () => {
    const { rows } = await pool.query(
      "select id::text as id, slug from items where status = 'live' and stage_id = '07' order by slug limit 1",
    );
    liveItem = rows[0] as { id: string; slug: string };
    const d = await pool.query(
      `insert into items (slug, stage_id, objective_id, type, status, version, bloom, stem_template, correct_spec, distractor_pool)
       select 'S-07-live-draft', stage_id, objective_id, type, 'review', 1, bloom, stem_template, correct_spec, distractor_pool
         from items where id = $1 returning id::text as id`,
      [liveItem.id],
    );
    draftItemId = d.rows[0].id as string;
  });

  const start = (token: string, payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/v1/console/live/sessions", headers: auth(token), payload });

  it("a student cannot start one, and nothing is written", async () => {
    const res = await start(studentToken, { itemId: liveItem.id, sectionId: null, reason: "Warm-up question" });
    expect(res.statusCode).toBe(403);
    const { rows } = await pool.query("select count(*)::int as n from live_sessions");
    expect(rows[0].n, "a student's refused start left a session behind").toBe(0);
  });

  it("a student cannot read what can be started", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/live/options", headers: auth(studentToken) });
    expect(res.statusCode).toBe(403);
  });

  it("options list live items only, and the sections", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/live/options", headers: auth(teacherToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const slugs = body.items.map((i: { slug: string }) => i.slug);
    expect(slugs).toContain(liveItem.slug);
    expect(slugs, "an item at review is offered to the room").not.toContain("S-07-live-draft");
    expect(body.sections.map((s: { code: string }) => s.code)).toContain("BSCPE-2A");
  });

  it("refuses a start with no reason", async () => {
    const res = await start(teacherToken, { itemId: liveItem.id, sectionId: null, reason: "" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/why/i);
  });

  it("refuses an item that is not live, and says where it is", async () => {
    const res = await start(teacherToken, { itemId: draftItemId, sectionId: null, reason: "Warm-up question" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/S-07-live-draft is at review/);
  });

  it("refuses a section that does not exist", async () => {
    const res = await start(teacherToken, {
      itemId: liveItem.id, sectionId: "00000000-0000-4000-8000-000000000000", reason: "Warm-up question",
    });
    expect(res.statusCode).toBe(404);
  });

  let sessionId: string;

  it("starts one, writes audit_log with the actor and the reason, and shows it", async () => {
    const res = await start(teacherToken, { itemId: liveItem.id, sectionId: w.sectionId, reason: "Warm-up on cycle time" });
    expect(res.statusCode).toBe(201);
    sessionId = res.json().session.id;

    const { rows } = await pool.query(
      "select actor_id::text as actor, target_type, target_id, payload from audit_log where action = 'live.start'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor).toBe(w.teacher);
    expect(rows[0].target_type).toBe("item");
    expect(rows[0].target_id).toBe(liveItem.id);
    expect(rows[0].payload.reason).toBe("Warm-up on cycle time");
    expect(rows[0].payload.sessionId).toBe(sessionId);

    const s = (await snapshot()).session;
    expect(s.id).toBe(sessionId);
    expect(s.itemSlug).toBe(liveItem.slug);
    expect(s.section).toBe("BSCPE-2A");
    expect(s.answered).toBe(0);
    expect(s.correct).toBeNull();
  });

  it("refuses a second while one is running", async () => {
    const res = await start(teacherToken, { itemId: liveItem.id, sectionId: null, reason: "Another one" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/already running/i);
  });

  it("withholds how many got it right until five have answered", async () => {
    const people = await extraStudents(5, "answer");
    for (const [i, id] of people.slice(0, 4).entries()) {
      await pool.query(
        `insert into live_responses (session_id, user_id, raw_answer, is_correct) values ($1, $2, '"A"'::jsonb, $3)`,
        [sessionId, id, i < 3],
      );
    }
    let s = (await snapshot()).session;
    expect(s.answered).toBe(4);
    expect(s.correct, "four answers and their split is on the projector").toBeNull();

    await pool.query(
      `insert into live_responses (session_id, user_id, raw_answer, is_correct) values ($1, $2, '"B"'::jsonb, false)`,
      [sessionId, people[4]],
    );
    s = (await snapshot()).session;
    expect(s.answered).toBe(5);
    expect(s.correct, "POSITIVE CONTROL: at five the split is sent").toBe(3);
  });

  it("the payload still names nobody while a question runs, the teacher included", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/live", headers: auth(teacherToken) });
    const { rows } = await pool.query("select id::text as id, full_name, student_id from profiles");
    for (const r of rows) {
      expect(res.body, `leaked a name: ${r.full_name}`).not.toContain(r.full_name);
      expect(res.body, `leaked a user id: ${r.id}`).not.toContain(r.id);
      if (r.student_id) expect(res.body).not.toContain(r.student_id);
    }
  });

  const end = (token: string, id: string, payload: Record<string, unknown>) =>
    app.inject({ method: "POST", url: `/api/v1/console/live/sessions/${id}/end`, headers: auth(token), payload });

  it("a student cannot end it", async () => {
    const res = await end(studentToken, sessionId, { reason: "Done" });
    expect(res.statusCode).toBe(403);
    expect((await snapshot()).session?.id, "a student's refused end ended it").toBe(sessionId);
  });

  it("refuses an end with no reason", async () => {
    expect((await end(teacherToken, sessionId, { reason: "" })).statusCode).toBe(400);
  });

  it("ends it, audited with the actor, the reason and how many answered", async () => {
    const res = await end(teacherToken, sessionId, { reason: "Discussed the answer" });
    expect(res.statusCode).toBe(200);
    const { rows } = await pool.query(
      "select actor_id::text as actor, payload from audit_log where action = 'live.end'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor).toBe(w.teacher);
    expect(rows[0].payload.reason).toBe("Discussed the answer");
    expect(rows[0].payload.answered).toBe(5);
    expect((await snapshot()).session).toBeNull();
  });

  it("refuses to end it twice, and a session that does not exist", async () => {
    expect((await end(teacherToken, sessionId, { reason: "Again" })).statusCode).toBe(409);
    expect((await end(teacherToken, "00000000-0000-4000-8000-000000000000", { reason: "Nope" })).statusCode).toBe(404);
  });

  it("/audit says what happened, in words", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/audit?family=live", headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const what = res.json().entries.map((e: { what: string }) => e.what);
    expect(what).toContain(`Put ${liveItem.slug} to the room, for section BSCPE-2A`);
    expect(what).toContain(`Ended ${liveItem.slug} after 5 answers`);
  });
});
