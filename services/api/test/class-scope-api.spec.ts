import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import { seedScopeWorld, ALL, type Key, type ScopeWorld } from "./helpers/scope-world.js";

/**
 * T2, the API's door (docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5). The API connects as the table
 * owner and bypasses RLS, so every console route asks the class question itself
 * (`services/api/src/scope.ts`); `class-scope-rls.spec.ts` proves the database's half.
 *
 *   READ   a section's students: the actor holds a class on the section (ended or not), or is the admin
 *   WRITE  a section's students: the actor holds a class on it and it has not ended
 *   A record outside the reader's reach is 404 (never 403: a teacher must not learn that another
 *   section's student exists); a record they read but may not write is 403.
 *
 * Hard rule 8: watched red first, 9 Oct 2026, against routes that still said requireStaff().
 */

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
let sw: ScopeWorld;
const tok: Record<string, string> = {};

const READS: Record<string, Key[]> = {
  teacherA: ["A"], teacherB: ["B"], teacherEnded: ["E"], admin: ["A", "B", "E", "D"], teacherNone: [],
};
const WRITES: Record<string, Key[]> = {
  teacherA: ["A"], teacherB: ["B"], teacherEnded: [], admin: ["D"], teacherNone: [],
};
const STAFF = Object.keys(READS);

/** What a staff actor is told about a student of class K: 200 / 403 (read-only) / 404 (not theirs). */
function status(actor: string, k: Key): 200 | 403 | 404 {
  if (WRITES[actor]!.includes(k)) return 200;
  return READS[actor]!.includes(k) ? 403 : 404;
}

function call(actor: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) {
  return app.inject({ method, url, headers: { authorization: `Bearer ${tok[actor]}` }, ...(payload ? { payload } : {}) });
}

