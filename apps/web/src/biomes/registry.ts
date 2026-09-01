/**
 * The seven landing biomes.
 *
 * `docs/redesign/BIOME-AND-LOADING-SPEC.md` §2, **as revised**: real sourced
 * CC0 parallax art is the DEFAULT, and a procedural treatment is the named
 * exception — not the other way round.
 *
 * That reversal is deliberate and easy to get backwards, so the reasoning is
 * repeated here where the code is: `GAME-DESIGN.md` §9's "no asset packs" rule
 * exists because an ENCOUNTER theme has to look content-honest, and four tokens
 * plus a gradient genuinely achieves that — a switchboard looks like a
 * switchboard. A biome's job is different. It exists so that "jungle" and
 * "desert" read as unmistakably different environments at a glance, and a flat
 * gradient in two hues delivers a tinted rectangle, which is barely
 * distinguishable from picking a different accent colour. That defeats the
 * point of having biomes at all.
 *
 * **Do not "simplify" these back to gradients.** An earlier draft of the spec
 * said procedural-first and it was corrected; this comment is here so a later
 * session does not quietly revert to it.
 *
 * BUNDLE DISCIPLINE. Only the one biome a student is actually seeded into is
 * ever loaded, and only when a landing needs it. Each entry below is a dynamic
 * import, so no biome's manifest reaches the initial bundle, and the layer
 * images live in `public/` so the browser fetches exactly the ones referenced.
 * Never import this file's entries eagerly, and never build an array of all
 * seven manifests — that would defeat the whole arrangement.
 */

/** One parallax layer, back to front. */
export interface BiomeLayer {
  /** Path under `public/`. */
  readonly src: string;
  /**
   * How far this layer shifts relative to the frontmost one, 0–1. 0 is the
   * horizon and does not move; 1 tracks the foreground exactly. Parallax only —
   * it carries no information, so `prefers-reduced-motion` freezes it flat.
   */
  readonly depth: number;
}

export interface BiomeManifest {
  readonly name: string;
  /** Back-to-front. Empty means this biome is procedural (see `volcanic`). */
  readonly layers: readonly BiomeLayer[];
  /** Exactly what goes in `public/CREDITS.md`. Never ship art without this. */
  readonly credit: {
    readonly pack: string;
    readonly author: string;
    readonly url: string;
    readonly license: string;
  } | null;
}

/**
 * The seven names, in the order the cosmetic endpoint indexes them.
 *
 * MUST stay in step with `BIOMES` in `services/api/src/routes/cosmetics.ts` —
 * the server sends an index and its own name list, and the client resolves the
 * name, so a reorder here alone cannot silently repaint everyone. The endpoint
 * echoes its list precisely so the two can be compared rather than assumed.
 */
export const BIOME_NAMES = [
  "neutral",
  "jungle",
  "desert",
  "arctic",
  "volcanic",
  "cave",
  "ocean",
] as const;

export type BiomeName = (typeof BIOME_NAMES)[number];

/**
 * Lazy loaders, one per biome. Dynamic import is what keeps six of seven out of
 * any given student's bundle.
 */
const LOADERS: Record<BiomeName, () => Promise<{ default: BiomeManifest }>> = {
  neutral: () => import("./packs/neutral"),
  jungle: () => import("./packs/jungle"),
  desert: () => import("./packs/desert"),
  arctic: () => import("./packs/arctic"),
  volcanic: () => import("./packs/volcanic"),
  cave: () => import("./packs/cave"),
  ocean: () => import("./packs/ocean"),
};

export function isBiomeName(value: string): value is BiomeName {
  return (BIOME_NAMES as readonly string[]).includes(value);
}

/** Load one biome's manifest. Returns null if the name is unknown. */
export async function loadBiome(name: string): Promise<BiomeManifest | null> {
  if (!isBiomeName(name)) return null;
  try {
    return (await LOADERS[name]()).default;
  } catch {
    // A biome that fails to load is a decoration that failed to load. The
    // landing renders without it and nothing is missing.
    return null;
  }
}
