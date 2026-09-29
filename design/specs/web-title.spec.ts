import { test, expect, type TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  recordedMotion,
  recordMotion,
  unreachableByKeyboard,
} from "./_gate";

/**
 * The title screen (WEB-REMAKE.md §8 row 10; design/templates/web/title/
 * SPEC.md): Starfield's main menu, worn by `/login`, `/register`,
 * `/maintenance` and the 404. Signed out; the star realm.
 */

const ROUTES = ["/login", "/register", "/maintenance", "/no-such-page"] as const;
const ROUTE = ".title";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

test.describe("the title screen — the six gate assertions, on all four routes", () => {
  for (const path of ROUTES) {
    test(`${path}: nothing clipped, no sideways scroll, keyboard, AA, tokens`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.locator(".title [data-title], .title").first().waitFor();
      expect(await clippedElements(page, ROUTE), "1 clipped").toEqual([]);
      expect(await horizontalOverflow(page), "2 overflow").toBeLessThanOrEqual(0);
      expect(await unreachableByKeyboard(page, "main"), "3 keyboard").toEqual([]);
      expect(await contrastFailures(page, ROUTE), "4 contrast").toEqual([]);
      expect(await offTokenStyles(page, ROUTE), "5 tokens").toEqual([]);
    });
  }

  test("6 · reduced motion: nothing moves on arrival or on the menu", async ({ browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const page = await ctx.newPage();
    await recordMotion(page);
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Claim your account" }).first().hover();
    await page.getByRole("link", { name: "Claim your account" }).first().click();
    await expect(page).toHaveURL(/\/register$/);
    const long = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("the title screen — what it owes", () => {
  test("every route is a page: one main, one h1; the star realm, no biome", async ({ page }) => {
    for (const path of ROUTES) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page.locator("main"), path).toHaveCount(1);
      await expect(page.locator("h1"), path).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
      expect(await page.locator("html").getAttribute("data-biome")).toBeNull();
    }
  });

  test("the menu marks where you are", async ({ page }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    const cur = page.locator('.title-menu [aria-current="page"]');
    await expect(cur).toHaveCount(1);
    await expect(cur).toHaveText("Claim your account");
  });

  test("sign in: the form works from the first paint, and a failure is one generic fault line", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await page.route("**/auth/**", (r) => r.fulfill({ status: 400, json: { error: { code: "invalid", message: "Check your ID and password." } } }));
    await page.route("**/api/v1/auth/**", (r) => r.fulfill({ status: 400, json: { error: { code: "invalid", message: "Check your ID and password." } } }));
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Student ID").fill("232129999");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const fault = page.locator(".title-fault[role=alert]");
    await expect(fault).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test("register refuses a short password in the browser, and says why", async ({ page }) => {
    await page.goto("/register", { waitUntil: "networkidle" });
    await page.getByLabel("Password", { exact: true }).fill("short");
    await expect(page.locator("#pw-hint")).toHaveClass(/title-warn/);
    await expect(page.getByRole("button", { name: "Claim account" })).toBeDisabled();
  });

  test("maintenance says the data is safe, in words", async ({ page }) => {
    await page.goto("/maintenance", { waitUntil: "networkidle" });
    await expect(page.locator(".title-card")).toContainText(/Your data\s*Safe/i);
  });
});
