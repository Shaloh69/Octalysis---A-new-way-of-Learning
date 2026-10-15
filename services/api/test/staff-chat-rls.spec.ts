import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runAs, setup, anon, authenticated, closePool, denialReason, type Actor, type QueryResult } from "./helpers/rls.js";
import { seedScopeWorld, type ScopeWorld } from "./helpers/scope-world.js";

/**
 * T2: teachers talk to one another (docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5.7, ruled 9 Oct 2026;
 * db/addendum-staff-chat.sql, the twenty-second SQL file).
 *
 *   the staff room      every teacher and the admin read and post; no student, no anon
 *   a staff thread      its TWO members read and post; nobody else, the admin included
 *   last_seen_at        staff about staff: a student cannot read it, a teacher can
 *
 * Hard rule 8: watched red first, 9 Oct 2026, against a database where the room kinds did not exist (every
 * insert of a staff room failed its check, and every positive control with it).
 */

let sw: ScopeWorld;
const actors: Record<string, Actor> = {};
let staffRoom = "";
let pairAB = "";
let pairAdmin = "";

const readable = (r: QueryResult) => {
  if (r.error?.code === "42P01" || r.error?.code === "42703") throw new Error(`a missing table or column proves nothing: ${r.error.message}`);
  return r.error === null && r.rowCount > 0;
};

/** a < b, as the room's shape check requires. */
const ordered = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

beforeAll(async () => {
  sw = await seedScopeWorld();
  const a = sw.w.teacher;
  const b = sw.teacherBId;
  staffRoom = (await setup(`insert into chat_rooms (kind) values ('staff') returning id::text`)).rows[0]!.id as string;
  const [a1, b1] = ordered(a, b);
  pairAB = (await setup(`insert into chat_rooms (kind, member_a, member_b) values ('staff_direct', $1, $2) returning id::text`, [a1, b1])).rows[0]!.id as string;
  const [a2, b2] = ordered(a, sw.adminId);
  pairAdmin = (await setup(`insert into chat_rooms (kind, member_a, member_b) values ('staff_direct', $1, $2) returning id::text`, [a2, b2])).rows[0]!.id as string;
  await setup(`insert into chat_messages (room_id, author_id, body) values ($1, $2, 'staff room hello'), ($3, $2, 'a to b'), ($4, $2, 'a to admin')`, [staffRoom, a, pairAB, pairAdmin]);
  actors.teacherA = authenticated(a, "teacher", "teacherA");
  actors.teacherB = authenticated(b, "teacher", "teacherB");
  actors.teacherEnded = authenticated(sw.teacherEId, "teacher", "teacherEnded");
  actors.teacherNone = authenticated(sw.teacherNoneId, "teacher", "teacherNone");
  actors.admin = authenticated(sw.adminId, "admin", "admin");
  actors.studentA = authenticated(sw.w.studentA, "student", "studentA");
  actors.anon = anon;
});

afterAll(async () => {
  await closePool();
});

describe("the staff room: every teacher and the admin, no one else", () => {
  for (const [name, expected] of [
    ["teacherA", true], ["teacherB", true], ["teacherEnded", true], ["teacherNone", true], ["admin", true],
    ["studentA", false], ["anon", false],
  ] as const) {
    it(`${name} ${expected ? "READS" : "is DENIED"} the staff room and what is said in it`, async () => {
      const room = await runAs(actors[name]!, "select id from chat_rooms where id = $1", [staffRoom]);
      const msgs = await runAs(actors[name]!, "select id from chat_messages where room_id = $1", [staffRoom]);
      expect(readable(room), `${name} room: ${denialReason(room)}`).toBe(expected);
      expect(readable(msgs), `${name} messages: ${denialReason(msgs)}`).toBe(expected);
    });
  }
});

