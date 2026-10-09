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
 * A graded moon's CHECK, entered from the map (docs/GRADED-MOONS-PLAN.md, ruled
 * 8 Oct 2026; instructor: "when entering moons, instead of auto checks it defaults
 * to [practice]"). The moon panel's main button is the check, behind its start
 * prompt. This proves the way IN and the rule that binds it (hard rule 9: nothing
 * of the paper exists until Start); the paper itself, its five attempts, its
 * lock and its score are `services/api/test/moon-checks.spec.ts`, and the runner's
 * sitting is `web-stage-check.spec.ts`, which a moon check shares.
 *
 * The local bank has no live questions, so the map's moons are given some and the
 * API's answer to "ask for the check" is stood in for (the real route is the API spec's).
 */

const wide = (t: TestInfo) => t.project.name === "desktop-1440";
const MOON = "01.4";
const ASSESSMENT = "a55e0000-0000-4000-8000-0000000000d4";

interface Seen {
  asked: number;
  attempts: string[];
}

async function stub(page: Page, answer?: { status: number; body: unknown }): Promise<Seen> {
  const seen: Seen = { asked: 0, attempts: [] };
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), S006);
  await page.route("**/api/v1/stages", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { nodes: Array<{ id: string; objectives: Array<Record<string, unknown>> }> };
    for (const o of body.nodes.find((n) => n.id === "01")!.objectives) Object.assign(o, { questions: 3 });
    await route.fulfill({ response: res, json: body });
  });
  await page.route(`**/api/v1/objectives/${MOON}/check`, async (route) => {
    seen.asked += 1;
    const a = answer ?? {
      status: 200,
      body: { objectiveId: MOON, assessmentId: ASSESSMENT, title: `Moon ${MOON} check`, attemptsAllowed: 5, attemptsUsed: 0, best: null, inProgress: false },
    };
    await route.fulfill({ status: a.status, contentType: "application/json", body: JSON.stringify(a.body) });
  });
  // Nothing may start a paper before the student presses Start.
  await page.route("**/api/v1/attempts", async (route) => {
    if (route.request().method() === "POST") seen.attempts.push(route.request().url());
    await route.continue();
  });
  return seen;
}

/** The map, the moon, and the panel's main button: the way a student goes. */
async function sit(page: Page): Promise<void> {
  await page.goto(`/app?stage=01&moon=${MOON}`, { waitUntil: "domcontentloaded" });
  await page.locator(".starmap-body h2").waitFor({ timeout: 20_000 });
  await page.locator(".starmap-body").getByRole("link", { name: "Sit the check" }).click();
}

async function atPrompt(page: Page): Promise<Seen> {
  const seen = await stub(page);
  await sit(page);
  await page.locator("[data-runner=ready]").waitFor({ timeout: 15_000 });
  return seen;
}

const PROMPT = "[data-runner=ready]";

test.describe("a moon's check — the six gate assertions, on its start prompt", () => {
  test("1 · nothing is clipped", async ({ page }) => {
    await atPrompt(page);
    expect(await clippedElements(page, PROMPT)).toEqual([]);
  });
  test("2 · no horizontal page scroll", async ({ page }) => {
    await atPrompt(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
  test("3 · every control is reachable by keyboard", async ({ page }) => {
    await atPrompt(page);
    expect(await unreachableByKeyboard(page, "main")).toEqual([]);
  });
  test("4 · AA computed on the paper's neutral set", async ({ page }) => {
    await atPrompt(page);
    expect(await contrastFailures(page, PROMPT)).toEqual([]);
  });
  test("5 · the token system is what rendered", async ({ page }) => {
    await atPrompt(page);
    expect(await offTokenStyles(page, PROMPT)).toEqual([]);
  });
  test("6 · reduced motion: entering the check does not animate", async ({ page, browser }, info) => {
    test.skip(!wide(info), "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 }, baseURL: info.project.use.baseURL });
    const calm = await ctx.newPage();
    await recordMotion(calm);
    await atPrompt(calm);
    const long = (await recordedMotion(calm)).filter((m) => m.ms > 1 && !/realm-warp|starfield/.test(m.on));
    expect(long, JSON.stringify(long)).toEqual([]);
    await ctx.close();
  });
});

test.describe("a moon's check — what it owes", () => {
  test("the panel's check leads to the start prompt, and NOTHING of the paper exists before Start", async ({ page }) => {
    const seen = await stub(page);
    await sit(page);
    await page.locator(PROMPT).waitFor({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/app/stage/01/check\\?a=${ASSESSMENT}&t=Moon(%20|\\+)${MOON}(%20|\\+)check&m=${MOON.replace(".", "\\.")}$`));
    expect(seen.asked).toBe(1);
    // Hard rule 9: no attempt, no question, until the student presses Start.
    expect(seen.attempts, "an attempt was started before Start").toEqual([]);
    await expect(page.locator("main").getByText(/Question \d+ of \d+/)).toHaveCount(0);
    await expect(page.locator(PROMPT).locator("h1")).toHaveText(`Moon ${MOON} check`);
    // The rules are said first, and they say "moon", not "stage".
    await expect(page.locator(PROMPT)).toContainText(/no way back.*to the moon/i);
    await expect(page.locator(PROMPT)).toContainText(/hands the paper in as it stands and uses this attempt/i);
    await expect(page.getByRole("button", { name: "Start the paper", exact: true })).toBeFocused();
  });

  test("Back to the moon, before Start, lands on that moon on the map", async ({ page }) => {
    const seen = await atPrompt(page);
    await page.getByRole("button", { name: "Back to the moon", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/app\\?stage=01&moon=${MOON.replace(".", "\\.")}$`));
    await expect(page.locator(".starmap-body h2")).toHaveText(`Moon ${MOON}`);
    expect(seen.attempts).toEqual([]);
  });

  test("a refusal is the server's own sentence, with the way back to the moon", async ({ page }) => {
    await stub(page, { status: 409, body: { error: { code: "conflict", message: "This moon is not graded. Practise it from its journey." } } });
    await sit(page);
    await expect(page.locator("[data-moon-check-entry], [data-runner], main").first()).toBeVisible();
    await expect(page.locator("main")).toContainText("This moon is not graded. Practise it from its journey.", { timeout: 15_000 });
    await page.getByRole("button", { name: "Back to the moon" }).click();
    await expect(page).toHaveURL(new RegExp(`/app\\?stage=01&moon=${MOON.replace(".", "\\.")}$`));
  });

  test("a locked planet's check says why, verbatim", async ({ page }) => {
    await stub(page, { status: 403, body: { error: { code: "forbidden", message: "This moon's planet is locked." } } });
    await sit(page);
    await expect(page.locator("main")).toContainText("This moon's planet is locked.", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Start the paper" })).toHaveCount(0);
  });

  test("opening the check route by hand (a deep link) also starts nothing", async ({ page }) => {
    const seen = await stub(page);
    await page.goto(`/app/stage/01/moon/${MOON}/check`, { waitUntil: "domcontentloaded" });
    await page.locator(PROMPT).waitFor({ timeout: 15_000 });
    expect(seen.attempts).toEqual([]);
    // The map's /stages call may still be in flight: do not let it outlive the test.
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("a moon that does not circle that planet is refused in words, and nothing is asked of the server", async ({ page }) => {
    const seen = await stub(page);
    await page.goto(`/app/stage/02/moon/${MOON}/check`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toContainText(/does not circle this planet/i, { timeout: 15_000 });
    expect(seen.asked).toBe(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
});
