import type { APIRequestContext, Page } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * The `/app/stage/:id` fixture: the REAL API, as two seeded students, with
 * patches only for the states the seed cannot hold (a failed read, a slow
 * one, an empty stage). Nothing here writes to the database.
 *
 * - `232129006`: stage 00 (open, not graded, no check), 05 (mastered), 06 (in
 *   progress at 40%, 19 blocks, `##` sections and wrapped lists), 01 LOCKED
 *   behind 00
 * - `232129004`: stages 02-08 open; 04 has the wrapped locality list, 07 a
 *   four-column table, a 73-character figure and a check
 *
 * Not a spec: the leading underscore. Imported with its `.ts` extension by the
 * capture script (`node --experimental-strip-types`), so it holds no bare
 * `@playwright/test` value import.
 */

export const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
export const API = process.env.OCTA_API_URL ?? "http://localhost:8090";

function mint(n: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    sub: `dddddddd-1111-4000-8000-000000000${n}`,
    email: `232129${n}@example.com`,
    app_metadata: { role: "student", student_id: `232129${n}` },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

/** 232129006: the prompt's seeded student; its accent is a pink-red. */
export const S006 = mint("006");
/** 232129004: the student with stages 02-08 open. */
export const S004 = mint("004");

export interface StageBody {
  id: string;
  title: string;
  locked: boolean;
  state: string;
  gradeable: boolean;
  mastery?: number;
  masteryThreshold: number;
  lockReason: { kind: string; blockingStages: string[]; message: string } | null;
  objectives: Array<{ id: string; description: string }>;
  blocks: Array<{ ordinal: number; kind: string; body: string; meta: Record<string, string> }>;
  assessment: { id: string; title: string; attemptsAllowed: number; attemptsUsed: number } | null;
}

/** What the API says, read directly, for the spec to compare the page against. */
export async function realStage(request: APIRequestContext, id: string, token = S006): Promise<StageBody> {
  const res = await request.get(`${API}/api/v1/stages/${id}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok()) throw new Error(`GET /api/v1/stages/${id} answered ${res.status()}`);
  return (await res.json()) as StageBody;
}

export interface OpenOptions {
  token?: string;
  /** Rewrite the real response before the page sees it. */
  patch?: (body: StageBody) => StageBody;
  /** Hold the stage read this long before answering. */
  delayMs?: number;
  /** Answer the first N reads with a 500 carrying the server's error shape. */
  failTimes?: number;
  /** Wait for this reader state; `null` waits for nothing. */
  wait?: "reading" | "locked" | "error" | "missing" | "empty" | null;
}

export async function signIn(page: Page, token = S006): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), token);
}

/**
 * Open a stage and wait for DATA (§0m.5): the reader's state attribute, not
 * the `<h1>`. The student's seeded look lands from /cosmetics after first
 * paint and eases every colour, so that is awaited too (§0p).
 */
export async function openStage(page: Page, id: string, opts: OpenOptions = {}): Promise<void> {
  await signIn(page, opts.token ?? S006);
  let failures = opts.failTimes ?? 0;
  if (opts.patch || opts.delayMs || failures) {
    await page.route(new RegExp(`/api/v1/stages/${id}$`), async (route) => {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (failures > 0) {
        failures--;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "internal", message: "Something went wrong on our side. Try again." } }),
        });
        return;
      }
      if (!opts.patch) return route.continue();
      try {
        const res = await route.fetch();
        const body = (await res.json()) as StageBody;
        await route.fulfill({ response: res, json: opts.patch(body) });
      } catch {
        /* the test ended while the read was in flight (§0j.5) */
      }
    });
  }
  const look = page
    .waitForResponse((r) => r.url().includes("/api/v1/cosmetics"), { timeout: 15_000 })
    .catch(() => null);
  await page.goto(`/app/stage/${id}`);
  await look;
  const wait = opts.wait === undefined ? "reading" : opts.wait;
  if (wait) await page.locator(`[data-reader="${wait}"]`).waitFor({ timeout: 20_000 });
}
