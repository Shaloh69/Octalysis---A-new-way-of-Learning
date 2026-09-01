import type { BiomeManifest } from "../registry";

/**
 * Volcanic — lava glow. Procedural, by exception.
 *
 * **The one biome that is procedural on purpose.**
 *
 * `BIOME-AND-LOADING-SPEC.md` §2's table is explicit: no single standout free
 * pack exists for volcanic, so this one stays procedural until a
 * properly-licensed pack turns up. That is a stated gap and a named exception
 * — **not a precedent for the other six**, which get real art. §2 calls this
 * row one of "the honest ones, not the polished ones on purpose".
 *
 * With no layers, `BiomeScene` falls through to the token treatment:
 * `--biome-far` and `--biome-near` from `[data-biome="volcanic"]`, a lava-glow
 * palette already contrast-checked by `scripts/check-contrast.mjs`.
 */
const manifest: BiomeManifest = {
  name: "volcanic",
  layers: [],
  credit: null,
};

export default manifest;
