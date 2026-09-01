import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FirstRun } from "./FirstRun";
import { FlatGalaxy } from "./FlatGalaxy";
import { useFlatWarp } from "../solar-system/Warp";
import { RotatePrompt } from "../solar-system/RotatePrompt";
import type { ScreenPoint } from "../solar-system/SolarSystemCanvas";
import { useSolar } from "../solar-system/SolarBackdrop";
import { PlanetHud } from "../solar-system/PlanetHud";
import { useFormation } from "../solar-system/useFormation";
import type { StageNode, StageMapData } from "../lib/api";

/**
 * The stage map.
 *
 * TWO LAYERS, and the accessible one is canonical (SKILL-TREE-3D.md §4):
 *
 *   - The DOM layer below is always rendered. Every node is a real <button>
 *     with a label, a state, and -- when locked -- the reason and the distance.
 *     Focus order follows curriculum order, never screen position.
 *   - The WebGL solar system sits BEHIND it, aria-hidden, pointer-events: none,
 *     and lazily loaded. A <canvas> has no accessibility semantics at all, so a
 *     3D map that is the only representation of its content is inaccessible by
 *     construction.
 *
 * If WebGL fails, is disabled, or the viewport is small, the canvas simply never
 * appears. There is no error state, because nothing is missing, and NOTHING
 * REDIRECTS -- the DOM layer is already on screen underneath.
 *
 * That degrade-in-place behaviour is the F-5 ruling (docs/PROGRESS.md), and
 * `docs/VISUAL-SYSTEM-3D.md` 5's ladder owns it. What the same ruling changed:
 * 3D used to default to OFF behind a localStorage preference, so a student saw
 * a canvas only if they found the toggle. No document ever sanctioned that, and
 * it would have made the whole solar system invisible to most of the class.
 */

interface Props {
  data: StageMapData;
  onOpen: (stageId: string) => void;
  /**
   * `/app/map` asks for the flat view BY CHOICE, not by capability.
   *
   * The galaxy is already suppressed automatically under reduced motion, on a
   * small viewport, and when WebGL fails. This adds a fourth reason -- the
   * student asked -- so the flat route is never a degraded mode. Nothing
   * redirects, so a link into the course works on every device.
   */
  flat?: boolean;
}

