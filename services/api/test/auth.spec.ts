import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { loadEnv } from "../src/env.js";
import { registerAuthRoutes, type SupabaseAdmin } from "../src/routes/auth.js";
import { setup, pool, closePool } from "./helpers/rls.js";
import { resetAll } from "./helpers/reset.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long-000000";

function mintToken(userId: string, role: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({
      sub: userId, aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: { role },
    }),
  ).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

/** A fake Supabase admin so the route is testable without a live project. */
class FakeAdmin implements SupabaseAdmin {
  created: string[] = [];
  deleted: string[] = [];
  failNext = false;

  async createUser({ email }: { email: string }): Promise<{ id: string }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated Supabase failure");
    }
    const { rows } = await pool.query(
      `insert into auth.users (id, email, raw_app_meta_data)
       values (gen_random_uuid(), $1, '{"role":"student"}'::jsonb) returning id`,
      [email],
    );
    this.created.push(rows[0].id);
    return { id: rows[0].id };
  }

  async deleteUser(id: string): Promise<void> {
    this.deleted.push(id);
    await pool.query("delete from auth.users where id = $1", [id]);
  }

  /**
   * Records what the credentials route asked for, so a test can assert the
   * app_metadata it sends -- which is the part that would silently strip an
   * account's staff claim if it were built wrong.
   */
  updated: Array<{
    id: string;
    email: string | undefined;
    appMetadata: Record<string, unknown> | undefined;
  }> = [];

  async updateUser(
    id: string,
    input: { email?: string; password?: string; appMetadata?: Record<string, unknown> },
  ): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated Supabase failure");
    }
    this.updated.push({ id, email: input.email, appMetadata: input.appMetadata });
    if (input.email || input.appMetadata) {
      await pool.query(
        `update auth.users
            set email = coalesce($2, email),
                raw_app_meta_data = coalesce($3::jsonb, raw_app_meta_data)
          where id = $1`,
        [id, input.email ?? null, input.appMetadata ? JSON.stringify(input.appMetadata) : null],
      );
    }
  }
}

let app: FastifyInstance;
let admin: FakeAdmin;
let teacherToken: string;
let teacherId: string;

async function resetRoster(): Promise<void> {
  await resetAll();
  const { rows } = await setup(
    `with s as (insert into sections (code, term) values ('BSCPE-2A','2026-1') returning id),
          t as (insert into auth.users (id,email,raw_app_meta_data)
                values (gen_random_uuid(),'t@octa-test.local','{"role":"teacher"}'::jsonb) returning id),
          p as (insert into profiles (id, full_name, section_id, role)
                select (select id from t),'Instructor',(select id from s),'teacher'::user_role returning id)
     insert into student_directory (student_id, full_name, section_id, status)
     select '21-0001','Student A',(select id from s),'unclaimed'::claim_status
     union all select '21-0002','Student B',(select id from s),'unclaimed'::claim_status
     union all select '21-0003','Student C',(select id from s),'claimed'::claim_status
     returning (select id from t) as tid`,
  );
  teacherId = rows[0].tid;
  teacherToken = mintToken(teacherId, "teacher");
}

beforeAll(async () => {
  await resetRoster();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:15432/octa",
    EXAM_SALT_SECRET: "x".repeat(40),
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ENGINE_VERSION: "1.0.0",
  } as NodeJS.ProcessEnv);

  app = await buildServer(env);
  admin = new FakeAdmin();
  registerAuthRoutes(app, env, admin);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await closePool();
});

