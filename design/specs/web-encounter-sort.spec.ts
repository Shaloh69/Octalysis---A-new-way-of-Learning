import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ResolvedItem } from "../../services/api/src/engine/resolve.ts";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  motionStarted,
  offTokenStyles,
  recordMotion,
  recordedMotion,
  unreachableByKeyboard,
} from "./_gate.ts";
import { forcePlanetBiome } from "./_realm-fixture.ts";
import { journeyUrl, realMoonPaper, servePaper, signIn } from "./_stage-check-fixture.ts";

/**
 * Two Columns: moon 01.2's Sort (WEB-REVAMP 3.6, approved 30 Sep 2026;
 * GAME-DESIGN.md §11), beside the moon's journey. Contract:
 * `design/templates/web/encounter-sort/SPEC.md`.
 *
 * The six gate assertions at 1440 and 380, on the encounter, in all seven
 * biomes; then what a minigame owes: it never wraps the paper, every move is a
 * button, it grades nothing and records nothing, it is never the only path,
 * and its code loads only on the moon that carries it.
 */

const MOON = "01.2";
const STAGE = "01";
const ENC = "[data-encounter]";
/** Words painted on a sprite: held to AA by packages/tokens' decoded-sprite test. */
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
  await page.locator("[data-sort]").waitFor({ timeout: 15_000 });
  return api;
}

const tray = (page: Page) => page.locator(".sort-tray");
const column = (page: Page, col: "architecture" | "organization") => page.locator(`[data-column="${col}"]`);
const compare = (page: Page) => page.getByRole("button", { name: "Compare with the book" });

