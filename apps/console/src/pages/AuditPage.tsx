import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Download } from "lucide-react";
import { AUDIT_FAMILY_LABELS, AuditFamily, type AuditEntry, type AuditPage as Page } from "@octa/contracts";
import { api } from "@/lib/api";
import {
  apiParams, dayHeading, dayKey, detailFields, entryDay, entryTime, filterWords, hasFilter, readFilters,
} from "@/lib/audit-view";
import { useDelayed } from "@/lib/useDelayed";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

/**
 * `/audit`: who changed what, when and why, and the evidence when a grade is
 * challenged. Rebuilt 28 Sep 2026 against `design/templates/console/audit/SPEC.md`;
 * gated by `design/specs/console-audit.spec.ts`.
 *
 * PAGE-SPECS.md asks for a log that is "immutable, filterable, exportable".
 * Before this rebuild it was none of the three in full: the database let
 * service_role rewrite it, the page filtered only the newest few hundred rows
 * it had loaded, and nothing exported. The instructor's rulings of that day:
 *
 *   - filters run on the SERVER, over the whole log; 100 a page, newest first,
 *     and Load older extends it (a keyset cursor), so October's evidence is
 *     still here in December. The filter lives in the address, so a view can
 *     be linked
 *   - Export CSV writes every entry the filter matches, not only what is loaded
 *   - append-only in the database, for every role (`schema.sql`)
 *
 * DENSE FIRST, the lesson D-4 taught on the submissions queue: the table is
 * the default and the timeline, which reads one incident in order, is the
 * alternative. THE REASON IS NEVER TRUNCATED, in any view: it is the field a
 * dispute turns on. Each entry's sentence is written by the API
 * (`services/api/src/audit/log.ts`), so this page and the CSV cannot disagree.
 *
 * There is no control here that edits, removes or clears an entry, and there
 * must never be one: a log a teacher can tidy proves nothing.
 */

/** Below this much of its own width the five columns do not fit, so the log is a list of cards. */
const WIDE_PX = 832; // 52rem

type View = "table" | "timeline";

