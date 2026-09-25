import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { pool, closePool } from "./helpers/rls.js";
import { seedItemBank, type BankWorld } from "./helpers/bank.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string, studentId?: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId, aud: "authenticated",
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

describe("console is staff-only", () => {
  const paths = [
    "/api/v1/console/roster",
    "/api/v1/console/locks",
    "/api/v1/console/audit",
    "/api/v1/console/audit/system",
    "/api/v1/console/gradebook.csv",
  ];

  it("refuses a student token on every console route", async () => {
    for (const url of paths) {
      const res = await app.inject({ method: "GET", url, headers: auth(studentToken) });
      expect(res.statusCode, `${url} let a student in`).toBe(403);
    }
  });

  it("refuses no token at all", async () => {
    for (const url of paths) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(401);
    }
  });

  it("allows a teacher", async () => {
    for (const url of paths) {
      const res = await app.inject({ method: "GET", url, headers: auth(teacherToken) });
      expect(res.statusCode, `${url} refused a teacher`).toBe(200);
    }
  });
});

describe("lock matrix", () => {
  it("returns a cell for every student x stage pair", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/locks", headers: auth(teacherToken) });
    const { stages, students, cells } = res.json();
    expect(stages).toHaveLength(19);   // orientation + 18 chapters
    expect(students.length).toBeGreaterThanOrEqual(2);
    expect(cells).toHaveLength(stages.length * students.length);
  });

  it("REFUSES a lock with no reason — INV-22 and the audit trail depend on it", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: { scope: "user", userId: w.studentA, stageId: "05", state: "unlocked" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/reason/i);
  });

  it("applies an override, and the STUDENT map reflects it", async () => {
    const set = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: {
        scope: "user", userId: w.studentA, stageId: "05",
        state: "unlocked", reason: "makeup exam",
      },
    });
    expect(set.statusCode).toBe(200);

    // Read it back through the STUDENT route -- the teacher's override has to
    // reach the student's resolved map, not just the console's own view.
    const map = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const node = (map.json().nodes as Array<{ id: string; state: string }>).find((n) => n.id === "05")!;
    expect(node.state).not.toBe("locked");
  });

  it("writes audit_log with the actor and the reason", async () => {
    const { rows } = await pool.query(
      "select actor_id, payload from audit_log where action = 'lock.set' order by at desc limit 1",
    );
    expect(rows[0].actor_id).toBe(w.teacher);
    expect(rows[0].payload.reason).toBe("makeup exam");
  });

  it("setting a cell back to auto removes the override", async () => {
    await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: { scope: "user", userId: w.studentA, stageId: "05", state: "auto", reason: "back to policy" },
    });
    const { rows } = await pool.query(
      "select count(*)::int n from stage_locks where scope_user_id = $1 and stage_id = '05'",
      [w.studentA],
    );
    expect(rows[0].n).toBe(0);

    const map = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const node = (map.json().nodes as Array<{ id: string; state: string }>).find((n) => n.id === "05")!;
    expect(node.state).toBe("locked");
  });
});

/*
 * `/locks` rebuild, 25 Sep 2026 — PAGE-SPECS.md §/console/locks plans three
 * things the page never had: who set an override and when, shift-click bulk,
 * and section-level and scheduled overrides on their own tab. Each is a write
 * or a read the API did not offer, so each is proven here, denial first.
 */
