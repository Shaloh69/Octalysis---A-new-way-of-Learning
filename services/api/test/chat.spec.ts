import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import type { ChatStorage, StoredObject } from "../src/chat/storage.js";
import { closePool, setup } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * The class chat's routes (docs/CHAT-PLAN.md; db/addendum-chat.sql has the
 * database's half, denied in chat-rls.spec.ts).
 *
 * Denial first: no token, another section's room, another student's private
 * thread, a paper open, a forged author, a mention outside the room, an
 * attachment that was not signed for this room and author, a student
 * moderating. Storage is a fake that records what it was asked; the real one
 * is Supabase's, exercised against the deployment.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string, studentId: string | null): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role, ...(studentId ? { student_id: studentId } : {}) },
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

class FakeStorage implements ChatStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly removed: string[] = [];
  readonly signedUploads: string[] = [];
  async signUpload(path: string) {
    this.signedUploads.push(path);
    return `https://storage.test/upload/${path}?token=t`;
  }
  async signDownloads(paths: readonly string[]) {
    return new Map(paths.map((p) => [p, `https://storage.test/get/${p}?token=s`]));
  }
  async stat(path: string) {
    return this.objects.get(path) ?? null;
  }
  async remove(paths: readonly string[]) {
    this.removed.push(...paths);
    for (const p of paths) this.objects.delete(p);
  }
}

let app: FastifyInstance;
let bare: FastifyInstance;
let w: World;
let studentC = "";
const storage = new FakeStorage();
let tA = "";
let tB = "";
let tC = "";
let tT = "";
let roomA = "";
let threadB = "";

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const get = (url: string, t: string, on = app) => on.inject({ method: "GET", url, headers: auth(t) });
const post = (url: string, t: string, payload?: object, on = app) =>
  on.inject({ method: "POST", url, headers: auth(t), ...(payload ? { payload } : {}) });
const del = (url: string, t: string, payload?: object) =>
  app.inject({ method: "DELETE", url, headers: auth(t), ...(payload ? { payload } : {}) });

beforeAll(async () => {
  w = await resetWorld();
  const { rows } = await setup(
    `with uc as (
       insert into auth.users (id, email, raw_app_meta_data)
       values (gen_random_uuid(), 'c@octa-test.local', '{"role":"student"}'::jsonb) returning id),
     dir as (
       insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
       select '21-0003', 'Student C', $1::uuid, 'claimed'::claim_status, id, now() from uc returning student_id)
     insert into profiles (id, student_id, full_name, section_id, role)
     select uc.id, '21-0003', 'Student C', $1::uuid, 'student'::user_role from uc, dir
     returning id::text`,
    [w.otherSectionId],
  );
  studentC = rows[0].id as string;
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    JWT_AUDIENCE: "authenticated",
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env, storage);
  bare = await buildServer(env, null);
  await app.ready();
  await bare.ready();
  tA = mintToken(w.studentA, "student", "21-0001");
  tB = mintToken(w.studentB, "student", "21-0002");
  tC = mintToken(studentC, "student", "21-0003");
  tT = mintToken(w.teacher, "teacher", null);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await bare?.close();
  await closePool();
});

describe("GET /chat/rooms — who is in which room", () => {
  it("requires a token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/chat/rooms" });
    expect(res.statusCode).toBe(401);
  });

  it("a student gets their section's room and their private thread, nothing else", async () => {
    const res = await get("/api/v1/chat/rooms", tB);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.me).toMatchObject({ id: w.studentB, name: "Student B", staff: false });
    expect(body.attachments).toBe(true);
    expect(body.rooms.map((r: { title: string }) => r.title)).toEqual(["BSCPE-2A", "Instructor"]);
    roomA = body.rooms[0].id;
    threadB = body.rooms[1].id;
  });

  it("another section's student gets their own section, never 2A", async () => {
    const res = await get("/api/v1/chat/rooms", tC);
    const titles = res.json().rooms.map((r: { title: string }) => r.title);
    expect(titles).toEqual(["BSCPE-2B", "Instructor"]);
    expect(res.json().rooms.map((r: { id: string }) => r.id)).not.toContain(roomA);
  });

  it("a student with a paper open is told the chat is closed, and why (ruling 3)", async () => {
    const res = await get("/api/v1/chat/rooms", tA);
    expect(res.statusCode).toBe(423);
    expect(res.json().error.code).toBe("paper_open");
    // Named, so the student knows what to finish (6 Oct 2026).
    expect(res.json().error.message).toMatch(/^(Stage 03 Check|Power-On Self Test) is open\. The chat opens again when you submit it\.$/);
    const unread = (await get("/api/v1/chat/unread", tA)).json();
    expect(unread).toMatchObject({ mentions: 0, closed: true });
    expect(["Stage 03 Check", "Power-On Self Test"]).toContain(unread.paper.title);
  });

  it("the instructor sees every section's room; a private thread once it has a message", async () => {
    const res = await get("/api/v1/chat/rooms", tT);
    const titles = res.json().rooms.map((r: { title: string }) => r.title);
    expect(titles).toEqual(["BSCPE-2A", "BSCPE-2B"]);
    expect(res.json().me.staff).toBe(true);
  });
});

