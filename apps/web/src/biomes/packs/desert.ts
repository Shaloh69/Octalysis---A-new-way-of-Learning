import type { BiomeManifest } from "../registry";

/**
 * Desert — **rebuilt as a strip pack, 7 September 2026**, for the reason
 * `jungle` records at length: flat vector shapes have no internal detail, so
 * scattering more of them makes a denser flat picture.
 *
 * ## Licence, and a two-link chain
 *
 * *Rocky desert landscape (layered, looping)* by **Emcee Flesher**, from
 * OpenGameArt —
 * https://opengameart.org/content/rocky-desert-landscape-layered-looping.
 * **CC0**, the entry's structured `License(s)` field.
 *
 * It is a derivative, and the chain was checked rather than trusted: the entry's
 * attribution instructions name *"Original by Quantiset (CC0):
 * https://opengameart.org/content/mars-background-pixel-art"*. **Both links are
 * CC0 on their own OGA pages.** A CC0 derivative of a non-CC0 original would be
 * a problem the derivative's own licence field cannot fix, which is why the
 * chain gets walked and not assumed — the same check that cleared the previous
 * cave pack's PWL original.
 *
 * ## Structure — **receding ground planes, and the only red world** (§2c)
 *
 * Every other biome puts its subject against a sky. This one is almost entirely
 * **ground**: a thin band of sky at the top, a serrated ridge, then three
 * terraces stepping toward the viewer, each darker than the one behind it.
 * Depth here is read from the *floor* rather than from the horizon, which is a
 * composition nothing else in the set uses.
 *
 * Being a Mars landscape, it is also the only **red** biome — and the greyscale
 * test does not care about that, which is the point: what distinguishes it with
 * the colour removed is the terracing.
 *
 * **The flooring variety is the whole pack.** Rock formations are drawn into
 * every terrace at their own scale, so the ground has detail at three distances
 * instead of being one flat band.
 *
 * **No fully-opaque layer**, unusually — the far mountains are 75.8% and the sky
 * shows through above them. So slot 1 comes from `--biome-sky-*` as §2e
 * requires, and this is the only vendored pack that genuinely needs it.
 *
 * Total vendored weight: **116 KB** for four layers, the heaviest in the set —
 * these are 1280×1280 sources, and they are worth it for a scene that is mostly
 * ground seen up close.
 */
const manifest: BiomeManifest = {
  name: "desert",
  kind: "strip",
  motif: "sand",
  layers: [
    /*
     * Back to front, in the pack's own naming, and the alpha is the check that
     * matters here for a different reason than usual: NOTHING is 100% opaque
     * (75.8% / 67.6% / 59.9% / 40.9%). A stack with no opaque base is only
     * correct if something else paints the sky, and §2e's slot 1 does.
     *
     * The `nowater` variants are vendored; the pack also ships `water` ones with
     * a river through the mid ground. Not used: this biome sits behind reading
     * content, and a bright water band across the middle of the frame competes
     * with the panels for exactly the attention they need.
     */
    { src: "/biomes/desert/far-mountains.png", depth: 0, scale: 1, align: "bottom" },
    { src: "/biomes/desert/far.png", depth: 0.4, scale: 1, align: "bottom" },
    { src: "/biomes/desert/mid.png", depth: 0.7, scale: 1, align: "bottom" },
    { src: "/biomes/desert/close.png", depth: 1, scale: 1, align: "bottom" },
  ],
  credit: {
    pack: "Rocky desert landscape (layered, looping)",
    author: "Emcee Flesher, from an original by Quantiset",
    url: "https://opengameart.org/content/rocky-desert-landscape-layered-looping",
    license:
      "CC0 — the OpenGameArt entry's License(s) field. Derived from Quantiset's " +
      "Mars background pixel art, also CC0 and verified on its own OGA page.",
    // None. CC0 on both links of the chain.
    obligations: [],
  },
};

export default manifest;
