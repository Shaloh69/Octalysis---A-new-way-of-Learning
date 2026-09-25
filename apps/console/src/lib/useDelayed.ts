import { useEffect, useState } from "react";

/**
 * `true` only once `on` has held for `ms`.
 *
 * `.claude/rules/design.md`: anything over ~400ms gets a skeleton, and under
 * that nothing -- a flash of skeleton on a fast load is worse than a still
 * frame. Also used at ~3s, where a slow load (Render's free tier sleeps and
 * takes up to a minute to wake) starts saying so in words.
 */
export function useDelayed(on: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!on) {
      setElapsed(false);
      return;
    }
    const t = window.setTimeout(() => setElapsed(true), ms);
    return () => window.clearTimeout(t);
  }, [on, ms]);
  return on && elapsed;
}