describe("lock writes are staff-only — the denial comes first", () => {
  it("refuses a student on the single-cell write", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(studentToken),
      payload: { scope: "user", userId: w.studentA, stageId: "05", state: "unlocked", reason: "let me in" },
    });
    expect(res.statusCode, "a student opened their own stage").toBe(403);
  });

  it("refuses a student on the bulk write, and writes nothing", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks/bulk", headers: auth(studentToken),
      payload: {
        state: "unlocked", reason: "let us all in",
        cells: [{ userId: w.studentA, stageId: "06" }, { userId: w.studentB, stageId: "06" }],
      },
    });
    expect(res.statusCode, "a student bulk-opened stages").toBe(403);
    const { rows } = await pool.query(
      "select count(*)::int n from stage_locks where scope = 'user' and stage_id = '06'",
    );
    expect(rows[0].n).toBe(0);
  });

  it("refuses the bulk write with no token at all", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks/bulk",
      payload: { state: "unlocked", reason: "anyone", cells: [{ userId: w.studentA, stageId: "06" }] },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("a lock for someone who is not there is refused in words, not a 500", () => {
  it("a student who is not on the roster", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: {
        scope: "user", userId: "00000000-0000-4000-8000-00000000dead", stageId: "05",
        state: "unlocked", reason: "nobody",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/not on the roster/i);
  });

  it("a section that does not exist", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: {
        scope: "section", sectionId: "00000000-0000-4000-8000-00000000dead", stageId: "05",
        state: "unlocked", reason: "no such section",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/section/i);
  });
});

describe("the matrix says who set an override, when, and why", () => {
  it("returns the actor's name and the time with the reason", async () => {
    await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: { scope: "user", userId: w.studentA, stageId: "07", state: "locked", reason: "quiz on Friday" },
    });
    const res = await app.inject({ method: "GET", url: "/api/v1/console/locks", headers: auth(teacherToken) });
    const cell = (res.json().cells as Array<Record<string, unknown>>).find(
      (c) => c.userId === w.studentA && c.stageId === "07",
    )!;
    expect(cell.override).toBe("locked");
    expect(cell.reason).toBe("quiz on Friday");
    expect(cell.setBy).toBe("Instructor");
    expect(Number.isNaN(Date.parse(String(cell.setAt)))).toBe(false);

    await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: { scope: "user", userId: w.studentA, stageId: "07", state: "auto", reason: "quiz done" },
    });
  });

  it("an automatic cell names nobody", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/console/locks", headers: auth(teacherToken) });
    const cell = (res.json().cells as Array<Record<string, unknown>>).find(
      (c) => c.userId === w.studentA && c.stageId === "08",
    )!;
    expect(cell.override).toBeNull();
    expect(cell.setBy).toBeNull();
    expect(cell.setAt).toBeNull();
  });
});

