import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CircleAlert, Info, RefreshCw, X } from "lucide-react";
import type { InvariantResult, SystemAudit } from "@octa/contracts";
import { api } from "@/lib/api";
import {
  attention, byArea, cell, clock, countWords, counts, rerunToast, runWords, sampleColumns, stamp,
  STATE_WORD, stateOf, trigger, type CheckState,
} from "@/lib/system-view";
import { useDelayed } from "@/lib/useDelayed";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * `/system`: every rule a database constraint cannot express, checked now,
 * each one named, with what it found. Rebuilt 28 Sep 2026 against
 * `design/templates/console/system/SPEC.md`; gated by
 * `design/specs/console-system.spec.ts`.
 *
 * `TEMPLATE-LINKS.md` row 77 is the plan: a list of named checks, each pass or
 * fail, a timestamp, the detail of a failure, and never an aggregate "all
 * good" that hides one failing invariant. So the page leads with COUNTS, one
 * per state, zero included, and lists every check; it never says the database
 * is fine.
 *
 * The API decides a check's state (`services/api/src/audit/invariants.ts`),
 * including the one ruling that matters most: a notice only when the table
 * the check reads is empty. The page draws what it is given.
 *
 * Read-only, and it must stay so: this page runs checks, it never fixes data.
 * Each check names the page that fixes what it finds.
 */

const STATE_ICON: Readonly<Record<CheckState, typeof Check>> = {
  failing: X,
  warning: CircleAlert,
  notice: Info,
  passing: Check,
};