/** Sort every card into the column named by its position, as a student might. */
async function sortAll(page: Page): Promise<void> {
  let n = await tray(page).locator("[data-card]").count();
  let i = 0;
  while (n > 0) {
    const card = tray(page).locator("[data-card]").first();
    await card.getByRole("button", { name: i % 3 === 0 ? "Organization" : "Architecture" }).click();
    i += 1;
    n = await tray(page).locator("[data-card]").count();
  }
}

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: to sort, half sorted, compared", async ({ page }) => {
    await open(page);
    expect(await clippedElements(page, ENC), "to sort").toEqual([]);
    await tray(page).locator("[data-card]").first().getByRole("button", { name: "Architecture" }).click();
    expect(await clippedElements(page, ENC), "half sorted").toEqual([]);
    await sortAll(page);
    await compare(page).click();
    expect(await clippedElements(page, ENC), "compared").toEqual([]);
  });

  test("2. no horizontal page scroll", async ({ page }) => {
    await open(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await sortAll(page);
    await compare(page).click();
    expect(await horizontalOverflow(page), "compared").toBeLessThanOrEqual(0);
  });

  test("3. every control is reachable by keyboard, and a card sorts by keyboard alone", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, ENC)).toEqual([]);
    const first = tray(page).locator("[data-card]").first();
    const text = (await first.locator(".sort-card-text").textContent())!;
    await first.getByRole("button", { name: "Organization" }).focus();
    await page.keyboard.press("Enter");
    await expect(column(page, "organization")).toContainText(text);
  });

  test("4. AA contrast, computed, in all seven biomes: sorted and compared", async ({ browser }, info) => {
    test.setTimeout(180_000);
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, STAGE, biome);
      await open(p);
      await tray(p).locator("[data-card]").first().getByRole("button", { name: "Architecture" }).click();
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} sorting`).toEqual([]);
      await sortAll(p);
      await compare(p).click();
      expect(await contrastFailures(p, ENC, SPRITES), `${biome} compared`).toEqual([]);
      await ctx.close();
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await open(page);
    await sortAll(page);
    expect(await offTokenStyles(page, ENC), "sorted").toEqual([]);
    await compare(page).click();
    expect(await offTokenStyles(page, ENC), "compared").toEqual([]);
  });

  test("6. reduced motion: a card lands without animating", async ({ page }) => {
    await recordMotion(page);
    await open(page);
    await tray(page).locator("[data-card]").first().getByRole("button", { name: "Architecture" }).click();
    expect((await motionStarted(page, "main")).length, "no motion without reduced motion; the control proves nothing").toBeGreaterThan(0);

    const calm = await page.context().newPage();
    await calm.emulateMedia({ reducedMotion: "reduce" });
    await recordMotion(calm);
    await open(calm);
    await tray(calm).locator("[data-card]").first().getByRole("button", { name: "Architecture" }).click();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await calm.close();
  });
});

/* ======================================================= what it owes */

test.describe("a minigame, and what it owes (WEB-REVAMP 3.6, GAME-DESIGN §8)", () => {
  test("it NEVER wraps the paper: the encounter and the runner are separate", async ({ page }) => {
    await open(page);
    await expect(page.locator(`${ENC} [data-runner], ${ENC} [data-paper]`)).toHaveCount(0);
    await expect(page.locator(`[data-runner] ${ENC}, [data-paper] ${ENC}`)).toHaveCount(0);
    await expect(page.locator(ENC)).toHaveAttribute("data-encounter", "base");
  });

  test("the cards are the book's, and Compare waits until every card is placed", async ({ page }) => {
    await open(page);
    const book = readFileSync("docs/source/book/ch-01.md", "utf8").toLowerCase();
    await expect(tray(page).locator("[data-card]")).toHaveCount(12);
    await expect(tray(page).locator("[data-card]").first()).toContainText("the instruction set");
    expect(book).toContain("the instruction set");
    await expect(compare(page)).toBeDisabled();
    await sortAll(page);
    await expect(compare(page)).toBeEnabled();
    await expect(compare(page)).toBeFocused();
  });

  test("Compare shows where the book puts each card, in the book's words, and no score", async ({ page }) => {
    await open(page);
    await sortAll(page);
    await compare(page).click();
    const cards = page.locator(`${ENC} [data-card]`);
    await expect(cards).toHaveCount(12);
    for (const card of await cards.all()) {
      await expect(card.locator(".sort-book-where")).toHaveText(/^The book puts it under (Architecture|Organization)\.$/);
      await expect(card.locator("cite")).toHaveText(/Stallings, ch\. 1, §1\.1|Stage 01, the reading/);
    }
    const text = (await page.locator(ENC).innerText()).toLowerCase();
    expect(text, "no verdict and no tally").not.toMatch(/\bcorrect\b|\bwrong\b|\bscore\b|\d+\s*(of|\/)\s*12\b/);
  });

  test("nothing is sent and nothing is recorded: sorting and comparing make no request", async ({ page }) => {
    const api = await open(page);
    const before = api.length;
    await sortAll(page);
    await compare(page).click();
    await page.getByRole("button", { name: "Sort again" }).click();
    expect(api.slice(before), "the Sort talked to the server").toEqual([]);
  });

  test("a card can be unsorted or moved; Sort again starts over", async ({ page }) => {
    await open(page);
    const first = tray(page).locator("[data-card]").first();
    const text = (await first.locator(".sort-card-text").textContent())!;
    await first.getByRole("button", { name: "Architecture" }).click();
    const placed = column(page, "architecture").locator("[data-card]").filter({ hasText: text });
    await placed.getByRole("button", { name: "To Organization" }).click();
    await expect(column(page, "organization")).toContainText(text);
    await column(page, "organization").locator("[data-card]").filter({ hasText: text }).getByRole("button", { name: "Unsort" }).click();
    await expect(tray(page)).toContainText(text);
    await sortAll(page);
    await compare(page).click();
    await page.getByRole("button", { name: "Sort again" }).click();
    await expect(tray(page).locator("[data-card]")).toHaveCount(12);
    await expect(page.locator(".sort-head h2")).toBeFocused();
  });

  test("never the only path: the moon's questions are on the page, untouched", async ({ page }) => {
    await open(page);
    await expect(page.locator("[data-runner=sitting]")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Record (answer|this order)$/ })).toBeVisible();
  });

  test("its code loads only on its own moon: not on 01.4, not in the initial HTML", async ({ page }) => {
    const chunks: string[] = [];
    page.on("request", (r) => {
      if (/TwoColumns/.test(r.url())) chunks.push(r.url());
    });
    const other = await realMoonPaper(page.request, "01.4");
    await signIn(page);
    await servePaper(page, other, { journey: "01.4" });
    await page.goto(journeyUrl("01.4"));
    await expect(page.locator("main").getByText(/Question \d+ of \d+/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(ENC)).toHaveCount(0);
    expect(chunks, "the Sort's chunk loaded on a moon without it").toEqual([]);
    const html = readFileSync("apps/web/dist/index.html", "utf8");
    expect(html).not.toMatch(/TwoColumns/);
  });

  test("the map's moon panel names the minigame on 01.2, and none on 01.4 (3.2 item 3)", async ({ page }) => {
    await signIn(page);
    await page.goto("/app?stage=01&moon=01.2");
    await page.locator(".starmap-body h2").waitFor();
    await expect(page.locator("[data-moon-game]")).toContainText("Two Columns, a sort beside its questions");
    await page.goto("/app?stage=01&moon=01.4");
    await page.locator(".starmap-body h2").waitFor();
    await expect(page.locator("[data-moon-game]")).toHaveCount(0);
  });
});
