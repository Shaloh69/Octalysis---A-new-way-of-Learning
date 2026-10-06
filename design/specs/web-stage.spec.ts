import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Page, TestInfo } from "@playwright/test";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  recordMotion,
  recordedMotion,
  unreachableByKeyboard,
} from "./_gate.ts";
import { openStage, realStage, S004, type StageBody } from "./_stage-fixture.ts";
import { forcePlanetBiome } from "./_realm-fixture.ts";

/** Ruling 2 (30 Sep 2026): no variants; a planet is one of seven biomes. */
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;
/** Words painted on a sprite: held to AA by packages/tokens' decoded-sprite test. */
const SPRITES = ".sprite-bar, .sprite-button";

/**
 * `/app/stage/:id`: the stage reader, the second student route through the
 * gate (`WEB-REVAMP.md` §6). `design/templates/web/stage/SPEC.md` is what this
 * holds the page to: the six gate assertions at 1440 and 380, then what the
 * instructor decided on 29 Sep 2026 (leave only, with the reverse transition;
 * resume per device; the lock reason from the server; a rail of what has data).
 *
 * Every stage here is the REAL API's, as two seeded students
 * (`_stage-fixture.ts`); patches only stand in for a failed, slow or empty read.
 */

const wide = (t: TestInfo) => t.project.name === "desktop-1440";

/*
 * The route's own surfaces. The shell's nav is INSIDE `<main>` (App.tsx) and
 * its translucent background is the shell's to fix (NEXT-SESSION §0p.2), so
 * the surface checks read the reader; keyboard reachability walks all of main.
 */
const ROUTE = "[data-reader], [data-toaster]";

const reading = (page: Page) => page.locator("[data-reading]");
const back = (page: Page) => page.getByRole("link", { name: "Back to the map", exact: true });

/**
 * Is the element actually on top where it is drawn, not painted under the
 * biome? The biome is `pointer-events: none`, and `elementFromPoint` SKIPS
 * such elements, so a naive probe reports the old reader's back link and lock
 * card "on top" while both were painted under the scene (measured 29 Sep
 * 2026). So the scene is made hit-testable for the one question, then put back.
 */
