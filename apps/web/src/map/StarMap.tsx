import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { StageMapData, StageNode } from "../lib/api";
import { computeSolarLayout, LEVEL_NAMES } from "../solar-system/layout";
import { useCosmetics } from "../solar-system/cosmetic-seed";
import { nextStage } from "../lib/next-stage";
import { NumberedTitle } from "../shell/MissionPanel";
import { WarpLink } from "../shell/RealmWarp";
import { useKeyHints } from "../shell/keyHints";
import { byObjectiveId, useSelection } from "./useSelection";
import type { ScenePlanet } from "./StarMapScene";

const StarMapScene = lazy(() => import("./StarMapScene"));

/**
 * `/app`: the 3D map, and the ONLY map (ruling 2, 30 Sep 2026). Starfield's
 * system map (`_direction/star/starfield-map.png`):
 *
 *   the scene        the solar system, filling the screen (StarMapScene)
 *   SYSTEM panel     the course, its mastery, the next stage, and the ROW OF
 *                    BODIES: one radio per planet, grouped by act. This is the
 *                    ACCESSIBLE LAYER (VISUAL-SYSTEM-3D.md §5): a keyboard or
 *                    a screen reader chooses a planet here, arrow keys move
 *                    through them, and it is the same action as a click
 *   BODY panel       the selected planet: its name, mastery, a stat table,
 *                    its moons (objectives), the lock's reason verbatim, and
 *                    Enter journey; a bottom sheet on a phone
 *   key hints        Enter journey, Close, Stages, Reset view
 *
 * The selection is `?stage=NN` (useSelection). Without WebGL the scene is not
 * drawn and a line says so; the panels, and so every control, remain.
 */

const ACTS: Record<number, { roman: string; name: string }> = {
  1: { roman: "I", name: "Prelim" },
  2: { roman: "II", name: "Midterm" },
  3: { roman: "III", name: "Semi-finals" },
  4: { roman: "IV", name: "Finals" },
};
const ARCHETYPES: Record<string, string> = { A: "Concept", B: "Computation", C: "Artifact", D: "Simulator" };
const STATE_WORD: Record<StageNode["state"], string> = {
  locked: "Locked",
  available: "Open",
  in_progress: "In progress",
  mastered: "Mastered",
};

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function useReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [r, setR] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

/** The frame-rate guard's verdict, kept seven days (VISUAL-SYSTEM-3D.md §5). */
const SLOW_KEY = "octa:map-quality";
function rememberedSlow(): boolean {
  try {
    const raw = localStorage.getItem(SLOW_KEY);
    if (!raw) return false;
    const at = Number((JSON.parse(raw) as { at?: number }).at);
    return Number.isFinite(at) && Date.now() - at < 7 * 86_400_000;
  } catch {
    return false;
  }
}

function useWide(min: number): boolean {
  const q = `(min-width: ${min}px)`;
  const [w, setW] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setW(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [q]);
  return w;
}

