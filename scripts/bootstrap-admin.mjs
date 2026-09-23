#!/usr/bin/env node
/**
 * bootstrap-admin.mjs — the first staff account on a REAL Supabase project.
 *
 * ## The gap this fills
 *
 * There was no way to create one. `routes/auth.ts` registration is roster-gated
 * and only ever mints `{ role: "student" }`. `db/demo-seed.sql` inserts into
 * `auth.users` with **no password column at all**, so its teacher exists locally
 * but cannot sign in anywhere. `db-push-supabase.mjs` pushes the schema and
 * seeds no users. And `DEPLOY.md` never says how to get in.
 *
 * So a freshly deployed console had a working sign-in form and nobody who could
 * use it.
 *
 * ## The one thing that is easy to get wrong
 *
 * **The JWT is authoritative for role, not `profiles.role`.** `jwt_role()` reads
 * `app_metadata -> role` from the token (`db/schema.sql`), and `profiles.role`
 * is described in its own comment as a mirror. Creating a user and then setting
 * `profiles.role = 'admin'` by hand gets you a row that says admin and a token
 * that says student — RLS denies, the console renders nothing, and everything
 * looks broken for a reason nothing on screen explains.
 *
 * This writes BOTH, and writes `app_metadata` first.
 *
 * ## Usage
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
 *     node scripts/bootstrap-admin.mjs "you@example.com" "a strong password" "Your Name"
 *
 * The service-role key is read from the environment and never printed. Run it
 * once, from your own machine — not from CI, and not from the deployed service.
 */

import pg from "pg";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/**
 * THE SEEDED TEST PASSWORD.
 *
 * Used when none is given, so there is a documented way in on a fresh project.
 * It is deliberately not a secret and not meant to survive first contact: it is
 * printed to a terminal, which means it has been seen, and it can be scrolled
 * back to, copied, or caught in a screenshot.
 *
 * Every account this script creates is therefore stamped with
 * `app_metadata.must_change_credentials`, and the console blocks on a change
 * prompt until it is cleared. The flag lives in app_metadata because that is
 * service-role only -- `profiles` carries a `p_update` policy letting a user
 * edit their own row, so a column there could be cleared without the password
 * ever changing.
 */
const TEST_PASSWORD = "OctaTemp-2026-change-me";

/**
 * THE DEFAULT EMAIL, for the same reason.
 *
 * `POST /console/account/credentials` refuses to clear
 * `must_change_credentials` while EITHER value is still a default, so the
 * instructor replaces both or stays on the change screen. A default password
 * with a real email would otherwise let the address survive as the one written
 * down in a deployment guide.
 *
 * Exported so the API imports these rather than restating them. Two copies of
 * a constant whose whole job is to be recognised is one copy too many.
 */
export const DEFAULT_ADMIN_EMAIL = "admin@octa.local";
export const DEFAULT_ADMIN_PASSWORD = TEST_PASSWORD;

/*
 * Arguments win; `deploy/render-api.env.example`'s OCTA_ADMIN_* fill in behind
 * them. The env path exists so the deployment guide is a thing you paste once
 * and then run `node scripts/bootstrap-admin.mjs` with no arguments -- a
 * password typed on a command line lands in shell history, which is a worse
 * place for it than a file the repo ignores.
 */
const [emailArg, passwordArg, nameArg] = process.argv.slice(2);
const email = emailArg || process.env.OCTA_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
const password = passwordArg || process.env.OCTA_ADMIN_PASSWORD || TEST_PASSWORD;
const fullName = nameArg || process.env.OCTA_ADMIN_NAME || "Course Administrator";
const usingTestPassword = password === TEST_PASSWORD;
const usingTestEmail = email === DEFAULT_ADMIN_EMAIL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

function die(msg, hint = "") {
  console.error(c.red(`\n  ${msg}\n`));
  if (hint) console.error(c.dim(`  ${hint}\n`));
  process.exit(1);
}

if (usingTestEmail || usingTestPassword) {
  const which =
    usingTestEmail && usingTestPassword
      ? "the default email AND password"
      : usingTestEmail
        ? "the default email"
        : "the default password";
  console.log(
    c.yellow(
      `\n  Using ${which}.\n` +
        "  The console will block on a change screen and will not let either default\n" +
        "  survive it. That is deliberate.\n",
    ),
  );
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  die(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.",
    "These belong to the Supabase project, not to the local stack. Never put the\n" +
      "  service-role key in a VITE_* variable -- Vite inlines those into the bundle.",
  );
}
if (!DATABASE_URL) {
  die(
    "DATABASE_URL must be set, pointing at the same Supabase project.",
    "Use the DIRECT connection string from the Supabase dashboard.",
  );
}
if (password.length < 12) {
  die("Use a password of at least 12 characters. This account can see every answer key.");
}

