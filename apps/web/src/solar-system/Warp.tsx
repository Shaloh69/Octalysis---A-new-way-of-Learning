import { useEffect, useRef, useState } from "react";

/**
 * Hub loading — the warp.
 *
 * `BIOME-AND-LOADING-SPEC.md` §4.1, as revised for the full-page backdrop: this
 * is **a state the star field already on screen moves through**, not an overlay
 * that covers the page. The field is behind every route already; a warp is that
 * field accelerating and then settling back into its ambient drift.
 *
 * The spec's own table says the same thing — "animate its camera z-position/FOV
 * between idle and loading states rather than standing up a second star field"
 * — and the backdrop makes it the only sensible reading. A second WebGL scene
 * on top of the first would cost a context to show the student something they
 * can already see.
 *
 * WHERE IT FIRES: hub-level navigation, between routes that both show the
 * backdrop. Never on the way into a content surface — that is §4.2's
 * biome-preview transition, and the two firing together would be two loading
 * animations for one navigation.
 *
 * REDUCED MOTION: skipped entirely, straight to the end state. Not slowed —
 * skipped, same as every other animated moment in this project.
 *
 * The warp is expressed as a CSS class on the backdrop rather than as camera
 * code, so it costs nothing when idle and cannot itself become the reason a
 * page feels slow (§4.1's budget line).
 */

const WARP_MS = 620;

export function useHubWarp(pathname: string, active: boolean): boolean {
  const [warping, setWarping] = useState(false);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;

    // First paint is an arrival, not a navigation. Warping on it would greet
    // every student with an animation before they have done anything.
    if (from === null || from === pathname) return;
    if (!active) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // straight to the end state
    }

    setWarping(true);
    const timer = window.setTimeout(() => setWarping(false), WARP_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, active]);

  return warping;
}

/**
 * The flat map's warp — the same loading moment, without a canvas.
 *
 * `useHubWarp` above puts a class on the 3D backdrop and lets the WebGL star
 * field accelerate. The flat map has no backdrop to accelerate, so selecting a
 * planet there had nothing to carry the transition: the 3D layer flies the
 * camera in (`GAME-DESIGN.md` §3.2) and the flat layer simply jumped.
 *
 * It does NOT fake the zoom. Scaling the SVG up would be inventing a camera
 * this surface deliberately does not have, and it would put a big scaling
 * motion on the exact surface that reduced-motion students land on. Instead the
 * flat map borrows §4.1's warp: its own star layers streak briefly, the map
 * fades, and the stage opens on the other side.
 *
 * REDUCED MOTION SKIPS IT ENTIRELY — not slowed, skipped — and `run` is called
 * immediately. That is the same rule the hub warp follows, and it matters more
 * here: reduced motion is one of the reasons a student is on this map at all,
 * so an unskippable animation would be the rung contradicting itself.
 */
export function useFlatWarp(): { warping: boolean; warpThen: (run: () => void) => void } {
  const [warping, setWarping] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const warpThen = (run: () => void): void => {
    const reduced =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

    if (reduced) {
      run(); // straight to the end state
      return;
    }

    setWarping(true);
    timer.current = window.setTimeout(() => {
      setWarping(false);
      run();
    }, WARP_MS);
  };

  return { warping, warpThen };
}
