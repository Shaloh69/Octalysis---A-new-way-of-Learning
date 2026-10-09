import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { STAFF, signIn } from "./_chat-fixture";

/**
 * The console's first-run tour and its ? (instructor, 9 Oct 2026;
 * design/templates/console/tour/SPEC.md). Driver.js's structure in the
 * console's tokens: the page dims, the target is cut out, a popover explains it.
 *
 * "Has had the tour" is the ACCOUNT's, in the database. Most specs need a
 * teacher who has not, every time, and a browser cannot reset the shared local
 * database, so the profile's flag is a stand-in kept per account for the life of
 * the page (it survives a reload, as the database would). One test proves the
 * REAL column ("remembered in the database"), and `services/api/test/tour.spec.ts`
 * has the route's own denials.
 *
 * An automated browser is not a teacher, so the shell does not start the tour
 * for one unless `octa:tour:force` is set; one test proves nothing starts without it.
 */

const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";
const API = process.env.OCTA_API_URL ?? "http://localhost:8090";
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const ROUTE = ".tour-pop";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

function adminToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub: "dddddddd-0000-4000-8000-000000000001", email: "demo@example.com", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86_400, app_metadata: { role: "admin" } });
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
const ADMIN = adminToken();

const TEACHER_STEPS = ["Welcome to the OCTA console", "In class", "Students", "Course", "Records", "Your account", "The ? is always here"];
const ADMIN_STEPS = ["Welcome to the OCTA console", "In class", "Students", "Course", "Records", "Teachers", "Your account", "The ? is always here"];

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

async function open(page: Page, o: { route?: string; token?: string; force?: boolean; store?: boolean } = {}): Promise<{ marked: string[] }> {
  const st = o.store === false ? { marked: [] } : await tourStore(page);
  await signIn(page, o.token ?? STAFF);
  if (o.force !== false) await page.addInitScript(() => localStorage.setItem("octa:tour:force", "1"));
  await page.goto(`${CONSOLE_URL}${o.route ?? "/locks"}`, { waitUntil: "domcontentloaded" });
  return st;
}

/** Start the tour the way a teacher does the first time: by opening the console. */
async function started(page: Page, token?: string): Promise<{ marked: string[] }> {
  const st = await open(page, { token });
  await page.locator("[data-tour-root]").waitFor({ timeout: 25_000 });
  return st;
}

/** The same tour, started from the ? on a settled page. */
async function startedFromHelp(page: Page, token?: string): Promise<void> {
  await open(page, { token, force: false });
  await page.locator("main").waitFor();
  await page.getByRole("button", { name: "Take the tour of the console" }).filter({ visible: true }).click();
  await page.locator("[data-tour-root]").waitFor();
}

const next = (page: Page) => page.locator(".tour-actions button").last();
const count = (page: Page) => page.locator(".tour-count");
const title = (page: Page) => page.locator(".tour-title");

