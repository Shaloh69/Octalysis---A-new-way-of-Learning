import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { setup, closePool, runAs, authenticated, denialReason, wasDenied } from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * Course Studio, CS1: subjects and their books, written by EVERY teacher
 * (docs/COURSE-STUDIO-PLAN.md §3, ruling 3, 7 Oct 2026, night), through the
 * API with a reason and an audit row. The RLS stays "no client write".
 *
 * Denials first: a student and no token are refused every write; a teacher
 * cannot write a subject or a book straight to the table. Hard rule 8: watched
 * red first (no routes: every positive control 404'd), then green.
 */

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mint(userId: string, role: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({
    sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: { role },
  })).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

let app: FastifyInstance;
let w: World;
let teacherTok = "";
let studentTok = "";
let defaultBook = "";
let otherBook = "";

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const inject = (method: "GET" | "POST" | "PATCH", url: string, token: string | null, payload?: unknown) =>
  app.inject({ method, url, headers: token ? auth(token) : {}, ...(payload !== undefined ? { payload: payload as object } : {}) });

const CPE412 = encodeURIComponent("CPE 412");

beforeAll(async () => {
  w = await resetWorld();
  await setup(`delete from subject_books where subject_code <> 'CPE 412'`);
  await setup(`delete from subjects where code <> 'CPE 412'`);
  await setup(`update subjects set title = 'Computer Architecture and Organization' where code = 'CPE 412'`);
  const b = await setup(`select id::text, is_default from subject_books where subject_code = 'CPE 412' order by is_default desc`);
  defaultBook = b.rows[0]!.id as string;
  otherBook = b.rows[1]!.id as string;

  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
  } as NodeJS.ProcessEnv);
  app = await buildServer(env);
  await app.ready();
  teacherTok = mint(w.teacher, "teacher");
  studentTok = mint(w.studentA, "student");
}, 60_000);

afterAll(async () => {
  // Leave CPE 412 as the seed has it: its 9th edition the default.
  await setup(`update subject_books set is_default = false where subject_code = 'CPE 412'`);
  await setup(`update subject_books set is_default = true where id = $1`, [defaultBook]);
  await app?.close();
  await closePool();
});

describe("every subject and book route refuses a student and no token", () => {
  const routes = (): Array<["GET" | "POST" | "PATCH", string, unknown?]> => [
    ["GET", "/api/v1/console/subjects"],
    ["POST", "/api/v1/console/subjects", { code: "CPE 499", title: "Nope", reason: "test" }],
    ["PATCH", `/api/v1/console/subjects/${CPE412}`, { title: "Nope", reason: "test" }],
    ["POST", `/api/v1/console/subjects/${CPE412}/books`, { title: "Nope", reason: "test" }],
    ["PATCH", `/api/v1/console/books/${otherBook}`, { title: "Nope", reason: "test" }],
    ["POST", `/api/v1/console/books/${otherBook}/default`, { reason: "test" }],
  ];
  it("student 403, no token 401, on all six", async () => {
    for (const [method, url, body] of routes()) {
      expect((await inject(method, url, studentTok, body)).statusCode, `${method} ${url} student`).toBe(403);
      expect((await inject(method, url, null, body)).statusCode, `${method} ${url} anon`).toBe(401);
    }
    const s = await setup(`select count(*)::int n from subjects where code = 'CPE 499'`);
    expect(s.rows[0]!.n).toBe(0);
    const t = await setup(`select title from subjects where code = 'CPE 412'`);
    expect(t.rows[0]!.title).toBe("Computer Architecture and Organization");
  });
});

describe("a teacher cannot write a subject or a book straight to the table", () => {
  const teacher = () => authenticated(w.teacher, "teacher");
  it("denies a teacher renaming a subject directly", async () => {
    const r = await runAs(teacher(), "update subjects set title = 'Mine' where code = 'CPE 412' returning code");
    expect(wasDenied(r), denialReason(r)).toBe(true);
  });
  it("denies a teacher editing or defaulting a book directly", async () => {
    const r = await runAs(teacher(), "update subject_books set title = 'Mine' where subject_code = 'CPE 412' returning id");
    expect(wasDenied(r), denialReason(r)).toBe(true);
    const d = await runAs(teacher(), "update subject_books set is_default = not is_default where subject_code = 'CPE 412' returning id");
    expect(wasDenied(d), denialReason(d)).toBe(true);
  });
  it("denies a teacher deleting a book or a subject directly", async () => {
    const b = await runAs(teacher(), "delete from subject_books where subject_code = 'CPE 412' returning id");
    expect(wasDenied(b), denialReason(b)).toBe(true);
    const s = await runAs(teacher(), "delete from subjects where code = 'CPE 412' returning code");
    expect(wasDenied(s), denialReason(s)).toBe(true);
  });
});

