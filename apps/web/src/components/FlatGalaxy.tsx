import { useMemo } from "react";
import type React from "react";
import type { StageMapData, StageNode } from "../lib/api";
import { computeSolarLayout, LEVELS, LEVEL_NAMES } from "../solar-system/layout";

/**
 * The flat map, drawn as the same galaxy — orbits, planets and moons — but
 * still, in SVG, with no canvas and no motion.
 *
 * WHY THIS EXISTS. The flat presentation used to be a level-strata DAG: correct,
 * complete, and nothing like the map it stands in for. A student pushed onto it
 * by reduced motion, a portrait phone or absent WebGL did not get a quieter
 * version of the solar system, they got a different diagram of a different
 * thing, and had to rebuild their mental model to use it. `VISUAL-SYSTEM-3D.md`
 * §5 is explicit that the flat route "is never a degraded mode"; a layout that
 * shares nothing with the 3D one makes that claim untrue in the way that
 * matters most, which is recognition.
 *
 * IT READS THE SAME LAYOUT FUNCTION. Not a parallel implementation of the same
 * idea — the actual `computeSolarLayout` the 3D scene uses, projected x/z → x/y.
 * Root `CLAUDE.md`: "nothing about the map may be authored twice". The old flat
 * map had its own `computeLayout`, which is exactly the second authoring that
 * rule forbids, and it drifted: it drew strata the solar system had already
 * replaced with rings.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *
 *   - **No motion, at all.** No orbit animation, no drift, no twinkle, no
 *     transition. This is the surface reduced-motion students land on, so
 *     motion here would defeat the rung that sent them.
 *   - **No canvas, no WebGL, no `requestAnimationFrame`.** It is also the
 *     surface a device drops to when it cannot hold 30fps, so it must cost
 *     approximately nothing. SVG in the document, painted once.
 *   - **No fly-in.** Selecting a planet does not zoom. §4.1's warp loading
 *     screen carries the transition instead — see `StageMap`.
 *
 * The SVG is `aria-hidden` and `role="presentation"`: it is pixels. Every
 * click, focus ring and announcement belongs to the real buttons layered over
 * it, exactly as in the 3D scene. That two-layer split is `SKILL-TREE-3D.md`
 * §4 and is the whole accessibility architecture.
 */

/** Padding around the outermost ring, in layout units. */
const PAD = 2.2;

/**
 * Build one layer's `box-shadow` list.
 *
 * N stars on ONE element, as N shadows, rather than N elements. That is the
 * whole trick and the reason this is cheap enough to sit under the fallback:
 * three DOM nodes total, no canvas, no script running after paint.
 *
 * **No colour is emitted.** A `box-shadow` with no colour uses `currentColor`,
 * so the layer's colour comes from a token on the element and one list serves
 * all three themes. Writing a literal here would also trip the hook that bans
 * hex outside `packages/tokens`, which is the rule doing its job.
 *
 * Deterministic, for the same reason the 3D star field is: the sky should be
 * the same every session. This is NOT the per-student cosmetic seed — it does
 * not vary by student and must not, or two students comparing screens would
 * see different skies over the same curriculum.
 */
function starShadows(count: number, spread: number, seed: number): string {
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(`${(rand() * spread).toFixed(0)}px ${(rand() * spread).toFixed(0)}px`);
  }
  return out.join(",");
}

/** Planet radius in layout units. Mastered bodies read larger. */
function planetRadius(node: StageNode): number {
  if (node.state === "mastered") return 0.62;
  if (node.state === "in_progress") return 0.52;
  return 0.44;
}

