import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { StageMapData } from "../lib/api";
import { computeSolarLayout } from "../solar-system/layout";
import { useCosmetics } from "../solar-system/cosmetic-seed";
import { nextStage } from "../lib/next-stage";
import { NumberedTitle } from "../shell/MissionPanel";
import { useKeyHints } from "../shell/keyHints";
import { byObjectiveId, useSelection } from "./useSelection";
import { ACTS, BodyPanel, MoonPanel, moonGlow, STATE_WORD, useWide } from "./body";
import type { ScenePlanet } from "./StarMapScene";
import { alienLine } from "../solar-system/alien";
import { IDLE_RESET_MS, homeControl, pinchFactor, tiltBy, wheelFactor, type ViewControl } from "./view";

const StarMapScene = lazy(() => import("./StarMapScene"));

/**
 * `/app`: the 3D map, and the ONLY map (ruling 2, 30 Sep 2026). Starfield's
 * system map (`_direction/star/starfield-map.png`):
 *
 *   the scene        the solar system, filling the screen (StarMapScene)
 *   SYSTEM panel     the course, its mastery, the next stage, and the ROW OF
 *                    BODIES: one radio per planet, grouped by act. This is the
 *                    ACCESSIBLE LAYER (VISUAL-SYSTEM-3D.md §5): a keyboard or
 *                    a screen reader chooses a planet here, and it is the same
 *                    action as a click. Shown ONLY while no planet is chosen
 *                    (instructor, 1 Oct 2026); Close brings it back with focus
 *                    on the planet just left
 *   BODY panel       the selected planet: its name, mastery, a stat table,
 *                    its moons (objectives), the lock's reason verbatim, and
 *                    Enter journey; a bottom sheet on a phone. While it is
 *                    open, Left and Right step to the neighbouring planet
 *   name             the chosen planet's (or moon's) name, at the bottom of
 *                    the free area (instructor, 1 Oct 2026)
 *   key hints        Enter journey, Close, Stages, Reset view
 *
 * The selection is `?stage=NN` (useSelection). Without WebGL the scene is not
 * drawn and a line says so; the panels, and so every control, remain.
 */

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

