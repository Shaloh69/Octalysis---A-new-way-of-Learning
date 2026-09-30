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
 * `/app/stages`, remade (WEB-REMAKE.md §8 row 6; design/templates/web/stages/
 * SPEC.md): No Man's Sky's discoveries, the four grading periods as systems,
 * each stage a planet row, and the chosen stage's card, the map's own.
 *
 * Student 232129006 (`_stage-fixture.ts`): 00 open, 05 mastered, 06 in
 * progress, 04 locked behind 03.
 */

const ROUTE = ".stages";
const wide = (t: TestInfo) => t.project.name === "desktop-1440";

async function stages(page: Page, path = "/app/stages"): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(".stages [data-card]").waitFor({ timeout: 15_000 });
}
/** Choose a row the way a pointer does: its label carries the radio. */
async function choose(page: Page, id: string): Promise<void> {
  await page.locator(`[data-stage-row="${id}"]`).click();
  await expect(page.locator(".stages [data-card]")).toHaveAttribute("data-card", id);
}

test.describe("/app/stages — the six gate assertions", () => {
  test("1 · nothing is clipped: the next stage, a locked one, a mastered one", async ({ page }) => {
    for (const id of ["06", "04", "05"]) {
      await stages(page, `/app/stages?stage=${id}`);
      expect(await clippedElements(page, ROUTE), id).toEqual([]);
    }
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    for (const id of ["06", "04"]) {
      await stages(page, `/app/stages?stage=${id}`);
      expect(await horizontalOverflow(page), id).toBeLessThanOrEqual(0);
    }
  });

  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await stages(page, "/app/stages?stage=04");
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });

  test("4 · AA computed on the star set: open, locked and mastered chosen", async ({ page }) => {
    for (const id of ["06", "04", "05", "00"]) {
      await stages(page, `/app/stages?stage=${id}`);
      expect(await contrastFailures(page, ROUTE), id).toEqual([]);
    }
  });

  test("5 · the token system is what rendered", async ({ page }) => {
    for (const id of ["06", "04"]) {
      await stages(page, `/app/stages?stage=${id}`);
      expect(await offTokenStyles(page, ROUTE), id).toEqual([]);
    }
  });

  test("6 · reduced motion: choosing a row does not animate", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    // Positive control: without the media feature, choosing a row eases its fill.
    await recordMotion(page);
    await stages(page);
    await choose(page, "05");
    expect((await motionStarted(page, "main", 50)).length, "nothing moved without reduced motion").toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await stages(calm);
    await choose(calm, "05");
    await choose(calm, "04");
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("/app/stages — what the list owes", () => {
  test("all 19 stages, in syllabus order, four systems, locked ones included", async ({ page }) => {
    await stages(page);
    const ids = await page.locator("[data-stage-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-stage-row")));
    expect(ids).toEqual(Array.from({ length: 19 }, (_, i) => String(i).padStart(2, "0")));
    await expect(page.locator(".stages-system")).toHaveCount(4);
    await expect(page.locator('[data-stage-row][data-state="locked"]').first()).toBeVisible();
  });

  test("the Finals says it is cumulative, on its system row (lib/acts.ts)", async ({ page }) => {
    await stages(page);
    await expect(page.locator(".stages-system").last()).toContainText(/Finals/);
    await expect(page.locator(".stages-system").last().locator(".stages-system-note")).toHaveText(/cumulative/);
  });

  test("every locked row prints the server's reason, on the row, never behind a hover", async ({ page, request }) => {
    await stages(page);
    const res = await request.get(`${process.env.OCTA_API_URL ?? "http://localhost:8090"}/api/v1/stages`, {
      headers: { Authorization: `Bearer ${S006}` },
    });
    const { nodes } = (await res.json()) as { nodes: Array<{ id: string; state: string; lockReason: { message: string } | null }> };
    const locked = nodes.filter((n) => n.state === "locked" && n.lockReason);
    expect(locked.length).toBeGreaterThan(0);
    for (const n of locked) {
      await expect(page.locator(`[data-stage-row="${n.id}"] .stages-planet-lock`)).toHaveText(n.lockReason!.message);
    }
  });

  test("with nothing chosen, the card is the student's next stage, and its row says next", async ({ page }) => {
    // 01, since 30 Sep 2026: a non-gradeable prerequisite never blocks
    // (WEB-REVAMP 3.7), so the seeded student's 01 at 65% is open and unfinished,
    // and it comes before 06 in the syllabus.
    await stages(page);
    await expect(page.locator(".stages [data-card]")).toHaveAttribute("data-card", "01");
    await expect(page.locator('[data-stage-row="01"]')).toContainText(/next/i);
    await expect(page.getByRole("radio", { name: /^01/ })).toBeChecked();
  });

  test("one Tab stop; arrow keys walk the syllabus and the card follows", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await stages(page, "/app/stages?stage=04");
    await page.getByRole("radio", { name: /^04/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/\?stage=05$/);
    await expect(page.locator("#stages-card-title")).toHaveText(await page.locator('[data-stage-row="05"] [data-stage-title]').innerText());
    await page.keyboard.press("Tab");
    // Out of the group in one press: the next stop is in the card, not another row.
    const inCard = await page.evaluate(() => !!document.activeElement?.closest("[data-card]"));
    expect(inCard, "Tab left the row group for another row").toBe(true);
  });

  test("the card is the map's: a locked stage says why, beside a padlock, and Show Stage NN moves to it", async ({ page }) => {
    await stages(page, "/app/stages?stage=04");
    const lock = page.locator(".stages-card .starmap-lock");
    await expect(lock).toContainText(/Unlocks when Stage 03/);
    await expect(lock.locator("svg")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Enter journey" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show Stage 03" }).click();
    await expect(page).toHaveURL(/\?stage=03$/);
    await expect(page.locator(".stages [data-card]")).toHaveAttribute("data-card", "03");
  });

  test("Show on the map opens the same planet on the map", async ({ page }) => {
    await stages(page, "/app/stages?stage=05");
    const title = await page.locator("#stages-card-title").innerText();
    await page.getByRole("link", { name: "Show on the map" }).click();
    await expect(page).toHaveURL(/\/app\?stage=05$/);
    // The map's BODY panel, open on the same planet (a phone folds the row away).
    await expect(page.locator(".starmap-body h2")).toHaveText(title);
  });

  test("Enter journey goes into the planet, and its biome", async ({ page }) => {
    await stages(page, "/app/stages?stage=06");
    await page.getByRole("link", { name: "Enter journey" }).click();
    await expect(page).toHaveURL(/\/app\/stage\/06$/);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "biome");
  });

  test("the star realm, and no biome", async ({ page }) => {
    await stages(page);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    expect(await page.locator("html").getAttribute("data-biome")).toBeNull();
  });

  test("on a phone the card opens under its own row", async ({ page }, info) => {
    test.skip(wide(info), "the 380 case");
    await stages(page, "/app/stages?stage=04");
    const inRow = await page.locator('[data-stage-row="04"]').evaluate((el) => !!el.parentElement?.querySelector("[data-card]"));
    expect(inRow).toBe(true);
    await choose(page, "05");
    expect(await page.locator('[data-stage-row="05"]').evaluate((el) => !!el.parentElement?.querySelector("[data-card]"))).toBe(true);
    await expect(page.locator("[data-card]")).toHaveCount(1);
  });
});

test.describe("/app/stages — loading and failing", () => {
  test("a failed load says so, with Try again that loads", async ({ page }) => {
    let fail = true;
    await page.route("**/api/v1/stages", (r) => (fail ? r.fulfill({ status: 500, json: { error: { code: "internal", message: "Something went wrong on our side." } } }) : r.fallback()));
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/stages");
    await expect(page.locator(".stages [role=alert]")).toBeVisible({ timeout: 15_000 });
    fail = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.locator(".stages [data-card]").waitFor({ timeout: 15_000 });
  });

  test("loading: nothing under 400ms, a skeleton after, words after 3s", async ({ page }, info) => {
    test.skip(!wide(info), "timing, one width");
    await page.route("**/api/v1/stages", async (r) => {
      await new Promise((f) => setTimeout(f, 4_500));
      await r.fallback();
    });
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
    await page.goto("/app/stages");
    await page.waitForTimeout(150);
    await expect(page.locator(".stages [data-skeleton]")).toHaveCount(0);
    await expect(page.locator(".stages [data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await expect(page.locator(".stages")).toContainText(/still loading/i, { timeout: 4_000 });
    await page.locator(".stages [data-card]").waitFor({ timeout: 10_000 });
  });
});
