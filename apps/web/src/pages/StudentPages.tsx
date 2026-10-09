import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { StarMap } from "../map/StarMap";
import { useShellData } from "../shell/ShellData";
import { StageReader } from "../components/StageReader";
import { ProgressGrid, ProgressSkeleton } from "../components/ProgressGrid";
import { useDelayed } from "../lib/useDelayed";
import { AttemptRunner } from "../components/AttemptRunner";
import { TitleScreen } from "../components/TitleScreen";
import { MoonEncounterSlot } from "../encounters/MoonEncounterSlot";

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
  // A graded moon's check opens on this same route (docs/GRADED-MOONS-PLAN.md): `m` names the moon,
  // so the paper says so and leaving it lands on that moon, not on the planet.
  const moon = params.get("m");

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
      {...(moon ? { eyebrow: "Moon check" } : {})}
      onLeave={() => nav(moon ? `/app?stage=${id}&moon=${encodeURIComponent(moon)}` : `/app/stage/${id}`)}
    />
  );
}

/**
 * `/app/stage/:id/moon/:objectiveId/check`: the way INTO a graded moon's check
 * (docs/GRADED-MOONS-PLAN.md). It asks the server for the paper (created once per
 * moon) and passes on to the ordinary check route, behind its start prompt. It starts
 * NOTHING: under hard rule 9 no attempt exists until the student presses Start there.
 * The server decides whether the moon is graded, open and has questions; a refusal is
 * said in the server's words, with the way back to the moon.
 */
export function MoonCheckEntry(): JSX.Element {
  const { id = "", objectiveId = "" } = useParams();
  const nav = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);
  const back = `/app?stage=${id}&moon=${encodeURIComponent(objectiveId)}`;

  useEffect(() => {
    if (!objectiveId.startsWith(`${id}.`)) {
      setProblem("That moon does not circle this planet. Go back to the map and choose it there.");
      return;
    }
    let live = true;
    api
      .moonCheck(objectiveId)
      .then((c) => {
        if (!live) return;
        nav(
          `/app/stage/${id}/check?a=${encodeURIComponent(c.assessmentId)}&t=${encodeURIComponent(c.title)}&m=${encodeURIComponent(objectiveId)}`,
          { replace: true },
        );
      })
      .catch((e: unknown) => {
        if (live) setProblem(e instanceof Error ? e.message : "The check did not open. Try again.");
      });
    return () => {
      live = false;
    };
  }, [id, objectiveId, nav]);

  if (problem) {
    return <ErrorState message={problem} onRetry={() => nav(back)} retryLabel="Back to the moon" />;
  }
  return (
    <section className="check-loading" aria-busy="true" data-moon-check-entry="">
      <p role="status">Opening the check for Moon {objectiveId}…</p>
    </section>
  );
}

/**
 * `/app/stage/:id/moon/:objectiveId`: a moon's journey (WEB-REVAMP 3.2 item 5,
 * 3.7a). Practice on that objective's own questions, inside its planet's biome
 * (a moon wears its planet's, 3.5). The server decides the lock and whether the
 * moon has questions; this page only says what it answered.
 */
export function MoonJourneyPage(): JSX.Element {
  const { id = "", objectiveId = "" } = useParams();
  const nav = useNavigate();
  const { map } = useShellData();
  // A graded moon's practice says it is not the graded paper, and offers the check.
  const graded =
    map?.nodes.find((n) => n.id === id)?.objectives.find((o) => o.id === objectiveId)?.graded === true;
  // Leaving returns to the map with the planet, and its moon, still chosen (3.3).
  const back = () => nav(`/app?stage=${id}&moon=${encodeURIComponent(objectiveId)}`);

  if (!objectiveId.startsWith(`${id}.`)) {
    return (
      <ErrorState
        message="That moon does not circle this planet. Go back to the map and choose it there."
        onRetry={() => nav(`/app?stage=${id}`)}
        retryLabel="Back to the map"
      />
    );
  }

  return (
    <>
      <AttemptRunner
        key={objectiveId}
        stageId={id}
        journey={{ objectiveId, graded }}
        title={`Moon ${objectiveId}`}
        onLeave={back}
      />
      {/* The moon's minigame, if it has one: beside the questions, never over them (3.6). */}
      <MoonEncounterSlot stageId={id} objectiveId={objectiveId} />
    </>
  );
}

export function ProgressPage(): JSX.Element {
  const { map, grid, error, reload } = useShellData();
  const loading = !error && (!grid || !map);
  const skeleton = useDelayed(loading, 400);
  const slow = useDelayed(loading, 3000);
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!grid || !map) {
    return skeleton ? <ProgressSkeleton slow={slow} /> : <section className="prog" data-progress="loading" aria-busy="true" />;
  }
  return <ProgressGrid data={grid} nodes={map.nodes} />;
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
  // A page in its own right: its own main and h1 (DESIGN-MANDATE-V2.md §5).
  return (
    <TitleScreen
      menu={[
        { to: "/app", label: "The star map" },
        { to: "/login", label: "Sign in" },
      ]}
      panelTitle="There is nothing at this address"
      card={{ title: "Lost in space", body: <p>No page, stage or planet lives here.</p> }}
    >
      <p className="title-done">The link may be old, or mistyped.</p>
      <Link to="/app" className="button hud-button button-primary title-go">
        Back to the map
      </Link>
    </TitleScreen>
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
    <TitleScreen
      menu={[{ to: "/login", label: "Sign in" }]}
      panelTitle="Back shortly"
      card={{
        title: "Systems halted",
        body: (
          <dl className="title-status">
            <div>
              <dt>Your data</dt>
              <dd>Safe</dd>
            </div>
            <div>
              <dt>The service</dt>
              <dd>Restarting</dd>
            </div>
          </dl>
        ),
      }}
    >
      <p className="title-done">
        The system is being worked on. Nothing you have submitted is affected: answers are saved as you give them,
        and the record is append-only.
      </p>
      <p className="note">If this lasts more than a few minutes, tell your instructor.</p>
    </TitleScreen>
  );
}
