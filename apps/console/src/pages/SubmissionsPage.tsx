import { useState } from "react";
import { FileText, Clock } from "lucide-react";
import { api, type Submission } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Grading labs, the project, and participation — 40% of the final grade, and
 * until now there was nowhere to record any of it.
 *
 * THE RUBRIC IS THE PAGE. `LAB-MANUAL.md` §0.3 gives every lab the same
 * four-point rubric so students learn it once, and puts **a full point on stated
 * reasoning** — a right answer with no explanation caps at 3. So the grader sees
 * the four bands, in the manual's own words, and picks one. Typing a bare number
 * into a box would let that rule quietly lapse.
 *
 * A GRADED SUBMISSION IS FROZEN. Correcting one means *returning* it with a
 * reason, which the student sees and the audit log keeps. There is no edit path,
 * here or in the API, and the database refuses it besides.
 */

const BANDS = [
  { score: 4, label: "Correct, complete, and the reasoning is stated" },
  { score: 3, label: "Correct and complete; reasoning thin or missing" },
  { score: 2, label: "Partially correct, or complete with a conceptual error" },
  { score: 1, label: "Attempted, substantially incorrect" },
  { score: 0, label: "Not submitted" },
] as const;

const STATUS_TONE = {
  draft: "neutral",
  submitted: "warning",
  returned: "info",
  graded: "success",
  voided: "locked",
} as const;

export function SubmissionsPage() {
  const [status, setStatus] = useState<string | null>("submitted");
  const { data, error, loading, reload } = useAsync(
    () => api.submissions(status ?? undefined),
    [status],
  );
  const [open, setOpen] = useState<Submission | null>(null);

  if (loading) return <Loading what="submissions" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const s = data.summary;
  const waiting = s.submitted ?? 0;

  return (
    <>
      <header className="mb-4">
        <h1 className="mb-1 font-display text-2xl">Submissions</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Labs, the project, and participation — <strong>40% of the final grade</strong>.{" "}
          {waiting > 0 ? (
            <>
              <span className="num text-warning">{waiting}</span> waiting to be marked.
            </>
          ) : (
            <>Nothing is waiting.</>
          )}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Button size="sm" variant={status === null ? "default" : "outline"} onClick={() => setStatus(null)}>
          All
        </Button>
        {(["submitted", "returned", "graded", "draft"] as const).map((st) => (
          <Button key={st} size="sm" variant={status === st ? "default" : "outline"} onClick={() => setStatus(st)}>
            {st} {s[st] ? <span className="num ml-1">{s[st]}</span> : null}
          </Button>
        ))}
      </div>

      {data.submissions.length === 0 ? (
        <Empty
          title={status === "submitted" ? "Nothing waiting to be marked" : "Nothing here"}
          hint="Submissions appear as students hand them in. Drafts stay private until then."
        />
      ) : (
        <ul className="space-y-2">
          {data.submissions.map((sub) => (
            <li key={sub.id}>
              <Card>
                <CardContent className="pt-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[sub.status]}>{sub.status}</Badge>
                    <span className="num text-xs text-ink-faint">{sub.slug}</span>
                    <span className="text-sm text-ink">{sub.studentName}</span>
                    <span className="num text-xs text-ink-faint">{sub.studentId}</span>
                    {sub.isLate && (
                      <Badge tone="warning" title="Recorded, not penalised. That is your call.">
                        <Clock className="mr-1 h-3 w-3" aria-hidden="true" /> late
                      </Badge>
                    )}
                    {sub.score !== null && (
                      <span className="num ml-auto text-sm">
                        {sub.score}/{sub.maxScore}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className={sub.score !== null ? "" : "ml-auto"}
                      onClick={() => setOpen(sub)}
                    >
                      {sub.status === "graded" ? "Review" : "Mark"}
                    </Button>
                  </div>

                  <p className="mb-1 text-sm font-medium text-ink">{sub.title}</p>
                  <p className="line-clamp-2 text-xs text-ink-muted">{sub.bodyMd}</p>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    Handed in {shortDate(sub.submittedAt)}
                    {sub.graderName ? ` · marked by ${sub.graderName}` : ""}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <GradeDialog submission={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}

function GradeDialog({
  submission, onClose, onChanged,
}: { submission: Submission | null; onClose: () => void; onChanged: () => void }) {
  const [band, setBand] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!submission) return null;
  const isGraded = submission.status === "graded";

  async function grade() {
    if (band === null || !submission) return;
    setBusy(true);
    setErr(null);
    try {
      await api.gradeSubmission(submission.id, {
        score: band,
        maxScore: 4,
        rubric: { band, criterion: BANDS.find((b) => b.score === band)?.label },
        feedbackMd: feedback.trim() || undefined,
      });
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That grade was not saved.");
    } finally {
      setBusy(false);
    }
  }

  async function ret() {
    if (!submission) return;
    setBusy(true);
    setErr(null);
    try {
      await api.returnSubmission(submission.id, reason.trim());
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That was not returned.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{submission.title}</DialogTitle>
          <DialogDescription>
            {submission.studentName} · <span className="num">{submission.slug}</span>
            {submission.isLate && " · handed in late"}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 max-h-64 overflow-y-auto rounded-md border border-line bg-surface-0 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-muted">
            <FileText className="h-3 w-3" aria-hidden="true" /> What they wrote
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink">{submission.bodyMd}</p>
        </div>

        {isGraded ? (
          <>
            <p className="mb-3 rounded-md border border-info bg-info-bg px-3 py-2 text-sm text-info">
              Already marked <span className="num">{submission.score}/{submission.maxScore}</span>.
              A graded submission is frozen — the student cannot change it, and neither can this
              page. To let them revise it, return it with a reason.
            </p>
            <Label htmlFor="ret-reason">Reason for returning (required)</Label>
            <Textarea
              id="ret-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Rubric applied to the wrong section; rework part 2."
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              The student sees this, and it goes to the audit log.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">
              Rubric — one band, out of 4
            </p>
            <div className="mb-4 space-y-1">
              {BANDS.map((b) => (
                <label
                  key={b.score}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-md border p-2.5 text-sm " +
                    (band === b.score
                      ? "border-accent bg-accent-muted"
                      : "border-line hover:bg-surface-2")
                  }
                >
                  <input
                    type="radio"
                    name="band"
                    className="mt-0.5"
                    checked={band === b.score}
                    onChange={() => setBand(b.score)}
                  />
                  <span className="num font-semibold">{b.score}</span>
                  <span className="flex-1">{b.label}</span>
                </label>
              ))}
            </div>
            <p className="mb-3 text-xs text-ink-faint">
              Reasoning is worth a full point on every lab. A correct answer with no explanation
              caps at 3 — that line is what separates a lab from a quiz.
            </p>

            <Label htmlFor="fb">Feedback</Label>
            <Textarea
              id="fb"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What would move this up a band?"
            />
          </>
        )}

        {err ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {isGraded ? (
            <Button variant="danger" disabled={busy || reason.trim().length < 3} onClick={() => void ret()}>
              Return for revision
            </Button>
          ) : (
            <Button disabled={busy || band === null} onClick={() => void grade()}>
              {busy ? "Saving…" : "Save grade"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
