import { useCallback, useEffect, useState } from "react";

/**
 * Load-once-and-refresh, with the three states a page actually has.
 *
 * Not a data-fetching library. The console has nine read endpoints and no cache
 * invalidation problem worth a dependency; `apps/console/CLAUDE.md` already
 * limits the libraries this app may carry, and adding one for nine GETs would
 * be a poor trade.
 */
export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's
  const run = useCallback(fn, deps);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    run()
      .then((d) => { if (live) setData(d); })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [run, tick]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
