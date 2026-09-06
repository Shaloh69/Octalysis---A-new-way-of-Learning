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
}
