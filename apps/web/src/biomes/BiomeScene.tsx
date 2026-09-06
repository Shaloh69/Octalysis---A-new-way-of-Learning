import { useEffect, useState } from "react";
import { loadBiome, type BiomeManifest } from "./registry";

/**
 * The landing scene a student arrives in.
 *
 * `BIOME-AND-LOADING-SPEC.md` §1: a biome is the scenery around a stage, seeded
 * per student. The encounter theme underneath is untouched and still per-stage
 * — Student A and Student B land on Stage 09 in a jungle and a desert, and both
 * get the Pixel theme for the actual bit-toggle exercise, because pixel art is
 * honestly what a grid of bits looks like. Different mood, same lesson, same
 * difficulty, same grade.
 *
 * THREE STATES, and the middle one is the interesting one:
 *
 *   art        the biome has vendored layers -> parallax scene. The default
 *              for six of seven (§2, as revised).
 *   procedural the manifest declares no layers AND that is intentional --
 *              none, now. volcanic was the named exception where no licensed
 *              pack exists yet.
 *   nothing    the manifest has no layers because the assets are not vendored
 *              yet. Renders NOTHING rather than a gradient stand-in. A gradient
 *              would look finished, and passing one off as the biome is exactly
 *              what §2 was revised to forbid.
 *
 * That last distinction is why `procedural` is an explicit allow-list rather
 * than "no layers means draw the tokens": otherwise every un-sourced biome
 * would quietly render as a tinted rectangle and look done.
 *
 * IT IS ALSO THE LOADING TRANSITION (`BIOME-AND-LOADING-SPEC.md` §4.2).
 * Entering a stage is the one navigation where the solar system stops being the
 * background — content surfaces opt out — so the biome resolving in is what
 * makes that a departure rather than a disappearance. `PAGE-SPECS.md` §5's rule
 * is "skeletons matching final layout, never a centred spinner"; a biome
 * preview is the game-native form of that, not an exception to it. Frozen to a
 * single static frame under reduced motion.
 *
 * ACCESSIBILITY. `aria-hidden`, and no text equivalent. This is the one place
 * in the redesign where "needs no accessible equivalent" is the correct call,
 * and it is correct precisely because a biome carries zero pedagogical weight:
 * a screen-reader user gets the same stage content, they are just not told the
 * weather. Anything that means something goes in the text, as everywhere else.
 */

/**
 * Biomes allowed to render from tokens instead of art.
 *
 * **Empty, as of 2 September 2026.** `volcanic` was the single named exception —
 * the one biome with no cleanly-licensed pack, allowed a lava-glow gradient
 * instead of a scene. It has been replaced outright by `city`, which has real
 * CC0 art, so the exception has nothing left to cover.
 *
 * The set is KEPT rather than deleted along with the branch it guards. §2's rule
 * is that a biome with no art renders NOTHING rather than a stand-in, because a
 * gradient looks finished; `PROCEDURAL` is the deliberate, named opt-out from
 * that rule. The next biome that cannot be sourced should have to be added here
 * on purpose, not inherit an allowance by accident.
 */
const PROCEDURAL: ReadonlySet<string> = new Set<string>();

interface Props {
  /** Resolved biome name, from the cosmetic endpoint. */
  readonly name: string | null;
}

