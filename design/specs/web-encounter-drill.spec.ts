import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ResolvedItem } from "../../services/api/src/engine/resolve.ts";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  recordMotion,
  recordedMotion,
  unreachableByKeyboard,
} from "./_gate.ts";
import { forcePlanetBiome } from "./_realm-fixture.ts";
import { journeyUrl, realMoonPaper, servePaper, signIn } from "./_stage-check-fixture.ts";

/**
 * Clock Bench: moon 02.8's Drill (WEB-REVAMP 3.6, approved 30 Sep 2026;
 * GAME-DESIGN.md §11), beside the moon's journey. Contract:
 * `design/templates/web/encounter-drill/SPEC.md`.
 *
 * The book's Example 2.2 on a bench: two dials and the book's relations
 * answering. At the book's settings it must read what the book reads.
 */

const MOON = "02.8";
const STAGE = "02";
const ENC = "[data-encounter]";
const SPRITES = ".sprite-bar, .sprite-button";
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;

let items: ResolvedItem[];
test.beforeAll(async ({ request }) => {
  items = await realMoonPaper(request, MOON);
});

async function open(page: Page): Promise<string[]> {
  const api: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) api.push(`${r.method()} ${r.url()}`);
  });
  await signIn(page);
  await servePaper(page, items, { journey: MOON });
  await page.goto(journeyUrl(MOON));
  await expect(page.locator("main").getByText(/Question \d+ of \d+/).first()).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-bench]").waitFor({ timeout: 15_000 });
  return api;
}

const readout = (page: Page, k: string) => page.locator(`[data-readout="${k}"]`);
const dial = (page: Page, name: RegExp) => page.getByRole("slider", { name });

async function setDial(page: Page, name: RegExp, value: number): Promise<void> {
  await dial(page, name).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped, at the book's settings and at the dials' ends", async ({ page }) => {
    await open(page);
    expect(await clippedElements(page, ENC), "book").toEqual([]);
    await setDial(page, /Clock frequency/, 4000);
    await setDial(page, /cache miss/, 30);
    expect(await clippedElements(page, ENC), "dials at their ends").toEqual([]);
  });

  test("2. no horizontal page scroll", async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3. every control is reachable by keyboard, and a dial turns by keyboard", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, ENC)).toEqual([]);
    await dial(page, /Clock frequency/).focus();
    await page.keyboard.press("ArrowRight");
    await expect(readout(page, "f")).toHaveText("500 MHz");
    await expect(readout(page, "mips")).toHaveText("223.2");
  });

  test("4. AA contrast, computed, in all seven biomes", async ({ browser }, info) => {
    test.setTimeout(180_000);
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, STAGE, biome);
      await open(p);
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} book`).toEqual([]);
      await setDial(p, /cache miss/, 20);
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} turned`).toEqual([]);
      await ctx.close();
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await open(page);
    expect(await offTokenStyles(page, ENC)).toEqual([]);
  });

  test("6. motion: the bench has none by design, and turning a dial starts none", async ({ page }) => {
    // Nothing on the bench animates (motion.md): the readouts change in place.
    // So there is no positive control to run; the claim checked is the whole
    // claim, with and without reduced motion.
    await recordMotion(page);
    await open(page);
    await setDial(page, /Clock frequency/, 1200);
    await setDial(page, /cache miss/, 25);
    const moved = (await recordedMotion(page)).filter((m) => m.on.includes("bench") && m.ms > 1);
    expect(moved, JSON.stringify(moved)).toEqual([]);
  });
});

/* ======================================================= what it owes */

test.describe("a bench on the book's own example", () => {
  test("at the book's settings it reads what the book reads", async ({ page }) => {
    await open(page);
    await expect(readout(page, "f")).toHaveText("400 MHz");
    await expect(readout(page, "miss")).toHaveText("10%");
    await expect(readout(page, "t")).toHaveText("2.500 ns");
    await expect(readout(page, "cpi")).toHaveText("2.24");
    await expect(readout(page, "mips")).toHaveText("178.6");
    await expect(readout(page, "T")).toHaveText("11.20 ms");
    const book = readFileSync("docs/source/book/ch-02.md", "utf8").replace(/\s+/g, " ");
    const quote = (await page.locator(".bench-sources q").first().textContent())!;
    expect(book).toContain(quote);
    await expect(page.getByRole("button", { name: "Back to the book’s example" })).toBeDisabled();
  });

  test("more cache misses: the arithmetic row gives way, and CPI climbs 0.07 a point", async ({ page }) => {
    await open(page);
    await setDial(page, /cache miss/, 20);
    await expect(readout(page, "cpi")).toHaveText("2.94");
    const rows = page.locator(".bench-table tbody tr");
    await expect(rows.filter({ hasText: "Arithmetic and logic" }).locator("td").last()).toHaveText("50%");
    await expect(rows.filter({ hasText: "Memory reference with cache miss" }).locator("td").last()).toHaveText("20%");
    // The book's sentence is only quoted where the bench matches the book.
    await expect(page.locator(".bench-sources")).not.toContainText("= 2.24");
    await page.getByRole("button", { name: "Back to the book’s example" }).click();
    await expect(readout(page, "cpi")).toHaveText("2.24");
  });

  test("it grades nothing and sends nothing", async ({ page }) => {
    const api = await open(page);
    const before = api.length;
    await setDial(page, /Clock frequency/, 2000);
    await setDial(page, /cache miss/, 5);
    await page.getByRole("button", { name: "Back to the book’s example" }).click();
    expect(api.slice(before), "the bench talked to the server").toEqual([]);
    const text = (await page.locator(ENC).innerText()).toLowerCase();
    expect(text).not.toMatch(/\bcorrect\b|\bwrong\b|\bscore\b/);
    await expect(page.locator(`${ENC} input:not([type=range])`)).toHaveCount(0);
  });

  test("it NEVER wraps the paper, and the moon's questions stand on their own", async ({ page }) => {
    await open(page);
    await expect(page.locator(`${ENC} [data-runner], ${ENC} [data-paper]`)).toHaveCount(0);
    await expect(page.locator(`[data-runner] ${ENC}, [data-paper] ${ENC}`)).toHaveCount(0);
    await expect(page.locator(ENC)).toHaveAttribute("data-encounter", "switchboard");
    await expect(page.locator("[data-runner=sitting]")).toBeVisible();
  });

  test("its code loads only on its own moon, and the map's moon panel names it", async ({ page }) => {
    const chunks: string[] = [];
    page.on("request", (r) => {
      if (/ClockBench/.test(r.url())) chunks.push(r.url());
    });
    const other = await realMoonPaper(page.request, "01.2");
    await signIn(page);
    await servePaper(page, other, { journey: "01.2" });
    await page.goto(journeyUrl("01.2"));
    await page.locator("[data-sort]").waitFor({ timeout: 15_000 });
    expect(chunks, "the bench's chunk loaded on another moon").toEqual([]);
    expect(readFileSync("apps/web/dist/index.html", "utf8")).not.toMatch(/ClockBench/);
    await page.goto("/app?stage=02&moon=02.8");
    await page.locator(".starmap-body h2").waitFor();
    await expect(page.locator("[data-moon-game]")).toContainText("Clock Bench, a drill beside its questions");
  });
});
