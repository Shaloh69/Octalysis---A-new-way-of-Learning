import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clippedElements,
  contrastFailures,
  horizontalOverflow,
  offTokenStyles,
  recordMotion,
  recordedMotion,
  unreachableByKeyboard,
} from "./_gate";
import { forcePlanetBiome } from "./_realm-fixture";

/**
 * The shell (WEB-REMAKE.md §2, §3, §5; rulings of 30 Sep 2026;
 * design/templates/web/shell/SPEC.md).
 *
 * Two shells: the STAR shell on every hub route (Starfield's HUD: readout
 * strip, tab strip or bottom bar, mission panel with depth, key hints) and the
 * BIOME shell inside a planet (a sprite nav bar, sprite tabs and buttons, the
 * registers as a sprite bar). The gate runs on the shell's OWN surfaces; each
 * route's content has its own spec.
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
const TOKENS = resolve(__dirname, "..", "..", "packages", "tokens");

const STAR_CHROME = ".star-top, .star-nav, .mission, .keyhints";
const BIOME_CHROME = ".biome-top, .biome-bottom";
const SPRITES = ".sprite-bar, .sprite-button";
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;

async function signIn(page: Page): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
}
async function star(page: Page, path = "/app/stages"): Promise<void> {
  await signIn(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(".star-nav").waitFor();
  await page.locator(".mission-title").waitFor();
}
async function planet(page: Page, biome?: string, path = "/app/stage/00"): Promise<void> {
  await signIn(page);
  if (biome) await forcePlanetBiome(page, "00", biome);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator(".biome-top").waitFor();
  await page.locator(".biome-planet", { hasText: "Orientation" }).waitFor();
  if (biome) await page.locator(`html[data-biome="${biome}"]`).waitFor({ state: "attached" });
}

test.describe("the shell — the six gate assertions", () => {
  test("1 · nothing in either shell is clipped", async ({ page }) => {
    await star(page);
    expect(await clippedElements(page, STAR_CHROME)).toEqual([]);
    await page.goto("/app/stage/00", { waitUntil: "domcontentloaded" });
    await page.locator(".biome-planet", { hasText: "Orientation" }).waitFor();
    expect(await clippedElements(page, BIOME_CHROME)).toEqual([]);
  });

  test("2 · no horizontal page scroll, star or planet", async ({ page }) => {
    await star(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.goto("/app/stage/00", { waitUntil: "domcontentloaded" });
    await page.locator(".biome-planet", { hasText: "Orientation" }).waitFor();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3 · every shell control is reachable from the keyboard", async ({ page }, testInfo) => {
    await star(page);
    const starScope = testInfo.project.name.includes("380") ? ".star-top, .star-nav, .mission" : STAR_CHROME;
    expect(await unreachableByKeyboard(page, starScope)).toEqual([]);
    await page.goto("/app/stage/00", { waitUntil: "domcontentloaded" });
    await page.locator(".biome-planet", { hasText: "Orientation" }).waitFor();
    expect(await unreachableByKeyboard(page, BIOME_CHROME)).toEqual([]);
  });

  test("4 · AA computed: the star HUD, and all seven biomes' chrome", async ({ page }) => {
    await star(page);
    expect(await contrastFailures(page, STAR_CHROME), "star HUD").toEqual([]);
    for (const biome of BIOMES) {
      const p = await page.context().newPage();
      await planet(p, biome);
      expect(await contrastFailures(p, BIOME_CHROME, SPRITES), biome).toEqual([]);
      // Words painted on a sprite take --sprite-ink, which the tokens test
      // holds to 4.5:1 against every sprite's decoded fill.
      const inks = await p.$$eval(".biome-top .sprite-button, .biome-planet", (els) =>
        els.map((e) => getComputedStyle(e).color),
      );
      const ink = await p.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--sprite-ink)";
        document.body.append(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      });
      for (const c of inks) expect(c, `${biome}: sprite text is --sprite-ink`).toBe(ink);
      await p.close();
    }
  });

  test("5 · the token system is what rendered", async ({ page }) => {
    await star(page);
    expect(await offTokenStyles(page, STAR_CHROME)).toEqual([]);
    await page.goto("/app/stage/00", { waitUntil: "domcontentloaded" });
    await page.locator(".biome-planet", { hasText: "Orientation" }).waitFor();
    expect(await offTokenStyles(page, BIOME_CHROME)).toEqual([]);
  });

  test("6 · reduced motion: crossing the realms is a cut, no warp", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name.includes("380"), "one width is enough");
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await recordMotion(page);
    await star(page, "/app/stages");
    await page.locator(".mission-go").click();
    await page.locator(".biome-top").waitFor();
    await page.waitForTimeout(300);
    expect(await page.locator(".realm-warp").count(), "a warp under reduced motion").toBe(0);
    expect((await recordedMotion(page)).filter((m) => m.name.startsWith("realm-warp"))).toEqual([]);
    await ctx.close();
  });
});

test.describe("the shell — what it owes", () => {
  test("the realm: a star route carries no biome; a planet's chrome wears its planet's sprites", async ({ page }) => {
    await star(page);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    await expect(page.locator("html")).not.toHaveAttribute("data-biome", /.*/);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);

    const p = await page.context().newPage();
    await planet(p, "desert");
    await expect(p.locator("html")).toHaveAttribute("data-realm", "biome");
    const current = p.locator(".biome-tabs-top [aria-current=page]");
    await expect(current).toHaveText("Reading");
    // The build inlines the small sprites as data: URIs, so the sprite is
    // identified by its BYTES against packages/tokens/pixel, not by a file name.
    const sprite = async (sel: string, file: string) => {
      const src = await p.locator(sel).first().evaluate((e) => getComputedStyle(e).borderImageSource);
      const m = /url\("?(.*?)"?\)$/.exec(src);
      expect(m, `${sel} has no sprite`).not.toBeNull();
      const url = m![1]!;
      const bytes = url.startsWith("data:")
        ? Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
        : Buffer.from(await (await p.request.get(url)).body());
      const want = readFileSync(resolve(TOKENS, "pixel", file));
      expect(bytes.equals(want), `${sel} is not ${file}`).toBe(true);
    };
    await sprite(".biome-top", "panel-desert.png");
    await sprite(".biome-leave", "button-desert.png");
    // The current tab is the PRESSED sprite, and says so in aria-current.
    await sprite(".biome-tabs-top [aria-current=page]", "button-desert-pressed.png");
    await p.close();
  });

  test("the nav is its own landmark, outside <main>", async ({ page }) => {
    await star(page);
    expect(await page.locator("main nav[aria-label=Main]").count()).toBe(0);
    await expect(page.locator("nav[aria-label=Main]")).toHaveCount(1);
    await expect(page.locator("nav[aria-label=Main] [aria-current=page]")).toHaveText(/Stages/);
  });

  test("← and → step to the previous and next tab", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("380"), "the arrows are the 1440 form");
    await star(page, "/app/stages");
    await page.getByRole("link", { name: "Next: Progress" }).click();
    await expect(page).toHaveURL(/\/app\/progress$/);
    await page.getByRole("link", { name: "Previous: Stages" }).click();
    await expect(page).toHaveURL(/\/app\/stages$/);
  });

  test("at 380 the tab strip is a bottom bar of the same six", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("380"), "this is the 380 form");
    await star(page);
    const nav = page.locator("nav[aria-label=Main]");
    expect(await nav.evaluate((e) => getComputedStyle(e).position)).toBe("fixed");
    const box = (await nav.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
    await expect(nav.locator(".star-tab")).toHaveCount(6);
  });

  test("the mission panel names the next stage and goes there", async ({ page }) => {
    await star(page);
    const title = (await page.locator(".mission-title").textContent())!;
    expect(title).toMatch(/^Stage \d{2} · /);
    await page.locator(".mission-go").click();
    await expect(page).toHaveURL(new RegExp(`/app/stage/${title.slice(6, 8)}$`));
    await expect(page.locator(".mission-depth-label")).toHaveCount(0); // a planet has no mission panel
  });

  test("the depth meter reads the grid: seven segments, the label in words and mono", async ({ page }) => {
    await star(page);
    await expect(page.locator(".mission-depth-meter li")).toHaveCount(7);
    await expect(page.locator(".mission-depth-label")).toBeVisible();
    await expect(page.locator(".mission-depth-label .mono")).toHaveText(/^L[0-6]$/);
  });

  test("key hints are real: the key and the button do the same thing", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("380"), "hints are the 1440 form");
    await star(page);
    await page.keyboard.press("m");
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/stages");
    await page.locator(".keyhints").getByRole("button", { name: /Map/ }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/app/stages");
    await page.keyboard.press("f");
    await expect(page.getByRole("dialog", { name: "Report a problem" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("single-key shortcuts can be turned off (WCAG 2.1.4), and the buttons stay", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("380"), "hints are the 1440 form");
    await page.addInitScript(() => localStorage.setItem("octa:shortcuts", "off"));
    await star(page);
    await page.keyboard.press("m");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/app\/stages$/);
    await expect(page.locator(".keyhints .keyhint-cap")).toHaveCount(0);
    await expect(page.locator(".keyhints").getByRole("button", { name: /Map/ })).toBeVisible();
  });

  test("Report a problem opens a dialog above everything, focus inside, and returns", async ({ page }) => {
    await planet(page);
    await page.locator(".biome-report").click();
    const dialog = page.getByRole("dialog", { name: "Report a problem" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("#fb-title")).toBeFocused();
    // The scrim sits over the shell's bars (NEXT-SESSION §0p.5).
    const z = await page.locator(".dialog-scrim").evaluate((e) => Number(getComputedStyle(e).zIndex));
    const bars = await page.locator(".biome-top").evaluate((e) => Number(getComputedStyle(e).zIndex));
    expect(z).toBeGreaterThan(bars);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".biome-report")).toBeFocused();
  });

  test("Leave planet returns to the map with this planet selected, through the warp", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("380"), "one width is enough");
    await recordMotion(page);
    await planet(page);
    await page.locator(".biome-leave").click();
    await expect(page).toHaveURL(/\/app\?stage=00$/);
    await expect(page.locator("html")).toHaveAttribute("data-realm", "star");
    await expect(page.locator(".realm-warp")).toHaveAttribute("data-warp", "out");
  });

  test("entering a planet warps in; a deep link does not warp at all", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("380"), "one width is enough");
    await planet(page);
    expect(await page.locator(".realm-warp").count(), "a deep link warped").toBe(0);
    await page.goto("/app/stages", { waitUntil: "domcontentloaded" });
    await page.locator(".mission-go").waitFor();
    await page.locator(".mission-go").click();
    await expect(page.locator(".realm-warp")).toHaveAttribute("data-warp", "in");
    await expect(page.locator(".realm-warp")).toHaveCount(0, { timeout: 3000 });
  });

  test("the registers keep their hooks: the PC cell in either dress", async ({ page }) => {
    await star(page);
    await expect(page.locator("[data-readout] [data-register=PC] .register-value")).toHaveCount(1);
    await page.goto("/app/stage/00", { waitUntil: "domcontentloaded" });
    await page.locator(".biome-top").waitFor();
    await expect(page.locator("[data-readout].readout-sprite [data-register=PC] .register-value")).toHaveCount(1);
  });

  test("/app/map is gone and keeps its selection", async ({ page }) => {
    await signIn(page);
    await page.goto("/app/map?stage=04", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/app\?stage=04$/);
  });
});
