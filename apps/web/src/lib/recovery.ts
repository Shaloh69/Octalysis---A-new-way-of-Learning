import { supabase } from "./session";

/**
 * Students' self-service password reset (instructor ruling, 6 Oct 2026:
 * "both, the console tool first"; this is the second half). A port of the
 * console's reviewed helpers (apps/console/src/lib/session.ts, 25 Sep 2026),
 * held to the same rules:
 *
 *   - Supabase does the work: `resetPasswordForEmail` mails a one-use link,
 *     the link lands on `/reset-password` with a recovery session, and
 *     `updateUser({ password })` sets the new one. `app_metadata` is never
 *     touched, so a reset never changes a role.
 *   - **No enumeration.** An address with no account reads exactly like one
 *     with an account.
 *
 * Needs, in the Supabase dashboard (the instructor's): the student site's
 * `/reset-password` under Authentication > URL Configuration > Redirect URLs,
 * and working auth email. Locally there is no client and the page says so.
 */

export type RecoveryResult = { ok: true } | { ok: false; message: string };
type AuthFailure = { status?: number | undefined; code?: string | undefined; name?: string | undefined };

const NOT_CONFIGURED =
  "Password resets by email are not available on this server: it was built without its Supabase settings. Ask your instructor to reset it.";

/** What to say when a reset email could not be requested, or null for "say it was sent". */
export function resetRequestFailureMessage(error: AuthFailure): string | null {
  const s = error.status;
  if (s === 429 || error.code === "over_email_send_rate_limit") {
    return "Too many reset emails have been requested. Wait a while, then try again, or ask your instructor.";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return "That is not an email address.";
  }
  if (typeof s === "number" && s >= 400 && s < 500) return null;
  return "The reset email was not sent: the service did not answer. Try again in a minute.";
}

export async function requestPasswordReset(email: string): Promise<RecoveryResult> {
  const c = supabase();
  if (!c) return { ok: false, message: NOT_CONFIGURED };
  const { error } = await c.auth.resetPasswordForEmail(email.trim(), {
    // Must be listed under Auth > URL Configuration > Redirect URLs.
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    const message = resetRequestFailureMessage(error);
    if (message) return { ok: false, message };
  }
  return { ok: true };
}

export const LINK_EXPIRED = "This reset link has expired or was already used. Ask for a new one.";

export function passwordUpdateFailureMessage(error: AuthFailure): string {
  if (error.code === "same_password") return "That is already your password. Choose a different one.";
  if (error.code === "weak_password") return "That password was refused as too weak. Choose a longer one.";
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
    return "The password was not changed. Ask for a new link and try again.";
  }
  return "The password was not changed: the service did not answer. Try again in a minute.";
}

export async function setNewPassword(password: string): Promise<RecoveryResult> {
  const c = supabase();
  if (!c) return { ok: false, message: NOT_CONFIGURED };
  const { error } = await c.auth.updateUser({ password });
  if (error) return { ok: false, message: passwordUpdateFailureMessage(error) };
  return { ok: true };
}

export type RecoveryLink = { kind: "recovery" } | { kind: "expired" } | { kind: "none" };

/** What the address says about the link that brought someone here (implicit or PKCE flow). */
export function recoveryLinkState(hash: string, search: string): RecoveryLink {
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  if (h.has("error") || h.has("error_code")) return { kind: "expired" };
  if (h.get("type") === "recovery") return { kind: "recovery" };
  if (new URLSearchParams(search).has("code")) return { kind: "recovery" };
  return { kind: "none" };
}

/** Let supabase-js read the recovery link before the page takes it off the address bar. */
export async function primeRecovery(): Promise<void> {
  const c = supabase();
  if (c) await c.auth.getSession();
}
