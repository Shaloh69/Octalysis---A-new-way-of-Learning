import { useEffect, useMemo, useRef } from "react";
import type React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { StageMapData, StageNode } from "../lib/api";
import { parseInline } from "../lib/markdown";
import { nextStage } from "../lib/next-stage";
import { computeSolarLayout, LEVELS, LEVEL_NAMES } from "../solar-system/layout";
import { InlineText } from "./ReaderBlocks";

/**
 * The flat map: the whole course as one still picture of the solar system,
 * every stage a real button, and a panel that opens in place.
 *
 * Rebuilt 29 Sep 2026 against `design/templates/web/map/` (SPEC.md there,
 * roadmap.sh's curriculum map). ONE presentation, two homes (instructor ruling
 * of that day): `/app/map` mounts it as the page, and `/app` mounts it IN PLACE
 * when its ladder drops the canvas (reduced motion, a small screen, no WebGL),
 * so degrading looks exactly like the route a student can choose.
 *
 * THE ACCESSIBILITY CONTRACT, which this rebuild keeps and tightens:
 *
 *   - every stage is a real `<button>`, in curriculum order, so Tab walks the
 *     syllabus; its name carries its state, and a locked one the API's reason;
 *   - the picture is `aria-hidden` SVG: pixels. Everything it shows is in
 *     words somewhere a screen reader reaches (the buttons, the panel, the
 *     key, and the sr-only "Map key" naming every ring and moon);
 *   - a locked stage is still operable: selecting it is how a student learns
 *     why it is shut (`DESIGN-MANDATE.md` §1).
 *
 * WHERE THE BUTTONS GO is a container query, not a device guess. On a map at
 * least 560px wide they sit on their planets as 32px discs; below that the
 * planets are 15.3px apart (measured from `computeSolarLayout`), so the same
 * buttons become rows under the still picture. One DOM, one Tab stop each.
 *
 * NOTHING HERE DECIDES A STATE (hard rule 4). `state`, `mastery`, `lockReason`
 * and `edges` are the API's; this draws them and prints the reason verbatim.
 */

/** Padding around the outermost ring, in layout units. */
const PAD = 2.2;

const STATE_WORD: Record<StageNode["state"], string> = {
  locked: "Locked",
  available: "Not started",
  in_progress: "In progress",
  mastered: "Mastered",
};

/**
 * The selection lives in the URL (`?stage=06`): bookmarkable (PAGE-SPECS), and
 * Back steps out of it (`WEB-REVAMP.md` §3.3). Opening from nothing PUSHES, so
 * Back closes; switching stages while one is open REPLACES, so Back still
 * closes rather than walking every stage looked at.
 */
interface NavState {
  fmOpened?: boolean;
  fmFocus?: boolean;
}

export function useMapSelection(): {
  selected: string | null;
  open: (id: string) => void;
  close: () => void;
} {
  const location = useLocation();
  const nav = useNavigate();
  const selected = new URLSearchParams(location.search).get("stage");
  const st = (location.state ?? {}) as NavState;

  const open = (id: string): void => {
    const p = new URLSearchParams(location.search);
    p.set("stage", id);
    nav(
      { pathname: location.pathname, search: `?${p.toString()}` },
      { replace: !!selected, state: { fmOpened: selected ? !!st.fmOpened : true, fmFocus: true } },
    );
  };
  const close = (): void => {
    if (st.fmOpened) {
      nav(-1);
      return;
    }
    const p = new URLSearchParams(location.search);
    p.delete("stage");
    const q = p.toString();
    nav({ pathname: location.pathname, search: q ? `?${q}` : "" }, { replace: true });
  };
  return { selected, open, close };
}

/**
 * Objectives in the syllabus's order: 06.1, 06.2 … 06.10. The API sends them
 * `order by id`, a string sort, so 06.10 arrived second (seen in the first
 * capture, 29 Sep 2026; NEXT-SESSION §0r). Presentation only: nothing is
 * added, dropped or reworded.
 */
export function byObjectiveId(a: { id: string }, b: { id: string }): number {
  const pa = a.id.split(".").map(Number);
  const pb = b.id.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0 && !Number.isNaN(d)) return d;
  }
  return a.id.localeCompare(b.id);
}

/** Numbers in mono, words in prose: the API's reason, verbatim. */
const Words = ({ text }: { text: string }) => <InlineText c={parseInline(text)} />;

