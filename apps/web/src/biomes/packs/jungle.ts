import type { BiomeManifest } from "../registry";

/**
 * Jungle — vendored 2 September 2026.
 *
 * **NOT the pack `BIOME-AND-LOADING-SPEC.md` §2 names, and that is deliberate.**
 * That table points at *Free Pixel Art Forest* by edermunizz, recorded with its
 * terms verified verbatim: *"You can use this asset even commercially, just give
 * proper credit. You CANNOT use in NFT or crypto games."* **Credit is required** —
 * the only pack of the six where it is.
 *
 * Two reasons this uses Kenney instead:
 *
 *   1. itch.io's download flow needs a browser session rather than a fetch,
 *      which §1b predicted and which a bare `curl` confirmed.
 *   2. A required-attribution pack creates a standing obligation that has to
 *      survive every future edit of `CREDITS.md`. Kenney's CC0 creates none.
 *
 * The edermunizz pack remains the better *art* and is still the right choice if
 * someone wants the denser look — its terms are perfectly usable, they just have
 * to be honoured. If it is ever vendored, `credit.obligations` below is where
 * the requirement gets recorded, and `registry.ts` is what makes that field
 * impossible to leave empty by accident.
 *
 * Total vendored weight: **7.9 KB** for five sprites.
 */
const manifest: BiomeManifest = {
  name: "jungle",
  layers: [
    /*
     * Back to front, three canopy depths.
     *
     * THE FIRST COMPOSITION READ AS WALLPAPER — the exact failure `neutral.ts`
     * warns about, reproduced by not checking the sprites first. tree01, tree03
     * and tree05 are all ~130px wide and similarly round (aspects 1.78–2.15),
     * so at similar scales they tiled at nearly the same interval and stamped
     * one identical egg-shaped tree across the band.
     *
     * The fix is arithmetic, not taste. What breaks a repeat is the RENDERED
     * tile width differing between layers, because layers whose intervals share
     * no common rhythm drift in and out of phase across the band:
     *
     *   tree05  129px × 0.30 ≈  39px   far, reads as texture
     *   tree01  128px × 0.58 ≈  74px   mid
     *   tree03  136px × 0.95 ≈ 129px   near, and the tallest silhouette (2.15)
     *
     * 39 / 74 / 129 — no two are close, and the tallest sprite is nearest, so
     * the near layer also breaks the skyline the far ones make.
     */
    { src: "/biomes/jungle/cloud2.png", depth: 0.1, scale: 0.24, align: "top" },
    { src: "/biomes/jungle/tree05.png", depth: 0.3, scale: 0.3, align: "bottom" },
    { src: "/biomes/jungle/tree01.png", depth: 0.55, scale: 0.58, align: "bottom" },
    { src: "/biomes/jungle/tree03.png", depth: 0.85, scale: 0.95, align: "bottom" },
    { src: "/biomes/jungle/grass2.png", depth: 1, scale: 0.12, align: "bottom" },
  ],
  credit: {
    pack: "Background Elements",
    author: "Kenney Vleugels (kenney.nl)",
    url: "https://kenney.nl/assets/background-elements",
    license: "CC0 1.0 (Creative Commons Zero) — verified in the pack's own License.txt",
    obligations: [],
  },
};

export default manifest;
