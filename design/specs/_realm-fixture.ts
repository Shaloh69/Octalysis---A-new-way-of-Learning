import type { Page } from "@playwright/test";

/**
 * Put one planet in a chosen biome, the way a real student gets one.
 *
 * Since 30 Sep 2026 the biome on <html> is decided by the REALM
 * (apps/web/src/lib/realm.ts, WEB-REMAKE.md §1): the route plus the student's
 * per-planet biomes from GET /api/v1/cosmetics. A spec that wrote
 * `data-biome` by hand now races the realm, which re-applies the planet's own
 * biome when the cosmetics response lands. So this changes the INPUT instead:
 * the response names `biome` for `stage`, and the first-frame cache index.html
 * reads says the same, so the planet wears it from the first paint on.
 */
export async function forcePlanetBiome(page: Page, stage: string, biome: string): Promise<void> {
  await page.addInitScript(
    ([s, b]) => {
      try {
        const raw = localStorage.getItem("octa:planet-biomes");
        const cached = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        localStorage.setItem("octa:planet-biomes", JSON.stringify({ ...cached, [s as string]: b }));
      } catch {
        /* no storage: the response below still carries it */
      }
    },
    [stage, biome],
  );
  await page.route("**/api/v1/cosmetics", async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as { planetBiomes?: Record<string, string> };
    json.planetBiomes = { ...(json.planetBiomes ?? {}), [stage]: biome };
    await route.fulfill({ response: res, json });
  });
}
