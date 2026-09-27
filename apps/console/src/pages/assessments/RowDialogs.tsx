import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Assessment } from "@/lib/api";
import { fromLocalInput, saltState, toLocalInput } from "@/lib/assessments-view";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { BankBox } from "./Bank";

/**
 * The three dialogs a row opens. Each is opened from state, not from a
 * DialogTrigger, so Radix has nowhere to return focus (`NEXT-SESSION.md`
 * §0c.4): `returnFocus` is the control that opened it.
 */
interface RowDialogProps {
  assessment: Assessment | null;
  onClose: () => void;
  onDone: () => void;
  returnFocus: () => HTMLElement | null;
}

function homeFocus(returnFocus: () => HTMLElement | null) {
  return (e: Event) => {
    const el = returnFocus();
    if (el && el.isConnected) {
      e.preventDefault();
      el.focus();
    }
  };
}

/* ------------------------------------------------------------- window */

/**
 * The window, after the fact. `PATCH /console/assessments/:id` refuses a
 * window that closes before it opens and an attempt limit below a sitting
 * that already happened, and says so; the dialog stays open with the reason.
 *
 * THE REASON IS REQUIRED: moving an exam window changes what students can do,
 * so it lands in `audit_log` with the before and the after.
 *
 * `datetime-local` has no zone. It is read as the browser's local time and
 * sent as an instant, because an exam that opens at 08:00 means 08:00 where
 * the class is.
 */
export function WindowDialog({ assessment, onClose, onDone, returnFocus }: RowDialogProps) {
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [attempts, setAttempts] = useState("5");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessment) return;
    setOpensAt(toLocalInput(assessment.opensAt));
    setClosesAt(toLocalInput(assessment.closesAt));
    setAttempts(String(assessment.attemptsAllowed));
    setReason("");
    setSaving(false);
    setError(null);
  }, [assessment]);

  const n = Number(attempts);
  const ready = reason.trim().length >= 3 && Number.isInteger(n) && n >= 1 && n <= 10 && !saving;
  const name = assessment?.title ?? "";

  async function save() {
    if (!assessment) return;
    setSaving(true);
    setError(null);
    try {
      await api.setAssessmentWindow(assessment.id, {
        // An empty field is null, "clear this bound", never "leave alone".
        opensAt: fromLocalInput(opensAt),
        closesAt: fromLocalInput(closesAt),
        attemptsAllowed: n,
        reason: reason.trim(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "That change was not saved.";
      setError(message);
      toast.error(`The window for ${name} was not saved`, "The dialog is still open with your reason in it.");
      setSaving(false);
      return;
    }
    toast.success(`Window saved for ${name}`);
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={assessment !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      {/* max-w-lg, not md: two mono datetime fields side by side need ~13rem each. */}
      <DialogContent className="ease-dialog max-w-lg max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={homeFocus(returnFocus)}>
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>When students may sit it, and how many times. An empty date is no bound.</DialogDescription>
        </DialogHeader>

        <div className="assess-dates">
          <div className="assess-field">
            <Label htmlFor="win-opens">Opens</Label>
            <Input id="win-opens" className="num" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </div>
          <div className="assess-field">
            <Label htmlFor="win-closes">Closes</Label>
            <Input id="win-closes" className="num" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </div>

        {/*
          Said, not left to be inferred. A NULL bound is no bound, and
          `engine-repo.ts` enforces exactly that: no dates means open to every
          student in scope, right now.
        */}
        {!opensAt && !closesAt ? (
          <p className="assess-callout mb-3">
            With no dates set, this assessment is <strong>open now</strong> and stays open.
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
        <div className="assess-field">
          <Label htmlFor="win-attempts">Attempts allowed</Label>
          <Input
            id="win-attempts"
            className="num w-24"
            type="number"
            min={1}
            max={10}
            value={attempts}
            onChange={(e) => setAttempts(e.target.value)}
            aria-describedby="win-attempts-hint"
          />
          <p id="win-attempts-hint" className="assess-hint">
            It cannot go below a sitting that has already happened.
          </p>
        </div>

        <div className="assess-field">
          <Label htmlFor="win-reason">Reason (required)</Label>
          <Textarea
            id="win-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Prelim week, per the department calendar"
          />
          <p className="assess-hint">Recorded in the audit log with the old and new window.</p>
        </div>
        </div>

        {error ? (
          <p className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not saved. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!ready}>
            {saving ? "Saving…" : "Save window"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- salt */

/**
 * Rotating the exam salt between terms (`PAGE-SPECS.md`, approved and built
 * 27 Sep 2026). It says what changes and what does not before the teacher
 * decides. Not styled as destructive: nothing is lost and nothing is undone,
 * because every attempt stores its own seed.
 */
export function RotateDialog({ assessment, onClose, onDone, returnFocus }: RowDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessment) return;
    setReason("");
    setSaving(false);
    setError(null);
  }, [assessment]);

  const name = assessment?.title ?? "";
  const salt = assessment ? saltState(assessment) : null;

  async function rotate() {
    if (!assessment) return;
    setSaving(true);
    setError(null);
    try {
      await api.rotateSalt(assessment.id, reason.trim());
    } catch (e) {
      const message = e instanceof Error ? e.message : "The salt was not rotated.";
      setError(message);
      toast.error(`The salt for ${name} was not rotated`, "The dialog is still open with your reason in it.");
      setSaving(false);
      return;
    }
    toast.success(`Exam salt rotated for ${name}`, "Papers started from now on are new. Papers already started are unchanged.");
    setSaving(false);
    onClose();
    onDone();
  }

  return (
    <Dialog open={assessment !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={homeFocus(returnFocus)}>
        <DialogHeader>
          <DialogTitle>Rotate the exam salt for {name}?</DialogTitle>
          <DialogDescription>
            {salt ? (
              <>
                Salt {salt.verb} <span className="num">{salt.day}</span>.
              </>
            ) : (
              "This assessment has no exam salt, so Start fails on it. Rotating sets one."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Every attempt started after this gets a paper nobody has seen.</li>
            <li>Papers already started or handed in are unchanged: each one stores its own seed.</li>
            <li>The salt itself is never shown, here or anywhere. This page can only say when it changed.</li>
          </ul>
        </div>

        <Label htmlFor="rotate-reason">Reason (required)</Label>
        <Textarea
          id="rotate-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Second semester, 2026-2027"
        />
        <p className="assess-hint">Recorded in the audit log with your name and the time.</p>

        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not rotated. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void rotate()} disabled={reason.trim().length < 3 || saving}>
            {saving ? "Rotating…" : "Rotate the salt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- bank */

/** A row's `Check the bank…`: the same box as the create form, for this row's blueprint. */
export function BankDialog({ assessment, onClose, returnFocus }: Omit<RowDialogProps, "onDone">) {
  const a = assessment;
  return (
    <Dialog open={a !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0" onCloseAutoFocus={homeFocus(returnFocus)}>
        <DialogHeader>
          <DialogTitle>Can the bank fill {a?.title}?</DialogTitle>
          <DialogDescription>
            <span className="num">{a?.totalItems}</span> questions,{" "}
            {a?.scope === "stage" ? (
              <>
                from stage <span className="num">{a.stageId}</span>
              </>
            ) : (
              "from every gradeable stage"
            )}
            , counted against the live bank now.
          </DialogDescription>
        </DialogHeader>
        {a ? <BankBox bank={a.bank} titled={false} /> : null}
        <DialogFooter>
          {a && !a.bank.satisfiable ? (
            <Button variant="outline" asChild>
              <Link to="/items">Review items</Link>
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
