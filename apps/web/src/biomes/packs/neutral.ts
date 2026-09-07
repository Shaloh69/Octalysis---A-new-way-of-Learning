import type { BiomeManifest } from "../registry";

/**
 * Neutral — **rebuilt as a strip pack, 7 September 2026**, for the reason
 * `jungle` records at length: flat vector shapes have no internal detail, so
 * scattering more of them makes a denser flat picture.
 *
 * ## Licence
 *
 * *Parallax background forest pixel art* by **MatiasVME**, from OpenGameArt —
 * https://opengameart.org/content/parallax-background-forest-pixel-art. **CC0**,
 * the entry's structured `License(s)` field, attribution instructions "No
 * attribution required". Sourced from OGA rather than itch for the reason §2a
 * records: OGA states the licence as metadata on the work, so it can be
 * re-verified later.
 *
 * ## Structure — **open, mid horizon, the only snow-capped range** (§2c)
 *
 * The default biome, and the one a student who never opens Settings will spend
 * the semester in — so it is deliberately the calmest composition: a wide green
 * valley, a horizon across the MIDDLE of the frame, and a distant treeline
 * rather than trees in the foreground. Nothing in it is close to the viewer.
 *
 * It carries the only **snow-capped peaks** in the set, which is what separates
 * it from `arctic` (all snow, high horizon) and from `jungle` (no horizon at
 * all) in the greyscale test.
 *
 * **A separate sun layer**, at 0.7% coverage — one small disc, not a gradient.
 * Its own layer means it barely parallaxes, and a sun that moves with the
 * foreground reads as a lamp.
 *
 * **The floor is loose rock**, drawn as its own layer at 2.7% coverage. That is
 * the flooring variety the token-drawn ground band could not produce: individual
 * stones with highlights, breaking the line where the trees meet the ground.
 *
 * Total vendored weight: **45 KB** for eight layers.
 */
const manifest: BiomeManifest = {
  name: "neutral",
  kind: "strip",
  // No motif, on purpose. This is the default biome, and a default that demands
  // attention is one a student has to get rid of. §2e records the exemption.
  layers: [
    /*
     * Back to front, and the alpha says which is which rather than the naming:
     * sky 100% opaque (and the only one), sun 0.7%, clouds 5.2%, then the three
     * mountain bands at 31.2% / 40.6% / 55.7% — rising coverage, which is what
     * confirms 1 is farthest and 3 nearest. Then trees 4.6% and rocks 2.7%.
     *
     * Eight layers is the deepest stack in the set, and it is why this biome
     * reads as open country rather than as a backdrop: the three mountain bands
     * alone give the horizon more recession than any other pack has.
     */
    { src: "/biomes/neutral/sky.png", depth: 0, scale: 1, align: "bottom" },
    { src: "/biomes/neutral/sun.png", depth: 0.05, scale: 1, align: "bottom" },
    { src: "/biomes/neutral/clouds.png", depth: 0.15, scale: 1, align: "bottom" },
    { src: "/biomes/neutral/mountains_1.png", depth: 0.35, scale: 1, align: "bottom" },
    { src: "/biomes/neutral/mountains_2.png", depth: 0.5, scale: 1, align: "bottom" },
    { src: "/biomes/neutral/mountains_3.png", depth: 0.65, scale: 1, align: "bottom" },
    { src: "/biomes/neutral/trees.png", depth: 0.85, scale: 1, align: "bottom" },
    { src: "/biomes/neutral/rocks.png", depth: 1, scale: 1, align: "bottom" },
  ],
  credit: {
    pack: "Parallax background forest pixel art",
    author: "MatiasVME",
    url: "https://opengameart.org/content/parallax-background-forest-pixel-art",
    license:
      "CC0 — the OpenGameArt entry's License(s) field, with attribution instructions " +
      '"No attribution required".',
    // None. CC0, and the author says explicitly that no attribution is required.
    // CREDITS.md credits them anyway, per that file's own rule.
    obligations: [],
  },
};

export default manifest;
