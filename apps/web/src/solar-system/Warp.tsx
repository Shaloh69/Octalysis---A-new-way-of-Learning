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
