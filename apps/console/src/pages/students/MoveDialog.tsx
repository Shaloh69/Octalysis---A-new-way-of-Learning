import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { api, type RosterRow, type RosterSection } from "@/lib/api";
import { plural } from "@/lib/roster-view";

/**
 * Move students to another section: one student from the row menu, or the
 * selection from the bulk bar.
 *
 * A section is what section-scope lock overrides and assessment windows read,
 * so this changes what a student can open and sit, at once. The dialog says so
 * before anything moves, and a reason is required: each student gets their own
 * audit row. All or nothing on the server.
 */
export function MoveDialog({
  students, sections, onClose, onDone, returnFocus,
}: {
  students: RosterRow[] | null;
  sections: RosterSection[];
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [sectionId, setSectionId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!students) return;
    setSectionId("");
    setReason("");
    setError(null);
    setSaving(false);
  }, [students]);

  const n = students?.length ?? 0;
  const shown = (students ?? []).slice(0, 6);
  const from = [...new Set((students ?? []).map((s) => s.sectionCode ?? "no section"))];
  const target = sections.find((s) => s.id === sectionId);

  async function commit() {
    if (!students || !target) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.moveSection({
        studentIds: students.map((s) => s.studentId), sectionId: target.id, reason: reason.trim(),
      });
      toast.success(`${plural(res.moved, "student")} moved to ${res.sectionCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nobody was moved.");
      toast.error(`${plural(n, "student")} not moved`, "Nobody was moved. The dialog is still open; try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={students !== null} onOpenChange={(o) => !o && !saving && onClose()}>
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
          <DialogTitle>{`Move ${plural(n, "student")} to another section`}</DialogTitle>
          <DialogDescription>Now in {from.join(", ")}.</DialogDescription>
        </DialogHeader>

        <ul className="mb-4 space-y-0.5 text-sm text-ink">
          {shown.map((s) => (
            <li key={s.studentId} className="flex flex-wrap gap-x-2">
              <span>{s.fullName}</span>
              <span className="num text-ink-muted">{s.studentId}</span>
            </li>
          ))}
          {n > shown.length ? <li className="text-ink-muted">and {plural(n - shown.length, "more student")}</li> : null}
        </ul>

        <Label htmlFor="move-to">Move to</Label>
        <select
          id="move-to"
          className="roster-select mb-3 w-full"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="">Pick a section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>

        <p className="mb-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          Section locks and assessment windows follow the student: what they can open and sit may
          change at once. Their attempts and grades stay with them.
        </p>

        <Label htmlFor="move-reason">Reason (required)</Label>
        <Textarea
          id="move-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Section split for the lab schedule"
        />

        {error ? (
          <p className="gate-fault mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not moved. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void commit()} disabled={!target || reason.trim().length < 3 || saving}>
            {saving ? "Moving…" : `Move ${plural(n, "student")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
