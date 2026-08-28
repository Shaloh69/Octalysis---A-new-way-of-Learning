import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Monitor, Users, AlertTriangle } from "lucide-react";
import { api, type LiveSnapshot } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/empty";

/**
 * Lecture Mode.
 *
 * **NO NAMES, EVER** — `apps/console/CLAUDE.md`, and it is enforced where it
 * has to be: the API never selects a name, a student id, or a user id for this
 * view. This page could not show one if it tried, which is the only version of
 * that promise worth making.
 *
 * **SMALL GROUPS ARE SUPPRESSED.** With four students in a room, "3 of 4 chose
 * B" plus one visible face is not anonymous. Under five active students the
 * server sends no distribution at all and this page says so plainly, rather
 * than drawing a chart that identifies people to everyone watching.
 *
 * **IT DEGRADES QUIETLY.** `PAGE-SPECS.md` §5 calls a Supabase hiccup in front
 * of forty students the worst failure mode in the app. A failed poll keeps the
 * last good snapshot and shows a stale marker; it never blanks the projector.
 */

const POLL_MS = 5000;

export function LivePage() {
  const [params] = useSearchParams();
  const present = params.get("present") === "1";

  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const tick = () => {
      void api
        .live()
        .then((s) => {
          if (!live) return;
          setSnap(s);
          setStale(false);
          setFatal(null);
        })
        .catch((e) => {
          if (!live) return;
          // Keep the last good snapshot. A blank projector mid-lecture is worse
          // than a five-second-old number.
          if (snap) setStale(true);
          else setFatal(e instanceof Error ? e.message : "Could not reach the server.");
        });
    };
    tick();
    const h = window.setInterval(tick, POLL_MS);
    return () => {
      live = false;
      clearInterval(h);
    };
  }, [snap]);

  if (fatal && !snap) return <ErrorNote message={fatal} />;
  if (!snap) return <p className="p-8 text-sm text-ink-muted">Reading the room…</p>;

  const busiest = [...snap.stages].sort((a, b) => b.students - a.students).slice(0, 8);

  /* --------------------------------------------------- projector view */
  if (present) {
    return (
      <div className="fixed inset-0 z-dialog flex flex-col justify-center bg-surface-0 p-8">
        {stale && (
          <p className="absolute right-6 top-6 text-xs text-warning">Showing the last reading</p>
        )}

        <p className="mb-2 text-center text-sm uppercase tracking-[0.2em] text-accent">
          CPE 412 · live
        </p>

        <p className="num mb-2 text-center text-[12vw] font-bold leading-none text-ink">
          {snap.cohort}
        </p>
        <p className="mb-12 text-center text-2xl text-ink-muted">
          {snap.cohort === 1 ? "person working" : "people working"}
        </p>

        {snap.suppressed ? (
          <p className="mx-auto max-w-2xl text-center text-xl text-ink-muted">
            Too few people for an anonymous breakdown. With fewer than {snap.minCohort} it would
            say who did what.
          </p>
        ) : (
          <div className="mx-auto w-full max-w-4xl">
            <p className="mb-4 text-center text-lg text-ink-muted">Where the room is</p>
            <ul className="flex flex-col gap-3">
              {busiest.map((s) => (
                <li key={s.stageId} className="flex items-center gap-5">
                  <span className="num w-14 text-2xl text-ink-faint">{s.stageId}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${s.avgMastery}%` }}
                    />
                  </div>
                  <span className="num w-20 text-right text-2xl">{s.avgMastery}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-12 text-center text-sm text-ink-faint">No names are shown here, ever.</p>
      </div>
    );
  }

  /* ------------------------------------------------------ control view */
  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl">Live</h1>
          <p className="text-sm text-ink-muted">
            What the room is doing, in aggregate. Refreshes every {POLL_MS / 1000} seconds.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live?present=1">
            <Monitor className="h-4 w-4" aria-hidden="true" /> Projector view
          </Link>
        </Button>
      </header>

      {stale && (
        <p className="mb-4 rounded-md border border-warning bg-warning-bg px-4 py-2 text-sm text-warning">
          The last refresh did not come back. These numbers are the previous reading.
        </p>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted">
              <Users className="h-3.5 w-3.5" aria-hidden="true" /> Working now
            </p>
            <p className="num text-3xl">{snap.cohort}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Stages in play</p>
            <p className="num text-3xl">{snap.stages.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Anonymity</p>
            <p className="mt-1">
              {snap.suppressed ? (
                <Badge tone="warning">
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" /> suppressed
                </Badge>
              ) : (
                <Badge tone="success">safe to show</Badge>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {snap.suppressed ? (
        <p className="rounded-md border border-warning bg-warning-bg px-4 py-3 text-sm text-warning">
          Fewer than {snap.minCohort} people are working, so no breakdown is sent. With a handful
          of students in a room, an aggregate plus one visible face is not anonymous — and the
          server withholds the numbers rather than this page hiding them.
        </p>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-3 text-xs uppercase tracking-wide text-ink-muted">
              Average mastery, by stage
            </p>
            <ul className="flex flex-col gap-2">
              {busiest.map((s) => (
                <li key={s.stageId} className="flex items-center gap-3">
                  <span className="num w-8 text-xs text-ink-faint">{s.stageId}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${s.avgMastery}%` }} />
                  </div>
                  <span className="num w-12 text-right text-xs text-ink-muted">{s.avgMastery}%</span>
                  <span className="w-20 text-right text-xs text-ink-faint">
                    {s.students} {s.students === 1 ? "student" : "students"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        No name, student ID, or user ID is ever loaded for this view — not filtered out here,
        never fetched. A field that is not loaded cannot leak.
      </p>
    </>
  );
}
