import type { BiomeManifest } from "../registry";

/**
 * Arctic — snowfield and distant peaks.
 *
 * **SOURCED AND LICENCE-VERIFIED — art not yet vendored.**
 *
 * The pack below was opened and its terms read directly on 1 September 2026,
 * not taken from a tag, a collection listing or a search result.
 * `BIOME-AND-LOADING-SPEC.md` §2's cave row is the worked example of why that
 * distinction matters.
 *
 * Embedding it in OCTA is 'part of a project' and is squarely allowed. What
 * is NOT allowed is shipping the layers as a standalone asset — which is
 * worth noting because `public/` is served verbatim, so the PNGs are
 * fetchable at their URLs. That is normal web delivery, not redistribution
 * as a game asset, but do not add them to any downloadable bundle.
 *
 * 5 transparent PNG layers, 384×216.
 *
 * `layers` is empty until the art is vendored, so the landing renders nothing
 * rather than a stand-in. A procedural gradient here would look finished and is
 * exactly the substitution §2 was revised to forbid.
 *
 * TO COMPLETE:
 *   1. Download from https://admurin.itch.io/parallax-backgrounds-snowy-mountains
 *   2. Re-read the licence on that page — terms change, and this comment is a
 *      snapshot, not an authority
 *   3. Put the layer images in `apps/web/public/biomes/arctic/`, with the
 *      pack's own licence file beside them if it ships one
 *   4. Fill in `layers` back-to-front — see `neutral.ts` for the
 *      depth/scale/align model, and §2b for why one sprite tiled at one size
 *      reads as wallpaper
 *   5. Copy `credit` into `apps/web/public/CREDITS.md`
 */
const manifest: BiomeManifest = {
  name: "arctic",
  layers: [],
  credit: {
    pack: "Parallax Backgrounds: Snowy Mountains",
    author: "Admurin",
    url: "https://admurin.itch.io/parallax-backgrounds-snowy-mountains",
    license: "Custom, NOT CC0 — 'You can use this asset in any game project, personal or commercial' / 'DO NOT resell or redistribute AS A GAME ASSET, it has to be part of a project' / 'Credit not necessary but appreciated' / 'Modify to suit your needs' / 'NOT allowed to turn any of my assets to an NFT' / 'NOT allowed to use these assets to train AI'",
    obligations: [
      "Must remain part of a project — never redistributed as a standalone asset",
      "No NFT use",
      "No use for AI training",
      "Credit appreciated, not required — CREDITS.md gives it anyway",
    ],
  },
};

export default manifest;
