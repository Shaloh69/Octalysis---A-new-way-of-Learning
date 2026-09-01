import { useMemo, useRef, useEffect } from "react";
import { computeLayout, layoutBounds, LEVELS, LEVEL_NAMES } from "../lib/layout";
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

  const positions = useMemo(() => computeLayout(data.nodes), [data.nodes]);
  const bounds = useMemo(() => layoutBounds(positions), [positions]);

  /*
   * The scene lives in AppShell now, as a full-page backdrop. This component no
   * longer owns a canvas -- it reads the shared projection so its controls can
   * sit over whatever the backdrop is drawing.
   */
  const { projection, focusId, setFocusId, showPath, togglePath, enabled, setPreference } =
    useSolar();

  // A planet that has formed since the last visit (§1.4b).
  const { formed, dismiss } = useFormation(data.nodes);

  const selectedId = focusId;
  const setSelectedId = setFocusId;
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
        <MapSvg data={data} positions={positions} bounds={bounds} onOpen={onOpen} />
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
          onEnter={(id) => {
            setSelectedId(null);
            onOpen(id);
          }}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/*
        The full text list.

        When the solar system is the page, the planets ARE the map and this list
        repeats what `/app/map` exists to provide — so here it collapses into a
        disclosure rather than covering the scene with 19 stages of prose. That
        was the actual complaint: the background could not be seen past the
        words.

        WHAT THIS IS NOT: a weakening of the accessibility contract. The list is
        still rendered, still complete, still 19 real focusable buttons with
        state and lock reason in text, and a disclosure is a standard operable
        pattern that screen-reader and keyboard users reach normally. And
        `/app/map` — the route whose whole job is the text representation —
        keeps it open, always. `SOLAR-SYSTEM-SPEC.md` §1.4b's hard requirement
        is about /app/map never withholding, and it does not.
      */}
      {showGalaxy ? (
        <details className="act-list-fold">
          <summary>All 19 stages, with lock reasons</summary>
          <ActList data={data} onOpen={setSelectedId} />
        </details>
      ) : (
        <ActList data={data} onOpen={setSelectedId} />
      )}
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
   * The ACCESSIBILITY contract does not weaken here. `ActList` below still
   * renders all 19 stages as real focusable buttons with state and lock reason
   * in full text, and `/app/map` is unchanged. This layer is the spatial
   * overlay for what is actually drawn; the list is the complete map.
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

function MapSvg({
  data,
  positions,
  bounds,
  onOpen,
}: {
  data: StageMapData;
  positions: ReturnType<typeof computeLayout>;
  bounds: ReturnType<typeof layoutBounds>;
  onOpen: (id: string) => void;
}): JSX.Element {
  const PAD = 70;
  const width = bounds.width + PAD * 2;
  const height = bounds.height + PAD * 2;

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  return (
    <div className="map-scroll">
      <svg
        className="map-svg"
        viewBox={`${bounds.minX - PAD} ${bounds.minY - PAD} ${width} ${height}`}
        role="presentation"
        aria-hidden="true"
      >
        {/* Level strata. Named only from Stage 11 onward -- the ten weeks of
            unexplained descent is the setup for that reveal. */}
        {LEVELS.map((level, i) => {
          const revealed = (nodeById.get("11")?.state ?? "locked") !== "locked";
          return (
            <g key={level}>
              <line
                x1={bounds.minX - PAD}
                x2={bounds.minX + bounds.width + PAD}
                y1={i * 90}
                y2={i * 90}
                className="stratum"
              />
              {revealed && (
                <text x={bounds.minX - PAD + 6} y={i * 90 - 6} className="stratum-label">
                  L{level} {LEVEL_NAMES[level]}
                </text>
              )}
            </g>
          );
        })}

        {/* Prerequisite edges, drawn as bus traces. */}
        {data.edges.map((e) => {
          const from = positions.get(e.from);
          const to = positions.get(e.to);
          if (!from || !to) return null;
          const target = nodeById.get(e.to);
          const satisfied = (nodeById.get(e.from)?.state ?? "locked") === "mastered";
          const midX = (from.x + to.x) / 2;
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
              className={`edge ${satisfied ? "edge-live" : ""} ${
                target?.state === "locked" ? "edge-dim" : ""
              }`}
              fill="none"
            />
          );
        })}

        {data.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          return (
            <g key={n.id} className={`node node-${n.state}`}>
              {p.spansAllLevels && (
                // Stages 06 and 11 are ABOUT the hierarchy, not at a level.
                <line x1={p.x} x2={p.x} y1={-20} y2={6 * 90 + 20} className="node-column" />
              )}
              <circle cx={p.x} cy={p.y} r={n.gradeable ? 17 : 13} className="node-disc" />
              {n.state === "mastered" && (
                <circle cx={p.x} cy={p.y} r={23} className="node-halo" />
              )}
              <text x={p.x} y={p.y + 5} className="node-id">
                {n.id}
              </text>
              <text x={p.x} y={p.y + 38} className="node-title">
                {n.title}
              </text>
            </g>
          );
        })}
      </svg>

      {/*
        The interactive layer: real buttons positioned over their discs. This is
        what carries every click, every focus ring, and every announcement. The
        SVG above is pixels.
      */}
      <div className="map-hit-layer">
        {data.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const left = ((p.x - (bounds.minX - PAD)) / width) * 100;
          const top = ((p.y - (bounds.minY - PAD)) / height) * 100;
          return (
            <NodeButton
              key={n.id}
              node={n}
              onOpen={onOpen}
              style={{ left: `${left}%`, top: `${top}%` }}
            />
          );
        })}
      </div>
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
      <span className="sr-only">{label}</span>
    </button>
  );
}

/** Text equivalent of the whole graph, grouped by act. */
function ActList({ data, onOpen }: { data: StageMapData; onOpen: (id: string) => void }): JSX.Element {
  const acts = [1, 2, 3, 4];
  const ACT_NAMES: Record<number, string> = {
    1: "Act I — Languages & Abstraction",
    2: "Act II — The Machine",
    3: "Act III — Execution",
    4: "Act IV — Performance & Beyond",
  };

  return (
    <section className="act-list" aria-label="All stages, as a list">
      {acts.map((act) => (
        <div key={act} className="act-group">
          <h2>{ACT_NAMES[act]}</h2>
          <ol>
            {data.nodes
              .filter((n) => n.act === act)
              .map((n) => (
                <li key={n.id} className={`act-item act-item-${n.state}`}>
                  <button type="button" onClick={() => onOpen(n.id)}>
                    <span className="act-item-id">{n.id}</span>
                    <span className="act-item-title">{n.title}</span>
                    <span className="act-item-state">
                      {n.state === "locked" ? "Locked" : n.state === "mastered" ? "Mastered" : null}
                    </span>
                  </button>
                  {n.prereq.length > 0 && (
                    <p className="act-item-prereq">
                      Needs {n.prereq.map((p) => `Stage ${p}`).join(" and ")}
                    </p>
                  )}
                  {n.state === "locked" && n.lockReason && (
                    <p className="act-item-lock">{n.lockReason.message}</p>
                  )}
                </li>
              ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
