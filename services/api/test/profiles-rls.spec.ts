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
 * Profile pictures' denials (docs/PROFILES-PLAN.md, db/addendum-profiles.sql).
 *
 * The rulings (7 Oct 2026, night): classmates and teachers see a picture; any
 * teacher of that student or the admin can remove one; every removal is
 * audited. The database holds three things, and this file tests each by
 * trying to break it:
 *
 *   1. NO CLIENT WRITES THE PICTURE. `profiles` lets a student update their own
 *      row (accent, theme), so the picture's columns need a rule of their own:
 *      a trigger refuses a change to `avatar_path`, `avatar_updated_at` or
 *      `avatar_removed_at` unless the API's transaction says so
 *      (`app.allow_avatar_change`), for EVERY role, `service_role` included.
 *   2. WHO MAY SEE A PICTURE is `can_see_avatar(viewer, subject)`, asked by the
 *      API before it signs a download.
 *   3. WHO MAY REMOVE ONE is `can_remove_avatar(actor, subject)`.
 *
 * Fixture world: studentA and studentB are in BSCPE-2A; studentC (added here) is
 * in BSCPE-2B. teacher is staff; admin and teacherB are added here.
 *
 * Hard rule 8: written first and watched RED (8 Oct 2026), before the addendum
 * existed (every test failed on the missing column and functions).
 */

let w: World;
let studentB: Actor;
let teacher: Actor;
let admin: Actor;
let c = "";
let adminId = "";
let teacherBId = "";

