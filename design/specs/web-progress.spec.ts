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
import { S006 } from "./_stage-fixture";

/**
 * `/app/progress`, remade (WEB-REMAKE.md §8 row 7; design/templates/web/
 * progress/SPEC.md): Starfield's character menu. The depth emblem, the survey,
 * and the 21 cells as three panels of labelled meters, against the real API.
 */

const ROUTE = ".prog";
const API = process.env.OCTA_API_URL ?? "http://localhost:8090";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

async function progress(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
  await page.goto("/app/progress", { waitUntil: "domcontentloaded" });
  await page.locator(".prog [data-cell]").first().waitFor({ timeout: 15_000 });
}

test.describe("/app/progress — the six gate assertions", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    await progress(page);
    expect(await clippedElements(page, ROUTE)).toEqual([]);
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await progress(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await progress(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });
  test("4 · AA computed on the star set", async ({ page }) => {
    await progress(page);
    expect(await contrastFailures(page, ROUTE)).toEqual([]);
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await progress(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("6 · reduced motion: nothing on the page moves", async ({ browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const page = await ctx.newPage();
    await recordMotion(page);
    await progress(page);
    await page.waitForTimeout(500);
    const long = (await recordedMotion(page)).filter((m) => m.ms > 1 && m.on.startsWith("main"));
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/app/progress — what the page owes", () => {
  test("all 21 cells, each printing the API's mastery, or saying no objective reaches it", async ({ page, request }) => {
    await progress(page);
    const res = await request.get(`${API}/api/v1/progress`, { headers: { Authorization: `Bearer ${S006}` } });
    const { grid, depth } = (await res.json()) as {
      grid: Array<{ level: number; competency: string; mastery: number; objectives: number }>;
      depth: number;
    };
    await expect(page.locator(".prog [data-cell]")).toHaveCount(21);
    for (const g of grid) {
      const cell = page.locator(`[data-cell="${g.competency}-${g.level}"]`);
      await expect(cell).toContainText(`L${g.level}`);
      if (g.objectives === 0) await expect(cell).toContainText(/No objective yet/);
      else await expect(cell.locator(".prog-meter-value")).toHaveText(`${Math.round(g.mastery * 100)}%`);
    }
    await expect(page.locator(".prog-depth-label")).toContainText(`L${depth}`);
  });

  test("every number is mono, and there is no XP, no points", async ({ page }) => {
    await progress(page);
    const fonts = await page.locator(".prog .prog-meter-value.mono").evaluateAll((els) => els.map((e) => getComputedStyle(e).fontFamily));
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) expect(f).toMatch(/JetBrains Mono/i);
    expect(await page.locator(".prog").innerText()).not.toMatch(/\bXP\b|\bpoints?\b/i);
  });

  test("the star realm, and no biome", async ({ page }) => {
    await progress(page);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    expect(await page.locator("html").getAttribute("data-biome")).toBeNull();
  });

  test("a failed load is the page: an h1, the reason, and Try again that loads", async ({ page }) => {
    let fail = true;
    await page.route("**/api/v1/progress", (r) => (fail ? r.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong on our side." } } }) : r.fallback()));
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/progress");
    const err = page.locator(".state-error");
    await expect(err).toBeVisible({ timeout: 15_000 });
    await expect(err.locator("h1")).toHaveCount(1);
    fail = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.locator(".prog [data-cell]").first().waitFor({ timeout: 15_000 });
  });

  test("loading: nothing under 400ms, a skeleton after, words after 3s", async ({ page }, info) => {
    test.skip(!wide(info), "timing, one width");
    await page.route("**/api/v1/progress", async (r) => {
      await new Promise((f) => setTimeout(f, 4_500));
      await r.fallback();
    });
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/progress");
    await page.waitForTimeout(150);
    await expect(page.locator(".prog [data-skeleton]")).toHaveCount(0);
    await expect(page.locator(".prog [data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await expect(page.locator(".prog")).toContainText(/still loading/i, { timeout: 4_000 });
    await page.locator(".prog [data-cell]").first().waitFor({ timeout: 10_000 });
  });
});
