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
/** Choose a planet the way a pointer does: its dot, whose label carries the radio. */
async function choose(page: Page, id: string): Promise<void> {
  await page
    .locator(".starmap-planet")
    .filter({ has: page.getByRole("radio", { name: new RegExp(`^Stage ${id} ·`) }) })
    .click();
}

test.describe("/app — the six gate assertions", () => {
  test("1 · nothing in the panels is clipped, with and without a planet open", async ({ page }) => {
    await map(page);
    expect(await clippedElements(page, PANELS)).toEqual([]);
    await page.goto("/app?stage=06");
    await page.locator(".starmap-body h2").waitFor();
    expect(await clippedElements(page, PANELS)).toEqual([]);
  });

  test("2 · no horizontal page scroll", async ({ page }) => {
    await map(page, "/app?stage=06");
    await page.locator(".starmap-body h2").waitFor();
    await page.waitForTimeout(800);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3 · every control is reachable from the keyboard", async ({ page }) => {
    await map(page, "/app?stage=06");
    await page.locator(".starmap-body h2").waitFor();
    expect(await unreachableByKeyboard(page, PANELS)).toEqual([]);
  });

  test("4 · AA computed on the panels (one star set; locked and open planets)", async ({ page }) => {
    for (const id of ["04", "06", "00"]) {
      await map(page, `/app?stage=${id}`);
      await page.locator(".starmap-body h2").waitFor();
      expect(await contrastFailures(page, PANELS), `stage ${id}`).toEqual([]);
    }
  });

  test("5 · the token system is what rendered", async ({ page }) => {
    await map(page, "/app?stage=04");
    await page.locator(".starmap-body h2").waitFor();
    expect(await offTokenStyles(page, PANELS)).toEqual([]);
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
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\?stage=05$/);
    await expect(page.locator(".starmap-body h2")).not.toHaveText("Cache Memory");
    await page.keyboard.press("Escape");
    await expect(page.locator(".starmap-body")).toHaveCount(0);
    await expect(page).toHaveURL(/\/app$/);
  });

  test("a locked planet shows the server's reason, verbatim, beside a padlock, and no Enter", async ({ page }) => {
    await map(page, "/app?stage=04");
    const lock = page.locator(".starmap-lock");
    await expect(lock).toContainText(/Unlocks when Stage 03/);
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
    const ids = await page.locator(".starmap-moons li .mono").allTextContents();
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

  test("380: the chosen planet's panel is a sheet above the nav, the system panel folds", async ({ page }, info) => {
    test.skip(wide(info.project.name), "the 380 form");
    await map(page, "/app?stage=06");
    const sheet = page.locator(".starmap-body");
    expect(await sheet.evaluate((e) => getComputedStyle(e).position)).toBe("fixed");
    const s = (await sheet.boundingBox())!;
    const n = (await page.locator("nav[aria-label=Main]").boundingBox())!;
    expect(s.y + s.height).toBeLessThanOrEqual(n.y + 1);
    await expect(page.locator(".starmap-system-body")).toBeHidden();
  });
});
