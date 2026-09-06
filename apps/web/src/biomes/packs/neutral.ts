import type { BiomeManifest } from "../registry";

/**
 * Neutral — **balanced, mid horizon** (§2c), and deliberately the plainest.
 *
 * **Vendored.** Kenney Background Elements, CC0, from
 * https://kenney.nl/assets/background-elements — the pack ships its own
 * `License.txt`, kept beside the art at `public/biomes/neutral/`. CC0 requires
 * no attribution; `public/CREDITS.md` credits it anyway, which is this
 * project's stated rule.
 *
 * ## It is the default, so it must not compete
 *
 * Every other biome gets a distinctive structure: the jungle encloses, the
 * desert opens out, the ocean suspends, the cave frames. This one sits in the
 * middle on purpose — a mid horizon, moderate density, and **no ambient
 * motif**. It is what a student sees when nothing in particular has been
 * chosen for them, and a default that demands attention is a default that has
 * to be got rid of.
 *
 * That is a composition decision, not an absence of one. "Plain" here means
 * balanced, not unfinished.
 *
 * ## Scattered, like the others
 *
 * The original tiled two tree sprites with `repeat-x` and read as wallpaper —
 * an identical trunk every hundred pixels. Each layer now scatters individual
 * sprites from a variant pool, with per-instance size and flip. The variant
 * pools mix silhouettes rather than sizes of one shape: tree15 is narrow,
 * tree22 and tree20 are tall, tree05 and tree12 are round.
 *
 * Total vendored weight: **23 KB** for twelve sprites.
 */
const manifest: BiomeManifest = {
  name: "neutral",
  ground: 16,
  // No motif. See above — the default stays quiet.
  layers: [
    /*
     * Clouds: five variants, five instances, ±65% size spread. It was three
     * variants at ±45%, which at this scale read as one cloud stamped along the
     * top — the sky is the largest empty area in the frame, so uniformity shows
     * there first and worst.
     */
    { src: "/biomes/neutral/cloud1.png", depth: 0.07, scale: 0.075, align: "top",
      variants: [
        "/biomes/neutral/cloud1.png", "/biomes/neutral/cloud4.png",
        "/biomes/neutral/cloud5.png", "/biomes/neutral/cloud2.png",
        "/biomes/neutral/cloud8.png",
      ],
      count: 5, jitter: 0.65 },

    /*
     * Rolling hills as the horizon — a wide sprite at a single instance, which
     * is what puts the horizon at the MIDDLE of the frame rather than low
     * (desert) or absent (jungle).
     */
    { src: "/biomes/neutral/hills2.png", depth: 0.22, scale: 0.14, align: "bottom" },

    /*
     * Far treeline, 20 instances from six shapes. Small and overlapping, so the
     * hills carry a wood along their crest rather than seven separate trees on
     * a ridge. Density falls with every layer forward from here.
     */
    { src: "/biomes/neutral/tree26.png", depth: 0.36, scale: 0.11, align: "bottom",
      variants: [
        "/biomes/neutral/tree26.png", "/biomes/neutral/tree31.png",
        "/biomes/neutral/tree34.png", "/biomes/neutral/tree20.png",
        "/biomes/neutral/tree22.png", "/biomes/neutral/tree15.png",
      ],
      count: 20, jitter: 0.5 },

    { src: "/biomes/neutral/tree20.png", depth: 0.58, scale: 0.17, align: "bottom",
      variants: [
        "/biomes/neutral/tree20.png", "/biomes/neutral/tree15.png",
        "/biomes/neutral/tree22.png", "/biomes/neutral/tree31.png",
      ],
      count: 11, jitter: 0.42 },

    { src: "/biomes/neutral/tree12.png", depth: 0.82, scale: 0.26, align: "bottom",
      variants: [
        "/biomes/neutral/tree12.png", "/biomes/neutral/tree30.png",
        "/biomes/neutral/tree05.png", "/biomes/neutral/tree34.png",
      ],
      count: 6, jitter: 0.38 },

    { src: "/biomes/neutral/grass4.png", depth: 1, scale: 0.045, align: "bottom",
      variants: ["/biomes/neutral/grass4.png", "/biomes/neutral/grass1.png"],
      count: 15, jitter: 0.55 },
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
