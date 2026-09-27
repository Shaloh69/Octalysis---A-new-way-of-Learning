import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { api, type RosterRow } from "@/lib/api";

/**
 * Deactivate and reactivate: one student at a time, never in bulk.
 *
 * Deactivation is a soft delete a student feels at once (V-20): a registered
 * student is refused on every request from then on, by ID or by email. So it is
 * made hard to do by accident (`SPEC.md` §"Deactivate is hard to do by
 * accident"): reached only from the row menu, it says what will happen to THIS
 * student, it needs a reason, and it needs the student ID typed back.
 *
 * Reactivating needs a reason and nothing typed: undoing a mistake should be
 * easier than making one, and it is audited just the same.
 *
 * Opened from state, not a DialogTrigger, so Radix has nowhere to return focus
 * to (NEXT-SESSION.md §0c.4): `returnFocus` is the menu button that opened it.
 */
export function StatusDialog({
  student, onClose, onDone, returnFocus,
}: {
  student: RosterRow | null;
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    setReason("");
    setTyped("");
    setError(null);
    setSaving(false);
  }, [student]);

  const deactivating = student ? !student.deactivated : true;
  const registered = student?.userId !== null && student?.userId !== undefined;
  const name = student?.fullName ?? "";
  const ready =
    reason.trim().length >= 3 && (!deactivating || typed.trim() === student?.studentId);

  async function commit() {
    if (!student) return;
    setSaving(true);
    setError(null);
    try {
      await api.setRosterStatus({ studentId: student.studentId, active: !deactivating, reason: reason.trim() });
    } catch (e) {
      const message = e instanceof Error ? e.message : "That change was not saved.";
      setError(message);
      toast.error(
        `${name} was not ${deactivating ? "deactivated" : "reactivated"}`,
        "The dialog is still open with your reason in it. Try again.",
      );
      setSaving(false);
      return;
    }
    toast.success(`${name} ${deactivating ? "deactivated" : "reactivated"}`);
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={student !== null} onOpenChange={(o) => !o && !saving && onClose()}>
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
          <DialogTitle>{deactivating ? `Deactivate ${name}?` : `Reactivate ${name}?`}</DialogTitle>
          <DialogDescription>
            <span className="num">{student?.studentId}</span>
            {student?.sectionCode ? <> · {student.sectionCode}</> : null}
            {" · "}
            {registered ? "registered" : "not registered yet"}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            {deactivating && registered ? (
              <>
                <li>
                  They are refused on every request from now on, and cannot sign in by student ID or
                  by email.
                </li>
                <li>Their attempts, answers and grades are kept. Nothing they did is removed.</li>
              </>
            ) : deactivating ? (
              <>
                <li>Their student ID can no longer be used to register.</li>
                <li>They have no account yet, so nothing else changes.</li>
              </>
            ) : registered ? (
              <li>They can sign in again, and everything they did before is where they left it.</li>
            ) : (
              <li>Their student ID can be used to register again.</li>
            )}
            {deactivating ? <li>You can reactivate them from this page. That needs a reason too.</li> : null}
          </ul>
        </div>

        <Label htmlFor="status-reason">Reason (required)</Label>
        <Textarea
          id="status-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={deactivating ? "e.g. Dropped the course on 20 September" : "e.g. The drop was reversed"}
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Recorded in the audit log with your name and the time.
        </p>

        {deactivating ? (
          <div className="mt-4">
            <Label htmlFor="status-confirm">Type the student ID to confirm</Label>
            <Input
              id="status-confirm"
              className="num"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-describedby="status-confirm-hint"
            />
            <p id="status-confirm-hint" className="mt-1.5 text-xs text-ink-muted">
              Type <span className="num text-ink">{student?.studentId}</span> exactly.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="gate-fault mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not saved. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={deactivating ? "danger" : "default"}
            onClick={() => void commit()}
            disabled={!ready || saving}
          >
            {saving ? "Saving…" : `${deactivating ? "Deactivate" : "Reactivate"} ${name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
