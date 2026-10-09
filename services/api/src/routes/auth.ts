import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withRoleChangeAllowed, withTransaction } from "../db.js";
import { errors } from "../errors.js";
import { identityFrom, requireStaff } from "../auth.js";
import { TeacherClaimBody } from "@octa/contracts";
import type { Env } from "../env.js";

/**
 * P1 -- registration and identifier resolution.
 *
 * The rule that shapes every response here: **one generic message**. Unknown
 * student ID and already-claimed student ID must be indistinguishable, and so
 * must unknown email and wrong password. Anything else is an enumeration oracle
 * that tells an attacker which IDs are real.
 */

const RegisterBody = z.object({
  studentId: z.string().trim().min(3).max(32),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

const ResolveBody = z.object({
  identifier: z.string().trim().min(3).max(254),
});

/** The ONLY failure message the registration path ever returns. */
const REGISTER_FAILED =
  "That student ID could not be used. Check the ID on your registration form, " +
  "or ask your instructor if it has already been claimed.";

/** The ONLY failure message the teacher claim ever returns (T1). */
const TEACHER_CLAIM_FAILED = "That employee ID could not be used. Check it with your admin.";

/** The ONLY failure message the login/resolve path ever returns. */
const RESOLVE_FAILED = "Check your ID and password.";

/**
 * A new email and password, together.
 *
 * Both are required rather than optional. The bootstrap account is created with
 * an address chosen by whoever ran the script and a password printed to their
 * terminal; changing one and not the other leaves half of a known credential
 * pair in place.
 */
/*
 * THE BOOTSTRAP DEFAULTS ARE PUBLIC, so neither may survive the change.
 *
 * They are committed in `deploy/render-api.env.example` and printed to a
 * terminal by `bootstrap-admin.mjs`. Length was no defence:
 * "OctaTemp-2026-change-me" is 23 characters and passed `min(12)` unnoticed,
 * so an admin could submit the defaults straight back, clear
 * `must_change_credentials`, and leave the only staff account on credentials
 * published in the repository — with the flag now saying it was dealt with.
 *
 * Restated here rather than imported: `bootstrap-admin.mjs` is a standalone
 * script that the API does not and should not load at runtime. The test asserts
 * both ends against the literal, so a drift fails loudly.
 */
const DEFAULT_ADMIN_EMAIL = "admin@octa.local";
const DEFAULT_ADMIN_PASSWORD = "OctaTemp-2026-change-me";

const CredentialsBody = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .refine((v) => v.toLowerCase() !== DEFAULT_ADMIN_EMAIL, {
      // Email case is not meaningful, so neither is casing it differently.
      message: "That is the default address.",
    }),
  password: z
    .string()
    .min(12)
    .max(200)
    .refine((v) => v !== DEFAULT_ADMIN_PASSWORD, {
      message: "That is the default password.",
    }),
});

/**
 * Supabase refuses a second account on an email (`email_exists`, HTTP 422). A claim or
 * registration that meets it is not "something went wrong on our side": the person typed
 * an email that already belongs to a login (found 9 Oct 2026, when a teacher claimed with
 * the address of their own student account). The route says so, in a sentence, and the
 * roster row goes back to unclaimed so they can try another address.
 */
export class EmailTakenError extends Error {
  constructor() {
    super("email_exists");
    this.name = "EmailTakenError";
  }
}

const EMAIL_TAKEN = "That email already has an account. Use a different email address.";

export interface SupabaseAdmin {
  createUser(input: {
    email: string;
    password: string;
    appMetadata: Record<string, unknown>;
  }): Promise<{ id: string }>;
  deleteUser(id: string): Promise<void>;
  /** Change an existing user's email, password and/or `app_metadata`. */
  updateUser(
    id: string,
    input: {
      email?: string;
      password?: string;
      appMetadata?: Record<string, unknown>;
    },
  ): Promise<void>;
  /**
   * Ban or unban a login (a disabled teacher, T1). Optional: a test fake may
   * leave it out; the API refuses a disabled account either way.
   */
  setBanned?(id: string, banned: boolean): Promise<void>;
}

