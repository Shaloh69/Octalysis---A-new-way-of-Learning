import { useEffect, useState } from "react";
import { isSmallPortrait } from "./SolarBackdrop";

/**
 * "Turn your phone" — the invitation onto the 3D map on a small screen.
 *
 * WHY THIS ASKS RATHER THAN FORCES. The web cannot force orientation:
 * `screen.orientation.lock()` only works inside fullscreen, is unsupported on
 * iOS Safari entirely, and throws on desktop. A component that claimed to force
 * landscape would be a component that silently does nothing on half the devices
 * it targets. So this asks, and the flat map stays right there for anyone who
 * would rather not turn.
 *
 * WHAT CHANGED IN THE LADDER, and what deliberately did not. Rung 2 used to be
 * "viewport ≤640px → flat, full stop", which locked every phone out of the map
 * permanently. The reason behind that rule was the ASPECT, not the hardware — a
 * solar system in a 380×844 column is a thin strip. Landscape fixes the aspect.
 *
 * Everything protecting the *device* is untouched: the frame-rate guard still
 * drops a phone that cannot hold 30fps and remembers it, Save-Data still opts
 * out, and `prefers-reduced-motion` still wins outright. This widens one rung
 * on the grounds it was actually written for; it does not weaken the net.
 *
 * DISMISSIBLE, AND IT STAYS DISMISSED. A student who wants the flat map on
 * their phone should be asked once, not on every visit.
 */

const DISMISSED = "octa:rotate-prompt-dismissed";

export function RotatePrompt(): JSX.Element | null {
  const [portrait, setPortrait] = useState(isSmallPortrait);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const recheck = (): void => setPortrait(isSmallPortrait());
    window.addEventListener("resize", recheck);
    window.addEventListener("orientationchange", recheck);
    return () => {
      window.removeEventListener("resize", recheck);
      window.removeEventListener("orientationchange", recheck);
    };
  }, []);

  if (!portrait || dismissed) return null;

  return (
    <aside className="rotate-prompt" role="note">
      {/*
        The phone outline turns, once and then rests. Not a loop: a looping
        animation in the corner is noise by the second visit, and this is a
        hint, not an alert. Frozen entirely under reduced motion.
      */}
      <span className="rotate-prompt-icon" aria-hidden="true">
        <span className="rotate-prompt-phone" />
      </span>

      <span className="rotate-prompt-text">
        <strong>Turn your phone sideways</strong> to explore the solar system.
        The flat map below works either way.
      </span>

      <button
        type="button"
        className="rotate-prompt-dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISSED, "1");
          } catch {
            /* private window; it will ask again next time, which is acceptable */
          }
        }}
      >
        Not now
      </button>
    </aside>
  );
}