export function StageMap({ data, onOpen, flat = false }: Props): JSX.Element {


  /*
   * The scene lives in AppShell now, as a full-page backdrop. This component no
   * longer owns a canvas -- it reads the shared projection so its controls can
   * sit over whatever the backdrop is drawing.
   */
  const {
    projection, focusId, setFocusId, selectedMoon, setSelectedMoon,
    showPath, togglePath, enabled, setPreference,
  } = useSolar();

  // A planet that has formed since the last visit (§1.4b).
  const { formed, dismiss } = useFormation(data.nodes);

  const selectedId = focusId;
  const setSelectedId = setFocusId;

  /*
   * On the flat map, opening a stage goes THROUGH the warp loading screen
   * instead of flying the camera in.
   *
   * The 3D layer eases the camera to the planet (`GAME-DESIGN.md` §3.2). There
   * is no camera here, and faking the zoom with a CSS scale would be the one
   * thing this surface must not do -- it is where reduced-motion and slow
   * devices land. `BIOME-AND-LOADING-SPEC.md` §4.1's warp is the transition
   * that already exists for moving between hub surfaces, so the flat map
   * borrows it rather than inventing a second answer.
   *
   * Under `prefers-reduced-motion` the warp renders as a held frame with no
   * streaks -- §4.1's own rule, not a special case added here.
   */
  const { warping, warpThen } = useFlatWarp();

  const openWithWarp = (id: string): void => {
    warpThen(() => onOpen(id));
  };
  const selected = selectedId ? data.nodes.find((n) => n.id === selectedId) ?? null : null;

  // Escape closes from anywhere, not only from inside the panel.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // `flat` is the FOURTH reason the canvas can be absent, alongside reduced
  // motion, a small viewport, and WebGL failing. All four are equal; none of
  // them makes this a fallback view.
  /*
   * `enabled` is the BACKDROP's answer, and it is the only one now: it applies
   * the whole degradation ladder in one place. This component used to compute
   * its own version, which is how the shell ended up drawing a canvas under
   * reduced motion after the scene moved there -- two answers, one of which
   * nothing consulted.
   *
   * `flat` is still local: `/app/map` asks for the flat view BY CHOICE, which
   * is a route decision rather than a capability one.
   */
  const canUse3d = enabled && !flat;
  const showGalaxy = canUse3d;

  return (
    <div className="map-root">

      <div className="map-header">
        <div>
          <h1>The machine, one subsystem at a time</h1>
          <p className="map-sub">
            {data.nodes.filter((n) => n.state === "mastered").length} of {data.nodes.length}{" "}
            subsystems online. Every connection below is a real prerequisite.
          </p>
        </div>

        {canUse3d && (
          <button
            type="button"
            className="mode-toggle"
            onClick={() => setPreference(showGalaxy ? "2d" : "3d")}
            aria-pressed={showGalaxy}
          >
            {showGalaxy ? "Flat map" : "View the solar system"}
          </button>
        )}

        {/*
          Prerequisite traces. Passes all four mandate tests: it changes what
          you can SEE, the label says which, it is instantly reversible, and it
          is a real preference rather than a number.
        */}
        {showGalaxy && (
          <button
            type="button"
            className="mode-toggle"
            onClick={togglePath}
            aria-pressed={showPath}
          >
            {showPath ? "Hide connections" : "Show connections"}
          </button>
        )}
      </div>

      {/*
        The scene is behind the whole page now (AppShell's SolarBackdrop). What
        remains here is the CONTROL layer: real focusable buttons positioned
        over whatever the backdrop draws.
      */}
      {showGalaxy && (
        <div className="map-overlay">
          <PlanetHits data={data} projection={projection} onOpen={setSelectedId} />
        </div>
      )}

      {/*
        The flat SVG map draws only when the solar system is NOT showing.
        Two maps of the same 19 stages, stacked, is not a richer view -- it is
        two views arguing. The act list below is the DOM layer either way, and
        it is the accessibility contract, not this SVG (which is
        role="presentation" and aria-hidden).
      */}
      {!showGalaxy && (
        /*
          The flat map is the SAME galaxy, drawn still.
          It used to be a level-strata DAG with its own `computeLayout` -- a
          second authoring of the map, which root CLAUDE.md forbids, and a
          different picture of the same curriculum, so a student sent here by
          reduced motion or a slow device had to rebuild their mental model
          rather than recognise a quieter version of what they knew.
          `FlatGalaxy` reads `computeSolarLayout`: same rings, same angles, same
          moons, no canvas and no motion.
        */
        <FlatGalaxy data={data} warping={warping}>
          {(project) => (
            <div className="map-hit-layer">
              {[...data.nodes]
                .sort((a, b) => a.ordinal - b.ordinal)
                .map((n) => {
                  const at = project(n.id);
                  if (!at) return null;
                  return (
                    <NodeButton
                      key={n.id}
                      node={n}
                      onOpen={openWithWarp}
                      style={{ left: at.left, top: at.top }}
                    />
                  );
                })}
            </div>
          )}
        </FlatGalaxy>
      )}

      {/*
        The screen-reader equivalent. Same graph, expressed as text, because the
        SVG's spatial arrangement carries information a screen reader cannot get.
      */}
      {/*
        A planet has formed. Calm, brief, and dismissible.

        NOT a second Bring-Up: GAME-DESIGN.md 1B rule 3 caps spectacle at one
        moment per stage, and the Bring-Up owns that budget with its 2000ms and
        its jingle. This is a map event. If the two ever compete for attention,
        this is the one that gets trimmed.
      */}
      {formed && (
        <div className="formation" role="status" aria-live="polite">
          <span className="formation-mark" aria-hidden="true" />
          <span>
            A new celestial body has formed —{" "}
            <span className="mono">{formed.id}</span> {formed.title}
          </span>
          <button type="button" className="formation-dismiss" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      )}

      {/* The map's response to a click, on either layer. The act list is the
          DOM representation of the same map, so selecting from it opens the
          same panel rather than a second, different behaviour. */}
      {selected && (
        <PlanetHud
          node={selected}
          prereqs={selected.prereq
            .map((id) => data.nodes.find((n) => n.id === id))
            .filter((n): n is StageNode => n !== undefined)}
          selectedMoon={selectedMoon}
          onSelectMoon={setSelectedMoon}
          onEnter={(id) => {
            setSelectedId(null);
            onOpen(id);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* First visit only, and dismissible from the first frame. */}
      <FirstRun />

      {/* Small screen in portrait: an invitation onto the map, not a wall. */}
      <RotatePrompt />

      {/*
        The stage list moved to its own route.

        It used to sit under the map as four columns of paragraphs covering the
        whole page -- correct, complete, and unreadable: a student scanning for
        where they are had to read every lock reason to find out. `/app/stages`
        now carries the same 19 stages with progress bars and planet marks, and
        every lock reason still printed, which is the part that is contractual
        rather than stylistic.

        A map is a map. This is the link to the list.
      */}
      <p className="map-alt-link">
        <Link to="/app/stages">All 19 stages, with progress and lock reasons</Link>
      </p>

    </div>
  );
}

/**
 * The button layer over the solar system.
 *
 * Every stage is a real, labelled, focusable control — the canvas carries none
 * of that, because a <canvas> has no accessibility semantics at all.
 *
 * FOCUS ORDER IS CURRICULUM ORDER, never screen position: `data.nodes` arrives
 * sorted by ordinal and is rendered in that order, so tabbing through the map
 * walks the syllabus. That is why this maps over the nodes rather than over the
 * projection, which has no meaningful order.
 *
 * Positions are applied imperatively from an rAF loop rather than through
 * React, so a drifting camera costs one transform per button per frame instead
 * of a full re-render.
 */
function PlanetHits({
  data,
  projection,
  onOpen,
}: {
  data: StageMapData;
  projection: React.MutableRefObject<Map<string, ScreenPoint>>;
  onOpen: (id: string) => void;
}): JSX.Element {
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    let frame = 0;
    const tick = (): void => {
      for (const [id, el] of refs.current) {
        const p = projection.current.get(id);
        if (!p || !p.visible) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [projection]);

  /*
   * Only revealed planets get a hit target.
   *
   * Progressive reveal (§1.4b) means a locked planet has no body in the scene.
   * Leaving its button behind put 19 clickable targets over 3 visible planets —
   * invisible controls floating in empty space, which is worse than no control:
   * a student tabbing the map would land on something with no visual referent,
   * and a pointer user would click nothing and get a dialog.
   *
   * The ACCESSIBILITY contract does not weaken here. `/app/stages` renders all
   * 19 as real focusable buttons with state and lock reason in full text, and
   * is linked from this page. This layer is the spatial overlay for what is
   * actually drawn; that list is the complete map.
   */
  const revealed = data.nodes.filter((n) => n.state !== "locked");

  return (
    <div className="map-hits">
      {revealed.map((n) => (
        <button
          key={n.id}
          type="button"
          ref={(el) => {
            if (el) refs.current.set(n.id, el);
            else refs.current.delete(n.id);
          }}
          className={`map-hit map-hit-${n.state}`}
          // A locked planet is still focusable and still activatable -- opening
          // it is how a student finds out WHY it is locked, and the design
          // mandate calls a lock with no visible reason the single most
          // demotivating element in ed-tech.
          aria-disabled={n.state === "locked"}
          onClick={() => onOpen(n.id)}
        >
          <span className="sr-only">
            {`Stage ${n.id}, ${n.title}. `}
            {n.state === "locked"
              ? `Locked. ${n.lockReason?.message ?? ""}`
              : n.state === "mastered"
                ? "Mastered."
                : n.state === "in_progress"
                  ? `In progress, ${Math.round(n.mastery * 100)} percent.`
                  : "Available."}
          </span>
          <span aria-hidden="true" className="map-hit-id mono">
            {n.id}
          </span>
        </button>
      ))}
    </div>
  );
}

function NodeButton({
  node,
  onOpen,
  style,
}: {
  node: StageNode;
  onOpen: (id: string) => void;
  style: React.CSSProperties;
}): JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const locked = node.state === "locked";

  // The full accessible name. A locked node must say WHY and HOW FAR -- a lock
  // that only shows an icon fails the design mandate's legibility test.
  const label = locked
    ? `Stage ${node.id}, ${node.title}. Locked. ${node.lockReason?.message ?? ""}`
    : `Stage ${node.id}, ${node.title}. ${
        node.state === "mastered"
          ? "Mastered"
          : node.state === "in_progress"
            ? `In progress, ${Math.round(node.mastery * 100)} percent`
            : "Available"
      }. ${node.estMinutes} minutes.`;

  return (
    <button
      ref={ref}
      type="button"
      className={`node-hit node-hit-${node.state}`}
      style={style}
      aria-label={label}
      aria-disabled={locked}
      onClick={() => {
        // A locked node is still focusable and still activatable -- it opens the
        // stage page, which explains the lock. Silently doing nothing on click
        // is the least legible possible response.
        onOpen(node.id);
      }}
    >
      {/*
        The id, VISIBLE, at a real font size.

        It used to be SVG <text> inside the map's viewBox, which measured 6x4
        pixels on a 1140px-wide map and would have been 4px at 380px: font size
        in a viewBox scales with the drawing, and this drawing holds 19 planets
        and 110 moons. Here it scales with the page instead. The full sentence
        stays screen-reader-only -- printing "Locked. Unlocks when Stage 03
        reaches 70%..." on nineteen planets would bury the map it describes.
      */}
      <span className="node-hit-id mono" aria-hidden="true">{node.id}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
