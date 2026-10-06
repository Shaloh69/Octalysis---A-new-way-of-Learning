import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runAs,
  runAsSteps,
  setup,
  anon,
  authenticated,
  service,
  wasDenied,
  denialReason,
  closePool,
  type Actor,
} from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * The class chat's denials (docs/CHAT-PLAN.md, db/addendum-chat.sql).
 *
 * Every denial has its positive control: the identical query run by someone
 * who should succeed. The four the plan names: a student cannot read another
 * section's room, post as someone else, read a deleted message's text, or post
 * during a paper. And the ones the schema adds: a private thread is private, a
 * message is never edited or hard-deleted, a mention stays inside its room.
 *
 * The fixture world: studentA and studentB are in BSCPE-2A, and studentA has a
 * paper open (the in-progress stage check). studentC, added here, is in
 * BSCPE-2B. The teacher is staff.
 *
 * Hard rule 8: watched red first (6 Oct 2026) — with the section clause taken
 * out of the membership predicate (now chat_belongs()), the four cross-section
 * denials went red; restored, green.
 */

let w: World;
let studentA: Actor;
let studentB: Actor;
let studentC: Actor;
let teacher: Actor;
let roomA = "";
let roomB = "";
let threadB = "";
let threadC = "";
let deletedId = "";

beforeAll(async () => {
  w = await resetWorld();
  const { rows } = await setup(
    `with uc as (
       insert into auth.users (id, email, raw_app_meta_data)
       values (gen_random_uuid(), 'c@octa-test.local', '{"role":"student"}'::jsonb)
       returning id),
     dir as (
       insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
       select '21-0003', 'Student C', $1::uuid, 'claimed'::claim_status, id, now() from uc
       returning student_id),
     prof as (
       insert into profiles (id, student_id, full_name, section_id, role)
       select id, '21-0003', 'Student C', $1::uuid, 'student'::user_role from uc, dir
       returning id)
     select id::text from prof`,
    [w.otherSectionId],
  );
  const c = rows[0].id as string;
  const rooms = await setup(
    `insert into chat_rooms (kind, section_id, student_id) values
       ('section', $1, null), ('section', $2, null), ('direct', null, $3), ('direct', null, $4)
     returning id::text`,
    [w.sectionId, w.otherSectionId, w.studentB, c],
  );
  [roomA, roomB, threadB, threadC] = rooms.rows.map((r) => r.id as string) as [string, string, string, string];
  await setup(
    `insert into chat_messages (room_id, author_id, body, mentions) values
       ($1, $2, 'Section A: is a register a kind of memory?', '{}'),
       ($1, $3, 'Yes, the fastest kind, @Student B', array[$2]::uuid[]),
       ($4, $5, 'Section B only', '{}'),
       ($6, $2, 'Private: I am stuck on stage 03', '{}'),
       ($7, $5, 'Private to C', '{}')`,
    [roomA, w.studentB, w.teacher, roomB, c, threadB, threadC],
  );
  const del = await setup(
    `insert into chat_messages (room_id, author_id, body) values ($1, $2, 'secret text that was deleted')
     returning id::text`,
    [roomA, w.studentB],
  );
  deletedId = del.rows[0].id as string;
  await setup(
    `update chat_messages set deleted_at = now(), deleted_by = $2, body = null, mentions = '{}' where id = $1`,
    [deletedId, w.teacher],
  );
  await setup(`insert into chat_members (room_id, user_id) values ($1, $2), ($3, $4)`, [roomA, w.studentB, roomB, c]);

  studentA = authenticated(w.studentA, "student", "studentA");
  studentB = authenticated(w.studentB, "student", "studentB");
  studentC = authenticated(c, "student", "studentC");
  teacher = authenticated(w.teacher, "teacher", "teacher");
}, 60_000);

afterAll(async () => {
  await closePool();
});

