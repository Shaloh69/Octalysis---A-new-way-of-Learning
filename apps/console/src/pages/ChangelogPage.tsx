import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PrelimCondition } from "@octa/contracts";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { CHANGELOG, KIND, byMonth, dayLabel, longDay, phaseState, type Update } from "@/lib/changelog-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * `/changelog`: what changed in OCTA, day by day, and how far the whole system
 * is (instructor, 7 Oct 2026, night). `design/templates/console/changelog/SPEC.md`,
 * against shadcn/ui's changelog; gated by `design/specs/console-changelog.spec.ts`.
 *
 * Everything but course readiness is the repository's, written at build time
 * by `scripts/changelog.mjs`; readiness is asked of the API on every visit,
 * and its failure never takes the rest of the page with it. The page reports;
 * it changes nothing.
 */

/** At this much of its own width and up, the index stands beside the column. */
const INDEX_PX = 1024; // 64rem

const MONTHS = byMonth(CHANGELOG.updates);
const { phases, roadmap, madeAt } = CHANGELOG;

const HOW: Record<PrelimCondition["how"], string> = {
  measured: "measured",
  test: "proved by a test",
  person: "checked by a person",
};

function conditionState(c: PrelimCondition): { word: string; tone: "success" | "warning" | "info" } {
  if (c.ok === null) return { word: "A person checks", tone: "info" };
  return c.ok ? { word: "Holds", tone: "success" } : { word: "Not yet", tone: "warning" };
}

