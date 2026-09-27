import { useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type StageSummary } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { Button } from "@/components/ui/button";
import { ChapterList, ChapterTable } from "./content/Chapters";
import { SendBackDialog, SummaryGroups, useFocusNext, useSummaryActions } from "./content/Summaries";

/**
 * `/content`: where each chapter stands, and the planet summaries waiting for
 * review. Rebuilt 28 Sep 2026 against `design/templates/console/content/SPEC.md`;
 * gated by `design/specs/console-content.spec.ts`. The editor for one chapter
 * is `ContentChapterPage`.
 *
 * The answer to "is the course ready?" is per chapter, and an aggregate hides
 * it. Three authoring states, and they are genuinely different things:
 *
 *   authored  real prose exists, written from the chapter's references
 *   planned   objectives and the syllabus topic outline, no teaching text yet
 *   empty     nothing synced at all
 *
 * **Planned is not a bug.** `scripts/gen-stages.mjs` transcribes what the
 * syllabus contains and refuses to invent the rest (hard rule 5). A stage that
 * shows its shape is honest; one filled with plausible paragraphs nobody
 * vetted is how a wrong definition reaches a student with the platform's
 * authority behind it.
 */

/** Below this much of its own width the nine columns do not fit, so the chapters are a list. */
const WIDE_PX = 896; // 56rem

type View = "chapters" | "summaries";

export function ContentPage() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "summaries" ? "summaries" : "chapters";
  const setView = (v: View) => setParams(v === "chapters" ? {} : { view: v }, { replace: false });

  const status = useAsync(() => api.content(), []);
  const sums = useAsync(() => api.contentSummaries(), []);
  const data = status.data;
  const firstLoad = status.loading && !data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

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

  const reloadAll = () => {
    status.reload();
    sums.reload();
  };
  const { busy, approve, focusAfter } = useSummaryActions(reloadAll);
  useFocusNext(focusAfter, sums.data);

  const [sendBack, setSendBack] = useState<StageSummary | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const afterSendBack = (s: StageSummary) => {
    focusAfter.current = sums.data?.summaries.find((x) => x.status === "draft" && x.stageId !== s.stageId)?.stageId ?? null;
    reloadAll();
  };

  const s = data?.summary;
  const toReview = s?.summaries.draft ?? 0;

  return (
    <div ref={box} className="ct">
      <header className="ct-head">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Content</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Where each chapter stands, and the planet summaries waiting for review. Open a chapter to fix its text.
          </p>
        </div>
      </header>

      {status.error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The content status could not be loaded. <span className="text-ink-muted">{status.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={reloadAll}>Try again</Button>
        </div>
      ) : firstLoad || !data || !s ? (
        showSkeleton ? <Skeleton slow={slow} /> : <div className="min-h-[40rem]" aria-busy="true" />
      ) : (
        <>
          <div className="ct-kpis">
            <Kpi id="authored" label="Chapters authored" value={<><span className="num">{s.authored}/{s.total}</span></>}
                 note={<><span className="num">{s.planned}</span> planned: objectives and outline, prose to come</>} />
            <Kpi id="summaries" label="Summaries approved" value={<span className="num">{s.summaries.approved}/{s.total}</span>}
                 note={toReview > 0
                   ? <button type="button" className="ct-link" onClick={() => setView("summaries")}><span className="num">{toReview}</span> to review</button>
                   : "none waiting for review"} />
            <Kpi id="edits" label="Edits not in git" value={<span className="num">{s.consoleEdited}</span>}
                 note={s.consoleEdited > 0
                   ? <>made in the console; run <span className="num">sync-content --pull</span> to write them into the files</>
                   : "every edit is in the files"} />
            <Kpi id="items" label="Live items" value={<span className="num">{s.liveItems}/{s.itemTarget}</span>}
                 note={<><span className="num">{s.itemTarget === 0 ? 0 : Math.round((s.liveItems / s.itemTarget) * 100)}%</span> of the target bank</>} />
          </div>

          <p className="ct-schedule">
            <span className="font-medium text-ink">The item bank is the schedule.</span> The target is about 40 live
            items per gradeable chapter, <span className="num">{s.itemTarget}</span> in all, and no amount of code
            substitutes for it. Every item is approved by hand on Items before a student can draw it.
          </p>

          <div className="ct-views" role="group" aria-label="Show">
            <Button size="sm" variant={view === "chapters" ? "default" : "outline"} aria-pressed={view === "chapters"} onClick={() => setView("chapters")}>
              Chapters
            </Button>
            <Button size="sm" variant={view === "summaries" ? "default" : "outline"} aria-pressed={view === "summaries"} onClick={() => setView("summaries")}>
              Summaries · <span className="num">{toReview}</span> to review
            </Button>
          </div>

          {view === "chapters" ? (
            <section className="ct-card" aria-label="Chapters">
              {wide ? <ChapterTable stages={data.stages} /> : <ChapterList stages={data.stages} />}
            </section>
          ) : sums.error && !sums.data ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
              <p className="min-w-0 flex-1 text-sm text-ink">
                The summaries could not be loaded. <span className="text-ink-muted">{sums.error}</span>
              </p>
              <Button size="sm" variant="outline" onClick={sums.reload}>Try again</Button>
            </div>
          ) : !sums.data ? (
            <div className="ct-card ct-skel" data-skeleton aria-busy="true" />
          ) : (
            <>
              <p className="ct-caption">
                An approval is of the exact words shown: if the draft in its file changes, it comes back here to be read
                again. Drafts are written in <span className="num">content/stages/NN.md</span>.
              </p>
              <SummaryGroups
                summaries={sums.data.summaries}
                busy={busy}
                onApprove={(x, all) => void approve(x, all)}
                onSendBack={(x, el) => {
                  opener.current = el;
                  setSendBack(x);
                }}
              />
            </>
          )}

          <p className="ct-caption">
            Text is written in <span className="num">content/stages/NN.md</span> and synced; a fix made here reaches
            students at once and is kept with its reason. Quotes from the book are edited in the file, where they are
            checked against it.
          </p>
        </>
      )}

      <SendBackDialog
        summary={sendBack}
        onClose={() => setSendBack(null)}
        onDone={afterSendBack}
        returnFocus={() => opener.current}
      />
    </div>
  );
}

function Kpi({ id, label, value, note }: { id: string; label: string; value: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="ct-card ct-kpi" data-kpi={id}>
      <p className="ct-kpi-label">{label}</p>
      <p className="ct-kpi-value">{value}</p>
      <p className="ct-kpi-note">{note}</p>
    </div>
  );
}

function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton aria-busy="true" aria-label="Loading the content status">
      <div className="ct-kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="ct-card ct-skel ct-skel-kpi" />)}
      </div>
      <div className="ct-card ct-skel ct-skel-table" />
      {slow ? <p className="ct-caption">Still loading. The server may be waking up; this can take up to a minute.</p> : null}
    </div>
  );
}
