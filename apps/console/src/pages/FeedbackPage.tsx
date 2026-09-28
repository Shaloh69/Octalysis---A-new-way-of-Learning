import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown, ArrowRight, ArrowUp, Ban, ChevronDown, CircleCheck, CircleDot, Download, Eye, Hourglass, Minus,
} from "lucide-react";
import {
  FEEDBACK_KIND_LABELS, FEEDBACK_STATUS_LABELS, FeedbackKind,
  type FeedbackGroup, type FeedbackQueue, type FeedbackSeverity, type FeedbackStatus,
} from "@octa/contracts";
import { api } from "@/lib/api";
import {
  SEVERITIES, SEVERITY_WORD, STATUS_ORDER, SUS_BENCHMARK, SUS_RELIABLE_N, apiParams, attached, day, letter,
  ratingWords, readFilters, triageToast, variantOf, when, type FeedbackFilters,
} from "@/lib/feedback-view";
import { useDelayed } from "@/lib/useDelayed";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * `/feedback`: what students report about the course and the platform, worked
 * down as a queue. Rebuilt 29 Sep 2026 against
 * `design/templates/console/feedback/SPEC.md`; gated by
 * `design/specs/console-feedback.spec.ts` and the older
 * `console-live-feedback.spec.ts`.
 *
 * The instructor's rulings of that day:
 *
 *   - ONE queue for all staff. "My feedback" waits for the console to be able
 *     to send feedback at all (PAGE-SPECS.md §4.1 exists only in the student
 *     app); teacher and admin are one role (D4)
 *   - exact repeats are ONE row, and one triage moves every report in it
 *     (`PATCH /console/feedback`, one audit row per report)
 *   - status and kind filtered on the server, in the address; a count; Load
 *     older instead of a silent 300-row cap; a CSV of every match
 *   - status, severity and "released in"; SUS by role with its n
 *
 * A report still EXPANDS IN PLACE, one at a time: a question report is only
 * actionable with the numbers that student saw, so the instance is one click
 * from the queue, not a page away.
 */

const STATUS_ICON: Readonly<Record<FeedbackStatus, typeof CircleDot>> = {
  new: CircleDot,
  triaged: Eye,
  in_progress: Hourglass,
  shipped: CircleCheck,
  wont_fix: Ban,
};
const SEVERITY_ICON: Readonly<Record<FeedbackSeverity, typeof ArrowUp>> = { low: ArrowDown, medium: ArrowRight, high: ArrowUp };

/** The queue is a table at 52rem of the page's OWN width, cards below. */
const TABLE_REM = 52;

