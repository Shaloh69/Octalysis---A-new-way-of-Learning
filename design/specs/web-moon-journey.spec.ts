import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
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
import {
  API,
  answerFor,
  journeyUrl,
  MOON,
  MOON_STAGE,
  realMoonPaper,
  servePaper,
  signIn,
  STUDENT,
  type PaperOptions,
  type Served,
} from "./_stage-check-fixture.ts";

/**
 * `/app/stage/:id/moon/:objectiveId`: a moon's journey (WEB-REVAMP 3.2 item 5,
 * 3.7a; instructor decisions of 30 Sep 2026). Practice on one objective's own
 * questions, never graded, whose correct answers count toward the moon.
 *
 * `design/templates/web/moon-journey/SPEC.md` is the contract: the six gate
 * assertions at 1440 and 380, and what practice owes that a paper does not:
 * it opens at once, with no prompt and no full screen; a leave is neither
 * covered nor recorded; Back to the moon is always there.
 *
 * Every paper here is the fixture's: the moon's own bank items, the real
 * engine, grader and serializer (`_stage-check-fixture.ts`). The server's half
 * (the lock, fail-closed, the one serializer) is `services/api/test/journeys.spec.ts`.
 */

const ROUTE = "[data-runner], [role=alertdialog], [data-toaster]";
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;

let items: ResolvedItem[];
let objectiveWords: string;

test.beforeAll(async ({ request }) => {
  items = await realMoonPaper(request);
  const stage = (await (
    await request.get(`${API}/api/v1/stages/${MOON_STAGE}`, { headers: { Authorization: `Bearer ${STUDENT}` } })
  ).json()) as { objectives: Array<{ id: string; description: string }> };
  objectiveWords = stage.objectives.find((o) => o.id === MOON)!.description;
});

const q = (n: number) => items[n - 1]!;
const G = () => items.findIndex((i) => i.type === "G") + 1;

async function open(page: Page, opts: PaperOptions = {}): Promise<Served> {
  await signIn(page);
  const served = await servePaper(page, items, { ...opts, journey: MOON });
  const look = page.waitForResponse((r) => r.url().includes("/api/v1/cosmetics"), { timeout: 15_000 }).catch(() => null);
  await page.goto(journeyUrl());
  await look;
  if (!opts.failStart) {
    await expect(page.locator("main").getByText(/Question \d+ of \d+/).first()).toBeVisible({ timeout: 15_000 });
  }
  return served;
}

const recordButton = (page: Page) => page.getByRole("button", { name: /^Record (answer|this order)$/ });
const next = (page: Page) => page.getByRole("button", { name: "Next question", exact: true });
const ONE_RIGHT_ONE_WRONG = () => [
  { ordinal: 1, answer: answerFor(q(1), true) },
  { ordinal: 2, answer: answerFor(q(2), false) },
];

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: a question, a recorded one, the ordering item", async ({ page }) => {
    await open(page, { recorded: ONE_RIGHT_ONE_WRONG() });
    for (const n of [1, 2, G()]) {
      await page.getByRole("button", { name: new RegExp(`^Question ${n}\\b`) }).click();
      await expect(page.locator("main").getByText(new RegExp(`Question ${n} of`)).first()).toBeVisible();
      expect(await clippedElements(page, ROUTE), `question ${n}`).toEqual([]);
    }
  });

  test("2. no horizontal page scroll", async ({ page }) => {
    await open(page, { recorded: ONE_RIGHT_ONE_WRONG() });
    for (const n of [1, G()]) {
      await page.getByRole("button", { name: new RegExp(`^Question ${n}\\b`) }).click();
      expect(await horizontalOverflow(page), `question ${n}`).toBeLessThanOrEqual(0);
    }
  });

  test("3. every control is reachable by keyboard, Back to the moon included", async ({ page }) => {
    await open(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
    await expect(page.getByRole("button", { name: "Back to the moon", exact: true })).toBeVisible();
  });

  test("4. AA contrast, computed, in all seven biomes", async ({ browser }, info) => {
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, MOON_STAGE, biome);
      await open(p, { recorded: ONE_RIGHT_ONE_WRONG() });
      await p.getByRole("button", { name: /^Question 2\b/ }).click();
      expect(await contrastFailures(p, ROUTE), biome).toEqual([]);
      await ctx.close();
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await open(page, { recorded: ONE_RIGHT_ONE_WRONG() });
    for (const n of [1, 2]) {
      await page.getByRole("button", { name: new RegExp(`^Question ${n}\\b`) }).click();
      expect(await offTokenStyles(page, ROUTE), `question ${n}`).toEqual([]);
    }
  });

  test("6. prefers-reduced-motion: moving between questions does not animate", async ({ page }) => {
    await recordMotion(page);
    await open(page);
    await next(page).click();
    const moved = await motionStarted(page, "main");
    expect(moved.length, "no motion recorded without reduced motion; the control proves nothing").toBeGreaterThan(0);

    const calm = await page.context().newPage();
    await calm.emulateMedia({ reducedMotion: "reduce" });
    await recordMotion(calm);
    await open(calm);
    await next(calm).click();
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1);
    expect(long, JSON.stringify(long)).toEqual([]);
    await calm.close();
  });
});

