import { useEffect, useRef, useState } from "react";
import { api, type ContentFigure } from "@/lib/api";
import { dayDate } from "@/lib/record-view";
import { SUMMARY_TONE } from "@/lib/content-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { FigureDrawing } from "@/components/FigureDrawing";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * One figure drawn for the course, under review (instructor rulings, 6 Oct
 * 2026; docs/FIGURES-AND-AUDIO.md). The drawing is the one sync wrote from
 * content/figures/<id>.svg; approving serves exactly it to students (the API
 * refuses the approval if it was redrawn since this page loaded), on the
 * lesson and on every question that names it. Sending back needs a reason.
 * Used on /content (a chapter's figures) and /items (a question's figure).
 */

const WORD: Record<ContentFigure["status"], string> = {
  draft: "Waiting for your review",
  approved: "Approved",
  sent_back: "Sent back",
};

export function FigureCard({
  figure, onChanged, headingLevel = 3,
}: {
  figure: ContentFigure;
  onChanged: () => void;
  headingLevel?: 3 | 4;
}) {
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const when = dayDate(figure.reviewedAt);
  const H = headingLevel === 3 ? "h3" : "h4";

  async function approve() {
    setBusy(true);
    try {
      await api.approveFigure(figure.id, figure.hash);
      toast.success(`Figure ${figure.id} approved`, "Students see this drawing now, on the lesson and on its questions.");
      onChanged();
    } catch (e) {
      toast.error(`Figure ${figure.id} was not approved`, e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="fg-card" data-figure-card={figure.id} data-figure-status={figure.status} aria-labelledby={`fg-${figure.id}`}>
      <div className="fg-head">
        <H id={`fg-${figure.id}`} className="fg-title">
          <span className="mono fg-id">{figure.id}</span> {figure.title}
        </H>
        <Badge tone={SUMMARY_TONE[figure.status]} data-state={figure.status}>{WORD[figure.status]}</Badge>
      </div>
      <figure className="fg-drawing">
        <FigureDrawing svg={figure.svg} title={figure.title} />
      </figure>
      <p className="fg-served">
        {figure.status === "approved"
          ? "Students see this drawing."
          : figure.served
            ? "A redrawn figure. Students see the last approved drawing until you approve this one."
            : "No student sees it until you approve it."}
      </p>
      {figure.status === "sent_back" && figure.note ? (
        <p className="fg-note"><span className="font-medium text-ink">Sent back:</span> {figure.note}</p>
      ) : null}
      {figure.reviewer || when ? (
        <p className="ct-faint">
          {WORD[figure.status]}
          {figure.reviewer ? <> by {figure.reviewer}</> : null}
          {when ? <> · {when}</> : null}
        </p>
      ) : null}
      {figure.status !== "approved" ? (
        <div className="ct-summary-actions">
          <Button size="sm" data-approve-figure={figure.id} onClick={() => void approve()} disabled={busy}>
            {busy ? "Approving…" : `Approve figure ${figure.id}`}
          </Button>
          {figure.status === "draft" ? (
            <Button ref={opener} size="sm" variant="outline" onClick={() => setSending(true)} disabled={busy}>
              {`Send back figure ${figure.id}`}
            </Button>
          ) : null}
        </div>
      ) : null}
      <FigureSendBack
        open={sending}
        figure={figure}
        onClose={() => setSending(false)}
        onDone={onChanged}
        returnFocus={() => opener.current}
      />
    </article>
  );
}

function FigureSendBack({
  open, figure, onClose, onDone, returnFocus,
}: {
  open: boolean;
  figure: ContentFigure;
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
      await api.sendBackFigure(figure.id, reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not sent back.");
      toast.error(`Figure ${figure.id} was not sent back`, "The dialog is still open with your reason in it.");
      setSaving(false);
      return;
    }
    toast.success(`Figure ${figure.id} sent back`, "What students see does not change. Your reason is kept for the author.");
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
          <DialogTitle>Send back figure {figure.id}?</DialogTitle>
          <DialogDescription>{figure.title}</DialogDescription>
        </DialogHeader>
        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>What students see does not change.</li>
            <li>It comes back to review when content/figures/{figure.id}.svg is redrawn and synced.</li>
            <li>Your reason is kept for the author, and in the audit log with your name and the time.</li>
          </ul>
        </div>
        <Label htmlFor={`fig-sendback-${figure.id}`}>Reason (required)</Label>
        <Textarea
          id={`fig-sendback-${figure.id}`}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Label the operand fields with their bit widths."
        />
        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not sent back. {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void send()} disabled={reason.trim().length < 3 || saving}>
            {saving ? "Sending back…" : `Send back figure ${figure.id}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
