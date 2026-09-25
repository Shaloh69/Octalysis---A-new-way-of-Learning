import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { errors } from "./errors.js";
import type { Env } from "./env.js";
import { verifyAsymmetricJwt } from "./jwks.js";

/**
 * Request identity.
 *
 * Role comes from the JWT's `app_metadata`, NEVER from `profiles.role`. A
 * student who edits their profiles row must still be blocked -- which is why
 * `profiles.role` is documented as a mirror and the JWT is authoritative.
 */

export type Role = "student" | "teacher" | "admin";

export interface Identity {
  readonly userId: string;
  readonly role: Role;
  readonly studentId: string | null;
  readonly email: string | null;
}

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  aud?: string | string[];
  app_metadata?: { role?: string; student_id?: string };
}

const b64urlToBuf = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * Verify an HS256 Supabase access token.
 *
 * Signature first, then expiry, then audience. Any failure produces the SAME
 * generic message: a token that says *why* it was rejected is an oracle.
 */
export function verifyJwt(token: string, env: Env): JwtPayload {
  if (!env.SUPABASE_JWT_SECRET) {
    throw errors.internal("SUPABASE_JWT_SECRET is not configured");
  }

  const parts = token.split(".");
  if (parts.length !== 3) throw errors.unauthorized("Your session is not valid. Sign in again.");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let header: { alg?: string };
  try {
    header = JSON.parse(b64urlToBuf(headerB64).toString("utf8"));
  } catch {
    throw errors.unauthorized("Your session is not valid. Sign in again.");
  }
  if (header.alg !== "HS256") {
    throw errors.unauthorized("Your session is not valid. Sign in again.");
  }

  const expected = createHmac("sha256", env.SUPABASE_JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const got = b64urlToBuf(signatureB64);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    throw errors.unauthorized("Your session is not valid. Sign in again.");
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(b64urlToBuf(payloadB64).toString("utf8"));
  } catch {
    throw errors.unauthorized("Your session is not valid. Sign in again.");
  }

  if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) {
    throw errors.unauthorized("Your session has expired. Sign in again.");
  }

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (env.JWT_AUDIENCE && !aud.includes(env.JWT_AUDIENCE)) {
    throw errors.unauthorized("Your session is not valid. Sign in again.");
  }

  return payload;
}

/** Map an unknown role claim to least privilege rather than raising (V-25). */
function normaliseRole(claim: unknown): Role {
  return claim === "admin" ? "admin" : claim === "teacher" ? "teacher" : "student";
}

/**
 * Resolve the caller's identity from the Authorization header.
 *
 * TWO VERIFICATION PATHS, and the asymmetric one is the real one.
 *
 * Supabase's current key format (`sb_publishable_` / `sb_secret_`) signs access
 * tokens with **ES256** against a JWKS endpoint. Verified against this project's
 * live tokens:
 *
 *     {"alg":"ES256","kid":"78bb5bf6-...","typ":"JWT"}
 *
 * The HS256 path below is LEGACY. It survives only because the test suite mints
 * its own HS256 tokens, and keeping it lets those tests run without reaching the
 * network. If `SUPABASE_URL` is configured, asymmetric verification is used and
 * HS256 is never consulted -- which is the correct precedence, because otherwise
 * a leaked shared secret would forge tokens the real system would never issue.
 */
export async function identityFrom(req: FastifyRequest, env: Env): Promise<Identity> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw errors.unauthorized("Sign in to continue.");
  }
  const token = header.slice(7).trim();

  let payload: JwtPayload;

  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    try {
      payload = await verifyAsymmetricJwt(token, {
        supabaseUrl: env.SUPABASE_URL,
        apikey: env.SUPABASE_ANON_KEY,
        ...(env.JWT_AUDIENCE ? { audience: env.JWT_AUDIENCE } : {}),
      });
    } catch (err) {
      req.log.info({ err: (err as Error).message }, "jwt rejected");
      // One generic message. A token that says WHY it was rejected is an oracle.
      throw errors.unauthorized("Your session is not valid. Sign in again.");
    }
  } else {
    payload = verifyJwt(token, env);
  }

  if (!payload.sub) throw errors.unauthorized("Your session is not valid. Sign in again.");

  const role = normaliseRole(payload.app_metadata?.role);

  /*
   * A DEACTIVATED STUDENT IS REFUSED HERE, on every route (V-20, instructor
   * ruling 25 Sep 2026). `/auth/resolve` already refuses them sign-in by
   * student ID, but the student app sends anything containing `@` straight to
   * Supabase, so a deactivated student could still sign in with their email
   * and hold a perfectly valid token. The token is not the question; the
   * roster is. The student app reads nothing except through this API, so this
   * one check is the whole lock-out. A primary-key lookup, students only.
   */
  if (role === "student") {
    const { rows } = await req.server.db.query<{ off: boolean }>(
      "select deleted_at is not null as off from profiles where id = $1",
      [payload.sub],
    );
    if (rows[0]?.off) {
      throw errors.forbidden("This account has been deactivated. Ask your instructor.");
    }
  }

  return {
    userId: payload.sub,
    role,
    studentId: payload.app_metadata?.student_id ?? null,
    email: payload.email ?? null,
  };
}

export const isStaff = (id: Identity): boolean => id.role === "teacher" || id.role === "admin";

export function requireStaff(id: Identity): void {
  if (!isStaff(id)) throw errors.forbidden("That is a teacher-only area.");
}

/**
 * Ownership check for anything scoped to one student.
 *
 * The API bypasses RLS, so this is the ONLY thing standing between student B
 * and student A's attempt on these routes. Staff may read any student's work;
 * that is the console drill-down.
 */
export function requireOwnerOrStaff(id: Identity, ownerUserId: string): void {
  if (id.userId === ownerUserId) return;
  if (isStaff(id)) return;
  // Deliberately "not found", not "forbidden": confirming the row exists would
  // let one student probe for another's attempt ids.
  throw errors.notFound("That does not exist, or you cannot see it.");
}