export function SystemPage() {
  const [data, setData] = useState<SystemAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  /** When a Run again failed, and so the results on screen are the earlier run's. */
  const [stale, setStale] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const focusAfterOpen = useRef<string | null>(null);

  const firstLoad = !data && !error;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  // First load, and Try again after a failed first load.
  useEffect(() => {
    let live = true;
    setError(null);
    api
      .systemAudit()
      .then((d) => {
        if (!live) return;
        setData(d);
        // A failing check's detail is the point of the page: open on arrival.
        setOpen(new Set(d.results.filter((r) => stateOf(r) === "failing").map((r) => r.id)));
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Something went wrong.");
      });
    return () => {
      live = false;
    };
  }, [tick]);

  async function runAgain() {
    if (running) return;
    setRunning(true);
    try {
      const d = await api.systemAudit();
      setData(d);
      setStale(null);
      setOpen((o) => {
        const next = new Set([...o].filter((id) => d.results.some((r) => r.id === id)));
        for (const r of d.results) if (stateOf(r) === "failing") next.add(r.id);
        return next;
      });
      toast.success(rerunToast(d.ranAt, counts(d.results)));
    } catch (e) {
      if (data) setStale(new Date().toISOString());
      toast.error(
        "The checks could not be run again",
        `${e instanceof Error ? e.message : "Try again in a moment."} The results shown are from the earlier run.`,
      );
    } finally {
      setRunning(false);
    }
  }

  function toggle(id: string) {
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goTo(id: string) {
    focusAfterOpen.current = id;
    setOpen((o) => new Set(o).add(id));
  }

  // After a Needs-attention link: the check is open, in view, and its Details has focus.
  useEffect(() => {
    const id = focusAfterOpen.current;
    if (!id) return;
    focusAfterOpen.current = null;
    const row = document.getElementById(`check-${id}`);
    const button = row?.querySelector<HTMLButtonElement>("[data-details-button]");
    if (!row || !button) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    button.focus({ preventScroll: true });
  }, [open]);

  return (
    <div className="sy">
      <header className="sy-head">
        <div className="min-w-0">
          <h1 className="mb-1 font-display text-2xl">System health</h1>
          <p className="text-sm text-ink-muted">
            {data ? <span className="num">{data.results.length}</span> : "The"} checks for the rules a database
            constraint cannot express, run against the live database.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={runAgain}
          disabled={running || !data}
          aria-busy={running}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {running ? "Running…" : "Run again"}
        </Button>
      </header>

      {error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The checks could not be run. <span className="text-ink-muted">{error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>Try again</Button>
        </div>
      ) : !data ? (
        showSkeleton ? <Skeleton slow={slow} /> : <div className="sy-reserve" aria-busy="true" />
      ) : (
        <Report data={data} open={open} stale={stale} onToggle={toggle} onGoTo={goTo} />
      )}
    </div>
  );
}

function Report({
  data, open, stale, onToggle, onGoTo,
}: {
  data: SystemAudit;
  open: Set<string>;
  stale: string | null;
  onToggle: (id: string) => void;
  onGoTo: (id: string) => void;
}) {
  const c = counts(data.results);
  const needs = attention(data.results);

  return (
    <>
      <section className="sy-card sy-summary" aria-label="This run">
        <p data-runline className="sy-runline">
          Checked <time dateTime={data.ranAt} className="num">{stamp(data.ranAt)}</time>
          <span className="sy-sep" aria-hidden="true"> · </span>
          <span className="num">{data.tookMs}</span> ms
        </p>
        {stale ? (
          <p data-stale role="status" className="sy-stale">
            Running them again failed at <span className="num">{clock(stale)}</span>. What is shown is the earlier
            run, checked at the time above.
          </p>
        ) : null}
        <p data-counts className="sy-counts" aria-live="polite">
          {countWords(c).map((w, i) => (
            <span key={w.word} className="sy-count">
              {i > 0 ? <span className="sy-sep" aria-hidden="true">·</span> : null}
              <span className="num">{w.n}</span> {w.word}
            </span>
          ))}
        </p>

        {needs.length > 0 ? (
          <nav data-attention aria-label="Needs attention" className="sy-attention">
            <h2 className="sy-attention-head">Needs attention</h2>
            <ul className="sy-attention-list">
              {needs.map((r) => {
                const s = stateOf(r);
                return (
                  <li key={r.id}>
                    <a
                      href={`#check-${r.id}`}
                      data-to={r.id}
                      className="sy-attention-link"
                      onClick={(e) => {
                        e.preventDefault();
                        onGoTo(r.id);
                      }}
                    >
                      <StateMark state={s} />
                      <span className="num">{r.id}</span>
                      <span className="sy-attention-title">{r.title}</span>
                      <span className="sy-attention-meta">
                        {STATE_WORD[s]}, <span className="num">{r.offendingCount.toLocaleString("en-US")}</span>{" "}
                        {r.offendingCount === 1 ? "row" : "rows"}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </section>

      {byArea(data.results).map((g) => (
        <section key={g.area} data-area={g.area} className="sy-area" aria-labelledby={`area-${g.area}`}>
          <h2 id={`area-${g.area}`} className="sy-area-head">{g.label}</h2>
          <ul className="sy-card sy-checks">
            {g.checks.map((r) => (
              <CheckRow key={r.id} r={r} open={open.has(r.id)} onToggle={() => onToggle(r.id)} />
            ))}
          </ul>
        </section>
      ))}

      <Runs runs={data.runs} />
    </>
  );
}

function StateMark({ state }: { state: CheckState }) {
  const Icon = STATE_ICON[state];
  return <Icon className={cn("sy-mark", `is-${state}`)} aria-hidden="true" />;
}

function CheckRow({ r, open, onToggle }: { r: InvariantResult; open: boolean; onToggle: () => void }) {
  const s = stateOf(r);
  const detailsId = `details-${r.id}`;
  return (
    <li data-check={r.id} id={`check-${r.id}`} className={cn("sy-check", open && "is-open")}>
      <div className="sy-row">
        <p data-state className={cn("sy-state", `is-${s}`)}>
          <StateMark state={s} />
          {STATE_WORD[s]}
        </p>
        <div className="sy-name">
          <p className="sy-title-line">
            <span data-id className="num sy-id">{r.id}</span>{" "}
            <span data-title className="sy-title">{r.title}</span>
          </p>
          <p data-protects className="sy-protects">{r.protects}</p>
        </div>
        <p data-found className="sy-found">
          {r.offendingCount === 0 ? (
            "none"
          ) : (
            <>
              <span className="num">{r.offendingCount.toLocaleString("en-US")}</span>{" "}
              {r.offendingCount === 1 ? "row" : "rows"}
            </>
          )}
        </p>
        <button
          type="button"
          data-details-button
          className="sy-details-btn"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`Details: ${r.id} ${r.title}`}
          onClick={onToggle}
        >
          Details <ChevronDown className={cn("h-3.5 w-3.5 sy-chevron", open && "is-open")} aria-hidden="true" />
        </button>
      </div>
      {open ? <Details r={r} id={detailsId} /> : null}
    </li>
  );
}

function Details({ r, id }: { r: InvariantResult; id: string }) {
  const cols = sampleColumns(r.sample);
  const cut = r.offendingCount > r.sample.length;
  return (
    <div id={id} data-details className="sy-details">
      <dl className="sy-fields">
        <div data-field="checks" className="sy-field">
          <dt>Checks</dt>
          <dd>{r.checks}</dd>
        </div>
        <div data-field="action" className="sy-field">
          <dt>When it fails</dt>
          <dd>{r.action}</dd>
        </div>
        {r.noticeReason ? (
          <div data-field="notice" className="sy-field">
            <dt>Why a notice</dt>
            <dd>{r.noticeReason}</dd>
          </div>
        ) : null}
      </dl>

      {r.sample.length > 0 ? (
        <div data-sample className="sy-sample">
          <p className="sy-faint">
            {cut ? (
              <>
                Showing the first <span className="num">{r.sample.length}</span> of{" "}
                <span className="num">{r.offendingCount.toLocaleString("en-US")}</span> rows it found.
              </>
            ) : (
              <>
                The <span className="num">{r.offendingCount}</span> {r.offendingCount === 1 ? "row" : "rows"} it found.
              </>
            )}
          </p>
          <table className="sy-sample-table">
            <thead>
              <tr>
                {cols.map((k) => (
                  <th key={k} scope="col" className="num">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.sample.map((row, i) => (
                <tr key={i}>
                  {cols.map((k) => (
                    <td key={k} className="num">{cell(row[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <ol className="sy-sample-rows">
            {r.sample.map((row, i) => (
              <li key={i}>
                <dl data-sample-row className="sy-sample-row">
                  {cols.map((k) => (
                    <div key={k} className="sy-sample-pair">
                      <dt className="num">{k}</dt>
                      <dd className="num">{cell(row[k])}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <p className="sy-terms">
        <span className="num">{r.name}()</span>
        <span className="sy-sep" aria-hidden="true"> · </span>
        run_invariants() severity <span className="num">{r.dbSeverity}</span>
      </p>
    </div>
  );
}

function Runs({ runs }: { runs: SystemAudit["runs"] }) {
  return (
    <section className="sy-area" aria-labelledby="nightly-runs">
      <h2 id="nightly-runs" className="sy-area-head">Nightly runs</h2>
      <p className="sy-faint sy-runs-note">
        The database runs the same checks itself each night at 02:30 Manila and keeps what it found. Run again checks
        now; it does not add to this record.
      </p>
      {runs.length === 0 ? (
        <p data-runs-empty className="sy-card sy-runs-empty">
          No nightly run is recorded on this database. The nightly check runs through pg_cron, which the Supabase
          deployment has and a local database does not.
        </p>
      ) : (
        <ol data-runs className="sy-card sy-runs">
          {runs.map((run) => (
            <li key={run.id} data-run className="sy-run">
              <time dateTime={run.startedAt} className="num sy-run-when">{stamp(run.startedAt)}</time>
              <span className="sy-run-by">{trigger(run.triggeredBy)}</span>
              <span className={cn("sy-run-found", run.failing.length > 0 && "is-failing")}>{runWords(run)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton aria-busy="true" aria-label="Running the checks" className="sy-skeleton">
      {/* First, not last: at 380 a sentence below the fold says nothing. */}
      {slow ? (
        <p className="sy-faint sy-skel-note">
          Still running the checks. The server may be waking up; this can take up to a minute.
        </p>
      ) : null}
      <div className="sy-card sy-skel-summary">
        <div className="sy-skel sy-skel-line" />
        <div className="sy-skel sy-skel-line is-short" />
      </div>
      {Array.from({ length: 3 }, (_, g) => (
        <div key={g} className="sy-skel-group">
          <div className="sy-skel sy-skel-head" />
          <div className="sy-card">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="sy-skel-row">
                <div className="sy-skel sy-skel-state" />
                <div className="sy-skel sy-skel-text" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
