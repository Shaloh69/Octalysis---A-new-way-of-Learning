import type { BiomeManifest } from "../registry";

/**
 * City — **a lit skyline at dusk**, and the replacement for `volcanic`.
 *
 * ## Why volcanic is gone
 *
 * It was the one biome with **no art at all**. `BIOME-AND-LOADING-SPEC.md` §2
 * could not find a cleanly-licensed volcanic pack, so it was made the single
 * named exception allowed to render procedurally from tokens — a lava-glow
 * gradient standing in for a scene. Every other biome then got real art, and the
 * gap only widened: six painted landscapes and one gradient.
 *
 * Replaced outright on the instructor's ruling rather than patched. A futuristic
 * city is also a **better fit for this course** than a volcano ever was — the
 * subject is computer architecture, and a lit skyline at dusk is the one
 * landscape in the set that is built rather than grown.
 *
 * ## Licence
 *
 * *Skyline Background* by **FabinhoSC**, from OpenGameArt —
 * https://opengameart.org/content/skyline-background. **CC0, confirmed twice**:
 * the entry's structured `License(s)` field, and the pack's own `Read.txt`
 * ("I make this content available in the public domain (CC0)"), which is kept
 * beside the art. Sourced from OGA rather than itch for the reason §2a records:
 * OGA states licence as metadata on the work, so it can be re-verified later.
 *
 * ## Structure — **vertical, lit, and the only built landscape** (§2c)
 *
 * Every other biome is natural and horizontal: horizons, ridges, canopies. This
 * one is **vertical** — towers rising, a hard skyline against a dusk sky, and
 * points of light where nothing else in the set has any. That is what keeps it
 * distinguishable in the greyscale test: not its colour, but that it is made of
 * straight edges and windows.
 *
 * Total vendored weight: **18 KB** for five layers.
 */
const manifest: BiomeManifest = {
  name: "city",
  kind: "strip",
  motif: "dust",
  layers: [
    /*
     * Back to front, and the pack's own naming IS the order: Atmosfere, Stars,
     * Cloud, Back, Front. The alpha confirms it rather than assuming — sky is
     * 100% opaque, stars 0.1%, cloud 17.6%, back 39.9%, front 25.7%. Exactly one
     * fully-opaque layer, at the back, which is what a compositable stack looks
     * like. (Arctic's pack had two, and the second one hid the whole scene.)
     */
    { src: "/biomes/city/sky.png", depth: 0, scale: 1, align: "bottom" },
    { src: "/biomes/city/stars.png", depth: 0.1, scale: 1, align: "bottom" },
    { src: "/biomes/city/cloud.png", depth: 0.3, scale: 1, align: "bottom" },
    { src: "/biomes/city/back.png", depth: 0.6, scale: 1, align: "bottom" },
    /*
     * SINK 16.5%. `front.png` is 250x170 with its artwork ending at y=142 --
     * a 28px transparent strip below the skyline, which `align: "bottom"`
     * faithfully aligned to the frame, leaving the nearest buildings hovering
     * with `back.png`'s silhouette visible underneath them.
     *
     * The pack is not wrong: a platformer covers that strip with ground tiles.
     * A full-page background has none, so the margin is pushed off-frame.
     * Measured from the alpha bounding box -- (170 - 142) / 170 -- not guessed.
     */
    { src: "/biomes/city/front.png", depth: 1, scale: 1, align: "bottom", sink: 16.5 },
  ],
  credit: {
    pack: "Skyline Background",
    author: "FabinhoSC",
    url: "https://opengameart.org/content/skyline-background",
    license:
      "CC0 — confirmed twice: the OpenGameArt entry's License(s) field, and the pack's own " +
      'Read.txt, verbatim "I make this content available in the public domain (CC0)."',
    // None. CC0, and the author says explicitly that no credit is needed.
    // CREDITS.md credits them anyway, per that file's own rule.
    obligations: [],
  },
};

export default manifest;