async function onTop(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().evaluate((el) => {
    const scenes = [...document.querySelectorAll<HTMLElement>(".biome, .biome *")];
    const was = scenes.map((s) => s.style.pointerEvents);
    scenes.forEach((s) => (s.style.pointerEvents = "auto"));
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 20), r.top + Math.min(r.height / 2, 10));
    scenes.forEach((s, i) => (s.style.pointerEvents = was[i]!));
    return !!hit && (hit === el || el.contains(hit));
  });
}

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: a long stage, the widest figure and table", async ({ page, browser }, info) => {
    await openStage(page, "06");
    expect(await clippedElements(page, ROUTE), "stage 06").toEqual([]);
    // A second student, so a second context: the dev token is per origin.
    const ctx = await browser.newContext({ viewport: page.viewportSize()!, baseURL: info.project.use.baseURL });
    const p = await ctx.newPage();
    await openStage(p, "07", { token: S004 });
    expect(await clippedElements(p, ROUTE), "stage 07, 73-character figure and 4-column table").toEqual([]);
    await ctx.close();
  });

  test("1b. the lock card is clipped nowhere", async ({ page }) => {
    await openStage(page, "02", { wait: "locked" });
    expect(await clippedElements(page, ROUTE)).toEqual([]);
  });

  test("2. no horizontal page scroll, on the widest stage and the lock", async ({ page, browser }, info) => {
    await openStage(page, "06");
    expect(await horizontalOverflow(page), "stage 06").toBeLessThanOrEqual(0);
    const ctx = await browser.newContext({ viewport: page.viewportSize()!, baseURL: info.project.use.baseURL });
    const p = await ctx.newPage();
    await openStage(p, "07", { token: S004 });
    expect(await horizontalOverflow(p), "stage 07").toBeLessThanOrEqual(0);
    await ctx.close();
    await openStage(page, "02", { wait: "locked" });
    expect(await horizontalOverflow(page), "locked 02").toBeLessThanOrEqual(0);
  });

  test("3. every control is reachable by keyboard", async ({ page }) => {
    await openStage(page, "06");
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });

  test("4. AA contrast, computed, in all seven biomes: reading, lock, sheet", async ({ browser }, info) => {
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      // Stage 07: callouts, quotes, a table, figures and the check, in one reading.
      await forcePlanetBiome(p, "07", biome);
      await openStage(p, "07", { token: S004 });
      if (!wide(info)) await p.getByRole("button", { name: /^Contents/ }).click();
      expect(await contrastFailures(p, ROUTE, SPRITES), `07 ${biome}`).toEqual([]);
      const q = await ctx.newPage();
      await forcePlanetBiome(q, "02", biome);
      await openStage(q, "02", { wait: "locked" });
      expect(await contrastFailures(q, ROUTE, SPRITES), `locked ${biome}`).toEqual([]);
      await ctx.close();
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await openStage(page, "06");
    expect(await offTokenStyles(page, ROUTE), "reading").toEqual([]);
    await openStage(page, "02", { wait: "locked" });
    expect(await offTokenStyles(page, ROUTE), "locked").toEqual([]);
  });

  test("6. prefers-reduced-motion: no arrival, no easing, and leaving cuts", async ({ page }) => {
    // Positive control first: without the media feature, the reading arrives.
    await recordMotion(page);
    await openStage(page, "06");
    await page
      .waitForFunction(() => ((window as unknown as { __motion?: Array<{ name: string }> }).__motion ?? [])
        .some((m) => m.name === "rd-enter"), undefined, { timeout: 3000 })
      .catch(() => undefined);
    const entered = (await recordedMotion(page)).filter((m) => m.name === "rd-enter" && m.ms >= 100);
    expect(entered.length, "no arrival recorded without reduced motion; the control proves nothing").toBeGreaterThan(0);

    const calm = await page.context().newPage();
    await calm.emulateMedia({ reducedMotion: "reduce" });
    await recordMotion(calm);
    await openStage(calm, "06");
    await calm.locator("[data-rail] a, [data-sheet] a").first().evaluate((a) => (a as HTMLElement).click());
    await calm.waitForTimeout(300);
    const long = (await recordedMotion(calm)).filter((m) => m.on.startsWith("main") && m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    // Leaving is a cut: the map's URL at once (this planet selected), no warp.
    await back(calm).first().click();
    await expect(calm).toHaveURL(/\/app\?stage=06$/, { timeout: 1000 });
    expect(await calm.locator(".realm-warp").count(), "a warp under reduced motion").toBe(0);
    await calm.close();
  });
});

/* ======================================================= the reading itself */

test.describe("the reading, verbatim and rendered (NEXT-SESSION §0j.3)", () => {
  test("a ## heading is a heading, and no hash reaches the page", async ({ page, request }) => {
    const api = await realStage(request, "06");
    const sections = api.blocks
      .filter((b) => b.kind !== "code")
      .flatMap((b) => b.body.split("\n").filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim()));
    await openStage(page, "06");
    await expect(reading(page).locator("h2")).toHaveText(sections);
    expect(await reading(page).innerText()).not.toMatch(/(^|\n)#{2,3} /);
  });

  test("a wrapped list is a list: stage 04's two kinds of locality", async ({ page }) => {
    await openStage(page, "04", { token: S004 });
    // A regex anchored at the start: "temporal locality" also appears inside the LRU item.
    const item = reading(page).locator("li", { hasText: /^Temporal locality/ });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("Loop counters, the top of the stack.");
    await expect(item).not.toContainText("- ");
    await expect(reading(page).locator("li", { hasText: /^Spatial locality/ })).toHaveCount(1);
  });

  test("tables, quotes and the brief have their own structure", async ({ page }) => {
    await openStage(page, "07", { token: S004 });
    const table = reading(page).locator("table", { hasText: "Who moves the data" });
    await expect(table.locator("thead th")).toHaveCount(4);
    // Each row is named by its first cell.
    await expect(table.locator("tbody th[scope=row]")).toHaveCount(3);
    await expect(table.locator("tbody tr")).toHaveCount(3);
    await expect(reading(page).locator("figure blockquote").first()).toBeVisible();
    await expect(reading(page).locator("figure figcaption", { hasText: /^Chapter 7, §7\.\d/ }).first()).toBeVisible();
    expect(await page.locator("[data-reader] p p").count(), "a <p> nested in a <p>").toBe(0);
    expect(await reading(page).innerText()).not.toMatch(/\*\*|\|---/);
  });

  test("every figure is the API's body, verbatim, in mono, and fits without scrolling", async ({ page, request }) => {
    const api = await realStage(request, "07", S004);
    const figures = api.blocks.filter((b) => b.kind === "code").map((b) => b.body);
    await openStage(page, "07", { token: S004 });
    const pres = reading(page).locator("figure pre");
    await expect(pres).toHaveCount(figures.length);
    for (let i = 0; i < figures.length; i++) {
      const pre = pres.nth(i);
      expect(await pre.evaluate((el) => el.textContent)).toBe(figures[i]);
      expect(await pre.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/JetBrains Mono/);
      const over = await pre.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(over, `figure ${i + 1} scrolls sideways`).toBeLessThanOrEqual(1);
    }
  });

  test("a number in a sentence is mono; the sentence is not", async ({ page }) => {
    await openStage(page, "06");
    const para = reading(page).locator("p", { hasText: "7200 rpm" }).first();
    expect(await para.evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/JetBrains Mono/);
    const num = para.locator("[data-num]", { hasText: "7200" });
    expect(await num.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/JetBrains Mono/);
  });
});

