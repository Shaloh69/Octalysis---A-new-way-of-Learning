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
 * Cache Tuner: moon 04.5's Cache drill (WEB-REVAMP 3.6, approved 30 Sep 2026),
 * beside the moon's journey. Contract: `design/templates/web/encounter-cache/SPEC.md`.
 * The book's Example 4.2 on a bench: the address splits as the dials say, and
 * on each sourced example it reads what the source reads.
 */

const MOON = "04.5";
const STAGE = "04";
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
  await page.locator("[data-cache-tuner]").waitFor({ timeout: 15_000 });
  return api;
}

const readout = (page: Page, k: string) => page.locator(`[data-readout="${k}"]`);
const field = (page: Page, name: string) => page.locator(`.addr-field[data-field="${name}"] .mono`);

async function setDial(page: Page, name: RegExp, exp: number): Promise<void> {
  await page.getByRole("slider", { name }).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, exp);
}
const mapping = (page: Page, name: string) => page.getByRole("radio", { name }).check();

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: direct, fully associative, and at the dials' ends", async ({ page }) => {
    await open(page);
    expect(await clippedElements(page, ENC), "direct").toEqual([]);
    await mapping(page, "Fully associative");
    expect(await clippedElements(page, ENC), "fully associative").toEqual([]);
    await mapping(page, "8-way set associative");
    await setDial(page, /Cache size/, 10);
    await setDial(page, /Line size/, 7);
    expect(await clippedElements(page, ENC), "smallest cache, longest line, 8-way").toEqual([]);
  });

  test("2. no horizontal page scroll", async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3. every control is reachable by keyboard, and a dial turns by keyboard", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, ENC)).toEqual([]);
    await page.getByRole("slider", { name: /Cache size/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(readout(page, "size")).toHaveText("128 KB");
    await expect(field(page, "LINE")).toHaveText("15");
  });

  test("4. AA contrast, computed, in all seven biomes", async ({ browser }, info) => {
    test.setTimeout(180_000);
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, STAGE, biome);
      await open(p);
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} direct`).toEqual([]);
      await mapping(p, "4-way set associative");
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} 4-way`).toEqual([]);
      await ctx.close();
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await open(page);
    expect(await offTokenStyles(page, ENC)).toEqual([]);
  });

  test("6. motion: the bench has none by design, and changing it starts none", async ({ page }) => {
    await recordMotion(page);
    await open(page);
    await setDial(page, /Cache size/, 18);
    await mapping(page, "2-way set associative");
    const moved = (await recordedMotion(page)).filter((m) => m.ms > 1 && /bench|addr/.test(m.on));
    expect(moved, JSON.stringify(moved)).toEqual([]);
  });
});

/* ======================================================= what it owes */

test.describe("the book's Example 4.2, on a bench", () => {
  test("it opens on the book's example, and reads it as the book does: 8, 14, 2", async ({ page }) => {
    await open(page);
    await expect(readout(page, "size")).toHaveText("64 KB");
    await expect(readout(page, "line")).toHaveText("4 B");
    await expect(readout(page, "lines")).toHaveText("16,384");
    await expect(field(page, "TAG")).toHaveText("8");
    await expect(field(page, "LINE")).toHaveText("14");
    await expect(field(page, "WORD")).toHaveText("2");
    const quote = (await page.locator("[data-sourced] q").textContent())!;
    const book = readFileSync("docs/source/book/ch-04.md", "utf8").replace(/\s+/g, " ");
    expect(book).toContain(quote);
  });

  test("each sourced example reads what its source reads", async ({ page }) => {
    await open(page);
    const cases: Array<[string, number, number, Record<string, string>]> = [
      ["Fully associative", 16, 2, { TAG: "22", WORD: "2" }],
      ["2-way set associative", 16, 2, { TAG: "9", SET: "13", WORD: "2" }],
      ["Direct mapped", 16, 4, { TAG: "8", LINE: "12", WORD: "4" }],
      ["4-way set associative", 16, 4, { TAG: "10", SET: "10", WORD: "4" }],
    ];
    for (const [map, size, line, want] of cases) {
      await setDial(page, /Cache size/, size);
      await setDial(page, /Line size/, line);
      await mapping(page, map);
      for (const [name, bits] of Object.entries(want)) await expect(field(page, name), `${map} ${name}`).toHaveText(bits);
      await expect(page.locator("[data-sourced]"), map).toBeVisible();
    }
    await expect(page.locator(".addr-field[data-field=LINE]")).toHaveCount(0);
  });

  test("off a sourced example it computes, and quotes nothing", async ({ page }) => {
    await open(page);
    await setDial(page, /Line size/, 3);
    await expect(page.locator("[data-sourced]")).toHaveCount(0);
    await expect(field(page, "WORD")).toHaveText("3");
    await expect(field(page, "LINE")).toHaveText("13");
    await expect(field(page, "TAG")).toHaveText("8");
    await page.getByRole("button", { name: "Stage 04’s example" }).click();
    await expect(readout(page, "line")).toHaveText("16 B");
    await expect(page.locator("[data-sourced]")).toContainText("Stage 04, the reading");
  });

  test("it grades nothing and sends nothing", async ({ page }) => {
    const api = await open(page);
    const before = api.length;
    await setDial(page, /Cache size/, 12);
    await mapping(page, "8-way set associative");
    await page.getByRole("button", { name: "The book’s Example 4.2" }).click();
    expect(api.slice(before), "the bench talked to the server").toEqual([]);
    const text = (await page.locator(ENC).innerText()).toLowerCase();
    expect(text).not.toMatch(/\bcorrect\b|\bwrong\b|\bscore\b|hit rate/);
  });

  test("it NEVER wraps the paper; its code loads only on its own moon; the map names it", async ({ page }) => {
    await open(page);
    await expect(page.locator(`${ENC} [data-runner], ${ENC} [data-paper]`)).toHaveCount(0);
    await expect(page.locator(`[data-runner] ${ENC}, [data-paper] ${ENC}`)).toHaveCount(0);
    await expect(page.locator(ENC)).toHaveAttribute("data-encounter", "retro");
    expect(readFileSync("apps/web/dist/index.html", "utf8")).not.toMatch(/CacheTuner/);
    await page.goto("/app?stage=04&moon=04.5");
    await page.locator(".starmap-body h2").waitFor();
    await expect(page.locator("[data-moon-game]")).toContainText("Cache Tuner, a cache drill beside its questions");
  });
});
