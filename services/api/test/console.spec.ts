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
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/octa",
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
    expect(stages).toHaveLength(18);
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
    expect(header.split(",")).toHaveLength(2 + 17);
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
    expect(row.match(/,/g)!.length).toBeGreaterThanOrEqual(18);
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
