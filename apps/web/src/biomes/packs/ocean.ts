import type { BiomeManifest } from "../registry";

/**
 * Ocean — underwater light and swell.
 *
 * **SOURCED AND LICENCE-VERIFIED — art not yet vendored.**
 *
 * The pack below was opened and its terms read directly on 1 September 2026,
 * not taken from a tag, a collection listing or a search result.
 * `BIOME-AND-LOADING-SPEC.md` §2's cave row is the worked example of why that
 * distinction matters.
 *
 * The cleanest terms of the four checked — no NFT clause, no AI clause, no
 * redistribution restriction. Still recorded as its own licence rather than
 * as CC0, because the page does not claim CC0 and inventing an SPDX id for
 * someone else's words is how a licence gets misfiled.
 *
 * 3 layers for parallax.
 *
 * `layers` is empty until the art is vendored, so the landing renders nothing
 * rather than a stand-in. A procedural gradient here would look finished and is
 * exactly the substitution §2 was revised to forbid.
 *
 * TO COMPLETE:
 *   1. Download from https://ansimuz.itch.io/underwater-fantasy-pixel-art-environment
 *   2. Re-read the licence on that page — terms change, and this comment is a
 *      snapshot, not an authority
 *   3. Put the layer images in `apps/web/public/biomes/ocean/`, with the
 *      pack's own licence file beside them if it ships one
 *   4. Fill in `layers` back-to-front — see `neutral.ts` for the
 *      depth/scale/align model, and §2b for why one sprite tiled at one size
 *      reads as wallpaper
 *   5. Copy `credit` into `apps/web/public/CREDITS.md`
 */
const manifest: BiomeManifest = {
  name: "ocean",
  layers: [],
  credit: {
    pack: "Underwater Fantasy Pixel Art Environment",
    author: "ansimuz",
    url: "https://ansimuz.itch.io/underwater-fantasy-pixel-art-environment",
    license: "Permissive, not stated as CC0 — 'You may use these assets in personal or commercial projects. You may modify these assets to suit your needs. Credit is not required but appreciated it.'",
    obligations: [
      "Credit appreciated, not required — CREDITS.md gives it anyway",
    ],
  },
};

export default manifest;
