import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { ApiError, removePicture } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import type { Avatar as AvatarData } from "@octa/contracts";

/**
 * Remove someone's profile picture (PROFILES, 9 Oct 2026;
 * design/templates/console/profile/SPEC.md "The picture around the console").
 *
 * A moderation, so it needs a reason (the server's own minimum is three
 * characters) and it is audited with who, whose and when; the person is told
 * on their own page, and the generated planet takes the picture's place. The
 * dialog is only ever offered where the server said `avatar.removable`: this
 * file decides what to RENDER, `can_remove_avatar()` decides what is ALLOWED,
 * and the API asks it again.
 *
 * The same dialog serves `/students/:id`, `/teachers/:key` and `/chat`.
 */

export interface PictureOwner {
  userId: string;
  name: string;
  avatar: AvatarData;
}

/** Focus back to what opened the dialog (as `/students`' dialogs do). */
function backTo(returnFocus: () => HTMLElement | null) {
  return (e: Event) => {
    const el = returnFocus();
    if (el && el.isConnected) {
      e.preventDefault();
      el.focus();
    }
  };
}

export function RemovePictureDialog({
  owner, onClose, onDone, returnFocus,
}: {
  owner: PictureOwner | null;
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) return;
    setReason("");
    setSaving(false);
    setError(null);
  }, [owner]);

  const ready = reason.trim().length >= 3;

  async function commit() {
    if (!owner) return;
    setSaving(true);
    setError(null);
    try {
      await removePicture(owner.userId, reason.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The picture was not removed. Try again.");
      toast.error(`${owner.name}'s picture was not removed`, "The dialog is still open with your reason in it. Try again.");
      setSaving(false);
      return;
    }
    toast.success(`${owner.name}'s picture removed`, "Their planet shows instead, and they are told on their profile.");
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={owner !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={backTo(returnFocus)}>
        <DialogHeader>
          <DialogTitle>Remove {owner?.name}&rsquo;s picture?</DialogTitle>
          <DialogDescription>It is deleted. They can choose a new one whenever they like.</DialogDescription>
        </DialogHeader>

        {owner ? (
          <div className="mb-4 flex items-center gap-3">
            <Avatar avatar={owner.avatar} size="lg" />
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
              <li>Their generated planet shows in its place, everywhere.</li>
              <li>They see a note on their own profile that it was removed, and when.</li>
            </ul>
          </div>
        ) : null}

        <Label htmlFor="picture-reason">Reason (required)</Label>
        <Textarea
          id="picture-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Not a picture of the student"
        />
        <p className="mt-1.5 text-xs text-ink-muted">Recorded in the audit log with your name and the time.</p>

        {error ? (
          <p className="gate-fault mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void commit()} disabled={!ready || saving}>
            {saving ? "Removing…" : "Remove picture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