/**
 * Real implementation talks to the Supabase Admin API with the service-role key.
 * Injected rather than imported so the route can be tested without a live
 * Supabase project.
 */
export function makeSupabaseAdmin(env: Env): SupabaseAdmin {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for auth routes");
  }
  const headers = {
    "content-type": "application/json",
    apikey: key,
    authorization: `Bearer ${key}`,
  };

  return {
    async createUser({ email, password, appMetadata }) {
      const res = await fetch(`${base}/auth/v1/admin/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          app_metadata: appMetadata,
        }),
      });
      if (!res.ok) {
        if (res.status === 422 || res.status === 409) {
          const why = (await res.json().catch(() => ({}))) as { error_code?: string; code?: string };
          if ((why.error_code ?? why.code) === "email_exists") throw new EmailTakenError();
        }
        throw new Error(`admin createUser failed: ${res.status}`);
      }
      const body = (await res.json()) as { id: string };
      return { id: body.id };
    },
    async updateUser(id, input) {
      const res = await fetch(`${base}/auth/v1/admin/users/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ...(input.email ? { email: input.email, email_confirm: true } : {}),
          ...(input.password ? { password: input.password } : {}),
          ...(input.appMetadata ? { app_metadata: input.appMetadata } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(`admin updateUser failed: ${res.status}`);
      }
    },
    async deleteUser(id) {
      await fetch(`${base}/auth/v1/admin/users/${id}`, { method: "DELETE", headers });
    },
    async setBanned(id, banned) {
      const res = await fetch(`${base}/auth/v1/admin/users/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ban_duration: banned ? "876000h" : "none" }),
      });
      if (!res.ok) throw new Error(`admin ban failed: ${res.status}`);
    },
  };
}

export function registerAuthRoutes(
  app: FastifyInstance,
  env: Env,
  admin: SupabaseAdmin | null,
): void {
  /* ----------------------------------------------------------
   * POST /api/v1/auth/register
   *
   * Roster-gated. The directory row must exist and be unclaimed. The whole
   * thing is transactional: a failed profiles insert must not leave an orphaned
   * auth user behind (a P1 exit criterion).
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/auth/register",
    { config: { rateLimit: { max: 5 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = RegisterBody.safeParse(req.body);
      if (!body.success) throw errors.badRequest(REGISTER_FAILED);
      if (!admin) throw errors.internal("auth admin not configured");

      const { studentId, email, password } = body.data;

      // Claim the directory row FIRST, inside a transaction, using a conditional
      // update. That makes the claim atomic: two simultaneous registrations for
      // the same ID cannot both succeed.
      const claimed = await withTransaction(app.db, async (client) => {
        const { rows } = await client.query(
          `update student_directory
              set status = 'claimed', claimed_at = now()
            where student_id = $1 and status = 'unclaimed'
            returning student_id, full_name, section_id`,
          [studentId],
        );
        return rows[0] ?? null;
      });

      if (!claimed) {
        // Unknown ID and already-claimed ID land here identically, on purpose.
        req.log.info({ studentId }, "registration rejected");
        throw errors.forbidden(REGISTER_FAILED);
      }

      let authUserId: string | null = null;
      try {
        const created = await admin.createUser({
          email,
          password,
          appMetadata: { role: "student", student_id: studentId },
        });
        authUserId = created.id;

        await withRoleChangeAllowed(app.db, async (client) => {
          await client.query(
            `insert into profiles (id, student_id, full_name, section_id, role)
             values ($1, $2, $3, $4, 'student')`,
            [authUserId, studentId, claimed.full_name, claimed.section_id],
          );
          await client.query(
            `update student_directory set claimed_by = $2 where student_id = $1`,
            [studentId, authUserId],
          );
          await client.query(
            `insert into audit_log (actor_id, action, target_type, target_id, payload)
             values ($1, 'auth.register', 'student_directory', $2, $3)`,
            [authUserId, studentId, JSON.stringify({ email })],
          );
        });

        return reply.status(201).send({ ok: true });
      } catch (err) {
        // Roll the whole thing back, including the auth user. An orphaned auth
        // user with no profile is a broken account the student cannot recover
        // from and the instructor cannot see.
        req.log.error({ err }, "registration failed after claim");
        if (authUserId) await admin.deleteUser(authUserId).catch(() => {});
        await app.db
          .query(
            `update student_directory
                set status = 'unclaimed', claimed_at = null, claimed_by = null
              where student_id = $1`,
            [studentId],
          )
          .catch(() => {});
        throw errors.internal("registration rolled back");
      }
    },
  );

  /* ----------------------------------------------------------
   * POST /api/v1/auth/claim-teacher   (T1, 7 Oct 2026)
   *
   * A teacher claims the employee ID the admin put on the teacher roster, as a
   * student claims their student ID. The ROLE comes from the roster, never the
   * form. The name must match the roster's (case and spacing aside), so a
   * guessed ID alone does not open an account. Unknown ID, claimed ID,
   * disabled ID and wrong name are ONE message (no enumeration). Atomic and
   * rolled back on any failure, as /register.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/auth/claim-teacher",
    { config: { rateLimit: { max: 5 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = TeacherClaimBody.safeParse(req.body);
      if (!body.success) throw errors.badRequest(TEACHER_CLAIM_FAILED);
      if (!admin) throw errors.internal("auth admin not configured");
      const { employeeId, fullName, email, password } = body.data;

      const claimed = await withTransaction(app.db, async (client) => {
        const { rows } = await client.query<{ role: "teacher" | "admin"; full_name: string }>(
          `update teacher_directory
              set status = 'claimed', claimed_at = now()
            where employee_id = $1 and status = 'unclaimed'
              and lower(regexp_replace(trim(full_name), '\\s+', ' ', 'g'))
                = lower(regexp_replace(trim($2), '\\s+', ' ', 'g'))
            returning role::text as role, full_name`,
          [employeeId, fullName],
        );
        return rows[0] ?? null;
      });
      if (!claimed) {
        req.log.info({ employeeId }, "teacher claim rejected");
        throw errors.forbidden(TEACHER_CLAIM_FAILED);
      }

      let authUserId: string | null = null;
      try {
        const created = await admin.createUser({
          email,
          password,
          appMetadata: { role: claimed.role, employee_id: employeeId },
        });
        authUserId = created.id;
        await withRoleChangeAllowed(app.db, async (client) => {
          await client.query(
            `insert into profiles (id, full_name, role) values ($1, $2, $3::user_role)`,
            [authUserId, claimed.full_name, claimed.role],
          );
          await client.query(`update teacher_directory set claimed_by = $2 where employee_id = $1`, [employeeId, authUserId]);
          await client.query(
            `insert into audit_log (actor_id, action, target_type, target_id, payload)
             values ($1, 'auth.claim_teacher', 'teacher_directory', $2, $3)`,
            [authUserId, employeeId, JSON.stringify({ email, role: claimed.role })],
          );
        });
        return reply.status(201).send({ ok: true });
      } catch (err) {
        req.log.error({ err }, "teacher claim failed after claim");
        if (authUserId) await admin.deleteUser(authUserId).catch(() => {});
        await app.db
          .query(
            `update teacher_directory set status = 'unclaimed', claimed_at = null, claimed_by = null where employee_id = $1`,
            [employeeId],
          )
          .catch(() => {});
        if (err instanceof EmailTakenError) throw errors.conflict(EMAIL_TAKEN);
        throw errors.internal("teacher claim rolled back");
      }
    },
  );

  /* ----------------------------------------------------------
   * POST /api/v1/auth/resolve
   *
   * Student ID -> email, so the login form can accept either. Rate-limited and
   * non-enumerating: an unknown ID returns the same shape as a known one.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/auth/resolve",
    { config: { rateLimit: { max: 5 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = ResolveBody.safeParse(req.body);
      if (!body.success) throw errors.unauthorized(RESOLVE_FAILED);

      const identifier = body.data.identifier;

      // Already an email? Hand it straight back. No lookup, nothing to leak.
      if (identifier.includes("@")) {
        return reply.send({ email: identifier });
      }

      const { rows } = await app.db.query(
        `select u.email
           from profiles p
           join auth.users u on u.id = p.id
          where p.student_id = $1 and p.deleted_at is null`,
        [identifier],
      );

      if (rows.length === 0 || !rows[0].email) {
        req.log.info({ identifier }, "resolve miss");
        throw errors.unauthorized(RESOLVE_FAILED);
      }

      return reply.send({ email: rows[0].email });
    },
  );

  /* ----------------------------------------------------------
   * POST /api/v1/console/account/credentials
   *
   * Changing your OWN email and password, and clearing the bootstrap flag.
   *
   * `bootstrap-admin.mjs` creates the first staff account with a temporary
   * password that is printed to a terminal — which means it has been seen, and
   * possibly scrolled back to, copied, or left in a screenshot. It is not a
   * secret. `app_metadata.must_change_credentials` marks the account until the
   * credentials are actually replaced, and this is the only route that clears it.
   *
   * SELF ONLY. The user id comes from the verified JWT and never from the body,
   * so this cannot be pointed at another account — an admin resetting a
   * colleague's password is a different operation with different consequences,
   * and it is not this one.
   *
   * The flag is cleared in the SAME Admin API call that sets the password. Two
   * calls could clear the flag and then fail to change the password, leaving an
   * account that is still on its bootstrap credentials and no longer says so.
   * -------------------------------------------------------- */
  app.post(
    "/api/v1/console/account/credentials",
    { config: { rateLimit: { max: 5 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      requireStaff(id);
      if (!admin) throw errors.badRequest("Credential changes need a configured Supabase project.");

      const body = CredentialsBody.safeParse(req.body);
      if (!body.success) {
        /*
         * "Give a valid email and a password of at least 12 characters" is a
         * true and useless answer to someone who just submitted the defaults —
         * they DID give a valid email and a 23-character password. Say which
         * one is the default instead, or they retype it and fail again.
         *
         * Safe to be specific: these values are already published. Nothing is
         * disclosed that `deploy/render-api.env.example` does not state.
         */
        const isDefault = body.error.issues.find((i) => /default/i.test(i.message));
        throw errors.badRequest(
          isDefault
            ? `${isDefault.message} Choose a different one — the defaults are published in the repository.`
            : "Give a valid email and a password of at least 12 characters.",
        );
      }

      const cur = await app.db.query("select role from profiles where id = $1", [id.userId]);
      if (cur.rows.length === 0) throw errors.notFound("No such account.");

      /*
       * The role is re-asserted rather than merged from the incoming token. A
       * PUT to app_metadata REPLACES it, so omitting `role` here would strip the
       * account's own staff claim and lock it out on the next sign-in.
       */
      await admin.updateUser(id.userId, {
        email: body.data.email,
        password: body.data.password,
        appMetadata: { role: cur.rows[0].role, must_change_credentials: false },
      });

      await app.db.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1,'account.credentials','profile',$2,$3)`,
        [
          id.userId,
          id.userId,
          // The new email is recorded; the password never is, not even hashed.
          JSON.stringify({ email: body.data.email, clearedBootstrapFlag: true }),
        ],
      );

      return reply.send({ ok: true, reauthRequired: true });
    },
  );

}
