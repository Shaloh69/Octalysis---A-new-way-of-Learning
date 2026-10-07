import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDelayed } from "@/lib/useDelayed";
import { Button } from "@/components/ui/button";
import { ChapterList, ChapterTable } from "../content/Chapters";
import { useStudio } from "./context";

/**
 * `/studio`: where every chapter stands. What `/content` was, in the editor pane
 * (`design/templates/console/studio/SPEC.md`; its rules are
 * `design/templates/console/content/SPEC.md`'s, unchanged). The answer to "is
 * the course ready?" is per chapter, and an aggregate hides it: authored,
 * planned or empty, never "8 of 19" alone. A planned chapter is not a bug; the
 * syllabus's outline is transcribed and the prose is not invented (hard rule 5).
 */

/** Below this much of its own width the columns do not fit, so the chapters are a list. */
const WIDE_PX = 896; // 56rem

export function OverviewView() {
  const { content, contentError, reloadContent } = useStudio();
  const s = content?.summary;
  const first = !content && !contentError;
  const skeleton = useDelayed(first, 400);
  const slow = useDelayed(first, 3000);

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

  const toReview = s?.summaries.draft ?? 0;

  return (
    <div ref={box} className="ct">
      <header className="ct-head">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Course Studio</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Where each chapter stands, what waits for review, and the subjects and books behind them. Open a chapter to
            fix its text.
          </p>
        </div>
      </header>

      {contentError && !content ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The chapters could not be loaded. <span className="text-ink-muted">{contentError}</span>
          </p>
          <Button size="sm" variant="outline" onClick={reloadContent}>Try again</Button>
        </div>
      ) : !content || !s ? (
        skeleton ? (
          <div data-skeleton aria-busy="true" aria-label="Loading the chapters">
            <div className="ct-kpis">
              {[0, 1, 2, 3].map((i) => <div key={i} className="ct-card ct-skel ct-skel-kpi" />)}
            </div>
            <div className="ct-card ct-skel ct-skel-table" />
            {slow ? <p className="ct-caption">Still loading. The server may be waking up; this can take up to a minute.</p> : null}
          </div>
        ) : <div className="min-h-[40rem]" aria-busy="true" />
      ) : (
        <>
          <div className="ct-kpis">
            <Kpi id="authored" label="Chapters authored" value={<span className="num">{s.authored}/{s.total}</span>}
                 note={<><span className="num">{s.planned}</span> planned: objectives and outline, prose to come</>} />
            <Kpi id="summaries" label="Summaries approved" value={<span className="num">{s.summaries.approved}/{s.total}</span>}
                 note={toReview > 0
                   ? <Link className="ct-link" to="/studio/review"><span className="num">{toReview}</span> to review</Link>
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

          <section className="ct-card" aria-label="Chapters">
            {wide ? <ChapterTable stages={content.stages} /> : <ChapterList stages={content.stages} />}
          </section>

          <p className="ct-caption">
            Text is written in <span className="num">content/stages/NN.md</span> and synced; a fix made here reaches
            students at once and is kept with its reason. Quotes from the book are edited in the file, where they are
            checked against it.
          </p>
        </>
      )}
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
