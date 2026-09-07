import { createHmac } from "node:crypto";

/**
 * Verify the dev server answering `baseURL` is actually OCTA.
 *
 * ## Why this file exists
 *
 * Twice now a full spec run has been believed while pointing at a different
 * project. Port 5173 is Vite's default, so every Vite app on this machine wants
 * it, and whichever started first gets it; 8080 is the same story with another
 * project's Adminer. The config already carried a comment saying so, which
 * helped nobody, because a comment is not a check.
 *
 * The failure is quiet in the worst way. The wrong app still returns HTTP 200,
 * still renders an `<h1>`, and still screenshots — so a spec whose assertions
 * are about page structure PASSES against a stranger's app, and its captures get
 * committed as this project's. `biomes.spec.ts` came within one commit of
 * recording seven EngiRent screenshots as OCTA's biomes; only a new assertion
 * about `.biome` caught it, and only by accident.
 *
 * So: check once, before any test runs, and fail with the actual fix in the
 * message rather than 40 confusing assertion errors.
 *
 * ## Why a title check
 *
 * It is the cheapest thing that is unambiguously ours and is served before any
 * script runs, so it works whether or not the API is up. A missing server is
 * reported separately — "nothing is listening" and "the wrong app is listening"
 * are different mistakes with different fixes, and saying which one it is saves
 * the ten minutes that were lost to conflating them.
 */

const OURS = /<title>\s*OCTA/i;

async function check(label: string, url: string): Promise<string | null> {
  let html: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    html = await res.text();
  } catch {
    return `  ${label}: nothing is listening at ${url}. Start it, or set the URL env var.`;
  }

  if (!OURS.test(html)) {
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "(no <title>)";
    return (
      `  ${label}: ${url} is serving "${title}", which is NOT OCTA.\n` +
      `    Another Vite project took the port. Find OCTA's real port and re-run with\n` +
      `    OCTA_WEB_URL=http://localhost:<port> pnpm qa`
    );
  }
  return null;
}

/**
 * Refuse to run against a TRUNCATED database, and say how to fix it.
 *
 * `pnpm verify` runs the API suite, which truncates fixtures. Running `pnpm qa`
 * straight afterwards tests a database holding 4 objectives instead of 115, and
 * the failures that produces look exactly like code failures: stages locked,
 * tables empty, "element(s) not found".
 *
 * That sequence has cost three separate runs in two days, twice reported as a
 * red suite before anyone thought to check the fixtures. `REDESIGN-CLAUDE.md`
 * §2c rule 5 says to measure on real data; this makes it hard not to.
 *
 * It asks the API rather than connecting to Postgres, because the spec suite has
 * no database client and should not grow one. The token is the same HS256 dev
 * token every spec mints.
 *
 * Returns null whenever it CANNOT tell — API down, auth configured differently,
 * an unexpected shape. A setup check that guesses is worse than none: it would
 * block a run for a reason that is not true.
 */
async function seedWarning(api: string): Promise<string | null> {
  const secret =
    process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    app_metadata: { role: "student", student_id: "232129006" },
  });
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");

  let nodes: Array<{ objectives?: unknown[] }>;
  try {
    const res = await fetch(`${api}/api/v1/stages`, {
      headers: { Authorization: `Bearer ${header}.${payload}.${sig}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    nodes = ((await res.json()) as { nodes?: Array<{ objectives?: unknown[] }> }).nodes ?? [];
  } catch {
    return null;
  }

  const objectives = nodes.reduce((n, s) => n + (s.objectives?.length ?? 0), 0);
  if (nodes.length === 0 || objectives >= 100) return null;

  return (
    `The database looks TRUNCATED: ${nodes.length} stages carrying ${objectives} ` +
    `objectives, where the fixtures hold 115.\n\n` +
    `  \`pnpm verify\` runs the API suite, which truncates fixtures. Running the\n` +
    `  specs on top of that gives locked stages and empty tables, which read as\n` +
    `  code failures and are not — it has happened three times.\n\n` +
    `  Run \`node scripts/db-demo.mjs\` first.`
  );
}

export default async function globalSetup(): Promise<void> {
  const web = process.env.OCTA_WEB_URL ?? "http://localhost:5173";
  const problem = await check("web", web);

  if (problem) {
    throw new Error(
      `\nThe design specs are pointed at the wrong app.\n\n${problem}\n\n` +
        `Every assertion below would have run against it, and the ones about page\n` +
        `structure would have PASSED — this check exists because that has happened.\n`,
    );
  }

  const seed = await seedWarning(process.env.OCTA_API_URL ?? "http://localhost:8090");
  if (seed) throw new Error(`\n${seed}\n`);
}
