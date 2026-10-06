import { useEffect, useMemo, useRef, useState } from "react";
import { api, type ChapterDraft, type ContentBlock, type ContentFigure } from "@/lib/api";
import { dayDate } from "@/lib/record-view";
import { SUMMARY_TONE } from "@/lib/content-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Preview } from "./Preview";

/**
 * A chapter's DRAFTED lesson text (instructor ruling, 5 Oct 2026): written
 * from the textbook for a chapter the syllabus outline alone covered, kept in
 * the staff-only `chapter_drafts`, and read by no student until it is approved
 * here. The approval is of the text on screen (its hash; the API refuses it if
 * sync has written a different draft since), it replaces the chapter's live
 * blocks, keeps what they said in History, and writes `audit_log`. Sending back
 * needs a reason. Neither is styled as destructive: nothing is deleted.
 */

const WORD: Record<ChapterDraft["status"], string> = {
  draft: "Waiting for your review",
  approved: "Approved",
  sent_back: "Sent back",
};

export function DraftCard({
  stageId, title, draft, liveBlocks, onChanged, figures,
}: {
  stageId: string;
  title: string;
  draft: ChapterDraft;
  liveBlocks: number;
  onChanged: () => void;
  figures?: ReadonlyMap<string, ContentFigure> | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const when = dayDate(draft.reviewedAt);
  // The preview draws blocks with ids and ordinals; a draft's are its positions.
  const blocks = useMemo<ContentBlock[]>(
    () =>
      draft.blocks.map((b, i) => ({
        id: `draft-${i + 1}`, ordinal: i + 1, kind: b.kind, body: b.body, meta: b.meta, version: 0,
        updatedAt: draft.updatedAt, consoleEdited: false, editable: false,
        source: typeof b.meta.source === "string" ? b.meta.source : null, historyCount: 0, lastEdit: null,
      })),
    [draft],
  );
  const quotes = blocks.filter((b) => b.source).length;

  async function approve() {
    setBusy(true);
    try {
      await api.approveDraft(stageId, draft.hash);
      toast.success(`Stage ${stageId} lesson text approved`, `Students read these ${draft.blocks.length} blocks now.`);
    } catch (e) {
      toast.error(`Stage ${stageId} lesson text was not approved`, e instanceof Error ? e.message : "Nothing changed. Try again.");
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  return (
    <section className="ct-card ct-draft-card" data-draft-card data-draft-status={draft.status} aria-labelledby="draft-title">
      <div className="ct-summary-head">
        <h2 id="draft-title" className="ct-summary-title">Drafted lesson text</h2>
        <Badge tone={SUMMARY_TONE[draft.status]} data-state={draft.status}>{WORD[draft.status]}</Badge>
      </div>
      <p className="ct-faint">
        Drafted from the textbook for your review (your ruling of 5 October 2026).{" "}
        {draft.status === "approved"
          ? <>Students read it now: <span className="num">{draft.blocks.length}</span> blocks.</>
          : draft.everApproved
            ? <>A revised draft. Students read the last approved text until you approve this one.</>
            : <>No student reads it until you approve it. Approving replaces the chapter&apos;s <span className="num">{liveBlocks}</span> blocks with these <span className="num">{draft.blocks.length}</span>.</>}
        {quotes > 0 ? <> <span className="num">{quotes}</span> quoted from the book, each checked against it by sync.</> : null}
      </p>
      {draft.status === "sent_back" && draft.note ? (
        <p className="ct-summary-note">
          <span className="font-medium text-ink">Sent back:</span> {draft.note}
        </p>
      ) : null}
      {draft.reviewer || when ? (
        <p className="ct-summary-meta">
          {WORD[draft.status]}
          {draft.reviewer ? <> by {draft.reviewer}</> : null}
          {when ? <> · <span className="num">{when}</span></> : null}
          {draft.status === "sent_back" ? <> · back to review when content/stages/<span className="num">{stageId}</span>.draft.md is revised</> : null}
        </p>
      ) : null}
      {draft.status === "draft" ? (
        <div className="ct-summary-actions">
          <Button size="sm" data-approve-draft onClick={() => void approve()} disabled={busy}>
            {busy ? "Approving…" : `Approve stage ${stageId} lesson text`}
          </Button>
          <Button ref={opener} size="sm" variant="outline" onClick={() => setSending(true)} disabled={busy}>
            {`Send back stage ${stageId} lesson text`}
          </Button>
        </div>
      ) : null}

      <Preview
        blocks={blocks}
        editing={null}
        title={`${stageId} · ${title}`}
        headingId="pv-draft-title"
        heading="The draft · as a student would read it"
        figures={figures}
      />

      <DraftSendBack
        open={sending}
        stageId={stageId}
        title={title}
        onClose={() => setSending(false)}
        onDone={onChanged}
        returnFocus={() => opener.current}
      />
    </section>
  );
}

function DraftSendBack({
  open, stageId, title, onClose, onDone, returnFocus,
}: {
  open: boolean;
  stageId: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setSaving(false);
    setError(null);
  }, [open]);

  async function send() {
    setSaving(true);
    setError(null);
    try {
      await api.sendBackDraft(stageId, reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not sent back.");
      toast.error(`Stage ${stageId} lesson text was not sent back`, "The dialog is still open with your reason in it.");
      setSaving(false);
      return;
    }
    toast.success(`Stage ${stageId} lesson text sent back`, "Students read none of it. Your reason is kept for the author.");
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0"
        onCloseAutoFocus={(e) => {
          const el = returnFocus();
          if (el && el.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Send back stage {stageId}&apos;s lesson text?</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Students read none of it. What they read now does not change.</li>
            <li>
              It comes back to review when content/stages/<span className="num">{stageId}</span>.draft.md is revised and synced.
            </li>
            <li>Your reason is kept for the author, and in the audit log with your name and the time.</li>
          </ul>
        </div>
        <Label htmlFor="draft-sendback-reason">Reason (required)</Label>
        <Textarea
          id="draft-sendback-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Section 2 needs the book's own worked example."
        />
        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not sent back. {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void send()} disabled={reason.trim().length < 3 || saving}>
            {saving ? "Sending back…" : `Send back stage ${stageId}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
