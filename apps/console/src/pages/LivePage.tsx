import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Monitor } from "lucide-react";
import type { LiveHealth, LiveOptions, LiveSession, LiveSnapshot } from "@/lib/api";
import { api } from "@/lib/api";
import { TYPE_LABEL } from "@/lib/items-view";
import { clockTime, resultWords, share, whoMayAnswer } from "@/lib/live-view";
import { useDelayed } from "@/lib/useDelayed";
import { useLiveRoom } from "@/lib/useLiveRoom";
import { Button } from "@/components/ui/button";
import { EndDialog, StartDialog } from "./live/SessionDialogs";

/**
 * Lecture Mode — rebuilt 29 Sep 2026 (`design/templates/console/live/SPEC.md`).
 *
 * **NO NAMES, EVER** — `apps/console/CLAUDE.md`, and it is enforced where it
 * has to be: `routes/live.ts` never selects a name, a student id or a user id
 * for this view, not even the teacher who started a question. This page could
 * not show one if it tried, which is the only version of that promise worth
 * making.
 *
 * **SMALL GROUPS ARE WITHHELD BY THE SERVER.** A stage's average below five
 * students and a question's split below five answers arrive as null. The page
 * says so in words; it never decides it.
 *
 * **ONE QUESTION AT A TIME, AND STUDENTS CANNOT ANSWER IT YET.** The instructor
 * chose the server and console half of "push an item" (29 Sep 2026). The
 * student half, `/app/live`, is not built, and every place a question can be
 * started says so.
 *
 * The projector is its own route, `/live/present`. `?present=1` still lands
 * there, so an old bookmark works.
 */
export function LivePage() {
  const [params] = useSearchParams();
  if (params.get("present") === "1") return <Navigate to="/live/present" replace />;
  return <LiveControl />;
}