/* ======================================== leave, finish, resume (29 Sep 2026) */

/* ====================================== a course figure (6 Oct 2026) */
/*
 * design/templates/web/stage-figure/SPEC.md. The seeded figure is a DRAFT and
 * stage 10 is locked for these students, so stage 06's real reading is given a
 * figure block exactly as the API serves an approved one (services/api/test/
 * figures.spec.ts proves the API serves only approved drawings, and leaves an
 * unapproved one out whole).
 */
const FIGURE_SVG = readFileSync(`${process.cwd()}/content/figures/10-instruction-format.svg`, "utf8");
const FIGURE_TITLE = "A simple 16-bit instruction format";
function withFigure(approved = true) {
  return (body: StageBody): StageBody => {
    const blocks = [...body.blocks];
    const at = Math.max(1, blocks.findIndex((b) => b.kind === "prose") + 1);
    blocks.splice(at, 0, {
      ordinal: 9000,
      kind: "figure",
      body: "A simple instruction format: a 4-bit opcode and two 6-bit operand references.",
      meta: { id: "10-instruction-format", after: "12.2" },
      version: 1,
      ...(approved ? { figure: { id: "10-instruction-format", title: FIGURE_TITLE, svg: FIGURE_SVG } } : {}),
    } as StageBody["blocks"][number]);
    return { ...body, blocks };
  };
}
const fig = (page: Page) => page.locator('[data-figure="10-instruction-format"]');

test.describe("a course figure in the reading", () => {
  test("gate 1-3, 5: nothing clipped, no sideways scroll, keyboard reachable, tokens rendered", async ({ page }) => {
    await openStage(page, "06", { patch: withFigure() });
    await fig(page).scrollIntoViewIfNeeded();
    expect(await clippedElements(page, ROUTE), "with a figure").toEqual([]);
    expect(await horizontalOverflow(page), "with a figure").toBeLessThanOrEqual(0);
    expect(await unreachableByKeyboard(page, "main"), "with a figure").toEqual([]);
    expect(await offTokenStyles(page, ROUTE), "with a figure").toEqual([]);
  });

  test("gate 4: AA contrast, computed, in all seven biomes, the drawing's own text included", async ({ browser }, info) => {
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, "06", biome);
      await openStage(p, "06", { patch: withFigure() });
      await fig(p).scrollIntoViewIfNeeded();
      expect(await contrastFailures(p, ROUTE, SPRITES), "figure " + biome).toEqual([]);
      await ctx.close();
    }
  });

  test("gate 6: under reduced motion the figure arrives with nothing moving", async ({ page }) => {
    await recordMotion(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStage(page, "06", { patch: withFigure() });
    await fig(page).scrollIntoViewIfNeeded();
    const moving = (await recordedMotion(page)).filter((m) => m.ms > 1 && /fig/.test(m.on));
    expect(moving).toEqual([]);
  });

  test("one image to assistive tech, its caption, and the book's figure number", async ({ page }) => {
    await openStage(page, "06", { patch: withFigure() });
    const f = fig(page);
    await expect(f.getByRole("img", { name: FIGURE_TITLE })).toBeVisible();
    await expect(f.locator(".fig-svg svg")).toHaveAttribute("aria-hidden", "true");
    await expect(f.locator("figcaption")).toContainText("a 4-bit opcode and two 6-bit operand references");
    await expect(f.locator("figcaption")).toContainText("After Stallings, Figure 12.2, redrawn for this course");
    await expect(f.locator(".rd-fig-credit .mono")).toHaveText("12.2");
  });

  test("its smallest text stays readable: at least 9px rendered, at 380 too", async ({ page }) => {
    await openStage(page, "06", { patch: withFigure() });
    await fig(page).scrollIntoViewIfNeeded();
    const smallest = await fig(page).locator("svg").evaluate((svg) => {
      const vb = (svg as SVGSVGElement).viewBox.baseVal.width;
      const scale = svg.getBoundingClientRect().width / vb;
      const sizes = [...svg.querySelectorAll("text")].map((t) => Number(t.getAttribute("font-size")) * scale);
      return Math.min(...sizes);
    });
    expect(smallest).toBeGreaterThanOrEqual(9);
  });

  test("an unapproved figure is not there at all, caption included", async ({ page }) => {
    await openStage(page, "06", { patch: withFigure(false) });
    await expect(page.locator(".rd-fig")).toHaveCount(0);
    await expect(reading(page)).not.toContainText("a 4-bit opcode and two 6-bit operand references");
  });

  test("captures: the figure in the reading, at both widths", async ({ page }, info) => {
    await openStage(page, "06", { patch: withFigure() });
    await fig(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const s = wide(info) ? "" : "-380";
    await page.screenshot({ path: "design/templates/web/stage-figure/current" + s + ".png" });
  });
});