export function FlatGalaxy({
  data,
  warping = false,
  children,
}: {
  data: StageMapData;
  /** True while §4.1's warp is carrying a transition. See `useFlatWarp`. */
  warping?: boolean;
  /**
   * The hit layer, rendered over the SVG by the caller. It receives a projector
   * so the buttons land on their planets: the caller owns the controls, this
   * component owns only where things are.
   */
  children?: (project: (id: string) => { left: string; top: string } | null) => JSX.Element;
}): JSX.Element {
  const layout = useMemo(
    () =>
      computeSolarLayout(
        data.nodes,
        data.nodes.flatMap((n) =>
          n.objectives.map((o) => ({ id: o.id, stageId: n.id, level: o.level })),
        ),
      ),
    [data],
  );

  const nodeById = useMemo(
    () => new Map(data.nodes.map((n) => [n.id, n])),
    [data.nodes],
  );

  // The outermost ring decides the frame. Fixed from the layout, not from the
  // viewport, so the picture is the same shape at every size and only scales.
  const extent = Math.max(...layout.ringRadii) + PAD;
  const size = extent * 2;
  const viewBox = `${-extent} ${-extent} ${size} ${size}`;

  /** Layout units → percentage of the SVG box, for the DOM hit layer. */
  const project = (id: string): { left: string; top: string } | null => {
    const body = layout.bodies.get(id);
    if (!body) return null;
    return {
      left: `${((body.x + extent) / size) * 100}%`,
      top: `${((body.z + extent) / size) * 100}%`,
    };
  };

  /*
   * Stage 11's reveal, preserved exactly as the 3D layer preserves it. Ten
   * weeks of unexplained descent is the setup; naming the rings before then
   * spends it. Server-derived state, never computed here.
   */
  const ringsNamed = (nodeById.get("11")?.state ?? "locked") === "mastered";

  /*
   * Fewer stars in the nearer layers: big dots read as noise at 3px, and the
   * far layer is what actually makes a sky. Computed once — the spread is a
   * fixed pixel box that the layers tile across, not a viewport measurement,
   * so a resize costs nothing and nothing here reads layout.
   */
  const stars = useMemo(
    () =>
      ({
        "--stars-far": starShadows(160, 1600, 0x9e3779b9),
        "--stars-mid": starShadows(70, 1600, 0x85ebca6b),
        "--stars-near": starShadows(28, 1600, 0xc2b2ae35),
      }) as React.CSSProperties,
    [],
  );

  const planets = data.nodes
    .map((n) => ({ node: n, body: layout.bodies.get(n.id) }))
    .filter((p): p is { node: StageNode; body: NonNullable<typeof p.body> } => !!p.body);

  return (
    <div className={`galaxy-scroll${warping ? " is-warping" : ""}`}>
      {/*
        The star field: three layers of box-shadow, and three DOM nodes total.
        See `styles.css` — it is static here, whatever it does elsewhere.
      */}
      <div className="galaxy-stars" aria-hidden="true" style={stars}>
        <span className="galaxy-stars-far" />
        <span className="galaxy-stars-mid" />
        <span className="galaxy-stars-near" />
      </div>

      <svg className="galaxy-svg" viewBox={viewBox} role="presentation" aria-hidden="true">
        {/* The sun. Elemental, never a character — SOLAR-SYSTEM-SPEC §1.1b. */}
        <circle cx={0} cy={0} r={1.5} className="galaxy-sun" />
        <circle cx={0} cy={0} r={2.3} className="galaxy-sun-corona" />

        {/* Orbits. Stroke weight carries how crowded a ring is, which is the
            same signal the 3D layer draws. */}
        {LEVELS.map((level) => {
          const r = layout.ringRadii[level];
          if (r === undefined) return null;
          const occupied = (layout.ringOccupancy[level] ?? 0) > 0;
          return (
            <g key={level}>
              <circle
                cx={0}
                cy={0}
                r={r}
                className={`galaxy-ring${occupied ? "" : " galaxy-ring-empty"}`}
              />
              {ringsNamed && (
                <text x={0} y={-r - 0.28} className="galaxy-ring-label">
                  L{level} {LEVEL_NAMES[level]}
                </text>
              )}
            </g>
          );
        })}

        {/* Moons: every one of them, not the seeded preview subset. The 3D
            layer withholds for effect at overview scale; this layer never
            withholds anything — SOLAR-SYSTEM-SPEC §1.4b. */}
        {[...layout.bodies.values()]
          .filter((b) => b.kind === "moon")
          .map((m) => (
            <circle key={m.id} cx={m.x} cy={m.z} r={0.13} className="galaxy-moon" />
          ))}

        {/*
          Planets. Progressive reveal is a 3D-only effect: a locked stage is
          drawn here, dimmed, because this layer is the complete picture.

          NO TEXT IN THE SVG. The stage id used to be an SVG <text>, and it
          rendered at 6x4 PIXELS -- measured, not estimated -- because font size
          in a viewBox scales with the drawing, and this drawing has to hold 19
          planets and 110 moons in one circle. At 380px it would have been 4px.
          The labels live in the DOM hit layer instead, at a real font size that
          scales with the page rather than the picture.
        */}
        {planets.map(({ node, body }) => (
          <g key={node.id} className={`galaxy-node galaxy-node-${node.state}`}>
            {node.state === "mastered" && (
              <circle cx={body.x} cy={body.z} r={0.95} className="galaxy-halo" />
            )}
            <circle
              cx={body.x}
              cy={body.z}
              r={planetRadius(node)}
              className="galaxy-planet"
            />
          </g>
        ))}
      </svg>

      {children?.(project)}

      {/*
        THE TEXT KEY. `DESIGN-MANDATE-V2.md` §5's solar-system gate, verbatim:

          > The flat map names every ring, planet, and moon in text,
          > INDEPENDENT of whether Stage 11 has been reached yet by that
          > student. [...] the withholding is allowed to be cosmetic, it is not
          > allowed to be an accessibility gap.

        It was an accessibility gap. A screen-reader user on this route got 19
        stage buttons and nothing else: the rings were unnamed, and the 115
        moons were not mentioned at all, because both lived only in an
        `aria-hidden` SVG.

        So the ring names are here from day one, for everyone using this key —
        while the SVG above still withholds them until Stage 11. That is not an
        inconsistency, it is the gate's own resolution: the reveal is a framing
        device for a sighted user watching a picture, and nobody should wait ten
        weeks for information the layout has always had.

        `sr-only` rather than visible, because making it visible would spend
        Stage 11's reveal for the sighted user the reveal is FOR. If that trade
        is ever judged wrong, the fix is to show this to everyone — not to take
        it away from anyone.
      */}
      <section className="sr-only" aria-label="Map key">
        <h3>Orbits, innermost to outermost</h3>
        <dl>
          {LEVELS.map((level) => {
            const on = planets.filter((p) => Math.round(p.body.ring) === level);
            return (
              <div key={level}>
                <dt>
                  Level {level}, {LEVEL_NAMES[level]}
                </dt>
                <dd>
                  {on.length === 0
                    ? "No stages sit on this orbit."
                    : `${on.length} stage${on.length === 1 ? "" : "s"}: ${on
                        .map((p) => `${p.node.id} ${p.node.title}`)
                        .join(", ")}.`}
                </dd>
              </div>
            );
          })}
        </dl>

        <h3>Subtopics, by stage</h3>
        <p>
          Each stage&rsquo;s subtopics are drawn as moons orbiting its planet.
          Every one is listed here, including those the picture leaves out.
        </p>
        <dl>
          {planets.map(({ node }) => (
            <div key={node.id}>
              <dt>
                Stage {node.id}, {node.title}
              </dt>
              <dd>
                {node.objectives.length === 0
                  ? "No subtopics recorded for this stage."
                  : `${node.objectives.length} moon${
                      node.objectives.length === 1 ? "" : "s"
                    }: ${node.objectives.map((o) => o.description).join("; ")}.`}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
