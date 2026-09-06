import type { BiomeManifest } from "../registry";

/**
 * Arctic — vendored 2 September 2026, and this is the pack §2 named.
 *
 * **NOT CC0, and it must not be filed as such.** *Parallax Backgrounds: Snowy
 * Mountains* by Admurin. The pack ships **no licence file of its own**, so the
 * terms were read from the asset's own page and copied verbatim into
 * `public/biomes/arctic/LICENSE.txt` — re-verified on the live page the day it
 * was vendored, not trusted from the earlier note:
 *
 *   "You can use this asset in any game project, personal or commercial"
 *   "DO NOT resell or redistribute AS A GAME ASSET, it has to be part of a project"
 *   "Credit not necessary but appreciated"
 *   "You are NOT allowed to turn any of my assets to an NFT."
 *   "You are NOT allowed to use these assets to train AI."
 *
 * Embedding these layers in OCTA is "part of a project", which is the permitted
 * case. OCTA does not resell them, mint them, or train on them. Credit is given
 * in `CREDITS.md` even though it is not required, per that file's own rule.
 *
 * **A STRIP PACK, not loose elements** — six pre-cut 384×216 scene layers drawn
 * as a set, so `kind: "strip"`. The renderer must not apply its own aerial
 * perspective here: the depth is already painted in, and fading layer 0 would
 * wash out a sky the artist balanced.
 *
 * Total vendored weight: **53.5 KB** for six layers.
 */
const manifest: BiomeManifest = {
  name: "arctic",
  kind: "strip",
  layers: [
    /*
     * Back to front in the pack's own numbering — but only 0 through 4.
     *
     * **5.png IS DROPPED, and finding out why cost a diagnosis.** Stacking all
     * six rendered as grey mush. Measuring the alpha channel explained it: 0 is
     * 100% opaque (the complete background — sky, mountains, pines), 1–4 are
     * sparse overlays at 5%, 17%, 26% and 52% coverage, and **5.png is 100%
     * opaque as well**. Drawn last, it covered the entire scene, so the band
     * showed nothing but layer 5.
     *
     * It is an alternative full background, not a foreground. It is not
     * vendored at all rather than shipped unused.
     *
     * The lesson is general: **measure the alpha before assuming a numbered
     * pack is a compositable stack.** "Parallax" in a pack title does not
     * promise transparency.
     *
     * Depth here drives parallax ONLY, not opacity (see `.biome-strip`) — the
     * aerial perspective is painted into the art already.
     */
    { src: "/biomes/arctic/0.png", depth: 0, scale: 1, align: "bottom" },
    { src: "/biomes/arctic/1.png", depth: 0.25, scale: 1, align: "bottom" },
    { src: "/biomes/arctic/2.png", depth: 0.5, scale: 1, align: "bottom" },
    { src: "/biomes/arctic/3.png", depth: 0.75, scale: 1, align: "bottom" },
    { src: "/biomes/arctic/4.png", depth: 1, scale: 1, align: "bottom" },
  ],
  credit: {
    pack: "Parallax Backgrounds: Snowy Mountains",
    author: "Admurin",
    url: "https://admurin.itch.io/parallax-backgrounds-snowy-mountains",
    license:
      'Not CC0. Verbatim: "You can use this asset in any game project, personal or commercial" · ' +
      '"DO NOT resell or redistribute AS A GAME ASSET, it has to be part of a project" · ' +
      '"Credit not necessary but appreciated" · "You are NOT allowed to turn any of my assets ' +
      'to an NFT." · "You are NOT allowed to use these assets to train AI."',
    obligations: [
      "Must remain part of a project — never redistributed as a standalone game asset",
      "Never minted as an NFT",
      "Never used as training data for a model",
    ],
  },
};

export default manifest;