export function StarMap({ data }: { data: StageMapData }): JSX.Element {
  const nav = useNavigate();
  const { cosmetics } = useCosmetics();
  const { selected, open, close } = useSelection();
  const reduced = useReducedMotion();
  const wide = useWide(900);
  const webgl = useMemo(detectWebGL, []);
  const [slow, setSlow] = useState(rememberedSlow);
  const saveData = typeof navigator !== "undefined" && !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

  const yaw = useRef(0);
  const dragged = useRef(false);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const tag = useRef<HTMLSpanElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const systemRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const [frame, setFrame] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [bodyMax, setBodyMax] = useState<number | null>(null);

  const nodes = useMemo(() => [...data.nodes].sort((a, b) => a.ordinal - b.ordinal), [data]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const layout = useMemo(
    () =>
      computeSolarLayout(
        nodes.map((n) => ({ id: n.id, act: n.act, ordinal: n.ordinal, levels: n.levels })),
        nodes.flatMap((n) => n.objectives.map((o) => ({ id: o.id, stageId: n.id, level: o.level }))),
      ),
    [nodes],
  );
  const biomeOf = (id: string) => cosmetics.planetBiomes[id] ?? "neutral";
  const planets: ScenePlanet[] = nodes.map((n) => ({
    id: n.id,
    state: n.state,
    biome: biomeOf(n.id),
    moons: n.objectives.length,
  }));
  const next = nextStage(nodes);
  const nextId = next.kind === "resume" || next.kind === "start" ? next.node.id : null;
  const graded = nodes.filter((n) => n.gradeable);
  const survey = graded.length ? graded.reduce((s, n) => s + n.mastery, 0) / graded.length : 0;
  const sel = selected ? byId.get(selected) ?? null : null;
  const acts = [...new Set(nodes.map((n) => n.act))].sort();

  // Focus the body panel's heading when a planet is chosen in the scene (a
  // pointer choice); a choice in the row keeps focus in the row, so arrowing
  // through the planets is never interrupted.
  const fromScene = useRef(false);
  useEffect(() => {
    if (sel && fromScene.current) heading.current?.focus();
    fromScene.current = false;
  }, [sel]);

  /*
   * The free area: what the panels leave of the screen. The camera centres and
   * fits the system (or the chosen planet) inside it, so nothing important is
   * ever drawn under a panel: right of the side column on a wide screen,
   * between the top panel and the sheet (or the nav) on a phone.
   */
  useLayoutEffect(() => {
    const measure = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const sys = systemRef.current?.getBoundingClientRect();
      const body = bodyRef.current?.getBoundingClientRect();
      const nav = document.querySelector(".star-nav")?.getBoundingClientRect();
      const navAtBottom = !!nav && nav.top > H / 2;
      let next: { x: number; y: number; w: number; h: number };
      if (W >= 900) {
        const left = Math.max(sys?.right ?? 0, body?.right ?? 0) + 16;
        const top = (nav && !navAtBottom ? nav.bottom : 0) + 8;
        next = { x: left, y: top, w: Math.max(80, W - left - 16), h: Math.max(80, H - top - 72) };
        setBodyMax(sys ? Math.max(200, H - sys.bottom - 28) : null);
      } else {
        const top = (sys?.bottom ?? 0) + 8;
        const bottom = body ? body.top - 8 : navAtBottom ? nav!.top - 8 : H - 8;
        next = { x: 0, y: top, w: W, h: Math.max(80, bottom - top) };
        setBodyMax(null);
      }
      setFrame((prev) =>
        prev && Math.abs(prev.x - next.x) < 1 && Math.abs(prev.y - next.y) < 1 && Math.abs(prev.w - next.w) < 1 && Math.abs(prev.h - next.h) < 1
          ? prev
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (systemRef.current) ro.observe(systemRef.current);
    if (bodyRef.current) ro.observe(bodyRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selected, wide]);

  const enterTo = sel && sel.state !== "locked" ? `/app/stage/${sel.id}` : null;
  useKeyHints("map", [
    ...(enterTo ? [{ key: "Enter", cap: "Enter", label: "Enter journey", run: () => nav(enterTo) }] : []),
    ...(sel ? [{ key: "Escape", cap: "Esc", label: "Close", run: close }] : []),
    { key: "s", cap: "S", label: "Stages", run: () => nav("/app/stages") },
    {
      key: "r",
      cap: "R",
      label: "Reset view",
      run: () => {
        yaw.current = 0;
        close();
      },
    },
  ]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, yaw: yaw.current };
    dragged.current = false;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || e.buttons === 0) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 6) dragged.current = true;
    yaw.current = drag.current.yaw - dx * 0.006;
  };
  const onPointerUp = () => {
    drag.current = null;
    // Let the click that ends a drag see `dragged`, then clear it.
    window.setTimeout(() => (dragged.current = false), 0);
  };

  return (
    <section
      className={`starmap${sel ? " has-selection" : ""}`}
      data-motion={reduced ? "still" : "orbit"}
      data-webgl={webgl ? "yes" : "no"}
      aria-labelledby="starmap-title"
    >
      <div
        className="starmap-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {webgl && (
          <Suspense fallback={null}>
            <StarMapScene
              layout={layout}
              planets={planets}
              selected={selected}
              next={nextId}
              rotation={cosmetics.rotationOffset}
              reduced={reduced}
              lowQuality={slow || saveData}
              yaw={yaw}
              dragged={dragged}
              tag={tag}
              frame={frame}
              onSelect={(id) => {
                fromScene.current = true;
                open(id);
              }}
              onMiss={close}
              onSlow={() => {
                setSlow(true);
                try {
                  localStorage.setItem(SLOW_KEY, JSON.stringify({ at: Date.now() }));
                } catch {
                  /* the verdict lasts this page only */
                }
              }}
            />
          </Suspense>
        )}
        <span ref={tag} className="starmap-tag" aria-hidden="true">
          {sel?.title}
        </span>
      </div>

      <div className="starmap-panels">
        <section ref={systemRef} className="hud-panel starmap-system" aria-labelledby="starmap-title">
          <h1 id="starmap-title" className="hud-caption starmap-caption">
            Star map
          </h1>
          <div className="starmap-system-body">
            <dl className="starmap-designation">
              <div>
                <dt>Designation</dt>
                <dd className="mono">CPE 412</dd>
              </div>
              <div>
                <dt>Planets</dt>
                <dd className="mono">{nodes.length}</dd>
              </div>
            </dl>
            <p className="starmap-course">Computer Architecture and Organization</p>

            <fieldset className="starmap-bodies">
              <legend className="sr-only">Planets, one per stage. Choose one to see it.</legend>
              {acts.map((act) => (
                <div key={act} className="starmap-act" role="presentation">
                  <span className="starmap-act-label" aria-hidden="true">
                    {ACTS[act]?.roman ?? act}
                  </span>
                  {nodes
                    .filter((n) => n.act === act)
                    .map((n) => (
                      <label
                        key={n.id}
                        className={`starmap-planet${n.id === nextId ? " is-next" : ""}`}
                        data-state={n.state}
                        style={{ ["--tint" as string]: `var(--biome-planet-${biomeOf(n.id)})` }}
                      >
                        <input
                          type="radio"
                          name="planet"
                          className="sr-only"
                          checked={selected === n.id}
                          onChange={() => open(n.id)}
                        />
                        <span className="starmap-dot" aria-hidden="true">
                          <span className="mono">{n.id}</span>
                        </span>
                        <span className="sr-only">
                          Stage {n.id} · {n.title}, {STATE_WORD[n.state].toLowerCase()}
                          {n.id === nextId ? ", your next stage" : ""}
                        </span>
                      </label>
                    ))}
                </div>
              ))}
            </fieldset>
            <p className="starmap-key" aria-hidden="true">
              <span className="starmap-key-item">
                <span className="starmap-key-lock" /> locked
              </span>
              <span className="starmap-key-item">
                <span className="starmap-key-done" /> mastered
              </span>
              <span className="starmap-key-item">
                <span className="starmap-key-next" /> your next stage
              </span>
            </p>

            <div className="starmap-survey">
              <span className="starmap-survey-label">
                <span>Course mastery</span>
                <span className="mono">{Math.round(survey * 100)}%</span>
              </span>
              <span className="starmap-meter" aria-hidden="true">
                <span style={{ width: `${Math.round(survey * 100)}%` }} />
              </span>
            </div>
            {next.kind === "resume" || next.kind === "start" ? (
              <p className="starmap-next">
                <span className="starmap-next-label">Next</span>
                <button type="button" className="starmap-next-link" onClick={() => open(next.node.id)}>
                  <NumberedTitle text={`Stage ${next.node.id} · ${next.node.title}`} />
                </button>
              </p>
            ) : null}
            {!webgl && (
              <p className="starmap-nowebgl" role="status">
                This device cannot draw the star system. Every planet is still here: choose one above.
              </p>
            )}
          </div>
        </section>

        {sel && (
          <section
            ref={bodyRef}
            className="hud-panel starmap-body"
            aria-labelledby="starmap-body-title"
            style={bodyMax ? { maxHeight: `${bodyMax}px` } : undefined}
          >
            <div className="starmap-body-head">
              <div>
                <h2 id="starmap-body-title" ref={heading} tabIndex={-1}>
                  {sel.title}
                </h2>
                <p className="starmap-body-sub">
                  <NumberedTitle text={`Stage ${sel.id} · ${ACTS[sel.act]?.name ?? `Act ${sel.act}`}`} />
                </p>
              </div>
              <button type="button" className="dialog-close" aria-label="Close" onClick={close}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <BodyPanel node={sel} byId={byId} onShow={open} enterTo={enterTo} />
          </section>
        )}
      </div>
    </section>
  );
}