describe("bulk overrides — one reason, one transaction, one audit row per cell", () => {
  it("refuses a bulk change with no reason", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks/bulk", headers: auth(teacherToken),
      payload: { state: "unlocked", cells: [{ userId: w.studentA, stageId: "06" }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/reason/i);
  });

  it("writes NOTHING when one cell names someone who is not a student", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks/bulk", headers: auth(teacherToken),
      payload: {
        state: "unlocked", reason: "review session",
        cells: [
          { userId: w.studentA, stageId: "06" },
          { userId: "00000000-0000-4000-8000-00000000dead", stageId: "06" },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).not.toMatch(/select|insert|violat/i);
    const { rows } = await pool.query(
      "select count(*)::int n from stage_locks where scope = 'user' and stage_id = '06'",
    );
    expect(rows[0].n, "half a bulk change was applied").toBe(0);
  });

  it("applies every cell and audits each one with the actor and the reason", async () => {
    const before = await pool.query("select count(*)::int n from audit_log where action = 'lock.set'");
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks/bulk", headers: auth(teacherToken),
      payload: {
        state: "unlocked", reason: "review session before the prelim",
        cells: [
          { userId: w.studentA, stageId: "06" },
          { userId: w.studentB, stageId: "06" },
          { userId: w.studentA, stageId: "09" },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(3);

    const locks = await pool.query(
      `select count(*)::int n from stage_locks
        where scope = 'user' and state = 'unlocked' and reason = 'review session before the prelim'`,
    );
    expect(locks.rows[0].n).toBe(3);

    const after = await pool.query(
      `select actor_id, payload from audit_log where action = 'lock.set'
        order by id desc limit 3`,
    );
    const total = await pool.query("select count(*)::int n from audit_log where action = 'lock.set'");
    expect(total.rows[0].n - before.rows[0].n).toBe(3);
    for (const r of after.rows) {
      expect(r.actor_id).toBe(w.teacher);
      expect(r.payload.reason).toBe("review session before the prelim");
      expect(r.payload.bulk).toBe(3);
    }

    // And the student's own map sees it: the same authority the matrix reads.
    const map = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const node = (map.json().nodes as Array<{ id: string; state: string }>).find((n) => n.id === "06")!;
    expect(node.state).not.toBe("locked");
  });

  it("returns every cell to automatic in one change", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks/bulk", headers: auth(teacherToken),
      payload: {
        state: "auto", reason: "review session finished",
        cells: [
          { userId: w.studentA, stageId: "06" },
          { userId: w.studentB, stageId: "06" },
          { userId: w.studentA, stageId: "09" },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const { rows } = await pool.query(
      "select count(*)::int n from stage_locks where scope = 'user' and stage_id in ('06','09')",
    );
    expect(rows[0].n).toBe(0);
  });
});

describe("section-level and scheduled overrides", () => {
  it("refuses a window that closes before it opens, in words, not as a 500", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: {
        scope: "section", sectionId: w.sectionId, stageId: "10", state: "unlocked",
        reason: "lab week", unlockAt: "2026-10-05T08:00:00.000Z", lockAt: "2026-10-01T08:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/close.*after.*open|opens/i);
  });

  it("lists a section override with its window, who set it and when", async () => {
    const set = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: {
        scope: "section", sectionId: w.sectionId, stageId: "10", state: "unlocked",
        reason: "lab week", unlockAt: "2099-10-01T00:00:00.000Z", lockAt: "2099-10-08T00:00:00.000Z",
      },
    });
    expect(set.statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/api/v1/console/locks", headers: auth(teacherToken) });
    const body = res.json();
    expect(body.sections.map((s: { id: string }) => s.id)).toContain(w.sectionId);
    const row = (body.scopeLocks as Array<Record<string, unknown>>).find(
      (l) => l.scope === "section" && l.stageId === "10",
    )!;
    expect(row.sectionId).toBe(w.sectionId);
    expect(row.sectionCode).toBe("BSCPE-2A");
    expect(row.state).toBe("unlocked");
    expect(Date.parse(String(row.unlockAt))).toBe(Date.parse("2099-10-01T00:00:00.000Z"));
    expect(Date.parse(String(row.lockAt))).toBe(Date.parse("2099-10-08T00:00:00.000Z"));
    expect(row.setBy).toBe("Instructor");
    expect(row.reason).toBe("lab week");

    // A window that has not opened yet keeps it shut for the student --
    // is_stage_unlocked() decides, and this page only reports it.
    const map = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(studentToken) });
    const node = (map.json().nodes as Array<{ id: string; state: string }>).find((n) => n.id === "10")!;
    expect(node.state).toBe("locked");

    await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(teacherToken),
      payload: { scope: "section", sectionId: w.sectionId, stageId: "10", state: "auto", reason: "lab week over" },
    });
    const after = await app.inject({ method: "GET", url: "/api/v1/console/locks", headers: auth(teacherToken) });
    expect(
      (after.json().scopeLocks as Array<{ scope: string; stageId: string }>).some(
        (l) => l.scope === "section" && l.stageId === "10",
      ),
    ).toBe(false);
  });

  it("refuses a student on the section write", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/locks", headers: auth(studentToken),
      payload: { scope: "section", sectionId: w.sectionId, stageId: "10", state: "unlocked", reason: "all of us" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("student drill-down regenerates the exact paper from the seed", () => {
  it("reconstructs what the student saw, byte for byte", async () => {
    // Generate a paper as the student.
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(studentToken),
      payload: { assessmentId: w.stageAssessmentId },
    });
    expect(start.statusCode).toBe(200);
    const attemptId = start.json().attemptId;
    const studentSaw = start.json().items as Array<{ ordinal: number; stem: string; options: string[] }>;

    // Now read it back as the teacher, regenerated from the stored seed.
    const drill = await app.inject({
      method: "GET", url: `/api/v1/console/attempts/${attemptId}`, headers: auth(teacherToken),
    });
    expect(drill.statusCode).toBe(200);
    const teacherSees = drill.json().items as Array<{
      ordinal: number; type: string; stem: string; options: string[];
      correctValue: string; rationale: string;
    }>;

    expect(teacherSees).toHaveLength(studentSaw.length);
    for (const item of teacherSees) {
      const original = studentSaw.find((s) => s.ordinal === item.ordinal)!;
      expect(item.stem).toBe(original.stem);
      expect(item.options).toEqual(original.options);
      // And the teacher additionally sees the key.
      expect(item.correctValue.length).toBeGreaterThan(0);

      if (item.type === "G") {
        // An ordering item's key is the whole correct SEQUENCE, not one option.
        // Every element of it must still be among the options shown.
        const sequence = item.correctValue.split(" | ");
        expect(sequence.length).toBe(item.options.length);
        for (const step of sequence) expect(item.options).toContain(step);
      } else {
        expect(item.options).toContain(item.correctValue);
      }
    }
  });

  it("a student cannot read the drill-down of their own attempt", async () => {
    const start = await app.inject({
      method: "POST", url: "/api/v1/attempts", headers: auth(studentToken),
      payload: { assessmentId: w.stageAssessmentId },
    });
    const res = await app.inject({
      method: "GET", url: `/api/v1/console/attempts/${start.json().attemptId}`,
      headers: auth(studentToken),
    });
    // Would hand them the answer key for an in-progress attempt.
    expect(res.statusCode).toBe(403);
  });
});