describe("a student cannot read another section's room", () => {
  const q = "select body from chat_messages where room_id = $1";
  it("denies studentC (BSCPE-2B) section A's messages", async () => {
    const res = await runAs(studentC, q, [roomA]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies studentC section A's room row", async () => {
    const res = await runAs(studentC, "select id from chat_rooms where id = $1", [roomA]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("POSITIVE CONTROL: studentB (BSCPE-2A) reads them", async () => {
    const res = await runAs(studentB, q, [roomA]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBeGreaterThanOrEqual(2);
  });
  it("POSITIVE CONTROL: the instructor reads every room", async () => {
    const res = await runAs(teacher, "select count(distinct room_id)::int as n from chat_messages");
    expect(res.error).toBeNull();
    expect(Number(res.rows[0]!.n)).toBe(4);
  });
  it("anon reads nothing at all", async () => {
    const res = await runAs(anon, "select id from chat_messages");
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
});

describe("a private thread is between one student and the instructor", () => {
  const q = "select body from chat_messages where room_id = $1";
  it("denies studentB studentC's thread", async () => {
    const res = await runAs(studentB, q, [threadC]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies studentC studentB's thread", async () => {
    const res = await runAs(studentC, q, [threadB]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("POSITIVE CONTROL: studentB reads their own thread, the instructor reads both", async () => {
    const own = await runAs(studentB, q, [threadB]);
    expect(own.rowCount).toBe(1);
    const staff = await runAs(teacher, "select id from chat_messages where room_id in ($1, $2)", [threadB, threadC]);
    expect(staff.rowCount).toBe(2);
  });
});

describe("a student cannot post, as anyone: every write is the API's", () => {
  it("denies studentB a message as the instructor", async () => {
    const res = await runAs(studentB, "insert into chat_messages (room_id, author_id, body) values ($1, $2, 'forged') returning id", [roomA, w.teacher]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies studentB a message as themself, straight to the table", async () => {
    const res = await runAs(studentB, "insert into chat_messages (room_id, author_id, body) values ($1, $2, 'direct') returning id", [roomA, w.studentB]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies the instructor too: a staff token behind the API's back writes nothing", async () => {
    const res = await runAs(teacher, "insert into chat_messages (room_id, author_id, body) values ($1, $2, 'direct') returning id", [roomA, w.teacher]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies a student creating a room or moving a read marker", async () => {
    const room = await runAs(studentB, "insert into chat_rooms (kind, student_id) values ('direct', $1) returning id", [w.studentB]);
    expect(wasDenied(room), denialReason(room)).toBe(true);
    const mark = await runAs(studentB, "update chat_members set last_read_at = now() where user_id = $1 returning room_id", [w.studentB]);
    expect(wasDenied(mark), denialReason(mark)).toBe(true);
  });
  it("POSITIVE CONTROL: the API's connection posts as studentB", async () => {
    const res = await runAs(service, "insert into chat_messages (room_id, author_id, body) values ($1, $2, 'via the API') returning id", [roomA, w.studentB]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
  it("the API's connection cannot post a student into a room they are not in", async () => {
    const res = await runAs(service, "insert into chat_messages (room_id, author_id, body) values ($1, $2, 'wrong room') returning id", [roomB, w.studentB]);
    expect(res.error?.message).toMatch(/cannot post in this room/);
  });
});

describe("a student with a paper open can neither read nor post (ruling 3)", () => {
  it("denies studentA (paper open) section A's messages", async () => {
    const res = await runAs(studentA, "select body from chat_messages where room_id = $1", [roomA]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("refuses a post by studentA even from the API's own connection", async () => {
    const res = await runAs(service, "insert into chat_messages (room_id, author_id, body) values ($1, $2, 'what is q3?') returning id", [roomA, w.studentA]);
    expect(res.error?.message).toMatch(/closed while a paper is open/);
  });
  it("POSITIVE CONTROL: once the paper's window has closed, studentA reads and posts again", async () => {
    const res = await runAsSteps(service, [
      ["update assessments set closes_at = now() - interval '1 minute' where section_id = $1", [w.sectionId]],
      ["insert into chat_messages (room_id, author_id, body) values ($1, $2, 'back') returning id", [roomA, w.studentA]],
    ]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
  it("POSITIVE CONTROL: once submitted, studentA reads the room", async () => {
    const res = await runAsSteps(studentA, [
      ["reset role"],
      ["update attempts set status = 'submitted', submitted_at = now() where user_id = $1 and status = 'in_progress'", [w.studentA]],
      ["set local role authenticated"],
      ["select body from chat_messages where room_id = $1", [roomA]],
    ]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBeGreaterThanOrEqual(2);
  });
  it("the instructor is never closed out by a paper", async () => {
    const res = await runAsSteps(service, [
      ["insert into attempts (user_id, assessment_id, attempt_no, seed, status) values ($1, $2, 9, 'staff-seed', 'in_progress')", [w.teacher, w.practiceAssessmentId]],
      ["insert into chat_messages (room_id, author_id, body) values ($1, $2, 'still here') returning id", [roomA, w.teacher]],
    ]);
    expect(res.error).toBeNull();
  });
});

describe("a deleted message's text is gone, and nothing is edited or hard-deleted", () => {
  it("the tombstone has no text, even for the instructor", async () => {
    for (const who of [studentB, teacher]) {
      const res = await runAs(who, "select body, deleted_at from chat_messages where id = $1", [deletedId]);
      expect(res.error).toBeNull();
      expect(res.rows[0]).toMatchObject({ body: null });
      expect(res.rows[0]!.deleted_at).not.toBeNull();
    }
  });
  it("no text anywhere in the room is the deleted text", async () => {
    const res = await runAs(teacher, "select id from chat_messages where body like '%secret text%'");
    expect(res.rowCount).toBe(0);
  });
  it("refuses restoring a deleted message, even from the API's connection", async () => {
    const res = await runAs(service, "update chat_messages set deleted_at = null, body = 'back' where id = $1", [deletedId]);
    expect(res.error?.message).toMatch(/stays deleted/);
  });
  it("refuses editing a message's text", async () => {
    const res = await runAs(service, "update chat_messages set body = 'edited' where room_id = $1 and body like 'Section A%'", [roomA]);
    expect(res.error?.message).toMatch(/never edited/);
  });
  it("refuses a hard delete for every role", async () => {
    const res = await runAs(service, "delete from chat_messages where room_id = $1", [roomA]);
    expect(res.error?.message).toMatch(/append-only/);
  });
  it("refuses a tombstone that keeps its text", async () => {
    const res = await runAs(service, "update chat_messages set deleted_at = now() where room_id = $1 and body like 'Section A%'", [roomA]);
    expect(res.error).not.toBeNull();
  });
  it("POSITIVE CONTROL: a proper tombstone is accepted", async () => {
    const res = await runAs(service, "update chat_messages set deleted_at = now(), body = null, mentions = '{}' where room_id = $1 and body like 'Section A%' returning id", [roomA]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
});

describe("mentions and attachments stay inside their room", () => {
  it("refuses a mention of a student from another section", async () => {
    const res = await runAs(service, "insert into chat_messages (room_id, author_id, body, mentions) values ($1, $2, '@Student C', array[$3]::uuid[])", [roomA, w.studentB, studentC.userId]);
    expect(res.error?.message).toMatch(/outside the room/);
  });
  it("POSITIVE CONTROL: a mention of a classmate and of the instructor is accepted", async () => {
    // studentA has a paper open: still in the section, so still mentionable;
    // they read it after submitting.
    const res = await runAs(service, "insert into chat_messages (room_id, author_id, body, mentions) values ($1, $2, 'hi', array[$3, $4]::uuid[]) returning id", [roomA, w.studentB, w.teacher, w.studentA]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
  it("refuses an attachment filed under another room or author", async () => {
    const res = await runAs(service,
      "insert into chat_messages (room_id, author_id, attachment_path, attachment_mime, attachment_bytes) values ($1, $2, $3, 'image/png', 1000)",
      [roomA, w.studentB, `${roomB}/${w.studentB}/x.png`]);
    expect(res.error?.message).toMatch(/filed under its room and its author/);
  });
  it("refuses an attachment over 25 MB or of another type", async () => {
    const big = await runAs(service,
      "insert into chat_messages (room_id, author_id, attachment_path, attachment_mime, attachment_bytes) values ($1, $2, $3, 'video/mp4', 26214401)",
      [roomA, w.studentB, `${roomA}/${w.studentB}/x.mp4`]);
    expect(big.error).not.toBeNull();
    const exe = await runAs(service,
      "insert into chat_messages (room_id, author_id, attachment_path, attachment_mime, attachment_bytes) values ($1, $2, $3, 'application/x-msdownload', 10)",
      [roomA, w.studentB, `${roomA}/${w.studentB}/x.exe`]);
    expect(exe.error).not.toBeNull();
  });
  it("read markers are private: studentB cannot see studentC's", async () => {
    const res = await runAs(studentB, "select room_id from chat_members where user_id = $1", [studentC.userId]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
    const own = await runAs(studentB, "select room_id from chat_members where user_id = $1", [w.studentB]);
    expect(own.rowCount).toBe(1);
  });
});