function StateLine({ node }: { node: StageNode }): JSX.Element {
  const pct = <span className="mono">{Math.round(node.mastery * 100)}%</span>;
  if (node.state === "locked") return <>Not open yet</>;
  if (!node.gradeable) return <>Not graded</>;
  if (node.state === "mastered") return <>Mastered: your best check is {pct}</>;
  if (node.state === "in_progress") return <>In progress: your best check is {pct}</>;
  return <>Not started</>;
}

export function FlatMap({
  data,
  onEnter,
  warping = false,
  lead,
}: {
  data: StageMapData;
  /** Into `/app/stage/:id`. The caller owns the travel (§4.1's warp). */
  onEnter: (stageId: string) => void;
  warping?: boolean;
  /** Above the map in the main column: `/app/map`'s "what next" card. */
  lead?: React.ReactNode;
}): JSX.Element {
  const location = useLocation();
  const { selected: wanted, open, close } = useMapSelection();

  const ordered = useMemo(() => [...data.nodes].sort((a, b) => a.ordinal - b.ordinal), [data.nodes]);
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const sel = wanted ? byId.get(wanted) ?? null : null;
  const selectedId = sel?.id ?? null;

  const next = nextStage(data.nodes);
  const nextId = next.kind === "resume" || next.kind === "start" ? next.node.id : null;

  const layout = useMemo(
    () =>
      computeSolarLayout(
        data.nodes,
        data.nodes.flatMap((n) => n.objectives.map((o) => ({ id: o.id, stageId: n.id, level: o.level }))),
      ),
    [data.nodes],
  );
  const extent = Math.max(...layout.ringRadii) + PAD;
  const size = extent * 2;
  const pct = (v: number) => `${(((v + extent) / size) * 100).toFixed(3)}%`;

  /*
   * Stage 11's reveal, kept: the picture names the rings only once 11 is
   * mastered. The sr-only key below names them for everyone, from day one
   * (DESIGN-MANDATE-V2 §5: the withholding may be cosmetic, never a gap).
   */
  const ringsNamed = (byId.get("11")?.state ?? "locked") === "mastered";

  // Focus: to the panel's heading when a selection asks for it; back to the
  // stage when the panel closes (§3.9: "focus moves to its heading on open").
  const heading = useRef<HTMLHeadingElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const prev = useRef<string | null>(selectedId);
  useEffect(() => {
    const was = prev.current;
    prev.current = selectedId;
    if (selectedId && (location.state as NavState | null)?.fmFocus) heading.current?.focus();
    else if (!selectedId && was) buttons.current.get(was)?.focus();
    // location.key: "Show on the map" for the stage already open refocuses too.
  }, [selectedId, location.key]);

  // Escape closes from anywhere, as a panel opened by a click should.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stars = useMemo(
    () =>
      ({
        "--stars-far": starShadows(160, 1600, 0x9e3779b9),
        "--stars-mid": starShadows(70, 1600, 0x85ebca6b),
        "--stars-near": starShadows(28, 1600, 0xc2b2ae35),
      }) as React.CSSProperties,
    [],
  );

  const panelId = "fm-panel";
  const reasonId = "fm-reason";
  const skipTo = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    document.getElementById("fm-key")?.focus();
  };

  return (
    <div className="fm-view" data-flatmap-view>
      <div className="fm-main">
        {lead}

        <div className="fm-mapbox">
          <div className="fm-plot">
            <div className={`galaxy-scroll${warping ? " is-warping" : ""}`} aria-hidden="true">
              <div className="galaxy-stars" style={stars}>
                <span className="galaxy-stars-far" />
                <span className="galaxy-stars-mid" />
                <span className="galaxy-stars-near" />
              </div>
              <svg className="galaxy-svg" viewBox={`${-extent} ${-extent} ${size} ${size}`} role="presentation">
                {/* The sun: the machine. Neutral: the accent marks a student's place, not decoration. */}
                <circle cx={0} cy={0} r={2.3} className="galaxy-sun-corona" />
                <circle cx={0} cy={0} r={1.5} className="galaxy-sun" />

                {LEVELS.map((level) => {
                  const r = layout.ringRadii[level];
                  if (r === undefined) return null;
                  const occupied = (layout.ringOccupancy[level] ?? 0) > 0;
                  return (
                    <g key={level}>
                      <circle cx={0} cy={0} r={r} className={`galaxy-ring${occupied ? "" : " galaxy-ring-empty"}`} />
                      {ringsNamed && (
                        <text x={0} y={-r - 0.28} className="galaxy-ring-label">
                          L{level} {LEVEL_NAMES[level]}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* The 18 edges, the API's own list. Dashed into a locked stage. */}
                {data.edges.map((e) => {
                  const a = layout.bodies.get(e.from);
                  const b = layout.bodies.get(e.to);
                  if (!a || !b) return null;
                  const locked = byId.get(e.to)?.state === "locked";
                  const on = selectedId === e.from || selectedId === e.to;
                  return (
                    <line
                      key={`${e.from}-${e.to}`}
                      x1={a.x}
                      y1={a.z}
                      x2={b.x}
                      y2={b.z}
                      data-from={e.from}
                      data-to={e.to}
                      className={`galaxy-edge${locked ? " galaxy-edge-locked" : ""}${on ? " is-on" : ""}`}
                    />
                  );
                })}

                {[...layout.bodies.values()]
                  .filter((b) => b.kind === "moon")
                  .map((m) => (
                    <circle key={m.id} cx={m.x} cy={m.z} r={0.13} className="galaxy-moon" />
                  ))}

                {ordered.map((n) => {
                  const body = layout.bodies.get(n.id);
                  if (!body) return null;
                  return (
                    <g key={n.id} className={`galaxy-node galaxy-node-${n.state}`} data-stage={n.id}>
                      {nextId === n.id && <circle cx={body.x} cy={body.z} r={1.05} className="galaxy-next" />}
                      {selectedId === n.id && <circle cx={body.x} cy={body.z} r={1.35} className="galaxy-selected" />}
                      <circle cx={body.x} cy={body.z} r={0.55} className="galaxy-planet" />
                    </g>
                  );
                })}
              </svg>
            </div>

            <a className="fm-skip" href="#fm-key" onClick={skipTo}>
              Skip the stage list
            </a>

            <ol className="fm-stages" aria-label="Stages, in course order">
              {ordered.map((n) => {
                const body = layout.bodies.get(n.id);
                const at = body
                  ? ({ "--x": pct(body.x), "--y": pct(body.z) } as React.CSSProperties)
                  : undefined;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) buttons.current.set(n.id, el);
                        else buttons.current.delete(n.id);
                      }}
                      className="node-hit"
                      data-stage={n.id}
                      data-state={n.state}
                      data-next={nextId === n.id ? "true" : undefined}
                      aria-expanded={selectedId === n.id}
                      aria-controls={panelId}
                      style={at}
                      onClick={() => open(n.id)}
                    >
                      <span className="sr-only">Stage </span>
                      <span className="fm-dot mono">{n.id}</span>{" "}
                      <span className="fm-node-text">
                        <span className="fm-node-title">{n.title}</span>{" "}
                        <span className="fm-node-state">
                          {STATE_WORD[n.state]}
                          {n.state === "in_progress" && (
                            <>
                              {" "}
                              <span className="mono">{Math.round(n.mastery * 100)}%</span>
                            </>
                          )}
                        </span>
                      </span>
                      {n.state === "locked" && n.lockReason && (
                        <span className="sr-only">. {n.lockReason.message}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <section className="fm-key" id="fm-key" data-key tabIndex={-1} aria-labelledby="fm-key-title">
          <h2 id="fm-key-title">Key</h2>
          <ul>
            <li><span className="fm-dot fm-sample" data-mark="locked" aria-hidden="true" />Locked</li>
            <li><span className="fm-dot fm-sample" data-mark="available" aria-hidden="true" />Not started</li>
            <li><span className="fm-dot fm-sample" data-mark="in_progress" aria-hidden="true" />In progress</li>
            <li><span className="fm-dot fm-sample" data-mark="mastered" aria-hidden="true" />Mastered</li>
            <li><span className="fm-dot fm-sample fm-sample-next" aria-hidden="true" />Your next stage</li>
            <li><span className="fm-line-sample" aria-hidden="true" />Needs the stage before it</li>
          </ul>
        </section>

        {/*
          THE TEXT KEY, sr-only (DESIGN-MANDATE-V2 §5): every ring named, and
          every stage's moons listed, whatever Stage 11 says. Visible, it would
          spend Stage 11's reveal on the sighted student it is for.
        */}
        <section className="sr-only" aria-label="Map key">
          <h3>Orbits, innermost to outermost</h3>
          <dl>
            {LEVELS.map((level) => {
              const on = ordered.filter((n) => Math.round(layout.bodies.get(n.id)?.ring ?? -1) === level);
              return (
                <div key={level}>
                  <dt>
                    Level {level}, {LEVEL_NAMES[level]}
                  </dt>
                  <dd>
                    {on.length === 0
                      ? "No stages sit on this orbit."
                      : `${on.length} stage${on.length === 1 ? "" : "s"}: ${on.map((n) => `${n.id} ${n.title}`).join(", ")}.`}
                  </dd>
                </div>
              );
            })}
          </dl>
          <h3>Subtopics, by stage</h3>
          <p>Each stage&rsquo;s subtopics are drawn as moons orbiting its planet. Every one is listed here.</p>
          <dl>
            {ordered.map((n) => (
              <div key={n.id}>
                <dt>
                  Stage {n.id}, {n.title}
                </dt>
                <dd>
                  {n.objectives.length === 0
                    ? "No subtopics recorded for this stage."
                    : `${n.objectives.length} moon${n.objectives.length === 1 ? "" : "s"}: ${n.objectives
                        .map((o) => o.description)
                        .join("; ")}.`}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section
        id={panelId}
        className="fm-panel"
        data-panel={sel ? "stage" : "empty"}
        aria-labelledby="fm-panel-title"
      >
        {sel ? (
          <div className="fm-panel-body fm-panel-stage" key={sel.id}>
            <div className="fm-panel-head">
              <p className="fm-eyebrow" data-eyebrow>
                Stage <span className="mono">{sel.id}</span>
              </p>
              <button
                type="button"
                className="fm-btn fm-close"
                aria-label={`Close Stage ${sel.id} details`}
                onClick={close}
              >
                Close
              </button>
            </div>
            <h2 id="fm-panel-title" ref={heading} tabIndex={-1}>
              {sel.title}
            </h2>
            {sel.summary && (
              <p className="fm-summary" data-summary>
                {sel.summary}
              </p>
            )}

            <div className={`fm-status fm-status-${sel.state}`}>
              <p className="fm-state" data-state>
                <span className="fm-dot fm-sample" data-mark={sel.state} aria-hidden="true" />
                <span>
                  <StateLine node={sel} />
                </span>
              </p>
              {sel.state === "locked" && sel.lockReason && (
                <>
                  <p className="fm-reason" id={reasonId} data-reason>
                    <Words text={sel.lockReason.message} />
                  </p>
                  <div className="fm-row">
                    {sel.lockReason.blockingStages.map((b) => (
                      <button key={b} type="button" className="fm-btn" onClick={() => open(b)}>
                        Show Stage <span className="mono">{b}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="fm-row fm-actions">
              <button
                type="button"
                className="fm-btn fm-btn-primary"
                disabled={sel.state === "locked"}
                aria-describedby={sel.state === "locked" ? reasonId : undefined}
                aria-label={`Enter journey, Stage ${sel.id} ${sel.title}`}
                onClick={() => onEnter(sel.id)}
              >
                Enter journey
              </button>
            </div>

            <p className="fm-meta" data-meta>
              <span className="mono">{sel.estMinutes}</span> minutes
              {sel.levels.length > 0 && (
                <>
                  {" · "}level{sel.levels.length === 1 ? "" : "s"}{" "}
                  <span className="mono">{sel.levels.map((l) => `L${l}`).join(" ")}</span>
                </>
              )}
            </p>

            <h3 className="fm-sub-title">{sel.state === "locked" ? "What it will cover" : "What it covers"}</h3>
            {sel.objectives.length === 0 ? (
              <p className="fm-quiet">No objectives are recorded for this stage.</p>
            ) : (
              <ul className="fm-objectives" data-objectives>
                {[...sel.objectives].sort(byObjectiveId).map((o) => (
                  <li key={o.id}>
                    <span className="mono fm-obj-id">{o.id}</span> {o.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="fm-panel-body">
            <h2 id="fm-panel-title" tabIndex={-1}>
              No stage selected
            </h2>
            <p className="fm-quiet">
              Choose a planet, or Tab to one, to see what it covers and whether it is open to you.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The star field: N stars as N box-shadows on ONE element, three layers, no
 * canvas, no script after paint, no motion (`BIOME-AND-LOADING-SPEC.md`
 * §4.1b). No colour is emitted: each shadow uses `currentColor`, so a token on
 * the layer colours it on every theme. Deterministic: the same sky for every
 * student, every session.
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