export function BiomeScene({ name }: Props): JSX.Element | null {
  const [manifest, setManifest] = useState<BiomeManifest | null>(null);

  useEffect(() => {
    if (!name) return;
    let alive = true;
    // Loaded on demand, one biome, never all seven -- see registry.ts.
    void loadBiome(name).then((m) => {
      if (alive) setManifest(m);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  if (!name || !manifest) return null;

  const hasArt = manifest.layers.length > 0;
  const isProcedural = PROCEDURAL.has(manifest.name);

  // Assets pending. Render nothing at all rather than something that looks
  // like a finished biome.
  if (!hasArt && !isProcedural) return null;

  return (
    <div
      className={`biome biome-arrive${manifest.kind === "strip" ? " biome-strip" : ""}${manifest.smooth ? " biome-smooth" : ""}`}
      data-biome-render={hasArt ? "art" : "procedural"}
      aria-hidden="true"
    >
      {manifest.layers.map((layer, li) =>
        layer.variants && layer.variants.length > 0 ? (
          /*
           * A SCATTERED layer: individual sprites, deterministically placed.
           * See `BiomeLayer.variants` for why this exists and where the
           * technique comes from.
           */
          <div
            key={`scatter-${li}`}
            className="biome-layer biome-scatter"
            style={{
              ["--biome-depth" as string]: String(layer.depth),
              ["--biome-drift" as string]: `${28 + li * 9}s`,
            }}
          >
            {scatter(layer, li).map((sprite) => (
              /*
                An <img>, NOT a <span> with a background-image — and this is the
                whole fix for squashed sprites rather than a tuning of it.

                Sprites used to declare `aspectRatio: layer.aspect`, one ratio
                for a whole layer. But a layer holds VARIANTS, and variants are
                different pictures with different shapes: jungle's three trees
                are 0.44, 0.46 and 0.46, its cloud is 1.59, desert's mountain is
                0.62 against a declared 0.93. Measuring across all seven biomes
                found fourteen sprites distorted, the worst by 51%. Every one of
                those was a number typed next to a picture it did not describe.

                An <img> with `height` set and `width: auto` takes its ratio from
                the FILE. It cannot disagree with the art, so the failure mode is
                gone rather than corrected — no measuring, no per-variant table,
                and nothing to get wrong when a variant is added later.

                `alt=""` because the scene is `aria-hidden` and carries no
                meaning; a decorative image announced by name would be noise.
              */
              <img
                key={sprite.key}
                className="biome-sprite"
                src={sprite.src}
                alt=""
                decoding="async"
                style={{
                  left: `${sprite.x}%`,
                  height: `${sprite.size}%`,
                  transform: `translateX(-50%) scaleX(${sprite.flip})`,
                  /*
                    Sprites STAND ON the ground plane, not on the viewport
                    floor. Without this they were positioned against the bottom
                    of the screen with the ground drawn over them, so a tree's
                    trunk vanished and the canopy appeared to hover.
                  */
                  [layer.align === "top" ? "top" : "bottom"]:
                    layer.align === "top"
                      ? `${sprite.offset}%`
                      : `calc(${manifest.ground ?? 0}% + ${sprite.offset}%)`,
                }}
              />
            ))}
            {/*
              One veil of sky colour in front of this plane. See `.biome-fog`:
              a filter can change a sprite but cannot put air BETWEEN two layers,
              which is why the far trees stayed crisp however desaturated they
              got.
            */}
            <div className="biome-fog" />
          </div>
        ) : (
        <div
          key={layer.src}
          className="biome-layer"
          style={{
            backgroundImage: `url("${layer.src}")`,
            backgroundPosition: `center ${layer.align}`,
            // Parallax depth is a CSS variable so the whole effect can be
            // frozen by one media query rather than by JavaScript.
            ["--biome-depth" as string]: String(layer.depth),
            ["--biome-scale" as string]: String(layer.scale),
          }}
        />
        ),
      )}

      {/*
        THE GROUND PLANE. Drawn before the motif and after the layers, so
        foreground detail sits on it and weather passes in front of it.

        A flat plane meeting a horizon is the one part of these scenes that is
        genuinely a colour rather than a picture, so it comes from the biome's
        own token instead of from art.
      */}
      {manifest.ground ? (
        <div className="biome-ground" style={{ height: `${manifest.ground}%` }} />
      ) : null}

      {/*
        The ambient motif — §4.2b. One per biome, and `neutral` deliberately has
        none so the default reads as calm rather than busy.

        Twelve motes, not a particle system: this is weather, not a feature, and
        the initial-bundle rule in root `CLAUDE.md` is not relaxed for weather.
        Each gets a deterministic position and duration so the scene is stable
        and a screenshot is reproducible.
      */}
      {manifest.motif ? (
        <div className={`biome-motif biome-motif-${manifest.motif}`}>
          {motes(manifest.motif).map((m) => (
            <span
              key={m.key}
              className="biome-mote"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                ["--mote-dur" as string]: `${m.dur}s`,
                animationDelay: `${m.delay}s`,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Deterministic motes for one motif.
 *
 * Same reasoning as `scatter`: no runtime randomness, so the weather is the
 * same on every visit and a capture can be compared against the last one.
 * Durations vary per mote because motes that share a duration read as a
 * conveyor belt rather than as falling.
 */
function motes(
  motif: string,
): Array<{ key: string; x: number; y: number; dur: number; delay: number }> {
  let seed = 2166136261;
  for (let i = 0; i < motif.length; i += 1) seed = (seed ^ motif.charCodeAt(i)) * 16777619;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  return Array.from({ length: 12 }, (_, i) => ({
    key: `${motif}-${i}`,
    x: rand() * 100,
    y: rand() * 100,
    // 9-21s. Slow enough to be ambient; a fast mote is a distraction, and this
    // sits behind text a student is trying to read.
    dur: 9 + rand() * 12,
    // Negative delay starts each mote mid-flight, so the scene is already in
    // motion on arrival rather than beginning with an empty sky.
    delay: -rand() * 12,
  }));
}

/**
 * Deterministic placement for one scattered layer.
 *
 * A small integer hash, seeded from the biome name, the layer index and the
 * sprite index. No randomness at runtime: the same student sees the same scene
 * on every visit, a screenshot is reproducible, and a test can assert the
 * spread. It is also NOT the per-student cosmetic seed — two students in a
 * jungle see the same jungle, the same way they see the same curriculum.
 *
 * Each sprite gets four things from that hash, and it is the COMBINATION that
 * defeats the eye's pattern matching rather than any one of them:
 *
 *   variant  which sprite, from the layer's pool
 *   x        where, spread across the band with jitter inside its slot
 *   size     how big, within `jitter` of the layer's scale
 *   flip     mirrored or not, which doubles the apparent variety for free
 */
function scatter(
  layer: BiomeManifest["layers"][number],
  layerIndex: number,
): Array<{ key: string; src: string; x: number; size: number; flip: number; offset: number }> {
  const variants = layer.variants ?? [];
  const count = layer.count ?? 6;
  const jitter = layer.jitter ?? 0.35;

  let seed = 2166136261 ^ layerIndex * 16777619;
  for (const v of variants) {
    for (let i = 0; i < v.length; i += 1) seed = (seed ^ v.charCodeAt(i)) * 16777619;
  }
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const out = [];
  for (let i = 0; i < count; i += 1) {
    const src = variants[Math.floor(rand() * variants.length)] ?? variants[0]!;
    /*
     * Slot-based, not free-random. Dividing the width into `count` slots and
     * jittering INSIDE each one keeps the spread even -- pure randomness
     * clumps, and a clump reads as a mistake rather than as nature.
     */
    const slot = (i + 0.5) / count;
    /*
     * Spread is 1.8 slots wide, not 0.9 — so neighbours OVERLAP.
     *
     * At 0.9 each sprite was confined inside its own slot and no two could ever
     * cross, which produced a perfectly even rank however random the jitter
     * looked. Even spacing is exactly what a forest does not have: real density
     * comes from trees standing in front of each other, and a row of evenly
     * spaced trees reads as a fence.
     *
     * Overlap also means the far layers can carry many more instances without
     * the count showing, which is what "denser the farther back" needs.
     */
    const x = Math.max(0, Math.min(100, (slot + (rand() - 0.5) * (1.8 / count)) * 100));
    const size = layer.scale * 100 * (1 + (rand() - 0.5) * jitter);
    out.push({
      key: `${layerIndex}-${i}`,
      src,
      x,
      size,
      flip: rand() > 0.5 ? 1 : -1,
      /*
       * Vertical scatter, and it only ever SINKS.
       *
       * It was `(rand() - 0.5) * 3`, which lifted half the sprites off the
       * ground line — the floating this was meant to avoid, caused by the jitter
       * meant to look natural. A tree can stand slightly behind the horizon and
       * be partly hidden; it cannot hover above it.
       */
      offset: -rand() * 1.5,
    });
  }
  return out;
}