test.describe("leaving, and what finishes a stage", () => {
  test("the way back is at the top (the shell's Leave planet) and at the end, over the biome", async ({ page }) => {
    await openStage(page, "06");
    // Ruling 2: the top of a planet is the biome shell's sprite nav bar.
    await expect(page.getByRole("link", { name: "Leave planet" })).toHaveCount(1);
    await expect(back(page)).toHaveCount(1);
    await page.locator("[data-reader] a[href='/app?stage=06']").scrollIntoViewIfNeeded();
    expect(await onTop(page, "[data-reader] a[href='/app?stage=06']"), "painted under the biome (the old reader's defect)").toBe(true);
  });

  test("leaving warps out, then lands on the map with this planet selected", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await openStage(page, "06");
    await back(page).first().click();
    await expect(page).toHaveURL(/\/app\?stage=06$/);
    // The reverse travel transition is the shell's warp now (RealmWarp).
    await expect(page.locator(".realm-warp")).toHaveAttribute("data-warp", "out");
    await expect(page.locator(".starmap-body h2")).toHaveText("External Memory");
  });

  test("the end says what finishes the stage, from the API's threshold; nothing is a Finish button", async ({ page, request }) => {
    const api = await realStage(request, "06");
    await openStage(page, "06");
    const end = page.locator("[data-end]");
    await expect(end).toContainText("End of the reading.");
    await expect(end).toContainText(`${Math.round(api.masteryThreshold * 100)}%`);
    await expect(page.getByRole("button", { name: /finish|mark .*(read|complete)|^start/i })).toHaveCount(0);
  });

  test("the state line is the API's state, in words", async ({ page }) => {
    await openStage(page, "06");
    await expect(page.locator("[data-state]")).toHaveText(/In progress: your best check is 40%/);
    await openStage(page, "00");
    await expect(page.locator("[data-state]")).toHaveText(/Not graded/);
    await expect(page.locator("[data-end]")).toContainText("This stage has no check.");
  });

  test("the check says its cost before it is pressed, and opens the runner", async ({ page }, info) => {
    await openStage(page, "07", { token: S004 });
    const go = page.getByRole("button", { name: "Go to Stage 07 Check", exact: true });
    await expect(go).toBeEnabled();
    const card = page.locator("[data-check]");
    await expect(card).toContainText(/rules first; the attempt starts only when you press Start, in full screen, with no way back/);
    await expect(card.locator(".mono", { hasText: /^0 of 5$/ })).toBeVisible();
    test.skip(!wide(info), "navigation, one width");
    await go.click();
    await expect(page).toHaveURL(/\/app\/stage\/07\/check\?a=/);
  });

  test("a closed or used-up check says so and cannot be pressed", async ({ page }) => {
    await openStage(page, "07", {
      token: S004,
      patch: (b) => ({ ...b, assessment: b.assessment && { ...b.assessment, attemptsUsed: 5 } }),
    });
    await expect(page.getByRole("button", { name: "Go to Stage 07 Check", exact: true })).toBeDisabled();
    await expect(page.locator("[data-check]")).toContainText(/used every attempt/);
  });
});

