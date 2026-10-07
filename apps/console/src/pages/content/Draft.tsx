import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Sending a drafted chapter back (instructor ruling, 5 Oct 2026): the draft goes to its
 * author with the reason, and what students read does not change. The chapter's own
 * card is gone (8 Oct 2026): the Studio's editor shows the draft as a document, and
 * Publish is its approval. Only this dialog is still needed.
 */

export function DraftSendBack({
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
