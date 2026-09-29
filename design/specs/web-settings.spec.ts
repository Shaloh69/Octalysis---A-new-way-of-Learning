import { test, expect, type Page, type TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  motionStarted,
  offTokenStyles,
  recordedMotion,
  recordMotion,
  unreachableByKeyboard,
} from "./_gate";
import { S006 } from "./_stage-fixture";

/**
 * `/app/settings`, remade in the star HUD's panels (WEB-REMAKE.md §8 row 9;
 * design/templates/web/settings/SPEC.md). Accent (twelve presets and the
 * seeded hue), the callsign, the single-key shortcuts, motion. No theme picker.
 */

const ROUTE = ".set";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

async function settings(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
  await page.goto("/app/settings", { waitUntil: "domcontentloaded" });
  await page.locator(".set [data-callsign]").waitFor({ timeout: 15_000 });
}
const hueOnHtml = (page: Page) => page.evaluate(() => document.documentElement.style.getPropertyValue("--accent-hue").trim());

test.describe("/app/settings — the six gate assertions", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    await settings(page);
    expect(await clippedElements(page, ROUTE)).toEqual([]);
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await settings(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await settings(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });
  test("4 · AA computed on the star set, with the seeded and a chosen accent", async ({ page }) => {
    await settings(page);
    expect(await contrastFailures(page, ROUTE), "seeded").toEqual([]);
    await page.locator(".set-accent-opt", { hasText: "Flux" }).click();
    expect(await contrastFailures(page, ROUTE), "flux").toEqual([]);
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await settings(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("6 · reduced motion: choosing and switching do not animate", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    await recordMotion(page);
    await settings(page);
    await page.locator(".set-switch").click();
    expect((await motionStarted(page, "main", 50)).length, "nothing moved without reduced motion").toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await settings(calm);
    await calm.locator(".set-switch").click();
    await calm.locator(".set-accent-opt", { hasText: "Bus" }).click();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/app/settings — what the page owes", () => {
  test("thirteen named accents, the seeded one chosen until the student picks; no theme picker", async ({ page }) => {
    await settings(page);
    await expect(page.locator(".set-accent-opt")).toHaveCount(13);
    await expect(page.getByRole("radio", { name: "Seeded" })).toBeChecked();
    await expect(page.locator(".set")).not.toContainText(/bare metal|blueprint|phosphor theme|theme/i);
  });

  test("choosing an accent repaints the HUD now, confirms once, and survives a reload", async ({ page }) => {
    await settings(page);
    const before = await hueOnHtml(page);
    await page.locator(".set-accent-opt", { hasText: "Flux" }).click();
    const after = await hueOnHtml(page);
    expect(after).not.toBe(before);
    await expect(page.locator("[data-toaster] [role=status]")).toContainText("Accent set to Flux");
    await page.reload();
    await page.locator(".set [data-callsign]").waitFor();
    await expect(page.getByRole("radio", { name: "Flux" })).toBeChecked();
    expect(await hueOnHtml(page)).toBe(after);

    // And back to the seed.
    await page.locator(".set-accent-opt", { hasText: "Seeded" }).click();
    await expect(page.getByRole("radio", { name: "Seeded" })).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("octa:accent-hue"))).toBeNull();
  });

  test("the shortcuts switch turns single keys off, and says so", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await settings(page);
    const sw = page.getByRole("switch", { name: /single-key shortcuts/i });
    await expect(sw).toBeChecked();
    await page.locator(".set-switch").click();
    await expect(sw).not.toBeChecked();
    await expect(page.locator(".set-switch-state")).toHaveText("Off");
    await page.locator("body").press("m");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/app\/settings$/);
    await page.locator(".set-switch").click();
    await page.locator("body").press("m");
    await expect(page).toHaveURL(/\/app(\?.*)?$/);
  });

  test("the callsign is shown, in mono", async ({ page }) => {
    await settings(page);
    const c = page.locator(".set [data-callsign]");
    await expect(c).toHaveText(/[A-Z]{3,}-[0-9A-F]{2}/);
    expect(await c.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/JetBrains Mono/i);
  });

  test("the star realm, and no biome", async ({ page }) => {
    await settings(page);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    expect(await page.locator("html").getAttribute("data-biome")).toBeNull();
  });
});
