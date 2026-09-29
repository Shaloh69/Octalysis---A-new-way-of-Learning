import { useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Biome, planetOf } from "@octa/contracts";

/**
 * The two realms, decided in ONE place (docs/redesign/WEB-REMAKE.md §1).
 *
 *   the star system   every route that is not inside a planet: the sci-fi
 *                     HUD, in the student's variant. Never a biome.
 *   inside a planet   /app/stage/:id and everything under it (the reading,
 *                     the check, and the moons and labs when they exist):
 *                     that planet's biome holds the page, nav included.
 *
 * The realm is a pure function of the PATH and the student's per-planet
 * biomes (GET /api/v1/cosmetics `planetBiomes`), written to <html> as
 * `data-realm` and `data-biome`. No page decides its own: a page that did
 * could disagree with the nav above it.
 *
 * Cosmetic only. A realm changes what a student looks at; it never reads a
 * lock, a mastery or a grade, and nothing that decides one reads it.
 */

export type Realm =
  | { readonly realm: "star" }
  | { readonly realm: "biome"; readonly planet: string; readonly biome: Biome };

/** A planet's biome by stage id, as the cosmetics endpoint sends it. */
export type PlanetBiomes = Readonly<Record<string, string>>;

/**
 * Inside a planet: `/app/stage/<id>` and any path below it. The id may be a
 * moon's ("06.3"): a moon wears its planet's biome, so it resolves through
 * `planetOf`. Kept as one expression because index.html's pre-paint script
 * restates it, and `test/realm.spec.ts` holds the two to the same table.
 */
export const PLANET_PATH = /^\/app\/stage\/([^/?#]+)/;

/**
 * The biome a planet wears before its own is known: the first-ever deep link,
 * before any cosmetics response has been cached. The realm is still right on
 * the first frame (nothing flashes the HUD); only which biome can change once,
 * when the response lands, and never again on that browser.
 */
export const FALLBACK_BIOME: Biome = "neutral";

export function realmFor(pathname: string, planetBiomes: PlanetBiomes = {}): Realm {
  const m = PLANET_PATH.exec(pathname);
  if (!m) return { realm: "star" };
  const planet = planetOf(decodeURIComponent(m[1]!));
  const parsed = Biome.safeParse(planetBiomes[planet]);
  return { realm: "biome", planet, biome: parsed.success ? parsed.data : FALLBACK_BIOME };
}

/** Write a realm to an element (always <html> in the app). Idempotent. */
export function applyRealm(el: HTMLElement, r: Realm): void {
  el.setAttribute("data-realm", r.realm);
  if (r.realm === "biome") el.setAttribute("data-biome", r.biome);
  else el.removeAttribute("data-biome");
}

/*
 * The per-planet biomes are cached in the browser so a deep link or a reload
 * paints the right biome on its first frame (index.html reads this key before
 * any script bundle runs). It is a cosmetic cache, not a store: the server
 * derives the value from the student id, and losing the key costs one frame
 * of the fallback biome. Nothing gradeable, so localStorage is allowed here
 * for the same reason `octa:theme` is. Cleared on sign-out, so the next
 * student on a shared lab PC does not inherit it.
 */
export const PLANET_BIOMES_KEY = "octa:planet-biomes";
const CHANGED = "octa:planet-biomes";

export function readCachedPlanetBiomes(): PlanetBiomes {
  try {
    const raw = localStorage.getItem(PLANET_BIOMES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as PlanetBiomes) : {};
  } catch {
    return {};
  }
}

/** Called when the cosmetics response lands. */
export function cachePlanetBiomes(planetBiomes: PlanetBiomes): void {
  try {
    localStorage.setItem(PLANET_BIOMES_KEY, JSON.stringify(planetBiomes));
  } catch {
    /* private window: the realm still resolves, from memory, this session */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<PlanetBiomes>(CHANGED, { detail: planetBiomes }));
  }
}

export function clearCachedPlanetBiomes(): void {
  try {
    localStorage.removeItem(PLANET_BIOMES_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * The realm for the current route, applied to <html>. Call ONCE, at the app's
 * root inside the router (App.tsx `RealmSync`): every route, the public ones
 * included, belongs to a realm.
 *
 * A layout effect, not an effect: it runs before the browser paints the new
 * route, so a navigation never shows a frame of the old realm's tokens.
 */
export function useRealm(): Realm {
  const { pathname } = useLocation();
  const [planetBiomes, setPlanetBiomes] = useState<PlanetBiomes>(readCachedPlanetBiomes);

  useLayoutEffect(() => {
    const on = (e: Event) => setPlanetBiomes((e as CustomEvent<PlanetBiomes>).detail ?? {});
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, []);

  const realm = realmFor(pathname, planetBiomes);
  useLayoutEffect(() => {
    applyRealm(document.documentElement, realmFor(pathname, planetBiomes));
  }, [pathname, planetBiomes]);
  return realm;
}
