import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StarMap } from "../map/StarMap";
import { useShellData } from "../shell/ShellData";
import { StageReader } from "../components/StageReader";
import { ProgressGrid } from "../components/ProgressGrid";
import { AttemptRunner } from "../components/AttemptRunner";

/**
 * The student's routes (WEB-REMAKE.md, 30 Sep 2026).
 *
 * `/app` is the 3D map and the only map: the 2D map and `/app/map` are
 * removed by ruling 2. The map and the progress grid come from the shell
 * (`useShellData`), fetched once for the whole app. Every page renders INSIDE
 * its shell's `<main>`, so a page is a section with the page's `h1`, never a
 * second `<main>`.
 */

/* ------------------------------------------------------------------ pages */

export function MapPage(): JSX.Element {
  const { map, error, reload } = useShellData();

  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!map) return <MapSkeleton />;

  return <StarMap data={map} />;
}

export function StagePage(): JSX.Element {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { reload } = useShellData();

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
      stageId={id}
      assessmentId={assessmentId}
      title={title}
      onLeave={() => nav(`/app/stage/${id}`)}
    />
  );
}

export function ProgressPage(): JSX.Element {
  const { grid, error, reload } = useShellData();
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
    /*
      `main` and `h1`, because when this renders it IS the page — every caller
      returns it INSTEAD of the route's content, not beside it.
      `if (error) return <ErrorState .../>` is the pattern in all three places.

      It was a `div` with an `h2`, so a student whose connection dropped got a
      document with no title at any level and no landmark to jump to. Exactly
      the defect found in `NotFoundPage` the same day, from the same cause: an
      element written as though something else on the page would supply the
      heading, when nothing else is on the page at all.

      `role="alert"` stays. The heading names the situation; the alert makes a
      screen reader announce it without the student hunting for it.
    */
    <section className="state state-error hud-panel" role="alert">
      <h1>That did not load</h1>
      <p>{message}</p>
      <button type="button" className="button hud-button" onClick={onRetry}>
        {retryLabel}
      </button>
    </section>
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
