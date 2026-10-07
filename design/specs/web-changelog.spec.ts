import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordedMotion, recordMotion, unreachableByKeyboard,
} from "./_gate";
import { S006 } from "./_stage-fixture";

/**
 * `/app/changelog`, What's new (7 Oct 2026, night;
 * design/templates/web/changelog/SPEC.md). The student's changes only, and
 * one line of the redesign's progress, from the committed
 * `apps/web/src/generated/changelog.json` (`pnpm changelog`).
 */

const ROUTE = ".news";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";
const DATA = JSON.parse(readFileSync("apps/web/src/generated/changelog.json", "utf8")) as {
  progress: { done: number; total: number; pct: number };
  updates: Array<{ date: string; title: string; items: string[] }>;
};

async function news(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
  await page.goto("/app/changelog", { waitUntil: "domcontentloaded" });
  await page.locator(".news [data-update]").first().waitFor({ timeout: 15_000 });
}

test.describe("/app/changelog — the six gate assertions", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    await news(page);
    expect(await clippedElements(page, ROUTE)).toEqual([]);
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await news(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await news(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
    expect(await unreachableByKeyboard(page, ".star-top")).toEqual([]);
  });
  test("4 · AA computed on the star set", async ({ page }) => {
    await news(page);
    expect(await contrastFailures(page, ROUTE)).toEqual([]);
    expect(await contrastFailures(page, ".star-top")).toEqual([]);
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await news(page);
    expect(await offTokenStyles(page, ROUTE)).toEqual([]);
  });
  test("6 · reduced motion: the strip's link does not ease", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    await recordMotion(page);
    await news(page);
    await page.locator(".star-news").hover();
    await page.locator(".star-signout").hover();
    expect((await motionStarted(page, "shell", 50)).length, "the link eases without reduced motion").toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await news(calm);
    await calm.locator(".star-news").hover();
    await calm.locator(".star-signout").hover();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/app/changelog — what the page owes", () => {
  test("every student update in the file, newest first, with its items", async ({ page }) => {
    await news(page);
    await expect(page.locator("[data-update]")).toHaveCount(DATA.updates.length);
    const first = DATA.updates[0]!;
    const card = page.locator(`[data-update="${first.date}"]`);
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(first.title);
    await expect(card.locator(".news-items li")).toHaveCount(first.items.length);
  });

  test("the progress line says the redesign's steps, as the file counts them", async ({ page }) => {
    await news(page);
    await expect(page.locator(".news-progress-line")).toHaveText(
      `The student app's redesign: ${DATA.progress.done} of ${DATA.progress.total} steps done (${DATA.progress.pct}%).`,
    );
  });

  test("no jargon: no phase id, commit hash or console route", async ({ page }) => {
    await news(page);
    const text = (await page.locator(".news").innerText()).replace(/\s+/g, " ");
    expect(text).not.toMatch(/\bR[0-5]\b|\bP\d{1,2}\b|\b[0-9a-f]{7}\b|\/console|\bconsole\b|\bapproval\b|\bfeat\b|\bapi\b/i);
  });

  test("What's new in the top strip opens it from another star page, and is current there", async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/settings", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "What's new" }).click();
    await expect(page).toHaveURL(/\/app\/changelog$/);
    await expect(page.getByRole("link", { name: "What's new" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/What's new/i);
  });

  test("the star realm, and no biome", async ({ page }) => {
    await news(page);
    expect(await page.evaluate(() => document.documentElement.dataset.realm)).toBe("star");
    expect(await page.evaluate(() => document.documentElement.dataset.biome ?? null)).toBeNull();
  });

  test("capture: current and current-380, then opened", async ({ page }, info) => {
    const s = wide(info) ? "" : "-380";
    await news(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `design/templates/web/changelog/current${s}.png`, fullPage: true });
  });
});
