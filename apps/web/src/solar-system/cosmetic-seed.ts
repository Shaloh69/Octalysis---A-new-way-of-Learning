import { useEffect, useState } from "react";
import { api, type Cosmetics } from "../lib/api";

/**
 * The client half of per-student cosmetic seeding.
 *
 * This file is a THIN CONSUMER and that is the whole point. It does not hash
 * anything, it does not know `EXAM_SALT_SECRET` exists, and it never imports
 * from `services/api/src/engine/`. The derivation lives in exactly one place —
 * `services/api/src/routes/cosmetics.ts` — for the same "one owner per fact"
 * reason this project applies to its documents.
 *
 * `services/api/test/cosmetics.spec.ts` walks every file under `apps/web/src`
 * and fails if any of them calls `createHash`, `sha256` or `subtle.digest`, so
 * this stays true rather than merely being intended.
 *
 * WHAT A COSMETIC MAY DO: change what a student looks at.
 * WHAT IT MAY NOT DO: change what any student can do, learn, attempt or be
 * graded on. If a future value would alter a lock, a ring, a moon count or an
 * item, it is a curriculum decision and does not belong in this file.
 */

/** What the map falls back to before the fetch lands, or if it fails. */
const DEFAULT: Cosmetics = {
  rotationOffset: 0,
  paletteVariant: 0,
  callsign: "",
  biomeIndex: 0,
  version: "default",
  biomes: ["neutral"],
};

/**
 * Fetch this student's cosmetics.
 *
 * A failure here is deliberately silent and non-blocking. The map is fully
 * usable unseeded — every planet, ring, lock reason and control is identical;
 * only the rotation and palette are missing. Showing an error for a decoration
 * that failed to load would make a cosmetic feel like a fault, which is exactly
 * the wrong weight to give it.
 */
export function useCosmetics(): { cosmetics: Cosmetics; loaded: boolean } {
  const [cosmetics, setCosmetics] = useState<Cosmetics>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .cosmetics()
      .then((c) => {
        if (alive) {
          setCosmetics(c);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Stay on DEFAULT. Nothing to report: nothing is missing.
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Apply the look to <html>, not to the map's own container.
   *
   * This is where `data-theme` and `--accent-hue` already live
   * (`src/lib/session.ts`), so it is the established place for "how this
   * student's app looks" -- and following it rather than inventing a second
   * convention is the point.
   *
   * It is also load-bearing rather than tidiness: `SolarSystemCanvas` resolves
   * its colours with `getComputedStyle(document.documentElement)`, so a token
   * scoped to the map div resolves to nothing and the canvas silently falls
   * back to its hardcoded default. That is exactly what happened the first time
   * -- every student's planets rendered the same white, the tests passed, and
   * only the screenshot showed it.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    el.setAttribute("data-planet", planetVariantAttr(cosmetics.paletteVariant));
    el.setAttribute("data-biome", biomeAttr(cosmetics.biomeIndex, cosmetics.biomes));
  }, [cosmetics]);

  return { cosmetics, loaded };
}

/** The `data-planet` attribute value for a variant index. */
export function planetVariantAttr(variant: number): string {
  return `v${Math.max(0, Math.trunc(variant))}`;
}

/** The `data-biome` attribute value for a biome index, given the server's list. */
export function biomeAttr(index: number, biomes: readonly string[]): string {
  return biomes[index] ?? biomes[0] ?? "neutral";
}
