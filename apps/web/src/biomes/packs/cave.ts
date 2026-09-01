import type { BiomeManifest } from "../registry";

/**
 * Cave — underground, layered rock.
 *
 * **ASSETS NOT YET VENDORED.** `layers` is empty, so the landing renders
 * without scenery rather than with a stand-in. That is deliberate: a
 * procedural gradient here would look finished, and it is exactly the
 * substitution `BIOME-AND-LOADING-SPEC.md` §2 was revised to forbid — a
 * tinted rectangle does not make this read as a cave rather than a dark rectangle, which is the entire
 * reason biomes exist.
 *
 * TO COMPLETE THIS BIOME:
 *   1. Source the pack from https://itch.io/game-assets/new-and-popular/free/tag-parallax searching for cave. VERIFY CAREFULLY: §2 flags one popular-looking pack whose own author gave conflicting licence information — CC0 in one place, CC 3.0 on DeviantArt
 *   2. **Verify the licence on the file's own page**, not from a tag or a
 *      collection listing. `REDESIGN-CLAUDE.md` §1b routes non-Kenney itch.io
 *      through a human glance for exactly this reason, and §2's cave row is
 *      the worked example of why — its own author gave conflicting licence
 *      information in two different places.
 *   3. Drop the layer images in `apps/web/public/biomes/cave/`
 *   4. Fill in `layers` back-to-front, and `credit`
 *   5. Add the credit to `apps/web/public/CREDITS.md`
 */
const manifest: BiomeManifest = {
  name: "cave",
  layers: [],
  credit: null,
};

export default manifest;
