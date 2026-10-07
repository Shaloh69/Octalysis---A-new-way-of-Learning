import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type StageSummary } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { chapterPath } from "@/lib/studio-view";
import { Button } from "@/components/ui/button";
import { SendBackDialog, SummaryGroups, useFocusNext, useSummaryActions } from "../content/Summaries";
import { useStudio } from "./context";

/**
 * `/studio/review`: everything waiting for a teacher to read, in one place:
 * planet summaries, drafted lesson text and figures
 * (`design/templates/console/studio/SPEC.md`). An approval is of the exact
 * text on screen, bound to its hash; the approval rule (a teacher of the
 * subject, never the author; the admin may) shows as a disabled Approve with
 * its reason beside it. The drafted text and the figures are approved on
 * their chapter, where they can be read whole: each entry here is a link.
 */
export function ReviewView() {
  const { content, contentError, reloadContent, reloadAll } = useStudio();
  const sums = useAsync(() => api.contentSummaries(), []);
  const firstLoad = sums.loading && !sums.data;
  const skeleton = useDelayed(firstLoad, 400);

  const reload = () => {
    sums.reload();
    reloadAll();
  };
  const { busy, approve, focusAfter } = useSummaryActions(reload);
  useFocusNext(focusAfter, sums.data);

  const [sendBack, setSendBack] = useState<StageSummary | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const stages = content?.stages ?? [];
  const drafts = stages.filter((s) => s.draftStatus === "draft");
  const withFigures = stages.filter((s) => (s.figuresWaiting ?? 0) > 0);

  return (
    <div className="ct">
      <header className="ct-head">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>To review</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Planet summaries, drafted lesson text and figures. Nothing reaches students until a teacher of the subject
            approves it, and never the teacher who wrote it.
          </p>
        </div>
      </header>

      <section className="st-section" aria-labelledby="rv-summaries">
        <h2 id="rv-summaries" className="font-display text-lg text-ink">Summaries</h2>
        <p className="ct-caption">
          An approval is of the exact words shown: if the draft in its file changes, it comes back here to be read
          again. Drafts are written in <span className="num">content/stages/NN.md</span>.
        </p>
        {sums.error && !sums.data ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              The summaries could not be loaded. <span className="text-ink-muted">{sums.error}</span>
            </p>
            <Button size="sm" variant="outline" onClick={sums.reload}>Try again</Button>
          </div>
        ) : !sums.data ? (
          skeleton ? <div className="ct-card ct-skel ct-skel-table" data-skeleton aria-busy="true" /> : <div className="min-h-[20rem]" aria-busy="true" />
        ) : (
          <SummaryGroups
            nested
            summaries={sums.data.summaries}
            busy={busy}
            onApprove={(x, all) => void approve(x, all)}
            onSendBack={(x, el) => {
              opener.current = el;
              setSendBack(x);
            }}
          />
        )}
      </section>

      <section className="st-section" aria-labelledby="rv-drafts">
        <h2 id="rv-drafts" className="font-display text-lg text-ink">
          Drafted lesson text <span className="num text-ink-muted">{drafts.length}</span>
        </h2>
        {contentError && !content ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              Chapters could not be loaded. <span className="text-ink-muted">{contentError}</span>
            </p>
            <Button size="sm" variant="outline" onClick={reloadContent}>Try again</Button>
          </div>
        ) : drafts.length === 0 ? (
          <p className="ct-group-empty">Nothing waiting. Every drafted chapter has been read.</p>
        ) : (
          <ul className="st-waiting ct-card">
            {drafts.map((s) => (
              <li key={s.id} data-waiting-draft={s.id}>
                <span className="num">{s.id}</span>
                <Link className="ct-link" to={`${chapterPath(s.id)}?tab=draft`}>{s.title}</Link>
                <span className="ct-faint">drafted from the textbook, waiting for your review</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="st-section" aria-labelledby="rv-figures">
        <h2 id="rv-figures" className="font-display text-lg text-ink">
          Figures <span className="num text-ink-muted">{content?.summary.figures.waiting ?? 0}</span>
        </h2>
        {withFigures.length === 0 ? (
          <p className="ct-group-empty">Nothing waiting. Every drawn figure has been looked at.</p>
        ) : (
          <ul className="st-waiting ct-card">
            {withFigures.map((s) => (
              <li key={s.id} data-waiting-figures={s.id}>
                <span className="num">{s.id}</span>
                <Link className="ct-link" to={`${chapterPath(s.id)}?tab=figures`}>{s.title}</Link>
                <span className="ct-faint">
                  <span className="num">{s.figuresWaiting ?? 0}</span> {s.figuresWaiting === 1 ? "figure" : "figures"} waiting
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SendBackDialog
        summary={sendBack}
        onClose={() => setSendBack(null)}
        onDone={() => reload()}
        returnFocus={() => opener.current}
      />
    </div>
  );
}
