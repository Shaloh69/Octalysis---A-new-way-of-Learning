import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements, contrastFailures, horizontalOverflow, motionStarted, offTokenStyles,
  recordMotion, recordedMotion, setTheme, THEMES, unreachableByKeyboard,
} from "./_gate";
import { useLiveFixture, type LiveFixtureOpts } from "./_live-fixture";

/**
 * `/live` and `/live/present`: Lecture Mode, and the projector view.
 *
 * `PAGE-SPECS.md` §/console/live is the plan. Before the rebuild (29 Sep 2026)
 * the page polled in a tight loop (2,467 requests in 10 seconds), the projector
 * was an overlay at `?present=1` with the shell's nav still in the Tab order
 * behind it and no way out, it read "safe to show" with nobody working, and it
 * headed every student's all-time average "Where the room is".
 *
 * Instructor rulings of that day: the server and console half of "push an
 * item" (one question at a time, a live item only, started and ended with a
 * reason, audited); the projector its own route; a stage's average withheld
 * below five; the health strip; "working now" by activity; honest labels; the
 * timer deferred. `design/templates/console/live/SPEC.md`.
 *
 * `console-live-feedback.spec.ts` keeps its older payload tests (no identifier
 * is ever fetched; the server withholds). This file does not repeat them.
 *
 * `/live` never goes network-idle: every wait is `domcontentloaded` plus an
 * explicit locator.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
const CONSOLE_URL = process.env.OCTA_CONSOLE_URL ?? "http://localhost:5174";

function staffToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-0000-4000-8000-000000000001",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "teacher" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STAFF = staffToken();
const wide = (project: string) => project === "desktop-1440";

/** A question running with a result, a withheld stage, people working, a report. */
const BUSY: LiveFixtureOpts = { session: { answered: 12, correct: 7 }, smallStage: 3, cohort: 23, reports: 2, liveItems: 6 };

async function openLive(page: Page, opts: LiveFixtureOpts = {}, path = "/live") {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STAFF);
  const fx = await useLiveFixture(page, opts);
  await page.goto(`${CONSOLE_URL}${path}`, { waitUntil: "domcontentloaded" });
  if (!opts.status && !opts.delayMs) {
    // §0m.5: the rebuilt page shows its heading before its data. Wait for data.
    await page.locator("[data-ready]").first().waitFor({ timeout: 15_000 });
  }
  return fx;
}

const question = (page: Page) => page.locator("[data-question]");

