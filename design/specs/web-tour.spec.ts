import { test, expect, type Page, type TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  recordedMotion,
  recordMotion,
  unreachableByKeyboard,
} from "./_gate";
import { S004, S006 } from "./_stage-fixture";

/**
 * The first-run tour and its ? button (instructor, 8 Oct 2026;
 * design/templates/web/tutorial/SPEC.md). Driver.js's shape, dressed in the
 * star HUD: the page dims, the target is cut out, a popover explains it.
 *
 * An automated browser is not a student, so the shell does not start the tour
 * for one (the shield would block every other spec that visits the map) unless
 * `octa:tour:force` is set. These specs set it to exercise the real path, and
 * one proves that without it nothing starts.
 */

const ROUTE = ".tour-pop";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";
const TARGETS = ["map", "stages", "progress", "work", "chat", "settings", "profile", "help"];

/**
 * "Has had the tour" is the ACCOUNT's, in the database (`profiles.tour_seen_at`,
 * db/addendum-tour.sql). Most specs need a student who has not, every time, and the
 * shared local database cannot be reset from a browser, so the profile's flag is a
 * stand-in kept per account for the life of the page (it survives a reload, as the
 * database would). The one test that proves the REAL column is "remembered in the
 * database" below, and server/tour.spec.ts has the route's own denials.
 */
async function tourStore(page: Page): Promise<{ marked: string[] }> {
  const seen = new Map<string, string>();
  const marked: string[] = [];
  await page.route("**/api/v1/profile", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const res = await route.fetch();
    const p = (await res.json()) as { id: string };
    return route.fulfill({ response: res, json: { ...p, tourSeenAt: seen.get(p.id) ?? null } });
  });
  await page.route("**/api/v1/profile/tour", async (route) => {
    const res = await route.fetch({ method: "GET", url: route.request().url().replace(/\/tour$/, "") });
    const p = (await res.json()) as { id: string };
    if (!seen.has(p.id)) seen.set(p.id, new Date().toISOString());
    marked.push(p.id);
    return route.fulfill({ response: res, json: { ...p, tourSeenAt: seen.get(p.id) } });
  });
  return { marked };
}

async function open(page: Page, route = "/app", token = S006, force = true, store = true): Promise<{ marked: string[] }> {
  const st = store ? await tourStore(page) : { marked: [] };
  await page.addInitScript(
    ([t, f]) => {
      // Only if not already signed in: a test that switches student must keep its switch on reload.
      if (!localStorage.getItem("octa:dev-token")) localStorage.setItem("octa:dev-token", t as string);
      if (f) localStorage.setItem("octa:tour:force", "1");
    },
    [token, force],
  );
  await page.goto(route, { waitUntil: "domcontentloaded" });
  return st;
}

/** Start the tour the way a student does the first time: by visiting the map. */
async function started(page: Page): Promise<{ marked: string[] }> {
  const st = await open(page);
  await page.locator("[data-tour-root]").waitFor({ timeout: 25_000 });
  return st;
}

/**
 * The same tour, started from the ? on a light route. The map is a heavy 3D scene and
 * a nine-step loop of measurements on it outruns the timeout in headless software
 * rendering; the tour is the shell's, so any star route shows the same one.
 */
async function startedLight(page: Page): Promise<void> {
  await open(page, "/app/settings");
  await page.locator(".star-help").click();
  await page.locator("[data-tour-root]").waitFor();
}

const next = (page: Page) => page.locator(".tour-actions .button-primary");
const count = (page: Page) => page.locator(".tour-count");

