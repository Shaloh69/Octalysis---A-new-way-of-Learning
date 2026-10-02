/**
 * What each body on the map looks like: real planetary textures (Solar System
 * Scope, CC BY 4.0, credited in `public/CREDITS.md`), downsized to 1024×512
 * and served from `public/textures/`, so none of it enters a JS bundle.
 *
 * WHICH SKIN A PLANET WEARS is decided by `world.ts`, by the frost line
 * (instructor, 1 Oct 2026): rocky worlds inside it, gas and ice giants beyond.
 * Until then a planet's skin followed its biome; the biome still dresses the
 * planet's pages, and only the globe follows the frost line. The choice is
 * SEEDED from the student's rotation offset and the stage, never
 * `Math.random`, so the same student sees the same system every session.
 *
 * COSMETIC ONLY (SOLAR-SYSTEM-SPEC §3): a skin never touches a lock, a ring, a
 * mastery or a moon count. The accessible layer (the row of bodies) is
 * unchanged, and every fact is still in words there.
 */

export type BodyKind = "rocky" | "earthlike" | "gas" | "ringed" | "ice" | "veiled";

/** The faint rings (R4.8): a broad dusty sheet (Jupiter's), narrow dark bands (Uranus's), a few rings with arcs (Neptune's). */
export type RingStyle = "dust" | "narrow" | "arcs";

export interface BodySkin {
  /** The surface map, in `public/textures/`. */
  map: string;
  kind: BodyKind;
  /** Seconds per turn on its axis: gas giants fastest, as Jupiter's 10-hour day is. */
  spinS: number;
  /** Axial tilt in radians (Uranus rolls on its side). */
  tilt: number;
  /** Polar flattening: a fast-spinning gas giant bulges at the equator. */
  oblate: number;
  /** A cloud layer drawn above the surface, turning a little faster. */
  clouds?: string;
  /** A ring, drawn from a radial alpha strip. */
  ring?: string;
  /** A faint ring of the giants beyond Saturn (R4.8), drawn from `satellites.ts`'s `ringBands`. */
  faintRing?: RingStyle;
  /** Cloud bands drifting across a gas giant, as a fraction of a turn per second. */
  bandDrift?: number;
}

const SKINS = {
  earth: { map: "earth_daymap.jpg", kind: "earthlike", spinS: 24, tilt: 0.41, oblate: 1, clouds: "earth_clouds.jpg" },
  mars: { map: "mars.jpg", kind: "rocky", spinS: 26, tilt: 0.44, oblate: 1 },
  venus: { map: "venus_atmosphere.jpg", kind: "veiled", spinS: 60, tilt: 0.05, oblate: 1, bandDrift: 0.004 },
  venusSurface: { map: "venus_surface.jpg", kind: "rocky", spinS: 80, tilt: 0.05, oblate: 1 },
  mercury: { map: "mercury.jpg", kind: "rocky", spinS: 50, tilt: 0.01, oblate: 1 },
  moon: { map: "moon.jpg", kind: "rocky", spinS: 40, tilt: 0.12, oblate: 1 },
  ceres: { map: "ceres.jpg", kind: "rocky", spinS: 30, tilt: 0.07, oblate: 1 },
  jupiter: { map: "jupiter.jpg", kind: "gas", spinS: 10, tilt: 0.05, oblate: 0.93, bandDrift: 0.012, faintRing: "dust" },
  saturn: { map: "saturn.jpg", kind: "ringed", spinS: 11, tilt: 0.47, oblate: 0.9, ring: "saturn_ring_alpha.png", bandDrift: 0.008 },
  uranus: { map: "uranus.jpg", kind: "ice", spinS: 17, tilt: 1.71, oblate: 0.98, faintRing: "narrow" },
  neptune: { map: "neptune.jpg", kind: "gas", spinS: 16, tilt: 0.49, oblate: 0.98, bandDrift: 0.01, faintRing: "arcs" },
  eris: { map: "eris.jpg", kind: "ice", spinS: 36, tilt: 0.2, oblate: 1 },
  haumea: { map: "haumea.jpg", kind: "ice", spinS: 8, tilt: 0.3, oblate: 0.8 },
  makemake: { map: "makemake.jpg", kind: "rocky", spinS: 23, tilt: 0.25, oblate: 1 },
} satisfies Record<string, BodySkin>;

export type SkinKey = keyof typeof SKINS;

/** A skin by its key. */
export function skinFor(key: SkinKey): BodySkin {
  return SKINS[key];
}

/**
 * How big a world of this kind is drawn, relative to the size its moon count
 * gives it (a planet's size still grows with its moons; this only makes a gas
 * giant read as a giant beside a rocky world).
 */
export const KIND_SCALE: Record<BodyKind, number> = {
  gas: 1.45,
  ringed: 1.3,
  ice: 1.15,
  veiled: 1,
  earthlike: 1,
  rocky: 0.9,
};

/** A moon's surface: the small, cratered and icy bodies. */
export const MOON_SKINS = ["moon", "ceres", "eris", "makemake", "mercury", "haumea"] as const satisfies readonly SkinKey[];

/** The sun's surface. */
export const SUN_MAP = "sun.jpg";

/** Every file the map may request, for preloading and for the credit check. */
export function allTextureFiles(): string[] {
  const set = new Set<string>([SUN_MAP]);
  for (const s of Object.values(SKINS) as BodySkin[]) {
    set.add(s.map);
    if (s.clouds) set.add(s.clouds);
    if (s.ring) set.add(s.ring);
  }
  return [...set].sort();
}

/** A small, stable string hash (FNV-1a). Deterministic, and not cryptography. */
export function seededHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A moon's skin key, chosen by its objective id and the student's seed. */
export function moonSkinKey(objectiveId: string, seed: number): SkinKey {
  return MOON_SKINS[seededHash(`moon:${objectiveId}:${Math.round(seed * 1e6)}`) % MOON_SKINS.length]!;
}

/** A moon's skin. */
export function moonSkin(objectiveId: string, seed: number): BodySkin {
  return SKINS[moonSkinKey(objectiveId, seed)];
}