describe("every teacher writes subjects and books through the API, with a reason", () => {
  it("lists the subjects with their books, classes and the reader's right to approve", async () => {
    const res = await inject("GET", "/api/v1/console/subjects", teacherTok);
    expect(res.statusCode).toBe(200);
    const s = res.json().subjects.find((x: { code: string }) => x.code === "CPE 412");
    expect(s.books.length).toBeGreaterThanOrEqual(2);
    expect(s.books.filter((b: { isDefault: boolean }) => b.isDefault)).toHaveLength(1);
    expect(s).toHaveProperty("classes");
    expect(s).toHaveProperty("hasChapters", true);
    expect(res.json().me).toHaveProperty("approves");
  });

  it("refuses a write without a reason", async () => {
    expect((await inject("POST", "/api/v1/console/subjects", teacherTok, { code: "CPE 413", title: "X" })).statusCode).toBe(400);
    expect((await inject("PATCH", `/api/v1/console/subjects/${CPE412}`, teacherTok, { title: "X" })).statusCode).toBe(400);
  });

  it("refuses a code that is not a course code", async () => {
    const res = await inject("POST", "/api/v1/console/subjects", teacherTok, { code: "cpe-413!", title: "X", reason: "a new course" });
    expect(res.statusCode).toBe(400);
  });

  it("adds a subject, audited with the reason", async () => {
    const res = await inject("POST", "/api/v1/console/subjects", teacherTok, {
      code: "CPE 413", title: "Embedded Systems", reason: "Second-term course",
    });
    expect(res.statusCode).toBe(201);
    const a = await setup(`select actor_id::text, payload from audit_log where action = 'subject.create' and target_id = 'CPE 413'`);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0]!.actor_id).toBe(w.teacher);
    expect(a.rows[0]!.payload.reason).toBe("Second-term course");
  });

  it("refuses the same code twice (409), and nothing changes", async () => {
    const res = await inject("POST", "/api/v1/console/subjects", teacherTok, { code: "CPE 413", title: "Other", reason: "again" });
    expect(res.statusCode).toBe(409);
    const t = await setup(`select title from subjects where code = 'CPE 413'`);
    expect(t.rows[0]!.title).toBe("Embedded Systems");
  });

  it("renames a subject, keeping the old title in the audit row", async () => {
    const res = await inject("PATCH", `/api/v1/console/subjects/${encodeURIComponent("CPE 413")}`, teacherTok, {
      title: "Embedded Systems Design", reason: "The syllabus's title",
    });
    expect(res.statusCode).toBe(200);
    const a = await setup(`select payload from audit_log where action = 'subject.rename' and target_id = 'CPE 413'`);
    expect(a.rows[0]!.payload).toMatchObject({ from: "Embedded Systems", to: "Embedded Systems Design" });
  });

  it("404s a subject that does not exist", async () => {
    const res = await inject("PATCH", `/api/v1/console/subjects/${encodeURIComponent("CPE 999")}`, teacherTok, { title: "X", reason: "test it" });
    expect(res.statusCode).toBe(404);
  });

  let newBook = "";
  it("adds a subject's first book, which becomes its default", async () => {
    const res = await inject("POST", `/api/v1/console/subjects/${encodeURIComponent("CPE 413")}/books`, teacherTok, {
      title: "Embedded Systems", author: "A. Author", edition: "3rd", reason: "The syllabus's book",
    });
    expect(res.statusCode).toBe(201);
    newBook = res.json().id;
    const b = await setup(`select is_default from subject_books where id = $1`, [newBook]);
    expect(b.rows[0]!.is_default).toBe(true);
    const a = await setup(`select payload from audit_log where action = 'book.create' and target_id = $1`, [newBook]);
    expect(a.rows[0]!.payload.subjectCode).toBe("CPE 413");
  });

  it("refuses a twin book (same title and edition) with 409", async () => {
    const res = await inject("POST", `/api/v1/console/subjects/${encodeURIComponent("CPE 413")}/books`, teacherTok, {
      title: "Embedded Systems", edition: "3rd", reason: "again",
    });
    expect(res.statusCode).toBe(409);
  });

  it("edits a book, keeping what it said in the audit row", async () => {
    const res = await inject("PATCH", `/api/v1/console/books/${newBook}`, teacherTok, { edition: "4th", reason: "Newer edition" });
    expect(res.statusCode).toBe(200);
    const a = await setup(`select payload from audit_log where action = 'book.update' and target_id = $1`, [newBook]);
    expect(a.rows[0]!.payload.from).toMatchObject({ edition: "3rd" });
    expect(a.rows[0]!.payload.to).toMatchObject({ edition: "4th" });
  });

  it("makes another book the default: exactly one default remains", async () => {
    const res = await inject("POST", `/api/v1/console/books/${otherBook}/default`, teacherTok, { reason: "The 10th edition this term" });
    expect(res.statusCode).toBe(200);
    const d = await setup(`select id::text from subject_books where subject_code = 'CPE 412' and is_default`);
    expect(d.rows.map((r) => r.id)).toEqual([otherBook]);
    const a = await setup(`select payload from audit_log where action = 'book.default' and target_id = $1`, [otherBook]);
    expect(a.rows[0]!.payload).toMatchObject({ subjectCode: "CPE 412", previous: defaultBook });
  });

  it("404s a book that does not exist", async () => {
    const res = await inject("PATCH", "/api/v1/console/books/00000000-0000-0000-0000-000000000000", teacherTok, { title: "X", reason: "test it" });
    expect(res.statusCode).toBe(404);
  });
});
