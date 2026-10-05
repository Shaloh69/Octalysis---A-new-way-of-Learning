import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, type ContentBlock, type StageSummary } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { ACT_NAMES, AUTHORING_WORD } from "@/lib/content-view";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BlockRow, type Editing } from "./content/BlockRow";
import { Preview } from "./content/Preview";
import { SendBackDialog, SummaryEntry, useSummaryActions } from "./content/Summaries";
import { DraftCard } from "./content/Draft";

/**
 * `/content/:stageId`: one chapter, its summary, and its blocks beside a
 * preview of what a student reads. `design/templates/console/content/SPEC.md`
 * (Decap's split editor, Dillinger's source pane); gated by
 * `design/specs/console-content.spec.ts`.
 *
 * A save changes what students read at once (`PUT /content/blocks/:id`): the
 * reason is required, the version the editor opened is sent so a second
 * teacher's save is never silently overwritten, and the text it replaces is
 * kept by the database's archive trigger. `sync-content` never overwrites a
 * console edit; `--pull` writes it into the chapter's `.md`.
 */

/** At this much of its own width and up, the blocks and the preview sit side by side. */
const SPLIT_PX = 992; // 62rem

type Half = "blocks" | "preview";

export function ContentChapterPage() {
  const { stageId = "" } = useParams();
  const q = useAsync(() => api.contentChapter(stageId), [stageId]);
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
  }, []);
  const [half, setHalf] = useState<Half>("blocks");

  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const returnTo = useRef<number | null>(null);

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
    const el = preview.current.querySelector<HTMLElement>("[data-editing]");
    el?.scrollIntoView({ block: "nearest" });
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
    } catch (e) {
      const m = e instanceof Error ? e.message : "It was not saved.";
      setSaveError(m);
      toast.error(`Block ${b.ordinal} was not saved`, `${m} Your text is still in the editor.`);
    } finally {
      setSaving(false);
    }
  }

  const { busy, approve } = useSummaryActions(q.reload);
  const [sendBack, setSendBack] = useState<StageSummary | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const st = data?.stage;
  const edited = data?.blocks.filter((b) => b.consoleEdited).length ?? 0;

  return (
    <div ref={box} className="ct">
      <Link to="/content" className="ct-back">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Content
      </Link>

      {q.error && !data ? (
        <>
          <h1 className="font-display text-2xl text-ink">Stage <span className="num">{stageId}</span></h1>
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              This chapter could not be loaded. <span className="text-ink-muted">{q.error}</span>
            </p>
            <Button size="sm" variant="outline" onClick={q.reload}>Try again</Button>
          </div>
        </>
      ) : firstLoad || !data || !st ? (
        <>
          <h1 className="font-display text-2xl text-ink">Stage <span className="num">{stageId}</span></h1>
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
              <h1 className="font-display text-2xl text-ink">
                <span className="num">{st.id}</span> · {st.title}
              </h1>
              <p className="text-sm text-ink-muted">
                {ACT_NAMES[st.act] ?? st.act} · {AUTHORING_WORD[st.authoring]} · <span className="num">{data.blocks.length}</span> blocks
                {!st.gradeable ? " · not graded" : null}
                {edited > 0 ? <> · <span className="num">{edited}</span> edited in the console, not yet in git</> : null}
              </p>
            </div>
          </header>

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

          {data.draft ? (
            <DraftCard stageId={st.id} title={st.title} draft={data.draft} liveBlocks={data.blocks.length} onChanged={q.reload} />
          ) : null}

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
                  <p className="ct-faint">In the order students read them. Structure is the file's; text can be fixed here.</p>
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
              <Preview ref={preview} blocks={data.blocks} editing={editing} title={`${st.id} · ${st.title}`} />
            ) : null}
          </div>
        </>
      )}

      <SendBackDialog
        summary={sendBack}
        onClose={() => setSendBack(null)}
        onDone={() => q.reload()}
        returnFocus={() => opener.current}
      />
    </div>
  );
}
