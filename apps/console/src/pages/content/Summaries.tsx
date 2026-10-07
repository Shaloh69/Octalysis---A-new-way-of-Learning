import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type StageSummary } from "@/lib/api";
import { dayDate } from "@/lib/record-view";
import { chapterPath } from "@/lib/studio-view";
import { GROUPS, SUMMARY_TONE, SUMMARY_WORD, nextToReview } from "@/lib/content-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { GateNote, useApprovalGate } from "@/lib/approval-gate";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Planet-summary review (`WEB-REVAMP.md` §3.8; instructor rulings, 28 Sep 2026).
 *
 * An approval is of the text on screen: Approve sends that text's hash, and
 * the API refuses it if sync has written a different draft since. Sending back
 * needs a reason. Neither is styled as destructive: nothing is deleted, and a
 * sent-back summary returns to review when its `.md` draft is revised.
 */

/** Approve and send back, with their toasts and where focus goes next. */
export function useSummaryActions(onChanged: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const focusAfter = useRef<string | null>(null);

  async function approve(s: StageSummary, all: readonly StageSummary[]) {
    setBusy(s.stageId);
    try {
      await api.approveSummary(s.stageId, s.hash);
    } catch (e) {
      toast.error(
        `Stage ${s.stageId} summary was not approved`,
        e instanceof Error ? e.message : "Nothing changed. Try again.",
      );
      setBusy(null);
      onChanged(); // a refusal usually means the text changed: show the new one
      return;
    }
    toast.success(`Stage ${s.stageId} summary approved`, "Students see it on the map now.");
    focusAfter.current = nextToReview(all, s.stageId);
    setBusy(null);
    onChanged();
  }

  return { busy, approve, focusAfter };
}

/** After the list reloads, put focus on the next summary waiting, or on the heading. */
export function useFocusNext(focusAfter: React.MutableRefObject<string | null>, dataVersion: unknown) {
  useEffect(() => {
    const id = focusAfter.current;
    if (id === null) return;
    focusAfter.current = null;
    const el = document.querySelector<HTMLElement>(`[data-summary="${id}"] [data-approve]`);
    (el ?? document.querySelector<HTMLElement>("main h1"))?.focus();
  }, [dataVersion, focusAfter]);
}

