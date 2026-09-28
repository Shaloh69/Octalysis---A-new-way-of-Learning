import { useEffect, useState } from "react";

/**
 * True once `on` has stayed true for `ms`. The loading rule in
 * `.claude/rules/design.md`: nothing under ~400ms (a flash of skeleton is
 * worse than a still frame), a skeleton after, and words after ~3s, because
 * Render's free tier can take ~50s to wake.
 */
export function useDelayed(on: boolean, ms: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!on) {
      setPast(false);
      return;
    }
    const t = window.setTimeout(() => setPast(true), ms);
    return () => window.clearTimeout(t);
  }, [on, ms]);
  return on && past;
}
