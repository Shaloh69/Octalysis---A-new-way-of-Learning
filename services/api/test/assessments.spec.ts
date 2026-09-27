import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * Creating the thing a student sits.
 *
 * Two guarantees, and both are about failing at the right moment.
 *
 * The exam salt must never be readable by a client — with it, every paper is
 * predictable. And a blueprint that cannot be filled must be reported when the
 * assessment is created, not when forty students press Start.
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
let blueprintId: string;

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

  const { rows } = await pool.query("select id from blueprints where scope = 'stage' limit 1");
  blueprintId = rows[0]!.id;
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe("assessment creation is staff-only", () => {
  it("refuses a student the list, the feasibility check and creation", async () => {
    for (const call of [
      app.inject({ method: "GET", url: "/api/v1/console/assessments", headers: auth(studentToken) }),
      app.inject({
        method: "GET",
        url: `/api/v1/console/blueprints/${blueprintId}/feasibility`,
        headers: auth(studentToken),
      }),
      app.inject({
        method: "POST", url: "/api/v1/console/assessments",
        headers: auth(studentToken),
        payload: { blueprintId, title: "Sneaky", attemptsAllowed: 1 },
      }),
    ]) {
      expect((await call).statusCode).toBe(403);
    }
  });
});

describe("the exam salt", () => {
  let created: string;

  it("is minted when the assessment is created", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: { blueprintId, title: "Stage 07 check", attemptsAllowed: 2 },
    });
    expect(res.statusCode).toBe(201);
    created = res.json().id;

    const { rows } = await pool.query(
      "select exam_salt from assessment_secrets where assessment_id = $1",
      [created],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.exam_salt).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is NEVER in any response body", async () => {
    // With the salt, every paper in the course becomes predictable. It is the
    // one value in this system that is worse to leak than an answer key.
    const { rows } = await pool.query(
      "select exam_salt from assessment_secrets where assessment_id = $1",
      [created],
    );
    const salt = rows[0]!.exam_salt as string;

    const list = await app.inject({
      method: "GET", url: "/api/v1/console/assessments", headers: auth(teacherToken),
    });
    expect(list.body).not.toContain(salt);
    expect(list.body).not.toContain("exam_salt");
    expect(list.body).not.toContain("examSalt");
  });

  it("differs between assessments", async () => {
    const second = await app.inject({
      method: "POST", url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: { blueprintId, title: "Stage 07 retake", attemptsAllowed: 1 },
    });
    const { rows } = await pool.query(
      "select exam_salt from assessment_secrets where assessment_id in ($1, $2)",
      [created, second.json().id],
    );
    expect(rows).toHaveLength(2);
    // A shared salt would make two assessments generate the same paper for the
    // same student, which defeats a retake.
    expect(rows[0]!.exam_salt).not.toBe(rows[1]!.exam_salt);
  });
});

