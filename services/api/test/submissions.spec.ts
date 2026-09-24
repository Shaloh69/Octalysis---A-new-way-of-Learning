import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

/**
 * Labs, the project, and participation — 40% of the final grade.
 *
 * The denials come first, and the one that matters most is the FREEZE: once a
 * person has marked something, the student must not be able to change what was
 * marked. That is enforced by a database trigger, so this suite checks it
 * through the API *and* directly against the database — the API could be
 * bypassed, the trigger cannot.
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
let studentAToken: string;
let studentBToken: string;

const LAB = {
  kind: "lab" as const,
  title: "LAB 04 — Cache Addresses",
  stageId: "04",
  bodyMd:
    "We computed the tag, line and word fields for a 64 KB cache with 16-byte lines, " +
    "then checked the split against the worked example. The reasoning is in section 2.",
};

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
  studentAToken = mintToken(w.studentA, "student", "21-0001");
  studentBToken = mintToken(w.studentB, "student", "21-0002");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

/* ----------------------------------------------------------- denial first */

describe("grading is staff-only", () => {
  it("refuses a student the console list and the grade route", async () => {
    const list = await app.inject({
      method: "GET", url: "/api/v1/console/submissions", headers: auth(studentAToken),
    });
    expect(list.statusCode).toBe(403);

    const grade = await app.inject({
      method: "POST",
      url: "/api/v1/console/submissions/00000000-0000-0000-0000-000000000000/grade",
      headers: auth(studentAToken),
      payload: { score: 4, maxScore: 4 },
    });
    expect(grade.statusCode).toBe(403);
  });

  it("a student sees only their OWN submissions", async () => {
    await app.inject({
      method: "PUT", url: "/api/v1/submissions/LAB-04",
      headers: auth(studentAToken), payload: LAB,
    });

    const mine = await app.inject({
      method: "GET", url: "/api/v1/submissions", headers: auth(studentBToken),
    });
    expect(mine.statusCode).toBe(200);
    // Student B has submitted nothing, and must not see A's work.
    expect(mine.json().submissions).toHaveLength(0);
  });
});

/* --------------------------------------------------------------- handing in */