/*
 * A local stack has no Supabase Auth admin API, and pointing this at one would
 * fail confusingly rather than loudly. Say so instead.
 */
if (/localhost|127\.0\.0\.1|:54329/.test(SUPABASE_URL)) {
  die(
    "SUPABASE_URL looks local. This script is for a real Supabase project.",
    "For the local stack use `pnpm dev:token`, which mints a signed dev session.",
  );
}

const headers = {
  "content-type": "application/json",
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
};

async function main() {
  console.log(c.bold("\nOCTA -- bootstrap an admin\n"));
  console.log(c.dim(`  project  ${SUPABASE_URL}`));
  console.log(c.dim(`  email    ${email}`));
  console.log(c.dim(`  name     ${fullName}\n`));

  /*
   * app_metadata is set at creation. It is the field jwt_role() reads, and it is
   * NOT client-writable -- user_metadata is, which is why nothing in this
   * project ever reads that one.
   */
  process.stdout.write("  creating the auth user  ... ");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      /*
       * The flag rides with the role. Both are app_metadata because that is the
       * half of the token a user cannot write -- `user_metadata` is client-
       * writable through the Supabase auth API, which is why nothing in this
       * project ever reads it.
       */
      app_metadata: { role: "admin", must_change_credentials: true },
    }),
  });

  if (!res.ok) {
    console.log(c.red("FAILED"));
    const text = await res.text();
    die(
      `Supabase refused the request (${res.status}).`,
      text.includes("already been registered")
        ? "That email already has an account. Delete it in the dashboard, or use another."
        : text.slice(0, 300),
    );
  }
  const user = await res.json();
  console.log(c.green("ok"));

  /*
   * The mirror row. The console joins `profiles` for names and section, so an
   * auth user without one signs in successfully and then renders as a blank.
   */
  process.stdout.write("  writing the profile row ... ");
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(
      `insert into profiles (id, full_name, role)
       values ($1, $2, 'admin')
       on conflict (id) do update set full_name = excluded.full_name, role = 'admin'`,
      [user.id, fullName],
    );
    await client.query(
      `insert into audit_log (actor_id, action, target_type, target_id, payload)
       values ($1,'admin.bootstrap','profile',$2,$3)`,
      [user.id, user.id, JSON.stringify({ email, fullName, via: "bootstrap-admin.mjs" })],
    );
  } finally {
    await client.end();
  }
  console.log(c.green("ok"));

  console.log(c.green("\n  Done.\n"));

  if (usingTestPassword) {
    console.log(c.bold("  Sign in with:\n"));
    console.log(`    email     ${email}`);
    console.log(`    password  ${TEST_PASSWORD}\n`);
    console.log(
      c.yellow(
        "  WRITE THIS DOWN NOW. It is the only way in, and nothing else can recreate\n" +
          "  it -- a lost bootstrap account means running this script again against a\n" +
          "  different email, or resetting the password in the Supabase dashboard.\n",
      ),
    );
    console.log(
      c.yellow(
        "  The console will BLOCK on a change prompt at first sign-in. That is the\n" +
          "  flag doing its job: this password was printed to a terminal, so it has\n" +
          "  been seen and is not a secret.\n",
      ),
    );
  } else {
    console.log(c.dim("  Sign in at the console with that email and password.\n"));
    console.log(
      c.yellow(
        "  The console will still prompt for a change at first sign-in: every account\n" +
          "  this script creates is flagged, whoever chose the password.\n",
      ),
    );
  }
  console.log(
    c.dim(
      "  The role lives in the JWT's app_metadata, which is what jwt_role() reads.\n" +
        "  profiles.role is only a mirror -- changing it alone would not grant anything.\n",
    ),
  );
  console.log(
    c.yellow(
      "  This account can read every answer key. Use a real password manager, and\n" +
        "  create a separate `teacher` account for day-to-day marking.\n",
    ),
  );
}

main().catch((e) => {
  console.error(c.red(`\n  ${e.message}\n`));
  process.exitCode = 1;
});
