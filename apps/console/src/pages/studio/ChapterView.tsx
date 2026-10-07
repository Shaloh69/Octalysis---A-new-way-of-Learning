import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type ChapterDetail, type ContentBlock, type StageSummary } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { ACT_NAMES, AUTHORING_WORD } from "@/lib/content-view";
import { isTab, subjectFromSlug, subjectPath, tabsFor, type Tab } from "@/lib/studio-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BlockRow, type Editing } from "../content/BlockRow";
import { Preview } from "../content/Preview";
import { SendBackDialog, SummaryEntry, useSummaryActions } from "../content/Summaries";
import { DraftCard } from "../content/Draft";
import { FigureCard } from "../content/FigureCard";
import { NotFound } from "./NotFound";
import { useStudio } from "./context";

/**
 * `/studio/:subject/:stageId`: one chapter (`design/templates/console/studio/SPEC.md`),
 * what `/content/:stageId` was, in tabs. Every rule it kept is still here:
 * a save changes what students read at once and needs a change, a reason and
 * the version the editor opened (409 on a stale one); every replaced version
 * is kept by the database, shown under History with Use this text; a quote from
 * the book is read-only here, edited in its `.md` where `sync-content --verify`
 * checks it; sync never overwrites a console edit.
 *
 * Approvals are of one exact text, by its hash, and obey the approval rule
 * (`lib/approval-gate.tsx`): an Approve a teacher may not use is disabled with
 * the reason beside it.
 */

/** At this much of its own width and up, the blocks and the preview sit side by side. */
const SPLIT_PX = 832; // 52rem: the Studio's editor pane is narrower than /content's was

type Half = "blocks" | "preview";