/*
 * Instructor, 5 Oct 2026: "if orientation is done reading, automatically mark
 * it as mastered then move to the next stage". The write is the API's
 * (services/api/test/orientation.spec.ts holds it, denials first); here the
 * POST is stood in for, so the shared demo fixture is never changed by a run.
 */
test.describe("Orientation, read to its end (instructor, 5 Oct 2026)", () => {
  const fresh = (b: StageBody): StageBody => ({ ...b, state: "available", mastery: 0 });
  async function answerRead(page: Page, status = 200): Promise<{ calls: number }> {
    const seen = { calls: 0 };
    await page.route(/\/api\/v1\/stages\/00\/read$/, async (route) => {
      seen.calls++;
      await route.fulfill(
        status === 200
          ? { status, contentType: "application/json", body: JSON.stringify({ stageId: "00", state: "mastered", next: "01" }) }
          : { status, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "Something went wrong on our side. Try again." } }) },
      );
    });
    return seen;
  }

  test("reaching the end records it, says so, and carries the student to Stage 01", async ({ page }) => {
    const seen = await answerRead(page);
    await openStage(page, "00", { patch: fresh });
    await expect(page.locator("[data-finish]")).toHaveAttribute("data-finish", "reading");
    await page.locator("[data-end]").scrollIntoViewIfNeeded();
    const finish = page.locator("[data-finish]");
    await expect(finish).toHaveAttribute("data-finish", "done");
    await expect(finish.getByRole("status")).toContainText(/Stage 00 is mastered\. Taking you to Stage 01 in \d+s/);
    await expect(page.locator("[data-toaster]")).toContainText("mastered");
    await expect(page).toHaveURL(/\/app\/stage\/01$/, { timeout: 9_000 });
    expect(seen.calls, "recorded once").toBe(1);
  });

  test("Stay here stops the carry; the way on stays offered", async ({ page }) => {
    await answerRead(page);
    await openStage(page, "00", { patch: fresh });
    await page.locator("[data-end]").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Stay here" }).click();
    await expect(page.locator("[data-finish] [role=status]")).toContainText("Staying here");
    await page.waitForTimeout(6_000);
    await expect(page).toHaveURL(/\/app\/stage\/00$/);
    await expect(page.getByRole("link", { name: /Go to Stage 01/ })).toBeVisible();
  });

  test("a stage already mastered is never recorded again, and never carries anyone off", async ({ page }) => {
    const seen = await answerRead(page);
    await openStage(page, "00", { patch: (b) => ({ ...b, state: "mastered", mastery: 1 }) });
    await page.locator("[data-end]").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-finish] [role=status]")).toContainText("Stage 00 is mastered.");
    await page.waitForTimeout(6_000);
    await expect(page).toHaveURL(/\/app\/stage\/00$/);
    expect(seen.calls).toBe(0);
  });

  test("a record that fails says so, stays, and offers Try again", async ({ page }) => {
    await answerRead(page, 500);
    await openStage(page, "00", { patch: fresh });
    await page.locator("[data-end]").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-finish]")).toHaveAttribute("data-finish", "failed");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator("[data-toaster] [role=alert]")).toContainText("was not recorded");
  });

  test("a graded stage has none of it: its moons master it", async ({ page }) => {
    await openStage(page, "06");
    await expect(page.locator("[data-finish]")).toHaveCount(0);
  });

  test("captures: the finish, at both widths", async ({ page }, info) => {
    await answerRead(page);
    await openStage(page, "00", { patch: fresh });
    await page.locator("[data-end]").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-finish]")).toHaveAttribute("data-finish", "done");
    const s = wide(info) ? "" : "-380";
    await page.screenshot({ path: `design/templates/web/stage/current-orientation-done${s}.png` });
  });
});