function BodyPanel({
  node,
  byId,
  onShow,
  enterTo,
}: {
  node: StageNode;
  byId: Map<string, StageNode>;
  onShow: (id: string) => void;
  enterTo: string | null;
}): JSX.Element {
  const pct = Math.round(node.mastery * 100);
  const levels = [...node.levels].sort((a, b) => a - b);
  const lv = levels.length === 0 ? "—" : levels.length === 1 ? `L${levels[0]}` : `L${levels[0]}–L${levels[levels.length - 1]}`;
  const blocking = node.lockReason?.blockingStages[0];
  const moons = [...node.objectives].sort(byObjectiveId);
  return (
    <div className="starmap-body-main">
      <div className="starmap-survey">
        <span className="starmap-survey-label">
          <span>{node.gradeable ? "Mastery" : "Not graded"}</span>
          {node.gradeable && <span className="mono">{pct}%</span>}
        </span>
        {node.gradeable && (
          <span className="starmap-meter" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>

      <dl className="starmap-stats">
        <div>
          <dt>State</dt>
          <dd>
            {node.state === "locked" && <LockGlyph />}
            {STATE_WORD[node.state]}
          </dd>
        </div>
        <div>
          <dt>Levels</dt>
          <dd className="mono" title={levels.map((l) => LEVEL_NAMES[l]).join(", ")}>
            {lv}
          </dd>
        </div>
        <div>
          <dt>Kind</dt>
          <dd>{ARCHETYPES[node.archetype] ?? node.archetype}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            <span className="mono">{node.estMinutes}</span> min
          </dd>
        </div>
        <div>
          <dt>Check</dt>
          <dd>{node.gradeable ? "Graded" : "Not graded"}</dd>
        </div>
      </dl>

      {node.state === "locked" && node.lockReason && (
        <p className="starmap-lock">
          <LockGlyph />
          <span>{node.lockReason.message}</span>
        </p>
      )}
      {node.summary && <p className="starmap-summary">{node.summary}</p>}

      <h3 className="starmap-moons-title">
        Moons <span className="mono">({moons.length})</span>
      </h3>
      {moons.length > 0 ? (
        <ul className="starmap-moons">
          {moons.map((m) => (
            <li key={m.id}>
              <span className="mono">{m.id}</span>
              <span>{m.description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">No objectives are published for this stage yet.</p>
      )}

      <div className="starmap-actions">
        {enterTo ? (
          <WarpLink className="button hud-button button-primary" to={enterTo}>
            Enter journey
          </WarpLink>
        ) : blocking && byId.has(blocking) ? (
          <button type="button" className="button hud-button" onClick={() => onShow(blocking)}>
            <NumberedTitle text={`Show Stage ${blocking}`} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LockGlyph(): JSX.Element {
  return (
    <svg className="glyph" aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="7" width="11" height="7.5" rx="1" fill="currentColor" />
    </svg>
  );
}