export function ChangelogPage() {
  const box = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= INDEX_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="cg">
      <div className={wide ? "cg-grid" : undefined}>
        <article className="cg-col">
          <header className="cg-head">
            <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Changelog</h1>
            <p className="text-sm text-ink-muted">What changed in OCTA, day by day, and how far the whole system is.</p>
            <p className="cg-faint">
              Made at commit <span className="num">{madeAt.commit}</span>, {longDay(madeAt.date)}. Course readiness is live.
            </p>
          </header>

          <Progress />
          <Readiness />
          <Next />

          <section className="cg-section" aria-labelledby="cg-updates">
            <h2 id="cg-updates" className="cg-h2">Updates</h2>
            <p className="cg-faint">
              Newest first. Each day&apos;s highlights are written from its changes; every change is listed under them.
            </p>
            {MONTHS.map((m) => (
              <section key={m.key} className="cg-month" aria-labelledby={`cg-m-${m.key}`}>
                <h3 id={`cg-m-${m.key}`} className="cg-h3">{m.label}</h3>
                {m.updates.map((u) => <Day key={u.date} u={u} />)}
              </section>
            ))}
          </section>
        </article>

        {wide ? (
          <nav className="cg-index" aria-label="On this page">
            <p className="cg-index-title">On this page</p>
            <ul>
              <li><a href="#cg-progress">Progress</a></li>
              <li><a href="#cg-ready">Course readiness</a></li>
              <li><a href="#cg-next">What comes next</a></li>
              <li><a href="#cg-updates">Updates</a></li>
              {MONTHS.map((m) => (
                <li key={m.key} className="cg-index-sub"><a href={`#cg-m-${m.key}`}>{m.label}</a></li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function Progress() {
  return (
    <section className="cg-section" aria-labelledby="cg-progress">
      <h2 id="cg-progress" className="cg-h2">Progress</h2>

      <div className="cg-card">
        <h3 className="cg-h3">The redesign</h3>
        <p className="cg-big">
          <span className="num">{phases.done}</span> of <span className="num">{phases.total}</span> steps done
          {" "}<span className="cg-muted">(<span className="num">{phases.pct}%</span>)</span>
        </p>
        <ul className="cg-phases">
          {phases.redesign.map((p) => {
            const total = p.done + p.todo;
            const state = phaseState(p);
            return (
              <li key={p.id} className="cg-phase" data-phase={p.id}>
                <span className="num cg-phase-id">{p.id}</span>
                <span className="cg-phase-label">{p.label}</span>
                <span className="cg-bar" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={p.done}
                      aria-label={`${p.id}: ${p.done} of ${total} done`}>
                  <span className="cg-bar-fill" style={{ width: `${total === 0 ? 0 : (p.done / total) * 100}%` }} />
                </span>
                <span className="num cg-phase-count">{p.done}/{total}</span>
                <Badge tone={state === "done" ? "success" : state === "live" ? "info" : "neutral"}>{state}</Badge>
              </li>
            );
          })}
        </ul>
        <p className="cg-faint">Counted from the ticked boxes in <span className="num">docs/redesign/phases</span>, as <span className="num">pnpm phase</span> counts them.</p>
      </div>

      <div className="cg-card">
        <h3 className="cg-h3">The build plan</h3>
        <ul className="cg-build">
          {phases.build.map((p) => (
            <li key={p.id} data-build={p.id}>
              <span className="num cg-phase-id">{p.id}</span>
              <span className="cg-build-label">{p.label}</span>
              <span className="cg-build-status">{p.status || "no status line"}</span>
            </li>
          ))}
        </ul>
        <p className="cg-faint">Each status is read word for word from <span className="num">docs/PHASES.md</span>; they are prose, so no bar is drawn for them.</p>
      </div>
    </section>
  );
}

function Readiness() {
  const prog = useAsync(() => api.progress(), []);
  const content = useAsync(() => api.content(), []);
  const loading = prog.loading && !prog.data;
  const skeleton = useDelayed(loading, 400);
  const slow = useDelayed(loading, 3000);
  const p = prog.data?.prelim;
  const s = content.data?.summary;

  return (
    <section className="cg-section" aria-labelledby="cg-ready">
      <h2 id="cg-ready" className="cg-h2">Course readiness</h2>
      {prog.error && !p ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            Course readiness could not be loaded. <span className="text-ink-muted">{prog.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={() => { prog.reload(); content.reload(); }}>Try again</Button>
        </div>
      ) : !p ? (
        skeleton ? (
          <div data-skeleton aria-busy="true" aria-label="Loading course readiness">
            <div className="cg-card cg-skel" />
            {slow ? <p className="cg-faint">Still loading. The server may be waking up; this can take up to a minute.</p> : null}
          </div>
        ) : <div className="cg-reserve" aria-busy="true" />
      ) : (
        <div className="cg-card" data-readiness>
          <p className="cg-sentence" data-prelim={p.measuredOk ? "measured-ok" : "not-yet"}>
            {p.measuredOk ? (
              <>Every condition that can be measured holds. One is checked by a person before Prelim-worth of data is run on students.</>
            ) : (
              <>Prelim-worth of data is <strong>not yet</strong> okay to run on students.</>
            )}
          </p>
          <ul className="cg-conditions">
            {p.conditions.map((c) => {
              const st = conditionState(c);
              return (
                <li key={c.id} data-condition={c.id}>
                  <Badge tone={st.tone}>{st.word}</Badge>
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{c.label}</p>
                    <p className="cg-faint">{c.detail} · {HOW[c.how]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {s ? (
            <dl className="cg-kpis">
              <div><dt>Chapters authored</dt><dd className="num">{s.authored}/{s.total}</dd></div>
              <div><dt>Summaries approved</dt><dd className="num">{s.summaries.approved}/{s.total}</dd></div>
              <div><dt>Drafted chapters approved</dt><dd className="num">{s.chapters.approved}/{s.chapters.approved + s.chapters.draft + s.chapters.sentBack}</dd></div>
              <div><dt>Figures approved</dt><dd className="num">{s.figures.approved}/{s.figures.approved + s.figures.waiting}</dd></div>
              <div><dt>Live questions</dt><dd className="num">{s.liveItems}/{s.itemTarget}</dd></div>
            </dl>
          ) : null}
          <p className="cg-faint">
            Approve what waits on <Link className="cg-link" to="/studio/review">To review</Link> and{" "}
            <Link className="cg-link" to="/items">Items</Link>. Counted from this deployment&apos;s database just now.
          </p>
        </div>
      )}
    </section>
  );
}

function Next() {
  return (
    <section className="cg-section" aria-labelledby="cg-next">
      <h2 id="cg-next" className="cg-h2">What comes next</h2>
      <div className="cg-card">
        <p className="cg-faint">In the approved order.</p>
        <ol className="cg-next">
          {roadmap.next.map((n) => (
            <li key={n.id} data-next={n.id}>
              <span className="num cg-phase-id">{n.id}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {n.title} <Badge tone={n.state === "in progress" ? "info" : n.state.startsWith("built") ? "success" : "neutral"}>{n.state}</Badge>
                </p>
                <p className="cg-faint">{n.what}</p>
              </div>
            </li>
          ))}
        </ol>
        <h3 className="cg-h3">Waiting on you</h3>
        <ul className="cg-owed">
          {roadmap.owed.map((o) => <li key={o}>{o}</li>)}
        </ul>
      </div>
    </section>
  );
}

function Day({ u }: { u: Update }) {
  const [open, setOpen] = useState(u.highlights.length === 0);
  const id = `cg-c-${u.date}`;
  return (
    <article className="cg-day" data-day={u.date} aria-labelledby={`cg-d-${u.date}`}>
      <h4 id={`cg-d-${u.date}`} className="cg-day-title">
        <span className="num">{dayLabel(u.date)}</span> · {u.title}
      </h4>
      {u.highlights.length > 0 ? (
        <ul className="cg-highlights">{u.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
      ) : (
        <p className="cg-faint">No written highlights for this day.</p>
      )}
      {u.commits.length > 0 ? (
        <>
          <button type="button" className="cg-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            <span aria-hidden="true" className="cg-chev">{open ? "▾" : "▸"}</span>
            All <span className="num">{u.commits.length}</span> {u.commits.length === 1 ? "change" : "changes"}
          </button>
          {open ? (
            <ul id={id} className="cg-commits">
              {u.commits.map((c) => (
                <li key={c.hash}>
                  <span className="cg-kind">{KIND[c.type] ?? c.type}</span>
                  {c.scope ? <span className="num cg-scope">{c.scope}</span> : null}
                  <span className="cg-subject">{c.subject}</span>
                  <span className="num cg-hash">{c.hash}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
