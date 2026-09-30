import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  unreachableByKeyboard,
} from "./_gate";

/**
 * `/app`, the 3D map and the ONLY map (WEB-REMAKE.md §0.3-§0.5, ruling 2 of
 * 30 Sep 2026; design/templates/web/app/SPEC.md). Replaces solar-system.spec
 * and before-baseline.spec, which tested the flat map and its ladder.
 *
 * The gate runs on the panels (the accessible layer and the body panel); the
 * canvas is decorative by contract and is asserted to exist, to be hidden from
 * assistive technology, and to hold still under reduced motion.
 */

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
function token(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: "232129006" },
  });
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
const TOKEN = token();
const PANELS = ".starmap-panels";

async function map(page: Page, path = "/app"): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(".starmap-bodies input[type=radio]").first().waitFor({ state: "attached" });
}
const wide = (name: string) => !name.includes("380");
/**
 * Moons in every state, for the tests that need them. Locally no question is
 * `live`, so every real moon reads "No questions yet" (fail-closed, 3.7a) and
 * none can glow. This patches the REAL /api/v1/stages payload for stage 01
 * only: 01.1 mastered, 01.2 one right, 01.3 and 01.4 not started, 01.5 still
 * without questions. Everything else on the page is the real API's.
 */
async function moonsInEveryState(page: Page): Promise<void> {
  await page.route("**/api/v1/stages", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as {
      nodes: Array<{ id: string; objectives: Array<Record<string, unknown>>; moons: unknown }>;
    };
    const n = body.nodes.find((x) => x.id === "01")!;
    const facts: Record<string, [number, boolean, number]> = {
      "01.1": [3, true, 3],
      "01.2": [1, false, 3],
      "01.3": [0, false, 3],
      "01.4": [0, false, 3],
      "01.5": [0, false, 0],
    };
    for (const o of n.objectives) {
      const f = facts[o.id as string];
      if (f) Object.assign(o, { correct: f[0], mastered: f[1], questions: f[2] });
    }
    n.moons = { mastered: 1, total: n.objectives.length };
    await route.fulfill({ response: res, json: body });
  });
}

/** Choose a planet the way a pointer does: its dot, whose label carries the radio. */
async function choose(page: Page, id: string): Promise<void> {
  await page
    .locator(".starmap-planet")
    .filter({ has: page.getByRole("radio", { name: new RegExp(`^Stage ${id} ·`) }) })
    .click();
}

