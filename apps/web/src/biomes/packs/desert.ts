import type { BiomeManifest } from "../registry";

/**
 * Desert — vendored 2 September 2026.
 *
 * **NOT the pack `BIOME-AND-LOADING-SPEC.md` §2 names.** That table points at
 * *Desert Parallax Background* by styloo
 * (https://styloo.itch.io/desert-parallax-background), recorded as "CC0 1.0,
 * explicit" and "the cleanest-licensed of the six". **That URL now returns 404** —
 * checked 2 Sep 2026. The pack is gone, or moved, and a licence verified against
 * a page that no longer exists is not a licence anyone can re-verify.
 *
 * So this is composed from **Kenney Background Elements**, the same CC0 pack
 * `neutral` uses, which §2's own table already lists as the "base layer for
 * several biomes". That is a substitution of art, not of standards: CC0 is at
 * least as permissive as what styloo offered, it needs no attribution, and the
 * licence file travels with the sprites.
 *
 * These are ELEMENTS, not pre-cut parallax strips, so the scene is composed
 * here — the same approach as `neutral`, and the reason that approach was
 * chosen: one pack can dress several biomes.
 *
 * Total vendored weight: **7.7 KB** for five sprites.
 */
const manifest: BiomeManifest = {
  name: "desert",
  layers: [
    /*
     * Back to front. Depth 0 is the horizon and does not move.
     *
     * The sun sits highest and nearly still, because a sun that parallaxes
     * reads as a lamp. Two pyramid depths do the work `neutral` gets from two
     * tree sizes: the same object, small and far versus large and near, tiling
     * at different intervals so the repeat drifts out of phase across the band
     * instead of stamping.
     */
    { src: "/biomes/desert/sun.png", depth: 0.04, scale: 0.16, align: "top" },
    { src: "/biomes/desert/cloud3.png", depth: 0.14, scale: 0.22, align: "top" },
    { src: "/biomes/desert/hills1.png", depth: 0.34, scale: 0.5, align: "bottom" },
    { src: "/biomes/desert/piramid.png", depth: 0.72, scale: 0.55, align: "bottom" },
    { src: "/biomes/desert/grass3.png", depth: 1, scale: 0.11, align: "bottom" },
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