describe("gradebook export", () => {
  it("emits CSV with a column per gradeable stage", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/gradebook.csv", headers: auth(teacherToken),
    });
    expect(res.headers["content-type"]).toContain("text/csv");
    const lines = res.body.trim().split("\n");
    const header = lines[0] ?? "";
    const rows = lines.slice(1);
    expect(header).toMatch(/^student_id,full_name,stage_01/);
    // 17 gradeable stages: 00 is orientation and excluded.
    expect(header.split(",")).toHaveLength(2 + 18);  // id, name, then one per gradeable chapter
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("escapes a name containing a comma", async () => {
    await pool.query("update profiles set full_name = $1 where student_id = $2", [
      'Dela Cruz, Juan "JD"',
      "21-0001",
    ]);
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/gradebook.csv", headers: auth(teacherToken),
    });
    expect(res.body).toContain('"Dela Cruz, Juan ""JD"""');
    // Still the right number of columns despite the comma in the value.
    const row = res.body.split("\n").find((l) => l.startsWith("21-0001"))!;
    expect(row.match(/,/g)!.length).toBeGreaterThanOrEqual(19);
  });
});

describe("the system audit page", () => {
  it("runs the invariant suite and reports zero structural failures", async () => {
    const res = await app.inject({
      method: "GET", url: "/api/v1/console/audit/system", headers: auth(teacherToken),
    });
    const body = res.json();
    expect(body.results.length).toBeGreaterThanOrEqual(20);
    expect(body.failing, JSON.stringify(body.results.filter((r: { severity: string; offendingCount: number }) => r.severity === "fail" && r.offendingCount > 0))).toBe(0);
  });
});

/*
 * `/students` rebuild, 25 Sep 2026 — PAGE-SPECS.md §/console/roster plans a
 * dry-run preview of new / existing / CONFLICTING rows, deactivate, and a bulk
 * section move. Each is a write the API did not offer, and the last two change
 * who can sign in and what a student is scoped to. Denial first.
 *
 * Deactivate is a REAL lock-out, instructor ruling 25 Sep 2026: the student app
 * sends anything with an `@` straight to Supabase, so `profiles.deleted_at`
 * alone only closed the sign-in-by-ID path. The API now refuses every request
 * from a deactivated account, and the student app reads nothing except
 * through the API.
 *
 * Its own students, so nothing above is disturbed: C is registered, D is not.
 */
