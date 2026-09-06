import type { BiomeManifest } from "../registry";

/**
 * Desert — **wide, low horizon** (§2c).
 *
 * Composed from Kenney Background Elements (CC0). The pack §2's table names,
 * *Desert Parallax Background* by styloo, **now returns 404** — a licence
 * verified against a page that no longer exists cannot be re-verified by anyone.
 * See §2a.
 *
 * ## Structure, and why it is the jungle's opposite
 *
 * A desert is **space**. Most of the frame is empty sky, the horizon sits low,
 * and the eye travels a long way before it meets anything. Where the jungle
 * encloses with many near forms, this one has **few forms, far apart, small
 * against the sky** — and one dominant silhouette rather than a repeat.
 *
 * That is deliberate contrast, not decoration: §2c's greyscale test asks
 * whether two biomes are still distinguishable with all colour removed, and
 * "dense and enclosing" versus "sparse and open" survives desaturation where
 * "green trees" versus "yellow trees" does not.
 *
 * ## The pyramids are scattered but few
 *
 * Three, not nine. A desert with nine evenly-spaced pyramids is a pattern; a
 * desert with three at different sizes is a place. The mountains behind them
 * come from a two-variant pool so the skyline is not one shape repeated.
 *
 * Total vendored weight: **17 KB** for nine sprites.
 */
const manifest: BiomeManifest = {
  name: "desert",
  ground: 12,
  motif: "sand",
  layers: [
    /*
     * The sun sits highest and barely parallaxes — a sun that moves with the
     * foreground reads as a lamp. It is also the only single-instance layer
     * here: there is exactly one sun, and scattering it would be absurd.
     */
    { src: "/biomes/desert/sun.png", depth: 0.03, scale: 0.08, align: "top",
      // ONE sun. Without `variants` a layer falls through to the tiled path
      // and `repeat-x` put a ROW of suns across the sky -- which is exactly
      // the uniformity this rebuild exists to remove, reintroduced by an
      // omission rather than a decision.
      variants: ["/biomes/desert/sun.png"], count: 1, jitter: 0 },

    /*
     * Clouds: four shapes, six instances, ±70% spread — the widest in any biome,
     * because a desert sky is mostly empty and every repetition shows. Two
     * bands at different depths rather than one, so they do not all sit on one
     * plane.
     */
    { src: "/biomes/desert/cloud7.png", depth: 0.1, scale: 0.055, align: "top",
      variants: [
        "/biomes/desert/cloud7.png", "/biomes/desert/cloud3.png",
        "/biomes/desert/cloud1.png", "/biomes/desert/cloud9.png",
      ],
      count: 6, jitter: 0.7 },
    { src: "/biomes/desert/cloud3.png", depth: 0.18, scale: 0.085, align: "top",
      variants: ["/biomes/desert/cloud3.png", "/biomes/desert/cloud1.png"],
      count: 3, jitter: 0.6 },

    /*
     * FAR RANGE — pointy_mountains and mountain2, 9 instances, small.
     *
     * This layer did not exist. The range started at mountain1/3 and there was
     * nothing behind it, so the horizon was a single row of peaks with sky
     * straight above. A distant range is many overlapping ridges; that is what
     * makes the desert read as deep rather than wide.
     */
    { src: "/biomes/desert/pointy_mountains.png", depth: 0.2, scale: 0.1, align: "bottom",
      variants: [
        "/biomes/desert/pointy_mountains.png", "/biomes/desert/mountain2.png",
        "/biomes/desert/mountain1.png",
      ],
      count: 9, jitter: 0.5 },

    /*
     * Distant mountains, LOW in the frame. This is the horizon line, and
     * keeping it low is what leaves the sky dominant — raise this and the
     * composition stops being a desert.
     */
    { src: "/biomes/desert/mountain1.png", depth: 0.36, scale: 0.15, align: "bottom",
      variants: [
        "/biomes/desert/mountain1.png", "/biomes/desert/mountain3.png",
        "/biomes/desert/mountain2.png",
      ],
      count: 7, jitter: 0.5 },

    // The dominant form. Three, at genuinely different sizes.
    { src: "/biomes/desert/piramid.png", depth: 0.7, scale: 0.24, align: "bottom",
      variants: ["/biomes/desert/piramid.png"], count: 3, jitter: 0.6 },

    // Sparse scrub. Wide gaps are the point — this is not a lawn, and a desert
    // is the one biome whose FOREGROUND should be emptier than its distance.
    { src: "/biomes/desert/grass3.png", depth: 1, scale: 0.035, align: "bottom",
      variants: ["/biomes/desert/grass3.png"], count: 9, jitter: 0.65 },
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