describe("reading a room", () => {
  it("denies another section's student the room, as not found", async () => {
    const res = await get(`/api/v1/chat/rooms/${roomA}`, tC);
    expect(res.statusCode).toBe(404);
  });
  it("denies another student a private thread, as not found", async () => {
    const res = await get(`/api/v1/chat/rooms/${threadB}`, tC);
    expect(res.statusCode).toBe(404);
  });
  it("denies a student with a paper open", async () => {
    const res = await get(`/api/v1/chat/rooms/${roomA}`, tA);
    expect(res.statusCode).toBe(423);
  });
  it("a bad room id is not found, not a 500", async () => {
    const res = await get(`/api/v1/chat/rooms/not-a-uuid`, tB);
    expect(res.statusCode).toBe(404);
  });
  it("POSITIVE CONTROL: a member reads it, with who can be mentioned", async () => {
    const res = await get(`/api/v1/chat/rooms/${roomA}`, tB);
    expect(res.statusCode).toBe(200);
    const names = res.json().members.map((m: { name: string }) => m.name);
    // The instructor first, then the section; studentA belongs though they cannot open it now.
    expect(names).toEqual(["Instructor", "Student A", "Student B"]);
    expect(names).not.toContain("Student C");
  });
});

describe("sending", () => {
  it("a student cannot post into another section's room", async () => {
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tC, { body: "hello 2A" });
    expect(res.statusCode).toBe(404);
  });
  it("a student cannot post as someone else: the body has no author", async () => {
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { body: "hi", authorId: w.teacher });
    expect(res.statusCode).toBe(400);
  });
  it("a student with a paper open cannot post", async () => {
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tA, { body: "what is q3?" });
    expect(res.statusCode).toBe(423);
  });
  it("an empty message is refused", async () => {
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { body: "   " });
    expect(res.statusCode).toBe(400);
  });
  it("a mention of someone outside the room is refused", async () => {
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { body: "@Student C", mentions: [studentC] });
    expect(res.statusCode).toBe(400);
  });

  it("POSITIVE CONTROL: a member posts, mentions the instructor, and the instructor's count rises", async () => {
    const before = (await get("/api/v1/chat/unread", tT)).json().mentions;
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, {
      body: "@Instructor is a register a kind of memory?",
      mentions: [w.teacher, w.studentB],
    });
    expect(res.statusCode).toBe(201);
    const m = res.json();
    expect(m).toMatchObject({ author: { id: w.studentB, name: "Student B", staff: false }, mine: true, deleted: false });
    // Mentioning yourself is dropped, not refused.
    expect(m.mentions).toEqual([w.teacher]);
    expect((await get("/api/v1/chat/unread", tT)).json().mentions).toBe(before + 1);

    const rooms = (await get("/api/v1/chat/rooms", tT)).json().rooms;
    expect(rooms.find((r: { id: string }) => r.id === roomA)).toMatchObject({ unread: 1, mentions: 1 });

    expect((await post(`/api/v1/chat/rooms/${roomA}/read`, tT)).statusCode).toBe(204);
    expect((await get("/api/v1/chat/unread", tT)).json().mentions).toBe(before);
  });

  it("the private thread reaches the instructor, and appears in their list once it has a message", async () => {
    const res = await post(`/api/v1/chat/rooms/${threadB}/messages`, tB, { body: "I am stuck on stage 03" });
    expect(res.statusCode).toBe(201);
    const rooms = (await get("/api/v1/chat/rooms", tT)).json().rooms;
    expect(rooms.map((r: { title: string }) => r.title)).toContain("Student B");
    const thread = await get(`/api/v1/chat/rooms/${threadB}`, tT);
    expect(thread.json().messages.at(-1).body).toBe("I am stuck on stage 03");
  });
});

