import type { APIRequestContext, Page } from "@playwright/test";
import { API, S006, signIn } from "./_stage-fixture.ts";

/**
 * The `/app/map` fixture: the REAL API as the seeded student `232129006`, with
 * patches only for the states the seed cannot hold (a failed read, a slow one,
 * an approved summary). Nothing here writes to the database.
 *
 * `232129006` on the seed: 00 open and not started, 01-04 locked behind 00,
 * 05 mastered, 06 in progress at 40%, 07-18 locked. The card therefore names
 * 06 (a stage in progress comes first).
 *
 * Not a spec: the leading underscore. Imported with its `.ts` extension by the
 * capture script (`node --experimental-strip-types`), so it holds no bare
 * `@playwright/test` value import.
 */

export interface MapNode {
  id: string;
  ordinal: number;
  title: string;
  summary: string | null;
  estMinutes: number;
  levels: number[];
  state: "locked" | "available" | "in_progress" | "mastered";
  mastery: number;
  lockReason: { kind: string; blockingStages: string[]; message: string } | null;
  objectives: Array<{ id: string; level: number; description: string }>;
}
export interface MapBody {
  nodes: MapNode[];
  edges: Array<{ from: string; to: string }>;
  generatedAt: string;
}

/** What the API says, read directly, for the spec to compare the page against. */
export async function realMap(request: APIRequestContext, token = S006): Promise<MapBody> {
  const res = await request.get(`${API}/api/v1/stages`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok()) throw new Error(`GET /api/v1/stages answered ${res.status()}`);
  return (await res.json()) as MapBody;
}

export interface OpenMapOptions {
  token?: string;
  /** Path and query, `/app/map` by default. */
  path?: string;
  /** Rewrite the real response before the page sees it. */
  patch?: (body: MapBody) => MapBody;
  /** Hold the map read this long before answering. */
  delayMs?: number;
  /** Answer the first N reads with a 500 carrying the server's error shape. */
  failTimes?: number;
  /** A reader position this device kept, per stage: `octa:reader:<id>`. */
  positions?: Record<string, { index: number; label: string }>;
  /** Wait for this page state; `null` waits for nothing. */
  wait?: "ready" | "error" | "loading" | null;
}

/**
 * Open the map and wait for DATA (§0m.5): the route's state attribute, not the
 * `<h1>`, which renders at once. The student's seeded look lands from
 * /cosmetics after first paint and eases every colour, so that is awaited too.
 *
 * The shell reads `/api/v1/stages` for its chrome as well, so a patch or a
 * failure applies to every read of it; the page is what the spec measures.
 */
export async function openMap(page: Page, opts: OpenMapOptions = {}): Promise<void> {
  await signIn(page, opts.token ?? S006);
  if (opts.positions) {
    await page.addInitScript((p) => {
      for (const [id, v] of Object.entries(p as Record<string, unknown>)) {
        localStorage.setItem(`octa:reader:${id}`, JSON.stringify(v));
      }
    }, opts.positions);
  }
  let failures = opts.failTimes ?? 0;
  if (opts.patch || opts.delayMs || failures) {
    await page.route(/\/api\/v1\/stages$/, async (route) => {
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
      if (!opts.patch) return route.continue().catch(() => undefined);
      try {
        const res = await route.fetch();
        const body = (await res.json()) as MapBody;
        await route.fulfill({ response: res, json: opts.patch(body) });
      } catch {
        /* the test ended while the read was in flight (§0j.5) */
      }
    });
  }
  const look = page
    .waitForResponse((r) => r.url().includes("/api/v1/cosmetics"), { timeout: 15_000 })
    .catch(() => null);
  await page.goto(opts.path ?? "/app/map");
  await look;
  const wait = opts.wait === undefined ? "ready" : opts.wait;
  if (wait) await page.locator(`[data-flatmap="${wait}"]`).waitFor({ timeout: 20_000 });
}
