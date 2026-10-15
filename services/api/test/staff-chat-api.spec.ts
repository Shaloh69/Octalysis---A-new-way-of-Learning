import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool } from "./helpers/rls.js";
import { seedScopeWorld, type ScopeWorld } from "./helpers/scope-world.js";

/**
 * T2: teachers talk to one another and see who is active (docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5.7;
 * db/addendum-staff-chat.sql). The database's half is `staff-chat-rls.spec.ts`.
 *
 *   the staff room        every teacher and the admin
 *   a staff thread        its two members: not the admin, not another teacher
 *   active now            staff about staff only. A student is told about no one, and no one about a student.
 *
 * Hard rule 8: watched red first, 9 Oct 2026, against routes that knew two room kinds.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";
function mintToken(userId: string, role: string, studentId?: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({ sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) } }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

let app: FastifyInstance;
let sw: ScopeWorld;
const tok: Record<string, string> = {};
const call = (who: string, method: "GET" | "POST" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, headers: { authorization: `Bearer ${tok[who]}` }, ...(payload ? { payload } : {}) });

const STAFF = ["teacherA", "teacherB", "teacherEnded", "teacherNone", "admin"] as const;

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
  tok.studentB = mintToken(sw.w.studentB, "student", "21-0002");
  // Teacher A is seen; the others have not opened the chat yet.
  await setup("update profiles set last_seen_at = null where role in ('teacher', 'admin')");
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("the staff room", () => {
  it("is every teacher's and the admin's, listed first, and a student has no such room", async () => {
    for (const who of STAFF) {
      const res = await call(who, "GET", "/api/v1/chat/rooms");
      expect(res.statusCode, who).toBe(200);
      const rooms = res.json().rooms as Array<{ kind: string; title: string }>;
      expect(rooms[0]?.kind, `${who}: the staff room leads`).toBe("staff");
      expect(rooms[0]?.title).toBe("Staff room");
      expect(rooms.filter((r) => r.kind === "staff"), `${who}: exactly one`).toHaveLength(1);
    }
    const student = await call("studentB", "GET", "/api/v1/chat/rooms");
    expect((student.json().rooms as Array<{ kind: string }>).some((r) => r.kind === "staff" || r.kind === "staff_direct")).toBe(false);
  });

  it("takes a teacher's message, and a student cannot read or post in it", async () => {
    const staffRoom = (await call("teacherA", "GET", "/api/v1/chat/rooms")).json().rooms[0].id as string;
    const sent = await call("teacherNone", "POST", `/api/v1/chat/rooms/${staffRoom}/messages`, { body: "Anyone covering the 8am?", mentions: [] });
    expect(sent.statusCode, "a teacher with no class posts in the staff room").toBe(201);
    expect((await call("teacherB", "GET", `/api/v1/chat/rooms/${staffRoom}`)).json().messages.some((m: { body: string }) => m.body === "Anyone covering the 8am?")).toBe(true);
    expect((await call("studentB", "GET", `/api/v1/chat/rooms/${staffRoom}`)).statusCode, "a student read the staff room").toBe(404);
    expect((await call("studentB", "POST", `/api/v1/chat/rooms/${staffRoom}/messages`, { body: "hi", mentions: [] })).statusCode, "a student posted in it").toBe(404);
  });

  it("only the admin removes another teacher's message from it", async () => {
    const staffRoom = (await call("teacherA", "GET", "/api/v1/chat/rooms")).json().rooms[0].id as string;
    const mk = async () =>
      (await setup("insert into chat_messages (room_id, author_id, body) values ($1, $2, 'to go') returning id::text", [staffRoom, sw.w.teacher])).rows[0]!.id as string;
    expect((await call("teacherB", "DELETE", `/api/v1/chat/messages/${await mk()}`, { reason: "t2 test" })).statusCode, "a teacher moderated a colleague").toBe(403);
    expect((await call("admin", "DELETE", `/api/v1/chat/messages/${await mk()}`, { reason: "t2 test" })).statusCode, "POSITIVE CONTROL: the admin").toBe(204);
    expect((await call("teacherA", "DELETE", `/api/v1/chat/messages/${await mk()}`, {})).statusCode, "an author removes their own").toBe(204);
  });
});

describe("a private thread between two teachers", () => {
  let room = "";
  it("is opened with a colleague, and only a colleague", async () => {
    const res = await call("teacherA", "POST", "/api/v1/chat/staff-threads", { userId: sw.teacherBId });
    expect(res.statusCode).toBe(201);
    room = res.json().id as string;
    expect(res.json()).toMatchObject({ kind: "staff_direct", title: "Teacher B" });
    expect(res.json().peer, "the rail needs their face").toMatchObject({ id: sw.teacherBId, staff: true });
    // The same pair from the other side is the same room.
    const again = await call("teacherB", "POST", "/api/v1/chat/staff-threads", { userId: sw.w.teacher });
    expect(again.json().id, "(a, b) and (b, a) are one room").toBe(room);
    expect((await call("teacherA", "POST", "/api/v1/chat/staff-threads", { userId: sw.w.studentB })).statusCode, "with a student").toBe(404);
    expect((await call("teacherA", "POST", "/api/v1/chat/staff-threads", { userId: sw.w.teacher })).statusCode, "with oneself").toBe(400);
    expect((await call("studentB", "POST", "/api/v1/chat/staff-threads", { userId: sw.w.teacher })).statusCode, "a student").toBe(403);
  });

  it("carries its two members' words and no one else's", async () => {
    expect((await call("teacherA", "POST", `/api/v1/chat/rooms/${room}/messages`, { body: "Swap sections Friday?", mentions: [] })).statusCode).toBe(201);
    expect((await call("teacherB", "GET", `/api/v1/chat/rooms/${room}`)).json().messages).toHaveLength(1);
    for (const who of ["admin", "teacherNone", "teacherEnded", "studentB"]) {
      expect((await call(who, "GET", `/api/v1/chat/rooms/${room}`)).statusCode, `${who} read two teachers' thread`).toBe(404);
      expect((await call(who, "POST", `/api/v1/chat/rooms/${room}/messages`, { body: "hello", mentions: [] })).statusCode, `${who} posted in it`).toBe(404);
    }
    const adminRooms = (await call("admin", "GET", "/api/v1/chat/rooms")).json().rooms as Array<{ id: string }>;
    expect(adminRooms.some((r) => r.id === room), "the admin's list shows it").toBe(false);
  });

  it("is listed for its members once it has a message, with the colleague as its title", async () => {
    const rooms = (await call("teacherB", "GET", "/api/v1/chat/rooms")).json().rooms as Array<{ id: string; kind: string; title: string }>;
    expect(rooms.find((r) => r.id === room)).toMatchObject({ kind: "staff_direct", title: "Instructor" });
  });

  it("nobody removes a colleague's words from it", async () => {
    const msg = (await setup("insert into chat_messages (room_id, author_id, body) values ($1, $2, 'mine') returning id::text", [room, sw.w.teacher])).rows[0]!.id as string;
    expect((await call("teacherB", "DELETE", `/api/v1/chat/messages/${msg}`, { reason: "t2 test" })).statusCode).toBe(403);
    expect((await call("teacherA", "DELETE", `/api/v1/chat/messages/${msg}`, {})).statusCode, "the author may").toBe(204);
  });
});

describe("who is active now: staff about staff, never a student", () => {
  it("a teacher who opened the chat is active to a colleague; one who has not is not", async () => {
    await setup("update profiles set last_seen_at = null where role in ('teacher', 'admin')");
    await call("teacherA", "GET", "/api/v1/chat/rooms");
    const list = (await call("teacherB", "GET", "/api/v1/chat/staff")).json().staff as Array<{ id: string; active: boolean; seenAt: string | null }>;
    const a = list.find((p) => p.id === sw.w.teacher)!;
    expect(a.active, "teacher A has the chat open").toBe(true);
    expect(a.seenAt).not.toBeNull();
    expect(list.find((p) => p.id === sw.teacherNoneId)!.active, "teacher none never opened it").toBe(false);
    expect(list.some((p) => p.id === sw.teacherBId), "not yourself").toBe(false);
  });

  it("two minutes of silence is not active", async () => {
    await setup("update profiles set last_seen_at = now() - interval '3 minutes' where id = $1", [sw.w.teacher]);
    const list = (await call("teacherB", "GET", "/api/v1/chat/staff")).json().staff as Array<{ id: string; active: boolean }>;
    expect(list.find((p) => p.id === sw.w.teacher)!.active).toBe(false);
  });

  it("a student is told about no one: no active, no seenAt, anywhere in what they read", async () => {
    await setup("update profiles set last_seen_at = now() where role in ('teacher', 'admin')");
    const rooms = await call("studentB", "GET", "/api/v1/chat/rooms");
    const roomId = rooms.json().rooms[0].id as string;
    const thread = await call("studentB", "GET", `/api/v1/chat/rooms/${roomId}`);
    for (const [name, res] of [["rooms", rooms], ["thread", thread]] as const) {
      expect(res.body, `${name}: a student was told when staff were seen`).not.toMatch(/"active"|"seenAt"/);
    }
    expect((await call("studentB", "GET", "/api/v1/chat/staff")).statusCode, "the staff list").toBe(403);
  });

  it("a student's last seen is never recorded, and a teacher is never told one", async () => {
    await call("studentB", "GET", "/api/v1/chat/rooms");
    await call("studentB", "GET", "/api/v1/chat/unread");
    const { rows } = await setup("select last_seen_at from profiles where id = $1", [sw.w.studentB]);
    expect(rows[0]!.last_seen_at, "the API wrote when a student was last seen").toBeNull();
    const thread = (await call("teacherA", "GET", `/api/v1/chat/rooms/${(await setup("select id::text from chat_rooms where kind = 'section' and section_id = $1", [sw.st.A.section])).rows[0]!.id}`)).json();
    const student = (thread.members as Array<{ id: string; staff: boolean; active?: boolean }>).find((m) => m.id === sw.w.studentB)!;
    expect(student.active, "a teacher was told whether a student is active").toBeUndefined();
  });
});