describe("attachments", () => {
  it("refuses to sign an upload of the wrong type or over 25 MB", async () => {
    const exe = await post(`/api/v1/chat/rooms/${roomA}/uploads`, tB, { name: "x.exe", mime: "application/x-msdownload", bytes: 10 });
    expect(exe.statusCode).toBe(400);
    const big = await post(`/api/v1/chat/rooms/${roomA}/uploads`, tB, { name: "x.mp4", mime: "video/mp4", bytes: 25 * 1024 * 1024 + 1 });
    expect(big.statusCode).toBe(400);
  });
  it("refuses to sign an upload into a room the student is not in", async () => {
    const res = await post(`/api/v1/chat/rooms/${roomA}/uploads`, tC, { name: "a.png", mime: "image/png", bytes: 10 });
    expect(res.statusCode).toBe(404);
  });
  it("refuses an attachment path that was not signed for this room and author", async () => {
    const foreign = `${roomA}/${w.teacher}/00000000-0000-4000-8000-000000000000.png`;
    storage.objects.set(foreign, { bytes: 10, mime: "image/png" });
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { attachment: { path: foreign, name: "a.png" } });
    expect(res.statusCode).toBe(400);
  });
  it("refuses an attachment that never finished uploading", async () => {
    const up = (await post(`/api/v1/chat/rooms/${roomA}/uploads`, tB, { name: "a.png", mime: "image/png", bytes: 10 })).json();
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { attachment: { path: up.path, name: "a.png" } });
    expect(res.statusCode).toBe(400);
  });

  let withFile = "";
  it("POSITIVE CONTROL: sign, upload, send; size and type come from storage, not the client", async () => {
    const up = await post(`/api/v1/chat/rooms/${roomA}/uploads`, tB, { name: "board.png", mime: "image/png", bytes: 1234 });
    expect(up.statusCode).toBe(201);
    const { path, uploadUrl } = up.json();
    expect(path.startsWith(`${roomA}/${w.studentB}/`)).toBe(true);
    expect(uploadUrl).toMatch(/^https:\/\/storage\.test\/upload\//);
    storage.objects.set(path, { bytes: 4321, mime: "image/png" });
    const res = await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { body: "the board", attachment: { path, name: "board.png" } });
    expect(res.statusCode).toBe(201);
    expect(res.json().attachment).toMatchObject({ name: "board.png", mime: "image/png", bytes: 4321 });
    expect(res.json().attachment.url).toMatch(/^https:\/\/storage\.test\/get\//);
    withFile = res.json().id;
  });

  it("the instructor's storage view lists it, and removing it keeps the message", async () => {
    const list = (await get("/api/v1/chat/attachments", tT)).json();
    expect(list.limitBytes).toBe(1024 * 1024 * 1024);
    expect(list.items.map((i: { messageId: string }) => i.messageId)).toContain(withFile);
    expect(list.usedBytes).toBeGreaterThanOrEqual(4321);
    expect((await del(`/api/v1/chat/messages/${withFile}/attachment`, tT)).statusCode).toBe(400);
    const res = await del(`/api/v1/chat/messages/${withFile}/attachment`, tT, { reason: "storage is nearly full" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ removed: 1, bytes: 4321 });
    expect(storage.removed.some((p) => p.startsWith(`${roomA}/${w.studentB}/`))).toBe(true);
    const msgs = (await get(`/api/v1/chat/rooms/${roomA}`, tB)).json().messages;
    expect(msgs.find((m: { id: string }) => m.id === withFile)).toMatchObject({ body: "the board", attachment: null, attachmentRemoved: true });
  });

  it("a student cannot see the storage view or remove attachments", async () => {
    expect((await get("/api/v1/chat/attachments", tB)).statusCode).toBe(403);
    expect((await post("/api/v1/chat/attachments/prune", tB, { olderThanDays: 1, reason: "tidy up" })).statusCode).toBe(403);
  });

  it("prune removes only attachments older than the days given, in one audited action", async () => {
    const mk = async (name: string) => {
      const up = (await post(`/api/v1/chat/rooms/${roomA}/uploads`, tB, { name, mime: "video/mp4", bytes: 100 })).json();
      storage.objects.set(up.path, { bytes: 100, mime: "video/mp4" });
      return (await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { attachment: { path: up.path, name } })).json().id as string;
    };
    const old = await mk("old.mp4");
    const fresh = await mk("fresh.mp4");
    await setup(`
      alter table chat_messages disable trigger chat_messages_guard;
      update chat_messages set created_at = now() - interval '40 days' where id = '${old}';
      alter table chat_messages enable trigger chat_messages_guard;`);
    expect((await post("/api/v1/chat/attachments/prune", tT, { olderThanDays: 30 })).statusCode).toBe(400);
    const res = await post("/api/v1/chat/attachments/prune", tT, { olderThanDays: 30, reason: "end of the month" });
    expect(res.json()).toEqual({ removed: 1, bytes: 100 });
    const ids = (await get("/api/v1/chat/attachments", tT)).json().items.map((i: { messageId: string }) => i.messageId);
    expect(ids).toContain(fresh);
    expect(ids).not.toContain(old);
    const a = await setup(`select count(*)::int as n from audit_log where action = 'chat.attachments.pruned'`);
    expect(a.rows[0].n).toBe(1);
  });

  it("with no storage configured (the local stack) the chat says so instead of failing a send", async () => {
    const rooms = (await get("/api/v1/chat/rooms", tB, bare)).json();
    expect(rooms.attachments).toBe(false);
    const res = await post(`/api/v1/chat/rooms/${roomA}/uploads`, tB, { name: "a.png", mime: "image/png", bytes: 10 }, bare);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/no file storage/);
  });
});

