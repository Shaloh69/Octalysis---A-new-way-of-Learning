import type { BiomeManifest } from "../registry";

/**
 * Jungle — **rebuilt as a strip pack, 7 September 2026.**
 *
 * ## Why the Kenney composition is gone
 *
 * It was built from Kenney Background Elements: flat vector trees scattered by
 * this renderer, densified to 85 sprites across five planes, with a ground band
 * drawn from a token. Every technique in §2e was applied to it and it still read
 * as bland — because the problem was never the composition. Flat two-tone vector
 * shapes have **no internal detail**, so no amount of scattering, overlapping or
 * atmospheric ramping gives the eye anything to find. Density made it a denser
 * flat picture.
 *
 * The instruction was to rebuild it on the template that `cave`, `arctic` and
 * `ocean` already follow: a **pre-cut pack drawn as a set** by one artist, where
 * the depth, the palette and the light are decisions someone made rather than
 * effects this renderer applies afterwards.
 *
 * ## Licence
 *
 * *Forest Background* by **Luis Zuno (@ansimuz)**, from OpenGameArt —
 * https://opengameart.org/content/forest-background. **CC0, confirmed twice**:
 * the entry's structured `License(s)` field, and the pack's own `license.txt`
 * ("License (CC0) You can copy, modify, distribute and perform the work, even
 * for commercial purposes, all without asking permission").
 *
 * ## Structure — **enclosed, no horizon, lit from above** (§2c)
 *
 * The only biome with **no visible sky and no horizon line**: trunks fill the
 * frame edge to edge and the light arrives in shafts from above rather than from
 * a sun. That is what makes it read as *inside* a forest rather than as a view
 * of one, and it is why the near layer leaves the frame at the top.
 *
 * It is also the only biome whose light is a **separate layer**. `lights.png` is
 * 16% coverage — dithered god-rays that sit between the middle and front trees,
 * which is a compositional idea the scatter renderer had no way to express.
 *
 * **The floor comes with the art**, and it is the varied floor the token-drawn
 * ground band could never be: grass tufts, litter and a broken edge, drawn to
 * match the trees standing on it.
 *
 * Total vendored weight: **10 KB** for four layers — a quarter of what the 85
 * scattered sprites cost, for a scene with far more in it.
 */
const manifest: BiomeManifest = {
  name: "jungle",
  kind: "strip",
  motif: "leaves",
  layers: [
    /*
     * Back to front. The alpha confirms the stack rather than assuming it:
     * back-trees is 100% opaque and is the ONLY fully-opaque layer, then 51.7%,
     * 16.1% and 39.2%. Arctic's pack had a second opaque layer hiding at the end
     * of its sequence which silently covered the whole scene, so this is
     * measured for every pack now.
     *
     * `lights` sits BETWEEN mid and front on purpose — god-rays fall in front of
     * the middle distance and behind the nearest trunks, which is what makes
     * them read as light in the air rather than as a glow pasted on top.
     */
    { src: "/biomes/jungle/back.png", depth: 0, scale: 1, align: "bottom" },
    { src: "/biomes/jungle/mid.png", depth: 0.45, scale: 1, align: "bottom" },
    { src: "/biomes/jungle/lights.png", depth: 0.7, scale: 1, align: "bottom" },
    { src: "/biomes/jungle/front.png", depth: 1, scale: 1, align: "bottom" },
  ],
  credit: {
    pack: "Forest Background",
    author: "Luis Zuno (@ansimuz)",
    url: "https://opengameart.org/content/forest-background",
    license:
      "CC0 — confirmed twice: the OpenGameArt entry's License(s) field, and the pack's own " +
      'license.txt, verbatim "License (CC0) You can copy, modify, distribute and perform ' +
      'the work, even for commercial purposes, all without asking permission."',
    // None. CC0. CREDITS.md credits Luis Zuno anyway, per that file's own rule.
    obligations: [],
  },
};

export default manifest;