async function openStart(page: Page) {
  await page.getByRole("button", { name: "Start a question" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a question" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function chooseQuestion(page: Page, fx: Awaited<ReturnType<typeof openLive>>) {
  const dialog = await openStart(page);
  const first = fx.offered()[0]!;
  await dialog.getByRole("group", { name: "Stage" }).getByRole("button", { name: new RegExp(`^${first.stageId}`) }).click();
  await dialog.getByRole("group", { name: "Question" }).getByRole("button", { name: new RegExp(first.slug) }).click();
  return { dialog, first };
}

/* ================================================================ the gate */

test.describe("the gate — CONSOLE-REVAMP.md §2", () => {
  test("1 · nothing is clipped: idle, a question running, the Start dialog, the projector", async ({ page }) => {
    await openLive(page, { liveItems: 6 });
    expect(await clippedElements(page), "idle").toEqual([]);
    await openStart(page);
    expect(await clippedElements(page), "the Start dialog").toEqual([]);
    await page.keyboard.press("Escape");

    await openLive(page, BUSY);
    expect(await clippedElements(page), "running").toEqual([]);
    await page.goto(`${CONSOLE_URL}/live/present`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-projector] [data-result]").waitFor();
    expect(await clippedElements(page), "the projector, running").toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await openLive(page, BUSY);
    expect(await horizontalOverflow(page), "/live, running").toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "End question" }).click();
    expect(await horizontalOverflow(page), "the End dialog").toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    // Start exists only while nothing runs.
    await openLive(page, { liveItems: 6 });
    await openStart(page);
    expect(await horizontalOverflow(page), "the Start dialog").toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await page.goto(`${CONSOLE_URL}/live/present`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-projector] [data-result]").waitFor();
    expect(await horizontalOverflow(page), "the projector").toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard alone, and the projector's Tab order is its own", async ({ page }) => {
    await openLive(page, BUSY);
    expect(await unreachableByKeyboard(page, "main"), "/live").toEqual([]);
    await page.getByRole("button", { name: "End question" }).focus();
    await page.keyboard.press("Enter");
    const end = page.getByRole("dialog", { name: "End this question" });
    await expect(end).toBeVisible();
    expect(await unreachableByKeyboard(page, "[role=dialog]"), "the End dialog").toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "End question" }), "focus returns to End question").toBeFocused();

    await page.goto(`${CONSOLE_URL}/live/present`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-projector] [data-result]").waitFor();
    expect(await unreachableByKeyboard(page, "main"), "the projector").toEqual([]);
    // The defect this route was rebuilt for: Tab walked into a nav hidden behind the overlay.
    const reached: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      reached.push(
        await page.evaluate(() => {
          const e = document.activeElement as HTMLElement | null;
          if (!e || e === document.body) return "body";
          const r = e.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const visible = !!hit && (hit === e || e.contains(hit));
          return `${e.closest("main") ? "main" : "outside"}:${visible ? "visible" : "hidden"}:${e.textContent?.trim().slice(0, 20)}`;
        }),
      );
    }
    for (const r of reached.filter((x) => x !== "body")) expect(r, "a Tab stop off the projector's own surface").toMatch(/^main:visible:/);
  });

  test("4 · AA contrast, computed, on all three themes: /live and the projector", async ({ page }) => {
    test.setTimeout(240_000);
    await openLive(page, BUSY);
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `/live · ${theme}`).toEqual([]);
    }
    await page.goto(`${CONSOLE_URL}/live/present`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-projector] [data-result]").waitFor();
    for (const theme of THEMES) {
      await setTheme(page, theme);
      expect(await contrastFailures(page), `projector · ${theme}`).toEqual([]);
    }
  });

  test("5 · the rendered output uses the tokens", async ({ page }) => {
    await openLive(page, BUSY);
    expect(await offTokenStyles(page), "/live, running").toEqual([]);
    await page.getByRole("button", { name: "End question" }).click();
    expect(await offTokenStyles(page), "the End dialog").toEqual([]);
    await page.keyboard.press("Escape");
    await openLive(page, { liveItems: 6 });
    await openStart(page);
    expect(await offTokenStyles(page), "the Start dialog").toEqual([]);
    await page.keyboard.press("Escape");
    await page.goto(`${CONSOLE_URL}/live/present`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-projector] [data-result]").waitFor();
    expect(await offTokenStyles(page), "the projector").toEqual([]);
  });

  test("6 · prefers-reduced-motion is honoured, emulated rather than assumed", async ({ page }) => {
    // POSITIVE CONTROL FIRST: with motion allowed, the projector's result bar grows in.
    await recordMotion(page);
    await openLive(page, BUSY, "/live/present");
    const moving = await motionStarted(page, "main");
    expect(moving.length, "with motion allowed, the projector's bar should grow in").toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${CONSOLE_URL}/live`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-stage-row]").first().waitFor({ timeout: 15_000 });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await page.evaluate(() => ((window as unknown as { __motion: unknown[] }).__motion = []));
    await page.getByRole("button", { name: "End question" }).click();
    await expect(page.getByRole("dialog", { name: "End this question" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(`${CONSOLE_URL}/live/present`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-projector] [data-result]").waitFor();
    const still = (await recordedMotion(page)).filter((m) => m.ms > 1);
    expect(still, "under reduced motion nothing on the route may animate").toEqual([]);
  });
});

/* ======================================================= the approved plan */

test.describe("it reads every five seconds, and never in a loop", () => {
  test("one read, then one per five seconds", async ({ page }, testInfo) => {
    test.skip(!wide(testInfo.project.name), "a timing claim, not a layout one");
    test.setTimeout(60_000);
    const fx = await openLive(page);
    await page.waitForTimeout(11_000);
    // Before the rebuild this was 2,467: useEffect(..., [snap]) restarted the poll on every answer.
    expect(fx.reads.length, `${fx.reads.length} reads in 11 seconds`).toBeGreaterThanOrEqual(2);
    expect(fx.reads.length, `${fx.reads.length} reads in 11 seconds`).toBeLessThanOrEqual(4);
    await expect(page.locator("[data-updated]")).toContainText(/every 5 seconds/i);
  });
});

test.describe("the projector is its own route", () => {
  test("?present=1 lands on /live/present, outside the shell, and Exit and Escape leave it", async ({ page }) => {
    await openLive(page, {}, "/live?present=1");
    await expect(page).toHaveURL(/\/live\/present$/);
    await expect(page.locator("[data-projector]")).toBeVisible();
    await expect(page.locator("[data-shell] nav a"), "the shell's nav is not on the projector").toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/live$/);

    await page.goto(`${CONSOLE_URL}/live/present`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /^Exit/ }).click();
    await expect(page).toHaveURL(/\/live$/);
  });

  test("/live opens it in a new window, so the laptop keeps the controls", async ({ page }) => {
    await openLive(page);
    const link = page.getByRole("link", { name: /projector view/i });
    await expect(link).toHaveAttribute("href", "/live/present");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toContainText(/new window/i);
  });

  test("with nothing running it shows who is working and the class so far, and names no one", async ({ page }) => {
    await openLive(page, { cohort: 23, smallStage: 3 }, "/live/present");
    const p = page.locator("[data-projector]");
    await expect(p.locator("[data-result]")).toContainText("23");
    await expect(p).toContainText(/people working now/i);
    await expect(p).toContainText(/the class so far/i);
    await expect(p).toContainText("Cache Memory");
    await expect(p.locator('[data-stage-row="08"]')).toContainText(/fewer than 5/i);
    await expect(p).toContainText(/no names are shown here, ever/i);
    await expect(p).not.toContainText(/where the room is/i);
  });

  test("a running question: how many answered, and the class's share once five have", async ({ page }) => {
    await openLive(page, BUSY, "/live/present");
    const r = page.locator("[data-projector] [data-result]");
    await expect(r).toContainText("12");
    await expect(r).toContainText(/answered/i);
    await expect(page.locator("[data-projector]")).toContainText(/the class got 58%/i);
    await expect(page.locator("[data-projector]")).toContainText(/7 of 12/);
  });

  test("below five answers it says when the result will appear, and shows none", async ({ page }) => {
    await openLive(page, { ...BUSY, session: { answered: 3, correct: 2 } }, "/live/present");
    await expect(page.locator("[data-projector]")).toContainText(/appears once 5 have answered/i);
    await expect(page.locator("[data-projector]")).not.toContainText(/the class got/i);
  });
});

test.describe("the question: started and ended with a reason, and honest about students", () => {
  test("with no live item there is nothing to start, and the page says why and where", async ({ page }) => {
    await openLive(page);
    await expect(question(page)).toHaveAttribute("data-state", "none");
    await expect(question(page)).toContainText(/no question is running/i);
    await expect(page.getByRole("button", { name: "Start a question" })).toBeDisabled();
    await expect(question(page)).toContainText(/no item is live/i);
    await expect(question(page).getByRole("link", { name: "Items" })).toHaveAttribute("href", "/items");
  });

  test("it says plainly that students cannot answer yet", async ({ page }) => {
    await openLive(page, { liveItems: 6 });
    await expect(question(page)).toContainText(/students cannot answer yet/i);
    await openLive(page, BUSY);
    await expect(question(page)).toContainText(/students cannot answer yet/i);
  });

  test("Start waits for a question and a reason, sends them, and says what happened to what", async ({ page }) => {
    const fx = await openLive(page, { liveItems: 6 });
    const { dialog, first } = await chooseQuestion(page, fx);
    const start = dialog.getByRole("button", { name: "Start question" });
    await expect(start, "a question and no reason").toBeDisabled();
    await dialog.getByLabel("Why", { exact: true }).fill("Warm-up before the lecture");
    await expect(start).toBeEnabled();
    await start.click();

    expect(fx.starts).toHaveLength(1);
    expect(fx.starts[0]).toEqual({ itemId: first.id, sectionId: null, reason: "Warm-up before the lecture" });
    await expect(page.locator("[data-toaster]")).toContainText(`${first.slug} put to the room, for everyone`);
    await expect(question(page)).toHaveAttribute("data-state", "running");
    await expect(question(page)).toContainText(first.slug);
  });

  test("a section can be chosen, and goes with the start", async ({ page }) => {
    const fx = await openLive(page, { liveItems: 6 });
    const { dialog } = await chooseQuestion(page, fx);
    const who = dialog.getByRole("group", { name: "Who may answer" });
    const section = who.getByRole("button").nth(1);
    const code = (await section.textContent())!.trim();
    await section.click();
    await expect(section).toHaveAttribute("aria-pressed", "true");
    await dialog.getByLabel("Why", { exact: true }).fill("Section 4 only");
    await dialog.getByRole("button", { name: "Start question" }).click();
    expect(fx.starts[0]!.sectionId).toBeTruthy();
    await expect(page.locator("[data-toaster]")).toContainText(`for section ${code}`);
  });

  test("a refused start keeps the dialog and its choices, says why in it, and the toast stays", async ({ page }) => {
    const message = "A question is already running (P-04-other). End it before starting another.";
    const fx = await openLive(page, { liveItems: 6, startRefusal: { status: 409, message } });
    const { dialog, first } = await chooseQuestion(page, fx);
    await dialog.getByLabel("Why", { exact: true }).fill("Warm-up");
    await dialog.getByRole("button", { name: "Start question" }).click();
    await expect(dialog.getByRole("alert")).toContainText(message);
    await expect(dialog.getByRole("group", { name: "Question" }).getByRole("button", { name: new RegExp(first.slug) })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", { name: "Start question" })).toBeInViewport();
    await page.waitForTimeout(5_000);
    await expect(page.locator("[data-toaster]"), "an error toast never vanishes on a timer").toContainText(/not started/i);
  });

  test("a running question: what it is, who may answer, and the result or why it is held back", async ({ page }) => {
    await openLive(page, BUSY);
    const q = question(page);
    await expect(q).toHaveAttribute("data-state", "running");
    await expect(q).toContainText(/everyone/i);
    await expect(q.locator("[data-figure=answered]")).toContainText("12");
    await expect(q.locator("[data-figure=correct]")).toContainText("7");
    await expect(q).toContainText("58%");

    await openLive(page, { ...BUSY, session: { answered: 4, correct: 3 } });
    await expect(question(page)).toContainText(/held back until 5 have answered/i);
    await expect(question(page).locator("[data-figure=correct]")).not.toContainText("3");
  });

  test("End asks why, sends it, and says how many had answered", async ({ page }) => {
    const fx = await openLive(page, BUSY);
    await page.getByRole("button", { name: "End question" }).click();
    const dialog = page.getByRole("dialog", { name: "End this question" });
    const end = dialog.getByRole("button", { name: "End question" });
    await expect(end).toBeDisabled();
    await dialog.getByLabel("Why", { exact: true }).fill("Discussed it");
    await end.click();
    expect(fx.ends).toHaveLength(1);
    expect(fx.ends[0]!.body).toEqual({ reason: "Discussed it" });
    await expect(page.locator("[data-toaster]")).toContainText(/ended after 12 answers/i);
    await expect(question(page)).toHaveAttribute("data-state", "none");
  });
});

test.describe("the room and the class so far", () => {
  test("four counts, each in the last 20 minutes, reports linking to Feedback", async ({ page }) => {
    await openLive(page, BUSY);
    const room = page.locator("[data-room]");
    for (const k of ["working", "open", "handed-in", "reports"]) await expect(room.locator(`[data-count="${k}"]`)).toBeVisible();
    await expect(room.locator('[data-count="working"]')).toContainText("23");
    await expect(room).toContainText(/last 20 minutes/i);
    await expect(room.locator('[data-count="reports"]').getByRole("link")).toHaveAttribute("href", "/feedback");
  });

  test("the bars are the class so far, titled, and a small stage says it is withheld", async ({ page }) => {
    await openLive(page, BUSY);
    const main = page.locator("main");
    await expect(main).toContainText(/the class so far/i);
    await expect(main).not.toContainText(/where the room is/i);
    await expect(page.locator('[data-stage-row="04"]')).toContainText("Cache Memory");
    const small = page.locator('[data-stage-row="08"]');
    await expect(small).toHaveAttribute("data-withheld", "true");
    await expect(small).toContainText(/fewer than 5/i);
    await expect(small.locator("[data-bar]")).toHaveCount(0);
  });

  test("0 people working never reads as 'safe to show'", async ({ page }) => {
    await openLive(page);
    await expect(page.locator("main")).not.toContainText(/safe to show/i);
    await expect(page.locator('[data-count="working"]')).toContainText("0");
  });
});

test.describe("loading, failure, stale", () => {
  test("nothing under 400ms, a skeleton after, a sentence at its top after 3s", async ({ page }) => {
    await openLive(page, { delayMs: 4_500 });
    await page.waitForTimeout(200);
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
    await expect(page.locator("[data-skeleton]")).toBeVisible({ timeout: 2_000 });
    await expect(page.locator("[data-skeleton] > p").first()).toContainText(/waking up/i, { timeout: 4_000 });
    await expect(page.locator("[data-stage-row]").first()).toBeVisible({ timeout: 10_000 });
  });

  test("a failed first read says so and offers Try again", async ({ page }) => {
    await openLive(page, { status: 500 });
    const alert = page.locator("main [role=alert]");
    await expect(alert).toContainText(/could not be read/i);
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("a failed later read keeps the numbers and says they are the previous reading", async ({ page }) => {
    test.setTimeout(30_000);
    await openLive(page, { ...BUSY, failAfterFirst: true });
    await expect(page.locator("[data-stale]")).toContainText(/previous reading/i, { timeout: 12_000 });
    await expect(page.locator("[data-figure=answered]")).toContainText("12");
  });
});
