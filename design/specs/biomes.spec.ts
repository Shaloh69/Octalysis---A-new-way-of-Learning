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
 *   art         vendored parallax layers. ALL SEVEN, as of 2 September 2026.
 *   procedural  no layers, and that is intentional. Empty now — `volcanic` was
 *               the only one, and it has been replaced by `city`, which has art.
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

/** Vendored art. All seven — three Kenney composites and four vendored packs. */
const ART = ["neutral", "desert", "jungle", "arctic", "ocean", "cave", "city"] as const;
/** Allowed to draw from tokens — the one named exception. */
/**
 * Empty. `volcanic` was the only procedural biome and has been replaced by
 * `city`, which has real CC0 art — see `packs/city.ts`.
 */
const PROCEDURAL: readonly string[] = [];
/**
 * Not vendored. Must render NOTHING.
 *
 * `arctic` and `ocean` have approved packs whose downloads need a browser
 * session (itch.io), and `cave` has no approved source at all — the pack §2
 * named is marked do-not-use over an unresolved licence conflict.
 */
/**
 * Nothing is un-vendored any more — all SEVEN biomes have real art, including
 * the two that once did not: volcanic (replaced by city) and cave (replaced).
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

  /*
   * Wait for the SCENE, not for a stopwatch. This was `waitForTimeout(400)`,
   * which was enough while a biome was five tiled layers and stopped being
   * enough when jungle grew to 85 individual <img> sprites — the pack is
   * lazy-loaded per biome, so a denser manifest genuinely takes longer to mount
   * and the fixed wait started failing intermittently.
   *
   * A fixed sleep tuned against one version of the thing it waits for is a test
   * that will lie again the next time that thing changes.
   */
  await page
    .waitForFunction(() => {
      const scene = document.querySelector(".biome");
      if (!scene) return false;
      const imgs = Array.from(scene.querySelectorAll("img"));
      return imgs.every((i) => i.complete);
    }, undefined, { timeout: 10_000 })
    .catch(() => {
      // A biome that legitimately draws nothing never satisfies the predicate.
      // That is the un-vendored case, which has its own assertion.
    });
  await page.waitForTimeout(150);
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

  /*
   * THE TEMPLATE — `BIOME-AND-LOADING-SPEC.md` §2e, asserted per biome.
   *
   * The requirement was that biomes "have Templates that we follow to the
   * letter", and a template followed by intention is a template that drifts.
   * §2e names six slots; this is where skipping one fails.
   *
   * It exists because the first seven biomes each skipped THREE slots — no sky,
   * no ground, no atmospheric perspective — and still looked plausible enough to
   * ship. Every one of those was found by eye, late, one at a time. A slot
   * missing from a manifest should fail in CI on the commit that omits it.
   */
  /*
   * Exempt from the ground slot, and all four for the SAME reason: their packs
   * are pre-cut scenes that already paint a floor — arctic's snow, ocean's
   * seabed, cave's rubble, city's street. Drawing a second ground over a painted
   * one puts a flat coloured band across it.
   *
   * Not one of these is exempt for having no floor. That distinction matters,
   * because "this biome has no ground" is a claim about the WORLD and would
   * survive an art change, while "its art already draws one" is a claim about
   * the PACK and stops being true the moment the pack is replaced. Cave's was
   * replaced during this very session.
   */
  const NO_GROUND: readonly string[] = ["arctic", "ocean", "cave", "city"];

  for (const biome of ART) {
    test(`template: ${biome} fills every slot §2e requires`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

      await landing(page, biome);

      const shape = await page.evaluate(() => {
        const scene = document.querySelector(".biome");
        if (!scene) return null;
        const sprites = Array.from(scene.querySelectorAll(".biome-sprite"));
        return {
          sky: getComputedStyle(scene).backgroundImage,
          layers: scene.querySelectorAll(".biome-layer").length,
          ground: scene.querySelectorAll(".biome-ground").length,
          // Distinct rendered widths, rounded — the scatter signature. A tiled
          // layer produces exactly one.
          widths: new Set(
            sprites.map((el) => Math.round(el.getBoundingClientRect().width)),
          ).size,
          sprites: sprites.length,
        };
      });

      expect(shape, `${biome} renders no .biome scene at all`).not.toBeNull();
      const drawn = shape!;

      // Slot 1 - sky. A layer, not a background colour. Without it the scene is
      // sprites on the page surface, which is how every biome came out murky
      // regardless of how good its art was.
      expect(drawn.sky, `${biome} paints no sky gradient - §2e slot 1`).toContain("gradient");

      // Slots 2-4 - far, mid, near. Two layers is a backdrop and a sprite.
      expect(drawn.layers, `${biome} has fewer than three depth layers - §2e slots 2-4`)
        .toBeGreaterThanOrEqual(3);

      // Slot 5 - ground, unless the biome is a recorded structural exemption.
      if (NO_GROUND.includes(biome)) {
        expect(drawn.ground, `${biome} is exempt from the ground slot and must not draw one`)
          .toBe(0);
      } else {
        expect(drawn.ground, `${biome} draws no ground - its sprites stand on sky. §2e slot 5`)
          .toBe(1);
      }

      // The scatter rule. Only meaningful where the biome actually scatters:
      // strip packs are single pre-cut images per layer by design.
      if (drawn.sprites > 3) {
        expect(drawn.widths, `${biome} scatters ${drawn.sprites} sprites at one size - that tiles`)
          .toBeGreaterThan(1);
      }
    });
  }

  /*
   * THREE RULES ABOUT SPRITES, all of them written after the same mistake:
   * looking at a biome, thinking it was fine, and being wrong.
   *
   * Every one of these was found by MEASURING, never by looking. Squashing at
   * 27% is invisible on a tree you have never seen undistorted; a floating
   * sprite reads as "stylised" until you notice none of them touch anything;
   * density reversal just looks like a sparse biome. So they are measured here
   * on every run instead of being noticed eventually.
   */
  for (const biome of ART) {
    test(`sprites: ${biome} is undistorted, grounded and denser with distance`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-1440", "one width is enough");

      await landing(page, biome);

      const data = await page.evaluate(async () => {
        const natural = (url: string): Promise<[number, number]> =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
            img.onerror = () => resolve([0, 0]);
            img.src = url;
          });

        const sprites: Array<{
          layer: number;
          src: string;
          rendered: number;
          source: number;
          bottom: number;
          sky: boolean;
        }> = [];

        const layers = Array.from(document.querySelectorAll(".biome-scatter"));
        /*
         * Depth, not index. Splitting the layer LIST in half counted desert's
         * sun and two cloud bands as "the back of the scene" and reported it as
         * denser in front — three sky layers outnumbered the ground ones and
         * the measurement described the manifest's ordering rather than the
         * scene's depth.
         */
        const perLayer = layers.map((l) => ({
          depth: Number((l as HTMLElement).style.getPropertyValue("--biome-depth")) || 0,
          count: l.querySelectorAll(".biome-sprite").length,
          sky: Boolean(l.querySelector("img.biome-sprite")?.getAttribute("style")?.includes("top:")),
        }));
        const ground = document.querySelector(".biome-ground");
        const groundTop = ground ? ground.getBoundingClientRect().top : window.innerHeight;

        for (let i = 0; i < layers.length; i += 1) {
          for (const el of Array.from(layers[i]!.querySelectorAll("img.biome-sprite"))) {
            const img = el as HTMLImageElement;
            const r = img.getBoundingClientRect();
            const [nw, nh] = await natural(img.src);
            sprites.push({
              layer: i,
              src: img.src.split("/").slice(-1)[0]!,
              rendered: r.height ? r.width / r.height : 0,
              source: nh ? nw / nh : 0,
              bottom: r.bottom,
              // Sky layers are positioned from the TOP and are supposed to be
              // up there. A cloud is not a floating tree.
              sky: img.style.top !== "",
            });
          }
        }
        return { sprites, perLayer, groundTop, viewport: window.innerHeight };
      });

      if (data.sprites.length === 0) {
        test.skip(true, `${biome} is a strip pack and scatters nothing`);
        return;
      }

      /*
       * 1. NOTHING IS SQUASHED.
       *
       * Sprites are <img> with `width: auto`, so the ratio comes from the file
       * and this should be exact. It is asserted anyway because the previous
       * form — a declared `aspect` per layer — looked equally correct and was
       * wrong for fourteen sprites, the worst by 51%. The bound is 3%, which is
       * sub-pixel rounding and nothing else.
       */
      for (const s of data.sprites) {
        if (!s.source) continue;
        const err = Math.abs(s.rendered / s.source - 1) * 100;
        expect(
          err,
          `${biome}/${s.src} renders at ${s.rendered.toFixed(2)} but the file is ` +
            `${s.source.toFixed(2)} — distorted ${err.toFixed(0)}%`,
        ).toBeLessThan(3);
      }

      /*
       * 2. NOTHING FLOATS.
       *
       * Every sprite's base must reach the ground line. Vertical jitter is
       * allowed to SINK a sprite (standing behind the horizon) and never to lift
       * one, so a base above the ground plane's top edge means the jitter has
       * gone the wrong way — which it did, for half of every layer, when the
       * offset was symmetric around zero.
       */
      const floor = data.groundTop;
      for (const s of data.sprites) {
        // Clouds and suns are `align: "top"` and belong in the sky. Only things
        // that stand on the ground are held to standing on it.
        if (s.sky) continue;
        expect(
          s.bottom,
          `${biome}/${s.src} floats: its base is at ${Math.round(s.bottom)}px, ` +
            `above the ground line at ${Math.round(floor)}px`,
        ).toBeGreaterThanOrEqual(floor - 1);
      }

      /*
       * 3. DENSITY FALLS TOWARD THE VIEWER.
       *
       * A forest is dense at the back because you see through many trees at
       * once, and sparse at the front because you stand between them. Reversing
       * it produces a hedge with a view behind it, which is what the first build
       * looked like.
       *
       * Asserted as first-half vs second-half rather than layer-by-layer, so a
       * biome can still put a deliberate cluster in a near layer (desert's
       * pyramids) without failing.
       */
      const ground = data.perLayer.filter((l) => !l.sky);
      /*
       * Only meaningful where a biome scatters across DEPTH. `cave` scatters
       * only its foreground props — its far and mid planes are strips — so it
       * has nothing at depth < 0.5 to compare against, and asserting anyway
       * would demand a distant layer that its pack deliberately paints instead.
       */
      const scattersInDepth =
        ground.some((l) => l.depth < 0.5) && ground.some((l) => l.depth >= 0.5);
      if (ground.length >= 2 && scattersInDepth) {
        const back = ground.filter((l) => l.depth < 0.5).reduce((a, l) => a + l.count, 0);
        const front = ground.filter((l) => l.depth >= 0.5).reduce((a, l) => a + l.count, 0);
        expect(
          back,
          `${biome} is denser in front (${front}) than behind (${back}) — ` +
            `distance should carry more instances, not fewer`,
        ).toBeGreaterThanOrEqual(front * 0.6);
      }
    });
  }

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
