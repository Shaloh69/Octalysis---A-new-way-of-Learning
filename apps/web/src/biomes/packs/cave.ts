import type { BiomeManifest } from "../registry";

/**
 * Cave — vendored 2 September 2026, and **NOT from itch.io**.
 *
 * This is the biome `BIOME-AND-LOADING-SPEC.md` §2 could not source. Its
 * instruction was explicit: *"Find a different pack. Not Admurin's"*, because
 * Admurin's cave pack has the same art on DeviantArt under CC 3.0 while itch
 * states different terms, and the author declined to reconcile them when asked
 * directly.
 *
 * **The obvious replacement failed the same test.** ansimuz's *Warped Caves* is
 * a good pack by an author whose other work is already vendored here — but its
 * page carries **no licence statement from the author at all**. The CC-BY-3.0
 * that turns up when you search is in a **user comment**, by someone who is not
 * the author, in a seven-year-old thread. That is precisely the shape §2
 * rejected the first time, and it was rejected again.
 *
 * **Sourced from OpenGameArt instead, and that is the point.** OGA records the
 * licence as *structured metadata on the work*, not as prose in a description
 * or a claim in a comment thread — so it can be read, cited, and re-verified by
 * anyone later. Two independent confirmations here:
 *
 *   1. The OGA entry's `License(s)` field: **CC0**.
 *   2. The pack's own bundled `License and Readme.txt`: *"License: CC0 - Use it
 *      however you want."*
 *
 * *Seamless Parallax Cave Background* by **JonathanPalmerGD**, itself a
 * parallaxed derivative of *Seamless cave background* by **PWL** — the readme
 * names that provenance and it is preserved in `public/biomes/cave/LICENSE.txt`.
 *
 * **Downscaled 800px → 400px**, which CC0 expressly permits ("use it however
 * you want"). The band draws at ~148px, so 800 was five times oversized; the
 * front layer alone was 325 KB. **377 KB → 156 KB, 59% smaller**, with 400px
 * still leaving headroom for a 2× display.
 *
 * `smooth: true` because this is PAINTED art. Strip packs pixelate by default,
 * which is right for the pixel-art packs and wrong here.
 */
const manifest: BiomeManifest = {
  name: "cave",
  kind: "strip",
  smooth: true,
  layers: [
    /*
     * Back to front, and the alpha confirms the intended stack rather than
     * assuming it: back is 100% opaque (the rock wall), then three overlays at
     * 40% / 44% / 59% coverage. That check is not optional — arctic's pack had
     * a second fully-opaque layer hiding at the end of the sequence, which
     * silently covered the whole scene until the alpha was measured.
     */
    { src: "/biomes/cave/back.png", depth: 0, scale: 2.2, align: "bottom" },
    { src: "/biomes/cave/far.png", depth: 0.4, scale: 2.2, align: "bottom" },
    { src: "/biomes/cave/mid.png", depth: 0.7, scale: 2.2, align: "bottom" },
    { src: "/biomes/cave/front.png", depth: 1, scale: 2.2, align: "bottom" },
  ],
  credit: {
    pack: "Seamless Parallax Cave Background",
    author: "JonathanPalmerGD, from an original by PWL",
    url: "https://opengameart.org/content/seamless-parallax-cave-background",
    license:
      'CC0 — confirmed twice: the OpenGameArt entry\'s License(s) field, and the pack\'s own ' +
      'bundled readme, verbatim "License: CC0 - Use it however you want."',
    // None. CC0, and the readme's "credit me if you like" is explicitly
    // optional. CREDITS.md credits both authors regardless, per its own rule.
    obligations: [],
  },
};

export default manifest;
