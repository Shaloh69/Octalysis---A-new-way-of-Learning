import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { LockTarget } from "@/lib/locks-view";

/**
 * The reason prompt. Every lock change on this page goes through it, one cell
 * or a hundred: INV-22 warns on an override without a reason, and in December,
 * when a grade is challenged, `audit_log.payload.reason` is the evidence.
 *
 * The server refuses under 3 characters; this dialog is not the enforcement, it
 * is what makes the enforcement humane, by asking before the request fails.
 *
 * A failed save keeps the dialog open with the error in it. The teacher's
 * reason is still in the box and the next move is one press.
 */

export interface ReasonRequest {
  title: string;
  /** Who and what: "Juan Miguel Dela Cruz · Stage 05 Cache Memory". */
  subject: string;
  /** What is true now, in words, before anything changes. */
  now?: ReactNode;
  /** The states offered. One entry means the target is fixed. */
  choices: Array<{ value: LockTarget; label: string; disabled?: boolean }>;
  initial: LockTarget;
  /** A line under the choices, for the one that needs saying (auto, global). */
  note?: (next: LockTarget) => ReactNode;
  save: (next: LockTarget, reason: string) => Promise<void>;
}

export function ReasonDialog({
  request, onClose, returnFocus,
}: {
  request: ReasonRequest | null;
  onClose: () => void;
  /** Where focus goes when the dialog closes: the cell or button that opened it. */
  returnFocus: () => HTMLElement | null;
}) {
  const [next, setNext] = useState<LockTarget>("auto");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    setNext(request.initial);
    setReason("");
    setError(null);
    setSaving(false);
  }, [request]);

  async function commit() {
    if (!request) return;
    setSaving(true);
    setError(null);
    try {
      await request.save(next, reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change was not saved.");
    } finally {
      setSaving(false);
    }
  }

  const fixed = (request?.choices.length ?? 0) <= 1;

  return (
    <Dialog open={request !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0"
        // No Radix Trigger opens this dialog, so Radix has nowhere to send focus
        // back to. A teacher working through 400 cells must land on the one
        // they left, not at the top of the page.
        onCloseAutoFocus={(e) => {
          const el = returnFocus();
          if (el && el.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.subject}</DialogDescription>
        </DialogHeader>

        {request?.now ? (
          <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
            {request.now}
          </div>
        ) : null}

        {!fixed && request ? (
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-xs font-medium text-ink-muted">Set it to</legend>
            <div className="flex flex-wrap gap-2">
              {request.choices.map((c) => (
                <label
                  key={c.value}
                  className={
                    "lock-choice flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm " +
                    (next === c.value ? "border-accent bg-accent-muted text-ink" : "border-line text-ink")
                  }
                  data-disabled={c.disabled ? "" : undefined}
                >
                  <input
                    type="radio"
                    name="lock-next"
                    value={c.value}
                    checked={next === c.value}
                    disabled={c.disabled}
                    onChange={() => setNext(c.value)}
                    className="accent-accent"
                  />
                  {c.label}
                  {c.disabled ? <span className="text-xs text-ink-muted">(now)</span> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {request?.note ? <div className="mb-3 text-sm text-ink-muted">{request.note(next)}</div> : null}

        <Label htmlFor="lock-reason">Reason (required)</Label>
        <Textarea
          id="lock-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Missed the 12 Sept lab for a medical appointment"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Recorded in the audit log with your name and the time. Write it for someone who was not
          in the room.
        </p>

        {error ? (
          <p className="gate-fault mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not saved. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void commit()} disabled={reason.trim().length < 3 || saving}>
            {saving ? "Saving…" : "Save change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
