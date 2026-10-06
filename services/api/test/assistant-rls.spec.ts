import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runAs,
  runAsSteps,
  setup,
  anon,
  authenticated,
  service,
  denialReason,
  closePool,
  type Actor,
  type QueryResult,
} from "./helpers/rls.js";
import { resetWorld, type World } from "./helpers/fixtures.js";

/**
 * The drafting assistant's denials (db/addendum-assistant.sql; plan v5 §4-now,
 * §4b; .claude/rules/assistant.md).
 *
 * The rules file names two: no teacher reads a key row, their own included,
 * and teacher B cannot run on teacher A's key. The schema adds: a teacher's
 * books, figures, jobs, steps, briefs and units are owner-only and staff-only;
 * no client writes any of them; an accepted unit is frozen for every role;
 * local Ollama is paused; nothing is filed under another teacher's book.
 *
 * Every denial has its positive control. A denial must be a real denial, not
 * a table that is missing: `wasDenied()` counts any error, so this suite
 * refuses 42P01 (undefined_table) as one.
 *
 * Hard rule 8: watched red first (7 Oct 2026). Before the addendum existed,
 * every positive control failed. With the addendum applied and the owner
 * clause taken out of the read policies, the cross-owner denials went red;
 * restored, green.
 */

const TABLES = [
  "assistant_books",
  "assistant_figures",
  "assistant_jobs",
  "assistant_steps",
  "assistant_briefs",
  "assistant_units",
] as const;