test.describe("/app — the six gate assertions", () => {
  test("1 · nothing in the panels is clipped, with and without a planet or a moon open", async ({ page }) => {
    await moonsInEveryState(page);
    await map(page);
    expect(await clippedElements(page, PANELS)).toEqual([]);
    await page.goto("/app?stage=06");
    await page.locator(".starmap-body h2").waitFor();
    expect(await clippedElements(page, PANELS)).toEqual([]);
    for (const path of ["/app?stage=01", "/app?stage=01&moon=01.2", "/app?stage=01&moon=01.5"]) {
      await page.goto(path);
      await page.locator(".starmap-body h2").waitFor();
      expect(await clippedElements(page, PANELS), path).toEqual([]);
    }
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await map(page, "/app?stage=06");
    await page.locator(".starmap-body h2").waitFor();
    await page.waitForTimeout(800);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard, each moon and the moon panel included", async ({ page }) => {
    await moonsInEveryState(page);
    for (const path of ["/app?stage=06", "/app?stage=01", "/app?stage=01&moon=01.4"]) {
      await map(page, path);
      await page.locator(".starmap-body h2").waitFor();
      expect(await unreachableByKeyboard(page, PANELS), path).toEqual([]);
    }
  });

  test("4 · AA computed on the panels (one star set; locked and open planets; moons)", async ({ page }) => {
    await moonsInEveryState(page);
    const views = ["stage=04", "stage=06", "stage=00", "stage=01", "stage=01&moon=01.1", "stage=01&moon=01.5", "stage=04&moon=04.1"];
    for (const q of views) {
      await map(page, `/app?${q}`);
      await page.locator(".starmap-body h2").waitFor();
      expect(await contrastFailures(page, PANELS), q).toEqual([]);
    }
  });

  test("5 · the token system is what rendered", async ({ page }) => {
    await moonsInEveryState(page);
    for (const q of ["stage=04", "stage=01", "stage=01&moon=01.2"]) {
      await map(page, `/app?${q}`);
      await page.locator(".starmap-body h2").waitFor();
      expect(await offTokenStyles(page, PANELS), q).toEqual([]);
    }
  });

  test("6 · reduced motion: the orbits stop and the camera cuts", async ({ browser }, info) => {
    test.skip(!wide(info.project.name), "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await map(page);
    await expect(page.locator(".starmap")).toHaveAttribute("data-motion", "still");
    await expect(page.locator(".starmap-body")).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("/app — what the map owes", () => {
  test("it is the 3D map on every width, the phone included, hidden from assistive tech", async ({ page }) => {
    await map(page);
    await expect(page.locator(".starmap")).toHaveAttribute("data-webgl", "yes");
    const canvas = page.locator(".starmap-stage canvas");
    await expect(canvas).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator(".starmap-canvas")).toHaveAttribute("aria-hidden", "true");
    const box = (await canvas.boundingBox())!;
    expect(box.width).toBeGreaterThan(page.viewportSize()!.width - 2);
  });

  test("the accessible layer: 19 planets, grouped by act, each named in words", async ({ page }) => {
    await map(page);
    const radios = page.locator(".starmap-bodies input[type=radio]");
    await expect(radios).toHaveCount(19);
    await expect(page.getByRole("radio", { name: /^Stage 04 · Cache Memory, (locked|open|in progress|mastered)/ })).toHaveCount(1);
    await expect(page.getByRole("radio", { name: /your next stage$/ })).toHaveCount(1);
    await expect(page.locator(".starmap-act")).toHaveCount(4);
  });

  test("choosing a planet in the row opens its panel; arrows move; Escape closes", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "behaviour, one width");
    await map(page);
    await choose(page, "04");
    await expect(page).toHaveURL(/\?stage=04$/);
    await expect(page.locator(".starmap-body h2")).toHaveText("Cache Memory");
    // The star map shows only while no planet is chosen (instructor, 1 Oct 2026).
    await expect(page.locator(".starmap-system")).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\?stage=05$/);
    await expect(page.locator(".starmap-body h2")).not.toHaveText("Cache Memory");
    await page.keyboard.press("Escape");
    await expect(page.locator(".starmap-body")).toHaveCount(0);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.locator(".starmap-system")).toBeVisible();
    // Focus comes back to the planet just left, in the row that returned.
    await expect(page.locator("input[data-planet='05']")).toBeFocused();
  });

  test("the chosen planet's name sits at the bottom of the free area, centred", async ({ page }) => {
    await map(page, "/app?stage=02");
    const tag = page.locator(".starmap-tag");
    await expect(tag).toHaveText("Computer Evolution and Performance");
    const t = (await tag.boundingBox())!;
    const vp = page.viewportSize()!;
    const sheet = await page.locator(".starmap-body").boundingBox();
    if (wide(test.info().project.name)) {
      // Below the middle of the screen, right of the side column, clear of the key hints' row.
      expect(t.y).toBeGreaterThan(vp.height / 2);
      expect(t.x).toBeGreaterThan(sheet!.x + sheet!.width);
    } else {
      // Above the sheet on a phone.
      expect(t.y + t.height).toBeLessThanOrEqual(sheet!.y + 1);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(vp.width);
    }
    await expect(page.locator(".starmap-system")).toBeHidden();
  });

  test("a locked planet shows the server's reason, verbatim, beside a padlock, and no Enter", async ({ page }) => {
    await map(page, "/app?stage=04");
    const lock = page.locator(".starmap-lock");
    await expect(lock).toContainText(/Unlocks when every moon of Stage 03/);
    await expect(lock.locator("svg")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Enter journey" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show Stage 03" }).click();
    await expect(page).toHaveURL(/\?stage=03$/);
  });

  test("an open planet's Enter journey warps into it", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "behaviour, one width");
    await map(page, "/app?stage=06");
    await page.getByRole("link", { name: "Enter journey" }).click();
    await expect(page).toHaveURL(/\/app\/stage\/06$/);
    await expect(page.locator(".realm-warp")).toHaveAttribute("data-warp", "in");
  });

  test("the moons are the stage's objectives, in the syllabus's order", async ({ page }) => {
    await map(page, "/app?stage=06");
    const ids = await page.locator(".starmap-moons .starmap-moon-id").allTextContents();
    expect(ids.length).toBeGreaterThan(9);
    expect(ids.slice(0, 2)).toEqual(["06.1", "06.2"]);
    expect(ids[ids.length - 1]).toBe(`06.${ids.length}`);
  });

  test("a bookmark opens its planet; Back from a chosen planet closes it", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "navigation, one width");
    await map(page);
    await choose(page, "06");
    await expect(page.locator(".starmap-body")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".starmap-body")).toHaveCount(0);
    await page.goto("/app?stage=02");
    await expect(page.locator(".starmap-body h2")).toHaveText("Computer Evolution and Performance");
  });

  test("each planet wears its own biome's tint (the same one its biome shell uses)", async ({ page }) => {
    await map(page);
    const tints = await page.$$eval(".starmap-planet", (els) => els.map((e) => (e as HTMLElement).style.getPropertyValue("--tint")));
    expect(tints).toHaveLength(19);
    for (const t of tints) expect(t).toMatch(/^var\(--biome-planet-(neutral|jungle|desert|arctic|city|cave|ocean)\)$/);
    expect(new Set(tints).size, "one biome for every planet: the stage is an input").toBeGreaterThan(2);
  });

  test("the accent marks only the student's next stage", async ({ page }) => {
    await map(page);
    await expect(page.locator(".starmap-planet.is-next")).toHaveCount(1);
  });

  test("key hints: Enter journey and Close exist only while they can act", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "hints are the 1440 form");
    await map(page);
    const hints = page.locator(".keyhints");
    await expect(hints.getByRole("button", { name: /Enter journey/ })).toHaveCount(0);
    await page.goto("/app?stage=06");
    await expect(hints.getByRole("button", { name: /Enter journey/ })).toHaveCount(1);
    await page.goto("/app?stage=04");
    await expect(hints.getByRole("button", { name: /Close/ })).toHaveCount(1);
    await expect(hints.getByRole("button", { name: /Enter journey/ })).toHaveCount(0);
  });

  test("no WebGL: a line says so, and every planet and control remains", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
        return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await map(page);
    await expect(page.locator(".starmap")).toHaveAttribute("data-webgl", "no");
    await expect(page.locator(".starmap-nowebgl")).toBeVisible();
    await expect(page.locator(".starmap-stage canvas")).toHaveCount(0);
    await choose(page, "06");
    await expect(page.locator(".starmap-body h2")).toHaveText("External Memory");
  });

  test("380: the chosen planet's panel is a sheet above the nav, the system panel hides", async ({ page }, info) => {
    test.skip(wide(info.project.name), "the 380 form");
    await map(page, "/app?stage=06");
    const sheet = page.locator(".starmap-body");
    expect(await sheet.evaluate((e) => getComputedStyle(e).position)).toBe("fixed");
    const s = (await sheet.boundingBox())!;
    const n = (await page.locator("nav[aria-label=Main]").boundingBox())!;
    expect(s.y + s.height).toBeLessThanOrEqual(n.y + 1);
    await expect(page.locator(".starmap-system")).toBeHidden();
  });
});