beforeAll(async () => {
  sw = await seedScopeWorld();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    JWT_AUDIENCE: "authenticated",
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
  tok.teacherA = mintToken(sw.w.teacher, "teacher");
  tok.teacherB = mintToken(sw.teacherBId, "teacher");
  tok.teacherEnded = mintToken(sw.teacherEId, "teacher");
  tok.teacherNone = mintToken(sw.teacherNoneId, "teacher");
  tok.admin = mintToken(sw.adminId, "admin");
  tok.studentA = mintToken(sw.w.studentA, "student", "21-0001");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("the students a teacher is shown are the students of the classes they hold", () => {
  it("GET /console/roster lists the readable classes' students and their sections, nothing else", async () => {
    for (const actor of STAFF) {
      const res = await call(actor, "GET", "/api/v1/console/roster");
      expect(res.statusCode, actor).toBe(200);
      const users = new Set(res.json().students.map((s: { userId: string | null }) => s.userId));
      const sections = new Set(res.json().sections.map((s: { id: string }) => s.id));
      for (const k of ALL) {
        const shown = READS[actor]!.includes(k);
        expect(users.has(sw.st[k].user), `${actor} ${shown ? "is shown" : "is NOT shown"} student ${k}`).toBe(shown);
        expect(sections.has(sw.st[k].section), `${actor} section ${k}`).toBe(shown);
      }
    }
  });

  it("GET /console/locks lists the readable students, sections and section overrides, nothing else", async () => {
    for (const actor of STAFF) {
      const res = await call(actor, "GET", "/api/v1/console/locks");
      expect(res.statusCode, actor).toBe(200);
      const users = new Set(res.json().students.map((s: { userId: string }) => s.userId));
      const cellUsers = new Set(res.json().cells.map((c: { userId: string }) => c.userId));
      const sections = new Set(res.json().sections.map((s: { id: string }) => s.id));
      const overrides = new Set(res.json().scopeLocks.map((l: { sectionId: string | null }) => l.sectionId));
      for (const k of ALL) {
        const shown = READS[actor]!.includes(k);
        expect(users.has(sw.st[k].user), `${actor} students ${k}`).toBe(shown);
        expect(cellUsers.has(sw.st[k].user), `${actor} cells ${k}`).toBe(shown);
        expect(sections.has(sw.st[k].section), `${actor} sections ${k}`).toBe(shown);
        expect(overrides.has(sw.st[k].section), `${actor} section overrides ${k}`).toBe(shown);
      }
    }
  });

  it("GET /console/gradebook (and its CSV) lists the readable students, nothing else", async () => {
    for (const actor of STAFF) {
      const res = await call(actor, "GET", "/api/v1/console/gradebook");
      expect(res.statusCode, actor).toBe(200);
      const ids = new Set(res.json().students.map((r: { studentId: string }) => r.studentId));
      const csv = (await call(actor, "GET", "/api/v1/console/gradebook.csv")).body;
      for (const k of ALL) {
        const shown = READS[actor]!.includes(k);
        const sid = (await setup("select student_id from profiles where id = $1", [sw.st[k].user])).rows[0]!.student_id as string;
        expect(ids.has(sid), `${actor} gradebook ${k}`).toBe(shown);
        expect(csv.includes(sid), `${actor} gradebook.csv ${k}`).toBe(shown);
      }
    }
  });

  it("GET /console/submissions lists the readable students' submissions, nothing else", async () => {
    for (const actor of STAFF) {
      const res = await call(actor, "GET", "/api/v1/console/submissions");
      expect(res.statusCode, actor).toBe(200);
      const owners = new Set(res.json().submissions.map((s: { userId?: string; studentId: string }) => s.studentId));
      for (const k of ALL) {
        const sid = (await setup("select student_id from profiles where id = $1", [sw.st[k].user])).rows[0]!.student_id as string;
        expect(owners.has(sid), `${actor} submissions ${k}`).toBe(READS[actor]!.includes(k));
      }
    }
  });
});

describe("a record outside the reader's reach is NOT FOUND, never forbidden", () => {
  for (const actor of STAFF) {
    for (const k of ALL) {
      const expected = READS[actor]!.includes(k) ? 200 : 404;
      it(`${actor} -> student ${k}'s record: ${expected}`, async () => {
        const res = await call(actor, "GET", `/api/v1/console/students/${sw.st[k].user}`);
        expect(res.statusCode).toBe(expected);
      });
      it(`${actor} -> student ${k}'s attempt: ${expected}`, async () => {
        const res = await call(actor, "GET", `/api/v1/console/attempts/${sw.st[k].attempt}`);
        expect(res.statusCode).toBe(expected);
      });
    }
  }
  it("a student gets 403 on a record, anon 401", async () => {
    const s = await call("studentA", "GET", `/api/v1/console/students/${sw.st.A.user}`);
    expect(s.statusCode).toBe(403);
    const a = await app.inject({ method: "GET", url: `/api/v1/console/students/${sw.st.A.user}` });
    expect(a.statusCode).toBe(401);
  });
});

describe("locks: written only for a class held and not ended; never globally", () => {
  for (const actor of STAFF) {
    for (const k of ALL) {
      const want = status(actor, k);
      it(`${actor} -> a student lock on ${k}: ${want}`, async () => {
        const res = await call(actor, "POST", "/api/v1/console/locks", {
          scope: "user", userId: sw.st[k].user, stageId: "00", state: "locked", reason: "t2 test",
        });
        expect(res.statusCode).toBe(want);
      });
      it(`${actor} -> a section lock on ${k}: ${want}`, async () => {
        const res = await call(actor, "POST", "/api/v1/console/locks", {
          scope: "section", sectionId: sw.st[k].section, stageId: "00", state: "locked", reason: "t2 test",
        });
        expect(res.statusCode).toBe(want);
      });
    }
  }

  it("a GLOBAL lock is written by no staff token, the admin's included", async () => {
    for (const actor of STAFF) {
      const res = await call(actor, "POST", "/api/v1/console/locks", {
        scope: "global", stageId: "00", state: "locked", reason: "t2 test",
      });
      expect(res.statusCode, `${actor} wrote a global lock`).toBe(403);
    }
    const rows = await setup("select 1 from stage_locks where scope = 'global'");
    expect(rows.rowCount).toBe(0);
  });

  it("only the admin removes a legacy global lock; a teacher is refused", async () => {
    await setup("insert into stage_locks (scope, stage_id, state, reason) values ('global', '00', 'locked', 'legacy')");
    const teacher = await call("teacherA", "POST", "/api/v1/console/locks", { scope: "global", stageId: "00", state: "auto", reason: "t2 test" });
    expect(teacher.statusCode).toBe(403);
    expect((await setup("select 1 from stage_locks where scope = 'global'")).rowCount).toBe(1);
    const admin = await call("admin", "POST", "/api/v1/console/locks", { scope: "global", stageId: "00", state: "auto", reason: "t2 test" });
    expect(admin.statusCode).toBe(200);
    expect((await setup("select 1 from stage_locks where scope = 'global'")).rowCount).toBe(0);
  });

  it("'All my classes' writes a section lock for each class held and not ended, and nobody else's", async () => {
    await setup("delete from stage_locks where stage_id = '03'");
    const res = await call("teacherA", "POST", "/api/v1/console/locks", { scope: "mine", stageId: "03", state: "locked", reason: "t2 test" });
    expect(res.statusCode).toBe(200);
    const rows = await setup("select scope_section_id::text as s from stage_locks where stage_id = '03' and scope = 'section'");
    expect(rows.rows.map((r) => r.s)).toEqual([sw.st.A.section]);
    const none = await call("teacherEnded", "POST", "/api/v1/console/locks", { scope: "mine", stageId: "03", state: "locked", reason: "t2 test" });
    expect(none.statusCode, "a teacher with only an ended class has no class to lock").toBe(403);
  });

  it("a bulk change with ONE student outside the teacher's reach refuses the whole batch", async () => {
    const before = (await setup("select count(*)::int as n from stage_locks where stage_id = '02'")).rows[0]!.n;
    const res = await call("teacherA", "POST", "/api/v1/console/locks/bulk", {
      state: "locked", reason: "t2 test",
      cells: [{ userId: sw.st.A.user, stageId: "02" }, { userId: sw.st.B.user, stageId: "02" }],
    });
    expect(res.statusCode).toBe(404);
    expect((await setup("select count(*)::int as n from stage_locks where stage_id = '02'")).rows[0]!.n).toBe(before);
    const ok = await call("teacherA", "POST", "/api/v1/console/locks/bulk", {
      state: "locked", reason: "t2 test", cells: [{ userId: sw.st.A.user, stageId: "02" }],
    });
    expect(ok.statusCode, "POSITIVE CONTROL").toBe(200);
  });
});

describe("grading: a submission is graded and returned by the teacher of its class", () => {
  for (const k of ALL) {
    for (const actor of STAFF) {
      const want = status(actor, k);
      it(`${actor} -> grade student ${k}'s submission: ${want}`, async () => {
        const sub = (await setup("select id::text from submissions where user_id = $1 order by created_at desc limit 1", [sw.st[k].user])).rows[0]!.id as string;
        const res = await call(actor, "POST", `/api/v1/console/submissions/${sub}/grade`, { score: 1, maxScore: 1 });
        expect(res.statusCode).toBe(want);
      });
    }
  }
});

describe("the roster: import, status and moves stay inside the classes a teacher holds", () => {
  const sidOf = async (k: Key) => (await setup("select student_id from profiles where id = $1", [sw.st[k].user])).rows[0]!.student_id as string;

  for (const actor of STAFF) {
    for (const k of ALL) {
      it(`${actor} -> set student ${k}'s status`, async () => {
        const res = await call(actor, "POST", "/api/v1/console/roster/status", { studentId: await sidOf(k), active: true, reason: "t2 test" });
        // Outside the reach it is the same answer as an unknown ID (400), so an ID cannot be probed.
        const want = WRITES[actor]!.includes(k) ? 200 : READS[actor]!.includes(k) ? (actor === "admin" ? 200 : 403) : 400;
        expect(res.statusCode).toBe(want);
      });
    }
  }

  it("an import into a section someone else holds is refused (and is not told whose)", async () => {
    const code = (await setup("select code from sections where id = $1", [sw.st.B.section])).rows[0]!.code as string;
    const res = await call("teacherA", "POST", "/api/v1/console/roster/import", {
      sectionCode: code, term: "2026-1", rows: [{ studentId: "99-0001", fullName: "New Student" }], apply: true,
    });
    expect(res.statusCode).toBe(409);
    expect((await setup("select 1 from student_directory where student_id = '99-0001'")).rowCount).toBe(0);
  });

  it("a NEW section made by an import is its creator's, with a CPE 412 class, teacher or admin", async () => {
    for (const [actor, userId, code] of [["teacherA", sw.w.teacher, "T2-NEW-A"], ["admin", sw.adminId, "T2-NEW-ADMIN"]] as const) {
      const res = await call(actor, "POST", "/api/v1/console/roster/import", {
        sectionCode: code, term: "2026-1", rows: [{ studentId: `99-${code.length}00`, fullName: "New Student" }], apply: true,
      });
      expect(res.statusCode, actor).toBe(200);
      const cls = await setup(
        "select c.teacher_id::text as t, c.subject_code from classes c join sections s on s.id = c.section_id where s.code = $1", [code],
      );
      expect(cls.rows, `${actor}'s new section has a class`).toEqual([{ t: userId, subject_code: "CPE 412" }]);
    }
  });

  it("an import row for a student already on another teacher's roster is a conflict that names no one", async () => {
    const sidB = await sidOf("B");
    const res = await call("teacherA", "POST", "/api/v1/console/roster/import", {
      sectionCode: "T2-NEW-A", term: "2026-1", rows: [{ studentId: sidB, fullName: "Student B" }], apply: false,
    });
    expect(res.statusCode).toBe(200);
    const row = res.json().plan[0];
    expect(row.action).toBe("conflict");
    expect(row.why).toBe("other-class");
    expect(row.current).toBeNull();
  });

  it("a move needs BOTH classes held and not ended", async () => {
    const sidA = await sidOf("A");
    const toB = await call("teacherA", "POST", "/api/v1/console/roster/section", { studentIds: [sidA], sectionId: sw.st.B.section, reason: "t2 test" });
    expect(toB.statusCode, "into a class they do not hold").toBe(404);
    const sidB = await sidOf("B");
    const fromB = await call("teacherA", "POST", "/api/v1/console/roster/section", { studentIds: [sidB], sectionId: sw.st.A.section, reason: "t2 test" });
    expect(fromB.statusCode, "out of a class they do not hold").toBe(400);
    const adminMove = await call("admin", "POST", "/api/v1/console/roster/section", { studentIds: [await sidOf("D")], sectionId: sw.st.B.section, reason: "t2 test" });
    expect(adminMove.statusCode, "the admin has no write on another teacher's class").toBe(403);
    const newSec = (await setup("select id::text from sections where code = 'T2-NEW-A'")).rows[0]!.id as string;
    const ok = await call("teacherA", "POST", "/api/v1/console/roster/section", { studentIds: [sidA], sectionId: newSec, reason: "t2 test" });
    expect(ok.statusCode, "POSITIVE CONTROL: both classes held").toBe(200);
    await call("teacherA", "POST", "/api/v1/console/roster/section", { studentIds: [sidA], sectionId: sw.st.A.section, reason: "t2 test back" });
  });
});