function denied(res: QueryResult): boolean {
  if (res.error?.code === "42P01") return false; // a missing table proves nothing
  return res.error !== null || res.rowCount === 0;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

let w: World;
let teacherA: Actor;
let teacherB: Actor;
let student: Actor;
let idB = "";
let bookA = "";
let bookB = "";
let jobA = "";
let jobB = "";
let keyA = "";
let keyB = "";

beforeAll(async () => {
  w = await resetWorld();
  const tb = await setup(
    `insert into auth.users (id, email, raw_app_meta_data)
     values (gen_random_uuid(), 't2@octa-test.local', '{"role":"teacher"}'::jsonb)
     returning id::text`,
  );
  idB = tb.rows[0].id as string;
  await setup(
    `insert into profiles (id, full_name, role) values ($1, 'Second Teacher', 'teacher'::user_role)`,
    [idB],
  );
  const books = await setup(
    `insert into assistant_books (owner_id, course, title, pdf_sha256) values
       ($1, 'CPE 412', 'Stallings 10e', $3),
       ($2, 'CPE 412', 'Stallings 10e', $3)
     returning id::text`,
    [w.teacher, idB, sha("the book")],
  );
  [bookA, bookB] = books.rows.map((r) => r.id as string) as [string, string];
  await setup(
    `insert into assistant_figures (book_id, owner_id, course, figure_key, chapter, number, page, caption, crop_path, reader_version)
     values ($1, $2, 'CPE 412', '15.1', 15, 1, 568, 'Overlapping Register Windows', $5, 'b1'),
            ($3, $4, 'CPE 412', '15.1', 15, 1, 568, 'Overlapping Register Windows', $6, 'b1')`,
    [bookA, w.teacher, bookB, idB, `${w.teacher}/b/fig-15-01.png`, `${idB}/b/fig-15-01.png`],
  );
  const jobs = await setup(
    `insert into assistant_jobs (book_id, owner_id, course, chapter, kind) values
       ($1, $2, 'CPE 412', 15, 'chapter'), ($3, $4, 'CPE 412', 15, 'chapter')
     returning id::text`,
    [bookA, w.teacher, bookB, idB],
  );
  [jobA, jobB] = jobs.rows.map((r) => r.id as string) as [string, string];
  const keys = await setup(
    `insert into assistant_engine_keys (owner_id, engine, sealed, last4) values
       ($1, 'groq', decode(repeat('ab', 40), 'hex'), 'a1f3'),
       ($2, 'groq', decode(repeat('cd', 40), 'hex'), 'b2e4')
     returning id::text`,
    [w.teacher, idB],
  );
  [keyA, keyB] = keys.rows.map((r) => r.id as string) as [string, string];
  await setup(
    `insert into assistant_steps (job_id, owner_id, course, seq, kind, idempotency_key, engine, model, key_id) values
       ($1, $2, 'CPE 412', 0, 'figure_summary', 'a-0', 'groq', 'llama-4', $3),
       ($4, $5, 'CPE 412', 0, 'figure_summary', 'b-0', 'groq', 'llama-4', $6)`,
    [jobA, w.teacher, keyA, jobB, idB, keyB],
  );
  await setup(
    `insert into assistant_briefs (book_id, owner_id, course, chapter) values
       ($1, $2, 'CPE 412', 15), ($3, $4, 'CPE 412', 15)`,
    [bookA, w.teacher, bookB, idB],
  );
  const body = "Register windows overlap so a call passes parameters without moving data.";
  await setup(
    `insert into assistant_units (job_id, owner_id, course, unit_key, kind, version, body, body_sha256) values
       ($1, $2, 'CPE 412', 'ch15/section/1', 'section', 1, $5, $6),
       ($3, $4, 'CPE 412', 'ch15/section/1', 'section', 1, $5, $6)`,
    [jobA, w.teacher, jobB, idB, body, sha(body)],
  );

  teacherA = authenticated(w.teacher, "teacher", "teacherA");
  teacherB = authenticated(idB, "teacher", "teacherB");
  student = authenticated(w.studentB, "student", "student");
}, 60_000);

afterAll(async () => {
  await closePool();
});

describe("a teacher's assistant work is theirs alone", () => {
  for (const t of TABLES) {
    it(`denies teacher B teacher A's ${t}`, async () => {
      const res = await runAs(teacherB, `select id from ${t} where owner_id = $1`, [w.teacher]);
      expect(denied(res), denialReason(res)).toBe(true);
    });
    it(`denies a student every row of ${t}`, async () => {
      const res = await runAs(student, `select id from ${t}`);
      expect(denied(res), denialReason(res)).toBe(true);
    });
    it(`denies anon every row of ${t}`, async () => {
      const res = await runAs(anon, `select id from ${t}`);
      expect(denied(res), denialReason(res)).toBe(true);
    });
    it(`POSITIVE CONTROL: teacher A reads their own ${t}, and only their own`, async () => {
      const res = await runAs(teacherA, `select owner_id::text as o from ${t}`);
      expect(res.error).toBeNull();
      expect(res.rowCount).toBe(1);
      expect(res.rows[0]!.o).toBe(w.teacher);
    });
  }
});

describe("no teacher reads a key row, their own included", () => {
  it("denies teacher A their own sealed key", async () => {
    const res = await runAs(teacherA, "select sealed from assistant_engine_keys where owner_id = $1", [w.teacher]);
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies teacher A even the last four characters", async () => {
    const res = await runAs(teacherA, "select last4 from assistant_engine_keys where owner_id = $1", [w.teacher]);
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies teacher B teacher A's key, and a student and anon every key", async () => {
    for (const who of [teacherB, student, anon]) {
      const res = await runAs(who, "select id from assistant_engine_keys");
      expect(denied(res), `${who.label}: ${denialReason(res)}`).toBe(true);
    }
  });
  it("denies teacher A writing a key straight to the table", async () => {
    const res = await runAs(
      teacherA,
      "insert into assistant_engine_keys (owner_id, engine, sealed, last4) values ($1, 'claude_api', decode(repeat('ef', 40), 'hex'), 'zzzz') returning id",
      [w.teacher],
    );
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("POSITIVE CONTROL: the API's connection reads both sealed keys", async () => {
    const res = await runAs(service, "select sealed from assistant_engine_keys");
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(2);
  });
});

describe("teacher B cannot run on teacher A's key", () => {
  it("refuses a step of B's job naming A's key, from the API's own connection", async () => {
    const res = await runAs(
      service,
      `insert into assistant_steps (job_id, owner_id, course, seq, kind, idempotency_key, engine, model, key_id)
       values ($1, $2, 'CPE 412', 1, 'section', 'b-1', 'groq', 'llama-4', $3) returning id`,
      [jobB, idB, keyA],
    );
    expect(res.error?.code, denialReason(res)).toBe("23503"); // foreign_key_violation
  });
  it("refuses moving B's existing step onto A's key", async () => {
    const res = await runAs(service, "update assistant_steps set key_id = $1 where job_id = $2 returning id", [keyA, jobB]);
    expect(res.error?.code, denialReason(res)).toBe("23503");
  });
  it("POSITIVE CONTROL: B's step on B's own key is accepted", async () => {
    const res = await runAs(
      service,
      `insert into assistant_steps (job_id, owner_id, course, seq, kind, idempotency_key, engine, model, key_id)
       values ($1, $2, 'CPE 412', 2, 'section', 'b-2', 'groq', 'llama-4', $3) returning id`,
      [jobB, idB, keyB],
    );
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
});

describe("nothing is filed under another teacher's book or job", () => {
  it("refuses B's job on A's book", async () => {
    const res = await runAs(
      service,
      "insert into assistant_jobs (book_id, owner_id, course, chapter, kind) values ($1, $2, 'CPE 412', 16, 'chapter') returning id",
      [bookA, idB],
    );
    expect(res.error?.code, denialReason(res)).toBe("23503");
  });
  it("refuses A's unit on B's job", async () => {
    const body = "x";
    const res = await runAs(
      service,
      `insert into assistant_units (job_id, owner_id, course, unit_key, kind, version, body, body_sha256)
       values ($1, $2, 'CPE 412', 'ch15/section/9', 'section', 1, $3, $4) returning id`,
      [jobB, w.teacher, body, sha(body)],
    );
    expect(res.error?.code, denialReason(res)).toBe("23503");
  });
  it("refuses a crop outside the owner's folder", async () => {
    const res = await runAs(
      service,
      `insert into assistant_figures (book_id, owner_id, course, figure_key, chapter, number, page, caption, crop_path, reader_version)
       values ($1, $2, 'CPE 412', '15.2', 15, 2, 569, 'Circular Buffer', $3, 'b1') returning id`,
      [bookB, idB, `${w.teacher}/b/fig.png`],
    );
    expect(res.error?.code, denialReason(res)).toBe("23514"); // check_violation
  });
});

describe("no client writes the assistant's tables; every write is the API's", () => {
  it("denies teacher A a job straight to the table", async () => {
    const res = await runAs(
      teacherA,
      "insert into assistant_jobs (book_id, owner_id, course, chapter, kind) values ($1, $2, 'CPE 412', 16, 'chapter') returning id",
      [bookA, w.teacher],
    );
    expect(denied(res), denialReason(res)).toBe(true);
  });
  it("denies teacher A editing their own unit or brief", async () => {
    const unit = await runAs(teacherA, "update assistant_units set note = 'edited' where owner_id = $1 returning id", [w.teacher]);
    expect(denied(unit), denialReason(unit)).toBe(true);
    const brief = await runAs(teacherA, "update assistant_briefs set version = 2 where owner_id = $1 returning id", [w.teacher]);
    expect(denied(brief), denialReason(brief)).toBe(true);
  });
  it("denies teacher A deleting their own book", async () => {
    const res = await runAs(teacherA, "delete from assistant_books where owner_id = $1 returning id", [w.teacher]);
    expect(denied(res), denialReason(res)).toBe(true);
  });
});

describe("local Ollama is paused (round five): no step may run on it", () => {
  it("refuses a step on ollama_local, from the API's own connection", async () => {
    const res = await runAs(
      service,
      `insert into assistant_steps (job_id, owner_id, course, seq, kind, idempotency_key, engine, model)
       values ($1, $2, 'CPE 412', 3, 'section', 'a-3', 'ollama_local', 'qwen3.5:4b') returning id`,
      [jobA, w.teacher],
    );
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/as_local_ollama_paused/);
  });
  it("refuses a job whose chain names it", async () => {
    const res = await runAs(
      service,
      "insert into assistant_jobs (book_id, owner_id, course, chapter, kind, engines) values ($1, $2, 'CPE 412', 17, 'chapter', '{groq,ollama_local}') returning id",
      [bookA, w.teacher],
    );
    expect(res.error?.code, denialReason(res)).toBe("23514");
  });
});

describe("an accepted unit is frozen, for every role (plan §4b)", () => {
  const key = "ch15/section/frozen";
  const v1 = "Version one, as the teacher accepted it.";
  const v2 = "Version two, redrafted beside it.";
  const accept = `update assistant_units set status = 'accepted', accepted_by = $2, accepted_at = now()
                  where unit_key = $1 and version = $3 and owner_id = $2 returning id`;

  beforeAll(async () => {
    await setup(
      `insert into assistant_units (job_id, owner_id, course, unit_key, kind, version, body, body_sha256)
       values ($1, $2, 'CPE 412', $3, 'section', 1, $4, $5)`,
      [jobA, w.teacher, key, v1, sha(v1)],
    );
    await setup(accept, [key, w.teacher, 1]);
  });

  it("refuses rewriting its body, from the API's own connection", async () => {
    const res = await runAs(
      service,
      "update assistant_units set body = 'tidied', body_sha256 = $2 where unit_key = $1 and version = 1 returning id",
      [key, sha("tidied")],
    );
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/accepted and frozen/);
  });
  it("refuses touching any other column of it", async () => {
    const res = await runAs(service, "update assistant_units set note = 'a note' where unit_key = $1 and version = 1 returning id", [key]);
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/accepted and frozen/);
  });
  it("refuses deleting it", async () => {
    const res = await runAs(service, "delete from assistant_units where unit_key = $1 and version = 1 returning id", [key]);
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/never deleted/);
  });
  it("refuses superseding it while no later version exists", async () => {
    const res = await runAs(service, "update assistant_units set status = 'superseded' where unit_key = $1 and version = 1 returning id", [key]);
    expect(res.error?.message ?? "", denialReason(res)).toMatch(/accepted and frozen/);
  });
  it("refuses a unit born accepted, and a body its hash does not name", async () => {
    const born = await runAs(
      service,
      `insert into assistant_units (job_id, owner_id, course, unit_key, kind, version, body, body_sha256, status, accepted_by, accepted_at)
       values ($1, $2, 'CPE 412', 'ch15/section/born', 'section', 1, 'b', $3, 'accepted', $2, now()) returning id`,
      [jobA, w.teacher, sha("b")],
    );
    expect(born.error?.message ?? "", denialReason(born)).toMatch(/born a draft/);
    const wrong = await runAs(
      service,
      `insert into assistant_units (job_id, owner_id, course, unit_key, kind, version, body, body_sha256)
       values ($1, $2, 'CPE 412', 'ch15/section/hash', 'section', 1, 'the text', $3) returning id`,
      [jobA, w.teacher, sha("other text")],
    );
    expect(wrong.error?.message ?? "", denialReason(wrong)).toMatch(/not the hash of its body/);
  });
  it("refuses two accepted versions of one unit at once", async () => {
    const res = await runAsSteps(service, [
      [
        `insert into assistant_units (job_id, owner_id, course, unit_key, kind, version, body, body_sha256)
         values ($1, $2, 'CPE 412', $3, 'section', 2, $4, $5)`,
        [jobA, w.teacher, key, v2, sha(v2)],
      ],
      [accept, [key, w.teacher, 2]],
    ]);
    expect(res.error?.code, denialReason(res)).toBe("23505"); // au_one_accepted
  });
  it("POSITIVE CONTROL: v2 beside it, then v1 superseded and v2 accepted, v1's text untouched", async () => {
    const res = await runAsSteps(service, [
      [
        `insert into assistant_units (job_id, owner_id, course, unit_key, kind, version, body, body_sha256)
         values ($1, $2, 'CPE 412', $3, 'section', 2, $4, $5)`,
        [jobA, w.teacher, key, v2, sha(v2)],
      ],
      ["update assistant_units set status = 'superseded' where unit_key = $1 and version = 1", [key]],
      [accept, [key, w.teacher, 2]],
      ["select version, status, body from assistant_units where unit_key = $1 order by version", [key]],
    ]);
    expect(res.error, denialReason(res)).toBeNull();
    expect(res.rows).toEqual([
      { version: 1, status: "superseded", body: v1 },
      { version: 2, status: "accepted", body: v2 },
    ]);
  });
  it("POSITIVE CONTROL: a draft is still a draft, and can be edited", async () => {
    const t = "Edited draft text.";
    const res = await runAs(
      service,
      "update assistant_units set body = $2, body_sha256 = $3 where unit_key = 'ch15/section/1' and owner_id = $1 returning id",
      [w.teacher, t, sha(t)],
    );
    expect(res.error).toBeNull();
    expect(res.rowCount).toBe(1);
  });
});
