import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { avatarsFor, generatedAvatar, looksLikeWebp } from "../src/avatars.js";
import { getPool } from "../src/db.js";
import type { BucketStorage, StoredObject } from "../src/chat/storage.js";
import { closePool, setup } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Profile pages and pictures: the routes (docs/PROFILES-PLAN.md;
 * db/addendum-profiles.sql has the database's half, denied in
 * profiles-rls.spec.ts).
 *
 * Denial first: no token, a path in another person's folder, a path that was
 * never uploaded, a file that is too big, is not WebP by its type or by its
 * bytes, a student moderating, a teacher removing a teacher's picture, a
 * removal with no reason. Storage is a fake that records what it was asked and
 * holds the first bytes of each file; the real one is Supabase's, exercised
 * against the deployment.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";
const MAX = 300 * 1024;

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

const WEBP = Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "binary");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

class FakeStorage implements BucketStorage {
  readonly objects = new Map<string, StoredObject & { head: Uint8Array }>();
  readonly removed: string[] = [];
  readonly signedUploads: string[] = [];
  /** Pretend the browser PUT a file to a path the API signed. */
  put(path: string, o: Partial<StoredObject> & { head?: Uint8Array } = {}) {
    this.objects.set(path, { bytes: o.bytes ?? 20_000, mime: o.mime ?? "image/webp", head: o.head ?? WEBP });
  }
  async signUpload(path: string) {
    this.signedUploads.push(path);
    return `https://storage.test/upload/${path}?token=t`;
  }
  async signDownloads(paths: readonly string[]) {
    return new Map(paths.map((p) => [p, `https://storage.test/get/${p}?token=s`]));
  }
  async stat(path: string) {
    const o = this.objects.get(path);
    return o ? { bytes: o.bytes, mime: o.mime } : null;
  }
  async readHead(path: string, n: number) {
    return this.objects.get(path)?.head.slice(0, n) ?? null;
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
let adminId = "";
let teacherB = "";
const storage = new FakeStorage();
let tA = "";
let tB = "";
let tC = "";
let tT = "";
let tTB = "";
let tAdmin = "";

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const get = (url: string, t: string) => app.inject({ method: "GET", url, headers: auth(t) });
const post = (url: string, t: string, payload?: object, on = app) =>
  on.inject({ method: "POST", url, headers: auth(t), ...(payload ? { payload } : {}) });
const put = (url: string, t: string, payload?: object) =>
  app.inject({ method: "PUT", url, headers: auth(t), ...(payload ? { payload } : {}) });
const del = (url: string, t: string, payload?: object) =>
  app.inject({ method: "DELETE", url, headers: auth(t), ...(payload ? { payload } : {}) });

const uuid = (n: number) => `0b9f2f0e-5d7a-4c1e-9c3e-${String(n).padStart(12, "0")}`;
const pathOf = (userId: string, n = 1) => `${userId}/${uuid(n)}.webp`;

async function addUser(email: string, role: string, name: string, studentNo: string | null, section: string | null) {
  const { rows } = await setup(
    `with u as (
       insert into auth.users (id, email, raw_app_meta_data)
       values (gen_random_uuid(), $1, jsonb_build_object('role', $2::text)) returning id),
     dir as (
       insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
       select $4, $3, $5::uuid, 'claimed'::claim_status, id, now() from u where $4::text is not null
       returning student_id)
     insert into profiles (id, student_id, full_name, section_id, role)
     select u.id, (select student_id from dir), $3, $5::uuid, $2::user_role from u
     returning id::text`,
    [email, role, name, studentNo, section],
  );
  return rows[0].id as string;
}

beforeAll(async () => {
  w = await resetWorld();
  studentC = await addUser("c@octa-test.local", "student", "Student C", "21-0003", w.otherSectionId);
  adminId = await addUser("admin@octa-test.local", "admin", "The Admin", null, null);
  teacherB = await addUser("teacherb@octa-test.local", "teacher", "Teacher B", null, null);
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    JWT_AUDIENCE: "authenticated",
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);
  app = await buildServer(env, null, null, storage);
  bare = await buildServer(env, null, null, null);
  await app.ready();
  await bare.ready();
  tA = mintToken(w.studentA, "student", "21-0001");
  tB = mintToken(w.studentB, "student", "21-0002");
  tC = mintToken(studentC, "student", "21-0003");
  tT = mintToken(w.teacher, "teacher", null);
  tTB = mintToken(teacherB, "teacher", null);
  tAdmin = mintToken(adminId, "admin", null);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await bare?.close();
  await closePool();
});

const picture = async (userId: string) =>
  (await setup(`select avatar_path, avatar_updated_at, avatar_removed_at from profiles where id = $1`, [userId])).rows[0] as {
    avatar_path: string | null;
    avatar_updated_at: Date | null;
    avatar_removed_at: Date | null;
  };

/** Upload and record a picture for `userId` through the real routes. */
async function setPicture(userId: string, token: string, n: number) {
  const p = pathOf(userId, n);
  storage.put(p);
  return put("/api/v1/profile/avatar", token, { path: p });
}

describe("GET /profile: the page's data", () => {
  it("requires a token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/profile" });
    expect(res.statusCode).toBe(401);
  });

  it("a student gets their own number, section and classes, and the generated avatar", async () => {
    const res = await get("/api/v1/profile", tB);
    expect(res.statusCode).toBe(200);
    const p = res.json();
    expect(p).toMatchObject({ id: w.studentB, name: "Student B", role: "student", studentId: "21-0002", section: "BSCPE-2A", pictures: true, hasPicture: false, removedAt: null });
    expect(p.employeeId).toBeNull();
    expect(p.avatar.url).toBeNull();
    expect(p.avatar.hue).toBe(generatedAvatar("21-0002").hue);
    expect(p.classes.map((c: { subject: string; section: string }) => `${c.subject}/${c.section}`)).toContain("CPE 412/BSCPE-2A");
  });

  it("a teacher gets the classes they hold, and no student number", async () => {
    const res = await get("/api/v1/profile", tT);
    const p = res.json();
    expect(p).toMatchObject({ role: "teacher", studentId: null, section: null });
    expect(p.classes.length).toBeGreaterThan(0);
    for (const c of p.classes) expect(c.teacher).toBe(p.name);
  });

  it("says pictures are off where no storage is configured, and does not fail", async () => {
    const res = await bare.inject({ method: "GET", url: "/api/v1/profile", headers: auth(tB) });
    expect(res.statusCode).toBe(200);
    expect(res.json().pictures).toBe(false);
  });
});

