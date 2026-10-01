import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { clippedElements, contrastFailures, horizontalOverflow, offTokenStyles } from "./_gate.ts";
import { forcePlanetBiome } from "./_realm-fixture.ts";

/**
 * The arrival screen (instructor, 2 Oct 2026; R3.4): after the warp into a
 * planet or moon, the world being entered, named and drawn, with facts about
 * it. Contract: `design/templates/web/arrival/SPEC.md`.
 *
 * Travel is what shows it: every test reaches the planet the way a student
 * does, from the map's Enter journey, because a deep link must NOT show it.
 * Captures: `OCTA_CAPTURE=1` writes `current*.png` into the template folder.
 */

const SECRET = process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";
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
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
const TOKEN = token();
const ARRIVAL = ".arrival";
const CAPTION = ".arrival-caption";
const SPRITES = ".sprite-bar, .sprite-button";
const BIOMES = ["neutral", "jungle", "desert", "arctic", "city", "cave", "ocean"] as const;
const BRIEF = readFileSync("docs/source/solar-system-brief.md", "utf8").replace(/\s+/g, " ");
const DIR = "design/templates/web/arrival";

/** Moons with questions on stage 01, so a moon's Enter journey is a link (the local bank has none live). */
async function moonsOpen(page: Page): Promise<void> {
  await page.route("**/api/v1/stages", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { nodes: Array<{ id: string; objectives: Array<Record<string, unknown>> }> };
    for (const o of body.nodes.find((n) => n.id === "01")!.objectives) Object.assign(o, { questions: 3 });
    await route.fulfill({ response: res, json: body });
  });
}

/** Travel the way a student does: the map, a planet (or moon), Enter journey. */
async function travel(page: Page, opts: { stage?: string; moon?: string } = {}): Promise<void> {
  const stage = opts.stage ?? "06";
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
  if (opts.moon) await moonsOpen(page);
  await page.goto(`/app?stage=${stage}${opts.moon ? `&moon=${opts.moon}` : ""}`, { waitUntil: "domcontentloaded" });
  await page.locator(".starmap-body h2").waitFor();
  await page.locator(".starmap-body").getByRole("link", { name: "Enter journey" }).click();
  await page.locator(ARRIVAL).waitFor({ timeout: 10_000 });
  // Wait for the facts: the arrival fills in once the shell's stage data is there.
  await page.locator(".arrival-facts li").first().waitFor({ timeout: 10_000 });
}

/* ================================================================= the gate */

