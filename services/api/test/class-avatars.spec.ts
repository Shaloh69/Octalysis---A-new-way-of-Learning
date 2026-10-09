import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runAs, service, closePool, authenticated, type Actor } from "./helpers/rls.js";
import { seedScopeWorld, ALL, type Key, type ScopeWorld } from "./helpers/scope-world.js";

/**
 * T2 and the picture (docs/PROFILES-PLAN.md section 5b; docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5.4;
 * db/addendum-class-avatars.sql, the twenty-first SQL file).
 *
 *   REMOVE  a student's picture: the teacher of a class the student is in and that has not ended; the
 *           admin, anyone's (the moderation exception, instructor 9 Oct 2026); never one's own.
 *   SEE     a student's picture: its owner; a classmate; the teacher of a class they read (ended or
 *           not); the admin. A teacher's or the admin's by every signed-in student.
 *
 * Both functions are executable by the API's connection only (they take the viewer as an argument,
 * so a client able to call them could map who teaches whom); the tests call them as service_role.
 *
 * Hard rule 8: watched red first, 9 Oct 2026, against the functions that said "any teacher".
 */

let sw: ScopeWorld;
const ids: Record<string, string> = {};

const MAY_REMOVE: Record<string, Key[]> = {
  teacherA: ["A"], teacherB: ["B"], teacherEnded: [], teacherNone: [], admin: ["A", "B", "E", "D"],
};
const MAY_SEE: Record<string, Key[]> = {
  teacherA: ["A"], teacherB: ["B"], teacherEnded: ["E"], teacherNone: [], admin: ["A", "B", "E", "D"],
};

async function ask(fn: "can_remove_avatar" | "can_see_avatar", actor: string, subject: string): Promise<boolean> {
  const res = await runAs<{ ok: boolean }>(service, `select ${fn}($1::uuid, $2::uuid) as ok`, [actor, subject]);
  if (res.error) throw new Error(`${fn} raised: ${res.error.message}`);
  return res.rows[0]!.ok;
}

beforeAll(async () => {
  sw = await seedScopeWorld();
  ids.teacherA = sw.w.teacher;
  ids.teacherB = sw.teacherBId;
  ids.teacherEnded = sw.teacherEId;
  ids.teacherNone = sw.teacherNoneId;
  ids.admin = sw.adminId;
});

afterAll(async () => {
  await closePool();
});

describe("a picture is removed by the teacher of that student's class, or by the admin", () => {
  for (const [actor, may] of Object.entries(MAY_REMOVE)) {
    for (const k of ALL) {
      const expected = may.includes(k);
      it(`${actor} ${expected ? "MAY" : "MAY NOT"} remove student ${k}'s picture`, async () => {
        expect(await ask("can_remove_avatar", ids[actor]!, sw.st[k].user)).toBe(expected);
      });
    }
  }

  it("a student cannot remove a classmate's, and no one removes their own as a moderator", async () => {
    expect(await ask("can_remove_avatar", sw.w.studentB, sw.st.A.user), "a classmate removed a picture").toBe(false);
    expect(await ask("can_remove_avatar", sw.w.studentA, sw.st.A.user), "removing one's own is not a moderation").toBe(false);
  });

  it("only the admin removes a teacher's picture", async () => {
    expect(await ask("can_remove_avatar", ids.admin!, ids.teacherA!), "POSITIVE CONTROL").toBe(true);
    expect(await ask("can_remove_avatar", ids.teacherB!, ids.teacherA!)).toBe(false);
  });
});

describe("a student's picture is seen by the people of their classes", () => {
  for (const [viewer, may] of Object.entries(MAY_SEE)) {
    for (const k of ALL) {
      const expected = may.includes(k);
      it(`${viewer} ${expected ? "SEES" : "does NOT see"} student ${k}'s picture`, async () => {
        expect(await ask("can_see_avatar", ids[viewer]!, sw.st[k].user)).toBe(expected);
      });
    }
  }

  it("a classmate sees it and a student of another class does not", async () => {
    expect(await ask("can_see_avatar", sw.w.studentB, sw.st.A.user), "POSITIVE CONTROL: a classmate").toBe(true);
    expect(await ask("can_see_avatar", sw.st.B.user, sw.st.A.user), "a student of another class saw it").toBe(false);
  });

  it("a teacher's picture is seen by every signed-in student, whatever their class", async () => {
    expect(await ask("can_see_avatar", sw.st.B.user, ids.teacherA!)).toBe(true);
  });

  it("is not callable by a client: the viewer is an argument", async () => {
    const as: Actor = authenticated(ids.teacherA!, "teacher", "teacherA");
    const res = await runAs(as, "select can_see_avatar($1::uuid, $2::uuid)", [ids.teacherA, sw.st.B.user]);
    expect(res.error, "a client called a function that maps who teaches whom").not.toBeNull();
  });
});
