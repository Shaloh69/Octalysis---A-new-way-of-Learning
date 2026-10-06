import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";

/**
 * Reset a student's password (instructor ruling, 6 Oct 2026: "both, the
 * console tool first"; until now it was the Supabase dashboard).
 *
 * Two steps in one dialog. First: what will happen to THIS student, and a
 * reason (audited). Then: the temporary password, shown once, in mono, with
 * Copy. It is never stored or shown again; the student must choose their own
 * the next time they sign in (`must_change_password`, apps/web).
 *
 * The confirmation is said INSIDE the dialog (role="status"), because a toast
 * raised under an open Radix dialog is hidden from a screen reader
 * (NEXT-SESSION §0zb.4). The toast comes when it closes.
 */
export function PasswordDialog({
  student, onClose, returnFocus,
}: {
  student: { userId: string; fullName: string; studentId: string } | null;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!student) return;
    setReason("");
    setSaving(false);
    setError(null);
    setTemp(null);
    setCopied(false);
  }, [student]);

  async function commit() {
    if (!student) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.resetStudentPassword(student.userId, reason.trim());
      setTemp(r.temporaryPassword);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The password was not reset. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (temp && student) {
      toast.success(`Temporary password set for ${student.fullName}`, "They choose their own the next time they sign in.");
    }
    onClose();
  }

  return (
    <Dialog open={student !== null} onOpenChange={(o) => !o && !saving && close()}>
      <DialogContent
        className="ease-dialog"
        onCloseAutoFocus={(e) => {
          const el = returnFocus();
          if (el && el.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Reset {student?.fullName ?? "this student"}&apos;s password?</DialogTitle>
          <DialogDescription>
            {temp
              ? "Give this to the student yourself. It is not shown again, and it is not stored anywhere."
              : "They get a temporary password from you, and must choose their own the next time they sign in. Their attempts and grades are not touched."}
          </DialogDescription>
        </DialogHeader>

        {temp ? (
          <div className="pw-result" role="status">
            <p className="text-sm text-ink">
              Temporary password for <span className="font-medium">{student?.fullName}</span>{" "}
              (<span className="num">{student?.studentId}</span>):
            </p>
            <p className="pw-temp num" data-temp-password="">
              {temp}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(temp);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length >= 3) void commit();
            }}
          >
            <Label htmlFor="pw-reason">Why (recorded in the audit log)</Label>
            <Input id="pw-reason" value={reason} maxLength={500} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="In a few words" />
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || reason.trim().length < 3}>
                {saving ? "Resetting…" : "Reset password"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {temp ? (
          <DialogFooter>
            <Button onClick={close}>Done</Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