export function FeedbackPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const key = apiParams(filters).toString();

  const [data, setData] = useState<FeedbackQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const seq = useRef(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const measure = () => setWide(el.clientWidth >= TABLE_REM * rem);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    api
      .feedback(apiParams(filters))
      .then((q) => {
        if (mine !== seq.current) return;
        setData(q);
        setFresh(new Set());
        setOpenKey(null);
      })
      .catch((e: unknown) => {
        if (mine === seq.current) setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
    // `key` is the filter as a string; `filters` is rebuilt every render.
  }, [key, tick]);

  const firstLoad = loading && !data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  function update(next: Partial<FeedbackFilters>) {
    const merged = { ...filters, ...next };
    setParams(apiParams(merged), { replace: false });
  }

  async function loadOlder() {
    if (!data?.next) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const page = await api.feedback(apiParams(filters, data.next));
      if (mine !== seq.current) return;
      setData((d) => (d ? { ...page, groups: [...d.groups, ...page.groups] } : page));
      setFresh(new Set(page.groups.map((g) => g.key)));
    } catch (e) {
      toast.error("Older reports could not be loaded", e instanceof Error ? e.message : "Try again in a moment.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const csv = await api.feedbackCsv(apiParams(filters));
      const n = Math.max(0, csv.trim().split("\n").length - 1);
      const d = new Date();
      const name = `octa-feedback-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.csv`;
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${n} ${n === 1 ? "report" : "reports"}`, `${filterWords(filters)}, saved as ${name}.`);
    } catch (e) {
      toast.error("The feedback could not be exported", e instanceof Error ? e.message : "Nothing was saved. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }

  function saved() {
    setOpenKey(null);
    setTick((t) => t + 1);
  }

  const groups = data?.groups ?? [];

  return (
    <div ref={rootRef} className="fb">
      <header className="fb-head">
        <div className="min-w-0">
          <h1 className="mb-1 font-display text-2xl">Feedback</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            What students report about the course and the platform. A report about a question arrives with the
            exact numbers that student saw.
          </p>
        </div>
        <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting || !data}>
          <Download className="h-4 w-4" aria-hidden="true" /> {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </header>

      {error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The feedback could not be loaded. <span className="text-ink-muted">{error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>Try again</Button>
        </div>
      ) : !data ? (
        showSkeleton ? <Skeleton slow={slow} /> : <div className="fb-reserve" aria-busy="true" />
      ) : (
        <>
          <Sus sus={data.sus} />

          <div className="fb-tools">
            <div role="group" aria-label="Status" className="fb-statuses">
              <Button
                size="sm"
                variant={filters.status === null ? "default" : "outline"}
                aria-pressed={filters.status === null}
                onClick={() => update({ status: null })}
              >
                All <span className="num">{STATUS_ORDER.reduce((t, s) => t + (data.counts[s] ?? 0), 0)}</span>
              </Button>
              {STATUS_ORDER.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={filters.status === s ? "default" : "outline"}
                  aria-pressed={filters.status === s}
                  onClick={() => update({ status: s })}
                >
                  {FEEDBACK_STATUS_LABELS[s]} <span className="num">{data.counts[s] ?? 0}</span>
                </Button>
              ))}
            </div>
            <div className="fb-field">
              <label htmlFor="fb-kind" className="fb-label">Kind</label>
              <select
                id="fb-kind"
                className="fb-select"
                value={filters.kind ?? ""}
                onChange={(e) => update({ kind: (e.target.value || null) as FeedbackKind | null })}
              >
                <option value="">All kinds</option>
                {FeedbackKind.options.map((k) => (
                  <option key={k} value={k}>{FEEDBACK_KIND_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="fb-bar">
            <p data-result className="fb-result" aria-live="polite">
              Showing <span className="num">{groups.length}</span> of <span className="num">{data.total.groups}</span>{" "}
              {data.total.groups === 1 ? "group" : "groups"} · <span className="num">{data.total.reports}</span>{" "}
              {data.total.reports === 1 ? "report" : "reports"}
            </p>
            {loading ? <p role="status" className="fb-faint">Loading…</p> : null}
            {error ? (
              <p role="alert" className="fb-faint">
                That filter could not be applied.{" "}
                <button type="button" className="fb-link" onClick={() => setTick((t) => t + 1)}>Try again</button>
              </p>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <div data-empty className="fb-card fb-empty">
              <p className="text-sm text-ink">
                {filters.status || filters.kind ? `Nothing here: ${filterWords(filters)}.` : "No reports yet."}
              </p>
              <p className="fb-faint">
                Students flag a problem or report a question from inside a stage; each lands here with what it was about.
              </p>
            </div>
          ) : wide ? (
            <div className="fb-card">
              <table className="fb-table">
                <colgroup>
                  <col className="c-status" /><col className="c-kind" /><col /><col className="c-about" />
                  <col className="c-sev" /><col className="c-last" /><col className="c-more" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Report</th>
                    <th scope="col">About</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Last</th>
                    <th scope="col"><span className="sr-only">Triage</span></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const open = openKey === g.key;
                    return (
                      <Fragment key={g.key}>
                        <tr data-group={g.key} data-new={fresh.has(g.key) ? "" : undefined} className={cn(open && "is-open")}>
                          <td><StatusWord status={g.status} /></td>
                          <td data-fact="kind"><KindWords g={g} /></td>
                          <td>
                            <p className="fb-body">{g.body ?? <span className="fb-faint">{ratingWords(g.reports[0]?.rating ?? null) ?? "No message"}</span>}</p>
                            {g.count > 1 ? <p className="fb-repeats">reported <span className="num">{g.count}</span> times</p> : null}
                          </td>
                          <td><About g={g} /></td>
                          <td><SeverityWord severity={g.severity} /></td>
                          <td data-fact="when" className="num fb-when">{day(g.lastAt)}</td>
                          <td className="fb-more-cell">
                            <TriageToggle open={open} onClick={() => setOpenKey(open ? null : g.key)} />
                          </td>
                        </tr>
                        {open ? (
                          <tr data-detail className="fb-detail-row">
                            <td colSpan={7}>
                              <Detail g={g} onSaved={saved} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="fb-card fb-list">
              {groups.map((g) => {
                const open = openKey === g.key;
                return (
                  <li key={g.key} data-group={g.key} data-new={fresh.has(g.key) ? "" : undefined} className={cn("fb-item", open && "is-open")}>
                    <div className="fb-item-top">
                      <StatusWord status={g.status} />
                      <span data-fact="kind" className="fb-item-kind"><KindWords g={g} inline /></span>
                    </div>
                    <p className="fb-body is-full">{g.body ?? <span className="fb-faint">{ratingWords(g.reports[0]?.rating ?? null) ?? "No message"}</span>}</p>
                    <p className="fb-item-meta">
                      {g.count > 1 ? <>reported <span className="num">{g.count}</span> times · </> : null}
                      <span data-fact="when" className="num">{day(g.lastAt)}</span>
                      {g.severity ? <> · <SeverityWord severity={g.severity} /></> : null}
                    </p>
                    {g.item || g.route ? <About g={g} /> : null}
                    <div>
                      <TriageToggle open={open} onClick={() => setOpenKey(open ? null : g.key)} />
                    </div>
                    {open ? (
                      <div data-detail>
                        <Detail g={g} onSaved={saved} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {data.next ? (
            <div className="fb-foot">
              <Button variant="outline" onClick={() => void loadOlder()} disabled={loading}>Load older reports</Button>
            </div>
          ) : groups.length > 0 ? (
            <p data-end className="fb-faint fb-foot">That is every report this filter matches.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function filterWords(f: FeedbackFilters): string {
  const parts = [f.status ? FEEDBACK_STATUS_LABELS[f.status].toLowerCase() : null, f.kind ? FEEDBACK_KIND_LABELS[f.kind].toLowerCase() : null].filter(Boolean);
  return parts.length ? parts.join(", ") : "every report";
}

function TriageToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" className="fb-toggle" aria-expanded={open} onClick={onClick}>
      {open ? "Close" : "Triage"}
      <ChevronDown className={cn("h-3.5 w-3.5 fb-chevron", open && "is-open")} aria-hidden="true" />
    </button>
  );
}

function StatusWord({ status }: { status: FeedbackStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span data-fact="status" className="fb-status">
      <Icon className="fb-mark" aria-hidden="true" />
      {FEEDBACK_STATUS_LABELS[status]}
    </span>
  );
}

function SeverityWord({ severity }: { severity: FeedbackSeverity | null }) {
  if (!severity) return <span className="fb-faint">none</span>;
  const Icon = SEVERITY_ICON[severity];
  return (
    <span className="fb-sev">
      <Icon className="fb-mark" aria-hidden="true" />
      {SEVERITY_WORD[severity]}
    </span>
  );
}

function KindWords({ g, inline }: { g: FeedbackGroup; inline?: boolean }) {
  return (
    <span className={cn("fb-kind", inline && "is-inline")}>
      <span>{FEEDBACK_KIND_LABELS[g.kind]}</span>
      {g.category ? <span className="fb-faint">{g.category}</span> : null}
    </span>
  );
}

function About({ g }: { g: FeedbackGroup }) {
  if (g.item) return <span className="num fb-about">{g.item.slug ?? g.item.id}</span>;
  if (g.route) return <span className="num fb-about">{g.route}</span>;
  return <span className="fb-faint">—</span>;
}

function Sus({ sus }: { sus: FeedbackQueue["sus"] }) {
  return (
    <section data-sus className="fb-card fb-sus" aria-labelledby="fb-sus-title">
      <h2 id="fb-sus-title" className="fb-sus-title">Usability (SUS)</h2>
      <div className="fb-sus-figures">
        <SusFigure label="Students" data="student" fig={sus.student} />
        <SusFigure label="Staff" data="staff" fig={sus.staff} />
      </div>
      <p className="fb-faint">
        The survey appears only after three sessions and a finished assessment, and a dismissal is remembered. The
        published average across systems is <span className="num">{SUS_BENCHMARK}</span>.
      </p>
    </section>
  );
}

function SusFigure({ label, data, fig }: { label: string; data: string; fig: { n: number; mean: number | null } }) {
  const attrs = { [`data-sus-${data}`]: "" };
  return (
    <div {...attrs} className="fb-sus-figure">
      <p className="fb-label">{label}</p>
      {fig.n === 0 || fig.mean === null ? (
        <p className="text-sm text-ink-muted">No responses yet.</p>
      ) : (
        <>
          <p>
            <span className="num fb-sus-mean">{fig.mean}</span>{" "}
            <span className="text-sm text-ink-muted">from <span className="num">{fig.n}</span> {fig.n === 1 ? "response" : "responses"}</span>
          </p>
          <p className="fb-faint">
            {fig.n < SUS_RELIABLE_N
              ? `Fewer than ${SUS_RELIABLE_N} responses: not yet reliable.`
              : fig.mean >= SUS_BENCHMARK
                ? "Above the published average."
                : "Below the published average."}
          </p>
        </>
      )}
    </div>
  );
}

/** One group, opened in place: every report, what it was about, and one triage for all of them. */
function Detail({ g, onSaved }: { g: FeedbackGroup; onSaved: () => void }) {
  const noVariantAtAll = g.kind === "content_report" && g.reports.every((r) => !variantOf(r.resolvedVariant));
  return (
    <div className="fb-detail">
      {g.body && g.body.length > 140 ? <p className="fb-quote">{g.body}</p> : null}

      {noVariantAtAll ? (
        <p data-no-variant className="fb-note">
          No variant was attached to {g.count === 1 ? "this report" : `any of these ${g.count} reports`}: {g.count === 1 ? "it was" : "they were"} filed
          without the attempt {g.count === 1 ? "it" : "they"} came from, so the exact numbers the student saw are not known.
        </p>
      ) : null}

      <ol className="fb-reports" aria-label={g.count === 1 ? "The report" : `The ${g.count} reports`}>
        {g.reports.map((r) => {
          const v = variantOf(r.resolvedVariant);
          const extra = attached(r);
          return (
            <li key={r.id} data-report={r.id} className="fb-report">
              <p className="fb-report-head">
                <span data-fact="who">{r.reporterName ?? "Name not recorded"} · {r.role}</span>
                <span data-fact="when" className="num fb-faint">{when(r.createdAt)}</span>
              </p>
              {ratingWords(r.rating) ? <p className="text-sm text-ink">{ratingWords(r.rating)}</p> : null}
              {v ? (
                <div data-variant className="fb-variant">
                  <p className="fb-label">The variant this student saw</p>
                  {v.stem ? <p className="fb-variant-stem">{v.stem}</p> : null}
                  {v.options.length > 0 ? (
                    <ol className="fb-options">
                      {v.options.map((o, i) => (
                        <li key={i} data-option><span className="num fb-letter">{letter(i)}</span>{o}</li>
                      ))}
                    </ol>
                  ) : null}
                  {v.params.length > 0 ? (
                    <p data-params className="fb-params">
                      {v.params.map(([k, val]) => (
                        <span key={k} className="num">{k} = {val}</span>
                      ))}
                    </p>
                  ) : null}
                </div>
              ) : g.kind === "content_report" && !noVariantAtAll ? (
                <p data-no-variant className="fb-note">No variant was attached to this report.</p>
              ) : null}
              {extra.length > 0 ? (
                <dl data-attached className="fb-attached" aria-label="Attached automatically">
                  {extra.map(([k, val]) => (
                    <div key={k} className="fb-pair">
                      <dt>{k}</dt>
                      <dd className="num">{val}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          );
        })}
      </ol>

      <Triage g={g} onSaved={onSaved} />
    </div>
  );
}

function Triage({ g, onSaved }: { g: FeedbackGroup; onSaved: () => void }) {
  const [status, setStatus] = useState<FeedbackStatus>(g.status);
  const [severity, setSeverity] = useState<FeedbackSeverity | null>(g.severity);
  const [release, setRelease] = useState(g.releasedIn ?? "");
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const severityChanged = severity !== g.severity;
  const releaseChanged = status === "shipped" && release.trim() !== (g.releasedIn ?? "");
  const changed = status !== g.status || severityChanged || releaseChanged;

  async function save() {
    setSaving(true);
    setRefusal(null);
    const body = {
      ids: g.reports.map((r) => r.id),
      status,
      ...(severityChanged ? { severity } : {}),
      ...(releaseChanged ? { releasedIn: release.trim() || null } : {}),
    };
    try {
      await api.triageFeedback(body);
      const t = triageToast(body.ids.length, status, severityChanged ? severity : undefined, releaseChanged ? release.trim() : undefined);
      toast.success(t.title, t.body);
      onSaved();
    } catch (e) {
      const why = e instanceof Error ? e.message : "Try again in a moment.";
      setRefusal(why);
      toast.error("Triage not saved", why);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-triage className="fb-triage">
      <div role="group" aria-label="Move to" className="fb-choices">
        <span className="fb-label" aria-hidden="true">Move to</span>
        {STATUS_ORDER.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} aria-pressed={status === s} onClick={() => setStatus(s)}>
            {FEEDBACK_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>
      <div role="group" aria-label="Severity" className="fb-choices">
        <span className="fb-label" aria-hidden="true">Severity</span>
        <Button size="sm" variant={severity === null ? "default" : "outline"} aria-pressed={severity === null} onClick={() => setSeverity(null)}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" /> None
        </Button>
        {SEVERITIES.map((s) => {
          const Icon = SEVERITY_ICON[s];
          return (
            <Button key={s} size="sm" variant={severity === s ? "default" : "outline"} aria-pressed={severity === s} onClick={() => setSeverity(s)}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {SEVERITY_WORD[s]}
            </Button>
          );
        })}
      </div>
      {status === "shipped" ? (
        <div className="fb-field fb-release">
          <label htmlFor={`fb-release-${g.key}`} className="fb-label">Released in</label>
          <input
            id={`fb-release-${g.key}`}
            className="fb-input num"
            value={release}
            maxLength={50}
            placeholder="e.g. 1.4"
            onChange={(e) => setRelease(e.target.value)}
          />
        </div>
      ) : null}
      {refusal ? (
        <p role="alert" className="fb-refusal">Not saved. {refusal}</p>
      ) : null}
      <div className="fb-save">
        <Button onClick={() => void save()} disabled={!changed || saving}>{saving ? "Saving…" : "Save"}</Button>
        <p className="fb-faint">
          {g.count === 1 ? "Applies to this report." : <>Applies to all <span className="num">{g.count}</span> reports.</>}
          {g.triagedBy ? <> Last triaged by {g.triagedBy.name ?? "a staff member"}{g.triagedAt ? <>, <span className="num">{when(g.triagedAt)}</span></> : null}.</> : null}
        </p>
      </div>
    </div>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton aria-busy="true" aria-label="Loading the feedback" className="fb-skeleton">
      {/* First, not last: at 380 a sentence below the fold says nothing. */}
      {slow ? <p className="fb-faint">Still loading. The server may be waking up; this can take up to a minute.</p> : null}
      <div className="fb-card fb-skel-sus"><div className="fb-skel fb-skel-line" /><div className="fb-skel fb-skel-line is-short" /></div>
      <div className="fb-skel fb-skel-tools" />
      <div className="fb-card">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="fb-skel-row"><div className="fb-skel" /><div className="fb-skel" /></div>)}
      </div>
    </div>
  );
}