/* ======================= moons: WEB-REVAMP 3.1-3.3, 3.7a, 3.10; R4.2, R4.3 */

test.describe("/app — the moons", () => {
  test("each moon is a button with its mastery in words; the planet says N of M mastered", async ({ page }) => {
    await moonsInEveryState(page);
    await map(page, "/app?stage=01");
    await expect(page.locator("[data-moons-mastered]")).toHaveText(/^1 of 5 subtopics mastered$/);
    const row = (id: string) => page.locator(".starmap-moons li").filter({ hasText: id });
    await expect(row("01.1")).toHaveAttribute("data-glow", "full");
    await expect(row("01.1")).toContainText("Mastered");
    await expect(row("01.2")).toHaveAttribute("data-glow", "partial");
    await expect(row("01.2")).toContainText("1 of 3 right");
    await expect(row("01.3")).toHaveAttribute("data-glow", "dim");
    await expect(row("01.3")).toContainText("Not started");
    await expect(row("01.5")).toContainText("No questions yet");
    await expect(page.locator(".starmap-moons button.starmap-moon")).toHaveCount(5);
  });

  test("choosing a moon updates the panel in place, and Enter journey goes to its journey", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "behaviour, one width");
    await moonsInEveryState(page);
    await map(page, "/app?stage=01");
    await page.locator(".starmap-moons button.starmap-moon").filter({ hasText: "01.4" }).click();
    await expect(page).toHaveURL(/\?stage=01&moon=01\.4$/);
    const panel = page.locator(".starmap-body");
    await expect(panel.locator("h2")).toHaveText("Moon 01.4");
    await expect(panel.locator("h2")).toBeFocused();
    await expect(panel).toContainText("Circles Stage 01");
    await expect(panel.locator(".starmap-moon-now")).toHaveText("Not started");
    await expect(panel).toContainText(/Two different questions right master this moon/);
    const enter = panel.getByRole("link", { name: "Enter journey" });
    await expect(enter).toHaveAttribute("href", "/app/stage/01/moon/01.4");
    await enter.click();
    await expect(page).toHaveURL(/\/app\/stage\/01\/moon\/01\.4$/);
  });

  test("Escape steps out one level: the moon, then the planet (3.3)", async ({ page }, info) => {
    test.skip(!wide(info.project.name), "behaviour, one width");
    await moonsInEveryState(page);
    await map(page);
    await choose(page, "01");
    await page.locator(".starmap-moons button.starmap-moon").filter({ hasText: "01.2" }).click();
    await expect(page.locator(".starmap-body h2")).toHaveText("Moon 01.2");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\?stage=01$/);
    await expect(page.locator(".starmap-body h2")).toHaveText("Introduction");
    await page.keyboard.press("Escape");
    await expect(page.locator(".starmap-body")).toHaveCount(0);
  });

  test("Back to the moon from a journey lands on the moon, and Back to Stage 01 steps out", async ({ page }) => {
    await moonsInEveryState(page);
    await map(page, "/app?stage=01&moon=01.4");
    await expect(page.locator(".starmap-body h2")).toHaveText("Moon 01.4");
    await page.getByRole("button", { name: "Back to Stage 01" }).click();
    await expect(page.locator(".starmap-body h2")).toHaveText("Introduction");
  });

  test("a moon with no questions yet: Enter is disabled, the reason beside it (fail-closed)", async ({ page }) => {
    await moonsInEveryState(page);
    await map(page, "/app?stage=01&moon=01.5");
    const enter = page.locator(".starmap-body").getByRole("button", { name: "Enter journey" });
    await expect(enter).toBeDisabled();
    await expect(page.locator(".starmap-body .starmap-lock")).toHaveText("This moon has no questions yet.");
    await expect(page.getByRole("link", { name: "Enter journey" })).toHaveCount(0);
  });

  test("a locked planet's moon: Enter disabled, with the planet's own reason, verbatim", async ({ page }) => {
    await map(page, "/app?stage=04&moon=04.1");
    await expect(page.locator(".starmap-body h2")).toHaveText("Moon 04.1");
    await expect(page.locator(".starmap-body").getByRole("button", { name: "Enter journey" })).toBeDisabled();
    await expect(page.locator(".starmap-body .starmap-lock")).toContainText(/Unlocks when every moon of Stage 03/);
  });

  test("Orientation has no moons: its objectives are text, and nothing to choose (3.10)", async ({ page }) => {
    await map(page, "/app?stage=00");
    const body = page.locator(".starmap-body");
    await expect(body.locator(".starmap-moons-title")).toHaveText("Objectives");
    await expect(body.locator(".starmap-moons li")).toHaveCount(5);
    await expect(body.locator("button.starmap-moon")).toHaveCount(0);
    await expect(body.locator("[data-moons-mastered]")).toHaveCount(0);
    // A moon link to Orientation names no moon: the planet's panel stays.
    await page.goto("/app?stage=00&moon=00.1");
    await expect(page.locator(".starmap-body h2")).toHaveText("Orientation");
  });

  test("the /app/stages list carries each moon's mastery in words too (R4.4)", async ({ page }) => {
    await moonsInEveryState(page);
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
    await page.goto("/app/stages?stage=01");
    const row = page.locator(".starmap-moons li").filter({ hasText: "01.2" });
    await expect(row).toContainText("1 of 3 right");
  });
});