describe("POST /profile/avatar/upload: one signed upload, to a path the API chooses", () => {
  it("requires a token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/profile/avatar/upload", payload: { bytes: 1000 } });
    expect(res.statusCode).toBe(401);
  });
  it("refuses a file over 300 KB, an empty one, and anything else in the body", async () => {
    for (const payload of [{ bytes: MAX + 1 }, { bytes: 0 }, {}, { bytes: 1000, path: "x/y.webp" }, { bytes: 1000, userId: w.studentA }]) {
      const res = await post("/api/v1/profile/avatar/upload", tB, payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    expect(storage.signedUploads).toEqual([]);
  });
  it("says so where there is no storage", async () => {
    const res = await post("/api/v1/profile/avatar/upload", tB, { bytes: 1000 }, bare);
    expect(res.statusCode).toBe(409);
  });
  it("signs a path inside the caller's own folder: a random .webp, never one they chose", async () => {
    const res = await post("/api/v1/profile/avatar/upload", tB, { bytes: 20_000 });
    expect(res.statusCode).toBe(201);
    const { path, uploadUrl } = res.json();
    expect(path).toMatch(new RegExp(`^${w.studentB}/[0-9a-f-]{36}\\.webp$`));
    expect(uploadUrl).toContain(path);
    expect(storage.signedUploads).toEqual([path]);
  });
});