const who = (e: AuditEntry) => (e.actor ? (e.actor.name ?? "An account with no name") : "System (scheduled)");

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const view: View = params.get("view") === "timeline" ? "timeline" : "table";
  const key = apiParams(filters).toString();
  const filtered = hasFilter(filters);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  /* ------------------------------------------------------------ the log */
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    api
      .audit(new URLSearchParams(key))
      .then((page) => {
        if (mine !== seq.current) return;
        setData(page);
        setFresh(new Set());
        setOpen(new Set());
      })
      .catch((e: unknown) => {
        if (mine === seq.current) setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, [key, tick]);

  const firstLoad = loading && !data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  const endRef = useRef<HTMLParagraphElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [focusEnd, setFocusEnd] = useState(false);

  async function loadOlder() {
    if (!data?.next) return;
    const mine = ++seq.current;
    const hadFocus = document.activeElement === moreRef.current;
    setLoading(true);
    try {
      const page = await api.audit(apiParams(filters, data.next));
      if (mine !== seq.current) return;
      setData((d) => (d ? { ...page, total: page.total, entries: [...d.entries, ...page.entries] } : page));
      setFresh(new Set(page.entries.map((e) => e.id)));
      // The button leaves when the start of the log is reached; focus goes to the sentence that replaces it.
      if (hadFocus && page.next === null) setFocusEnd(true);
    } catch (e) {
      toast.error("Older entries could not be loaded", e instanceof Error ? e.message : "Try again in a moment.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (focusEnd && endRef.current) {
      endRef.current.focus();
      setFocusEnd(false);
    }
  }, [focusEnd, data]);

  /* ------------------------------------------------------------ search */
  const [draft, setDraft] = useState(filters.q);
  useEffect(() => setDraft(filters.q), [filters.q]);
  useEffect(() => {
    if (draft.trim() === filters.q) return;
    const t = window.setTimeout(() => update({ q: draft.trim() || null }), 600);
    return () => window.clearTimeout(t);
    // `update` is left out on purpose: it is recreated every render and reads the current params itself.
  }, [draft, filters.q]);

  /* ------------------------------------------------------------ details */
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /* ------------------------------------------------------------ width */
  const box = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ------------------------------------------------------------ export */
  const [exporting, setExporting] = useState(false);
  const actorName = (id: string) => data?.actors.find((a) => a.id === id)?.name ?? "one account";
  const words = filterWords(filters, actorName);

  async function exportCsv() {
    setExporting(true);
    try {
      const csv = await api.auditCsv(apiParams(filters));
      const name = `octa-audit-${localDay()}.csv`;
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      const n = data?.total;
      toast.success(
        "Audit log exported",
        `${n === undefined ? "Every" : n.toLocaleString("en-US")} ${n === 1 ? "entry" : "entries"}${filtered ? ` (${words})` : ""}, in ${name}.`,
      );
    } catch (e) {
      toast.error("The audit log could not be exported", e instanceof Error ? e.message : "Nothing was saved. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }

  const entries = data?.entries ?? [];

  return (
    <div ref={box} className="au">
      <header className="au-head">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Audit log</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Who changed what, when and why. Nothing here can be edited or removed: the database refuses it, for
            every account.
          </p>
        </div>
        <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting || !data}>
          <Download aria-hidden className="size-4" />
          {exporting ? "Preparing…" : "Export CSV"}
        </Button>
      </header>

      <div className="au-tools" role="search" aria-label="Filter the log">
        <div className="au-field au-field-search">
          <label htmlFor="au-q" className="au-label">About whom or what</label>
          <Input
            id="au-q"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ q: draft.trim() || null });
            }}
            placeholder="A student, ID, stage, item or reason"
          />
        </div>
        <div className="au-field au-field-select">
          <label htmlFor="au-family" className="au-label">Action</label>
          <select
            id="au-family"
            className="au-select"
            value={filters.family ?? ""}
            onChange={(e) => update({ family: e.target.value || null })}
          >
            <option value="">All actions</option>
            {AuditFamily.options.map((f) => (
              <option key={f} value={f}>{AUDIT_FAMILY_LABELS[f]}</option>
            ))}
          </select>
        </div>
        <div className="au-field au-field-select">
          <label htmlFor="au-actor" className="au-label">Who</label>
          <select
            id="au-actor"
            className="au-select"
            value={filters.actor ?? ""}
            onChange={(e) => update({ actor: e.target.value || null })}
          >
            <option value="">Anyone</option>
            {(data?.actors ?? []).map((a) => (
              <option key={a.id ?? "system"} value={a.id ?? "system"}>{a.name}</option>
            ))}
            {filters.actor && !(data?.actors ?? []).some((a) => (a.id ?? "system") === filters.actor) ? (
              <option value={filters.actor}>{filters.actor === "system" ? "System (scheduled)" : "One account"}</option>
            ) : null}
          </select>
        </div>
        <div className="au-field au-field-date">
          <label htmlFor="au-from" className="au-label">From</label>
          <Input id="au-from" type="date" className="num" value={filters.from} max={filters.to || undefined}
                 onChange={(e) => update({ from: e.target.value || null })} />
        </div>
        <div className="au-field au-field-date">
          <label htmlFor="au-to" className="au-label">To</label>
          <Input id="au-to" type="date" className="num" value={filters.to} min={filters.from || undefined}
                 onChange={(e) => update({ to: e.target.value || null })} />
        </div>
        {filtered ? (
          <Button
            variant="ghost"
            className="au-clear"
            onClick={() => {
              setDraft("");
              update({ family: null, actor: null, q: null, from: null, to: null });
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The audit log could not be loaded. <span className="text-ink-muted">{error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>Try again</Button>
        </div>
      ) : firstLoad || !data ? (
        showSkeleton ? <Skeleton slow={slow} /> : <div className="au-reserve" aria-busy="true" />
      ) : (
        <>
          <div className="au-bar">
            <p data-result className="au-result" aria-live="polite">
              Showing <span className="num">{entries.length.toLocaleString("en-US")}</span> of{" "}
              <span className="num">{data.total.toLocaleString("en-US")}</span> {data.total === 1 ? "entry" : "entries"}
              {filtered ? <span className="au-result-filter"> · {words}</span> : null}
            </p>
            {loading ? <p data-loading role="status" className="au-loading">Loading…</p> : null}
            {error ? (
              <p role="alert" className="au-loading">
                That filter could not be applied. <button type="button" className="au-link" onClick={() => setTick((t) => t + 1)}>Try again</button>
              </p>
            ) : null}
            <div className="au-views" role="group" aria-label="How to show the log">
              {(["table", "timeline"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={view === v ? "default" : "outline"}
                  aria-pressed={view === v}
                  onClick={() => update({ view: v === "table" ? null : v })}
                >
                  {v === "table" ? "Table" : "Timeline"}
                </Button>
              ))}
            </div>
          </div>

          {entries.length === 0 ? (
            <div data-empty className="au-card au-empty">
              {filtered ? (
                <>
                  <p className="au-empty-title">Nothing matches: {words}</p>
                  <p className="au-faint">The filter runs over the whole log, not only what was on the page.</p>
                  <Button size="sm" variant="outline" onClick={() => { setDraft(""); update({ family: null, actor: null, q: null, from: null, to: null }); }}>
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="au-empty-title">Nothing recorded yet</p>
                  <p className="au-faint">Entries appear as soon as a roster is imported, a lock is changed or an item is reviewed.</p>
                </>
              )}
            </div>
          ) : view === "timeline" ? (
            <Timeline entries={entries} fresh={fresh} />
          ) : wide ? (
            <section className="au-card" aria-label="Entries">
              <table className="au-table">
                <colgroup>
                  <col className="c-when" />
                  <col className="c-who" />
                  <col />
                  <col className="c-reason" />
                  <col className="c-more" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Who</th>
                    <th scope="col">What happened</th>
                    <th scope="col">Reason</th>
                    <th scope="col"><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <Fragment key={e.id}>
                      <tr data-entry={e.id} data-family={e.family ?? ""} data-new={fresh.has(e.id) || undefined}
                          className={cn(open.has(e.id) && "is-open")}>
                        <td data-fact="when">
                          <time className="num au-when" dateTime={e.at}>
                            {entryDay(e.at)} <span className="au-time">{entryTime(e.at)}</span>
                          </time>
                        </td>
                        <td data-fact="who" className="au-who">{who(e)}</td>
                        <td data-fact="what">{e.what}</td>
                        {/* Wraps, never truncates: the field a dispute turns on. */}
                        <td data-fact="reason" className={e.reason ? "au-reason" : "au-none"}>{e.reason ?? "—"}</td>
                        <td className="au-more-cell">
                          <DetailsButton e={e} open={open.has(e.id)} onToggle={() => toggle(e.id)} />
                        </td>
                      </tr>
                      {open.has(e.id) ? (
                        <tr className="au-details-row">
                          <td colSpan={5}><Details e={e} /></td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <ul className="au-card au-list" aria-label="Entries">
              {entries.map((e) => (
                <li key={e.id} data-entry={e.id} data-family={e.family ?? ""} data-new={fresh.has(e.id) || undefined} className="au-item">
                  <p data-fact="what" className="au-item-what">{e.what}</p>
                  <p className="au-item-meta">
                    <span data-fact="who">{who(e)}</span>
                    <span aria-hidden> · </span>
                    <time data-fact="when" className="num" dateTime={e.at}>{entryDay(e.at)} {entryTime(e.at)}</time>
                  </p>
                  {e.reason ? <p data-fact="reason" className="au-quote">{e.reason}</p> : null}
                  <div>
                    <DetailsButton e={e} open={open.has(e.id)} onToggle={() => toggle(e.id)} />
                  </div>
                  {open.has(e.id) ? <Details e={e} /> : null}
                </li>
              ))}
            </ul>
          )}

          {entries.length > 0 ? (
            data.next ? (
              <Button ref={moreRef} variant="outline" className="au-older" onClick={() => void loadOlder()} disabled={loading}>
                Load older entries
                <span className="au-faint"> · <span className="num">{(data.total - entries.length).toLocaleString("en-US")}</span> more</span>
              </Button>
            ) : (
              <p ref={endRef} data-end tabIndex={-1} className="au-end">
                That is every entry {filtered ? "this filter matches" : "in the log"}.
              </p>
            )
          ) : null}
        </>
      )}
    </div>
  );
}

function DetailsButton({ e, open, onToggle }: { e: AuditEntry; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="au-details-btn"
      aria-expanded={open}
      aria-controls={`au-d-${e.id}`}
      aria-label={`Details: ${e.what}`}
      onClick={onToggle}
    >
      Details <ChevronDown aria-hidden className={cn("size-3.5 au-chevron", open && "is-open")} />
    </button>
  );
}

/**
 * Every recorded field, in words, then the raw keys a second reader might need.
 * Inline (the timeline) it is the fields alone: the keys are one Details away
 * in the table, and repeating them under every entry doubled the timeline.
 */
function Details({ e, inline = false }: { e: AuditEntry; inline?: boolean }) {
  const fields = detailFields(e);
  return (
    <div id={`au-d-${e.id}`} data-details={e.id} className={cn("au-details", inline && "is-inline")}>
      {fields.length > 0 ? (
        <dl className="au-fields">
          {fields.map((f) => (
            <div key={f.label} className="au-field-row">
              <dt>{f.label}</dt>
              <dd className={cn(f.mono && "num")}>
                {f.quote ? <blockquote className="au-quote">{f.value}</blockquote> : f.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {inline ? null : (
      <dl className="au-ids">
        <div className="au-field-row"><dt>Action</dt><dd className="num">{e.action}</dd></div>
        <div className="au-field-row"><dt>Entry</dt><dd className="num">{e.id}</dd></div>
        <div className="au-field-row">
          <dt>By</dt>
          <dd>{e.actor ? <>{who(e)} <span className="num au-faint">{e.actor.id}</span></> : "No person: a scheduled lock window"}</dd>
        </div>
        {e.subject ? (
          <div className="au-field-row">
            <dt>About</dt>
            <dd>{e.subject.name}{e.subject.studentId ? <> <span className="num au-faint">{e.subject.studentId}</span></> : null}</dd>
          </div>
        ) : null}
        {e.target ? (
          <div className="au-field-row">
            <dt>Target</dt>
            <dd>{e.target.label} <span className="num au-faint">{e.target.type}{e.target.id ? ` ${e.target.id}` : ""}</span></dd>
          </div>
        ) : null}
      </dl>
      )}
    </div>
  );
}

/** One incident, read in order: the same entries under day headings, every field inline. */
function Timeline({ entries, fresh }: { entries: AuditEntry[]; fresh: Set<string> }) {
  return (
    <ol className="au-card au-timeline" aria-label="Entries, by day">
      {entries.map((e, i) => {
        const newDay = i === 0 || dayKey(entries[i - 1]!.at) !== dayKey(e.at);
        return (
          <li key={e.id} data-entry={e.id} data-family={e.family ?? ""} data-new={fresh.has(e.id) || undefined} className="au-tl-item">
            {newDay ? <h2 className="au-day">{dayHeading(e.at)}</h2> : null}
            <div className="au-tl-entry">
              <time data-fact="when" className="num au-tl-time" dateTime={e.at}>{entryTime(e.at)}</time>
              <div className="min-w-0">
                <p data-fact="what" className="au-item-what">{e.what}</p>
                <p data-fact="who" className="au-item-meta">{who(e)}</p>
                {e.reason ? <p className="au-quote">{e.reason}</p> : null}
                <Details e={e} inline />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton aria-busy="true" aria-label="Loading the audit log" className="au-card au-skel-card">
      {/* First, not last: under ten rows it was below the fold at 380, and a sentence nobody sees says nothing. */}
      {slow ? <p className="au-faint au-skel-note">Still loading. The server may be waking up; this can take up to a minute.</p> : null}
      <div className="au-skel au-skel-head" />
      {Array.from({ length: 10 }, (_, i) => <div key={i} className="au-skel au-skel-row" />)}
    </div>
  );
}
