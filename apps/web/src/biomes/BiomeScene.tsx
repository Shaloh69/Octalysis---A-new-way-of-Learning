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
 *              volcanic only, the named exception where no cleanly-licensed
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

/** Biomes allowed to render from tokens instead of art. Exactly one. */
const PROCEDURAL: ReadonlySet<string> = new Set(["volcanic"]);

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
      className={`biome biome-arrive${manifest.kind === "strip" ? " biome-strip" : ""}`}
      data-biome-render={hasArt ? "art" : "procedural"}
      aria-hidden="true"
    >
      {manifest.layers.map((layer) => (
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
      ))}
    </div>
  );
}
