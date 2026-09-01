import type { BiomeManifest } from "../registry";

/**
 * Jungle — dense canopy, layered foliage.
 *
 * **SOURCED AND LICENCE-VERIFIED — art not yet vendored.**
 *
 * The pack below was opened and its terms read directly on 1 September 2026,
 * not taken from a tag, a collection listing or a search result.
 * `BIOME-AND-LOADING-SPEC.md` §2's cave row is the worked example of why that
 * distinction matters.
 *
 * **CREDIT IS REQUIRED for this one.** It is the only pack here that
 * demands attribution rather than merely appreciating it, so it cannot be
 * dropped from CREDITS.md the way a CC0 pack technically could.
 *
 * 1 background, 9 layers, PSD + PNG. A licence .txt ships in the download —
 * read that too; this comment is a summary of the store page.
 *
 * `layers` is empty until the art is vendored, so the landing renders nothing
 * rather than a stand-in. A procedural gradient here would look finished and is
 * exactly the substitution §2 was revised to forbid.
 *
 * TO COMPLETE:
 *   1. Download from https://edermunizz.itch.io/free-pixel-art-forest
 *   2. Re-read the licence on that page — terms change, and this comment is a
 *      snapshot, not an authority
 *   3. Put the layer images in `apps/web/public/biomes/jungle/`, with the
 *      pack's own licence file beside them if it ships one
 *   4. Fill in `layers` back-to-front — see `neutral.ts` for the
 *      depth/scale/align model, and §2b for why one sprite tiled at one size
 *      reads as wallpaper
 *   5. Copy `credit` into `apps/web/public/CREDITS.md`
 */
const manifest: BiomeManifest = {
  name: "jungle",
  layers: [],
  credit: {
    pack: "Free Pixel Art Forest",
    author: "edermunizz",
    url: "https://edermunizz.itch.io/free-pixel-art-forest",
    license: "Custom, NOT CC0 — 'You can use this asset even commercially, just give proper credit. You CANNOT use in NFT or crypto games, on any kind of crypto thing.'",
    obligations: [
      "Credit edermunizz visibly — REQUIRED, not optional",
      "No NFT or crypto-game use of any kind",
      "Read the licence .txt that ships in the download",
    ],
  },
};

export default manifest;