describe("POST /auth/register — roster gated", () => {
  it("registers a student who is on the roster and unclaimed", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/auth/register",
      payload: { studentId: "21-0001", email: "a@octa-test.local", password: "correct horse battery" },
    });
    expect(res.statusCode).toBe(201);

    const { rows } = await pool.query(
      "select status, claimed_by from student_directory where student_id = $1", ["21-0001"],
    );
    expect(rows[0].status).toBe("claimed");
    expect(rows[0].claimed_by).not.toBeNull();

    const prof = await pool.query("select role, student_id from profiles where student_id = $1", ["21-0001"]);
    expect(prof.rows[0].role).toBe("student");
  });

  it("an OFF-ROSTER id and an ALREADY-CLAIMED id fail identically", async () => {
    const offRoster = await app.inject({
      method: "POST", url: "/api/v1/auth/register",
      payload: { studentId: "99-9999", email: "x@octa-test.local", password: "correct horse battery" },
    });
    const alreadyClaimed = await app.inject({
      method: "POST", url: "/api/v1/auth/register",
      payload: { studentId: "21-0003", email: "y@octa-test.local", password: "correct horse battery" },
    });

    // This is the P1 exit criterion, and the property that matters is
    // INDISTINGUISHABILITY: same status, byte-identical body. The message may
    // mention that an ID could be unknown OR already claimed -- naming both
    // possibilities in a single fixed string reveals nothing about which one
    // occurred, and it is far better UX than a deliberately vague error.
    expect(offRoster.statusCode).toBe(alreadyClaimed.statusCode);
    expect(offRoster.body).toBe(alreadyClaimed.body);

    // What would leak is a message that resolves the ambiguity either way.
    const msg = offRoster.json().error.message as string;
    expect(msg).not.toMatch(/\bis not on\b|\bdoes not exist\b|\bunknown\b|\bno such\b/i);
    expect(msg).not.toMatch(/\bhas been claimed\b|\bis already claimed\b|\btaken by\b/i);
  });

  it("a failure after the claim leaves NO orphaned auth user and NO claimed row", async () => {
    admin.failNext = true;
    const res = await app.inject({
      method: "POST", url: "/api/v1/auth/register",
      payload: { studentId: "21-0002", email: "b@octa-test.local", password: "correct horse battery" },
    });
    expect(res.statusCode).toBe(500);

    // The directory row must be released, or that student can never register.
    const { rows } = await pool.query(
      "select status, claimed_by from student_directory where student_id = $1", ["21-0002"],
    );
    expect(rows[0].status).toBe("unclaimed");
    expect(rows[0].claimed_by).toBeNull();

    const orphans = await pool.query("select id from auth.users where email = $1", ["b@octa-test.local"]);
    expect(orphans.rows).toHaveLength(0);

    // And the student can still register afterwards.
    admin.failNext = false;
    const retry = await app.inject({
      method: "POST", url: "/api/v1/auth/register",
      payload: { studentId: "21-0002", email: "b@octa-test.local", password: "correct horse battery" },
    });
    expect(retry.statusCode).toBe(201);
  });

  it("a student cannot register themselves as staff", async () => {
    // The role is set server-side from a literal, never from the request body.
    const res = await app.inject({
      method: "POST", url: "/api/v1/auth/register",
      payload: {
        studentId: "21-0003", email: "z@octa-test.local",
        password: "correct horse battery", role: "admin",
      },
    });
    expect(res.statusCode).toBe(403);
    const staff = await pool.query("select count(*)::int n from profiles where role <> 'student' and student_id is not null");
    expect(staff.rows[0].n).toBe(0);
  });

  it("rejects a weak password before touching the roster", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/auth/register",
      payload: { studentId: "21-0001", email: "q@octa-test.local", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/resolve — non-enumerating", () => {
  it("resolves a known student ID to an email", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/auth/resolve", payload: { identifier: "21-0001" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe("a@octa-test.local");
  });

  it("passes an email straight through without a lookup", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/auth/resolve", payload: { identifier: "someone@example.com" },
    });
    expect(res.json().email).toBe("someone@example.com");
  });

  it("an unknown ID returns the SAME message a wrong password would", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/auth/resolve", payload: { identifier: "99-9999" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe("Check your ID and password.");
  });
});

