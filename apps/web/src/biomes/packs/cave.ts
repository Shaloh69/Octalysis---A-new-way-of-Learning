import type { BiomeManifest } from "../registry";

/**
 * Cave — **replaced entirely, 7 September 2026**, on the instruction *"Cave
 * looks Worse. Find Better Sprites or replace it entirely."*
 *
 * ## What was here, and why tuning it was the wrong answer
 *
 * *Seamless Parallax Cave Background* (JonathanPalmerGD, CC0) — four flat
 * khaki-and-brown shapes on a textured tan field. Cleanly licensed and correctly
 * vendored, and it never once looked like a cave. It had been re-scaled twice
 * chasing that (2.2 → 1 when the band became a page) and the problem was not the
 * scale: at 900px tall the whole pack is **three enormous silhouettes**, because
 * it is a 800px square with almost no detail in it. There is nothing to tune.
 * A composition with no detail density does not acquire any by being resized.
 *
 * ## Why THIS pack, from an author who was rejected before
 *
 * *Warped: Super Grotto Escape Pack* by **Luis Zuno (@ansimuz)** — and the
 * previous manifest rejected an ansimuz cave pack by name. That rejection stands
 * and is not being reversed: it was about **Warped Caves on itch.io**, whose
 * page carries no licence statement from the author, where the CC-BY-3.0 people
 * cite lives in a seven-year-old **user comment written by somebody else**.
 *
 * This is a different listing on a different host, and the licence problem is
 * simply absent: OpenGameArt records the licence as **structured metadata on the
 * work**. Confirmed twice, which is the bar:
 *
 *   1. The OGA entry's `License(s)` field: **CC0**. Attribution: "By Ansimuz
 *      (optional)".
 *   2. The pack's bundled `public-license.txt`: *"You may use these assets in
 *      personal or commercial projects... Credit no required but appreciated."*
 *
 * §2a's rule was never "not ansimuz". It was "the licence must be stated by the
 * author, as metadata, where it can be re-verified" — and here it is.
 *
 * ## Structure — **framing, and the only interior** (§2c)
 *
 * Every other biome is an exterior under a sky. This one has **no sky at all**,
 * and its distance colour is nearly black rather than pale: underground, air
 * does not lighten a distance, it hides it. Crystals give it the one thing no
 * other biome has — small points of saturated light in a dark field.
 *
 * `smooth` is OFF, unlike the pack it replaces. That one was painted art and
 * needed smoothing; this is 16-bit pixel art at 240px tall drawn at nearly 4×,
 * where smoothing would blur away the pixels that ARE the style.
 *
 * Total vendored weight: **46 KB** for six files — a third of the 160 KB the
 * three-silhouette pack cost.
 */
const manifest: BiomeManifest = {
  name: "cave",
  kind: "strip",
  motif: "dust",
  layers: [
    /*
     * Back to front, and the alpha confirms the stack rather than assuming it:
     * back is 100% opaque (the rock wall), then 31.6% and 22.6% overlays.
     * Exactly one fully-opaque layer, at the back, which is what a compositable
     * stack looks like. Arctic's pack had a SECOND one hiding at the end of the
     * sequence and it silently covered the entire scene, so this is measured
     * every time now.
     */
    { src: "/biomes/cave/back.png", depth: 0, scale: 1, align: "bottom" },
    { src: "/biomes/cave/far.png", depth: 0.45, scale: 1, align: "bottom" },
    { src: "/biomes/cave/mid.png", depth: 0.75, scale: 1, align: "bottom" },

    /*
     * FOUR LAYERS, AND NO FOREGROUND PROPS.
     *
     * The pack ships loose plants (palm, plant-big, plant) and they were
     * scattered here as a foreground band — seven at one size, nine at another,
     * standing along the bottom of the frame. Removed on instruction, and it was
     * the right call: they are BUSHES, drawn for a platformer's playable floor
     * where a character walks past them, and at page scale behind reading
     * content they read as a hedge across the bottom of the screen.
     *
     * The strips already carry a floor. Adding a row of plants to it was
     * decoration on top of a finished composition, which is the thing §2e's
     * whole point is to avoid.
     */
  ],
  credit: {
    pack: "Warped: Super Grotto Escape Pack",
    author: "Luis Zuno (@ansimuz)",
    url: "https://opengameart.org/content/warped-super-grotto-escape-pack",
    license:
      "CC0 — confirmed twice: the OpenGameArt entry's License(s) field, and the pack's own " +
      'bundled public-license.txt, verbatim "You may use these assets in personal or ' +
      'commercial projects... Credit no required but appreciated it."',
    // None. CC0, and OGA's own attribution note says "(optional)".
    // CREDITS.md credits Luis Zuno anyway, per that file's own rule.
    obligations: [],
  },
};

export default manifest;