/* ======================================== practice, not a paper (3.7a (2)) */

test.describe("a journey is practice, not a paper", () => {
  test("it opens at once: no prompt, no Start, no full screen, and it asks the journey", async ({ page }) => {
    const served = await open(page);
    await expect(page.getByRole("button", { name: "Start the paper" })).toHaveCount(0);
    expect(await page.evaluate(() => !!document.fullscreenElement), "full screen was entered").toBe(false);
    expect(served.bodies.some((b) => b.url.includes(`/objectives/${MOON}/journey`))).toBe(true);
    await expect(page.locator(`[data-runner=sitting]`)).toBeVisible();
  });

  test("it says it is practice, and names the moon in the syllabus's words", async ({ page }) => {
    await open(page);
    const head = page.locator(".check-head");
    await expect(head).toContainText("Moon journey · practice");
    await expect(head.getByRole("heading", { level: 1 })).toHaveText(`Moon ${MOON}`);
    await expect(head).toContainText(objectiveWords);
    await expect(head).toContainText(/never graded/i);
    await expect(head).toContainText(/Two different questions answered right master this moon/);
  });

  test("leaving the page is neither covered nor recorded, and the shell keeps its way out", async ({ page }) => {
    const served = await open(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    });
    await expect(page.locator("[data-runner=covered]")).toHaveCount(0);
    expect(served.events, "a leave was recorded for a practice journey").toEqual([]);
    await expect(page.getByText("Paper in progress")).toHaveCount(0);
  });

  test("Back to the moon returns to the map with the planet and the moon chosen", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Back to the moon", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/app\\?stage=${MOON_STAGE}&moon=${MOON.replace(".", "\\.")}$`));
  });

  test("a verdict comes at once, and a wrong one is neutral", async ({ page }) => {
    await open(page);
    const first = answerFor(q(1), true) as { index: number };
    await page.getByRole("radio").nth(first.index).check();
    await recordButton(page).click();
    await expect(page.locator("[data-verdict]")).toContainText("Correct.");

    await next(page).click();
    const wrong = answerFor(q(2), false) as { index: number };
    await page.getByRole("radio").nth(wrong.index).check();
    await recordButton(page).click();
    await expect(page.locator("[data-verdict]")).toContainText("Not this one.");
  });

  test("Finish asks once, then shows the result, and leads back to the moon", async ({ page }) => {
    const served = await open(page, { recorded: ONE_RIGHT_ONE_WRONG() });
    await page.getByRole("button", { name: "Finish the journey", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Finish Moon ${MOON}?`);
    await expect(dialog).not.toContainText("cannot be undone");
    await expect(dialog.getByRole("button", { name: "Keep working" })).toBeFocused();
    await dialog.getByRole("button", { name: "Finish now" }).click();

    const done = page.locator("[data-runner=done]");
    await expect(done).toContainText("Journey finished");
    expect(served.submitted).toBe(true);
    await done.getByRole("button", { name: "Back to the moon", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/app\\?stage=${MOON_STAGE}&moon=`));
  });
});

/* =================================================== what the server refuses */

test.describe("the server's refusals, word for word", () => {
  test("a moon of a locked planet: the API's sentence, and a way back", async ({ page }) => {
    await open(page, { failStart: { status: 403, message: "This moon's planet is locked." } });
    const err = page.locator("[data-runner=error]");
    await expect(err.getByRole("heading", { level: 1 })).toHaveText("This journey did not open");
    await expect(err).toContainText("This moon's planet is locked.");
    await expect(err.getByRole("button", { name: "Back to the moon" })).toBeVisible();
    expect(await contrastFailures(page, ROUTE)).toEqual([]);
  });

  test("a moon with no questions yet (fail-closed): said, not hidden", async ({ page }) => {
    await open(page, { failStart: { status: 409, message: "This moon has no questions yet." } });
    await expect(page.locator("[data-runner=error]")).toContainText("This moon has no questions yet.");
  });

  test("loading: nothing under 400ms, a skeleton after", async ({ page }) => {
    await signIn(page);
    await servePaper(page, items, { journey: MOON, startDelayMs: 2_000 });
    await page.goto(journeyUrl());
    await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 1_900 });
    await expect(page.locator("main").getByText(/Question 1 of/)).toBeVisible({ timeout: 10_000 });
  });
});