describe("deleting and moderating", () => {
  let mine = "";
  it("a student cannot delete someone else's message", async () => {
    mine = (await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { body: "I will regret this" })).json().id;
    // studentC is not in the room at all; even the id is "not found".
    expect((await del(`/api/v1/chat/messages/${mine}`, tC)).statusCode).toBe(404);
  });
  it("the author deletes their own: the text is gone for everyone, not audited", async () => {
    expect((await del(`/api/v1/chat/messages/${mine}`, tB)).statusCode).toBe(204);
    const msgs = (await get(`/api/v1/chat/rooms/${roomA}`, tT)).json().messages;
    expect(msgs.find((m: { id: string }) => m.id === mine)).toMatchObject({ deleted: true, body: null, mentions: [] });
    const a = await setup(`select count(*)::int as n from audit_log where target_id = $1`, [mine]);
    expect(a.rows[0].n).toBe(0);
    // Deleting twice is quiet.
    expect((await del(`/api/v1/chat/messages/${mine}`, tB)).statusCode).toBe(204);
  });
  it("the instructor removes a student's message, and /audit keeps what it said", async () => {
    const id = (await post(`/api/v1/chat/rooms/${roomA}/messages`, tB, { body: "something unkind" })).json().id;
    // A reason, or nothing happens.
    expect((await del(`/api/v1/chat/messages/${id}`, tT)).statusCode).toBe(400);
    expect((await del(`/api/v1/chat/messages/${id}`, tT, { reason: "unkind to a classmate" })).statusCode).toBe(204);
    const a = await setup(`select payload from audit_log where action = 'chat.message.removed' and target_id = $1`, [id]);
    expect(a.rows[0].payload).toMatchObject({ body: "something unkind", author: w.studentB, reason: "unkind to a classmate" });
    const seen = (await get(`/api/v1/chat/rooms/${roomA}`, tB)).json().messages.find((m: { id: string }) => m.id === id);
    expect(seen).toMatchObject({ deleted: true, body: null });
  });
});

describe("private threads, opened by the instructor", () => {
  it("a student cannot open a thread with anyone", async () => {
    const res = await post("/api/v1/chat/threads", tB, { userId: studentC });
    expect(res.statusCode).toBe(403);
  });
  it("the instructor opens one with a student, named for them", async () => {
    const res = await post("/api/v1/chat/threads", tT, { userId: studentC });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ kind: "direct", title: "Student C" });
    expect(res.json().subtitle).toMatch(/21-0003/);
    // The same thread the student has, not a second one.
    const own = (await get("/api/v1/chat/rooms", tC)).json().rooms.find((r: { kind: string }) => r.kind === "direct");
    expect(own.id).toBe(res.json().id);
  });
  it("not with a staff account or someone unknown", async () => {
    expect((await post("/api/v1/chat/threads", tT, { userId: w.teacher })).statusCode).toBe(404);
    expect((await post("/api/v1/chat/threads", tT, { userId: "00000000-0000-4000-8000-000000000000" })).statusCode).toBe(404);
  });
});
