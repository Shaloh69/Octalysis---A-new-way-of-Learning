import { useMemo, useRef, useState, Suspense, lazy, useEffect } from "react";
import { computeLayout, layoutBounds, LEVELS, LEVEL_NAMES } from "../lib/layout";
import type { StageNode, StageMapData } from "../lib/api";

/**
 * The stage map.
 *
 * TWO LAYERS, and the accessible one is canonical (SKILL-TREE-3D.md §4):
 *
 *   - The DOM layer below is always rendered. Every node is a real <button>
 *     with a label, a state, and -- when locked -- the reason and the distance.
 *     Focus order follows curriculum order, never screen position.
 *   - The WebGL galaxy sits BEHIND it, aria-hidden, pointer-events: none, and
 *     lazily loaded. A <canvas> has no accessibility semantics at all, so a 3D
 *     map that is the only representation of its content is inaccessible by
 *     construction.
 *
 * If WebGL fails, is disabled, or the viewport is small, the canvas simply never
 * appears. There is no error state, because nothing is missing.
 */

const GalaxyCanvas = lazy(() => import("./GalaxyCanvas"));

interface Props {
  data: StageMapData;
  onOpen: (stageId: string) => void;
}

type Mode = "2d" | "3d";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useIsSmallViewport(): boolean {
  const [small, setSmall] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 640,
  );
  useEffect(() => {
    const onResize = () => setSmall(window.innerWidth <= 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return small;
}

export function StageMap({ data, onOpen }: Props): JSX.Element {
  const isSmall = useIsSmallViewport();
  const reduced = prefersReducedMotion();

  // 3D is opt-in on small viewports and never under reduced motion. Defaults
  // are applied automatically and silently -- see VISUAL-SYSTEM-3D.md §5.
  const [mode, setMode] = useState<Mode>(() => {
    if (reduced) return "2d";
    if (typeof window !== "undefined" && window.innerWidth <= 640) return "2d";
    try {
      return localStorage.getItem("octa:map-mode") === "3d" ? "3d" : "2d";
    } catch {
      return "2d";
    }
  });

  const positions = useMemo(() => computeLayout(data.nodes), [data.nodes]);
  const bounds = useMemo(() => layoutBounds(positions), [positions]);

  const canUse3d = !reduced && !isSmall;
  const showGalaxy = mode === "3d" && canUse3d;

  const setModePersisted = (m: Mode): void => {
    setMode(m);
    try {
      localStorage.setItem("octa:map-mode", m);
    } catch {
      /* private window; the preference just does not persist */
    }
  };

  return (
    <div className="map-root">
      {showGalaxy && (
        <div className="map-galaxy" aria-hidden="true">
          <Suspense fallback={null}>
            <GalaxyCanvas nodes={data.nodes} positions={positions} />
          </Suspense>
        </div>
      )}

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
            onClick={() => setModePersisted(mode === "3d" ? "2d" : "3d")}
            aria-pressed={mode === "3d"}
          >
            {mode === "3d" ? "Flat map" : "View in 3D"}
          </button>
        )}
      </div>

      <MapSvg data={data} positions={positions} bounds={bounds} onOpen={onOpen} />

      {/*
        The screen-reader equivalent. Same graph, expressed as text, because the
        SVG's spatial arrangement carries information a screen reader cannot get.
      */}
      <ActList data={data} onOpen={onOpen} />
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
