import { useEffect, useState, useCallback } from "react";
import { StageMap } from "./components/StageMap";
import { StageReader } from "./components/StageReader";
import { ProgressGrid } from "./components/ProgressGrid";
import { RegisterBar } from "./components/RegisterBar";
import { DepthGauge } from "./components/DepthGauge";
import { api, ApiError, type StageMapData, type ProgressGrid as Grid } from "./lib/api";

type View = { name: "map" } | { name: "stage"; id: string } | { name: "progress" };

/**
 * Six states, every surface (DESIGN-MANDATE §5.1): loading, empty, locked,
 * error, offline, saving. The three that apply to a read-only view are here;
 * `locked` is the stage reader's job and `saving` belongs to the attempt runner.
 */
export default function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: "map" });
  const [map, setMap] = useState<StageMapData | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, g] = await Promise.all([api.stages(), api.progress()]);
      setMap(m);
      setGrid(g);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Check your connection and try again.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openStage = useCallback((id: string) => {
    setView({ name: "stage", id });
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <RegisterBar />

      {offline && (
        <div className="banner banner-offline" role="status">
          You are offline. Anything you have answered is saved locally and will send when you
          reconnect.
        </div>
      )}

      <div className="app-body">
        <DepthGauge depth={grid?.depth ?? 6} revealed={(map?.nodes.find((n) => n.id === "11")?.state ?? "locked") !== "locked"} />

        <main id="main" className="app-main">
          <nav className="app-nav" aria-label="Main">
            <button
              type="button"
              onClick={() => setView({ name: "map" })}
              aria-current={view.name === "map" ? "page" : undefined}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setView({ name: "progress" })}
              aria-current={view.name === "progress" ? "page" : undefined}
            >
              Progress
            </button>
          </nav>

          {error && (
            <div className="state state-error" role="alert">
              <h2>That did not load</h2>
              <p>{error}</p>
              <button type="button" onClick={() => void load()}>
                Try again
              </button>
            </div>
          )}

          {!error && !map && <MapSkeleton />}

          {!error && map && view.name === "map" && <StageMap data={map} onOpen={openStage} />}

          {!error && map && view.name === "stage" && (
            <StageReader
              stageId={view.id}
              onBack={() => setView({ name: "map" })}
              onProgressChanged={() => void load()}
            />
          )}

          {!error && grid && view.name === "progress" && <ProgressGrid data={grid} />}
        </main>
      </div>
    </div>
  );
}

/** A skeleton, not a spinner: it shows the SHAPE of what is coming. */
function MapSkeleton(): JSX.Element {
  return (
    <div className="state state-loading" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the stage map</span>
      <div className="skel skel-title" />
      <div className="skel-row">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skel skel-node" />
        ))}
      </div>
      <div className="skel-row">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skel skel-node" />
        ))}
      </div>
    </div>
  );
}