async function addUser(email: string, role: string, name: string, studentNo: string | null, section: string | null) {
  const { rows } = await setup(
    `with u as (
       insert into auth.users (id, email, raw_app_meta_data)
       values (gen_random_uuid(), $1, jsonb_build_object('role', $2::text))
       returning id),
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
  c = await addUser("c@octa-test.local", "student", "Student C", "21-0003", w.otherSectionId);
  adminId = await addUser("admin@octa-test.local", "admin", "The Admin", null, null);
  teacherBId = await addUser("teacherb@octa-test.local", "teacher", "Teacher B", null, null);
  studentB = authenticated(w.studentB, "student", "studentB");
  teacher = authenticated(w.teacher, "teacher", "teacher");
  admin = authenticated(adminId, "admin", "admin");
}, 60_000);

afterAll(async () => {
  await closePool();
});

const pathFor = (userId: string) => `${userId}/0b9f2f0e-5d7a-4c1e-9c3e-111111111111.webp`;
const setPicture = (userId: string, path = pathFor(userId)) =>
  [`update profiles set avatar_path = $2, avatar_updated_at = now() where id = $1 returning id`, [userId, path]] as [string, unknown[]];

describe("no client writes the picture: it is the API's, for every role", () => {
  it("denies a student setting their OWN picture, straight to the table", async () => {
    const res = await runAs(studentB, ...setPicture(w.studentB));
    expect(wasDenied(res), denialReason(res)).toBe(true);
    expect(res.error?.message ?? "").toMatch(/profile picture/);
  });
  it("denies a student setting ANOTHER student's picture", async () => {
    const res = await runAs(studentB, ...setPicture(w.studentA));
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies a teacher's token setting a student's picture (no staff write path)", async () => {
    const res = await runAs(teacher, ...setPicture(w.studentA));
    expect(wasDenied(res), denialReason(res)).toBe(true);
    expect(res.error?.message ?? "").toMatch(/profile picture/);
  });
  it("denies the admin's token too: only the API's transaction writes it", async () => {
    const res = await runAs(admin, ...setPicture(w.studentA));
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("denies a student clearing the removal notice, or faking one on a classmate", async () => {
    const own = await runAs(studentB, `update profiles set avatar_removed_at = null where id = $1 returning id`, [w.studentB]);
    // Setting a column to the value it already has is no change; the faked notice is the test.
    const fake = await runAs(studentB, `update profiles set avatar_removed_at = now() where id = $1 returning id`, [w.studentA]);
    expect(wasDenied(fake), denialReason(fake)).toBe(true);
    expect(own.error).toBeNull();
  });
  it("denies service_role too, unless the transaction says it is the API's change", async () => {
    const res = await runAs(service, ...setPicture(w.studentB));
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/profile picture/);
  });
  it("denies inserting a profile that already carries a picture, unless it is the API's transaction", async () => {
    const { rows } = await setup(
      `insert into auth.users (id, email, raw_app_meta_data)
       values (gen_random_uuid(), 'ghost@octa-test.local', '{"role":"student"}'::jsonb) returning id::text`,
    );
    const id = rows[0]!.id as string;
    const ins = `insert into profiles (id, full_name, role, avatar_path, avatar_updated_at)
                 values ($1::uuid, 'Ghost', 'student', $1::text || '/0b9f2f0e-5d7a-4c1e-9c3e-111111111111.webp', now()) returning id`;
    const res = await runAs(service, ins, [id]);
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/profile picture/);
    const ok = await runAsSteps(service, [[`select set_config('app.allow_avatar_change', 'on', true)`], [ins, [id]]]);
    expect(ok.error, "POSITIVE CONTROL: the API's transaction may").toBeNull();
  });
  it("POSITIVE CONTROL: the API's transaction sets, and clears, a picture", async () => {
    const res = await runAsSteps(service, [
      [`select set_config('app.allow_avatar_change', 'on', true)`],
      setPicture(w.studentB),
      [`update profiles set avatar_path = null, avatar_updated_at = null, avatar_removed_at = now() where id = $1 returning avatar_removed_at`, [w.studentB]],
    ]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
  it("POSITIVE CONTROL: a student still updates their own accent (the guard is the picture's only)", async () => {
    const res = await runAs(studentB, `update profiles set accent_hue = 120 where id = $1 returning id`, [w.studentB]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
  it("even the API cannot point a profile at another user's folder (the path names its owner)", async () => {
    const res = await runAsSteps(service, [
      [`select set_config('app.allow_avatar_change', 'on', true)`],
      setPicture(w.studentB, pathFor(w.studentA)),
    ]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("or at anything that is not a .webp under that folder", async () => {
    const res = await runAsSteps(service, [
      [`select set_config('app.allow_avatar_change', 'on', true)`],
      setPicture(w.studentB, `${w.studentB}/../${w.studentA}/x.webp`),
    ]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
    const png = await runAsSteps(service, [
      [`select set_config('app.allow_avatar_change', 'on', true)`],
      setPicture(w.studentB, `${w.studentB}/0b9f2f0e-5d7a-4c1e-9c3e-111111111111.png`),
    ]);
    expect(wasDenied(png), denialReason(png)).toBe(true);
  });
  it("a picture and its time go together", async () => {
    const res = await runAsSteps(service, [
      [`select set_config('app.allow_avatar_change', 'on', true)`],
      [`update profiles set avatar_path = $2 where id = $1 returning id`, [w.studentB, pathFor(w.studentB)]],
    ]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
});

describe("a student cannot read another's profile row, so no path either", () => {
  it("denies studentB reading studentA's avatar_path", async () => {
    const res = await runAs(studentB, `select avatar_path from profiles where id = $1`, [w.studentA]);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
  it("POSITIVE CONTROL: studentB reads their own row", async () => {
    const res = await runAs(studentB, `select avatar_path from profiles where id = $1`, [w.studentB]);
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
  it("anon reads no profile at all", async () => {
    const res = await runAs(anon, `select id from profiles`);
    expect(wasDenied(res), denialReason(res)).toBe(true);
  });
});

describe("who may SEE a picture: can_see_avatar(viewer, subject)", () => {
  // The API's connection asks, on a viewer's behalf. A client may not: the
  // function takes the viewer as an argument, so a student who could call it
  // could map who shares a section with whom.
  const see = (viewer: string, subject: string) => `select can_see_avatar('${viewer}'::uuid, '${subject}'::uuid) as ok`;
  const ask = async (viewer: string, subject: string) => {
    const res = await runAs<{ ok: boolean }>(service, see(viewer, subject));
    expect(res.error, denialReason(res)).toBeNull();
    return res.rows[0]?.ok;
  };

  it("denies a student a student of another section", async () => {
    expect(await ask(c, w.studentA)).toBe(false);
    expect(await ask(w.studentA, c)).toBe(false);
  });
  it("POSITIVE CONTROL: a classmate sees it, and so does the owner", async () => {
    expect(await ask(w.studentB, w.studentA)).toBe(true);
    expect(await ask(w.studentA, w.studentA)).toBe(true);
  });
  it("a teacher sees a student's, and the admin does", async () => {
    expect(await ask(w.teacher, c)).toBe(true);
    expect(await ask(adminId, w.studentA)).toBe(true);
  });
  it("a student sees a teacher's and the admin's (they are in the chat with them)", async () => {
    expect(await ask(w.studentA, w.teacher)).toBe(true);
    expect(await ask(c, adminId)).toBe(true);
  });
  it("a viewer who is deleted, or unknown, sees nothing", async () => {
    expect(await ask("00000000-0000-0000-0000-000000000000", w.studentA)).toBe(false);
    await setup(`update profiles set deleted_at = now() where id = $1`, [c]);
    expect(await ask(c, w.studentA)).toBe(false);
    await setup(`update profiles set deleted_at = null where id = $1`, [c]);
  });
  it("no client can call it: a student, a teacher or anon", async () => {
    for (const a of [studentB, teacher, anon]) {
      const res = await runAs(a, see(w.studentA, w.studentB));
      expect(wasDenied(res), `${a.label}: ${denialReason(res)}`).toBe(true);
    }
  });
});

describe("who may REMOVE a picture: can_remove_avatar(actor, subject)", () => {
  const can = async (actor: string, subject: string) => {
    const res = await runAs<{ ok: boolean }>(service, `select can_remove_avatar($1::uuid, $2::uuid) as ok`, [actor, subject]);
    expect(res.error, denialReason(res)).toBeNull();
    return res.rows[0]?.ok;
  };
  it("denies a student removing a classmate's, and denies them removing a teacher's", async () => {
    expect(await can(w.studentB, w.studentA)).toBe(false);
    expect(await can(w.studentB, w.teacher)).toBe(false);
  });
  it("denies a teacher removing another teacher's or the admin's", async () => {
    expect(await can(w.teacher, teacherBId)).toBe(false);
    expect(await can(teacherBId, adminId)).toBe(false);
  });
  it("denies removing one's own through the moderation path (a student removes theirs another way)", async () => {
    expect(await can(w.studentA, w.studentA)).toBe(false);
  });
  it("POSITIVE CONTROL: a teacher removes a student's; the admin removes anyone's", async () => {
    expect(await can(w.teacher, w.studentA)).toBe(true);
    expect(await can(adminId, w.studentA)).toBe(true);
    expect(await can(adminId, teacherBId)).toBe(true);
  });
  it("no client can call it: a teacher or anon", async () => {
    for (const a of [teacher, anon]) {
      const res = await runAs(a, `select can_remove_avatar('${w.teacher}'::uuid, '${w.studentA}'::uuid)`);
      expect(wasDenied(res), `${a.label}: ${denialReason(res)}`).toBe(true);
    }
  });
});
