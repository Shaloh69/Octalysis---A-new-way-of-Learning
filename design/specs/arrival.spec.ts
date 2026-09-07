import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * Arriving at a stage — `BIOME-AND-LOADING-SPEC.md` §4.2.
 *
 * Entering a stage is the one navigation where the student already knows their
 * destination, so the loading state previews it: "the destination itself,
 * arriving early". §4.2 also gives it a second job — it is the seam where the
 * solar system stops being the background and a biome becomes it, and the biome
 * resolving early is what makes that a departure rather than a disappearance.
 *
 * **The state is normally invisible**, because the fetch is fast. That is
 * exactly why it needs a test: nobody will see it degrade. Each test holds the
 * stage request open so the arrival can be observed, which is the only way to
 * assert a loading state without adding an artificial delay to the app.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

function studentToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "dddddddd-1111-4000-8000-000000000006",
    email: "demo@example.com",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 86_400,
    app_metadata: { role: "student", student_id: "232129006" },
  });
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

const STUDENT = studentToken();

/**
 * Navigate to a stage with the stage request held open, so the arrival state is
 * observable. `hold` is generous: the assertions run while it is in flight.
 */
async function arriving(page: Page, biome?: string, hold = 4_000): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STUDENT);
  await page.route("**/api/v1/stages/**", async (route) => {
    await new Promise((r) => setTimeout(r, hold));
    await route.continue();
  });
  await page.goto("/app/stage/00", { waitUntil: "domcontentloaded" });
  await page.locator(".state-arriving").waitFor({ timeout: 15_000 });
  if (biome) {
    await page.evaluate((b) => document.documentElement.setAttribute("data-biome", b), biome);
  }
  await page.waitForTimeout(700);
}

test.describe("arriving at a stage — §4.2", () => {
  test("the destination biome is already there while the stage loads", async ({
    page,
  }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await arriving(page, "jungle");

    /*
     * The regression this exists to stop. The loading branch used to render bare
     * skeletons on the page surface, with the biome appearing only once the
     * fetch landed — so the map warped, the route changed, and the student
     * arrived nowhere until the content showed up. The transition was spent on
     * nothing.
     */
    const layers = await page.locator(".biome-layer").count();
    expect(layers, "the destination biome must be painted DURING the load").toBeGreaterThan(0);

    // And the motif — §4.2 asks for the backdrop "already in motion".
    expect(
      await page.locator(".biome-mote").count(),
      "jungle's leaves should already be falling",
    ).toBeGreaterThan(0);
  });

  test("the skeleton is shaped like the reader, not like a spinner", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await arriving(page);

    /*
     * `PAGE-SPECS.md` §5: "skeletons matching final layout, never a centred
     * spinner". §4.2 is explicit that a biome preview is the game-native form of
     * that rule rather than an exception to it, so both halves are asserted.
     */
    await expect(page.locator(".state-arriving")).toBeVisible();
    expect(await page.locator(".state-arriving .skel").count()).toBeGreaterThanOrEqual(6);
    expect(
      await page.locator(".state-arriving .arriving-block").count(),
      "the reader has three surfaces and so should its skeleton",
    ).toBeGreaterThanOrEqual(2);

    /*
     * The skeletons must be VISIBLE against the panel. They were not: `.skel` is
     * `var(--surface)` and the arriving panel is `--surface-1`, the same value in
     * two of the three themes, so the panel looked empty and the arrival read as
     * a broken page. Invisible on the page background is not a case anyone would
     * have caught by eye, because on the page background those two differ.
     */
    const contrast = await page.evaluate(() => {
      const skel = document.querySelector(".state-arriving .skel");
      const panel = document.querySelector(".state-arriving");
      if (!skel || !panel) return null;

      /*
       * Compare LIGHTNESS, normalised, because the computed value's format is
       * not ours to choose. These are `color-mix(in oklab, ...)`, so Chromium
       * returns `oklab(0.92 ... / 0.14)` — lightness on 0-1 — while an `rgb()`
       * declaration would come back on 0-255. The first version of this
       * assertion parsed three numbers and summed them with a threshold written
       * for 0-255, so it failed against bars that were plainly visible: a
       * measurement in the wrong units, which is the same class of mistake as
       * calibrating a bound against an empty column.
       */
      const lightness = (value: string): number => {
        const n = (value.match(/-?[\d.]+/g) ?? []).map(Number);
        if (n.length === 0) return 0;
        if (/^okl(ab|ch)/.test(value)) return n[0]! * 255; // 0-1 -> 0-255
        // rgb()/rgba(): rough perceptual weighting is enough to say "different".
        return 0.2126 * (n[0] ?? 0) + 0.7152 * (n[1] ?? 0) + 0.0722 * (n[2] ?? 0);
      };
      return {
        skel: lightness(getComputedStyle(skel).backgroundColor),
        panel: lightness(getComputedStyle(panel).backgroundColor),
      };
    });
    expect(contrast).not.toBeNull();
    expect(
      Math.abs(contrast!.skel - contrast!.panel),
      "skeleton bars are the same lightness as the panel behind them",
    ).toBeGreaterThan(24);
  });

  test("it announces arrival, not a generic load", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await arriving(page);

    /*
     * A screen-reader user gets the information the biome carries visually —
     * that this is travel to a KNOWN destination — rather than a status word
     * that would describe any fetch on any page.
     */
    await expect(page.locator(".state-arriving .sr-only")).toHaveText(/arriving at stage 00/i);
  });

  test("reduced motion freezes it to a static frame", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await arriving(page, "jungle");

    /*
     * §4.2: "freezes to a single static frame of the biome, same information".
     * Frozen, never slowed — the same rule every animated moment in this project
     * follows. Asserted through `getAnimations()` rather than by screenshotting
     * twice, because a slow animation and a stopped one look identical in two
     * stills taken close together.
     */
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .map((a) => (a.effect as KeyframeEffect | null)?.target?.className ?? "?")
        .filter((c) => typeof c === "string" && /biome|skel|arriving/.test(c)),
    );
    expect(running, `still animating under reduced motion: ${running.join(", ")}`).toHaveLength(0);

    // Still a full arrival, not a degraded one — the biome is present.
    expect(await page.locator(".biome-layer").count()).toBeGreaterThan(0);
    await context.close();
  });

  test("it works at 380px", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "driven directly");

    const context = await browser.newContext({ viewport: { width: 380, height: 844 } });
    const page = await context.newPage();
    await arriving(page, "arctic");

    // Definition of done: works at 380px. The biome fills the width there rather
    // than the height (§2e), so the whole scene shows instead of a slice.
    await expect(page.locator(".state-arriving")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the arrival must not scroll sideways at 380px").toBeLessThanOrEqual(1);
    await context.close();
  });
});