test.describe("the tour — the six gate assertions", () => {
  test("1 · nothing is clipped, on every step", async ({ page }) => {
    await startedLight(page);
    for (let i = 0; i < 9; i += 1) {
      expect(await clippedElements(page, ROUTE), `step ${i + 1}`).toEqual([]);
      const box = (await page.locator(ROUTE).boundingBox())!;
      const vp = page.viewportSize()!;
      expect(box.x, `step ${i + 1} left`).toBeGreaterThanOrEqual(0);
      expect(box.y, `step ${i + 1} top`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `step ${i + 1} right`).toBeLessThanOrEqual(vp.width);
      expect(box.y + box.height, `step ${i + 1} bottom`).toBeLessThanOrEqual(vp.height);
      if (i < 8) await next(page).click();
    }
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await startedLight(page);
    for (let i = 0; i < 9; i += 1) {
      expect(await horizontalOverflow(page), `step ${i + 1}`).toBeLessThanOrEqual(0);
      if (i < 8) await next(page).click();
    }
  });
  test("3 · every control is reachable by keyboard, and nothing behind the tour is", async ({ page }) => {
    await startedLight(page);
    expect(await unreachableByKeyboard(page, ROUTE)).toEqual([]);
    await page.locator(".tour-pop button", { hasText: "Skip the tour" }).focus();
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest(".tour-pop")), `tab ${i + 1} stayed in the tour`).toBe(true);
    }
  });
  test("4 · AA computed on the star set, on every step", async ({ page }) => {
    await startedLight(page);
    for (let i = 0; i < 9; i += 1) {
      expect(await contrastFailures(page, ROUTE), `step ${i + 1}`).toEqual([]);
      if (i < 8) await next(page).click();
    }
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await startedLight(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
    await next(page).click();
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("6 · reduced motion: stepping does not animate", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await startedLight(calm);
    for (let i = 0; i < 4; i += 1) await next(calm).click();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("the tour — what it owes", () => {
  test("it starts by itself on a student's first visit to the map, once, and remembers (in the account)", async ({ page }) => {
    const st = await started(page);
    await expect(count(page)).toHaveText(/^1 of 9$/i);
    expect(st.marked).toEqual(["dddddddd-1111-4000-8000-000000000006"]);
    // Nothing is kept in the browser any more: the account remembers.
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("octa:tour:v1:")))).toEqual([]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-star-map], .star-nav, nav[aria-label=Main]").first().waitFor();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
  });

  test("remembered in the database: once the account has had it, a fresh browser is not shown it", async ({ page }) => {
    // The real column, no stand-in: mark the account through the real route, then visit as it would.
    const api = process.env.OCTA_API_URL ?? "http://localhost:8090";
    const marked = await page.request.post(`${api}/api/v1/profile/tour`, { headers: { authorization: `Bearer ${S004}` } });
    expect(marked.status()).toBe(200);
    expect((await marked.json()).tourSeenAt).toEqual(expect.any(String));
    await open(page, "/app", S004, true, false);
    await page.locator("nav[aria-label=Main]").waitFor();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
  });

  test("it is remembered per account: a second student on the same browser sees it too", async ({ page }) => {
    await started(page);
    await page.getByRole("button", { name: "Skip the tour" }).click();
    await page.evaluate((t) => localStorage.setItem("octa:dev-token", t), S004);
    // the profile is the new account's: the store reads it afresh on reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-tour-root]").waitFor({ timeout: 25_000 });
    await expect(count(page)).toHaveText(/^1 of 9$/i);
  });

  test("an automated browser is not given the tour unless it asks (so no other spec is blocked)", async ({ page }) => {
    await open(page, "/app", S006, false);
    await page.locator("nav[aria-label=Main]").waitFor();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    await expect(page.locator(".star-help")).toBeVisible();
  });

  test("the ? brings it back at any time; Escape closes it and gives focus back to the ?", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await started(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    await expect(page.locator(".star-help")).toBeFocused();
    await page.locator(".star-help").click();
    await expect(count(page)).toHaveText(/^1 of 9$/i);
    await expect(page.locator(".tour-pop")).toHaveAttribute("role", "dialog");
    // the ? is a real, named button
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Take the tour of the app" })).toBeVisible();
  });

  test("Next, Previous, the arrow keys and Skip; the last step says Done and has no Skip", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await started(page);
    await next(page).click();
    await expect(count(page)).toHaveText(/^2 of 9$/i);
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(count(page)).toHaveText(/^1 of 9$/i);
    await expect(page.getByRole("button", { name: "Previous" })).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(count(page)).toHaveText(/^3 of 9$/i);
    await page.keyboard.press("ArrowLeft");
    await expect(count(page)).toHaveText(/^2 of 9$/i);
    for (let i = 0; i < 7; i += 1) await next(page).click();
    await expect(count(page)).toHaveText(/^9 of 9$/i);
    await expect(page.getByRole("button", { name: "Skip the tour" })).toHaveCount(0);
    await expect(next(page)).toHaveText("Done");
    await next(page).click();
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    // Skip, from the start
    await page.locator(".star-help").click();
    await page.getByRole("button", { name: "Skip the tour" }).click();
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
  });

  test("each step's spotlight sits on the thing it names, at this width", async ({ page }) => {
    // Nine steps on the heavy 3D map: about 25 s alone in headless software rendering, more under load.
    test.setTimeout(120_000);
    await started(page);
    await next(page).click(); // past the welcome
    for (const [i, target] of TARGETS.entries()) {
      const spot = (await page.locator(".tour-spot").boundingBox())!;
      const el = (await page.locator(`[data-tour="${target}"]`).boundingBox())!;
      // PAD of 6 on every side; the spot has a transition, so allow it a few pixels.
      expect(Math.abs(spot.x - (el.x - 6)), `${target} x`).toBeLessThanOrEqual(3);
      expect(Math.abs(spot.y - (el.y - 6)), `${target} y`).toBeLessThanOrEqual(3);
      expect(Math.abs(spot.width - (el.width + 12)), `${target} w`).toBeLessThanOrEqual(3);
      expect(Math.abs(spot.height - (el.height + 12)), `${target} h`).toBeLessThanOrEqual(3);
      // the popover does not cover what it explains
      const pop = (await page.locator(ROUTE).boundingBox())!;
      const overlap = !(pop.x + pop.width <= el.x || el.x + el.width <= pop.x || pop.y + pop.height <= el.y || el.y + el.height <= pop.y);
      expect(overlap, `${target} is not covered by its own popover`).toBe(false);
      if (i < TARGETS.length - 1) {
        await next(page).click();
        await page.waitForTimeout(300); // the spotlight eases between steps
      }
    }
  });

  test("the page behind is inert: a click through the dimness goes nowhere, and Tab stays in the popover", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await started(page);
    const stages = (await page.locator('[data-tour="stages"]').boundingBox())!;
    await page.mouse.click(stages.x + stages.width / 2, stages.y + stages.height / 2);
    await expect(page).toHaveURL(/\/app$/);
    expect(await page.locator("main").getAttribute("inert")).not.toBeNull();
    await next(page).click();
    await page.keyboard.press("Escape");
    expect(await page.locator("main").getAttribute("inert")).toBeNull();
    await page.locator('[data-tour="stages"]').click();
    await expect(page).toHaveURL(/\/app\/stages$/);
  });

  test("it never starts on another route, and never inside a planet (a check is sat with no shortcut off it)", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await open(page, "/app/stages");
    await page.locator("nav[aria-label=Main]").waitFor();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    await page.goto("/app/stage/01", { waitUntil: "domcontentloaded" });
    await page.locator("html[data-realm=biome]").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2000);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    await expect(page.locator(".star-help")).toHaveCount(0);
  });

  test("the welcome step has no target: the page dims and the words sit in the middle", async ({ page }) => {
    await started(page);
    await expect(page.locator(".tour-spot")).toHaveCount(0);
    await expect(page.locator(".tour-dim")).toBeVisible();
    const pop = (await page.locator(ROUTE).boundingBox())!;
    const vp = page.viewportSize()!;
    expect(Math.abs(pop.x + pop.width / 2 - vp.width / 2)).toBeLessThanOrEqual(3);
  });
});
