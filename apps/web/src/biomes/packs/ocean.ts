import type { BiomeManifest } from "../registry";

/**
 * Ocean — vendored 2 September 2026, and this is the pack §2 named.
 *
 * *Underwater Fantasy Pixel Art Environment* by ansimuz. **Not stated as CC0,
 * but the most permissive terms of the four non-Kenney packs checked** — and
 * the only one with neither an NFT clause nor an AI clause. The pack ships no
 * licence file, so the terms are copied verbatim into
 * `public/biomes/ocean/LICENSE.txt`:
 *
 *   "You may use these assets in personal or commercial projects."
 *   "You may modify these assets to suit your needs."
 *   "Credit is not required but appreciated it."
 *
 * Credit is given in `CREDITS.md` anyway.
 *
 * **A STRIP PACK** — pre-cut scene layers drawn as a set, so `kind: "strip"`.
 * The renderer's aerial perspective is skipped: underwater depth cueing is the
 * whole subject of this art and it is already in there.
 *
 * `foregound-merged.png` in the download is deliberately not vendored — it is
 * the two foreground layers pre-flattened, which is the opposite of what a
 * parallax scene wants.
 *
 * Total vendored weight: **30 KB** for four layers.
 */
const manifest: BiomeManifest = {
  name: "ocean",
  kind: "strip",
  layers: [
    /*
     * Back to front: open water, then two rock/weed foregrounds, then the sand
     * floor nearest. The pack's own naming is the ordering, and the two
     * separate foregrounds are why the merged file is skipped — they are the
     * parallax.
     */
    { src: "/biomes/ocean/far.png", depth: 0, scale: 1, align: "bottom" },
    { src: "/biomes/ocean/foreground-2.png", depth: 0.45, scale: 1, align: "bottom" },
    { src: "/biomes/ocean/foreground-1.png", depth: 0.75, scale: 1, align: "bottom" },
    { src: "/biomes/ocean/sand.png", depth: 1, scale: 1, align: "bottom" },
  ],
  credit: {
    pack: "Underwater Fantasy Pixel Art Environment",
    author: "ansimuz",
    url: "https://ansimuz.itch.io/underwater-fantasy-pixel-art-environment",
    license:
      'Not stated as CC0; permissive. Verbatim: "You may use these assets in personal or ' +
      'commercial projects." · "You may modify these assets to suit your needs." · ' +
      '"Credit is not required but appreciated it."',
    // Genuinely none. Credit is appreciated, not required, and CREDITS.md gives
    // it regardless.
    obligations: [],
  },
};

export default manifest;
