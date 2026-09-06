import { test, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHmac } from "node:crypto";

/**
 * The seven landing biomes — captured individually, and held to §2's honesty
 * rule.
 *
 * R2 asked for "each biome variant screenshotted individually (not one
 * representative)" and it was never done. That mattered more than a missing
 * screenshot usually does, because most of them rendered nothing and nobody
 * could see that without looking.
 *
 * THE THREE STATES (`BIOME-AND-LOADING-SPEC.md` §2, as revised):
 *
 *   art         vendored parallax layers. `neutral`, `desert`, `jungle` — all
 *               three composed from Kenney Background Elements (CC0), which §2's
 *               own table calls the "base layer for several biomes".
 *   procedural  no layers, and that is intentional. `volcanic` only: the named
 *               exception where no cleanly-licensed pack exists.
 *   nothing     no layers because the art is not vendored yet. Renders NOTHING.
 *
 * That last state is the one worth a test. §2 was revised specifically to forbid
 * a gradient stand-in, because a gradient looks finished — an un-sourced biome
 * that renders as a tinted rectangle is indistinguishable from a done one, and
 * would have been signed off as such. So this asserts that the un-vendored
 * biomes draw nothing, which is a strange-looking thing to want and exactly
 * right.
 *
 * The biome is read from `<html data-biome>` (`useSeededBiome`), so it is set
 * directly here rather than by re-seeding a student — deterministic, and it does
 * not depend on which biome the cosmetic endpoint happens to give anyone.
 */

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "test-secret-at-least-32-characters-long-000000";

/** Vendored art. All three compose Kenney Background Elements (CC0). */
const ART = ["neutral", "desert", "jungle", "arctic", "ocean", "cave"] as const;
/** Allowed to draw from tokens — the one named exception. */
const PROCEDURAL = ["volcanic"] as const;
/**
 * Not vendored. Must render NOTHING.
 *
 * `arctic` and `ocean` have approved packs whose downloads need a browser
 * session (itch.io), and `cave` has no approved source at all — the pack §2
 * named is marked do-not-use over an unresolved licence conflict.
 */
/**
 * Nothing is un-vendored any more — all six art biomes are in, and volcanic is
 * procedural by design.
 *
 * The list is KEPT, empty, rather than deleted along with the test below. §2's
 * rule that an un-sourced biome must render NOTHING rather than a gradient
 * stand-in is the reason five of them were visibly outstanding instead of
 * looking finished, and the next biome added should inherit that guarantee
 * rather than rediscover it.
 */
const NOT_VENDORED: readonly string[] = [];

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

async function landing(page: Page, biome: string): Promise<void> {
  await page.addInitScript((t) => localStorage.setItem("octa:dev-token", t as string), STUDENT);
  await page.goto("/app/stage/00", { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 15_000 });

  // Override the seeded value. `useSeededBiome` watches this attribute with a
  // MutationObserver, so setting it re-renders the scene.
  await page.evaluate((b) => document.documentElement.setAttribute("data-biome", b), biome);
  await page.waitForTimeout(400);
}

/** Layer count actually painted, however the scene chooses to paint it. */
async function layersDrawn(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scene = document.querySelector(".biome, [data-biome-scene]");
    if (!scene) return 0;
    return scene.querySelectorAll("img, .biome-layer, canvas, svg").length;
  });
}

test.describe("the seven biomes, one capture each", () => {
  for (const biome of [...ART, ...PROCEDURAL, ...NOT_VENDORED]) {
    test(`biome: ${biome}`, async ({ page }, testInfo: TestInfo) => {
      test.skip(testInfo.project.name !== "desktop-1440", "one width for the record");

      await landing(page, biome);

      const file = testInfo.outputPath(`biome-${biome}.png`);
      await page.screenshot({ path: file, fullPage: false });
      await testInfo.attach(`biome-${biome}`, { path: file, contentType: "image/png" });

      // The stage content is unaffected by the weather, in every case.
      await expect(page.locator("h1")).toBeVisible();
    });
  }

  test("an un-vendored biome renders NOTHING, not a stand-in", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * The rule this exists to hold. A gradient stand-in looks finished, so an
     * un-sourced biome would be indistinguishable from a done one and would get
     * signed off as such. §2 was revised to forbid exactly that.
     */
    for (const biome of NOT_VENDORED) {
      await landing(page, biome);
      expect(
        await layersDrawn(page),
        `${biome} has no vendored art and must draw nothing — a stand-in would look done`,
      ).toBe(0);
    }
  });

  test("every vendored biome actually draws", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    /*
     * This is what stops the test above passing for the boring reason: if the
     * scene component were broken everywhere, "the un-vendored ones draw
     * nothing" would be trivially true and the whole feature would be recorded
     * as working. Checked for EACH vendored biome, not one representative —
     * a manifest with a typo'd path fails here and nowhere else.
     */
    for (const biome of ART) {
      await landing(page, biome);
      expect(
        await layersDrawn(page),
        `${biome} has vendored layers and must paint them`,
      ).toBeGreaterThan(0);
    }
  });

  test("the biome carries no meaning, so it needs no text equivalent", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

    await landing(page, "neutral");

    /*
     * The one place in this redesign where "no accessible equivalent" is the
     * right call, and it is right BECAUSE a biome carries zero pedagogical
     * weight: a screen-reader user gets the same stage, they are simply not
     * told the weather. Anything that means something is text, as everywhere
     * else — so this asserts the scene is hidden, not that it is described.
     */
    const scene = page.locator(".biome, [data-biome-scene]").first();
    if ((await scene.count()) > 0) {
      await expect(scene).toHaveAttribute("aria-hidden", "true");
    }
  });
});
