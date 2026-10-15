import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runAs, setup, anon, authenticated, closePool, denialReason, type Actor, type QueryResult } from "./helpers/rls.js";
import { seedScopeWorld, type ScopeWorld } from "./helpers/scope-world.js";

/**
 * T2 5.10: a class's own window and attempt limit on a stage check (db/addendum-class-windows.sql, the
 * twenty-fourth SQL file; instructor, 15 Oct 2026: build it now, moon checks follow, only the class's teacher).
 *
 *   read      staff read the rows of the classes they read; no student, no anon
 *   write     nobody through a token: the API is the only writer
 *   shape     a stage check only (an exam, a journey and a moon check are refused); never closes before it opens
 *   decide    effective_assessment_window(): the student's own class's row over the shared paper, field by
 *             field; a moon check on that stage follows it; another class and an ended class do not
 *
 * Hard rule 8: watched red first, 15 Oct 2026, against a database without the table (every test failed).
 */

let sw: ScopeWorld;
const actors: Record<string, Actor> = {};
let stageCheck = "";
let moonCheck = "";
let exam = "";
let classB = "";
let classE = "";

const readable = (r: QueryResult) => {
  if (r.error?.code === "42P01" || r.error?.code === "42703") throw new Error(`a missing table or column proves nothing: ${r.error.message}`);
  return r.error === null && r.rowCount > 0;
};

async function paper(scope: "stage" | "moon" | "final", attempts = 5): Promise<string> {
  const bp = (
    await setup(
      `insert into blueprints (name, scope, stage_id, objective_id, total_items, constraints)
       values ($1, $2, case when $2 = 'final' then null else '03' end, case when $2 = 'moon' then '03.1' end, 1, '{}'::jsonb)
       returning id::text`,
      [`cw ${scope}`, scope],
    )
  ).rows[0]!.id as string;
  return (
    await setup(
      `insert into assessments (blueprint_id, section_id, title, opens_at, closes_at, attempts_allowed)
       values ($1, null, $2, '2026-10-01T00:00Z', '2026-10-31T00:00Z', $3) returning id::text`,
      [bp, `cw ${scope}`, attempts],
    )
  ).rows[0]!.id as string;
}

const effective = (user: string, assessment: string) =>
  setup(
    `select opens_at, closes_at, attempts_allowed, class_id::text from effective_assessment_window($1, $2)`,
    [user, assessment],
  ).then((r) => r.rows[0]!);

beforeAll(async () => {
  sw = await seedScopeWorld();
  await setup(
    `insert into objectives (id, stage_id, code, bloom_level, description)
     values ('03.1', '03', '03.1', 'understand', 'a moon for the window tests') on conflict (id) do nothing`,
  );
  stageCheck = await paper("stage", 5);
  moonCheck = await paper("moon", 5);
  exam = await paper("final", 1);
  classB = (await setup(`select id::text from classes where section_id = $1`, [sw.st.B.section])).rows[0]!.id as string;
  classE = (await setup(`select id::text from classes where section_id = $1`, [sw.st.E.section])).rows[0]!.id as string;
  await setup(
    `insert into class_assessment_windows (class_id, assessment_id, closes_at, attempts_allowed, set_by)
     values ($1, $2, '2026-11-15T00:00Z', 7, $3), ($4, $2, '2026-12-01T00:00Z', 9, $5)`,
    [classB, stageCheck, sw.teacherBId, classE, sw.teacherEId],
  );
  actors.teacherA = authenticated(sw.w.teacher, "teacher", "teacherA");
  actors.teacherB = authenticated(sw.teacherBId, "teacher", "teacherB");
  actors.teacherNone = authenticated(sw.teacherNoneId, "teacher", "teacherNone");
  actors.admin = authenticated(sw.adminId, "admin", "admin");
  actors.studentB = authenticated(sw.st.B.user, "student", "studentB");
  actors.anon = anon;
});

afterAll(async () => {
  await closePool();
});