test.describe("the gate", () => {
  test("1. nothing is clipped: a planet and a moon", async ({ page }) => {
    await travel(page);
    expect(await clippedElements(page, ARRIVAL), "planet").toEqual([]);
    const p2 = await page.context().newPage();
    await travel(p2, { stage: "01", moon: "01.2" });
    expect(await clippedElements(p2, ARRIVAL), "moon").toEqual([]);
  });

  test("2. no horizontal page scroll", async ({ page }) => {
    await travel(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("3. keyboard: Continue is a real button, and a key clears the screen without firing what lies beneath", async ({ page }) => {
    await travel(page);
    const go = page.locator(ARRIVAL).getByRole("button", { name: "Continue" });
    await expect(go).toBeVisible();
    expect(await go.evaluate((b) => b.tagName)).toBe("BUTTON");
    // "l" is Leave planet beneath; on the arrival it only dismisses.
    await page.keyboard.press("l");
    await expect(page.locator(ARRIVAL)).toHaveCount(0);
    await expect(page).toHaveURL(/\/app\/stage\/06$/);
  });

  test("4. AA contrast, computed, in all seven biomes", async ({ browser }, info) => {
    test.setTimeout(240_000);
    for (const biome of BIOMES) {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, "06", biome);
      await travel(p);
      expect(await contrastFailures(p, CAPTION, SPRITES), biome).toEqual([]);
      await ctx.close();
    }
  });

  test("5. the token system is what rendered", async ({ page }) => {
    await travel(page);
    expect(await offTokenStyles(page, ARRIVAL)).toEqual([]);
  });

  test("6. reduced motion: no warp, the arrival cuts in, and nothing on it moves", async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await travel(page);
    await expect(page.locator(".realm-warp")).toHaveCount(0);
    const moving = await page.locator(ARRIVAL).evaluate((root) =>
      document
        .getAnimations()
        .filter((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target;
          const d = Number((a.effect as KeyframeEffect | null)?.getComputedTiming().duration ?? 0);
          return t instanceof Element && root.contains(t) && d > 1;
        })
        .map((a) => (a as CSSAnimation).animationName),
    );
    expect(moving).toEqual([]);
    await ctx.close();
  });
});

/* ======================================================= what it owes */

test.describe("what it owes", () => {
  test("the warp is longer now: 1.1s, from the token", async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const w = document.querySelector(".realm-warp") as HTMLElement | null;
        if (w && !w.dataset.measured) w.dataset.measured = getComputedStyle(w).animationDuration;
      }).observe(document, { subtree: true, childList: true });
    });
    await page.goto("/app?stage=06", { waitUntil: "domcontentloaded" });
    await page.locator(".starmap-body").getByRole("link", { name: "Enter journey" }).click();
    await expect(page.locator(".realm-warp")).toHaveAttribute("data-measured", "1.1s");
  });

  test("it names the world, draws its texture, and every fact is the brief's words or the planet's own data", async ({ page }) => {
    await travel(page);
    const a = page.locator(ARRIVAL);
    await expect(a).toHaveAttribute("data-arrival", "planet");
    await expect(page.locator(".arrival-eyebrow")).toHaveText("Entering");
    await expect(page.locator(".arrival-title")).toHaveText(/^an? .+(world|giant)$/);
    await expect(page.locator(".arrival-where")).toContainText("Stage 06 · External Memory");

    const briefs = await page.locator(`${ARRIVAL} [data-source="brief"]`).evaluateAll((els) =>
      els.map((el) => {
        const label = el.querySelector("strong")?.textContent ?? "";
        return (el.textContent ?? "").slice(label.length).trim();
      }),
    );
    expect(briefs.length).toBeGreaterThan(1);
    for (const b of briefs) expect(BRIEF, b).toContain(b);
    const data = (await page.locator(`${ARRIVAL} [data-source="data"]`).allTextContents()).join(" ");
    expect(data).toMatch(/\d+ moons circle External Memory/);
    expect(data).toContain("L3 System Software");
    expect(data).toContain("Midterm");
  });

  test("the background is the planet's biome, seamless: no veil, no globe; the page is hidden beneath it, and back after", async ({ page }) => {
    await travel(page);
    const a = page.locator(ARRIVAL);
    expect(await a.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await expect(page.locator(".arrival-globe")).toHaveCount(0);
    await expect(page.locator("[data-biome-render]").first()).toBeVisible();
    for (const part of [".biome-top", ".biome-main", ".biome-bottom"]) {
      expect(await page.locator(part).evaluate((el) => getComputedStyle(el).opacity), part).toBe("0");
    }
    await page.keyboard.press("Enter");
    await expect(a).toHaveCount(0);
    for (const part of [".biome-top", ".biome-main", ".biome-bottom"]) {
      await expect.poll(() => page.locator(part).evaluate((el) => getComputedStyle(el).opacity), { message: part }).toBe("1");
    }
  });

  test("beyond the frost line a giant: stage 06 orbits at L3, so its world says giant", async ({ page }) => {
    await travel(page);
    await expect(page.locator(".arrival-title")).toHaveText(/giant$/);
    await expect(page.locator(ARRIVAL)).toContainText("Beyond the frost line");
    await expect(page.locator(ARRIVAL)).toContainText("Gas & Ice Giants:");
  });

  test("a moon gets its own: its objective, its planet, and the brief on moons", async ({ page }) => {
    await travel(page, { stage: "01", moon: "01.2" });
    await expect(page.locator(ARRIVAL)).toHaveAttribute("data-arrival", "moon");
    await expect(page.locator(".arrival-title")).toHaveText(/ moon$/);
    await expect(page.locator(ARRIVAL)).toContainText("Differentiate Computer Organization and Computer Architecture");
    await expect(page.locator(ARRIVAL)).toContainText("one of 5 moons of Stage 01");
    await expect(page.locator(ARRIVAL)).toContainText("Hill Sphere");
  });

  test("a deep link is not travel: no arrival", async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), TOKEN);
    await page.goto("/app/stage/06", { waitUntil: "domcontentloaded" });
    await page.locator("[data-reader]").first().waitFor();
    await page.waitForTimeout(800);
    await expect(page.locator(ARRIVAL)).toHaveCount(0);
  });

  test("a click or Continue clears it; and left alone it clears itself", async ({ page }) => {
    test.setTimeout(60_000);
    await travel(page);
    await page.locator(ARRIVAL).getByRole("button", { name: "Continue" }).click();
    await expect(page.locator(ARRIVAL)).toHaveCount(0);
    // Out and in again, then wait it out.
    await page.getByRole("link", { name: "Leave planet" }).click();
    await page.locator(".starmap-body h2").waitFor();
    await page.locator(".starmap-body").getByRole("link", { name: "Enter journey" }).click();
    await page.locator(ARRIVAL).waitFor();
    await expect(page.locator(ARRIVAL)).toHaveCount(0, { timeout: 9_000 });
    await expect(page.locator("[data-reader]").first()).toBeVisible();
  });
});

/* ======================================================= captures (opt-in) */

test.describe("captures", () => {
  test.skip(!process.env.OCTA_CAPTURE, "set OCTA_CAPTURE=1 to write current*.png");

  test("a giant, a rocky world, the home world, and a moon, each over its biome", async ({ browser }, info) => {
    test.setTimeout(120_000);
    const s = info.project.name.includes("380") ? "-380" : "";
    const shot = async (name: string, biome: string, opts: { stage?: string; moon?: string }) => {
      const ctx = await browser.newContext({ viewport: info.project.use.viewport!, baseURL: info.project.use.baseURL, reducedMotion: "reduce" });
      const p = await ctx.newPage();
      await forcePlanetBiome(p, opts.stage ?? "06", biome);
      await travel(p, opts);
      await p.waitForTimeout(600); // the biome's sprites land
      await p.screenshot({ path: `${DIR}/current${name ? `-${name}` : ""}${s}.png` });
      await ctx.close();
    };
    await shot("", "ocean", { stage: "06" });
    await shot("rocky", "desert", { stage: "05" });
    await shot("home", "jungle", { stage: "01" });
    await shot("moon", "cave", { stage: "01", moon: "01.2" });
  });
});
