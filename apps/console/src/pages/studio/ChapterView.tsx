import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChapterDetail, type StageSummary } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { ACT_NAMES, AUTHORING_WORD } from "@/lib/content-view";
import { subjectFromSlug, subjectPath } from "@/lib/studio-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendBackDialog, SummaryEntry, useSummaryActions } from "../content/Summaries";
import { DraftSendBack } from "../content/Draft";
import { FigureCard } from "../content/FigureCard";
import { NotFound } from "./NotFound";
import { useStudio } from "./context";

/**
 * `/studio/:subject/:stageId`: one chapter, as a document (docs/STUDIO-EDITOR-PLAN.md,
 * E1.3; instructor rulings, 8 Oct 2026). A page you click into and type in, under
 * one toolbar, autosaved as a draft students never see, and Publish. Under the
 * page: the planet summary, the chapter's moons (its objectives, in the
 * syllabus's words) and its figures, each reviewed where it can be read.
 *
 * What it keeps from `/content`: an approval is of one exact text, by its hash;
 * every replaced topic is kept by the database (History); a quote from the book is
 * checked word for word and never typed here; sync-content never overwrites a
 * chapter the console owns; the approval rule shows as a disabled button with
 * the reason beside it.
 *
 * The editor is its own chunk, loaded when a chapter opens, so the console's
 * first load does not carry an editor engine.
 */

const ChapterEditor = lazy(() => import("./editor/ChapterEditor").then((m) => ({ default: m.ChapterEditor })));

export function ChapterView() {
  const { subject: slug = "", stageId = "" } = useParams();
  const { subjects, content, reloadContent } = useStudio();

  const code = subjects ? subjectFromSlug(slug, subjects.subjects.map((s) => s.code)) : null;
  const subject = subjects?.subjects.find((s) => s.code === code);
  const known = content?.stages.some((s) => s.id === stageId);
  const wanted = Boolean(subject?.hasChapters) && known !== false;

  const q = useAsync(() => (wanted ? api.contentChapter(stageId) : Promise.resolve(null)), [stageId, wanted]);
  const wc = useAsync(() => (wanted ? api.workingCopy(stageId) : Promise.resolve(null)), [stageId, wanted]);
  const [epoch, setEpoch] = useState(0);
  const data = q.data;
  const working = wc.data;
  const firstLoad = (q.loading && !data) || (wc.loading && !working);
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  const reloadAll = () => {
    setEpoch((e) => e + 1);
    q.reload();
    wc.reload();
    reloadContent();
  };
  const { busy, approve } = useSummaryActions(reloadAll);
  const [sendBack, setSendBack] = useState<StageSummary | null>(null);
  const [sendingDraft, setSendingDraft] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const figureMap = useMemo(() => new Map((data?.figures ?? []).map((f) => [f.id, f])), [data]);

  // ---- an unknown subject or chapter says so, in words, with a way back ----
  if (subjects && !subject) return <NotFound what={`No subject ${slug}.`} />;
  if (subject && !subject.hasChapters) {
    return <NotFound what={`${subject.code} has no chapters yet. A subject's own star system arrives with CS2.`} />;
  }
  if (content && known === false) return <NotFound what={`No chapter ${stageId} in ${subject?.code ?? "this subject"}.`} />;

  const st = data?.stage;
  const crumb = (
    <nav className="st-crumb" aria-label="Breadcrumb">
      <Link className="ct-link" to={subject ? subjectPath(subject.code) : "/studio"}>{subject?.code ?? "Studio"}</Link>
      <span aria-hidden="true"> › </span>
      <span aria-current="page"><span className="num">{stageId}</span>{st ? ` ${st.title}` : ""}</span>
    </nav>
  );

  const failed = (q.error && !data) || (wc.error && !working);
  const ready = data && st && working && !wc.loading && !q.loading;

  return (
    <div className="ct">
      {crumb}

      {failed ? (
        <>
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Stage <span className="num">{stageId}</span></h1>
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              This chapter could not be loaded. <span className="text-ink-muted">{q.error ?? wc.error}</span>
            </p>
            <Button size="sm" variant="outline" onClick={reloadAll}>Try again</Button>
          </div>
        </>
      ) : !ready ? (
        <>
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Stage <span className="num">{stageId}</span></h1>
          {showSkeleton || (data && working) ? (
            <div data-skeleton aria-busy="true" aria-label="Loading the chapter">
              <div className="ct-card ct-skel ct-skel-kpi" />
              <div className="ct-card ct-skel ct-skel-table" />
              {slow ? <p className="ct-caption">Still loading. The server may be waking up; this can take up to a minute.</p> : null}
            </div>
          ) : <div className="min-h-[40rem]" aria-busy="true" />}
        </>
      ) : (
        <>
          <header className="ct-head">
            <div className="min-w-0">
              <h1 className="font-display text-2xl text-ink" tabIndex={-1}>
                <span className="num">{st.id}</span> · {st.title}
              </h1>
              <p className="text-sm text-ink-muted">
                {ACT_NAMES[st.act] ?? st.act} · {AUTHORING_WORD[st.authoring]} · <span className="num">{data.blocks.length}</span> topics published
                {!st.gradeable ? " · not graded" : null}
                {working.owner === "console" ? " · text owned by the Studio" : null}
              </p>
            </div>
          </header>

          <Suspense fallback={<div className="ed-shell" data-skeleton aria-busy="true" aria-label="Loading the editor"><div className="ct-card ct-skel ct-skel-table" /></div>}>
            <ChapterEditor
              key={epoch}
              stageId={st.id}
              title={`${st.id} · ${st.title}`}
              initial={working}
              live={data.blocks}
              figures={figureMap}
              onChanged={reloadAll}
              sendBack={working.origin === "file" ? () => setSendingDraft(true) : undefined}
            />
          </Suspense>

          <section className="ct-card ct-summary-card" data-summary-card aria-label="Planet summary">
            {data.summary ? (
              <SummaryEntry
                s={data.summary}
                all={[data.summary]}
                busy={busy}
                linkTitle={false}
                heading="Planet summary"
                headingLevel={2}
                onApprove={(x, all) => void approve(x, all)}
                onSendBack={(x, el) => {
                  opener.current = el;
                  setSendBack(x);
                }}
              />
            ) : (
              <p className="ct-faint">
                No summary drafted. Write one as <span className="num">summary:</span> in{" "}
                <span className="num">content/stages/{st.id}.md</span> and sync; it will wait here for review.
              </p>
            )}
          </section>

          <Moons data={data} stage={content?.stages.find((s) => s.id === st.id)} />

          {data.figures.length > 0 ? (
            <section className="ct-card fg-section" data-figures aria-labelledby="figures-title">
              <div className="st-head-col">
                <h2 id="figures-title" className="ct-h2">Figures</h2>
                <p className="ct-faint">
                  Drawn for this course from the book&apos;s figures, never copied.{" "}
                  <span className="num">{data.figures.filter((f) => f.status !== "approved").length}</span> of{" "}
                  <span className="num">{data.figures.length}</span> waiting for review.
                </p>
              </div>
              <div className="fg-list">
                {data.figures.map((f) => <FigureCard key={f.id} figure={f} onChanged={reloadAll} />)}
              </div>
            </section>
          ) : null}
        </>
      )}

      <SendBackDialog
        summary={sendBack}
        onClose={() => setSendBack(null)}
        onDone={() => reloadAll()}
        returnFocus={() => opener.current}
      />
      {st ? (
        <DraftSendBack
          open={sendingDraft}
          stageId={st.id}
          title={st.title}
          onClose={() => setSendingDraft(false)}
          onDone={reloadAll}
          returnFocus={() => null}
        />
      ) : null}
    </div>
  );
}

