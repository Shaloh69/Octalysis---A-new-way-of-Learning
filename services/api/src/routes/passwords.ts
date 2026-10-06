import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identityFrom, isStaff, requireStaff } from "../auth.js";
import { AppError, errors } from "../errors.js";
import type { Env } from "../env.js";
import type { SupabaseAdmin } from "./auth.js";

/**
 * Passwords a student cannot reset for themself (instructor ruling, 6 Oct
 * 2026: "both, the console tool first"). Until now the only way was the
 * Supabase dashboard.
 *
 *   POST /api/v1/console/students/:userId/password   staff: a temporary password
 *   POST /api/v1/account/password                    the student: their own, new one
 *
 * The temporary password is generated HERE, returned ONCE in the response for
 * the instructor to hand over, and never stored, logged or audited (the audit
 * row records who, whom and why). It marks the account
 * `app_metadata.must_change_password`, so the student app asks for a new one
 * before anything else; the student's own change clears it.
 *
 * Both are mounted with or without Supabase: on a server with no project (the
 * local stack, where accounts have no passwords) they say so instead of 404.
 */

/** No 0/O, 1/I/L: it is read off a screen and typed by someone else. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function temporaryPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

const ResetParams = z.object({ userId: z.string().uuid() });
const ResetBody = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
/** The same floor as registration (RegisterBody: 10). */
const OwnBody = z.object({ password: z.string().min(10).max(128) }).strict();

const noProject = () =>
  new AppError("conflict", "Passwords are managed by the deployment's Supabase project; this server has none.");

export function registerPasswordRoutes(app: FastifyInstance, env: Env, admin: SupabaseAdmin | null): void {
  app.post(
    "/api/v1/console/students/:userId/password",
    { config: { rateLimit: { max: 10 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      requireStaff(id);
      const params = ResetParams.safeParse(req.params);
      if (!params.success) throw errors.notFound("No such student.");
      const body = ResetBody.safeParse(req.body);
      if (!body.success) throw errors.badRequest("Say why, in a few words.");

      const { rows } = await app.db.query(
        `select p.student_id, p.full_name from profiles p
          where p.id = $1 and p.role = 'student' and p.deleted_at is null and p.student_id is not null`,
        [params.data.userId],
      );
      const student = rows[0];
      if (!student) throw errors.notFound("No such student, or the account is deactivated.");
      if (!admin) throw noProject();

      const password = temporaryPassword();
      // app_metadata is REPLACED, not merged: re-assert role and student_id, or
      // the student would lose both on their next sign-in.
      await admin.updateUser(params.data.userId, {
        password,
        appMetadata: { role: "student", student_id: student.student_id, must_change_password: true },
      });
      await app.db.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'roster.password_reset', 'student', $2, $3)`,
        // The password is never recorded, not even hashed.
        [id.userId, student.student_id, JSON.stringify({ reason: body.data.reason, fullName: student.full_name })],
      );
      return reply.send({ temporaryPassword: password, studentId: student.student_id, fullName: student.full_name });
    },
  );

  app.post(
    "/api/v1/account/password",
    { config: { rateLimit: { max: 5 * app.limitScale, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = await identityFrom(req, env);
      // SELF ONLY: the account is the verified token's, never the body's.
      if (isStaff(id)) throw errors.forbidden("Staff change their credentials on the console.");
      const body = OwnBody.safeParse(req.body);
      if (!body.success) throw errors.badRequest("Choose a password of at least 10 characters.");
      if (!id.studentId) throw errors.forbidden("Your account is not linked to a student ID.");
      if (!admin) throw noProject();
      await admin.updateUser(id.userId, {
        password: body.data.password,
        appMetadata: { role: "student", student_id: id.studentId, must_change_password: false },
      });
      await app.db.query(
        `insert into audit_log (actor_id, action, target_type, target_id, payload)
         values ($1, 'account.password', 'student', $2, '{}')`,
        [id.userId, id.studentId],
      );
      // The token in hand still carries the old flag: sign in again.
      return reply.send({ ok: true, reauthRequired: true });
    },
  );
}
