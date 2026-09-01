import type { BiomeManifest } from "../registry";

/**
 * Desert — dunes and heat haze.
 *
 * **ASSETS NOT YET VENDORED.** `layers` is empty, so the landing renders
 * without scenery rather than with a stand-in. That is deliberate: a
 * procedural gradient here would look finished, and it is exactly the
 * substitution `BIOME-AND-LOADING-SPEC.md` §2 was revised to forbid — a
 * tinted rectangle does not make this read as a desert rather than a warm rectangle, which is the entire
 * reason biomes exist.
 *
 * TO COMPLETE THIS BIOME:
 *   1. Source the pack from Desert Parallax Background by styloo — https://styloo.itch.io/desert-parallax-background . CC0 1.0, explicit; four layers, multiple resolutions. The cleanest-licensed of the six.
 *   2. **Verify the licence on the file's own page**, not from a tag or a
 *      collection listing. `REDESIGN-CLAUDE.md` §1b routes non-Kenney itch.io
 *      through a human glance for exactly this reason, and §2's cave row is
 *      the worked example of why — its own author gave conflicting licence
 *      information in two different places.
 *   3. Drop the layer images in `apps/web/public/biomes/desert/`
 *   4. Fill in `layers` back-to-front, and `credit`
 *   5. Add the credit to `apps/web/public/CREDITS.md`
 */
const manifest: BiomeManifest = {
  name: "desert",
  layers: [],
  credit: null,
};

export default manifest;
