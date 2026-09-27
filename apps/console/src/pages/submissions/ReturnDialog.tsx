import { useEffect, useState } from "react";
import { api, type Submission } from "@/lib/api";
import { markText } from "@/lib/submissions-view";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Return for revision: the ONLY way a graded submission becomes editable, and
 * the only way its mark changes (`routes/submissions.ts` answers 409 to a mark
 * on a graded row). A reason is required; the student sees it, and the audit
 * log keeps it with the mark and the feedback it replaces.
 *
 * Not styled as destructive: nothing is deleted, and the previous mark is in
 * the audit log. Opened from state, so focus goes home through
 * `onCloseAutoFocus` and the remembered opener (`NEXT-SESSION.md` §0c.4).
 */
export function ReturnDialog({
  submission, onClose, onDone, returnFocus,
}: {
  submission: Submission | null;
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submission) return;
    setReason("");
    setSaving(false);
    setError(null);
  }, [submission]);

  const s = submission;
  const mark = s ? markText(s) : null;

  async function send() {
    if (!s) return;
    setSaving(true);
    setError(null);
    try {
      await api.returnSubmission(s.id, reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not returned.");
      toast.error(`${s.slug} for ${s.studentName} was not returned`, "The dialog is still open with your reason in it.");
      setSaving(false);
      return;
    }
    toast.success(`Returned to ${s.studentName}: ${s.slug}`, "They can revise it and hand it in again.");
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={s !== null} onOpenChange={(o) => !o && !saving && onClose()}>
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
          <DialogTitle>Return for revision?</DialogTitle>
          <DialogDescription>
            {s?.studentName} · <span className="num">{s?.slug}</span>
            {mark ? (
              <>
                {" "}· marked <span className="num">{mark}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The student can change it and hand it in again. Until they do, it is back in your queue as returned.</li>
            <li>The reason below is what the student sees, in place of your feedback.</li>
            <li>The mark and the feedback are kept in the audit log, with your name and the time.</li>
          </ul>
        </div>

        <Label htmlFor="return-reason">Reason (required)</Label>
        <Textarea
          id="return-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The band was applied to the wrong part; rework part 2."
        />

        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not returned. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void send()} disabled={reason.trim().length < 3 || saving}>
            {saving ? "Returning…" : `Return to ${s?.studentName ?? ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