describe("roster writes — /students", () => {
  let studentC: string;
  let tokenC: string;
  let sectionB: string;

  beforeAll(async () => {
    const { rows } = await pool.query(
      `with u as (
         insert into auth.users (id, email, raw_app_meta_data)
         values (gen_random_uuid(), 'c@octa-test.local', '{"role":"student"}'::jsonb) returning id
       ), d as (
         insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
         select '21-0003', 'Dela Cruz, Juan Miguel', $1::uuid, 'claimed'::claim_status, (select id from u), now()
         union all
         select '21-0004', 'Santos, Maria', $1::uuid, 'unclaimed'::claim_status, null, null
       ), p as (
         insert into profiles (id, student_id, full_name, section_id, role)
         select id, '21-0003', 'Dela Cruz, Juan Miguel', $1::uuid, 'student'::user_role from u
       ), s as (
         insert into sections (code, term) values ('BSCPE-2B', '2026-1') returning id
       )
       select (select id from u) c, (select id from s) sb`,
      [w.sectionId],
    );
    studentC = rows[0].c;
    sectionB = rows[0].sb;
    tokenC = mintToken(studentC, "student", "21-0003");
  });

  const post = (url: string, token: string | null, payload: object) =>
    app.inject({ method: "POST", url, payload, ...(token ? { headers: auth(token) } : {}) });

  describe("staff-only — the denial comes first", () => {
    it("refuses a student deactivating anyone, and changes nothing", async () => {
      const res = await post("/api/v1/console/roster/status", studentToken, {
        studentId: "21-0002", active: false, reason: "I do not like them",
      });
      expect(res.statusCode, "a student deactivated a classmate").toBe(403);
      const { rows } = await pool.query("select deleted_at from profiles where student_id = '21-0002'");
      expect(rows[0].deleted_at).toBeNull();
    });

    it("refuses a student moving anyone's section, and changes nothing", async () => {
      const res = await post("/api/v1/console/roster/section", studentToken, {
        studentIds: ["21-0001"], sectionId: sectionB, reason: "moving myself",
      });
      expect(res.statusCode, "a student moved a section").toBe(403);
      const { rows } = await pool.query("select section_id from student_directory where student_id = '21-0001'");
      expect(rows[0].section_id).toBe(w.sectionId);
    });

    it("refuses both with no token at all", async () => {
      const off = await post("/api/v1/console/roster/status", null, { studentId: "21-0002", active: false, reason: "x y z" });
      const move = await post("/api/v1/console/roster/section", null, { studentIds: ["21-0001"], sectionId: sectionB, reason: "x y z" });
      expect(off.statusCode).toBe(401);
      expect(move.statusCode).toBe(401);
    });
  });

  describe("the roster read", () => {
    it("lists the sections a student can be moved into, with each row's section id", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/console/roster", headers: auth(teacherToken) });
      const body = res.json();
      expect(body.sections.map((s: { code: string }) => s.code)).toEqual(["BSCPE-2A", "BSCPE-2B"]);
      const c = body.students.find((s: { studentId: string }) => s.studentId === "21-0003");
      expect(c).toMatchObject({ sectionId: w.sectionId, sectionCode: "BSCPE-2A", status: "claimed", deactivated: false });
    });
  });

  describe("the import preview names every row's outcome before anything is written", () => {
    const rows = [
      { studentId: "21-0009", fullName: "Villanueva, Kim Patrick" },                // new
      { studentId: "21-0004", fullName: "Santos, Maria" },                          // the same ID twice...
      { studentId: "21-0004", fullName: "Santos, Maria Clara" },                    // ...in one file
      { studentId: "21-0003", fullName: "Dela Cruz, Juan" },                        // registered AND different
      { studentId: "21-0001", fullName: "Student A" },                              // registered, identical
      { studentId: "21-0010", fullName: "Sy Tan, Jocelyn", sectionCode: "NOPE-1" }, // no such section
    ];

    it("sorts rows into new, unchanged, will change and conflict, and writes nothing on a dry run", async () => {
      const res = await post("/api/v1/console/roster/import", teacherToken, { sectionCode: "BSCPE-2A", rows });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.dryRun).toBe(true);
      const by = (id: string) => body.plan.filter((p: { studentId: string }) => p.studentId === id);
      expect(by("21-0009")[0]).toMatchObject({ action: "insert", sectionCode: "BSCPE-2A" });
      expect(by("21-0001")[0]).toMatchObject({ action: "unchanged" });
      expect(by("21-0003")[0]).toMatchObject({
        action: "conflict", why: "registered",
        current: { fullName: "Dela Cruz, Juan Miguel", sectionCode: "BSCPE-2A", status: "claimed" },
      });
      expect(by("21-0004").map((p: { action: string; why: string }) => `${p.action}:${p.why}`)).toEqual([
        "conflict:duplicate", "conflict:duplicate",
      ]);
      expect(by("21-0010")[0]).toMatchObject({ action: "conflict", why: "unknown-section" });
      expect(body.summary).toEqual({ insert: 1, update: 0, unchanged: 1, conflict: 4 });

      const { rows: n } = await pool.query("select count(*)::int n from student_directory where student_id = '21-0009'");
      expect(n[0].n, "a dry run wrote a row").toBe(0);
    });

    it("an unregistered row whose name changes is 'will change', with the old value beside it", async () => {
      const res = await post("/api/v1/console/roster/import", teacherToken, {
        sectionCode: "BSCPE-2B", rows: [{ studentId: "21-0004", fullName: "Santos, Maria Clara" }],
      });
      expect(res.json().plan[0]).toMatchObject({
        action: "update", sectionCode: "BSCPE-2B",
        current: { fullName: "Santos, Maria", sectionCode: "BSCPE-2A", status: "unclaimed" },
      });
    });

    it("applies only new and changed rows (a registered row is never overwritten) and audits it", async () => {
      const res = await post("/api/v1/console/roster/import", teacherToken, { sectionCode: "BSCPE-2A", rows, apply: true });
      expect(res.statusCode).toBe(200);
      const { rows: d } = await pool.query(
        "select student_id, full_name from student_directory where student_id in ('21-0003','21-0009','21-0010') order by 1",
      );
      expect(d).toEqual([
        { student_id: "21-0003", full_name: "Dela Cruz, Juan Miguel" },
        { student_id: "21-0009", full_name: "Villanueva, Kim Patrick" },
      ]);
      const { rows: a } = await pool.query(
        "select actor_id, payload from audit_log where action = 'roster.import' order by at desc limit 1",
      );
      expect(a[0].actor_id).toBe(w.teacher);
      expect(a[0].payload.inserted).toEqual(["21-0009"]);
      expect(a[0].payload.summary.conflict).toBe(4);
    });
  });

  describe("deactivate — a real lock-out, and reversible", () => {
    it("refuses without a reason", async () => {
      const res = await post("/api/v1/console/roster/status", teacherToken, { studentId: "21-0003", active: false });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toMatch(/reason/i);
    });

    it("refuses someone who is not on the roster, in words", async () => {
      const res = await post("/api/v1/console/roster/status", teacherToken, {
        studentId: "99-9999", active: false, reason: "nobody",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toMatch(/not on the roster/i);
    });

    it("a registered student: the API refuses every request from them, and nothing they did is removed", async () => {
      expect((await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tokenC) })).statusCode).toBe(200);

      const res = await post("/api/v1/console/roster/status", teacherToken, {
        studentId: "21-0003", active: false, reason: "Dropped the course on 20 September",
      });
      expect(res.statusCode).toBe(200);

      const denied = await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tokenC) });
      expect(denied.statusCode, "a deactivated student still reads the map").toBe(403);
      expect(denied.json().error.message).toMatch(/deactivated/i);

      const { rows } = await pool.query("select deleted_at from profiles where id = $1", [studentC]);
      expect(rows[0].deleted_at).not.toBeNull();
      const { rows: a } = await pool.query(
        "select actor_id, target_id, payload from audit_log where action = 'roster.deactivate' order by at desc limit 1",
      );
      expect(a[0]).toMatchObject({ actor_id: w.teacher, target_id: "21-0003" });
      expect(a[0].payload.reason).toBe("Dropped the course on 20 September");

      const roster = await app.inject({ method: "GET", url: "/api/v1/console/roster", headers: auth(teacherToken) });
      expect(roster.json().students.find((s: { studentId: string }) => s.studentId === "21-0003").deactivated).toBe(true);
    });

    it("reactivating lets them back in, and is audited too", async () => {
      const res = await post("/api/v1/console/roster/status", teacherToken, {
        studentId: "21-0003", active: true, reason: "Re-enrolled after the drop was reversed",
      });
      expect(res.statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/api/v1/stages", headers: auth(tokenC) })).statusCode).toBe(200);
      const { rows } = await pool.query(
        "select count(*)::int n from audit_log where action = 'roster.reactivate' and target_id = '21-0003'",
      );
      expect(rows[0].n).toBe(1);
    });

    it("an unregistered row is disabled, which the claim's status = 'unclaimed' refuses, and comes back", async () => {
      await post("/api/v1/console/roster/status", teacherToken, { studentId: "21-0004", active: false, reason: "Never enrolled" });
      let { rows } = await pool.query("select status from student_directory where student_id = '21-0004'");
      expect(rows[0].status).toBe("disabled");
      const roster = await app.inject({ method: "GET", url: "/api/v1/console/roster", headers: auth(teacherToken) });
      expect(roster.json().students.find((s: { studentId: string }) => s.studentId === "21-0004").deactivated).toBe(true);

      await post("/api/v1/console/roster/status", teacherToken, { studentId: "21-0004", active: true, reason: "Enrolled late" });
      ({ rows } = await pool.query("select status from student_directory where student_id = '21-0004'"));
      expect(rows[0].status).toBe("unclaimed");
    });
  });

  describe("bulk section move", () => {
    it("refuses a section that does not exist, and changes nothing", async () => {
      const res = await post("/api/v1/console/roster/section", teacherToken, {
        studentIds: ["21-0003"], sectionId: "00000000-0000-4000-8000-00000000dead", reason: "nowhere",
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.message).toMatch(/section/i);
    });

    it("refuses the whole move if any student is not on the roster", async () => {
      const res = await post("/api/v1/console/roster/section", teacherToken, {
        studentIds: ["21-0003", "99-9999"], sectionId: sectionB, reason: "half of it",
      });
      expect(res.statusCode).toBe(400);
      const { rows } = await pool.query("select section_id from student_directory where student_id = '21-0003'");
      expect(rows[0].section_id, "a refused move moved someone").toBe(w.sectionId);
    });

    it("moves the roster row AND the profile, and writes one audit row per student", async () => {
      const res = await post("/api/v1/console/roster/section", teacherToken, {
        studentIds: ["21-0003", "21-0004"], sectionId: sectionB, reason: "Section split for the lab schedule",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ moved: 2, sectionCode: "BSCPE-2B" });
      const { rows: d } = await pool.query(
        "select student_id from student_directory where section_id = $1 order by 1", [sectionB],
      );
      expect(d.map((r) => r.student_id)).toEqual(["21-0003", "21-0004"]);
      const { rows: p } = await pool.query("select section_id from profiles where id = $1", [studentC]);
      expect(p[0].section_id, "the profile, which locks and assessments read, did not move").toBe(sectionB);
      const { rows: a } = await pool.query(
        "select target_id, payload from audit_log where action = 'roster.section' order by target_id",
      );
      expect(a.map((r) => r.target_id)).toEqual(["21-0003", "21-0004"]);
      expect(a[0].payload).toMatchObject({ reason: "Section split for the lab schedule", from: "BSCPE-2A", to: "BSCPE-2B" });
    });
  });
});
