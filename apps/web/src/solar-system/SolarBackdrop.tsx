import { createContext, useContext, useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { computeSolarLayout, type SolarLayout } from "./layout";
import { useCosmetics } from "./cosmetic-seed";
import type { StageMapData } from "../lib/api";
import type { ScreenPoint } from "./SolarSystemCanvas";
import { useHubWarp } from "./Warp";

const SolarSystemCanvas = lazy(() => import("./SolarSystemCanvas"));

/**
 * The solar system as the app's background.
 *
 * It used to live inside `/app`'s own layout box. It is now a fixed,
 * full-viewport backdrop owned by `AppShell`, so the same system sits behind
 * the map, progress, settings and submissions — one continuous place rather
 * than a picture that appears on one screen and vanishes on the next.
 *
 * WHERE IT DELIBERATELY DOES NOT GO. Content surfaces opt out: the stage
 * reader, the attempt runner, the labs and the games. Two reasons, and the
 * second is the one that matters:
 *
 *   1. Those surfaces carry their own theatre. A stage's LAB beat wears its
 *      encounter theme (`GAME-DESIGN.md` §9) and a landing wears its biome;
 *      a starfield behind both is a third visual system competing with them.
 *   2. **The Self-Test is never themed.** `DESIGN-MANDATE.md` §1B rule 1:
 *      theatre dresses the practice, never the assessment. A drifting star
 *      field behind a graded question is exactly the decoration that rule
 *      exists to keep out — and it would be motion behind an assessment,
 *      which is worse than decoration.
 *
 * It is `aria-hidden` and `pointer-events: none`. A `<canvas>` has no
 * accessibility semantics; everything that means anything is DOM on top.
 */

interface SolarContextValue {
  /** Screen positions per stage, written each frame by the canvas. */
  readonly projection: React.MutableRefObject<Map<string, ScreenPoint>>;
  readonly layout: SolarLayout | null;
  /** Which planet the camera is flying to, or null to drift. */
  readonly focusId: string | null;
  readonly setFocusId: (id: string | null) => void;
  /** Selected moon within the focused planet, highlighted in the scene. */
  readonly selectedMoon: string | null;
  readonly setSelectedMoon: (objectiveId: string | null) => void;
  /** Whether the prerequisite traces between planets are drawn. */
  readonly showPath: boolean;
  readonly togglePath: () => void;
  /** False on content surfaces, where the backdrop is deliberately absent. */
  readonly active: boolean;
  /**
   * Whether the scene is actually drawing: `active` AND the device can take it.
   *
   * This is the degradation ladder's answer, and it lives here because the
   * canvas does. When the scene moved from `/app`'s own layout to the app
   * shell, the ladder briefly stayed behind in `StageMap` — so the backdrop
   * rendered a canvas under reduced motion and for a device already recorded
   * as too slow. Two specs caught it. One owner for the ladder, and this is it.
   */
  readonly enabled: boolean;
  /** Student's explicit choice, which overrides the default in both directions. */
  readonly setPreference: (mode: "2d" | "3d") => void;
}

/**
 * `VISUAL-SYSTEM-3D.md` §5's degradation ladder, in one place.
 *
 * Applied in order, without asking and without an error state. Rungs 1-3 are
 * capability checks answerable before rendering; 4 is the remembered verdict of
 * the frame-rate guard; 5 is Save-Data.
 */
/**
 * Is this a small screen held in portrait?
 *
 * Rung 2 used to be "viewport <= 640px -> flat, full stop", which locked every
 * phone out of the 3D map permanently. The reason for that rule was never the
 * device — it was the ASPECT: a solar system in a 380x844 column is a thin
 * strip with no room for orbits.
 *
 * Landscape solves that, and the rest of the ladder still protects the device:
 * the frame-rate guard (rung 4) drops a phone that genuinely cannot hold 30fps,
 * Save-Data still opts out, and reduced motion still wins outright. So a phone
 * in landscape gets the map, and a phone in portrait gets asked to turn.
 */
export function isSmallPortrait(): boolean {
  if (typeof window === "undefined") return false;
  const small = Math.min(window.innerWidth, window.innerHeight) <= 640;
  return small && window.innerHeight >= window.innerWidth;
}

function ladderAllows(): boolean {
  if (typeof window === "undefined") return false;
  // 1 - reduced motion
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  // 2 - small screen IN PORTRAIT. Landscape is allowed: see isSmallPortrait.
  if (isSmallPortrait()) return false;
  // 5 - Save-Data: a student who asked their phone to use less data has also,
  // in effect, asked it to do less work.
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  try {
    // 4 - a device already measured below 30fps
    if (localStorage.getItem("octa:map-too-slow") === "1") return false;
    // The student's own preference is the last word, in both directions.
    return localStorage.getItem("octa:map-mode") !== "2d";
  } catch {
    return true; // private window: nothing remembered, default holds
  }
}

const SolarContext = createContext<SolarContextValue | null>(null);

export function useSolar(): SolarContextValue {
  const ctx = useContext(SolarContext);
  if (!ctx) {
    // A component reaching for the backdrop outside it is a wiring mistake, and
    // a silent no-op would hide it until someone noticed the map was dead.
    throw new Error("useSolar() must be used inside <SolarProvider>");
  }
  return ctx;
}

export function SolarProvider({
  data,
  active,
  pathname,
  children,
}: {
  data: StageMapData | null;
  active: boolean;
  /** Current route, so hub-level navigation can trigger the warp (§4.1). */
  pathname: string;
  children: ReactNode;
}): JSX.Element {
  const projection = useRef<Map<string, ScreenPoint>>(new Map());
  const [focusId, setFocusIdRaw] = useState<string | null>(null);
  const [selectedMoon, setSelectedMoon] = useState<string | null>(null);

  // Changing planet clears the moon selection: a highlight left pointing at a
  // body that is no longer on screen is worse than none.
  const setFocusId = (id: string | null): void => {
    setFocusIdRaw(id);
    setSelectedMoon(null);
  };

  /*
   * The prerequisite traces are OFF by default.
   *
   * They are 18 lines across a field that already carries rings, planets, moons
   * and a flight path, and they answer a question a student asks occasionally
   * ("what leads to what") rather than continuously. The design mandate's
   * fourth test is the strict one — the toggle changes what you can SEE, it is
   * legible, it is instantly reversible, and it is a real preference rather
   * than a number. It passes.
   */
  const [showPath, setShowPath] = useState(false);

  // Re-evaluated on resize, so crossing the 640px boundary takes effect without
  // a reload -- the ladder is about the device as it is now.
  const [allowed, setAllowed] = useState(ladderAllows);
  useEffect(() => {
    const recheck = (): void => setAllowed(ladderAllows());
    window.addEventListener("resize", recheck);
    // Rotating a phone fires `orientationchange` before `resize` settles on
    // some Androids, so both are watched -- otherwise turning the device leaves
    // the student on the flat map until something else nudges a re-render.
    window.addEventListener("orientationchange", recheck);
    return () => {
      window.removeEventListener("resize", recheck);
      window.removeEventListener("orientationchange", recheck);
    };
  }, []);

  // §4.1 — the star field accelerating between hub routes, not an overlay.
  const warping = useHubWarp(pathname, active);

  const { cosmetics } = useCosmetics();

  const layout = useMemo(() => {
    if (!data) return null;
    return computeSolarLayout(
      data.nodes,
      data.nodes.flatMap((n) =>
        n.objectives.map((o) => ({ id: o.id, stageId: n.id, level: o.level })),
      ),
      // Cosmetic seed, used for one thing: which moons preview at overview
      // scale. It cannot reach a radius or an angle -- asserted in
      // layout-solar.spec.ts.
      Math.round(cosmetics.rotationOffset * 1000),
    );
  }, [data, cosmetics.rotationOffset]);

  const value = useMemo<SolarContextValue>(
    () => ({
      projection,
      layout,
      focusId,
      setFocusId,
      selectedMoon,
      setSelectedMoon,
      showPath,
      togglePath: () => setShowPath((v) => !v),
      active,
      enabled: active && allowed,
      setPreference: (mode) => {
        try {
          localStorage.setItem("octa:map-mode", mode);
        } catch {
          /* private window; the preference just does not persist */
        }
        setAllowed(mode === "3d" ? ladderAllows() : false);
      },
    }),
    [layout, focusId, selectedMoon, showPath, active, allowed],
  );

  // Stage 11 names the rings. Server-derived, like every other state here --
  // the client renders the reveal, it does not decide it.
  const ringsNamed =
    (data?.nodes.find((n) => n.id === "11")?.state ?? "locked") === "mastered";

  return (
    <SolarContext.Provider value={value}>
      {active && allowed && data && layout && (
        <div
          className={`solar-backdrop${warping ? " is-warping" : ""}`}
          aria-hidden="true"
        >
          <Suspense fallback={null}>
            <SolarSystemCanvas
              nodes={data.nodes}
              layout={layout}
              ringsNamed={ringsNamed}
              frozen={false}
              rotationOffset={cosmetics.rotationOffset}
              paletteVariant={cosmetics.paletteVariant}
              projection={projection}
              focusId={focusId}
              selectedMoon={selectedMoon}
              showPath={showPath}
              biome={cosmetics.biomes[cosmetics.biomeIndex] ?? null}
              onTooSlow={() => {
                // Ladder rung 4. Drop to flat, in place, remember it for this
                // device -- "without asking and without an error state".
                try {
                  localStorage.setItem("octa:map-too-slow", "1");
                } catch {
                  /* private window; it re-measures next time */
                }
                setAllowed(false);
              }}
            />
          </Suspense>
        </div>
      )}
      {children}
    </SolarContext.Provider>
  );
}
