import { supabase } from "./session";

/**
 * Sign-in and registration, from the student's side.
 *
 * TWO THINGS THIS FILE REFUSES TO DO, and both are the point.
 *
 * 1. **It never decides whether an account may exist.** Registration goes to
 *    `POST /api/v1/auth/register`, which claims the roster row inside a
 *    transaction. The browser cannot be trusted with "is this ID on the
 *    roster", because a browser that decides that is a browser that can be
 *    told otherwise.
 *
 * 2. **It never distinguishes failure modes.** An unknown student ID and an
 *    already-claimed one come back byte-identical from the server, and this
 *    file passes that message through unchanged rather than "helpfully"
 *    interpreting it. Interpreting it would rebuild the enumeration oracle the
 *    server exists to prevent.
 *
 * Students sign in with their **student ID**, not an email — that is the number
 * on their registration form and the only identifier they reliably know.
 * `/auth/resolve` turns it into the email Supabase needs, rate-limited and
 * non-enumerating.
 */

// 8090, not 8080 — see the note in `api.ts`. 8080 is often another
// project's Adminer, and its preflight failure names no port.
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8090";

/** The ONLY message the sign-in path returns, whatever actually went wrong. */
const SIGNIN_FAILED = "Check your ID and password.";

export interface AuthResult {
  ok: boolean;
  message?: string;
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Register with a student ID from the roster.
 *
 * The roster is the gate. Without it, anyone with the URL could create an
 * account, and the first thing a stranger would find is a working exam.
 */
export async function register(input: {
  studentId: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const res = await postJson("/api/v1/auth/register", input);
  if (res.ok) return { ok: true };

  let message =
    "That student ID could not be used. Check the ID on your registration form, " +
    "or ask your instructor if it has already been claimed.";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) message = body.error.message;
  } catch {
    /* non-JSON body; the default above is already the server's wording */
  }
  return { ok: false, message };
}

/**
 * Sign in with either a student ID or an email.
 *
 * Resolving happens first because Supabase authenticates on email. A student
 * who types their ID gets it exchanged; a student who types their email skips
 * the exchange entirely, and the server does not look anything up for them.
 */
export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  const client = supabase();
  if (!client) {
    return {
      ok: false,
      message: "Sign-in is not configured on this build. Ask your instructor.",
    };
  }

  let email = identifier.trim();

  if (!email.includes("@")) {
    const res = await postJson("/api/v1/auth/resolve", { identifier: email });
    if (!res.ok) return { ok: false, message: SIGNIN_FAILED };
    try {
      const body = (await res.json()) as { email?: string };
      if (!body.email) return { ok: false, message: SIGNIN_FAILED };
      email = body.email;
    } catch {
      return { ok: false, message: SIGNIN_FAILED };
    }
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  // Supabase distinguishes "no such user" from "wrong password". We do not
  // pass that distinction on -- it is exactly the oracle /auth/resolve is
  // rate-limited to prevent.
  if (error) return { ok: false, message: SIGNIN_FAILED };

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const client = supabase();
  if (client) await client.auth.signOut();
  try {
    localStorage.removeItem("octa:dev-token");
  } catch {
    /* private window */
  }
}

export interface Identity {
  userId: string;
  studentId: string | null;
  role: "student" | "teacher" | "admin";
  email: string | null;
}

/**
 * Decode the JWT payload WITHOUT verifying it.
 *
 * Safe here and nowhere else: the browser holds no key to verify with, and
 * pretending otherwise would be theatre. Verification happens in
 * `services/api` against Supabase's JWKS on every single request. This only
 * decides which screen to draw.
 */
function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function currentIdentity(): Promise<Identity | null> {
  const client = supabase();
  let token: string | null = null;

  if (client) {
    const { data } = await client.auth.getSession();
    token = data.session?.access_token ?? null;
  } else {
    try {
      token = localStorage.getItem("octa:dev-token");
    } catch {
      token = null;
    }
  }
  if (!token) return null;

  const claims = decodePayload(token);
  if (!claims) return null;

  const meta = claims.app_metadata as { role?: unknown; student_id?: unknown } | undefined;
  const raw = typeof meta?.role === "string" ? meta.role : "";

  return {
    userId: typeof claims.sub === "string" ? claims.sub : "",
    studentId: typeof meta?.student_id === "string" ? meta.student_id : null,
    // Anything unrecognised is a STUDENT. Mirrors jwt_role() and V-25: an
    // unknown claim maps to least privilege, never to more.
    role: raw === "admin" ? "admin" : raw === "teacher" ? "teacher" : "student",
    email: typeof claims.email === "string" ? claims.email : null,
  };
}

/** Fires whenever the session changes, so the shell can re-render. */
export function onAuthChange(fn: () => void): () => void {
  const client = supabase();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange(() => fn());
  return () => data.subscription.unsubscribe();
}
