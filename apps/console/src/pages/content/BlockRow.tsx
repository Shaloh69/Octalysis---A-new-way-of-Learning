import { useEffect, useRef, useState } from "react";
import { api, type BlockVersion, type ContentBlock } from "@/lib/api";
import { dayDate } from "@/lib/record-view";
import { VIA_WORD, canSave, characters, excerpt } from "@/lib/content-view";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One block: what it is, who last changed it, and, when opened, its source in
 * place. A quote from the book has no Edit control and says where it is
 * edited instead (instructor ruling, 28 Sep 2026): the deployed API cannot
 * check a quote against the book, `sync-content --verify` can.
 *
 * Only one block is open at a time. While one is, the others offer no Edit,
 * so typed text is never thrown away by opening a second.
 */

export interface Editing {
  blockId: string;
  text: string;
  reason: string;
}

export function BlockRow({
  b, stageId, editing, anyOpen, saving, error, onStart, onChange, onCancel, onSave,
}: {
  b: ContentBlock;
  stageId: string;
  editing: Editing | null;
  anyOpen: boolean;
  saving: boolean;
  error: string | null;
  onStart: (b: ContentBlock, text?: string) => void;
  onChange: (patch: Partial<Editing>) => void;
  onCancel: () => void;
  onSave: (b: ContentBlock) => void;
}) {
  const open = editing?.blockId === b.id;
  const [history, setHistory] = useState<BlockVersion[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const source = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) source.current?.focus();
  }, [open]);

  async function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) {
      setHistoryError(null);
      try {
        setHistory((await api.contentHistory(b.id)).versions);
      } catch (e) {
        setHistoryError(e instanceof Error ? e.message : "The history could not be loaded.");
      }
    }
  }

  const last = b.lastEdit;
  return (
    <li className="ct-block" data-block={b.ordinal} data-block-id={b.id} data-version={b.version} data-open={open ? "true" : undefined}>
      <div className="ct-block-head">
        <span className="num ct-block-n">{b.ordinal}</span>
        <div className="min-w-0 flex-1">
          <p className="ct-block-kind">
            {b.kind} · version <span className="num">{b.version}</span>
            {b.consoleEdited ? <span className="ct-block-flag"> · edited in the console, not yet in git</span> : null}
          </p>
          <p className="ct-block-excerpt">{excerpt(b.body) || <span className="ct-faint">(empty)</span>}</p>
          {b.source ? (
            <p className="ct-block-note">
              Quote from <span className="num">{b.source}</span>, checked word for word against the book. Edit it in{" "}
              <span className="num">content/stages/{stageId}.md</span>, where <span className="num">sync-content --verify</span> checks it.
            </p>
          ) : null}
          {last ? (
            <p className="ct-block-note">
              Last changed {VIA_WORD[last.via]}
              {last.editor ? <> by {last.editor}</> : null}
              {dayDate(last.at) ? <> · <span className="num">{dayDate(last.at)}</span></> : null}
              {last.reason ? <>: {last.reason}</> : null}
            </p>
          ) : null}
        </div>
        <div className="ct-block-actions">
          {b.editable && !open && !anyOpen ? (
            <Button size="sm" variant="outline" data-edit onClick={() => onStart(b)} aria-label={`Edit block ${b.ordinal}`}>
              Edit
            </Button>
          ) : null}
          {b.historyCount > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={historyOpen}
              aria-label={`History of block ${b.ordinal}, ${b.historyCount} earlier versions`}
              onClick={() => void toggleHistory()}
            >
              History <span className="num">{b.historyCount}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {open && editing ? (
        <div className="ct-editor">
          <Textarea
            ref={source}
            id={`src-${b.id}`}
            aria-label={`Source of block ${b.ordinal}`}
            className="ct-source"
            rows={Math.min(18, Math.max(5, editing.text.split("\n").length + 1))}
            value={editing.text}
            onChange={(e) => onChange({ text: e.target.value })}
            spellCheck
          />
          <p className="ct-faint" data-count>
            {characters(editing.text.length)} · markdown as the reader draws it: paragraphs, <span className="num">- lists</span>,{" "}
            <span className="num">**bold**</span>
          </p>
          <div className="ct-editor-reason">
            <Label htmlFor={`why-${b.id}`}>What changed (required)</Label>
            <Input
              id={`why-${b.id}`}
              value={editing.reason}
              onChange={(e) => onChange({ reason: e.target.value })}
              placeholder="e.g. typo in the second sentence"
              maxLength={300}
            />
          </div>
          {error ? (
            <p className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
              Not saved. {error}
            </p>
          ) : null}
          <div className="ct-editor-actions">
            <Button size="sm" onClick={() => onSave(b)} disabled={saving || !canSave(b.body, editing.text, editing.reason)}>
              {saving ? "Saving…" : <>Save as version <span className="num">{b.version + 1}</span></>}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
            <p className="ct-faint">Students read the new text as soon as it is saved.</p>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="ct-history">
          {historyError ? (
            <p role="alert" className="text-sm text-ink">The history could not be loaded. {historyError}</p>
          ) : !history ? (
            <p className="ct-faint" aria-busy="true">Loading the history…</p>
          ) : history.length === 0 ? (
            <p className="ct-faint">No earlier versions.</p>
          ) : (
            <ol className="ct-versions" aria-label={`Earlier versions of block ${b.ordinal}`}>
              {history.map((v) => (
                <li key={v.version} className="ct-version" data-version={v.version}>
                  <p className="ct-version-head">
                    Version <span className="num">{v.version}</span>, replaced {VIA_WORD[v.via]}
                    {v.editor ? <> by {v.editor}</> : null}
                    {dayDate(v.replacedAt) ? <> · <span className="num">{dayDate(v.replacedAt)}</span></> : null}
                    {v.reason ? <>: {v.reason}</> : null}
                  </p>
                  <pre className="ct-version-body">{v.body}</pre>
                  {b.editable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Use this text: version ${v.version} of block ${b.ordinal}`}
                      onClick={() => (open ? onChange({ text: v.body }) : onStart(b, v.body))}
                      disabled={anyOpen && !open}
                    >
                      Use this text
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </li>
  );
}
