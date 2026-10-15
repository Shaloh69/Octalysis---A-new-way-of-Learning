import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import type { SupabaseAdmin } from "../src/routes/auth.js";
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

/** Records what it was asked; a password reset needs a Supabase project to exist. */
class FakeAdmin implements SupabaseAdmin {
  async createUser(): Promise<{ id: string }> { throw new Error("not used"); }
  async deleteUser(): Promise<void> {}
  async updateUser(): Promise<void> {}
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
  app = await buildServer(env, null, new FakeAdmin());
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

/* ============================================================
 * Batch 2: audit, Lecture Mode, chat, feedback, assessments, passwords
 * ========================================================== */

describe("audit: a teacher reads their own actions and the actions on the students of the classes they read", () => {
  for (const actor of STAFF) {
    it(`${actor}: the entries about a student are the readable classes' students`, async () => {
      const res = await call(actor, "GET", "/api/v1/console/audit?limit=500");
      expect(res.statusCode).toBe(200);
      const about = new Set(
        res.json().entries.filter((e: { action: string }) => e.action === "test.touch").map((e: { target: { id: string } }) => e.target.id),
      );
      for (const k of ALL) {
        expect(about.has(sw.st[k].user), `${actor} reads the entry about student ${k}`).toBe(READS[actor]!.includes(k));
      }
    });
  }

  it("a teacher reads the entries they made themselves, and another teacher does not", async () => {
    await setup("insert into audit_log (actor_id, action, target_type, target_id) values ($1, 'test.mine', 'stage', '00')", [sw.w.teacher]);
    const own = await call("teacherA", "GET", "/api/v1/console/audit?limit=500");
    expect(own.json().entries.some((e: { action: string }) => e.action === "test.mine"), "POSITIVE CONTROL").toBe(true);
    const other = await call("teacherB", "GET", "/api/v1/console/audit?limit=500");
    expect(other.json().entries.some((e: { action: string }) => e.action === "test.mine"), "another teacher read someone's actions").toBe(false);
    const csv = await call("teacherB", "GET", "/api/v1/console/audit.csv");
    expect(csv.body.includes("test.mine"), "the export leaked it").toBe(false);
    expect((await call("admin", "GET", "/api/v1/console/audit?limit=500")).json().entries.some((e: { action: string }) => e.action === "test.mine")).toBe(true);
  });

  it("the actors a teacher may filter by are the actors of the entries they can read", async () => {
    const actors = (await call("teacherNone", "GET", "/api/v1/console/audit")).json().actors as Array<{ name: string }>;
    expect(actors.map((a) => a.name), "a teacher with no class was shown who else has acted").toEqual([]);
  });
});

describe("Lecture Mode: a question is put to a class the teacher holds, and ended by that teacher", () => {
  beforeAll(async () => {
    await setup("update items set status = 'live' where id = $1", [sw.w.itemId]);
  });
  const start = (actor: string, sectionId: string | null) =>
    call(actor, "POST", "/api/v1/console/live/sessions", { itemId: sw.w.itemId, sectionId, reason: "t2 test" });

  for (const actor of STAFF) {
    for (const k of ALL) {
      const want = status(actor, k) === 200 ? 201 : status(actor, k);
      it(`${actor} -> start a question in class ${k}: ${want}`, async () => {
        const res = await start(actor, sw.st[k].section);
        expect(res.statusCode).toBe(want);
        if (res.statusCode === 201) {
          const end = await call(actor, "POST", `/api/v1/console/live/sessions/${res.json().session.id}/end`, { reason: "t2 test" });
          expect(end.statusCode, "the teacher who started it ends it").toBe(200);
        }
      });
    }
  }

  it("a question is never put to everyone", async () => {
    for (const actor of STAFF) expect((await start(actor, null)).statusCode, actor).toBe(400);
  });

  it("two teachers run a question each, at once; a second in one class waits; only its teacher ends it", async () => {
    const a = await start("teacherA", sw.st.A.section);
    const b = await start("teacherB", sw.st.B.section);
    expect([a.statusCode, b.statusCode], "each teacher runs their own").toEqual([201, 201]);
    expect((await start("teacherA", sw.st.A.section)).statusCode, "a second in the same class").toBe(409);
    const aId = a.json().session.id as string;
    expect((await call("teacherB", "POST", `/api/v1/console/live/sessions/${aId}/end`, { reason: "t2 test" })).statusCode, "another teacher ended it").toBe(404);
    expect((await call("admin", "POST", `/api/v1/console/live/sessions/${aId}/end`, { reason: "t2 test" })).statusCode, "the admin ended another teacher's").toBe(403);
    // Each teacher sees their own question, and not the other's.
    expect((await call("teacherA", "GET", "/api/v1/console/live")).json().session.section).toBe("BSCPE-2A");
    expect((await call("teacherB", "GET", "/api/v1/console/live")).json().session.section).toBe("SCOPE-B");
    expect((await call("teacherNone", "GET", "/api/v1/console/live")).json().session).toBeNull();
    expect((await call("teacherA", "POST", `/api/v1/console/live/sessions/${aId}/end`, { reason: "t2 test" })).statusCode).toBe(200);
    expect((await call("teacherB", "POST", `/api/v1/console/live/sessions/${b.json().session.id}/end`, { reason: "t2 test" })).statusCode).toBe(200);
  });

  it("what can be started: the classes this teacher holds that have not ended", async () => {
    const codes = async (actor: string) =>
      (await call(actor, "GET", "/api/v1/console/live/options")).json().sections.map((s: { code: string }) => s.code);
    // (The roster tests above gave teacher A and the admin each a section of their own.)
    expect(await codes("teacherA")).toEqual(["BSCPE-2A", "T2-NEW-A"]);
    expect(await codes("teacherEnded")).toEqual([]);
    expect(await codes("teacherNone")).toEqual([]);
    expect(await codes("admin")).toEqual(["SCOPE-D", "T2-NEW-ADMIN"]);
  });
});

describe("chat: rooms, posting and moderating follow the class", () => {
  const sectionRoom = async (k: Key) =>
    (await setup("select id::text from chat_rooms where kind = 'section' and section_id = $1", [sw.st[k].section])).rows[0]!.id as string;

  it("the rooms listed are the readable classes' rooms (and their threads once they have a message)", async () => {
    for (const actor of STAFF) {
      const res = await call(actor, "GET", "/api/v1/chat/rooms");
      expect(res.statusCode, actor).toBe(200);
      const ids = new Set(res.json().rooms.map((r: { id: string }) => r.id));
      for (const k of ALL) {
        const shown = READS[actor]!.includes(k);
        expect(ids.has(await sectionRoom(k)), `${actor} section room ${k}`).toBe(shown);
        expect(ids.has(sw.st[k].room), `${actor} thread ${k}`).toBe(shown);
      }
    }
  });

  for (const actor of STAFF) {
    for (const k of ALL) {
      const want = status(actor, k) === 200 ? 201 : status(actor, k);
      it(`${actor} -> post in class ${k}'s room: ${want}`, async () => {
        const res = await call(actor, "POST", `/api/v1/chat/rooms/${await sectionRoom(k)}/messages`, { body: "t2 hello", mentions: [] });
        expect(res.statusCode).toBe(want);
      });
      it(`${actor} -> remove a student's message in class ${k}: ${status(actor, k) === 200 ? 204 : status(actor, k)}`, async () => {
        const msg = (
          await setup("insert into chat_messages (room_id, author_id, body) values ($1, $2, 'to be moderated') returning id::text", [
            await sectionRoom(k),
            // Student A has a paper open, which closes the chat for them: their classmate speaks.
            k === "A" ? sw.w.studentB : sw.st[k].user,
          ])
        ).rows[0]!.id as string;
        const res = await call(actor, "DELETE", `/api/v1/chat/messages/${msg}`, { reason: "t2 test" });
        expect(res.statusCode).toBe(status(actor, k) === 200 ? 204 : status(actor, k));
      });
    }
  }

  it("a private thread is opened only with a student of a class held and not ended", async () => {
    for (const actor of STAFF) {
      for (const k of ALL) {
        const res = await call(actor, "POST", "/api/v1/chat/threads", { userId: sw.st[k].user });
        const want = status(actor, k) === 200 ? 201 : status(actor, k);
        expect(res.statusCode, `${actor} thread ${k}`).toBe(want);
      }
    }
  });
});

describe("feedback: every teacher reads it; a student reporter is named only to the teacher of their class", () => {
  beforeAll(async () => {
    for (const k of ALL) {
      await setup("insert into feedback (user_id, role, channel, category, body) values ($1, 'student', 'flag', 'bug', $2)", [
        sw.st[k].user,
        `t2 report from ${k}`,
      ]);
    }
  });
  for (const actor of STAFF) {
    it(`${actor}: reads all four reports, and the names of the readable classes' students`, async () => {
      const res = await call(actor, "GET", "/api/v1/console/feedback?limit=50");
      expect(res.statusCode).toBe(200);
      const reports = (res.json().groups as Array<{ body: string; reports: Array<{ reporterName: string | null }> }>).filter((g) =>
        g.body.startsWith("t2 report from"),
      );
      expect(reports.length, "every teacher reads the feedback").toBe(4);
      const csv = (await call(actor, "GET", "/api/v1/console/feedback.csv")).body;
      for (const k of ALL) {
        const g = reports.find((x) => x.body === `t2 report from ${k}`)!;
        const named = g.reports[0]!.reporterName === `Student ${k}`;
        expect(named, `${actor} sees student ${k} named`).toBe(READS[actor]!.includes(k));
        expect(csv.includes(`Student ${k}`), `${actor} csv names student ${k}`).toBe(READS[actor]!.includes(k));
      }
    });
  }
});

describe("assessments: the course's papers are read by every teacher and changed by the admin; a section's own is its teacher's", () => {
  let blueprint = "";
  let shared = "";
  let ofB = "";
  beforeAll(async () => {
    blueprint = (await setup("select id::text from blueprints limit 1")).rows[0]!.id as string;
    shared = (await setup("insert into assessments (blueprint_id, title) values ($1, 'T2 shared paper') returning id::text", [blueprint])).rows[0]!.id as string;
    ofB = (
      await setup("insert into assessments (blueprint_id, section_id, title) values ($1, $2, 'T2 class B paper') returning id::text", [blueprint, sw.st.B.section])
    ).rows[0]!.id as string;
    await setup("insert into assessment_secrets (assessment_id) values ($1), ($2) on conflict do nothing", [shared, ofB]);
  });
  const titles = async (actor: string) =>
    (await call(actor, "GET", "/api/v1/console/assessments")).json().assessments.map((a: { title: string }) => a.title);

  it("the list: shared papers to everyone; a section's own to those who read it", async () => {
    for (const actor of STAFF) {
      const t = await titles(actor);
      expect(t, `${actor} reads the shared paper`).toContain("T2 shared paper");
      expect(t.includes("T2 class B paper"), `${actor} reads class B's paper`).toBe(READS[actor]!.includes("B"));
      expect(t.includes("Stage 03 Check"), `${actor} reads class A's check`).toBe(READS[actor]!.includes("A"));
    }
  });

  it("changing the course's paper is the admin's; a teacher is told 403", async () => {
    const patch = (actor: string, id: string) => call(actor, "PATCH", `/api/v1/console/assessments/${id}`, { reason: "t2 test", attemptsAllowed: 6 });
    expect((await patch("teacherA", shared)).statusCode).toBe(403);
    expect((await patch("teacherNone", shared)).statusCode).toBe(403);
    expect((await patch("admin", shared)).statusCode, "POSITIVE CONTROL").toBe(200);
    expect((await call("teacherA", "POST", `/api/v1/console/assessments/${shared}/rotate-salt`, { reason: "t2 test" })).statusCode).toBe(403);
    expect((await call("admin", "POST", `/api/v1/console/assessments/${shared}/rotate-salt`, { reason: "t2 test" })).statusCode).toBe(200);
  });

  it("a section's own paper: its teacher changes it; another teacher does not find it; the admin reads and cannot change it", async () => {
    const patch = (actor: string) => call(actor, "PATCH", `/api/v1/console/assessments/${ofB}`, { reason: "t2 test", attemptsAllowed: 7 });
    expect((await patch("teacherA")).statusCode).toBe(404);
    expect((await patch("admin")).statusCode).toBe(403);
    expect((await patch("teacherEnded")).statusCode).toBe(404);
    expect((await patch("teacherB")).statusCode, "POSITIVE CONTROL").toBe(200);
  });

  it("creating: a paper for everyone is the admin's; a teacher's is for a class they hold", async () => {
    const make = (actor: string, sectionId: string | null) =>
      call(actor, "POST", "/api/v1/console/assessments", { blueprintId: blueprint, title: `T2 made by ${actor}`, sectionId });
    expect((await make("teacherA", null)).statusCode).toBe(403);
    expect((await make("teacherA", sw.st.B.section)).statusCode).toBe(404);
    expect((await make("admin", sw.st.B.section)).statusCode).toBe(403);
    expect((await make("teacherEnded", sw.st.E.section)).statusCode, "an ended class").toBe(403);
    expect((await make("teacherA", sw.st.A.section)).statusCode, "POSITIVE CONTROL").toBe(201);
    expect((await make("admin", null)).statusCode, "POSITIVE CONTROL: the admin makes the course's").toBe(201);
  });
});

describe("recovery: a password is reset by the teacher of the class, or by the admin for anyone", () => {
  for (const actor of STAFF) {
    for (const k of ALL) {
      // The admin's exception (b): recovery for any student, whose teacher may be away.
      const want = actor === "admin" ? 200 : status(actor, k);
      it(`${actor} -> reset student ${k}'s password: ${want}`, async () => {
        const res = await call(actor, "POST", `/api/v1/console/students/${sw.st[k].user}/password`, { reason: "t2 test" });
        expect(res.statusCode).toBe(want);
      });
    }
  }
});

/* ============================================================
 * Batch 3: the fields a page needs to disable what a person may not change
 * ========================================================== */

describe("the pages are told what is read-only, so a control is disabled rather than refused", () => {
  const sidOf = async (k: Key) => (await setup("select student_id from profiles where id = $1", [sw.st[k].user])).rows[0]!.student_id as string;

  it("the roster marks every row of a class the viewer may read and not change", async () => {
    for (const actor of STAFF) {
      const res = await call(actor, "GET", "/api/v1/console/roster");
      const rows = res.json().students as Array<{ userId: string | null; readOnly: boolean }>;
      for (const k of ALL) {
        const row = rows.find((r) => r.userId === sw.st[k].user);
        if (!READS[actor]!.includes(k)) {
          expect(row, `${actor} was shown student ${k}`).toBeUndefined();
          continue;
        }
        expect(row!.readOnly, `${actor} student ${k}`).toBe(!WRITES[actor]!.includes(k));
      }
      const sections = res.json().sections as Array<{ id: string; held: boolean }>;
      for (const k of ALL) {
        const s = sections.find((x) => x.id === sw.st[k].section);
        if (READS[actor]!.includes(k)) expect(s!.held, `${actor} section ${k} held`).toBe(WRITES[actor]!.includes(k));
      }
    }
  });

  it("the lock matrix, the record, the submissions and the chat rooms say so too", async () => {
    await setup("update submissions set status = 'submitted' where status <> 'graded'");
    for (const actor of STAFF) {
      const locks = (await call(actor, "GET", "/api/v1/console/locks")).json().students as Array<{ userId: string; readOnly: boolean }>;
      const subs = (await call(actor, "GET", "/api/v1/console/submissions")).json().submissions as Array<{ studentId: string; canGrade: boolean }>;
      const rooms = (await call(actor, "GET", "/api/v1/chat/rooms")).json().rooms as Array<{ id: string; readOnly: boolean }>;
      for (const k of ALL) {
        if (!READS[actor]!.includes(k)) continue;
        const w = WRITES[actor]!.includes(k);
        expect(locks.find((s) => s.userId === sw.st[k].user)!.readOnly, `${actor} lock matrix ${k}`).toBe(!w);
        expect(rooms.find((r) => r.id === sw.st[k].room)!.readOnly, `${actor} thread ${k}`).toBe(!w);
        const rec = await call(actor, "GET", `/api/v1/console/students/${sw.st[k].user}`);
        expect(rec.json().student.canWrite, `${actor} record ${k}`).toBe(w);
      }
      for (const k of ALL) {
        if (!READS[actor]!.includes(k)) continue;
        const sid = await sidOf(k);
        const one = subs.find((s) => s.studentId === sid);
        expect(one!.canGrade, `${actor} submission ${k}`).toBe(WRITES[actor]!.includes(k));
      }
    }
  });

  it("what a person holds: their classes, ended ones marked, none for a teacher with none", async () => {
    const mine = async (actor: string) => (await call(actor, "GET", "/api/v1/console/classes/mine")).json().classes as Array<{ sectionId: string; ended: boolean }>;
    expect((await mine("teacherA")).some((c) => c.sectionId === sw.st.A.section && !c.ended)).toBe(true);
    expect((await mine("teacherA")).some((c) => c.sectionId === sw.st.B.section), "a class of another teacher").toBe(false);
    expect(await mine("teacherEnded")).toMatchObject([{ sectionId: sw.st.E.section, ended: true }]);
    expect(await mine("teacherNone")).toEqual([]);
    expect((await mine("admin")).some((c) => c.sectionId === sw.st.D.section)).toBe(true);
    expect((await mine("admin")).some((c) => c.sectionId === sw.st.A.section), "the admin does not hold A's class by reading it").toBe(false);
  });
});