test.describe("the rail, and the sheet at 380", () => {
  test("the rail lists the sections, marks the current one, and says N of M", async ({ page }, info) => {
    test.skip(!wide(info), "the rail is the 1440 form");
    await openStage(page, "06");
    const rail = page.locator("[data-rail]");
    await expect(rail).toBeVisible();
    const links = rail.locator("nav a");
    const h2s = await reading(page).locator("h2").allInnerTexts();
    // Brief, every ##, then Check: the archetype's declared beats and nothing else.
    await expect(links).toHaveText(["Brief", ...h2s, "Check"]);
    expect(await links.allInnerTexts(), "a section label lost a space").toEqual(["Brief", ...h2s, "Check"]);
    await links.nth(3).click();
    await expect(links.nth(3)).toHaveAttribute("aria-current", "location");
    await expect(rail.locator("[data-progress]")).toHaveText(`Section 4 of ${h2s.length + 2}`);
    await expect(rail.getByText(/What you should be able to do/i)).toBeVisible();
    await expect(rail.locator("li", { hasText: /^06\.1\b/ })).toHaveCount(1);
  });

  test("380: a Contents pill opens the sheet; Escape closes it and returns focus", async ({ page }, info) => {
    test.skip(wide(info), "the sheet is the 380 form");
    await openStage(page, "06");
    const pill = page.getByRole("button", { name: /^Contents/ });
    await expect(pill).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-sheet]")).toBeHidden();
    // Clear of the shell's bottom tab bar (since 30 Sep: Report is in the top bar).
    const a = (await pill.boundingBox())!;
    const b = (await page.locator(".biome-tabs-bottom").boundingBox())!;
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
      "the pill overlaps the planet's tab bar").toBe(true);

    await pill.click();
    await expect(pill).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("[data-sheet]")).toBeVisible();
    await expect(page.locator("[data-sheet] h2").first()).toBeFocused();
    // Nothing of the shell's paints over it (the nav did, until .rd matched its z-index).
    expect(await onTop(page, "[data-sheet] h2"), "the sheet's heading is covered").toBe(true);
    expect(await onTop(page, "[data-sheet] .rd-sheet-close"), "the sheet's Close is covered").toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-sheet]")).toBeHidden();
    await expect(pill).toBeFocused();
  });

  test("380: picking a section closes the sheet and brings it to the top", async ({ page }, info) => {
    test.skip(wide(info), "the sheet is the 380 form");
    await openStage(page, "06");
    await page.getByRole("button", { name: /^Contents/ }).click();
    const target = page.locator("[data-sheet] nav a").nth(2);
    const name = (await target.innerText()).trim();
    await target.click();
    await expect(page.locator("[data-sheet]")).toBeHidden();
    const h = reading(page).locator("h2", { hasText: name });
    await expect.poll(async () => Math.abs((await h.boundingBox())!.y) < 200).toBe(true);
    await expect(page.getByRole("button", { name: /^Contents/ })).toContainText("3 of");
  });
});

test.describe("resume, per device (instructor, 29 Sep 2026)", () => {
  test("the last section reached is offered on the next visit, and Resume goes there", async ({ page }, info) => {
    test.skip(!wide(info), "behaviour, one width");
    await openStage(page, "06");
    const h = reading(page).locator("h2").nth(2);
    const name = (await h.innerText()).trim();
    await h.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 200);
    await expect(page.locator("[data-rail] nav a[aria-current='location']")).toHaveText(name);
    await page.reload();
    await page.locator('[data-reader="reading"]').waitFor();
    const resume = page.locator("[data-resume]");
    await expect(resume).toContainText(`You were reading: ${name}`);
    await resume.getByRole("button", { name: "Resume", exact: true }).click();
    await expect.poll(async () => Math.abs((await h.boundingBox())!.y) < 200).toBe(true);
  });

  test("with storage refused, the page is whole and offers nothing to resume", async ({ page }) => {
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k: string) {
        if (k.startsWith("octa:reader:")) throw new Error("denied");
        return get.call(this, k);
      };
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k.startsWith("octa:reader:")) throw new Error("denied");
        return set.call(this, k, v);
      };
    });
    await openStage(page, "06");
    await expect(reading(page).locator("h2").first()).toBeVisible();
    await expect(page.locator("[data-resume]")).toHaveCount(0);
  });
});

/* ================================================================== states */