describe("a class's window is read by the staff who read the class, and no one else", () => {
  for (const [name, expected] of [
    ["teacherB", true], ["admin", true],
    ["teacherA", false], ["teacherNone", false], ["studentB", false], ["anon", false],
  ] as const) {
    it(`${name} ${expected ? "READS" : "is DENIED"} class B's window`, async () => {
      const r = await runAs(actors[name]!, "select 1 from class_assessment_windows where class_id = $1", [classB]);
      expect(readable(r), `${name}: ${denialReason(r)}`).toBe(expected);
    });
  }
});

describe("no token writes a window: the API is the only writer", () => {
  for (const name of ["teacherB", "admin", "studentB", "anon"] as const) {
    it(`${name} cannot insert, update or delete one`, async () => {
      const ins = await runAs(actors[name]!, `insert into class_assessment_windows (class_id, assessment_id, attempts_allowed) values ($1, $2, 99)`, [classB, exam]);
      expect(ins.error, `${name} inserted a window`).not.toBeNull();
      const up = await runAs(actors[name]!, `update class_assessment_windows set attempts_allowed = 99 where class_id = $1 returning 1`, [classB]);
      expect(up.error !== null || up.rowCount === 0, `${name} changed a window`).toBe(true);
      const del = await runAs(actors[name]!, `delete from class_assessment_windows where class_id = $1 returning 1`, [classB]);
      expect(del.error !== null || del.rowCount === 0, `${name} deleted a window`).toBe(true);
    });
  }
  it("the student cannot ask the deciding function directly", async () => {
    const r = await runAs(actors.studentB!, "select * from effective_assessment_window($1, $2)", [sw.st.B.user, stageCheck]);
    expect(r.error, "a token executed effective_assessment_window").not.toBeNull();
  });
});

describe("only a stage check takes a window, and a window that makes sense", () => {
  it("an exam is refused (ruling 4: the exams are global)", async () => {
    await expect(setup(`insert into class_assessment_windows (class_id, assessment_id, attempts_allowed) values ($1, $2, 3)`, [classB, exam])).rejects.toThrow(/stage check only/);
  });
  it("a moon check is refused: it follows its stage's row instead", async () => {
    await expect(setup(`insert into class_assessment_windows (class_id, assessment_id, attempts_allowed) values ($1, $2, 3)`, [classB, moonCheck])).rejects.toThrow(/stage check only/);
  });
  it("a window that closes before it opens is refused, against the shared paper's open", async () => {
    await expect(setup(`update class_assessment_windows set closes_at = '2026-09-01T00:00Z' where class_id = $1`, [classB])).rejects.toThrow(/close before it opens/);
  });
  it("an attempt limit below one is refused", async () => {
    await expect(setup(`update class_assessment_windows set attempts_allowed = 0 where class_id = $1`, [classB])).rejects.toThrow();
  });
});

describe("effective_assessment_window decides, field by field", () => {
  it("the class's student gets the class's close and limit, and the shared open", async () => {
    const e = await effective(sw.st.B.user, stageCheck);
    expect(new Date(e.closes_at).toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(e.attempts_allowed).toBe(7);
    expect(new Date(e.opens_at).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(e.class_id).toBe(classB);
  });
  it("a moon check on that stage follows the class's row", async () => {
    const e = await effective(sw.st.B.user, moonCheck);
    expect(new Date(e.closes_at).toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(e.attempts_allowed).toBe(7);
  });
  it("another class's student gets the shared paper", async () => {
    const e = await effective(sw.st.D.user, stageCheck);
    expect(new Date(e.closes_at).toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(e.attempts_allowed).toBe(5);
  });
  it("an ended class's row no longer applies", async () => {
    const e = await effective(sw.st.E.user, stageCheck);
    expect(e.attempts_allowed).toBe(5);
    expect(e.class_id).toBeNull();
  });
  it("an exam is never moved", async () => {
    const e = await effective(sw.st.B.user, exam);
    expect(e.attempts_allowed).toBe(1);
    expect(new Date(e.closes_at).toISOString()).toBe("2026-10-31T00:00:00.000Z");
  });
});