export function SummaryEntry({
  s, all, busy, onApprove, onSendBack, linkTitle = true, headingLevel = 3, heading,
}: {
  s: StageSummary;
  all: readonly StageSummary[];
  busy: string | null;
  onApprove: (s: StageSummary, all: readonly StageSummary[]) => void;
  onSendBack: (s: StageSummary, opener: HTMLElement) => void;
  linkTitle?: boolean;
  headingLevel?: 2 | 3 | 4;
  /** Replaces the stage and title, where the page already names them (the chapter page). */
  heading?: string;
}) {
  const H = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  const when = dayDate(s.reviewedAt);
  const gate = useApprovalGate(s.authoredBy);
  return (
    <article className="ct-summary" data-summary={s.stageId} data-hash={s.hash} aria-labelledby={`sum-${s.stageId}`}>
      <div className="ct-summary-head">
        <H id={`sum-${s.stageId}`} className="ct-summary-title">
          {heading ?? (
            <>
              <span className="num">{s.stageId}</span>{" "}
              {linkTitle ? <Link className="ct-link" to={chapterPath(s.stageId)}>{s.title}</Link> : s.title}
            </>
          )}
        </H>
        <Badge tone={SUMMARY_TONE[s.status]} data-state={s.status}>{SUMMARY_WORD[s.status]}</Badge>
      </div>
      <p className="ct-summary-draft" data-draft>{s.draft}</p>
      {s.status === "sent_back" && s.note ? (
        <p className="ct-summary-note">
          <span className="font-medium text-ink">Sent back:</span> {s.note}
        </p>
      ) : null}
      {s.reviewer || when ? (
        <p className="ct-summary-meta">
          {SUMMARY_WORD[s.status]}
          {s.reviewer ? <> by {s.reviewer}</> : null}
          {when ? <> · <span className="num">{when}</span></> : null}
          {s.status === "sent_back" ? <> · back to review when content/stages/<span className="num">{s.stageId}</span>.md is revised</> : null}
        </p>
      ) : null}
      {s.status !== "sent_back" ? (
        <div className="ct-summary-actions">
          {s.status === "draft" ? (
            <Button size="sm" data-approve onClick={() => onApprove(s, all)} disabled={busy === s.stageId || !gate.allowed}
                    aria-describedby={gate.reason || gate.selfApproved ? `gate-sum-${s.stageId}` : undefined}>
              {busy === s.stageId ? "Approving…" : `Approve stage ${s.stageId}`}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={(e) => onSendBack(s, e.currentTarget)} disabled={busy === s.stageId}>
            {`Send back stage ${s.stageId}`}
          </Button>
          {s.status === "draft" ? <GateNote id={`gate-sum-${s.stageId}`} gate={gate} /> : null}
        </div>
      ) : null}
    </article>
  );
}

/** The Summaries view: three groups, in the order a reviewer works them. */
export function SummaryGroups({
  summaries, busy, onApprove, onSendBack, nested = false,
}: {
  /** Under a page section of its own: the groups are h3 and each entry h4. */
  nested?: boolean;
  summaries: readonly StageSummary[];
  busy: string | null;
  onApprove: (s: StageSummary, all: readonly StageSummary[]) => void;
  onSendBack: (s: StageSummary, opener: HTMLElement) => void;
}) {
  return (
    <div className="ct-groups">
      {GROUPS.map((g) => {
        const list = summaries.filter((s) => s.status === g.status);
        return (
          <section key={g.status} className="ct-card ct-group" data-group={g.status} aria-labelledby={`grp-${g.status}`}>
            {nested ? (
              <h3 id={`grp-${g.status}`} className="ct-h2">
                {g.title} <span className="num text-ink-muted">{list.length}</span>
              </h3>
            ) : (
              <h2 id={`grp-${g.status}`} className="ct-h2">
                {g.title} <span className="num text-ink-muted">{list.length}</span>
              </h2>
            )}
            {list.length === 0 ? (
              <p className="ct-group-empty">{g.empty}</p>
            ) : (
              list.map((s) => (
                <SummaryEntry key={s.stageId} s={s} all={summaries} busy={busy} onApprove={onApprove} onSendBack={onSendBack} headingLevel={nested ? 4 : 3} />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

export function SendBackDialog({
  summary, onClose, onDone, returnFocus,
}: {
  summary: StageSummary | null;
  onClose: () => void;
  onDone: (s: StageSummary) => void;
  returnFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!summary) return;
    setReason("");
    setSaving(false);
    setError(null);
  }, [summary]);

  const s = summary;
  const live = s?.status === "approved";

  async function send() {
    if (!s) return;
    setSaving(true);
    setError(null);
    try {
      await api.sendBackSummary(s.stageId, reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not sent back.");
      toast.error(`Stage ${s.stageId} summary was not sent back`, "The dialog is still open with your reason in it.");
      setSaving(false);
      return;
    }
    toast.success(
      `Stage ${s.stageId} summary sent back`,
      live ? "It has left students' screens." : "Students will not see it until a revised draft is approved.",
    );
    setSaving(false);
    onClose();
    onDone(s);
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
          <DialogTitle>Send back stage {s?.stageId}'s summary?</DialogTitle>
          <DialogDescription>{s?.title}</DialogDescription>
        </DialogHeader>

        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          <p className="mb-1 font-medium">What happens</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {live
                ? "It leaves the map sidebar now. Students will not see a summary for this stage."
                : "Students will not see it. The map sidebar shows the stage's objectives instead."}
            </li>
            <li>
              It comes back to review when its draft in content/stages/<span className="num">{s?.stageId}</span>.md is
              revised and synced.
            </li>
            <li>Your reason is kept for the author, and in the audit log with your name and the time.</li>
          </ul>
        </div>

        <Label htmlFor="sendback-reason">Reason (required)</Label>
        <Textarea
          id="sendback-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Say that stage 01 opens from the start."
        />

        {error ? (
          <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">
            Not sent back. {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void send()} disabled={reason.trim().length < 3 || saving}>
            {saving ? "Sending back…" : `Send back stage ${s?.stageId ?? ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