describe("a staff thread is its two members' alone, the admin's included", () => {
  for (const [name, inAB, inAdmin] of [
    ["teacherA", true, true], ["teacherB", true, false], ["teacherEnded", false, false], ["teacherNone", false, false],
    ["admin", false, true], ["studentA", false, false], ["anon", false, false],
  ] as const) {
    it(`${name}: thread A-B ${inAB ? "READ" : "DENIED"}, thread A-admin ${inAdmin ? "READ" : "DENIED"}`, async () => {
      const ab = await runAs(actors[name]!, "select id from chat_messages where room_id = $1", [pairAB]);
      const ad = await runAs(actors[name]!, "select id from chat_messages where room_id = $1", [pairAdmin]);
      expect(readable(ab), `${name} A-B: ${denialReason(ab)}`).toBe(inAB);
      expect(readable(ad), `${name} A-admin: ${denialReason(ad)}`).toBe(inAdmin);
      const room = await runAs(actors[name]!, "select id from chat_rooms where id = $1", [pairAB]);
      expect(readable(room), `${name} the room row A-B`).toBe(inAB);
    });
  }
});

describe("posting follows belonging", () => {
  const say = (author: string, room: string) =>
    setup("insert into chat_messages (room_id, author_id, body) values ($1, $2, 'test') returning id", [room, author]).then(
      () => null,
      (e: { code?: string; message: string }) => e,
    );

  it("a teacher posts in the staff room; a student cannot", async () => {
    expect(await say(sw.teacherNoneId, staffRoom), "POSITIVE CONTROL: a teacher with no class posts in the staff room").toBeNull();
    expect(await say(sw.adminId, staffRoom), "POSITIVE CONTROL: the admin").toBeNull();
    expect(await say(sw.w.studentB, staffRoom), "a student posted in the staff room").not.toBeNull();
  });

  it("a staff thread takes its members' words and no one else's", async () => {
    expect(await say(sw.w.teacher, pairAB), "POSITIVE CONTROL: a member").toBeNull();
    expect(await say(sw.teacherBId, pairAB), "POSITIVE CONTROL: the other member").toBeNull();
    expect(await say(sw.adminId, pairAB), "the admin posted in two teachers' thread").not.toBeNull();
    expect(await say(sw.teacherNoneId, pairAB), "a teacher outside the pair posted in it").not.toBeNull();
    expect(await say(sw.w.studentB, pairAB), "a student posted in a staff thread").not.toBeNull();
  });
});

describe("the rooms have a shape the database keeps", () => {
  it("one staff room only", async () => {
    await expect(setup(`insert into chat_rooms (kind) values ('staff')`)).rejects.toThrow();
  });
  it("a staff thread is an ordered pair, and one per pair", async () => {
    const [lo, hi] = ordered(sw.w.teacher, sw.teacherBId);
    await expect(setup(`insert into chat_rooms (kind, member_a, member_b) values ('staff_direct', $1, $2)`, [hi, lo]), "an unordered pair").rejects.toThrow();
    await expect(setup(`insert into chat_rooms (kind, member_a, member_b) values ('staff_direct', $1, $2)`, [lo, hi]), "the same pair twice").rejects.toThrow();
  });
  it("a staff thread with a student or a section in it is refused", async () => {
    const [lo, hi] = ordered(sw.teacherNoneId, sw.teacherEId);
    await expect(setup(`insert into chat_rooms (kind, member_a, member_b, student_id) values ('staff_direct', $1, $2, $3)`, [lo, hi, sw.w.studentA])).rejects.toThrow();
  });
});

describe("when someone was last seen is staff's to read about staff", () => {
  it("a teacher reads a colleague's; a student reads nobody's but their own", async () => {
    await setup(`update profiles set last_seen_at = now() where id = $1`, [sw.w.teacher]);
    const colleague = await runAs(actors.teacherB!, "select last_seen_at from profiles where id = $1", [sw.w.teacher]);
    expect(readable(colleague), `POSITIVE CONTROL: ${denialReason(colleague)}`).toBe(true);
    const student = await runAs(actors.studentA!, "select last_seen_at from profiles where id = $1", [sw.w.teacher]);
    expect(readable(student), "a student read when a teacher was last seen").toBe(false);
    const anonRead = await runAs(anon, "select last_seen_at from profiles where id = $1", [sw.w.teacher]);
    expect(readable(anonRead)).toBe(false);
  });
});