export function StarMap({ data }: { data: StageMapData }): JSX.Element {
  const nav = useNavigate();
  const { cosmetics } = useCosmetics();
  const { selected, moon, open, openMoon, close } = useSelection();
  const reduced = useReducedMotion();
  const wide = useWide(900);
  const webgl = useMemo(detectWebGL, []);
  const [slow, setSlow] = useState(rememberedSlow);
  const saveData = typeof navigator !== "undefined" && !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

  const yaw = useRef(0);
  const dragged = useRef(false);
  const view = useRef<ViewControl>(homeControl());
  /*
   * The easter egg (instructor, 5 Oct 2026; solar-system/alien.ts): a saucer
   * that sometimes rides a comet's orbit through the system. Clicking it
   * focuses the camera on it and it says the next of its four lines, in a
   * bubble that follows it (a live region, so a screen reader hears it too).
   * `?alien=now` brings it in at once. Escape, a click on empty space, or
   * choosing a planet lets it go.
   */
  const alienNow = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("alien") === "now";
  const alienAnchor = useRef<HTMLDivElement | null>(null);
  const [alien, setAlien] = useState<{ focused: boolean; clicks: number; line: string | null }>({ focused: false, clicks: 0, line: null });
  const letAlienGo = useCallback(() => setAlien((a) => (a.focused || a.line ? { ...a, focused: false, line: null } : a)), []);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const travel = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** Whether the student has moved the view (`data-view`), and the timer that brings it home. */
  const [looking, setLooking] = useState(false);
  const idle = useRef<number | null>(null);
  const goHome = useCallback((turnBack = true) => {
    view.current = homeControl();
    if (turnBack) yaw.current = 0;
    setLooking(false);
    if (idle.current !== null) window.clearTimeout(idle.current);
    idle.current = null;
  }, []);
  /** Any input: the view is the student's for another thirty seconds. */
  const touched = useCallback(() => {
    setLooking(true);
    if (idle.current !== null) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => goHome(), IDLE_RESET_MS);
  }, [goHome]);
  useEffect(() => () => {
    if (idle.current !== null) window.clearTimeout(idle.current);
  }, []);
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
    // A gradeable planet's moons, in the syllabus's order, each in its state.
    // Orientation has none (3.10): its belt is cosmetic and drawn by the scene.
    moons: n.moons ? [...n.objectives].sort(byObjectiveId).map((o) => ({ id: o.id, glow: moonGlow(o) })) : [],
    asteroids: !n.gradeable,
    ring: layout.bodies.get(n.id)?.ring ?? 6,
    spoke: !!layout.bodies.get(n.id)?.spansAllLevels,
  }));
  const next = nextStage(nodes);
  const nextId = next.kind === "resume" || next.kind === "start" ? next.node.id : null;
  const graded = nodes.filter((n) => n.gradeable);
  const survey = graded.length ? graded.reduce((s, n) => s + n.mastery, 0) / graded.length : 0;
  const sel = selected ? byId.get(selected) ?? null : null;
  const selMoon = sel && moon && sel.moons ? sel.objectives.find((o) => o.id === moon) ?? null : null;
  const acts = [...new Set(nodes.map((n) => n.act))].sort();

  // The row hides while a planet is chosen, so focus goes to the body panel's
  // heading on every choice; on Close it returns to the planet just left, in
  // the row that has come back.
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    const was = lastSel.current;
    lastSel.current = sel?.id ?? null;
    if (sel) heading.current?.focus();
    else if (was) systemRef.current?.querySelector<HTMLInputElement>(`input[data-planet="${was}"]`)?.focus();
  }, [sel]);
  // Left and Right step through the planets while one is open, as the row's
  // arrow keys did (the row itself is hidden then). Never inside a field, and
  // never while a moon is open (its panel belongs to its planet).
  useEffect(() => {
    if (!sel || selMoon) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const i = nodes.findIndex((n) => n.id === sel.id);
      const to = nodes[(i + (e.key === "ArrowRight" ? 1 : nodes.length - 1)) % nodes.length];
      if (!to) return;
      e.preventDefault();
      open(to.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, selMoon, nodes, open]);
  // A moon replaces the panel in place (3.2); focus follows to its heading, and
  // back to the planet's when the student steps out (3.3).
  const moonShown = useRef<string | null>(null);
  useEffect(() => {
    const now = selMoon?.id ?? null;
    if (now !== moonShown.current && sel) heading.current?.focus();
    moonShown.current = now;
  }, [selMoon, sel]);

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
      // The system panel is hidden while a planet is chosen: a zero box.
      const sysBox = systemRef.current?.getBoundingClientRect();
      const sys = sysBox && sysBox.height > 0 ? sysBox : null;
      const panels = systemRef.current?.parentElement?.getBoundingClientRect();
      const body = bodyRef.current?.getBoundingClientRect();
      const nav = document.querySelector(".star-nav")?.getBoundingClientRect();
      const navAtBottom = !!nav && nav.top > H / 2;
      let next: { x: number; y: number; w: number; h: number };
      if (W >= 900) {
        const left = Math.max(sys?.right ?? 0, body?.right ?? 0) + 16;
        const top = (nav && !navAtBottom ? nav.bottom : 0) + 8;
        next = { x: left, y: top, w: Math.max(80, W - left - 16), h: Math.max(80, H - top - 72) };
        setBodyMax(body ? Math.max(200, H - body.top - 16) : null);
      } else {
        const top = (sys?.bottom ?? panels?.top ?? 0) + 8;
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

  const planetEnter = sel && sel.state !== "locked" ? `/app/stage/${sel.id}` : null;
  // A moon's journey: its planet open and a question to practise (3.7a).
  const moonJourney =
    sel && selMoon && sel.state !== "locked" && (selMoon.questions > 0 || selMoon.mastered)
      ? `/app/stage/${sel.id}/moon/${selMoon.id}`
      : null;
  // A GRADED moon's main way in is its CHECK (docs/GRADED-MOONS-PLAN.md, instructor 8 Oct 2026:
  // "when entering moons, instead of auto checks it defaults to [practice]"): a paper, behind
  // its start prompt. Practice is still there, one step lower. It needs a live question.
  const moonCheckTo =
    sel && selMoon && selMoon.graded && sel.state !== "locked" && selMoon.questions > 0
      ? `/app/stage/${sel.id}/moon/${selMoon.id}/check`
      : null;
  const moonEnter = selMoon?.graded ? moonCheckTo : moonJourney;
  const enterTo = selMoon ? moonEnter : planetEnter;
  useKeyHints("map", [
    ...(enterTo
      ? [{ key: "Enter", cap: "Enter", label: selMoon?.graded ? "Sit the check" : "Enter journey", run: () => nav(enterTo) }]
      : []),
    ...(sel ? [{ key: "Escape", cap: "Esc", label: "Close", run: close }] : alien.focused ? [{ key: "Escape", cap: "Esc", label: "Close", run: letAlienGo }] : []),
    { key: "s", cap: "S", label: "Stages", run: () => nav("/app/stages") },
    ...(webgl
      ? [
          { key: "+", cap: "+", label: "Zoom in", run: () => zoomKey(0.8) },
          { key: "-", cap: "−", label: "Zoom out", run: () => zoomKey(1.25) },
        ]
      : []),
    {
      key: "r",
      cap: "R",
      label: "Reset view",
      run: () => {
        goHome();
        close();
      },
    },
  ]);

  /** A key's zoom aims at the middle of the free area. */
  const zoomKey = (f: number) => {
    const fr = frame ?? { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    view.current.zoomAt.push({ f, x: fr.x + fr.w / 2, y: fr.y + fr.h / 2 });
    touched();
  };
  // "=" is "+" without Shift on most keyboards; key hints match one key each.
  useEffect(() => {
    if (!webgl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "=" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t instanceof HTMLInputElement && !/^(radio|checkbox)$/.test(t.type)))) return;
      e.preventDefault();
      zoomKey(0.8);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // The wheel zooms toward the pointer; never the page (a non-passive listener).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !webgl) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      view.current.zoomAt.push({ f: wheelFactor(e.deltaY), x: e.clientX, y: e.clientY });
      touched();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [webgl, touched]);
  // A planet or moon chosen (or let go) frames itself afresh: the zoom, tilt and
  // pan were relative to what was framed before. The turn is kept.
  useEffect(() => {
    goHome(false);
    if (selected) letAlienGo();
  }, [selected, moon, goHome, letAlienGo]);

  /*
   * Looking around (instructor, 5 Oct 2026; map/view.ts). One finger or the
   * left button turns the system and tilts it; two fingers pinch to zoom and
   * move together to pan; the right button or Shift pans; the wheel zooms
   * toward the pointer. Every gesture marks a drag, so the click that ends it
   * chooses nothing.
   */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    travel.current = 0;
    dragged.current = false;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const was = pointers.current.get(e.pointerId);
    if (!was || (e.pointerType === "mouse" && e.buttons === 0)) return;
    const at = { x: e.clientX, y: e.clientY };
    const dx = at.x - was.x;
    const dy = at.y - was.y;
    const vc = view.current;
    const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
    if (other) {
      // Two fingers: the pinch zooms toward their midpoint, the midpoint pans.
      const f = pinchFactor(Math.hypot(was.x - other.x, was.y - other.y), Math.hypot(at.x - other.x, at.y - other.y));
      vc.zoomAt.push({ f, x: (at.x + other.x) / 2, y: (at.y + other.y) / 2 });
      vc.panPx.dx += dx / 2;
      vc.panPx.dy += dy / 2;
    } else if (e.shiftKey || (e.buttons & 6) !== 0) {
      vc.panPx.dx += dx;
      vc.panPx.dy += dy;
    } else {
      yaw.current -= dx * 0.006;
      vc.view = tiltBy(vc.view, dy * 0.004);
    }
    pointers.current.set(e.pointerId, at);
    travel.current += Math.abs(dx) + Math.abs(dy);
    if (travel.current > 6) dragged.current = true;
    touched();
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
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
        ref={stageRef}
        className="starmap-stage"
        data-view={looking ? "looking" : "home"}
        onContextMenu={(e) => e.preventDefault()}
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
              selectedMoon={selMoon?.id ?? null}
              next={nextId}
              rotation={cosmetics.rotationOffset}
              reduced={reduced}
              lowQuality={slow || saveData}
              yaw={yaw}
              view={view}
              dragged={dragged}
              frame={frame}
              onSelect={open}
              onSelectMoon={openMoon}
              onMiss={() => {
                letAlienGo();
                close();
              }}
              alien={{
                now: alienNow,
                focused: alien.focused,
                anchor: alienAnchor,
                onClick: () => {
                  if (dragged.current) return;
                  if (selected) close();
                  setAlien((a) => ({ focused: true, clicks: a.clicks + 1, line: alienLine(a.clicks) }));
                  touched();
                },
              }}
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
        {/* The alien's speech bubble, wherever the saucer is on screen (Saucer.tsx moves it). */}
        <div ref={alienAnchor} className="starmap-alien" data-alien="away">
          <p className="starmap-bubble" role="status" aria-live="polite" hidden={!alien.line}>
            {alien.line}
          </p>
        </div>
        {/* The chosen body's name, at the bottom of the free area. The panel's
            heading says it to a screen reader; this is for the eye. */}
        {sel && frame && (
          <span
            key={selMoon?.id ?? sel.id}
            className="starmap-tag"
            aria-hidden="true"
            style={{ left: `${frame.x + frame.w / 2}px`, top: `${frame.y + frame.h}px`, maxWidth: `${Math.max(120, frame.w - 32)}px` }}
          >
            {selMoon ? `Moon ${selMoon.id}` : sel.title}
          </span>
        )}
      </div>

      <div className="starmap-panels">
        <section ref={systemRef} className="hud-panel starmap-system" aria-labelledby="starmap-title" hidden={!!sel}>
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
                          data-planet={n.id}
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
                  {selMoon ? <NumberedTitle text={`Moon ${selMoon.id}`} /> : sel.title}
                </h2>
                <p className="starmap-body-sub">
                  {selMoon ? (
                    <NumberedTitle text={`Circles Stage ${sel.id} · ${sel.title}`} />
                  ) : (
                    <NumberedTitle text={`Stage ${sel.id} · ${ACTS[sel.act]?.name ?? `Act ${sel.act}`}`} />
                  )}
                </p>
              </div>
              <button type="button" className="dialog-close" aria-label="Close" onClick={close}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {selMoon ? (
              <MoonPanel node={sel} moon={selMoon} enterTo={moonEnter} practiceTo={selMoon.graded ? moonJourney : null} onBack={close} />
            ) : (
              <BodyPanel node={sel} byId={byId} onShow={open} onMoon={openMoon} enterTo={planetEnter} />
            )}
          </section>
        )}
      </div>
    </section>
  );
}
