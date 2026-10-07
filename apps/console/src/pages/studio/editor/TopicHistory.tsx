import { useEffect, useState } from "react";
import { api, type BlockVersion } from "@/lib/api";
import { VIA_WORD } from "@/lib/content-view";
import { dayDate } from "@/lib/record-view";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * One topic's earlier versions (docs/STUDIO-EDITOR-PLAN.md, E1.5; template
 * `design/templates/console/studio-history/`, Wikipedia's revision history):
 * newest first, each with when, who, why and the text itself, and a "Use this
 * text" that puts it back into the topic. That is typing, not publishing: the
 * editor saves it as a draft, and students read it only after Publish.
 *
 * A quote from the book and a figure are never typed here, so their earlier
 * versions can be read and not used. A version of a different kind (a paragraph
 * that became a callout) is readable too, and says why it cannot be used.
 */

export function TopicHistory({ open, blockId, kind, locked, onUse, onClose, onCloseFocus }: {
  open: boolean;
  blockId: string | null;
  /** The kind of the topic as it is in the editor now. */
  kind: string;
  locked: boolean;
  onUse: (v: BlockVersion) => void;
  onClose: () => void;
  /** Where focus goes when it closes: the editor, so typing and Undo carry on where they were. */
  onCloseFocus: () => void;
}) {
  const [versions, setVersions] = useState<BlockVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !blockId) return;
    let live = true;
    setVersions(null);
    setError(null);
    api.contentHistory(blockId)
      .then((r) => { if (live) setVersions(r.versions); })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : "The history could not be loaded."); });
    return () => { live = false; };
  }, [open, blockId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="ease-dialog max-w-2xl max-sm:top-3 max-sm:translate-y-0" data-topic-history
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onCloseFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Earlier versions of this topic</DialogTitle>
          <DialogDescription>
            Newest first. Using one puts its text in the topic as a draft; students read it only after you publish.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-ink">The history could not be loaded. {error}</p>
        ) : !versions ? (
          <p className="ct-faint" aria-busy="true">Loading the history…</p>
        ) : versions.length === 0 ? (
          <p className="ct-faint">No earlier versions.</p>
        ) : (
          <ol className="ct-versions th-list" aria-label="Earlier versions of this topic">
            {versions.map((v) => {
              const why = locked
                ? "A quote from the book or a figure is never typed here."
                : v.kind !== kind
                  ? `That version was a ${v.kind} topic; this one is a ${kind}.`
                  : null;
              return (
                <li key={v.version} className="ct-version" data-version={v.version}>
                  <p className="ct-version-head">
                    Version <span className="num">{v.version}</span>, replaced {VIA_WORD[v.via]}
                    {v.editor ? <> by {v.editor}</> : null}
                    {dayDate(v.replacedAt) ? <> · <span className="num">{dayDate(v.replacedAt)}</span></> : null}
                    {v.reason ? <>: {v.reason}</> : null}
                  </p>
                  <pre className="ct-version-body">{v.body}</pre>
                  <div className="th-use">
                    <Button
                      size="sm" variant="outline" disabled={why !== null}
                      aria-label={`Use this text: version ${v.version}`}
                      onClick={() => onUse(v)}
                    >
                      Use this text
                    </Button>
                    {why ? <span className="ct-faint">{why}</span> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