/** The chapter's moons: its objectives, in the syllabus's words. Read-only until E2 (docs/STUDIO-EDITOR-PLAN.md). */
function Moons({ data, stage }: { data: ChapterDetail; stage: { liveItems: number; draftItems: number } | undefined }) {
  const objectives = data.objectives ?? [];
  return (
    <section className="ct-card st-card" aria-labelledby="ob-title" data-objectives>
      <div className="st-head-col">
        <h2 id="ob-title" className="ct-h2">Moons <span className="num text-ink-muted">{objectives.length}</span></h2>
        <p className="ct-faint">
          Each moon is an objective of this chapter, in the syllabus&apos;s own words. Editing, adding and retiring moons is the
          next piece of the Studio&apos;s work: it changes what opens a planet, so it comes with its own plan.
        </p>
      </div>
      {objectives.length === 0 ? (
        <p className="ct-group-empty">This chapter has no moons recorded.</p>
      ) : (
        <ol className="st-objectives">
          {objectives.map((o) => (
            <li key={o.code} data-objective={o.code}>
              <span className="num st-ob-code">{o.code}</span>
              <div className="min-w-0">
                <p className="text-sm text-ink">{o.description}</p>
                <p className="ct-faint">
                  {o.bloom}
                  {o.competency ? <> · {o.competency}</> : null}
                  {o.level !== null ? <> · level <span className="num">{o.level}</span></> : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {stage ? (
        <p className="text-sm text-ink" data-chapter-items>
          <span className="num">{stage.liveItems}</span> live {stage.liveItems === 1 ? "question" : "questions"}
          {stage.draftItems > 0 ? <> and <span className="num">{stage.draftItems}</span> in review</> : null}.{" "}
          <Link className="ct-link" to="/items">Open Items</Link> to review them.
        </p>
      ) : null}
      <Badge tone="neutral" className="self-start">Read-only for now</Badge>
    </section>
  );
}
