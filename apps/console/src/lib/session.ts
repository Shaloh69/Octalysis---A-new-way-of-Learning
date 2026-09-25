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
  /**
   * Set by `bootstrap-admin.mjs` on an account created with a temporary
   * password, and cleared only when the credentials are actually changed.
   */
  mustChangeCredentials: boolean;
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

/**
 * Is this account still on its bootstrap credentials?
 *
 * Read from `app_metadata`, NOT from `profiles` and never from `user_metadata`.
 * `profiles` carries a `p_update` policy letting a user edit their own row, so a
 * column there could be cleared without the password ever changing; and
 * `user_metadata` is writable through the Supabase auth API by the user
 * themselves. `app_metadata` is service-role only, which is the same reason
 * `role` lives there.
 *
 * Least privilege runs the other way here: anything missing or malformed means
 * NOT flagged, because a stuck prompt that cannot be dismissed would lock an
 * admin out of their own console.
 */
export function mustChangeFromClaims(claims: unknown): boolean {
  const meta = (claims as { app_metadata?: { must_change_credentials?: unknown } } | null)
    ?.app_metadata;
  return meta?.must_change_credentials === true;
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
    mustChangeCredentials: mustChangeFromClaims(claims),
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
  if (error) return { ok: false, message: signInFailureMessage(error) };
  return { ok: true };
}

/** The one generic sentence for every credential failure. */
export const CREDENTIALS_REJECTED = "That email and password did not match an account.";

/**
 * What to say when the auth server refuses or fails a sign-in.
 *
 * **Three sentences, and the credential one is shared by every cause.** Any
 * 4xx about the credentials -- unknown address, wrong password, disabled
 * account -- prints `CREDENTIALS_REJECTED`, so this function cannot become the
 * enumeration oracle `signIn`'s header forbids.
 *
 * The other two are not about the credentials at all, and this used to print
 * the credential sentence for them too. A teacher whose password was RIGHT,
 * on a paused project or a dropped connection, was told it was wrong and
 * retyped it forever:
 *
 * - **429**: the limit is per client, not per account, so saying so reveals
 *   nothing about who exists.
 * - **no status, 0, or 5xx**: the request never got an answer about the
 *   credentials, so it says they were not checked.
 */
export function signInFailureMessage(error: { status?: number | undefined }): string {
  const s = error.status;
  if (s === 429) {
    return "Too many sign-in attempts from here. Wait a minute, then try again.";
  }
  if (typeof s === "number" && s >= 400 && s < 500) return CREDENTIALS_REJECTED;
  return "The sign-in service did not answer, so what you typed was not checked. Try again in a minute.";
}

/* ------------------------------------------------------ password reset
 *
 * Self-service reset, approved by the instructor 25 Sep 2026. Before it, a
 * forgotten staff password meant the Supabase dashboard or re-running
 * `bootstrap-admin.mjs`. `design/templates/console/forgot-password/SPEC.md`.
 *
 * Supabase does the work: `resetPasswordForEmail` mails a one-use link, the
 * link lands on `/reset-password` carrying a recovery session, and
 * `updateUser({ password })` sets the new one. Nothing here touches
 * `app_metadata`, so a reset never clears the bootstrap flag and never
 * changes a role.
 */

type AuthFailure = { status?: number | undefined; code?: string | undefined; name?: string | undefined };

const NOT_CONFIGURED =
  "This console was built without its Supabase settings, so it cannot send a reset link. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing.";

/**
 * What to say when a reset email could not be requested -- or `null`, meaning
 * "say it was sent".
 *
 * **`null` for every 4xx that is not about the request itself.** An address
 * with no account must read exactly like one with an account, or this page
 * becomes the enumeration oracle `signIn` refuses to be. Supabase already
 * answers 200 for an unknown address; this keeps any other refusal from
 * leaking the difference.
 */
export function resetRequestFailureMessage(error: AuthFailure): string | null {
  const s = error.status;
  if (s === 429 || error.code === "over_email_send_rate_limit") {
    return "Too many reset emails have been requested. Wait a while, then try again.";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return "That is not an email address.";
  }
  if (typeof s === "number" && s >= 400 && s < 500) return null;
  return "The reset email was not sent: the service did not answer. Try again in a minute.";
}

export async function requestPasswordReset(email: string): Promise<SignInResult> {
  const c = supabase();
  if (!c) return { ok: false, message: NOT_CONFIGURED };
  const { error } = await c.auth.resetPasswordForEmail(email.trim(), {
    // Must be listed under Auth > URL Configuration > Redirect URLs, or
    // Supabase sends the link to the Site URL instead. See the route's SPEC.md.
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    const message = resetRequestFailureMessage(error);
    if (message) return { ok: false, message };
  }
  return { ok: true };
}

export const LINK_EXPIRED = "This reset link has expired or was already used. Send a new one.";

/** What to say when a new password was not saved. Never "success" by default. */
export function passwordUpdateFailureMessage(error: AuthFailure): string {
  if (error.code === "same_password") return "That is already your password. Choose a different one.";
  if (error.code === "weak_password") {
    return "The sign-in service refused that password as too weak. Choose a longer one.";
  }
  if (
    error.name === "AuthSessionMissingError" ||
    error.code === "session_not_found" ||
    error.code === "bad_jwt" ||
    error.status === 401 ||
    error.status === 403
  ) {
    return LINK_EXPIRED;
  }
  if (error.status === 429) return "Too many attempts from here. Wait a minute, then try again.";
  if (typeof error.status === "number" && error.status >= 400 && error.status < 500) {
    return "The password was not changed. Send a new link and try again.";
  }
  return "The password was not changed: the service did not answer. Try again in a minute.";
}

export async function setNewPassword(password: string): Promise<SignInResult> {
  const c = supabase();
  if (!c) {
    return {
      ok: false,
      message:
        "This console was built without its Supabase settings, so it cannot change a password. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing.",
    };
  }
  const { error } = await c.auth.updateUser({ password });
  if (error) return { ok: false, message: passwordUpdateFailureMessage(error) };
  return { ok: true };
}

export type RecoveryLink =
  | { kind: "recovery" }
  | { kind: "expired" }
  | { kind: "none" };

/**
 * What the address says about the reset link that brought someone here.
 *
 * Supabase's implicit flow appends `#...&type=recovery`; the PKCE flow
 * appends `?code=`. A used or expired link comes back as `#error=...`. The
 * page shows the password form for a recovery link WITHOUT verifying it
 * first -- a bogus one is refused at submit (`LINK_EXPIRED`), which costs the
 * holder nothing they did not already have.
 */
export function recoveryLinkState(hash: string, search: string): RecoveryLink {
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  if (h.has("error") || h.has("error_code")) return { kind: "expired" };
  if (h.get("type") === "recovery") return { kind: "recovery" };
  if (new URLSearchParams(search).has("code")) return { kind: "recovery" };
  return { kind: "none" };
}

/**
 * Let supabase-js consume the recovery link before the page takes it off the
 * address bar. The client reads the URL when it initialises; `getSession`
 * waits for that. Locally there is no client, and nothing to wait for.
 */
export async function primeRecovery(): Promise<void> {
  const c = supabase();
  if (c) await c.auth.getSession();
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