describe("PUT /profile/avatar: what may be recorded", () => {
  it("denies a path in another person's folder, and records nothing", async () => {
    const theirs = pathOf(w.studentA);
    storage.put(theirs);
    const res = await put("/api/v1/profile/avatar", tB, { path: theirs });
    expect(res.statusCode).toBe(400);
    expect((await picture(w.studentB)).avatar_path).toBeNull();
    expect((await picture(w.studentA)).avatar_path).toBeNull();
  });
  it("denies a path that climbs out of the folder, or is not a .webp", async () => {
    for (const path of [`${w.studentB}/../${w.studentA}/${uuid(1)}.webp`, `${w.studentB}/${uuid(1)}.png`, `${w.studentB}/x.webp`, pathOf(w.studentB) + "/"]) {
      const res = await put("/api/v1/profile/avatar", tB, { path });
      expect(res.statusCode, path).toBe(400);
    }
    expect((await picture(w.studentB)).avatar_path).toBeNull();
  });
  it("denies a path nothing was uploaded to", async () => {
    const res = await put("/api/v1/profile/avatar", tB, { path: pathOf(w.studentB, 9) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/did not finish uploading/);
  });
  it("denies a file over 300 KB, even if the bucket let it through, and removes it", async () => {
    const p = pathOf(w.studentB, 2);
    storage.put(p, { bytes: MAX + 1 });
    const res = await put("/api/v1/profile/avatar", tB, { path: p });
    expect(res.statusCode).toBe(400);
    expect(storage.removed).toContain(p);
    expect((await picture(w.studentB)).avatar_path).toBeNull();
  });
  it("denies a file whose type is not WebP, and removes it", async () => {
    const p = pathOf(w.studentB, 3);
    storage.put(p, { mime: "image/png" });
    const res = await put("/api/v1/profile/avatar", tB, { path: p });
    expect(res.statusCode).toBe(400);
    expect(storage.removed).toContain(p);
  });
  it("denies a file that SAYS it is WebP and is not (a PNG renamed), by its bytes", async () => {
    const p = pathOf(w.studentB, 4);
    storage.put(p, { mime: "image/webp", head: PNG });
    const res = await put("/api/v1/profile/avatar", tB, { path: p });
    expect(res.statusCode).toBe(400);
    expect(storage.removed).toContain(p);
    expect((await picture(w.studentB)).avatar_path).toBeNull();
  });
  it("POSITIVE CONTROL: a real WebP in their own folder is recorded, and shows at once", async () => {
    const res = await setPicture(w.studentB, tB, 5);
    expect(res.statusCode).toBe(200);
    const p = res.json();
    expect(p.hasPicture).toBe(true);
    expect(p.removedAt).toBeNull();
    expect(p.avatar.url).toContain(pathOf(w.studentB, 5));
    expect((await picture(w.studentB)).avatar_path).toBe(pathOf(w.studentB, 5));
  });
  it("a replacement removes the old file, after recording the new one", async () => {
    const before = storage.removed.length;
    const res = await setPicture(w.studentB, tB, 6);
    expect(res.statusCode).toBe(200);
    expect((await picture(w.studentB)).avatar_path).toBe(pathOf(w.studentB, 6));
    expect(storage.removed.slice(before)).toContain(pathOf(w.studentB, 5));
  });
  it("requires a token, and says so where there is no storage", async () => {
    expect((await app.inject({ method: "PUT", url: "/api/v1/profile/avatar", payload: { path: pathOf(w.studentB) } })).statusCode).toBe(401);
    const res = await bare.inject({ method: "PUT", url: "/api/v1/profile/avatar", headers: auth(tB), payload: { path: pathOf(w.studentB) } });
    expect(res.statusCode).toBe(409);
  });
});

describe("who sees a picture: avatarsFor, the one helper every page uses", () => {
  const db = () => getPool(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa");

  it("a classmate sees studentB's picture; the owner does", async () => {
    const m = await avatarsFor(db(), storage, w.studentA, [w.studentB]);
    expect(m.get(w.studentB)!.url).toContain(pathOf(w.studentB, 6));
    const own = await avatarsFor(db(), storage, w.studentB, [w.studentB]);
    expect(own.get(w.studentB)!.url).toContain(pathOf(w.studentB, 6));
  });
  it("DENIED: a student of another section gets the generated avatar, indistinguishable from no picture", async () => {
    const m = await avatarsFor(db(), storage, studentC, [w.studentB, w.studentA]);
    expect(m.get(w.studentB)!.url).toBeNull();
    expect(m.get(w.studentB)).toMatchObject(generatedAvatar("21-0002"));
    // and the response never carries a path
    expect(JSON.stringify([...m.values()])).not.toContain(w.studentB + "/");
  });
  it("a teacher and the admin see it", async () => {
    for (const viewer of [w.teacher, adminId]) {
      const m = await avatarsFor(db(), storage, viewer, [w.studentB]);
      expect(m.get(w.studentB)!.url, viewer).toContain(pathOf(w.studentB, 6));
    }
  });
  it("a student sees a teacher's picture", async () => {
    const p = pathOf(teacherB);
    storage.put(p);
    expect((await put("/api/v1/profile/avatar", tTB, { path: p })).statusCode).toBe(200);
    const m = await avatarsFor(db(), storage, studentC, [teacherB]);
    expect(m.get(teacherB)!.url).toContain(p);
  });
  it("a storage failure degrades to the generated avatar, never an error", async () => {
    const broken = Object.assign(Object.create(storage), {
      signDownloads: async () => {
        throw new Error("storage down");
      },
    }) as BucketStorage;
    const seen: unknown[] = [];
    const m = await avatarsFor(db(), broken, w.studentA, [w.studentB], (e) => seen.push(e));
    expect(m.get(w.studentB)!.url).toBeNull();
    expect(seen.length).toBe(1);
  });
  it("the generated avatar is stable per student ID and varies between students", () => {
    expect(generatedAvatar("21-0001")).toEqual(generatedAvatar("21-0001"));
    const hues = new Set(["21-0001", "21-0002", "21-0003", "21-0004", "21-0005", "21-0006"].map((k) => generatedAvatar(k).hue));
    expect(hues.size).toBeGreaterThan(3);
  });
  it("looksLikeWebp reads RIFF....WEBP and nothing else", () => {
    expect(looksLikeWebp(WEBP)).toBe(true);
    expect(looksLikeWebp(PNG)).toBe(false);
    expect(looksLikeWebp(Buffer.from("RIFF\0\0\0\0WAVEfmt "))).toBe(false);
    expect(looksLikeWebp(null)).toBe(false);
    expect(looksLikeWebp(WEBP.subarray(0, 8))).toBe(false);
  });
});

describe("the chat shows the picture beside the name (to those it may)", () => {
  it("a teacher opening studentB's private thread sees the picture on their messages and in the members", async () => {
    const rooms = await get("/api/v1/chat/rooms", tB); // creates B's rooms
    expect(rooms.statusCode).toBe(200);
    const thread = rooms.json().rooms.find((r: { title: string }) => r.title === "Instructor").id as string;
    await setup(`insert into chat_messages (room_id, author_id, body) values ($1, $2, 'hello')`, [thread, w.studentB]);
    const res = await get(`/api/v1/chat/rooms/${thread}`, tT);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messages[0].author.avatar.url).toContain(pathOf(w.studentB, 6));
    expect(body.members.find((m: { id: string }) => m.id === w.studentB).avatar.url).toContain(pathOf(w.studentB, 6));
    // the instructor's own entry carries a generated avatar
    expect(body.members.find((m: { id: string }) => m.id === w.teacher).avatar).toMatchObject({ url: null });
  });
});

describe("DELETE /profile/avatar: a person removes their own", () => {
  it("requires a token", async () => {
    expect((await app.inject({ method: "DELETE", url: "/api/v1/profile/avatar" })).statusCode).toBe(401);
  });
  it("clears the picture and its file, and is not recorded as a moderation", async () => {
    const res = await del("/api/v1/profile/avatar", tB);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ hasPicture: false, removedAt: null });
    expect(storage.removed).toContain(pathOf(w.studentB, 6));
    const audit = await setup(`select count(*)::int as n from audit_log where action = 'profile.avatar.removed'`);
    expect(audit.rows[0].n).toBe(0);
  });
});

