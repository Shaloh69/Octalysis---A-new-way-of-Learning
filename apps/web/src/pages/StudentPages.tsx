import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, type StageMapData, type ProgressGrid as Grid } from "../lib/api";
import { StageMap } from "../components/StageMap";
import { StageReader } from "../components/StageReader";
import { ProgressGrid } from "../components/ProgressGrid";
import { AttemptRunner } from "../components/AttemptRunner";

/**
 * The student's routes.
 *
 * `/app` and `/app/map` are the same component with a different `flat` prop,
 * and that is a deliberate correction to what the documents used to say.
 *
 * `CLAUDE.md` described two routes where `/app` was a 3D galaxy and `/app/map`
 * a flat fallback that reduced motion, absent WebGL and small viewports would
 * "redirect to". That design has a hole: a redirect means a student on a phone
 * gets a DIFFERENT URL from the one their classmate shares, and a link into the
 * course stops being a link into the course.
 *
 * What is built instead: **the accessible SVG layer is canonical on both
 * routes**, and the WebGL galaxy is a decorative layer behind it — `aria-hidden`,
 * `pointer-events: none`, absent under reduced motion or a small viewport, and
 * silently absent when WebGL fails. `/app/map` is the same page with the canvas
 * suppressed by choice rather than by capability.
 *
 * So nothing ever redirects, every URL works everywhere, and the flat view is
 * never a degraded mode — which is what the document was protecting in the
 * first place.
 */

/* ------------------------------------------------------------------ hooks */

function useMap() {
  const [map, setMap] = useState<StageMapData | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return { map, grid, error, reload: load };
}

/* ------------------------------------------------------------------ pages */

export function MapPage({ flat = false }: { flat?: boolean }): JSX.Element {
  const { map, error, reload } = useMap();
  const nav = useNavigate();

  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!map) return <MapSkeleton />;

  return (
    <>
      <StageMap data={map} flat={flat} onOpen={(id) => nav(`/app/stage/${id}`)} />
      <p className="map-alt-link">
        {flat ? (
          <Link to="/app">Show the galaxy</Link>
        ) : (
          <Link to="/app/map">Show the flat map</Link>
        )}
      </p>
    </>
  );
}

export function StagePage(): JSX.Element {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { reload } = useMap();

  return (
    <StageReader
      stageId={id}
      onBack={() => nav("/app")}
      onProgressChanged={() => void reload()}
      onStartCheck={(assessmentId, title) =>
        nav(`/app/stage/${id}/check?a=${encodeURIComponent(assessmentId)}&t=${encodeURIComponent(title)}`)
      }
    />
  );
}

export function CheckPage(): JSX.Element {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const assessmentId = params.get("a");
  const title = params.get("t") ?? "Stage check";

  if (!assessmentId) {
    return (
      <ErrorState
        message="This link is missing which assessment to open. Go back to the stage and start it from there."
        onRetry={() => nav(`/app/stage/${id}`)}
        retryLabel="Back to the stage"
      />
    );
  }

  return (
    <AttemptRunner
      assessmentId={assessmentId}
      title={title}
      onFinished={() => {}}
      onLeave={() => nav(`/app/stage/${id}`)}
    />
  );
}

export function ProgressPage(): JSX.Element {
  const { grid, error, reload } = useMap();
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!grid) return <MapSkeleton />;
  return <ProgressGrid data={grid} />;
}

/* ---------------------------------------------------------------- states */

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}): JSX.Element {
  return (
    <div className="state state-error" role="alert">
      <h2>That did not load</h2>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}

/** A skeleton, not a spinner: it shows the SHAPE of what is coming. */
export function MapSkeleton(): JSX.Element {
  return (
    <div className="state state-loading" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
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

export function NotFoundPage(): JSX.Element {
  return (
    <main className="state state-error">
      {/*
        An `h1`, not an `h2`. `DESIGN-MANDATE-V2.md` §5 requires exactly one h1
        and a `main` on every page, and this had neither — a 404 is a page in
        its own right, not a fragment of one, so a screen reader arriving here
        was given a document with no title at any level.

        It went unnoticed because `r3-gate.spec.ts` ran the mechanical five on
        ten routes and the catch-all was not among them. The gate has been
        checking every route it knew about, which is not the same thing.
      */}
      <h1>There is nothing at this address</h1>
      <p>The link may be old, or mistyped.</p>
      <Link to="/app">Back to the map</Link>
    </main>
  );
}

/**
 * `/maintenance`.
 *
 * A real page rather than a default host error, because the free tier will
 * eventually show it: Supabase pauses after seven days idle and Render sleeps
 * after fifteen minutes. A student who hits either deserves to be told which
 * one, and roughly how long.
 */
export function MaintenancePage(): JSX.Element {
  return (
    <main className="auth-page" id="main">
      <div className="boot boot-ready">
        <div className="boot-frame" aria-hidden="true">
          <span className="boot-corner boot-corner-tl" />
          <span className="boot-corner boot-corner-tr" />
          <span className="boot-corner boot-corner-bl" />
          <span className="boot-corner boot-corner-br" />
        </div>
        <div className="boot-inner">
          <p className="boot-eyebrow mono">OCTA · HALTED</p>
          <h1 className="boot-title">Back shortly</h1>
          <p className="boot-sub">
            The system is being worked on. Nothing you have submitted is affected — answers are
            saved as you give them, and the record is append-only.
          </p>
          <ul className="boot-post mono" aria-hidden="true">
            <li className="boot-post-on">
              <span className="boot-post-label">DATA</span>
              <span className="boot-post-dots" />
              <span className="boot-post-value">SAFE</span>
            </li>
            <li className="boot-post-on">
              <span className="boot-post-label">SERVICE</span>
              <span className="boot-post-dots" />
              <span className="boot-post-value">RESTARTING</span>
            </li>
          </ul>
          <p className="auth-alt">
            If this lasts more than a few minutes, tell your instructor.
          </p>
        </div>
      </div>
    </main>
  );
}