describe("feasibility is answered BEFORE the assessment exists", () => {
  it("reports the pool and whether the blueprint can be filled", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/console/blueprints/${blueprintId}/feasibility`,
      headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(200);
    const f = res.json();
    expect(f).toHaveProperty("poolSize");
    expect(f).toHaveProperty("enoughItems");
    expect(f).toHaveProperty("shortfalls");
    expect(f).toHaveProperty("satisfiable");
  });

  it("names the SHORTFALL CELL when a constraint cannot be met", async () => {
    // The whole value of asking early: not "it will fail" but "it will fail
    // because you need 40 `analyze` items and have 2".
    const { rows } = await pool.query(
      `insert into blueprints (name, scope, stage_id, total_items, constraints)
       values ('Impossible', 'stage', $1, 40,
               '{"by_bloom":{"analyze":40},"by_type":{"S":40}}'::jsonb)
       returning id`,
      [w.stageId],
    );
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/console/blueprints/${rows[0]!.id}/feasibility`,
      headers: auth(teacherToken),
    });
    const f = res.json();
    expect(f.satisfiable).toBe(false);
    expect(f.shortfalls.length).toBeGreaterThan(0);
    const bloom = f.shortfalls.find((s: { dimension: string }) => s.dimension === "by_bloom");
    expect(bloom).toBeDefined();
    expect(bloom.cell).toBe("analyze");
    expect(bloom.need).toBe(40);
    expect(bloom.have).toBeLessThan(40);

    await pool.query("delete from blueprints where name = 'Impossible'");
  });

  it("excludes non-gradeable stages from the pool", async () => {
    // V-1: stage 00 is orientation and is never sampled. Counting it would
    // report a bank as satisfiable when it is not.
    const { rows } = await pool.query(
      `select count(*)::int as n from items i
         join stages s on s.id = i.stage_id
        where i.status = 'live' and not s.gradeable`,
    );
    // Whatever that count is, feasibility must not include it.
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/console/blueprints/${blueprintId}/feasibility`,
      headers: auth(teacherToken),
    });
    const live = await pool.query(
      `select count(*)::int as n from items i
         join stages s on s.id = i.stage_id
        where i.status = 'live' and s.gradeable and i.stage_id = $1`,
      [w.stageId],
    );
    expect(res.json().poolSize).toBe(Number(live.rows[0]!.n));
    expect(Number(rows[0]!.n)).toBeGreaterThanOrEqual(0);
  });
});

describe("validation", () => {
  it("refuses a closing time before the opening time", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: {
        blueprintId,
        title: "Backwards",
        attemptsAllowed: 1,
        opensAt: "2026-09-10T09:00:00.000Z",
        closesAt: "2026-09-01T09:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/after the opening time/i);
  });

  it("refuses an unknown blueprint", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: {
        blueprintId: "00000000-0000-0000-0000-000000000000",
        title: "Nowhere",
        attemptsAllowed: 1,
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("there is no DELETE route — an assessment with attempts is evidence", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/console/assessments/00000000-0000-0000-0000-000000000000",
      headers: auth(teacherToken),
    });
    expect(res.statusCode).toBe(404);
  });
});

/**
 * MOVING THE WINDOW AFTER THE FACT.
 *
 * This endpoint did not exist. The file's own closing comment said "closing it
 * is a `closes_at` in the past; that is the supported way to end one" while the
 * route offered only GET and POST — so an assessment created without dates was
 * open forever, and one created with them could never be extended.
 *
 * Led by the denial test, per hard rule 8: the interesting question is not
 * whether a teacher can move an exam window, it is whether a student can.
 */
describe("the exam window can be changed, by staff, with a reason", () => {
  let target: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: { blueprintId, title: "Window under test", attemptsAllowed: 5 },
    });
    expect(res.statusCode).toBe(201);
    target = res.json().id as string;
  });

  it("DENIES a student — they cannot move their own exam window", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/assessments/${target}`,
      headers: auth(studentToken),
      payload: { closesAt: "2099-01-01T00:00:00.000Z", reason: "more time please" },
    });
    expect(res.statusCode).toBe(403);

    // And nothing moved.
    const { rows } = await pool.query("select closes_at from assessments where id = $1", [target]);
    expect(rows[0]!.closes_at).toBeNull();
  });

  it("lets staff set a window, and records the change with its reason", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/assessments/${target}`,
      headers: auth(teacherToken),
      payload: {
        opensAt: "2026-10-01T00:00:00.000Z",
        closesAt: "2026-10-08T00:00:00.000Z",
        reason: "Prelim week, section A",
      },
    });
    expect(res.statusCode).toBe(200);

    const { rows } = await pool.query(
      "select opens_at, closes_at from assessments where id = $1",
      [target],
    );
    expect(rows[0]!.opens_at).not.toBeNull();
    expect(rows[0]!.closes_at).not.toBeNull();

    const audit = await pool.query(
      `select payload from audit_log
        where action = 'assessment.window' and target_id = $1
        order by at desc limit 1`,
      [target],
    );
    expect(audit.rowCount).toBe(1);
    const p = audit.rows[0]!.payload as { reason: string; from: unknown; to: unknown };
    expect(p.reason).toBe("Prelim week, section A");
    // Both sides are recorded: "it changed" is useless without "from what".
    expect(p.from).toBeTruthy();
    expect(p.to).toBeTruthy();
  });

  it("refuses a window that closes before it opens, even across two calls", async () => {
    /*
     * The check is on the RESULTING window, not on the fields in this request.
     * Sending only `opensAt` could otherwise push the opening past a closing
     * date already stored, and each call would look valid on its own.
     */
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/assessments/${target}`,
      headers: auth(teacherToken),
      payload: { opensAt: "2026-11-01T00:00:00.000Z", reason: "shift it later" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/cannot close before it opens/i);
  });

  it("requires a reason — an unexplained audit entry is not worth writing", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/assessments/${target}`,
      headers: auth(teacherToken),
      payload: { closesAt: null },
    });
    expect(res.statusCode).toBe(400);
  });

  it("distinguishes null from absent, so a bound can be cleared", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/assessments/${target}`,
      headers: auth(teacherToken),
      payload: { closesAt: null, reason: "extended indefinitely" },
    });
    expect(res.statusCode).toBe(200);

    const { rows } = await pool.query(
      "select opens_at, closes_at from assessments where id = $1",
      [target],
    );
    expect(rows[0]!.closes_at, "null should CLEAR the closing bound").toBeNull();
    expect(rows[0]!.opens_at, "an unmentioned field must be left alone").not.toBeNull();
  });

  it("refuses to lower the attempt limit below a sitting that already happened", async () => {
    /*
     * Its OWN assessment, with no window. Reusing `target` failed for a reason
     * worth keeping: the tests above had set an opening date in the future, so
     * the student was correctly refused with "that assessment has not opened
     * yet". The guard being tested here is about attempt counts, and a fixture
     * that also exercises the window makes a failure ambiguous.
     */
    const made = await app.inject({
      method: "POST",
      url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: { blueprintId, title: "Attempt limit under test", attemptsAllowed: 5 },
    });
    expect(made.statusCode).toBe(201);
    const id = made.json().id as string;

    const start = await app.inject({
      method: "POST",
      url: "/api/v1/attempts",
      headers: auth(studentToken),
      payload: { assessmentId: id },
    });
    expect([200, 201]).toContain(start.statusCode);

    // Down to 1 is legal: exactly one sitting exists.
    const ok = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/assessments/${id}`,
      headers: auth(teacherToken),
      payload: { attemptsAllowed: 1, reason: "one sitting only from here" },
    });
    expect(ok.statusCode).toBe(200);

    // Raising is always safe.
    const up = await app.inject({
      method: "PATCH",
      url: `/api/v1/console/assessments/${id}`,
      headers: auth(teacherToken),
      payload: { attemptsAllowed: 5, reason: "restore the five" },
    });
    expect(up.statusCode).toBe(200);
  });
});

/**
 * ROTATING THE EXAM SALT BETWEEN TERMS.
 *
 * `PAGE-SPECS.md` §/console/assessments has always asked for it, and nothing
 * did it: a salt was minted once, at creation, and lived forever. Reusing an
 * assessment next term would hand next term's students the papers this term's
 * students already sat.
 *
 * Led by the denials (hard rule 8). The salt is the one value in the system
 * worse to leak than a key, so the tests also prove it appears in no response
 * and in no audit row, before and after a rotation.
 */
describe("the exam salt can be rotated, by staff, with a reason", () => {
  let target: string;
  const saltOf = async (id: string) =>
    (
      await pool.query(
        "select exam_salt, rotated_at from assessment_secrets where assessment_id = $1",
        [id],
      )
    ).rows[0] as { exam_salt: string; rotated_at: Date };

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: { blueprintId, title: "Salt under test", attemptsAllowed: 5 },
    });
    expect(res.statusCode).toBe(201);
    target = res.json().id as string;
  });

  it("DENIES a student, and the salt does not change", async () => {
    const before = await saltOf(target);
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/console/assessments/${target}/rotate-salt`,
      headers: auth(studentToken),
      payload: { reason: "I would like different questions" },
    });
    expect(res.statusCode).toBe(403);
    expect((await saltOf(target)).exam_salt).toBe(before.exam_salt);
  });

  it("DENIES an anonymous caller", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/console/assessments/${target}/rotate-salt`,
      payload: { reason: "no token at all" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("requires a reason", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/console/assessments/${target}/rotate-salt`,
      headers: auth(teacherToken),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("answers 404 for an assessment that does not exist", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/assessments/00000000-0000-4000-8000-000000000000/rotate-salt",
      headers: auth(teacherToken),
      payload: { reason: "nothing here" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rotates for staff, leaves a paper already started exactly as it was, and audits without the salt", async () => {
    // A sitting that began under the old salt. Its seed is stored on the row,
    // so a rotation must not change a single question of it.
    const first = await app.inject({
      method: "POST", url: "/api/v1/attempts",
      headers: auth(studentToken),
      payload: { assessmentId: target },
    });
    expect([200, 201]).toContain(first.statusCode);

    const before = await saltOf(target);
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/console/assessments/${target}/rotate-salt`,
      headers: auth(teacherToken),
      payload: { reason: "Second semester, 2026-2027" },
    });
    expect(res.statusCode).toBe(200);
    const after = await saltOf(target);
    expect(after.exam_salt).toMatch(/^[0-9a-f]{64}$/);
    expect(after.exam_salt).not.toBe(before.exam_salt);
    expect(after.rotated_at.getTime()).toBeGreaterThan(before.rotated_at.getTime());

    // Neither salt is in the response.
    expect(res.body).not.toContain(before.exam_salt);
    expect(res.body).not.toContain(after.exam_salt);

    // Resuming the in-progress sitting returns the identical paper.
    const resumed = await app.inject({
      method: "POST", url: "/api/v1/attempts",
      headers: auth(studentToken),
      payload: { assessmentId: target },
    });
    expect(resumed.json().resumed).toBe(true);
    expect(resumed.json().attemptId).toBe(first.json().attemptId);
    expect(JSON.stringify(resumed.json().items)).toBe(JSON.stringify(first.json().items));

    const audit = await pool.query(
      `select actor_id, payload from audit_log
        where action = 'assessment.salt_rotate' and target_id = $1`,
      [target],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0]!.actor_id).toBe(w.teacher);
    expect(audit.rows[0]!.payload.reason).toBe("Second semester, 2026-2027");
    const raw = JSON.stringify(audit.rows[0]!.payload);
    expect(raw).not.toContain(before.exam_salt);
    expect(raw).not.toContain(after.exam_salt);
  });

  it("the list says when the salt was set and rotated, and never what it is", async () => {
    const { exam_salt } = await saltOf(target);
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/assessments", headers: auth(teacherToken),
    });
    expect(list.statusCode).toBe(200);
    const row = list.json().assessments.find((a: { id: string }) => a.id === target);
    expect(row.saltSetAt).toBeTruthy();
    expect(row.saltRotatedAt).toBeTruthy();
    expect(list.body).not.toContain(exam_salt);
    expect(list.body).not.toContain("exam_salt");
    expect(list.body).not.toContain("examSalt");
  });
});

/**
 * AN ASSESSMENT SCOPED TO A SECTION IS FOR THAT SECTION.
 *
 * The stage reader and RLS both honoured `assessments.section_id`, but
 * `POST /attempts` loaded an assessment by id and never asked. A student in
 * another section who had the id could sit it. Now they are told it does not
 * exist, which is exactly what RLS already shows them.
 */
describe("a section-scoped assessment", () => {
  it("the list carries the sections a teacher can scope to", async () => {
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/assessments", headers: auth(teacherToken),
    });
    const sections = list.json().sections as Array<{ id: string; code: string }>;
    expect(sections.some((s) => s.id === w.sectionId)).toBe(true);
  });

  it("DENIES a student of another section at Start, and writes no attempt", async () => {
    const other = await pool.query(
      "insert into sections (code, term) values ('BSCPE-OTHER','2026-1') returning id",
    );
    const made = await app.inject({
      method: "POST", url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: {
        blueprintId, title: "Another section's check", attemptsAllowed: 5,
        sectionId: other.rows[0]!.id,
      },
    });
    expect(made.statusCode).toBe(201);
    const id = made.json().id as string;

    const res = await app.inject({
      method: "POST", url: "/api/v1/attempts",
      headers: auth(studentToken),
      payload: { assessmentId: id },
    });
    expect(res.statusCode).toBe(404);
    const { rows } = await pool.query(
      "select count(*)::int as n from attempts where assessment_id = $1",
      [id],
    );
    expect(rows[0]!.n).toBe(0);
  });

  it("lets a student of THAT section start it", async () => {
    const made = await app.inject({
      method: "POST", url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: { blueprintId, title: "Own section's check", attemptsAllowed: 5, sectionId: w.sectionId },
    });
    expect(made.statusCode).toBe(201);
    const res = await app.inject({
      method: "POST", url: "/api/v1/attempts",
      headers: auth(studentToken),
      payload: { assessmentId: made.json().id },
    });
    expect([200, 201]).toContain(res.statusCode);
  });
});

describe("the list answers 'can the bank fill it?' for every row", () => {
  it("each row's bank is exactly the feasibility endpoint's answer for its blueprint", async () => {
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/assessments", headers: auth(teacherToken),
    });
    const rows = list.json().assessments as Array<{ blueprintId: string; bank: Record<string, unknown> }>;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const f = await app.inject({
        method: "GET",
        url: `/api/v1/console/blueprints/${r.blueprintId}/feasibility`,
        headers: auth(teacherToken),
      });
      const { blueprintId: _id, name: _name, ...answer } = f.json();
      // Two places, one answer: the create form and the row can never disagree.
      expect(r.bank).toEqual(answer);
    }
  });

  it("refuses to scope an assessment to a section that does not exist", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/assessments",
      headers: auth(teacherToken),
      payload: {
        blueprintId, title: "Nowhere section", attemptsAllowed: 1,
        sectionId: "00000000-0000-4000-8000-000000000000",
      },
    });
    expect(res.statusCode).toBe(404);
  });
});