describe("DELETE /profiles/:userId/avatar: a teacher or the admin removes someone's", () => {
  const url = (id: string) => `/api/v1/profiles/${id}/avatar`;

  it("DENIED: requires a token, and a student is refused (a classmate's, and their own through this path)", async () => {
    await setPicture(w.studentA, tA, 1);
    expect((await app.inject({ method: "DELETE", url: url(w.studentA), payload: { reason: "nope nope" } })).statusCode).toBe(401);
    const classmate = await del(url(w.studentA), tB, { reason: "I do not like it" });
    expect(classmate.statusCode).toBe(403);
    const own = await del(url(w.studentA), tA, { reason: "I changed my mind" });
    expect(own.statusCode).toBe(403);
    expect((await picture(w.studentA)).avatar_path).toBe(pathOf(w.studentA, 1));
  });
  it("DENIED: a removal needs a reason", async () => {
    for (const body of [undefined, {}, { reason: "" }, { reason: "no" }]) {
      const res = await del(url(w.studentA), tT, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect((await picture(w.studentA)).avatar_path).toBe(pathOf(w.studentA, 1));
  });
  it("DENIED: a teacher cannot remove another teacher's picture, nor the admin's", async () => {
    const res = await del(url(teacherB), tT, { reason: "Not appropriate" });
    expect(res.statusCode).toBe(403);
    expect((await picture(teacherB)).avatar_path).not.toBeNull();
  });
  it("a teacher removes a student's: audited with who, whose and why; the file goes; the student is told", async () => {
    const res = await del(url(w.studentA), tT, { reason: "Not a picture of you" });
    expect(res.statusCode).toBe(200);
    const row = await picture(w.studentA);
    expect(row.avatar_path).toBeNull();
    expect(row.avatar_removed_at).not.toBeNull();
    expect(storage.removed).toContain(pathOf(w.studentA, 1));
    const audit = (await setup(`select actor_id::text, target_type, target_id, payload from audit_log where action = 'profile.avatar.removed' order by id desc limit 1`)).rows[0];
    expect(audit.actor_id).toBe(w.teacher);
    expect(audit.target_type).toBe("profile");
    expect(audit.target_id).toBe(w.studentA);
    expect(audit.payload).toMatchObject({ reason: "Not a picture of you", name: "Student A" });
    const mine = (await get("/api/v1/profile", tA)).json();
    expect(mine.hasPicture).toBe(false);
    expect(mine.removedAt).not.toBeNull();
    expect(mine.avatar.url).toBeNull();
  });
  it("removing again is 404, not a second audit row", async () => {
    const res = await del(url(w.studentA), tT, { reason: "Again please" });
    expect(res.statusCode).toBe(404);
  });
  it("uploading a new picture clears the notice", async () => {
    const res = await setPicture(w.studentA, tA, 2);
    expect(res.statusCode).toBe(200);
    expect(res.json().removedAt).toBeNull();
  });
  it("the admin removes anyone's, a teacher's included", async () => {
    const res = await del(url(teacherB), tAdmin, { reason: "Not appropriate" });
    expect(res.statusCode).toBe(200);
    expect((await picture(teacherB)).avatar_path).toBeNull();
  });
  it("an unknown account is 404", async () => {
    expect((await del(url("00000000-0000-0000-0000-000000000000"), tAdmin, { reason: "Checking" })).statusCode).toBe(404);
    expect((await del("/api/v1/profiles/not-a-uuid/avatar", tAdmin, { reason: "Checking" })).statusCode).toBe(404);
  });
  it("studentC's picture, set by them, is removable by the admin and the section 2A teacher alike (until T2 scopes a teacher to their classes)", async () => {
    await setPicture(studentC, tC, 3);
    const res = await del(url(studentC), tT, { reason: "Test of the pre-T2 rule" });
    expect(res.statusCode).toBe(200);
  });
});

describe("the console shows the picture beside the name", () => {
  it("the roster carries each claimed student's picture to a teacher, removable; unclaimed rows get the generated one", async () => {
    await setup(`insert into student_directory (student_id, full_name, section_id, status) values ('21-0099', 'Unclaimed Uma', $1, 'unclaimed')`, [w.sectionId]);
    await setPicture(w.studentB, tB, 11);
    const res = await get("/api/v1/console/roster", tT);
    expect(res.statusCode).toBe(200);
    const students = res.json().students as Array<{ studentId: string; avatar: { url: string | null; hue: number; variant: number; removable: boolean } }>;
    const b = students.find((s) => s.studentId === "21-0002")!;
    expect(b.avatar.url).toContain(pathOf(w.studentB, 11));
    expect(b.avatar.removable).toBe(true);
    const uma = students.find((s) => s.studentId === "21-0099")!;
    expect(uma.avatar).toMatchObject({ url: null, removable: false, ...generatedAvatar("21-0099") });
    for (const s of students) expect(s.avatar, s.studentId).toBeDefined();
  });
  it("DENIED: a student gets no roster, so no pictures", async () => {
    expect((await get("/api/v1/console/roster", tB)).statusCode).toBe(403);
  });
  it("a student's record carries the picture and says when a teacher removed it", async () => {
    const res = await get(`/api/v1/console/students/${w.studentB}`, tT);
    expect(res.statusCode).toBe(200);
    const s = res.json().student;
    expect(s.avatar.url).toContain(pathOf(w.studentB, 11));
    expect(s.avatar.removable).toBe(true);
    expect(s.pictureRemovedAt).toBeNull();
    expect((await del(`/api/v1/profiles/${w.studentB}/avatar`, tT, { reason: "Not appropriate" })).statusCode).toBe(200);
    const after = (await get(`/api/v1/console/students/${w.studentB}`, tT)).json().student;
    expect(after.avatar).toMatchObject({ url: null, removable: false });
    expect(after.pictureRemovedAt).not.toBeNull();
  });
  it("removable is the DATABASE's answer: never true for a student looking at anyone", async () => {
    await setPicture(w.studentA, tA, 12);
    const m = await avatarsFor(getPool(process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa"), storage, w.studentB, [w.studentA]);
    expect(m.get(w.studentA)!.url).not.toBeNull();
    expect(m.get(w.studentA)!.removable).toBe(false);
  });
  it("the admin's teachers list carries pictures and generated avatars; a teacher gets 403", async () => {
    const res = await get("/api/v1/console/teachers", tAdmin);
    expect(res.statusCode).toBe(200);
    for (const t of res.json().teachers) expect(t.avatar, t.fullName).toMatchObject({ hue: expect.any(Number), variant: expect.any(Number) });
    expect((await get("/api/v1/console/teachers", tT)).statusCode).toBe(403);
  });
});
