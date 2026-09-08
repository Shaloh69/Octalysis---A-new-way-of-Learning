#!/usr/bin/env node
/**
 * dev-token.mjs — a signed-in session for the LOCAL stack, in one paste.
 *
 * ## Why this exists
 *
 * `db/demo-seed.sql` inserts into `auth.users (id, email, raw_app_meta_data)`.
 * There is **no `encrypted_password` column in that insert**, so the demo staff
 * account has no password and the console's sign-in form cannot authenticate it.
 * Locally the apps read a token straight from `localStorage["octa:dev-token"]`
 * (`apps/console/src/lib/session.ts:87`), which is how the Playwright specs sign
 * in — and there was no way for a human to do the same without hand-rolling a
 * JWT.
 *
 * So: reviewing 183 items in the console was blocked on a credential that does
 * not exist. This prints the token and the one-line paste that installs it.
 *
 * ## LOCAL ONLY, and it enforces that
 *
 * This mints a STAFF identity out of thin air. That is only acceptable because
 * the local API runs with `SUPABASE_JWT_SECRET` set to a known development
 * secret and HS256 verification — `dev-api.mjs` configures exactly that. Against
 * a real Supabase project the API verifies ES256 through JWKS and a token signed
 * here is rejected as `unacceptable alg`, which is the correct outcome and not a
 * bug to work around.
 *
 * It refuses to run if it looks like anything but a local stack.
 *
 * Usage:
 *   node scripts/dev-token.mjs            staff (teacher)
 *   node scripts/dev-token.mjs student    a seeded student
 */

import { createHmac } from "node:crypto";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/*
 * The same default `dev-api.mjs` boots the local API with. If a real
 * SUPABASE_URL is configured, the API is verifying asymmetrically and this token
 * would be refused -- so say that plainly rather than printing something that
 * cannot work.
 */
const SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

if (process.env.NODE_ENV === "production") {
  console.error(c.red("\n  Refusing to mint a token with NODE_ENV=production.\n"));
  process.exit(1);
}

/** Seeded identities from `db/demo-seed.sql`. */
const WHO = {
  staff: {
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "teacher@octa.local",
    app_metadata: { role: "teacher" },
    label: "Prof. Amalia R. Bontuyan — teacher",
    open: "the console (:5174 or :5184)",
  },
  student: {
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "student@octa.local",
    app_metadata: { role: "student", student_id: "232129006" },
    label: "a seeded student — 232129006",
    open: "the student app (:5173 or :5183)",
  },
};

/*
 * `--must-change` mints a token carrying the bootstrap flag, so the blocking
 * change-credentials screen can be seen on the local stack -- where there is no
 * Supabase and therefore no real bootstrap account to create.
 */
const mustChange = process.argv.includes("--must-change");
const which = (process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]) ?? "staff").toLowerCase();
const who = WHO[which];
if (!who) {
  console.error(c.red(`\n  Unknown identity "${which}". Use "staff" or "student".\n`));
  process.exit(1);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({
  sub: who.sub,
  email: who.email,
  aud: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 86_400,
  app_metadata: { ...who.app_metadata, ...(mustChange ? { must_change_credentials: true } : {}) },
});
const sig = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
const token = `${header}.${payload}.${sig}`;

console.log(c.bold("\nOCTA -- local dev token\n"));
console.log(`  ${who.label}`);
console.log(c.dim("  valid 24 hours · HS256 · local stack only"));
if (mustChange) {
  console.log(
    c.yellow("  carrying must_change_credentials — the console will block on the change screen"),
  );
}
console.log("");

if (process.env.SUPABASE_URL) {
  console.log(
    c.yellow(
      "  SUPABASE_URL is set in this environment. The API verifies ES256 through\n" +
        "  JWKS when it sees that, and will reject this token as `unacceptable alg`.\n" +
        "  Start the API with `pnpm dev:api`, which configures local auth.\n",
    ),
  );
}

console.log(c.dim(`  Open ${who.open}, then paste this into the browser console:\n`));
console.log(`localStorage.setItem("octa:dev-token", "${token}"); location.reload()`);
console.log(c.dim("\n  To sign out again:\n"));
console.log(`localStorage.removeItem("octa:dev-token"); location.reload()`);
console.log(c.green("\n  Done.\n"));
