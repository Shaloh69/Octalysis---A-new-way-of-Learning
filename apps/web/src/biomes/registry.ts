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
  /**
   * Height of this layer's sprite as a fraction of the band, 0–1.
   *
   * These packs ship individual elements — a tree, a cloud, a tuft of grass —
   * rather than full-height strips, so stretching every layer to the band's
   * height would distort all of them. Each says how big it actually is.
   */
  readonly scale: number;
  /** Where the sprite sits vertically: `bottom` for ground, `top` for sky. */
  readonly align: "top" | "bottom";

  /**
   * SCATTER, instead of tiling one sprite across the layer.
   *
   * `background-repeat: repeat-x` is uniform by construction: the same
   * silhouette at the same interval, forever. That is why the first seven
   * biomes read as one picture in seven palettes.
   *
   * When `variants` is present the layer instead places `count` INDIVIDUAL
   * sprites, each picking a variant, an x position, a size and a horizontal
   * flip from a deterministic hash. That is the DOM form of the standard fix
   * for texture repetition — per-instance offset and orientation derived from
   * an index (Inigo Quilez, https://iquilezles.org/articles/texturerepetition/)
   * combined with multiple tile variants.
   *
   * Deterministic on purpose: the same student sees the same scene every visit,
   * and a test can assert placement. The seed is the biome name plus the layer
   * index, NOT the per-student cosmetic seed — two students in a jungle see the
   * same jungle, exactly as they see the same curriculum.
   */
  readonly variants?: readonly string[];
  /** How many sprites this layer scatters. Ignored unless `variants` is set. */
  readonly count?: number;
  /** Size spread, 0-1. 0.4 means instances range 80%-120% of `scale`. */
  readonly jitter?: number;
  /**
   * Push this layer DOWN by a percentage of the scene height.
   *
   * For packs that leave a transparent margin BELOW their content. `align:
   * "bottom"` aligns the layer's *canvas* to the frame, not its artwork, so a
   * pack drawn with empty space under the subject renders that subject floating.
   *
   * City is the case that found it: `front.png` is 250x170 with content ending
   * at y=142, so the nearest skyline sat 16.5% above the frame while `back.png`
   * — whose content does reach its canvas bottom — showed underneath it. The
   * city appeared to hover over its own silhouette.
   *
   * The pack is not wrong. A platformer draws its ground tiles over that strip;
   * a full-page background has no ground tiles, so the margin has to be pushed
   * off-frame instead. Measured from the PNG's alpha bounding box, never
   * guessed: (canvasHeight - contentBottom) / canvasHeight.
   */
  readonly sink?: number;
  /*
   * `aspect` USED TO BE HERE, and its removal is the point.
   *
   * A scattered sprite is sized by height, so its width had to come from
   * somewhere, and this field supplied one ratio for a whole layer. But a layer
   * holds VARIANTS — different pictures with different shapes. Jungle's three
   * trees are 0.44, 0.46 and 0.46; its cloud is 1.59; desert's mountain is 0.62
   * against a declared 0.93. Measuring across all seven biomes found fourteen
   * sprites distorted, the worst by 51%.
   *
   * Sprites are now `<img>` with `width: auto`, so the ratio comes from the FILE
   * and cannot disagree with the art. Do not reintroduce this field: a number
   * describing a picture is a number that will eventually stop describing it.
   */
}

export interface BiomeManifest {
  readonly name: string;
  /**
   * How the art is shaped, which decides how it is painted.
   *
   *   elements  loose sprites — a tree, a cloud, a pyramid. Each layer tiles
   *             one sprite at its own size, and the scene is COMPOSED in the
   *             manifest. Kenney's packs are this. Aerial perspective has to be
   *             applied by the renderer, because the sprites have none.
   *   strip     pre-cut full-scene layers, already drawn as a set by their
   *             artist. Each fills the band. The renderer must NOT fade them:
   *             the depth is painted into the art, and dimming the back layer
   *             washes out a sky the artist already balanced.
   *
   * Defaults to `elements`, because that is what the first three packs were and
   * because it is the safer assumption — over-applying perspective to a strip
   * looks wrong, but it does not lose information.
   */
  readonly kind?: "elements" | "strip";
  /**
   * Painted art rather than pixel art.
   *
   * Strip packs default to `image-rendering: pixelated`, because the pixel-art
   * packs are chosen precisely for their crisp edges and smoothing one up to the
   * band turns it to mush. `cave` is painted, not pixel art, and pixelating it
   * produces exactly the jagged mess the flag exists to avoid elsewhere.
   */
  readonly smooth?: boolean;
  /**
   * Ambient motif for the loading transition and the resting scene — §4.2b.
   * One per biome, never several: `DESIGN-MANDATE.md` §1B rule 3 gives one
   * spectacle moment per stage and the Bring-Up already owns it.
   */
  readonly motif?: "leaves" | "sand" | "snow" | "bubbles" | "dust" | "embers";
  /**
   * Height of the ground plane, as a percentage of the scene.
   *
   * **The slot every biome was missing.** Sprites were positioned against the
   * bottom of the viewport with nothing under them, so trees and pyramids stood
   * on empty sky — they read as floating because they WERE floating. Real
   * parallax packs all carry this layer; it is the "ground with small crystals"
   * at the bottom of every published layer list.
   *
   * The ground is drawn from the biome's own `--biome-near` token rather than
   * from art, because it is a flat plane meeting a horizon — the one part of
   * these scenes that genuinely is a colour rather than a picture.
   *
   * Omit for a biome with no ground plane: `ocean` is suspended water and
   * `city` ships its own ground inside the art.
   */
  readonly ground?: number;
  /** Back-to-front. Empty means this biome is procedural — none are, now. */
  readonly layers: readonly BiomeLayer[];
  /**
   * Exactly what goes in `public/CREDITS.md`. Never ship art without this.
   *
   * `license` is the pack's ACTUAL terms, not a shorthand. Four of the six
   * sourced packs are **not** CC0 and each carries different obligations —
   * edermunizz's forest requires credit, Admurin's forbids AI training and
   * standalone redistribution — so filing them all as "CC0" would be wrong in
   * a way that matters. `obligations` exists to make the non-obvious ones
   * impossible to miss when someone reads only this file.
   */
  readonly credit: {
    readonly pack: string;
    readonly author: string;
    readonly url: string;
    /** Verbatim terms, or the SPDX id where one genuinely applies. */
    readonly license: string;
    /** Anything OCTA must actively DO or NOT do. Empty for true CC0. */
    readonly obligations: readonly string[];
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
  "city",
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
  city: () => import("./packs/city"),
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