describe("handing in", () => {
  it("REFUSES a submission with no written reasoning", async () => {
    // The rubric gives a full point for stated reasoning. Accepting an empty
    // write-up and marking it down later penalises a student for something
    // nobody told them.
    const res = await app.inject({
      method: "PUT", url: "/api/v1/submissions/LAB-05",
      headers: auth(studentAToken),
      payload: { ...LAB, slug: "LAB-05", title: "LAB 05", bodyMd: "done" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/reasoning/i);
  });

  it("allows a DRAFT with no reasoning, because a draft is not a hand-in", async () => {
    const res = await app.inject({
      method: "PUT", url: "/api/v1/submissions/LAB-05",
      headers: auth(studentAToken),
      payload: { ...LAB, slug: "LAB-05", title: "LAB 05", bodyMd: "wip", submit: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("draft");
  });

  it("re-handing-in REPLACES the slot rather than creating a second row", async () => {
    await app.inject({
      method: "PUT", url: "/api/v1/submissions/LAB-04",
      headers: auth(studentAToken),
      payload: { ...LAB, bodyMd: LAB.bodyMd + " Revised after checking the line size." },
    });

    const { rows } = await pool.query(
      "select count(*)::int as n from submissions where user_id = $1 and slug = 'LAB-04'",
      [w.studentA],
    );
    // One slot per deliverable. A second row is a submission a grader misses.
    expect(rows[0]!.n).toBe(1);
  });
});

/* ------------------------------------------------------------- the freeze */

describe("a graded submission is frozen", () => {
  let subId: string;

  beforeAll(async () => {
    const { rows } = await pool.query(
      "select id from submissions where user_id = $1 and slug = 'LAB-04'",
      [w.studentA],
    );
    subId = rows[0]!.id;

    const res = await app.inject({
      method: "POST", url: `/api/v1/console/submissions/${subId}/grade`,
      headers: auth(teacherToken),
      payload: { score: 3, maxScore: 4, rubric: { reasoning: 0, correctness: 3 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it("refuses the student through the API", async () => {
    const res = await app.inject({
      method: "PUT", url: "/api/v1/submissions/LAB-04",
      headers: auth(studentAToken),
      payload: { ...LAB, bodyMd: LAB.bodyMd + " Sneaking in a better answer." },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/already been graded/i);
  });

  it("refuses it AT THE DATABASE, which is the guarantee that matters", async () => {
    // The API could be bypassed. The trigger cannot -- it fires for the service
    // role too, exactly like the append-only triggers on `responses`.
    await expect(
      pool.query("update submissions set body_md = 'rewritten after grading' where id = $1", [
        subId,
      ]),
    ).rejects.toThrow(/graded/i);
  });

  it("allows a REGRADE once staff have returned it, and records why", async () => {
    const ret = await app.inject({
      method: "POST", url: `/api/v1/console/submissions/${subId}/return`,
      headers: auth(teacherToken),
      payload: { reason: "Rubric applied to the wrong section; rework part 2." },
    });
    expect(ret.statusCode).toBe(200);

    const res = await app.inject({
      method: "PUT", url: "/api/v1/submissions/LAB-04",
      headers: auth(studentAToken),
      payload: { ...LAB, bodyMd: LAB.bodyMd + " Reworked part 2 as asked." },
    });
    expect(res.statusCode).toBe(200);

    const { rows } = await pool.query(
      "select payload from audit_log where action = 'submission.return' order by at desc limit 1",
    );
    expect(rows[0]!.payload.reason).toMatch(/rework/i);
  });

  it("REFUSES to return a submission without a reason", async () => {
    const res = await app.inject({
      method: "POST", url: `/api/v1/console/submissions/${subId}/return`,
      headers: auth(teacherToken),
      payload: { reason: "" },
    });
    expect(res.statusCode).toBe(400);
  });
});

/* -------------------------------------------------------------- integrity */

describe("grading integrity", () => {
  it("REFUSES a score above its own maximum", async () => {
    const { rows } = await pool.query(
      "select id from submissions where user_id = $1 and slug = 'LAB-05'",
      [w.studentA],
    );
    const res = await app.inject({
      method: "POST", url: `/api/v1/console/submissions/${rows[0]!.id}/grade`,
      headers: auth(teacherToken),
      payload: { score: 9, maxScore: 4 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/above the maximum/i);
  });

  it("the DATABASE refuses it too", async () => {
    await expect(
      pool.query(
        `insert into submissions (user_id, kind, slug, title, score, max_score, status)
         values ($1, 'lab', 'LAB-BAD', 'bad', 99, 4, 'graded')`,
        [w.studentA],
      ),
    ).rejects.toThrow();
  });

  it("INV-31 catches a graded submission with no score", async () => {
    // A row marked graded with no score looks finished in every list and
    // contributes nothing to the total -- worse than an ungraded one.
    await pool.query(
      `insert into submissions (user_id, kind, slug, title, status, body_md)
       values ($1, 'lab', 'LAB-INV', 'invariant probe', 'submitted', 'x')`,
      [w.studentB],
    );
    await pool.query(
      "update submissions set status = 'graded' where slug = 'LAB-INV'",
    );

    const { rows } = await pool.query(
      "select offending_count from run_invariants() where id = 'INV-31'",
    );
    expect(Number(rows[0]!.offending_count)).toBeGreaterThan(0);

    await pool.query("delete from submissions where slug = 'LAB-INV'");
  });

  it("records lateness as a FACT rather than applying a penalty", async () => {
    await pool.query(
      `insert into submissions (user_id, kind, slug, title, body_md, status, due_at, submitted_at)
       values ($1, 'lab', 'LAB-LATE', 'late one', 'reasoning here',
               'submitted', now() - interval '2 days', now())`,
      [w.studentB],
    );
    const { rows } = await pool.query(
      "select is_late, score from submissions where slug = 'LAB-LATE'",
    );
    expect(rows[0]!.is_late).toBe(true);
    // Nothing has been deducted. Whether it costs marks is the instructor's
    // decision at grading time, not the database's.
    expect(rows[0]!.score).toBeNull();

    await pool.query("delete from submissions where slug = 'LAB-LATE'");
  });
});
