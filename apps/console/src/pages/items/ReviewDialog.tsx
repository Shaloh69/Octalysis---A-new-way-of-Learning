import { useEffect, useState } from "react";
import { Dices } from "lucide-react";
import { api, type BankItem, type ResolvedPreview } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { TYPE_LABEL } from "@/lib/items-view";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Reviewing one item: the resolved instance, its key, and the decision.
 *
 * Carried over from the page this replaced, deliberately and unchanged in
 * behaviour -- these are the rules `apps/console/CLAUDE.md` records for /items:
 *
 * - **A decision ADVANCES to the next item rather than closing.** Reviewing a
 *   seeded bank is a few hundred decisions in a row, and closing after each
 *   pushes a reviewer towards clicking Approve to make the modal go away.
 * - **Sending back needs a reason**, recorded in `audit_log`.
 * - **The self-approval tick is gated on AUTHORSHIP.** It says "I wrote this
 *   item"; offering it on a seeded item would invite a false statement into
 *   the audit log.
 *
 * New here: every decision confirms itself -- a toast, and a status line inside
 * the dialog, because Radix hides everything outside a modal from screen
 * readers while it is open, the toast region included.
 */

type Decision = { to: "live" | "draft" | "review" | "retired"; verb: string; reason?: string };

export function ReviewDialog({
  item,
  position,
  onClose,
  onDecided,
  onCloseFocus,
}: {
  item: BankItem | null;
  /** Where this item sits in the list being reviewed, for "12 of 183". */
  position: { at: number; of: number } | null;
  onClose: () => void;
  /** Called after a decision is saved, with the item it was about. */
  onDecided: (item: BankItem) => void;
  /** Return focus to this item's row when the dialog closes, if it is on screen. */
  onCloseFocus: (event: Event) => void;
}) {
  const [seed, setSeed] = useState("preview-1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selfApproved, setSelfApproved] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [said, setSaid] = useState("");
  /*
   * The last item shown, kept while the dialog animates out. Unmounting on
   * `item === null` would cut the exit fade; Radix needs the dialog mounted
   * with `open={false}` to play it.
   */
  const [shown, setShown] = useState<BankItem | null>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);

  const { data, error, loading } = useAsync<ResolvedPreview | null>(
    () => (shown ? api.previewItem(shown.id, seed) : Promise.resolve(null)),
    [shown?.id, seed],
  );

  // A fresh item starts clean: nothing it did not earn carries over from the
  // last one -- above all not a ticked self-approval or a typed reason.
  useEffect(() => {
    setSeed("preview-1");
    setSelfApproved(false);
    setRejecting(false);
    setReason("");
    setErr(null);
  }, [shown?.id]);

  // The confirmation line belongs to one review session, not to the next.
  useEffect(() => {
    if (item === null) setSaid("");
  }, [item]);

  if (!shown) return null;
  const current = shown;

  async function decide(d: Decision) {
    setBusy(true);
    setErr(null);
    try {
      await api.setItemStatus(current.id, d.to, {
        ...(d.reason ? { reason: d.reason } : {}),
        ...(selfApproved ? { selfApproved: true } : {}),
      });
      const what = `${current.slug} ${d.verb}`;
      setSaid(`${what}. Showing the next item.`);
      toast.success(
        what,
        d.to === "live" ? "Live: students can now draw it." : d.reason ? `Reason: ${d.reason}` : undefined,
      );
      onDecided(current);
    } catch (e) {
      const message = e instanceof Error ? e.message : "That change was not saved.";
      setErr(message);
      toast.error(`${current.slug} was not ${d.verb}`, message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "ease-dialog max-w-2xl",
          // At 380 the dialog sits high, leaving the bottom band to the toast:
          // a confirmation must never land on the button that triggered it.
          "max-sm:top-3 max-sm:translate-y-0 max-sm:max-h-[calc(100dvh-8rem)]",
        )}
        onCloseAutoFocus={onCloseFocus}
        onPointerDownOutside={(e) => {
          // Dismissing a toast is not dismissing the review.
          if ((e.target as Element | null)?.closest?.("[data-toaster]")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-2">
            <span className="num text-base">{current.slug}</span>
            {position ? (
              <span className="num text-xs font-normal text-ink-muted">
                {position.at} of {position.of}
              </span>
            ) : null}
          </DialogTitle>
          <p className="num text-xs text-ink-muted">
            v{current.version} · stage {current.stageId} · {TYPE_LABEL[current.type]} · {current.bloom} ·{" "}
            {current.status}
          </p>
          <DialogDescription>
            Resolved by the same engine a student&apos;s paper goes through. Re-roll to see the
            spread of variants your students will actually get.
            {current.authorName ? null : (
              <span className="mt-1 block">
                No author on record: this item was seeded rather than written in the console, so
                approving it counts as a first review, not a self-approval.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Always present, so it is a live region before anything is said into it. */}
        <p role="status" className="min-h-0 text-xs text-success empty:hidden">
          {said}
        </p>

        <div key={`${current.id}:${seed}`} className="ease-swap">
          <div className="mb-3 flex items-center gap-2">
            <span className="num text-xs text-ink-muted">seed {seed}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSeed(`preview-${Math.floor(Math.random() * 1e6)}`)}
            >
              <Dices className="h-3.5 w-3.5" aria-hidden="true" /> Re-roll
            </Button>
          </div>

          {loading ? (
            // The preview's shape, not a spinner: a stem and four options.
            <div aria-busy="true" className="mb-3 grid gap-2">
              <span className="skeleton-bar h-16" />
              {[0, 1, 2, 3].map((k) => (
                <span key={k} className="skeleton-bar h-8" />
              ))}
            </div>
          ) : error ? (
            <p role="alert" className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
              The preview could not be loaded: {error}
            </p>
          ) : data?.error ? (
            <p role="alert" className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
              This item could not be resolved: {data.error}
            </p>
          ) : data?.item ? (
            <>
              <p className="mb-3 whitespace-pre-wrap rounded-md border border-line bg-surface-0 p-3 text-sm text-ink">
                {data.item.stem}
              </p>
              {data.item.correctIndex < 0 ? (
                /*
                  AN ORDERING ITEM HAS NO KEYED OPTION -- its key is a sequence.
                  The page this replaced showed only the shuffled steps with
                  nothing marked, so an ordering item's answer could not be
                  checked before it was approved. Found 25 Sep 2026 by the /items
                  gate, whose first row happened to be one.
                */
                <>
                  <p className="mb-1 text-xs text-ink-muted">As a student sees the steps, shuffled:</p>
                  <ul className="mb-3 grid gap-1">
                    {data.item.options.map((o, k) => (
                      <li key={k} className="rounded-md border border-line px-2.5 py-1.5 text-sm text-ink">
                        {o}
                      </li>
                    ))}
                  </ul>
                  <p className="mb-1 text-xs text-ink-muted">
                    <span className="font-semibold text-success">key</span>
                    <span> · the order marked correct</span>
                  </p>
                  <ol className="mb-3 grid gap-1">
                    {data.item.correctValue.split(" | ").map((step, k) => (
                      <li
                        key={k}
                        className="flex items-start gap-2 rounded-md border border-success bg-success-bg px-2.5 py-1.5 text-sm text-ink"
                      >
                        <span className="num text-xs text-ink-muted">{k + 1}</span>
                        <span className="min-w-0 flex-1">{step}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <ol className="mb-3 grid gap-1">
                  {data.item.options.map((o, k) => {
                    const isKey = k === data.item!.correctIndex;
                    return (
                      <li
                        key={k}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                          isKey ? "border-success bg-success-bg text-ink" : "border-line text-ink",
                        )}
                      >
                        <span className="num text-xs text-ink-muted">{String.fromCharCode(65 + k)}</span>
                        <span className="min-w-0 flex-1">{o}</span>
                        {isKey ? <span className="text-xs font-semibold text-success">key</span> : null}
                      </li>
                    );
                  })}
                </ol>
              )}
              {data.item.rationale ? (
                <p className="mb-3 text-sm text-ink-muted">{data.item.rationale}</p>
              ) : (
                <p className="mb-3 text-sm text-warning">
                  No rationale. A student who gets this wrong learns nothing from it.
                </p>
              )}
              {Object.keys(data.item.resolvedParams ?? {}).length > 0 ? (
                <p className="num mb-3 text-xs text-ink-muted">
                  {Object.entries(data.item.resolvedParams)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join("  ")}
                </p>
              ) : null}
            </>
          ) : null}

          {current.stats.flagged ? (
            <p className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
              Flagged: {current.stats.flagReason ?? "the statistics say this item is misbehaving"}.
            </p>
          ) : null}

          {/*
            THE SELF-APPROVAL BOX IS GATED ON AUTHORSHIP, not just on status.
            On a seeded item the reviewer did not write it, and the server only
            asks for this when `author_id` matches the reviewer anyway.
          */}
          {current.status === "review" && current.authorName ? (
            <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface-0 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={selfApproved}
                onChange={(e) => setSelfApproved(e.target.checked)}
              />
              <span className="text-sm text-ink">
                I wrote this item and have re-checked the answer key myself.
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Only needed when you are the only member of staff. Recorded in the audit log as a
                  self-approval. If someone else can review it, ask them instead.
                </span>
              </span>
            </label>
          ) : null}

          {current.status === "live" ? (
            <p className="mb-3 rounded-md border border-info bg-info-bg px-3 py-2 text-xs text-ink">
              This item is live. It cannot be edited: an edit creates a new version and retires this
              one, and <strong>statistics do not carry over</strong>.
            </p>
          ) : null}

          {rejecting ? (
            <div className="mb-3 rounded-md border border-line bg-surface-0 p-3">
              <label htmlFor="reject-reason" className="mb-1.5 block text-sm text-ink">
                What is wrong with this item?
              </label>
              <Textarea
                id="reject-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="The key is wrong: B is also correct at 8 bits."
              />
              <p className="mt-1 text-xs text-ink-muted">
                Recorded in the audit log against this item. It goes back to draft, not away.
              </p>
            </div>
          ) : null}

          {err ? (
            <p role="alert" className="mb-2 text-sm text-danger">
              {err}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {current.status === "draft" ? (
            <Button disabled={busy} onClick={() => void decide({ to: "review", verb: "sent to review" })}>
              Send to review
            </Button>
          ) : null}
          {current.status === "review" && !rejecting ? (
            <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
              Send back
            </Button>
          ) : null}
          {/*
            Not `danger`: sending an item back is half of what a review is for,
            not a destructive act. Approve is hidden while this is open, so the
            primary button is unambiguous.
          */}
          {current.status === "review" && rejecting ? (
            <Button
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                void decide({ to: "draft", verb: "sent back to draft", reason: reason.trim() })
              }
            >
              Send back to draft
            </Button>
          ) : null}
          {current.status === "review" && !rejecting ? (
            <Button disabled={busy} onClick={() => void decide({ to: "live", verb: "approved" })}>
              Approve and publish
            </Button>
          ) : null}
          {current.status === "live" ? (
            <Button variant="danger" disabled={busy} onClick={() => void decide({ to: "retired", verb: "retired" })}>
              Retire
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
