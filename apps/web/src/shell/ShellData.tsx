import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, type ProgressGrid, type StageMapData } from "../lib/api";

/**
 * The map and the progress grid, fetched ONCE for the whole signed-in app.
 *
 * The shell needs both for its own chrome (the mission panel names the next
 * stage; the depth meter reads the grid), and the map page, the stages list and
 * the progress page need the same two documents. One fetch, shared, instead of
 * each piece asking again. `reload()` is how a page that changed progress (a
 * submitted check) asks for fresh numbers.
 */
interface ShellData {
  map: StageMapData | null;
  grid: ProgressGrid | null;
  error: string | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<ShellData>({ map: null, grid: null, error: null, reload: async () => {} });

export function ShellDataProvider({ children }: { children: ReactNode }): JSX.Element {
  const [map, setMap] = useState<StageMapData | null>(null);
  const [grid, setGrid] = useState<ProgressGrid | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [m, g] = await Promise.all([api.stages(), api.progress()]);
      setMap(m);
      setGrid(g);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not reach the server. Check your connection and try again.",
      );
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ map, grid, error, reload }}>{children}</Ctx.Provider>;
}

export function useShellData(): ShellData {
  return useContext(Ctx);
}
