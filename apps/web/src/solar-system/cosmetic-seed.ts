import { useEffect, useState } from "react";
import { api, type Cosmetics } from "../lib/api";
import { hasChosen } from "../lib/session";

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
  /*
   * The DEFAULTS, and they are the pre-F-40 behaviour on purpose: bare-metal at
   * hue 250 is what every student saw when the seeded look was never applied.
   * Keeping it as the pre-fetch state means a slow or failed cosmetics call
   * degrades to a readable, contrast-checked interface rather than to nothing —
   * and it is the one case where "everyone looks the same" is correct.
   */
  themeIndex: 0,
  accentHue: 250,
  version: "default",
  biomes: ["neutral"],
  themes: ["bare-metal"],
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
/**
 * Called in two places on purpose: `AppShell`, so `data-biome` is set on every
 * authenticated route including the stage reader, and `StageMap`, which needs
 * the rotation and palette VALUES rather than just the attributes. The
 * attribute effect is idempotent, so both callers setting the same values is
 * harmless -- and one fetch each is cheaper than threading the result through
 * a context for two consumers.
 */
export function useCosmetics(): { cosmetics: Cosmetics; loaded: boolean } {
  const [cosmetics, setCosmetics] = useState<Cosmetics>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .cosmetics()
      .then((c) => {
        if (!alive) return;
        /*
         * Set the attributes BEFORE the state update, not in an effect after
         * it.
         *
         * The canvas resolves `--planet-lit` and `--biome-planet` with
         * `getComputedStyle(documentElement)` during render. An effect runs
         * AFTER render, so on the first render carrying the new values the
         * attributes were not on the element yet and every token read fell back
         * — planets rendered untinted and it looked like the biome was being
         * ignored. Same shape as the two earlier misses, one layer up.
         *
         * Doing it here means the DOM is correct before React re-renders with
         * the values that depend on it.
         */
        applyCosmeticAttributes(c);
        setCosmetics(c);
        setLoaded(true);
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
   * Kept as a belt-and-braces re-apply: something else could reset the
   * attributes (a theme switch rewriting them, a future route guard), and this
   * costs nothing. The load-bearing call is in the fetch above, before setState.
   *
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
    applySeededLook(cosmetics);
  }, [cosmetics]);

  return { cosmetics, loaded };
}

/** Put the seeded look on <html>. Callable outside React, so it can run before a render. */
function applyCosmeticAttributes(c: Cosmetics): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-planet", planetVariantAttr(c.paletteVariant));
  el.setAttribute("data-biome", biomeAttr(c.biomeIndex, c.biomes));
  applySeededLook(c);
}

/**
 * Apply the seeded theme and accent — **only if the student has never chosen**.
 *
 * F-40: R2 shipped "per-student seeded cosmetics" and seeded only the biome.
 * Theme and hue came from `localStorage` alone, defaulting to `bare-metal` /
 * 250, so every student looked identical and `apps/web/CLAUDE.md` described a
 * behaviour that did not exist.
 *
 * **First load only, and that is the whole rule.** An explicit choice in
 * Settings writes `localStorage`, and from then on this function does nothing:
 * a seeded look is a starting point, not something that reasserts itself over a
 * decision the student made. Silently re-theming someone who picked `phosphor`
 * would be worse than the bug this fixes.
 *
 * `localStorage` is the right store for it here despite the project's rule
 * against it, because that rule is about anything GRADEABLE. This is which
 * colours a page is drawn in — no grade, no lock, no attempt depends on it, and
 * the seed on the server remains the source of truth if the key is ever lost.
 */
export function applySeededLook(c: Cosmetics): void {
  const el = document.documentElement;

  if (!hasChosen("theme")) {
    const theme = c.themes[c.themeIndex] ?? c.themes[0];
    if (theme) el.setAttribute("data-theme", theme);
  }
  if (!hasChosen("accent-hue")) {
    el.style.setProperty("--accent-hue", String(c.accentHue));
  }
}

/** The `data-planet` attribute value for a variant index. */
export function planetVariantAttr(variant: number): string {
  return `v${Math.max(0, Math.trunc(variant))}`;
}

/** The `data-biome` attribute value for a biome index, given the server's list. */
export function biomeAttr(index: number, biomes: readonly string[]): string {
  return biomes[index] ?? biomes[0] ?? "neutral";
}
