import type { BiomeManifest } from "../registry";

/**
 * Neutral — the default landing, and the fallback in the rotation.
 *
 * **Vendored.** Kenney Background Elements, CC0, from
 * https://kenney.nl/assets/background-elements — the pack ships its own
 * `License.txt`, kept beside the art at `public/biomes/neutral/`. CC0 requires
 * no attribution; `public/CREDITS.md` credits it anyway, which is this
 * project's stated rule ("every asset OCTA ships, with its licence — including
 * the ones whose licence does not require attribution").
 *
 * These are individual ELEMENTS, not pre-cut parallax strips, so the scene is
 * composed here: each layer tiles one sprite horizontally at its own size and
 * depth. That is what the pack is for — §2's table calls it the "base layer for
 * several biomes".
 *
 * Total vendored weight: 27 KB for seven sprites, and only the three below are
 * referenced. Recorded in `docs/PROGRESS.md`'s biome weights table.
 */
const manifest: BiomeManifest = {
  name: "neutral",
  layers: [
    // Back to front. Depth 0 is the horizon and does not move.
    /*
     * Five layers rather than three, and two different trees at two depths.
     *
     * The first composition used one tree tiled at one size, and it read as
     * wallpaper: identical trunk every 100px. Real parallax gets its depth from
     * the same kind of object appearing at different sizes, so tree20 sits
     * small and far back while tree12 sits larger and nearer — which also
     * breaks the repeat, because the two tile at different intervals and drift
     * in and out of phase across the band.
     */
    { src: "/biomes/neutral/cloud1.png", depth: 0.08, scale: 0.20, align: "top" },
    { src: "/biomes/neutral/cloud5.png", depth: 0.18, scale: 0.26, align: "top" },
    { src: "/biomes/neutral/tree20.png", depth: 0.42, scale: 0.42, align: "bottom" },
    { src: "/biomes/neutral/tree12.png", depth: 0.7, scale: 0.6, align: "bottom" },
    { src: "/biomes/neutral/grass4.png", depth: 1, scale: 0.13, align: "bottom" },
  ],
  credit: {
    pack: "Background Elements",
    author: "Kenney Vleugels (kenney.nl)",
    url: "https://kenney.nl/assets/background-elements",
    license: "CC0 1.0",
  },
};

export default manifest;
