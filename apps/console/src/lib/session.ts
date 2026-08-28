import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Session and role, for the console.
 *
 * THE ROLE COMES FROM THE JWT, NEVER FROM `profiles`.
 *
 * `apps/console/CLAUDE.md`: *"Route guards read role from JWT `app_metadata`,
 * never from `profiles.role`. A student who edits their profiles row must still
 * be blocked."* `profiles.role` is a mirror maintained for joins and display;
 * the JWT is authoritative, which is also exactly what `jwt_role()` reads inside
 * every RLS policy. Reading the two from different places is how a client and
 * its database come to disagree about who someone is.
 *
 * This guard is a CONVENIENCE, not a control. It decides what to render. Every
 * console route on the server calls `requireStaff()` independently, so a student
 * who forges their way past this UI still gets 403 from the API and denied by
 * RLS underneath it. If this file were deleted the system would still be secure;
 * it would just be ruder.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  client ??= createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export type Role = "student" | "teacher" | "admin";

export interface Identity {
  userId: string;
  role: Role;
  email: string | null;
  fullName: string | null;
}

/**
 * Read `app_metadata.role` out of a JWT payload.
 *
 * Mirrors `jwt_role()` in db/schema.sql, including its failure mode: an unknown,
 * missing or malformed claim maps to LEAST PRIVILEGE rather than raising. V-25
 * is the finding that made that non-negotiable — a malformed claim used to lock
 * a user out of every table, and the mirror image (a malformed claim granting
 * staff) is the version that matters here.
 */
export function roleFromClaims(claims: unknown): Role {
  const meta = (claims as { app_metadata?: { role?: unknown } } | null)?.app_metadata;
  const raw = typeof meta?.role === "string" ? meta.role : "";
  return raw === "admin" ? "admin" : raw === "teacher" ? "teacher" : "student";
}

/** `teacher` and `admin` are deliberately equivalent in this deployment (D4). */
export function isStaff(role: Role): boolean {
  return role === "teacher" || role === "admin";
}

/**
 * Decode a JWT payload WITHOUT verifying it.
 *
 * Safe here and nowhere else. The browser cannot verify a signature it does not
 * hold a key for, and pretending otherwise would be theatre. Verification is
 * `services/api/src/jwks.ts`, against Supabase's JWKS, on every request. This
 * function only decides which nav links to draw.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const c = supabase();
  if (!c) {
    try {
      return localStorage.getItem("octa:dev-token");
    } catch {
      return null;
    }
  }
  const { data } = await c.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getIdentity(): Promise<Identity | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const claims = decodeJwtPayload(token);
  if (!claims) return null;
  const meta = claims.user_metadata as { full_name?: string } | undefined;
  return {
    userId: typeof claims.sub === "string" ? claims.sub : "",
    role: roleFromClaims(claims),
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: meta?.full_name ?? null,
  };
}

export type SignInResult = { ok: true } | { ok: false; message: string };

/**
 * Sign a staff member in.
 *
 * **Email and password, never a student ID.** A student ID identifies someone
 * on the roster; staff are not on it, and offering that field here would invite
 * a teacher to type a number that can never work.
 *
 * ONE FAILURE MESSAGE, for every cause.
 *
 * A wrong password, an address with no account, and a disabled account all
 * return the same sentence. `services/api` already does this for the student
 * path -- "Auth failures use ONE generic message for unknown-user and
 * wrong-password alike -- no enumeration" (`services/api/CLAUDE.md`) -- and
 * distinguishing them here would rebuild the oracle that rule exists to close,
 * on the app that holds the answer keys.
 *
 * Signing in does NOT make anyone staff. It establishes who they are; the JWT's
 * `app_metadata.role` decides what they see, `requireStaff()` decides what the
 * server answers, and RLS decides what the database returns. A student who
 * signs in here reaches the "this is a student account" screen and nothing else.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const c = supabase();
  if (!c) {
    // Not a credential failure -- a build that shipped without its Supabase
    // variables. Saying so plainly saves an hour of retyping a correct password.
    return {
      ok: false,
      message:
        "This console was built without its Supabase settings, so it cannot sign anyone in. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing.",
    };
  }
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, message: "That email and password did not match an account." };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const c = supabase();
  if (c) await c.auth.signOut();
  try {
    localStorage.removeItem("octa:dev-token");
  } catch {
    /* private window */
  }
}

/** Theme, shared with apps/web. The accent is a HUE, never a stored hex. */
export type Theme = "bare-metal" | "blueprint" | "phosphor";

export function applyStoredTheme(): void {
  try {
    const theme = (localStorage.getItem("octa:theme") as Theme | null) ?? "bare-metal";
    const hue = Number(localStorage.getItem("octa:accent-hue") ?? "250");
    setTheme(theme);
    document.documentElement.style.setProperty(
      "--accent-hue",
      String(Number.isFinite(hue) ? Math.max(0, Math.min(359, hue)) : 250),
    );
  } catch {
    /* private window: the stylesheet defaults already apply */
  }
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("octa:theme", theme);
  } catch {
    /* not persistable here */
  }
}