function LiveControl() {
  const { snap, setSnap, health, error, stale, refresh } = useLiveRoom(true);
  const [options, setOptions] = useState<LiveOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsTick, setOptionsTick] = useState(0);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setOptionsError(null);
    api
      .liveOptions()
      .then((o) => alive && setOptions(o))
      .catch((e) => alive && setOptionsError(e instanceof Error ? e.message : "The server did not answer."));
    return () => {
      alive = false;
    };
  }, [optionsTick]);

  const firstLoad = !snap && !error;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  function started(session: LiveSession) {
    setSnap((s) => (s ? { ...s, session } : s));
    refresh();
  }
  function ended() {
    setSnap((s) => (s ? { ...s, session: null } : s));
    refresh();
  }

  return (
    <div className="lv" data-ready={snap ? "" : undefined}>
      <header className="lv-head">
        <div className="min-w-0">
          <h1 className="mb-1 font-display text-2xl">Live</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Lecture Mode: what the room is doing, in aggregate, and one question put to it. No name is
            loaded for this page, and nothing here says how any one student did.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live/present" target="_blank" rel="noopener noreferrer">
            <Monitor className="h-4 w-4" aria-hidden="true" /> Open the projector view
            <span className="lv-faint">in a new window</span>
          </Link>
        </Button>
      </header>

      {error && !snap ? (
        <div role="alert" className="lv-alert">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The room could not be read. <span className="text-ink-muted">{error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : !snap ? (
        showSkeleton ? <Skeleton slow={slow} /> : <div className="lv-reserve" aria-busy="true" />
      ) : (
        <>
          <p data-updated className="lv-faint">
            Read at <span className="num">{clockTime(snap.at)}</span> · every 5 seconds
          </p>
          {stale ? (
            <p data-stale role="status" className="lv-stale">
              The last read did not come back. These numbers are the previous reading, from{" "}
              <span className="num">{clockTime(snap.at)}</span>.
            </p>
          ) : null}

          <Question
            snap={snap}
            options={options}
            optionsError={optionsError}
            onRetryOptions={() => setOptionsTick((t) => t + 1)}
            onStart={() => setStartOpen(true)}
            onEnd={() => setEndOpen(true)}
          />
          <Room snap={snap} health={health} />
          <Stages snap={snap} />

          <p className="lv-faint">
            No name, student ID, or user ID is ever loaded for this view — not filtered out here, never
            fetched. A field that is not loaded cannot leak.
          </p>

          {options ? (
            <StartDialog open={startOpen} onOpenChange={setStartOpen} options={options} onStarted={started} />
          ) : null}
          {snap.session ? (
            <EndDialog
              open={endOpen}
              onOpenChange={setEndOpen}
              session={snap.session}
              onEnded={ended}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ the question */

function Question({
  snap, options, optionsError, onRetryOptions, onStart, onEnd,
}: {
  snap: LiveSnapshot;
  options: LiveOptions | null;
  optionsError: string | null;
  onRetryOptions: () => void;
  onStart: () => void;
  onEnd: () => void;
}) {
  const s = snap.session;
  const cannotAnswer = (
    <p className="lv-note">
      <strong className="font-semibold text-ink">Students cannot answer yet:</strong> the student side of
      Lecture Mode is not built. A question started here is recorded, shown here and on the projector, and
      written to the audit log.
    </p>
  );

  if (!s) {
    const noLive = options !== null && options.items.length === 0;
    return (
      <section data-question data-state="none" aria-labelledby="lv-q-title" className="lv-card lv-question">
        <div className="lv-q-main">
          <h2 id="lv-q-title" className="lv-h2">No question is running</h2>
          <p className="text-sm text-ink-muted">
            Put one live item to the room. Students answer it, and this page and the projector show how many
            have, and how the class did once {snap.minCohort} have.
          </p>
          {cannotAnswer}
        </div>
        <div className="lv-q-side">
          <Button data-question-action onClick={onStart} disabled={!options || noLive}>
            Start a question
          </Button>
          {noLive ? (
            <p className="lv-faint">
              No item is live yet, so there is nothing to put to the room. An item reaches live on{" "}
              <Link to="/items" className="lv-link">Items</Link>.
            </p>
          ) : optionsError ? (
            <p className="lv-faint">
              The items that could be started did not load.{" "}
              <button type="button" className="lv-link" onClick={onRetryOptions}>Try again</button>
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  const pct = share(s.correct, s.answered);
  return (
    <section data-question data-state="running" aria-labelledby="lv-q-title" className="lv-card lv-question">
      <div className="lv-q-main">
        <h2 id="lv-q-title" className="lv-h2">
          Question running <span className="lv-faint">since <span className="num">{clockTime(s.startedAt)}</span></span>
        </h2>
        <p className="lv-slug num">{s.itemSlug}</p>
        <p className="text-sm text-ink">
          {TYPE_LABEL[s.itemType][0]!.toUpperCase() + TYPE_LABEL[s.itemType].slice(1)} · Stage{" "}
          <span className="num">{s.stageId}</span> · {s.stageTitle}
        </p>
        {s.objective ? <p className="lv-objective">{s.objective}</p> : null}
        <p className="text-sm text-ink-muted">
          Who may answer: <span className="text-ink">{whoMayAnswer(s.section)}</span>
        </p>
        {cannotAnswer}
      </div>
      <div className="lv-q-side">
        <dl className="lv-figures">
          <div data-figure="answered">
            <dt>Answered</dt>
            <dd className="num">{s.answered}</dd>
          </div>
          <div data-figure="correct">
            <dt>Correct</dt>
            <dd className={s.correct === null ? "lv-held" : "num"}>{s.correct === null ? "held back" : s.correct}</dd>
          </div>
        </dl>
        {pct !== null ? (
          <div className="lv-track" aria-hidden="true">
            <div data-bar className="lv-fill" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        <p className="text-sm text-ink">{resultWords(s, snap.minCohort)}</p>
        <Button data-question-action variant="outline" onClick={onEnd}>
          End question
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ the room */

function Room({ snap, health }: { snap: LiveSnapshot; health: LiveHealth | null }) {
  const n = (v: number | undefined) => (v === undefined ? "—" : String(v));
  const reports = health?.reportsRecently;
  return (
    <section data-room aria-labelledby="lv-room-title" className="lv-card lv-room">
      <h2 id="lv-room-title" className="lv-h2">The room, in the last 20 minutes</h2>
      <dl className="lv-counts">
        <div data-count="working" className="lv-count">
          <dt>Working now</dt>
          <dd className="num">{snap.cohort}</dd>
          <p className="lv-faint">students with a paper started or answered</p>
        </div>
        <div data-count="open" className="lv-count">
          <dt>Papers open</dt>
          <dd className="num">{n(health?.inProgress)}</dd>
          <p className="lv-faint">not yet handed in</p>
        </div>
        <div data-count="handed-in" className="lv-count">
          <dt>Handed in</dt>
          <dd className="num">{n(health?.submittedRecently)}</dd>
          <p className="lv-faint">papers submitted</p>
        </div>
        <div data-count="reports" className="lv-count">
          <dt>Reports</dt>
          <dd className="num">{n(reports)}</dd>
          {reports ? (
            <p className="lv-faint">
              <Link to="/feedback" className="lv-link">Read them on Feedback</Link>: a spike usually means one
              broken item
            </p>
          ) : (
            <p className="lv-faint">problems students flagged</p>
          )}
        </div>
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ the class so far */

function Stages({ snap }: { snap: LiveSnapshot }) {
  return (
    <section aria-labelledby="lv-stages-title" className="lv-card lv-stages-card">
      <h2 id="lv-stages-title" className="lv-h2">The class so far, by stage</h2>
      <p className="lv-faint">
        Each student&apos;s best stage-check mastery to date: the whole class, not only the people in the room.
        A stage with fewer than {snap.minCohort} students shows no average, because the server does not send
        one.
      </p>
      {snap.stages.length === 0 ? (
        <p className="text-sm text-ink-muted">No student has progress on any stage yet.</p>
      ) : (
        <ul className="lv-stages">
          {snap.stages.map((st) => (
            <li key={st.stageId} data-stage-row={st.stageId} data-withheld={st.avgMastery === null ? "true" : "false"} className="lv-stage">
              <span className="lv-stage-name">
                <span className="num text-ink-muted">{st.stageId}</span> <span className="text-ink">{st.title}</span>
              </span>
              {st.avgMastery === null ? (
                <span className="lv-held lv-stage-bar">fewer than {snap.minCohort}, not sent</span>
              ) : (
                <span className="lv-track lv-stage-bar" aria-hidden="true">
                  <span data-bar className="lv-fill" style={{ width: `${st.avgMastery}%` }} />
                </span>
              )}
              <span className="lv-stage-value num">{st.avgMastery === null ? "" : `${st.avgMastery}%`}</span>
              <span className="lv-stage-n">
                <span className="num">{st.students}</span> {st.students === 1 ? "student" : "students"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton aria-busy="true" aria-label="Reading the room" className="lv-skeleton">
      {/* First, not last: at 380 a sentence below the fold says nothing. */}
      {slow ? <p className="lv-faint">Still waiting for the server. It may be waking up; this can take up to a minute.</p> : null}
      <div className="lv-card lv-skel-question"><div className="lv-skel lv-skel-line" /><div className="lv-skel lv-skel-line is-short" /></div>
      <div className="lv-skel-counts">{Array.from({ length: 4 }, (_, i) => <div key={i} className="lv-card lv-skel lv-skel-count" />)}</div>
      <div className="lv-card lv-skel-rows">{Array.from({ length: 7 }, (_, i) => <div key={i} className="lv-skel lv-skel-row" />)}</div>
    </div>
  );
}
