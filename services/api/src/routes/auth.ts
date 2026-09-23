import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withRoleChangeAllowed, withTransaction } from "../db.js";
import { errors } from "../errors.js";
import { identityFrom, requireStaff } from "../auth.js";
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
   * POST /api/v1/console/roster/import   (staff only, dry-run by default)
   * -------------------------------------------------------- */
  const RosterBody = z.object({
    sectionCode: z.string().trim().min(1),
    term: z.string().trim().min(1).default("2026-1"),
    rows: z
      .array(z.object({ studentId: z.string().trim().min(1), fullName: z.string().trim().min(1) }))
      .max(500),
    apply: z.boolean().default(false),
  });

  app.post("/api/v1/console/roster/import", async (req, reply) => {
    const id = await identityFrom(req, env);
    requireStaff(id);

    const body = RosterBody.safeParse(req.body);
    if (!body.success) throw errors.badRequest("That roster could not be read.");
    const { sectionCode, term, rows, apply } = body.data;

    const existing = await app.db.query(
      `select student_id, status from student_directory where student_id = any($1)`,
      [rows.map((r) => r.studentId)],
    );
    const known = new Map(existing.rows.map((r) => [r.student_id, r.status]));

    const plan = rows.map((r) => ({
      studentId: r.studentId,
      fullName: r.fullName,
      action: known.has(r.studentId)
        ? known.get(r.studentId) === "claimed"
          ? ("skip-claimed" as const)
          : ("update" as const)
        : ("insert" as const),
    }));

    const summary = {
      insert: plan.filter((p) => p.action === "insert").length,
      update: plan.filter((p) => p.action === "update").length,
      skipped: plan.filter((p) => p.action === "skip-claimed").length,
    };

    // Dry run is the DEFAULT. A roster import that silently rewrites 40 rows
    // because someone forgot a flag is not recoverable without the audit log.
    if (!apply) {
      return reply.send({ dryRun: true, summary, plan });
    }

    await withTransaction(app.db, async (client) => {
      const { rows: sectionRows } = await client.query(
        `insert into sections (code, term) values ($1, $2)
         on conflict (code) do update set term = excluded.term
         returning id`,
        [sectionCode, term],
      );
      const sectionId = sectionRows[0]!.id;

      for (const p of plan) {
        if (p.action === "skip-claimed") continue;
        await client.query(
          `insert into student_directory (student_id, full_name, section_id, status)
           values ($1, $2, $3, 'unclaimed')
           on conflict (student_id) do update
             set full_name = excluded.full_name, section_id = excluded.section_id`,
          [p.studentId, p.fullName, sectionId],
        );
      }

      await client.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'roster.import', 'section', $2, $3)`,
        [id.userId, sectionCode, JSON.stringify(summary)],
      );
    });

    return reply.send({ dryRun: false, summary });
  });

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