test.describe("the locked stage (instructor, 29 Sep 2026: the server's words)", () => {
  test("a full-page card: the API's reason verbatim, the prerequisite, the preview", async ({ page, request }) => {
    const api = await realStage(request, "02");
    expect(api.lockReason?.kind).toBe("prereq");
    await openStage(page, "02", { wait: "locked" });
    const card = page.locator('[data-reader="locked"]');
    await expect(card.locator("h1")).toHaveText(api.title);
    await expect(card).toContainText("Not open yet");
    await expect(card.locator("[data-reason]")).toHaveText(api.lockReason!.message);
    await expect(card.getByRole("link", { name: "Go to Stage 01", exact: true })).toHaveAttribute("href", "/app/stage/01");
    await expect(card.locator("li", { hasText: /^02\.1\b/ })).toHaveCount(1);
    await expect(page.locator("[data-reading]")).toHaveCount(0);
    expect(await onTop(page, "[data-reason]"), "the lock card is painted under the biome").toBe(true);
  });
});

test.describe("loading, failing, missing, empty", () => {
  test("loading: nothing under 400ms, a skeleton after, words after 3s", async ({ page }, info) => {
    test.skip(!wide(info), "timing, one width");
    /*
     * TIMESTAMPS, not a race. Recorded from before the first paint by a
     * MutationObserver, so the gaps are measured by the page, not guessed from
     * when a Playwright step happened to run (a retrying `toHaveCount(0)`
     * waited out the whole load on the first draft of this test).
     */
    await page.addInitScript(() => {
      const w = window as unknown as { __t: Record<string, number> };
      w.__t = {};
      new MutationObserver(() => {
        const t = performance.now();
        if (!w.__t.loading && document.querySelector('[data-reader="loading"]')) w.__t.loading = t;
        if (!w.__t.skeleton && document.querySelector("[data-skeleton]")) w.__t.skeleton = t;
        if (!w.__t.slow && /Still arriving/.test(document.querySelector('[data-reader="loading"]')?.textContent ?? "")) w.__t.slow = t;
        if (!w.__t.reading && document.querySelector('[data-reader="reading"]')) w.__t.reading = t;
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await openStage(page, "06", { delayMs: 5000, wait: "reading" });
    const t = await page.evaluate(() => (window as unknown as { __t: Record<string, number> }).__t);
    expect(t.loading, "the loading state never rendered").toBeGreaterThan(0);
    expect(t.skeleton! - t.loading!, "a skeleton inside 400ms is a flash").toBeGreaterThanOrEqual(380);
    expect(t.skeleton! - t.loading!, "no skeleton by a second").toBeLessThan(1000);
    expect(t.slow! - t.loading!, "words before 3s").toBeGreaterThanOrEqual(2900);
    expect(t.reading! - t.slow!, "the words came after the reading").toBeGreaterThan(0);
  });

  test("a failed read says what failed, and Try again reads again", async ({ page }) => {
    await openStage(page, "06", { failTimes: 1, wait: "error" });
    const err = page.locator('[data-reader="error"]');
    await expect(err.getByRole("alert")).toContainText("Something went wrong on our side");
    await err.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.locator('[data-reader="reading"]')).toBeVisible();
  });

  test("no such stage: the API's sentence and the way back, no retry", async ({ page }) => {
    await openStage(page, "99", { wait: "missing" });
    const box = page.locator('[data-reader="missing"]');
    await expect(box).toContainText("That stage does not exist.");
    await expect(box.getByRole("link", { name: "Back to the map", exact: true })).toBeVisible();
    await expect(box.getByRole("button", { name: "Try again" })).toHaveCount(0);
  });

  test("empty: no blocks says the reading is not published, and keeps the objectives", async ({ page }) => {
    await openStage(page, "06", { patch: (b) => ({ ...b, blocks: [] }), wait: "empty" });
    await expect(page.locator('[data-reader="empty"]')).toContainText(/reading for this stage has not been published/i);
    await expect(page.locator('[data-reader="empty"]').getByText(/What you should be able to do/i).first()).toBeAttached();
  });
});

test.describe("380 extras", () => {
  test("stage 07 at 380: the 73-character figure fits, the table wraps", async ({ page }, info) => {
    test.skip(wide(info), "the 380 case");
    await openStage(page, "07", { token: S004 });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const widest = await reading(page).locator("figure pre").evaluateAll((els) =>
      Math.max(...els.map((e) => e.scrollWidth - e.clientWidth)));
    expect(widest).toBeLessThanOrEqual(1);
    const t = reading(page).locator("table").last();
    const [tw, cw] = await t.evaluate((el) => [el.scrollWidth, el.parentElement!.clientWidth]);
    expect(tw).toBeLessThanOrEqual(cw + 1);
  });
});
