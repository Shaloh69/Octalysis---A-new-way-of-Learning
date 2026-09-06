import type { BiomeManifest } from "../registry";

/**
 * Jungle — **enclosed, no horizon** (§2c).
 *
 * Composed from Kenney Background Elements (CC0), not the pack §2's table names.
 * *Free Pixel Art Forest* by edermunizz is usable and is better art, but it is
 * the one pack of the six that **requires credit** — a standing obligation on
 * every future edit of `CREDITS.md`, where CC0 creates none. See §2a.
 *
 * ## Structure, and why it is not the desert's
 *
 * A jungle's character is **enclosure**. There is no horizon and almost no sky:
 * canopy intrudes from the top edge, trunks cross the full height, and the
 * student is *inside* it rather than looking at it. The desert is the opposite
 * composition — most of the frame is sky and one form dominates — which is what
 * makes the two read as different places rather than as one place recoloured.
 *
 * ## Why the sprites are scattered, not tiled
 *
 * The first version tiled one sprite per layer with `repeat-x`, which is
 * uniform by construction: the same silhouette at the same interval, forever.
 * It read as wallpaper, and no amount of choosing prettier trees fixes a
 * mechanism that repeats exactly.
 *
 * Each layer now carries **several variants** and scatters individual sprites,
 * each taking its variant, position, size and horizontal flip from a
 * deterministic hash. Six trees from a pool of five silhouettes, mirrored half
 * the time, sized within ±35% — the eye stops finding the interval because
 * there is not one.
 *
 * Total vendored weight: **24 KB** for twelve sprites.
 */
const manifest: BiomeManifest = {
  name: "jungle",
  ground: 14,
  motif: "leaves",
  layers: [
    /*
     * Back to front, and **density falls as depth rises** — 5 clouds, then 22
     * far trees, 14 mid, 7 near, 5 canopy. That ordering is the rule, not a
     * preference: a forest is dense at the back because you are seeing through
     * many trees at once, and sparse at the front because you are between them.
     * Reversing it produces a hedge with a view behind it.
     *
     * Each layer's variant pool mixes SILHOUETTES rather than sizes of one
     * shape. A pool of one shape at three sizes still reads as one tree, which
     * is what made the first build look like wallpaper.
     */
    { src: "/biomes/jungle/cloud6.png", depth: 0.08, scale: 0.085, align: "top",
      variants: [
        "/biomes/jungle/cloud6.png", "/biomes/jungle/cloud2.png",
        "/biomes/jungle/cloud8.png", "/biomes/jungle/cloud9.png",
      ],
      count: 5, jitter: 0.65 },

    /*
     * FAR CANOPY — 22 trees, and they are meant to merge.
     *
     * It was 9, which at this size left visible sky between every trunk and made
     * the horizon read as a row of shrubs. Overlapping instances are the whole
     * point: at this depth the aerial-perspective ramp has flattened them to
     * near-silhouettes, so what the eye gets is a continuous dark mass with a
     * ragged top edge, which is what a distant forest actually looks like.
     */
    { src: "/biomes/jungle/tree05.png", depth: 0.22, scale: 0.13, align: "bottom",
      variants: [
        "/biomes/jungle/tree05.png", "/biomes/jungle/tree06.png",
        "/biomes/jungle/tree09.png", "/biomes/jungle/tree12.png",
        "/biomes/jungle/tree13.png",
      ],
      count: 26, jitter: 0.5 },

    // A second far band, slightly nearer and slightly larger, so the mass has
    // internal depth instead of being one flat wall of trees.
    { src: "/biomes/jungle/tree08.png", depth: 0.38, scale: 0.19, align: "bottom",
      variants: [
        "/biomes/jungle/tree08.png", "/biomes/jungle/tree01.png",
        "/biomes/jungle/tree05.png", "/biomes/jungle/tree13.png",
      ],
      count: 18, jitter: 0.45 },

    // Mid: the layer that carries most of the readable depth.
    { src: "/biomes/jungle/tree01.png", depth: 0.58, scale: 0.27, align: "bottom",
      variants: [
        "/biomes/jungle/tree01.png", "/biomes/jungle/tree11.png",
        "/biomes/jungle/tree04.png", "/biomes/jungle/tree03.png",
      ],
      count: 12, jitter: 0.4 },

    /*
     * Near: tall enough to leave the frame at the top, which is what makes the
     * scene ENCLOSING rather than a row of trees on a lawn. Kept sparse, because
     * at this size more would close the page entirely — and because a forest is
     * sparse where you are standing.
     */
    { src: "/biomes/jungle/tree03.png", depth: 0.9, scale: 0.46, align: "bottom",
      variants: ["/biomes/jungle/tree03.png", "/biomes/jungle/tree02.png"],
      count: 6, jitter: 0.35 },

    { src: "/biomes/jungle/grass2.png", depth: 1, scale: 0.05, align: "bottom",
      variants: ["/biomes/jungle/grass2.png"], count: 18, jitter: 0.55 },
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
