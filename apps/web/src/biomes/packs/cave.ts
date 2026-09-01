import type { BiomeManifest } from "../registry";

/**
 * Cave — underground, layered rock.
 *
 * **NO PACK SELECTED. One candidate was checked and REJECTED.**
 *
 * **Do not use Admurin's "Parallax Backgrounds: Caves"**
 * (https://admurin.itch.io/parallax-backgrounds-caves), which is the pack most
 * searches surface first.
 *
 * Its comment thread, read directly on 1 September 2026: a user pointed at the
 * **same artwork on DeviantArt**
 * (https://www.deviantart.com/admurin/art/Parallax-Backgrounds-Caves-943909344)
 * *"mentioned as licensed under CC 3.0"*, asked which licence actually governs,
 * and asked whether they could keep using it. The author replied only:
 * *"the license is indicated in the respective section. You don't have to
 * credit me unless you want to. Only thing that cannot be done is sell the
 * asset."*
 *
 * That restates the itch terms without addressing the CC 3.0 upload of the same
 * work. **Asked directly, never reconciled.** Two sources, two licences, and an
 * author who declined to resolve it is not a licence this project can rely on —
 * `GAME-DESIGN.md` §9's rigour before vendoring anything applies, and
 * `BIOME-AND-LOADING-SPEC.md` §2 keeps this row as the worked example of why a
 * tag listing is not a licence.
 *
 * TO COMPLETE: find a DIFFERENT cave pack. Browse
 * https://itch.io/game-assets/new-and-popular/free/tag-parallax and search
 * "cave", then open the candidate's own page and read its actual terms — the
 * same way arctic, jungle and ocean were checked. Do not accept a collection's
 * word for it.
 *
 * Until then this renders nothing, which is correct: better an absent biome
 * than one shipped on an unresolved licence.
 */
const manifest: BiomeManifest = {
  name: "cave",
  layers: [],
  credit: null,
};

export default manifest;
