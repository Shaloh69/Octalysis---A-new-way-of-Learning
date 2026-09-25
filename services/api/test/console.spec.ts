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