describe("POST /console/roster/import", () => {
  it("refuses a student token", async () => {
    const studentToken = mintToken(teacherId, "student");
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/roster/import",
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { sectionCode: "BSCPE-2B", rows: [{ studentId: "22-0001", fullName: "New" }] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("DRY RUNS by default and changes nothing", async () => {
    const before = await pool.query("select count(*)::int n from student_directory");
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/roster/import",
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        sectionCode: "BSCPE-2B",
        rows: [{ studentId: "22-0001", fullName: "New Student" }, { studentId: "21-0001", fullName: "Student A" }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().dryRun).toBe(true);
    expect(res.json().summary).toEqual({ insert: 1, update: 0, skipped: 1 });

    const after = await pool.query("select count(*)::int n from student_directory");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("applies when asked, skips claimed rows, and writes audit_log", async () => {
    const res = await app.inject({
      method: "POST", url: "/api/v1/console/roster/import",
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        sectionCode: "BSCPE-2B",
        rows: [{ studentId: "22-0001", fullName: "New Student" }, { studentId: "21-0001", fullName: "RENAMED" }],
        apply: true,
      },
    });
    expect(res.json().dryRun).toBe(false);

    const added = await pool.query("select full_name from student_directory where student_id = $1", ["22-0001"]);
    expect(added.rows[0].full_name).toBe("New Student");

    // 21-0001 is claimed, so the import must NOT rewrite it.
    const claimed = await pool.query("select full_name from student_directory where student_id = $1", ["21-0001"]);
    expect(claimed.rows[0].full_name).toBe("Student A");

    const audit = await pool.query("select action, payload from audit_log where action = 'roster.import'");
    expect(audit.rows.length).toBeGreaterThan(0);
  });
});

/**
 * CHANGING YOUR OWN CREDENTIALS, AND CLEARING THE BOOTSTRAP FLAG.
 *
 * `bootstrap-admin.mjs` creates the first staff account with a temporary
 * password printed to a terminal. That password has been SEEN — scrolled back
 * to, copied, possibly screenshotted — so it is not a secret, and
 * `app_metadata.must_change_credentials` marks the account until it is replaced.
 *
 * This route is the only thing that clears the flag. Led by the denial tests,
 * because the interesting questions are who may call it and whose account it can
 * touch — not whether the happy path works.
 */
describe("POST /console/account/credentials", () => {
  const strong = "a-much-longer-password-1";

  it("DENIES a student", async () => {
    const studentToken = mintToken(teacherId, "student");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/account/credentials",
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { email: "sneaky@example.com", password: strong },
    });
    expect(res.statusCode).toBe(403);
  });

  it("DENIES an anonymous caller", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/account/credentials",
      payload: { email: "nobody@example.com", password: strong },
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it("refuses a short password — the bootstrap one was already visible", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/account/credentials",
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { email: "fine@example.com", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });

  /*
   * The bootstrap defaults are committed to the repo and printed to a terminal,
   * so they are public. Length alone did not stop them being re-submitted here:
   * "OctaTemp-2026-change-me" is 23 characters and sailed past `min(12)`, which
   * meant an admin could "change" their credentials to the exact defaults,
   * clear `must_change_credentials`, and leave the only staff account on a
   * password anyone can read in `deploy/render-api.env.example`.
   */
  it("DENIES the default password — it is in the repo, so length is no defence", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/account/credentials",
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { email: "real@example.com", password: "OctaTemp-2026-change-me" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/default/i);
  });

  it("DENIES the default email, so the address cannot survive the change either", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/account/credentials",
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { email: "admin@octa.local", password: strong },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/default/i);
  });

  it("matches the default case-insensitively, since email case is not meaningful", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/account/credentials",
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { email: "ADMIN@Octa.Local", password: strong },
    });
    expect(res.statusCode).toBe(400);
  });

  it("requires BOTH an email and a password", async () => {
    for (const payload of [{ email: "only@example.com" }, { password: strong }]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/console/account/credentials",
        headers: { authorization: `Bearer ${teacherToken}` },
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it("changes both, clears the flag, and KEEPS the staff role", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/console/account/credentials",
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { email: "newadmin@example.com", password: strong },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reauthRequired).toBe(true);

    const sent = admin.updated.at(-1)!;
    expect(sent.id, "it must only ever touch the caller's own account").toBe(teacherId);
    expect(sent.email).toBe("newadmin@example.com");
    /*
     * The one that would be a real incident. A PUT to app_metadata REPLACES it,
     * so an implementation that sent only the flag would strip the account's own
     * staff claim and lock it out on the next sign-in.
     */
    expect(sent.appMetadata).toMatchObject({ must_change_credentials: false });
    expect(sent.appMetadata!.role, "the staff role must be re-asserted").toBeTruthy();
  });

  it("records the change without ever recording the password", async () => {
    const audit = await pool.query(
      "select payload from audit_log where action = 'account.credentials' order by at desc limit 1",
    );
    expect(audit.rowCount).toBe(1);
    const p = JSON.stringify(audit.rows[0]!.payload);
    expect(p).toContain("newadmin@example.com");
    expect(p, "the password must never reach the audit log").not.toContain(strong);
  });
});
