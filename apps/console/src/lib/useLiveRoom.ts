import { useCallback, useEffect, useState } from "react";
import { api, type LiveHealth, type LiveSnapshot } from "./api";
import { POLL_MS } from "./live-view";

/**
 * The room, read every `POLL_MS`, for `/live` and `/live/present`.
 *
 * ONE READ AT A TIME. The next read is scheduled only once the previous one
 * has settled. Until 29 Sep 2026 the page ran `setInterval` inside an effect
 * that depended on the snapshot itself, so every answer restarted the poll
 * and fired a read at once: 2,467 requests in 10 seconds, against a free-tier
 * API, for as long as the projector was up.
 *
 * IT DEGRADES QUIETLY. `PAGE-SPECS.md` §5 calls a hiccup in front of forty
 * students the worst failure mode in the app. A failed read keeps the last
 * good snapshot and marks it stale; it never blanks the projector.
 */
export function useLiveRoom(withHealth: boolean) {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [health, setHealth] = useState<LiveHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const read = async () => {
      try {
        const [s, h] = await Promise.all([
          api.live(),
          // The strip is secondary: a failed health read never stales the room.
          withHealth ? api.liveHealth().catch(() => null) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setSnap(s);
        if (h) setHealth(h);
        setStale(false);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setStale(true);
        setError(e instanceof Error ? e.message : "The server did not answer.");
      } finally {
        if (alive) timer = window.setTimeout(() => void read(), POLL_MS);
      }
    };
    void read();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [withHealth, tick]);

  /** Read now (after Start, End or Try again), and restart the cadence from here. */
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { snap, setSnap, health, error, stale, refresh };
}