test.describe("the console tour: the six gate assertions", () => {
  test("1 · nothing is clipped, on every step", async ({ page }) => {
    await startedFromHelp(page, ADMIN);
    for (let i = 0; i < ADMIN_STEPS.length; i += 1) {
      expect(await clippedElements(page, ROUTE), `step ${i + 1}`).toEqual([]);
      const box = (await page.locator(ROUTE).boundingBox())!;
      const vp = page.viewportSize()!;
      expect(box.x, `step ${i + 1} left`).toBeGreaterThanOrEqual(0);
      expect(box.y, `step ${i + 1} top`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `step ${i + 1} right`).toBeLessThanOrEqual(vp.width);
      expect(box.y + box.height, `step ${i + 1} bottom`).toBeLessThanOrEqual(vp.height);
      if (i < ADMIN_STEPS.length - 1) await next(page).click();
    }
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await startedFromHelp(page, ADMIN);
    for (let i = 0; i < ADMIN_STEPS.length; i += 1) {
      expect(await horizontalOverflow(page), `step ${i + 1}`).toBeLessThanOrEqual(0);
      if (i < ADMIN_STEPS.length - 1) await next(page).click();
    }
  });
  test("3 · every control is reachable by keyboard, and nothing behind the tour is", async ({ page }) => {
    await startedFromHelp(page);
    expect(await unreachableByKeyboard(page, ROUTE)).toEqual([]);
    await page.locator(".tour-pop button", { hasText: "Skip the tour" }).focus();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest(".tour-pop")), `tab ${i + 1} stayed in the tour`).toBe(true);
    }
  });
  test("4 · AA computed on all three themes, on every step", async ({ page }) => {
    test.setTimeout(180_000);
    await startedFromHelp(page, ADMIN);
    const failures: string[] = [];
    for (let i = 0; i < ADMIN_STEPS.length; i += 1) {
      for (const theme of THEMES) {
        await setTheme(page, theme);
        failures.push(...(await contrastFailures(page, ROUTE)).map((f) => `${theme} step ${i + 1}: ${f}`));
      }
      if (i < ADMIN_STEPS.length - 1) await next(page).click();
    }
    expect(failures).toEqual([]);
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await startedFromHelp(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
    await next(page).click();
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("6 · reduced motion: stepping does not animate; and with it allowed the popover does ease in", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    await recordMotion(page);
    await startedFromHelp(page);
    await page.waitForTimeout(400);
    expect((await recordedMotion(page)).filter((m) => m.ms > 1).length, "the tour should ease in").toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await startedFromHelp(calm);
    for (let i = 0; i < 4; i += 1) await next(calm).click();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("the console tour: what it owes", () => {
  test("it starts by itself on a teacher's first visit, once, and remembers (in the account)", async ({ page }) => {
    const st = await started(page);
    await expect(count(page)).toHaveText(/^1 of 7$/i);
    await expect(title(page)).toHaveText("Welcome to the OCTA console");
    expect(st.marked).toEqual(["dddddddd-0000-4000-8000-000000000001"]);
    // Nothing is kept in the browser for it: the account remembers.
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("octa:tour:v1:")))).toEqual([]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
  });

  test("remembered in the database: once the account has had it, a fresh browser is not shown it", async ({ page }) => {
    // The real column, no stand-in: mark the account through the real route, then visit as it would.
    const marked = await page.request.post(`${API}/api/v1/profile/tour`, { headers: { authorization: `Bearer ${STAFF}` } });
    expect(marked.status()).toBe(200);
    expect((await marked.json()).tourSeenAt).toEqual(expect.any(String));
    await open(page, { store: false });
    await page.locator("main").waitFor();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
  });

  test("an automated browser is not given the tour unless it asks (so no other spec is blocked)", async ({ page }) => {
    await open(page, { force: false });
    await page.locator("main").waitFor();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Take the tour of the console" }).filter({ visible: true })).toBeVisible();
  });

  test("a teacher's tour has seven steps and no Teachers step; the admin's has eight", async ({ page }) => {
    await startedFromHelp(page);
    await expect(count(page)).toHaveText(/^1 of 7$/i);
    const seen: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      seen.push((await title(page).textContent()) ?? "");
      if (i < 6) await next(page).click();
    }
    expect(seen).toEqual(TEACHER_STEPS);
    await page.keyboard.press("Escape");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await startedFromHelp(page, ADMIN);
    await expect(count(page)).toHaveText(/^1 of 8$/i);
    const seenAdmin: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      seenAdmin.push((await title(page).textContent()) ?? "");
      if (i < 7) await next(page).click();
    }
    expect(seenAdmin).toEqual(ADMIN_STEPS);
  });

  test("the ? brings it back at any time; Escape closes it and gives focus back to the ?", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await startedFromHelp(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    const help = page.getByRole("button", { name: "Take the tour of the console" }).filter({ visible: true });
    await expect(help).toBeFocused();
    await help.click();
    await expect(count(page)).toHaveText(/^1 of 7$/i);
    await expect(page.locator(ROUTE)).toHaveAttribute("role", "dialog");
  });

  test("Next, Previous, the arrow keys and Skip; the last step says Done and has no Skip", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await startedFromHelp(page);
    await next(page).click();
    await expect(count(page)).toHaveText(/^2 of 7$/i);
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(count(page)).toHaveText(/^1 of 7$/i);
    await expect(page.getByRole("button", { name: "Previous" })).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(count(page)).toHaveText(/^3 of 7$/i);
    await page.keyboard.press("ArrowLeft");
    await expect(count(page)).toHaveText(/^2 of 7$/i);
    for (let i = 0; i < 5; i += 1) await next(page).click();
    await expect(count(page)).toHaveText(/^7 of 7$/i);
    await expect(next(page)).toHaveText("Done");
    await expect(page.getByRole("button", { name: "Skip the tour" })).toHaveCount(0);
    await next(page).click();
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
  });

  test("each step's spotlight sits on the thing it names, and the popover does not cover it", async ({ page }) => {
    await startedFromHelp(page, ADMIN);
    const targets = ["nav-in-class", "nav-students", "nav-course", "nav-records", "nav-teachers", "account", "help"];
    await next(page).click(); // past the welcome
    for (const [i, target] of targets.entries()) {
      await page.waitForTimeout(350); // the spotlight eases between steps
      const spot = (await page.locator(".tour-spot").boundingBox())!;
      const el = (await page.locator(`[data-tour="${target}"]`).filter({ visible: true }).first().boundingBox())!;
      expect(Math.abs(spot.x - (el.x - 6)), `${target} x`).toBeLessThanOrEqual(3);
      expect(Math.abs(spot.y - (el.y - 6)), `${target} y`).toBeLessThanOrEqual(3);
      expect(Math.abs(spot.width - (el.width + 12)), `${target} w`).toBeLessThanOrEqual(3);
      expect(Math.abs(spot.height - (el.height + 12)), `${target} h`).toBeLessThanOrEqual(3);
      const pop = (await page.locator(ROUTE).boundingBox())!;
      const overlap = !(pop.x + pop.width <= el.x || el.x + el.width <= pop.x || pop.y + pop.height <= el.y || el.y + el.height <= pop.y);
      expect(overlap, `${target} is not covered by its own popover`).toBe(false);
      if (i < targets.length - 1) await next(page).click();
    }
  });

  test("the page behind is inert: a click through the dimness goes nowhere", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await startedFromHelp(page);
    const link = (await page.locator("a[href='/students']").boundingBox())!;
    await page.mouse.click(link.x + link.width / 2, link.y + link.height / 2);
    await expect(page).toHaveURL(/\/locks$/);
    expect(await page.locator("main").getAttribute("inert")).not.toBeNull();
    await page.keyboard.press("Escape");
    expect(await page.locator("main").getAttribute("inert")).toBeNull();
    await page.locator("a[href='/students']").click();
    await expect(page).toHaveURL(/\/students$/);
  });

  test("at 380 the nav sheet is opened for the tour and closed when it ends", async ({ page }, info) => {
    test.skip(wide(info), "the sheet exists below lg");
    await startedFromHelp(page);
    await expect(page.locator("#console-nav")).toBeVisible();
    await page.getByRole("button", { name: "Skip the tour" }).click();
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    await expect(page.locator("#console-nav")).toBeHidden();
  });

  test("the projector view has no shell, so no ? and no tour", async ({ page }) => {
    await open(page, { route: "/live/present" });
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-tour-root]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Take the tour of the console" })).toHaveCount(0);
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

test("capture: the welcome, a nav step and the account step, then opened", async ({ page }) => {
  test.setTimeout(90_000);
  const s = wide(test.info()) ? "" : "-380";
  const dir = "design/templates/console/tour";
  await page.setViewportSize({ width: wide(test.info()) ? 1440 : 380, height: wide(test.info()) ? 900 : 844 });
  await startedFromHelp(page, ADMIN);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/current-welcome${s}.png` });
  await next(page).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/current${s}.png` });
  for (let i = 0; i < 5; i += 1) await next(page).click(); // In class > ... > Teachers > Your account
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/current-account${s}.png` });
});
