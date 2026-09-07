/**
 * Start the API the way LOCAL work needs it, not the way `.env` describes.
 *
 * ## Why this exists
 *
 * The running API on this machine was configured by hand, in a shell nobody
 * kept. Restarting it from `.env` broke everything, three different ways in a
 * row, and each failure looked like an application bug:
 *
 *   1. **`.env` has no `SUPABASE_JWT_SECRET`**, so the API booted and rejected
 *      every request. The specs and every dev token are signed HS256 with a
 *      known test secret.
 *   2. **`.env` HAS `SUPABASE_URL` and `SUPABASE_ANON_KEY`**, which switch
 *      `identityFrom()` to asymmetric JWKS verification — correct precedence
 *      for production, and it rejects the HS256 dev tokens outright:
 *      `unacceptable alg: HS256`. The page just showed "That did not load".
 *   3. **`CORS_ALLOWED_ORIGINS` is pinned to 5173,5174** while the web app runs
 *      on whatever port Vite could get. Requests never reached the API at all.
 *
 * None of that is wrong in `.env` — it describes the deployed service. It is
 * simply not the local configuration, and the local configuration existed only
 * in one terminal's history.
 *
 *   node scripts/dev-api.mjs
 *   OCTA_API_PORT=8091 node scripts/dev-api.mjs
 *
 * ## Port 8080 is a trap on this machine
 *
 * `apps/web/.env.example` says `VITE_API_URL=http://localhost:8080`, and 8080 is
 * occupied by another project's Adminer, which answers 200 with an HTML login
 * page. The API defaults to **8090** here for that reason.
 */
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * Refuse to run anywhere but a developer's machine. This script deliberately
 * supplies a PUBLICLY KNOWN JWT secret, so it must never be the thing that
 * starts a deployed service. Render sets NODE_ENV=production.
 */
if (process.env.NODE_ENV === "production") {
  console.error(
    "\n  dev-api.mjs is LOCAL ONLY. It supplies a publicly known JWT secret and\n" +
      "  disables asymmetric verification. Never run it in production.\n",
  );
  process.exit(1);
}

/** Read `.env` for the values that ARE right locally — chiefly DATABASE_URL. */
function readEnvFile() {
  const file = resolve(ROOT, ".env");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = readEnvFile();
const PORT = process.env.OCTA_API_PORT ?? "8090";

/*
 * The web app's dev ports. Vite walks upward when one is taken, and it has
 * genuinely landed on 5183 for days at a time, so the range is allowed rather
 * than a single guess -- a CORS rejection presents as "That did not load", with
 * nothing in the page to say why.
 */
const WEB_PORTS = [5173, 5174, 5183, 5184, 5185];

const env = {
  ...process.env,
  ...fileEnv,
  NODE_ENV: "development",
  PORT,
  // Matches `design/specs/*` and every dev token minted in this repo. Local
  // only; the deployed service takes its secret from the platform.
  SUPABASE_JWT_SECRET:
    process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000",
  CORS_ALLOWED_ORIGINS: WEB_PORTS.map((p) => `http://localhost:${p}`).join(","),
};

/*
 * REMOVED, not overridden. `identityFrom()` prefers asymmetric verification
 * whenever both of these are present -- which is the correct precedence, since
 * otherwise a leaked shared secret could forge tokens the real system would
 * never issue. Locally there is no Supabase project to fetch a JWKS from, so
 * their presence is what makes every HS256 dev token fail.
 */
delete env.SUPABASE_URL;
delete env.SUPABASE_ANON_KEY;

if (!env.DATABASE_URL) {
  env.DATABASE_URL = "postgres://postgres:postgres@localhost:54329/octa";
}
if (!env.EXAM_SALT_SECRET) {
  // Any value works locally; it only has to be stable across a run so seeds
  // reproduce. It is never the deployed salt.
  env.EXAM_SALT_SECRET = "local-dev-exam-salt-not-the-real-one-000000";
}

console.log(
  `\n  API on :${PORT}  ·  HS256 dev tokens  ·  CORS ${WEB_PORTS.join(", ")}\n` +
    `  (asymmetric verification disabled -- local only)\n`,
);

const child = spawn("npx", ["tsx", "watch", "src/index.ts"], {
  cwd: resolve(ROOT, "services/api"),
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
