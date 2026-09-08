import { useState } from "react";
import { Dices, Flag } from "lucide-react";
import { api, type BankItem, type ResolvedPreview } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * The item bank.
 *
 * `PHASES.md` calls the bank the real project: the code is finite, the bank is
 * continuous, and no amount of code substitutes for it. This page is where
 * "approve every one by hand before it goes live" becomes something a person
 * can actually do.
 *
 * WHAT THE NUMBERS MEAN, because a psychometric shown without its reading is
 * just a number a teacher will ignore:
 *
 *   p-value        the proportion who got it right. It is DIFFICULTY, and it
 *                  runs the intuitive way round: HIGH means EASY. Below ~0.25
 *                  on a 4-option item is at or under guessing.
 *   discrimination point-biserial. Does this item separate students who know
 *                  the material from those who do not? Below ~0.15 it does not,
 *                  whatever its p-value says — and a NEGATIVE value means the
 *                  students who did best on the paper did worst on this item,
 *                  which almost always means the key is wrong.
 *
 * Both need exposures before they mean anything. Under 30 the page says so
 * rather than showing a number that looks authoritative and is noise.
 */

const STATUS_TONE = {
  draft: "neutral",
  review: "warning",
  live: "success",
  retired: "locked",
} as const;

export function ItemsPage() {
  const [stageId, setStageId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const { data, error, loading, reload } = useAsync(
    () => api.items({ stageId, status, flagged: onlyFlagged ? "true" : null }),
    [stageId, status, onlyFlagged],
  );
  const stagesQ = useAsync(() => api.stages(), []);
  const [preview, setPreview] = useState<BankItem | null>(null);

  /*
   * Advance through the queue instead of closing on every decision.
   *
   * Reviewing a seeded bank means a few hundred decisions in a row. Closing the
   * dialog after each one and hunting for the next row is not just slow -- it
   * pushes a reviewer towards clicking Approve to make the modal go away, which
   * is the exact failure the review rule exists to prevent. One decision per
   * item is preserved; only the navigation between them is removed.
   *
   * `next` is taken from the list as it stands BEFORE the reload, because after
   * the reload the item just decided has left the filter and every index moves.
   */
  function advanceFrom(item: BankItem): void {
    const list = data?.items ?? [];
    const i = list.findIndex((x) => x.id === item.id);
    setPreview(i >= 0 ? (list[i + 1] ?? null) : null);
    reload();
  }

  if (loading) return <Loading what="the item bank" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const queue = data.items;
  const queueIndex = preview ? queue.findIndex((x) => x.id === preview.id) : -1;

  const s = data.summary;
  const total = Object.values(s).reduce((a, b) => a + b, 0);

  return (
    <>
      <header className="mb-4">
        <h1 className="mb-1 font-display text-2xl">Items</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          <span className="num">{total}</span> in the bank ·{" "}
          <span className="num text-success">{s.live ?? 0}</span> live ·{" "}
          <span className="num text-warning">{s.review ?? 0}</span> awaiting review ·{" "}
          <span className="num">{s.draft ?? 0}</span> draft ·{" "}
          <span className="num text-ink-faint">{s.retired ?? 0}</span> retired
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant={status === null ? "default" : "outline"} onClick={() => setStatus(null)}>
          All
        </Button>
        {(["draft", "review", "live", "retired"] as const).map((st) => (
          <Button key={st} size="sm" variant={status === st ? "default" : "outline"} onClick={() => setStatus(st)}>
            {st}
          </Button>
        ))}

        <span className="mx-2 h-5 w-px bg-line" aria-hidden="true" />

        <Button
          size="sm"
          variant={onlyFlagged ? "default" : "outline"}
          onClick={() => setOnlyFlagged((v) => !v)}
        >
          <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Flagged
        </Button>

        <select
          aria-label="Filter by stage"
          className="ml-auto h-8 rounded-md border border-line bg-surface-0 px-2 text-xs text-ink"
          value={stageId ?? ""}
          onChange={(e) => setStageId(e.target.value || null)}
        >
          <option value="">Every stage</option>
          {stagesQ.data?.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.id} · {n.title}
            </option>
          ))}
        </select>
      </div>

      {data.items.length === 0 ? (
        <Empty
          title="No items match"
          hint={
            total === 0
              ? "The bank is empty. Target is roughly 40 live items per gradeable chapter — author eight to ten by hand first to set the style."
              : "Try a different filter."
          }
        />
      ) : (
        /*
          A TABLE, not a card list. Measured at 122px per card across 33 items,
          this page cost about 4,000px to scan a bank that is meant to reach
          ~40 live items per gradeable chapter -- roughly 700 items, or 85,000
          pixels, at target.

          `CONSOLE-DATA-AND-TEMPLATES.md` §2 named this exactly: an item bank
          with p-value / discrimination / exposure columns "is the same shape"
          as the submissions queue D-4 fixed, and the two "should be solved
          together against the same reference rather than separately by taste".
          The reference is shadcn-admin's Tasks page, the densest table in the
          template this console already uses.

          Nothing is dropped in the move. Every field the card carried has a
          column, and the two psychometric WARNINGS -- a p-value at guessing,
          and a negative discrimination meaning the key is probably wrong --
          still say so in words, because those sentences are the entire reason
          a teacher opens this page.
        */
        <div className="table-scroll rounded-lg border border-line bg-surface-1">
          {/*
            The 30-exposure rule, once. Every row would otherwise repeat it, and
            on a new bank that is every row in the table.
          */}
          <p className="border-b border-line px-3 py-2 text-xs text-ink-faint">
            p-value and discrimination stay blank until an item has been seen{" "}
            <span className="num">30</span> times — below that the numbers do not mean anything
            yet.
          </p>
          <Table>
            <THead>
              <TR>
                <TH>Item</TH>
                <TH>Stem</TH>
                <TH>Objective</TH>
                <TH className="text-right">Exposures</TH>
                <TH className="text-right">p</TH>
                <TH>Discrimination</TH>
                <TH aria-label="Preview" />
              </TR>
            </THead>
            <TBody>
              {data.items.map((i) => (
                <TR key={i.id}>
                  <TD className="whitespace-nowrap align-top">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
                      {i.stats.flagged ? (
                        <Badge tone="danger" title={i.stats.flagReason ?? ""}>
                          <Flag className="mr-1 h-3 w-3" aria-hidden="true" /> flagged
                        </Badge>
                      ) : null}
                    </div>
                    <div className="num mt-0.5 text-xs text-ink-faint">
                      {i.slug} · v{i.version} · stage {i.stageId} ·{" "}
                      {i.type === "S" ? "static" : i.type === "P" ? "parameterized" : "generated"} ·{" "}
                      {i.bloom}
                    </div>
                  </TD>

                  <TD className="min-w-[18rem] max-w-lg align-top text-sm">{i.stemTemplate}</TD>

                  {/*
                    Clamped to two lines, with the full text on hover.
                    Objective descriptions are whole sentences ("Illustrate the
                    cell structures of DRAM and SRAM"), and left unbounded they
                    were the biggest single contributor to row height -- 98px per
                    row against the 122px card list is not a density pass, it is
                    a rounding error. The ID above it is the identifier; the
                    sentence is context, and context can be two lines.
                  */}
                  <TD className="max-w-[16rem] align-top text-xs">
                    {i.objectiveText ? (
                      <span title={i.objectiveText}>
                        <span className="num">{i.objectiveId}</span>{" "}
                        <span className="line-clamp-2 text-ink-muted">{i.objectiveText}</span>
                      </span>
                    ) : (
                      /* Kept in full: an unlinked item is invisible to objective
                         coverage, which is a bank-integrity problem, not a note. */
                      <span className="text-warning">
                        Not linked to an objective — it cannot be sampled by objective coverage.
                      </span>
                    )}
                  </TD>

                  <TD className="num align-top text-right text-xs text-ink-muted">
                    {i.stats.exposures}
                  </TD>

                  <PsychometricCells stats={i.stats} />

                  <TD className="align-top">
                    <Button size="sm" variant="outline" onClick={() => setPreview(i)}>
                      Preview
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <PreviewDialog
        item={preview}
        position={queueIndex >= 0 ? { at: queueIndex + 1, of: queue.length } : null}
        onClose={() => setPreview(null)}
        onDecided={advanceFrom}
      />
    </>
  );
}

/**
 * The p-value and discrimination cells.
 *
 * Two cells rather than a block, so the numbers line up down the column and can
 * be compared at a glance — which is the entire reason for having them.
 *
 * THE WARNINGS SURVIVE THE DENSITY PASS. A negative point-biserial means the
 * students who did best on the paper did worst on this item, which almost
 * always means the key is wrong; that sentence is why a teacher opens this page
 * at all, and compressing it into a colour would have been the density pass
 * eating the thing it was meant to surface.
 */
function PsychometricCells({ stats }: { stats: BankItem["stats"] }) {
  const { exposures, pValue, discrimination } = stats;

  if (exposures < 30) {
    /*
     * Said ONCE, above the table, not on every row.
     *
     * The first version printed "Not enough exposures to say anything yet --
     * statistics start meaning something around 30" in every row, which on a
     * fresh bank is every row: 22 copies of one sentence, and the single
     * biggest contributor to row height. Repeating an explanation per row is
     * how a density pass quietly gives back what it won.
     *
     * The em dash carries it instead, and the exposure count beside it is the
     * evidence. The rule itself lives in the note above the table.
     */
    return (
      <>
        <TD className="align-top text-right text-xs text-ink-faint">—</TD>
        <TD className="align-top text-xs text-ink-faint">—</TD>
      </>
    );
  }

  // A negative point-biserial is the loud one: the students who did best on the
  // paper did WORST on this item, which almost always means the key is wrong.
  const badDiscrimination = discrimination !== null && discrimination < 0.15;
  const negative = discrimination !== null && discrimination < 0;

  return (
    <>
      <TD
        className={cn(
          "num align-top text-right text-xs",
          pValue !== null && pValue < 0.25 ? "text-warning" : "text-ink-muted",
        )}
      >
        {pValue?.toFixed(2) ?? "—"}
        {pValue !== null ? (
          <span className="ml-1 block text-ink-faint">
            {pValue > 0.85 ? "very easy" : pValue < 0.25 ? "at guessing" : "reasonable"}
          </span>
        ) : null}
      </TD>
      <TD
        className={cn(
          "align-top text-xs",
          negative ? "text-danger" : badDiscrimination ? "text-warning" : "text-ink-muted",
        )}
      >
        <span className="num">{discrimination?.toFixed(2) ?? "—"}</span>
        {negative ? (
          <span className="ml-1">— the key is probably wrong</span>
        ) : badDiscrimination ? (
          <span className="ml-1 text-ink-faint">— not separating students</span>
        ) : null}
      </TD>
    </>
  );
}

/* ------------------------------------------------------------- preview */

function PreviewDialog({
  item, position, onClose, onDecided,
}: {
  item: BankItem | null;
  /** Where this item sits in the filtered list, for "12 of 177". */
  position: { at: number; of: number } | null;
  onClose: () => void;
  onDecided: (item: BankItem) => void;
}) {
  const [seed, setSeed] = useState("preview-1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selfApproved, setSelfApproved] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { data, error, loading } = useAsync<ResolvedPreview | null>(
    () => (item ? api.previewItem(item.id, seed) : Promise.resolve(null)),
    [item?.id, seed],
  );

  if (!item) return null;

  async function decide(status: string, opts: { reason?: string } = {}) {
    if (!item) return;
    setBusy(true);
    setErr(null);
    try {
      await api.setItemStatus(item.id, status, {
        ...opts,
        ...(selfApproved ? { selfApproved: true } : {}),
      });
      /*
       * Reset the per-item controls before advancing, or the next item inherits
       * this one's ticked self-approval and typed reason -- which would attach a
       * confirmation the reviewer never made to an item they have not read.
       */
      setSelfApproved(false);
      setRejecting(false);
      setReason("");
      onDecided(item);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That change was not saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {item.slug}
            {position ? (
              <span className="num ml-2 text-xs font-normal text-ink-faint">
                {position.at} of {position.of}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Resolved by the same engine a student&apos;s paper goes through. Re-roll to see the
            spread of variants your students will actually get.
            {item.authorName ? null : (
              <span className="mt-1 block">
                No author on record — this item was seeded rather than written in the console, so
                approving it counts as a first review, not a self-approval.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex items-center gap-2">
          <span className="num text-xs text-ink-faint">seed {seed}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSeed(`preview-${Math.floor(Math.random() * 1e6)}`)}
          >
            <Dices className="h-3.5 w-3.5" aria-hidden="true" /> Re-roll
          </Button>
        </div>

        {loading ? (
          <Loading what="the preview" />
        ) : error ? (
          <ErrorNote message={error} />
        ) : data?.error ? (
          <ErrorNote message={`This item could not be resolved: ${data.error}`} />
        ) : data?.item ? (
          <>
            <p className="mb-3 whitespace-pre-wrap rounded-md border border-line bg-surface-0 p-3 text-sm text-ink">
              {data.item.stem}
            </p>
            <ul className="mb-3 space-y-1">
              {data.item.options.map((o, k) => (
                <li
                  key={k}
                  className={cn(
                    "flex items-start gap-2 rounded-sm border px-2.5 py-1.5 text-sm",
                    k === data.item!.correctIndex
                      ? "border-success bg-success-bg text-success"
                      : "border-transparent text-ink-muted",
                  )}
                >
                  <span className="num text-xs">{String.fromCharCode(65 + k)}</span>
                  <span className="flex-1">{o}</span>
                  {k === data.item!.correctIndex ? <span className="text-xs">key</span> : null}
                </li>
              ))}
            </ul>
            {data.item.rationale ? (
              <p className="mb-3 text-sm text-ink-muted">{data.item.rationale}</p>
            ) : (
              <p className="mb-3 text-sm text-warning">
                No rationale. A student who gets this wrong learns nothing from it.
              </p>
            )}
            {Object.keys(data.item.resolvedParams ?? {}).length > 0 ? (
              <p className="num mb-3 text-xs text-ink-faint">
                {Object.entries(data.item.resolvedParams)
                  .map(([k, v]) => `${k}=${String(v)}`)
                  .join("  ")}
              </p>
            ) : null}
          </>
        ) : null}

        {/*
          THE SELF-APPROVAL BOX IS GATED ON AUTHORSHIP, not just on status.

          It says "I wrote this item and have re-checked the answer key myself".
          On a seeded item the reviewer did NOT write it, so offering the tick
          invites them to record a false statement in `audit_log` -- and the
          server would not have asked for it anyway, because it only demands
          self-approval when `author_id` matches the reviewer. An item with no
          author on record is reviewed normally, which is the honest reading:
          the instructor really is the first person to check it.
        */}
        {item.status === "review" && item.authorName ? (
          /*
           * The self-approval acknowledgement.
           *
           * The server decides whether this is even allowed -- it is refused
           * outright while a second member of staff exists, so this box is a
           * fallback for a one-instructor install rather than a way around the
           * review rule. Ticking it is recorded in audit_log as a
           * self-approval, distinguishable from a real review forever.
           */
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

        {item.status === "live" ? (
          <p className="rounded-md border border-info bg-info-bg px-3 py-2 text-xs text-info">
            This item is live. It cannot be edited — an edit creates a new version and retires this
            one, and <strong>statistics do not carry over</strong>.
          </p>
        ) : null}

        {/*
          SENDING AN ITEM BACK.
          Until now `review` offered exactly one decision: Approve and publish.
          A reviewer who found a wrong key, a bad distractor or a stem that did
          not match its objective had no way to say so -- the item either went
          live or sat in the queue forever. On a seeded bank that is the decision
          they will need most, so it is a first-class action, and the reason is
          REQUIRED: "rejected" with no reason tells the next person nothing, and
          the API already records it in `audit_log`.
        */}
        {rejecting ? (
          <div className="mb-3 rounded-md border border-line bg-surface-0 p-3">
            <label htmlFor="reject-reason" className="mb-1.5 block text-sm text-ink">
              What is wrong with this item?
            </label>
            <textarea
              id="reject-reason"
              className="w-full rounded-sm border border-line bg-surface-1 px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The key is wrong — B is also correct at 8 bits."
            />
            <p className="mt-1 text-xs text-ink-muted">
              Recorded in the audit log against this item. It goes back to draft, not away.
            </p>
          </div>
        ) : null}

        {err ? (
          <p className="mb-2 text-sm text-danger" role="alert">
            {err}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {item.status === "draft" ? (
            <Button variant="outline" disabled={busy} onClick={() => void decide("review")}>
              Send to review
            </Button>
          ) : null}
          {item.status === "review" && !rejecting ? (
            <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
              Send back
            </Button>
          ) : null}
          {/*
            NOT `danger` below. That variant is reserved for destructive staff
            actions, and sending an item back is neither destructive nor unusual
            -- it is half of what a review is for. Approve is hidden while this
            panel is open, so the primary variant is unambiguous.
          */}
          {item.status === "review" && rejecting ? (
            <Button
              disabled={busy || reason.trim().length < 3}
              onClick={() => void decide("draft", { reason: reason.trim() })}
            >
              Send back to draft
            </Button>
          ) : null}
          {item.status === "review" && !rejecting ? (
            <Button disabled={busy} onClick={() => void decide("live")}>
              Approve and publish
            </Button>
          ) : null}
          {item.status === "live" ? (
            <Button variant="danger" disabled={busy} onClick={() => void decide("retired")}>
              Retire
            </Button>
          ) : null}
        </DialogFooter>


      </DialogContent>
    </Dialog>
  );
}
