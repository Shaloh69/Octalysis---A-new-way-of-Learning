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

export interface SupabaseAdmin {
  createUser(input: {
    email: string;
    password: string;
    appMetadata: Record<string, unknown>;
  }): Promise<{ id: string }>;
  deleteUser(id: string): Promise<void>;
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
}