export function ChapterView() {
  const { subject: slug = "", stageId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { subjects, content, reloadContent } = useStudio();

  const code = subjects ? subjectFromSlug(slug, subjects.subjects.map((s) => s.code)) : null;
  const subject = subjects?.subjects.find((s) => s.code === code);
  const known = content?.stages.some((s) => s.id === stageId);
  const wanted = Boolean(subject?.hasChapters) && known !== false;

  const q = useAsync(() => (wanted ? api.contentChapter(stageId) : Promise.resolve(null)), [stageId, wanted]);
  const data = q.data;
  const firstLoad = q.loading && !data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  const box = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSplit(el.getBoundingClientRect().width >= SPLIT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });
  const [half, setHalf] = useState<Half>("blocks");

  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const returnTo = useRef<number | null>(null);

  // A different chapter is a different editor: nothing typed carries over.
  useEffect(() => {
    setEditing(null);
    setSaveError(null);
  }, [stageId]);

  // Focus home to a block's Edit control after it closes (Cancel or Save).
  useEffect(() => {
    if (editing !== null || returnTo.current === null) return;
    const n = returnTo.current;
    const el = document.querySelector<HTMLElement>(`[data-block="${n}"] [data-edit]`);
    if (el) {
      returnTo.current = null;
      el.focus();
    }
  }, [editing, data]);

  // Keep the block being edited in view in the preview pane.
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing || !preview.current) return;
    preview.current.querySelector<HTMLElement>("[data-editing]")?.scrollIntoView({ block: "nearest" });
  }, [editing?.blockId, half, split]);

  function start(b: ContentBlock, text?: string) {
    setSaveError(null);
    setEditing({ blockId: b.id, text: text ?? b.body, reason: "" });
  }
  function cancel(b: ContentBlock) {
    returnTo.current = b.ordinal;
    setSaveError(null);
    setEditing(null);
  }
  async function save(b: ContentBlock) {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.saveBlock(b.id, { body: editing.text, version: b.version, reason: editing.reason.trim() });
      toast.success(
        `Stage ${stageId}, block ${b.ordinal} saved as version ${res.block.version}`,
        "Students read the new text now. It reaches git with sync-content --pull.",
      );
      returnTo.current = b.ordinal;
      setEditing(null);
      q.reload();
      reloadContent();
    } catch (e) {
      const m = e instanceof Error ? e.message : "It was not saved.";
      setSaveError(m);
      toast.error(`Block ${b.ordinal} was not saved`, `${m} Your text is still in the editor.`);
    } finally {
      setSaving(false);
    }
  }

  const changed = () => {
    q.reload();
    reloadContent();
  };
  const { busy, approve } = useSummaryActions(changed);
  const [sendBack, setSendBack] = useState<StageSummary | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const st = data?.stage;
  const edited = data?.blocks.filter((b) => b.consoleEdited).length ?? 0;
  const figureMap = useMemo(() => new Map((data?.figures ?? []).map((f) => [f.id, f])), [data]);
  const tabs = data ? tabsFor(data) : [];
  const asked = params.get("tab");
  const tab: Tab = isTab(asked) && tabs.some((t) => t.id === asked) ? asked : "blocks";
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "blocks") next.delete("tab");
    else next.set("tab", t);
    setParams(next, { replace: true });
  };

  // ---- an unknown subject or chapter says so, in words, with a way back ----
  if (subjects && !subject) return <NotFound what={`No subject ${slug}.`} />;
  if (subject && !subject.hasChapters) {
    return <NotFound what={`${subject.code} has no chapters yet. A subject's own star system arrives with CS2.`} />;
  }
  if (content && known === false) return <NotFound what={`No chapter ${stageId} in ${subject?.code ?? "this subject"}.`} />;

  const crumb = (
    <nav className="st-crumb" aria-label="Breadcrumb">
      <Link className="ct-link" to={subject ? subjectPath(subject.code) : "/studio"}>{subject?.code ?? "Studio"}</Link>
      <span aria-hidden="true"> › </span>
      <span aria-current="page"><span className="num">{stageId}</span>{st ? ` ${st.title}` : ""}</span>
    </nav>
  );

  return (
    <div ref={box} className="ct">
      {crumb}

      {q.error && !data ? (
        <>
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Stage <span className="num">{stageId}</span></h1>
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              This chapter could not be loaded. <span className="text-ink-muted">{q.error}</span>
            </p>
            <Button size="sm" variant="outline" onClick={q.reload}>Try again</Button>
          </div>
        </>
      ) : firstLoad || !data || !st ? (
        <>
          <h1 className="font-display text-2xl text-ink" tabIndex={-1}>Stage <span className="num">{stageId}</span></h1>
          {showSkeleton ? (
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
                {ACT_NAMES[st.act] ?? st.act} · {AUTHORING_WORD[st.authoring]} · <span className="num">{data.blocks.length}</span> blocks
                {!st.gradeable ? " · not graded" : null}
                {edited > 0 ? <> · <span className="num">{edited}</span> edited in the console, not yet in git</> : null}
              </p>
            </div>
          </header>

          <Tabs tabs={tabs} tab={tab} onTab={setTab} />

          {tab === "blocks" ? (
            <div role="tabpanel" id="st-panel-blocks" aria-labelledby="st-tab-blocks" tabIndex={-1} className="st-panel">
              {!split ? (
                <div className="ct-views" role="group" aria-label="Show">
                  <Button size="sm" variant={half === "blocks" ? "default" : "outline"} aria-pressed={half === "blocks"} onClick={() => setHalf("blocks")}>
                    Blocks
                  </Button>
                  <Button size="sm" variant={half === "preview" ? "default" : "outline"} aria-pressed={half === "preview"} onClick={() => setHalf("preview")}>
                    Preview
                  </Button>
                </div>
              ) : null}
              <div className={split ? "ct-split" : undefined}>
                {split || half === "blocks" ? (
                  <section className="ct-card ct-blocks" data-blocks aria-labelledby="blocks-title">
                    <div className="ct-pane-head">
                      <h2 id="blocks-title" className="ct-h2">Blocks</h2>
                      <p className="ct-faint">In the order students read them. Structure is the file&apos;s; text can be fixed here.</p>
                    </div>
                    <ol className="ct-block-list">
                      {data.blocks.map((b) => (
                        <BlockRow
                          key={b.id}
                          b={b}
                          stageId={st.id}
                          editing={editing}
                          anyOpen={editing !== null}
                          saving={saving}
                          error={editing?.blockId === b.id ? saveError : null}
                          onStart={start}
                          onChange={(p) => setEditing((e) => (e ? { ...e, ...p } : e))}
                          onCancel={() => cancel(b)}
                          onSave={(x) => void save(x)}
                        />
                      ))}
                    </ol>
                  </section>
                ) : null}
                {split || half === "preview" ? (
                  <Preview ref={preview} blocks={data.blocks} editing={editing} title={`${st.id} · ${st.title}`} figures={figureMap} />
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "summary" ? (
            <div role="tabpanel" id="st-panel-summary" aria-labelledby="st-tab-summary" tabIndex={-1} className="st-panel">
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
            </div>
          ) : null}

          {tab === "draft" && data.draft ? (
            <div role="tabpanel" id="st-panel-draft" aria-labelledby="st-tab-draft" tabIndex={-1} className="st-panel">
              <DraftCard stageId={st.id} title={st.title} draft={data.draft} liveBlocks={data.blocks.length} onChanged={changed} figures={figureMap} />
            </div>
          ) : null}

          {tab === "figures" && data.figures.length > 0 ? (
            <div role="tabpanel" id="st-panel-figures" aria-labelledby="st-tab-figures" tabIndex={-1} className="st-panel">
              <section className="ct-card fg-section" data-figures aria-labelledby="figures-title">
                <div className="ct-pane-head">
                  <h2 id="figures-title" className="ct-h2">Figures</h2>
                  <p className="ct-faint">
                    Drawn for this course from the book&apos;s figures, never copied.{" "}
                    <span className="num">{data.figures.filter((f) => f.status !== "approved").length}</span> of{" "}
                    <span className="num">{data.figures.length}</span> waiting for review.
                  </p>
                </div>
                <div className="fg-list">
                  {data.figures.map((f) => <FigureCard key={f.id} figure={f} onChanged={changed} />)}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "objectives" ? (
            <div role="tabpanel" id="st-panel-objectives" aria-labelledby="st-tab-objectives" tabIndex={-1} className="st-panel">
              <Objectives data={data} stage={content?.stages.find((s) => s.id === st.id)} />
            </div>
          ) : null}
        </>
      )}

      <SendBackDialog
        summary={sendBack}
        onClose={() => setSendBack(null)}
        onDone={() => changed()}
        returnFocus={() => opener.current}
      />
    </div>
  );
}

/** A tablist after the WAI-ARIA pattern: arrows move between tabs, Home and End go to the ends. */
function Tabs({ tabs, tab, onTab }: { tabs: ReturnType<typeof tabsFor>; tab: Tab; onTab: (t: Tab) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onKey(e: React.KeyboardEvent, i: number) {
    const to = e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = tabs[to]!;
    onTab(next.id);
    refs.current[next.id]?.focus();
  }
  return (
    <div className="st-tabs" role="tablist" aria-label="Parts of this chapter">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          type="button"
          role="tab"
          id={`st-tab-${t.id}`}
          aria-selected={t.id === tab}
          aria-controls={`st-panel-${t.id}`}
          tabIndex={t.id === tab ? 0 : -1}
          className="st-tab"
          data-tab={t.id}
          onClick={() => onTab(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {t.waiting ? <span className="st-tab-note">to review</span> : null}
        </button>
      ))}
    </div>
  );
}

/** The syllabus's objectives for the chapter, read-only: they are the syllabus's contract, verbatim. */
function Objectives({ data, stage }: {
  data: ChapterDetail;
  stage: { liveItems: number; draftItems: number } | undefined;
}) {
  const objectives = data.objectives ?? [];
  return (
    <section className="ct-card st-card" aria-labelledby="ob-title" data-objectives>
      <div className="st-head-col">
        <h2 id="ob-title" className="ct-h2">Objectives <span className="num text-ink-muted">{objectives.length}</span></h2>
        <p className="ct-faint">
          The syllabus&apos;s own words, transcribed verbatim and checked by <span className="num">pnpm check:objectives</span>.
          They are not edited here.
        </p>
      </div>
      {objectives.length === 0 ? (
        <p className="ct-group-empty">This chapter has no objectives recorded.</p>
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
      <Badge tone="neutral" className="self-start">Read-only</Badge>
    </section>
  );
}
