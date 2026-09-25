import { CircleDashed, CircleDot, CircleCheck, Archive, Flag } from "lucide-react";
import type { BankItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  MIN_EXPOSURES, TYPE_LABEL, readDiscrimination, readPValue, type ItemStatus,
} from "@/lib/items-view";

/**
 * The bank, as a table. See `design/templates/console/items/SPEC.md` for why
 * each column is the width it is and what was deliberately not copied from
 * the template.
 *
 * Roles are spelled out on every element because below 60rem the rows reflow
 * into blocks (`index.css`, `.bank-table`), and a `display` change can strip a
 * table's semantics in some screen readers. Stated, they survive.
 */

const STATUS: Record<ItemStatus, { icon: typeof CircleDot; label: string; tone: string }> = {
  review: { icon: CircleDot, label: "review", tone: "text-warning" },
  draft: { icon: CircleDashed, label: "draft", tone: "text-ink-muted" },
  live: { icon: CircleCheck, label: "live", tone: "text-success" },
  retired: { icon: Archive, label: "retired", tone: "text-ink-muted" },
};

/** The number of `<th>`s. The skeleton promises the same, and the spec checks it. */
export const BANK_COLUMNS = 7;

export function BankTable({
  rows,
  viewKey,
  busy,
  selected,
  onToggle,
  onToggleAll,
  onReview,
}: {
  rows: BankItem[];
  /** Changes when the page or a filter changes, so the rows fade in afresh. */
  viewKey: string;
  busy: boolean;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  onReview: (item: BankItem) => void;
}) {
  const drafts = rows.filter((r) => r.status === "draft").map((r) => r.id);
  const allOn = drafts.length > 0 && drafts.every((id) => selected.has(id));

  return (
    <>
      {/*
        Select-all, only when the page holds drafts: bulk review can only ever
        move a draft, so a checkbox anywhere else would be a control that does
        nothing. ABOVE the table rather than in its header, because below 60rem
        the header row is kept for screen readers only -- a control in it would
        be unreachable exactly where the template put it.
      */}
      {drafts.length > 0 ? (
        <label className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={allOn}
            onChange={(e) => onToggleAll(drafts, e.target.checked)}
          />
          Select every draft on this page <span className="num text-ink-muted">({drafts.length})</span>
        </label>
      ) : null}
    <table className="bank-table" role="table" aria-busy={busy || undefined}>
      <colgroup>
        <col className="c-item" />
        <col className="c-stem" />
        <col className="c-status" />
        <col className="c-exp" />
        <col className="c-p" />
        <col className="c-disc" />
        <col className="c-act" />
      </colgroup>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col" className="c-item">Item</th>
          <th role="columnheader" scope="col" className="c-stem">Stem · objective</th>
          <th role="columnheader" scope="col" className="c-status">Status</th>
          <th role="columnheader" scope="col" className="c-exp num-col">Exposures</th>
          <th role="columnheader" scope="col" className="c-p num-col">p</th>
          <th role="columnheader" scope="col" className="c-disc">Discrimination</th>
          <th role="columnheader" scope="col" className="c-act">
            <span className="sr-only">Review</span>
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup" key={viewKey} className="bank-rows">
        {rows.map((i) => (
          <Row
            key={i.id}
            item={i}
            selected={selected.has(i.id)}
            onToggle={onToggle}
            onReview={onReview}
          />
        ))}
      </tbody>
    </table>
    </>
  );
}

function Row({
  item: i,
  selected,
  onToggle,
  onReview,
}: {
  item: BankItem;
  selected: boolean;
  onToggle: (id: string) => void;
  onReview: (item: BankItem) => void;
}) {
  const st = STATUS[i.status];
  const StatusIcon = st.icon;

  return (
    <tr role="row" data-selected={selected || undefined}>
      <td role="cell" className="c-item">
        <div className="flex items-start gap-2">
          {i.status === "draft" ? (
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              aria-label={`Select ${i.slug}`}
              checked={selected}
              onChange={() => onToggle(i.id)}
            />
          ) : null}
          <div className="min-w-0">
            <p data-slug="" className="num text-xs font-semibold text-ink">
              {i.slug}
            </p>
            <p data-meta="" className="num text-xs text-ink-muted">
              v{i.version} · stage {i.stageId} · {TYPE_LABEL[i.type]} · {i.bloom}
            </p>
          </div>
        </div>
      </td>

      <td role="cell" className="c-stem">
        {/* Two lines, the whole stem in the review dialog and on hover. */}
        <p className="line-clamp-2 text-sm text-ink" title={i.stemTemplate}>
          {i.stemTemplate}
        </p>
        {i.objectiveId ? (
          <p
            data-objective=""
            className="mt-0.5 truncate text-xs text-ink-muted"
            title={i.objectiveText ?? ""}
          >
            <span className="num text-ink">{i.objectiveId}</span>
            {i.objectiveText ? ` · ${i.objectiveText}` : null}
          </p>
        ) : (
          // Kept whole: an unlinked item is invisible to objective coverage,
          // which is a bank-integrity problem, not a footnote.
          <p data-objective="" className="mt-0.5 text-xs text-warning">
            Not linked to an objective — it cannot be sampled by objective coverage.
          </p>
        )}
      </td>

      <td role="cell" className="c-status">
        <span className={cn("inline-flex items-center gap-1.5 text-xs", st.tone)}>
          <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {st.label}
        </span>
        {i.stats.flagged ? (
          <span
            className="mt-1 inline-flex items-center gap-1 rounded-full border border-danger bg-danger-bg px-2 text-xs text-danger"
            title={i.stats.flagReason ?? ""}
          >
            <Flag className="h-3 w-3 shrink-0" aria-hidden="true" /> flagged
          </span>
        ) : null}
      </td>

      <td role="cell" className="c-exp num-col" data-label="Exposures">
        <span className="num text-xs text-ink-muted">{i.stats.exposures}</span>
      </td>

      <Psychometrics stats={i.stats} />

      <td role="cell" className="c-act">
        <Button
          size="sm"
          variant="outline"
          aria-label={`Review ${i.slug}`}
          data-review-id={i.id}
          onClick={() => onReview(i)}
        >
          Review
        </Button>
      </td>
    </tr>
  );
}

/**
 * p-value and discrimination: two cells, so the numbers line up down the
 * column and can be compared at a glance, each with its reading in WORDS.
 * A colour is never the only signal.
 */
function Psychometrics({ stats }: { stats: BankItem["stats"] }) {
  if (stats.exposures < MIN_EXPOSURES) {
    // The rule is stated once, above the table. The dash and the exposure
    // count beside it are the evidence; repeating the sentence per row was the
    // single biggest contributor to row height in the card list this replaced.
    return (
      <>
        <td role="cell" className="c-p num-col text-xs text-ink-muted" data-label="p">—</td>
        <td role="cell" className="c-disc text-xs text-ink-muted" data-label="Discrimination">—</td>
      </>
    );
  }

  const p = readPValue(stats.pValue);
  const d = readDiscrimination(stats.discrimination);

  return (
    <>
      <td role="cell" className="c-p num-col" data-label="p">
        <span className={cn("num text-xs", p?.tone === "warn" ? "text-warning" : "text-ink")}>
          {stats.pValue?.toFixed(2) ?? "—"}
        </span>
        {p ? <span className="block text-xs text-ink-muted">{p.words}</span> : null}
      </td>
      <td role="cell" className="c-disc" data-label="Discrimination">
        <span
          className={cn(
            "num text-xs",
            d?.tone === "bad" ? "text-danger" : d?.tone === "warn" ? "text-warning" : "text-ink",
          )}
        >
          {stats.discrimination?.toFixed(2) ?? "—"}
        </span>
        {d?.words ? (
          <span className={cn("block text-xs", d.tone === "bad" ? "text-danger" : "text-ink-muted")}>
            {d.words}
          </span>
        ) : null}
      </td>
    </>
  );
}

/**
 * The table's shape before the table: the same seven columns, the same row
 * height, so nothing moves when the rows land. Shown only after ~400ms -- a
 * flash of skeleton on a fast load is worse than a still frame.
 */
export function BankSkeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton="" data-cols={BANK_COLUMNS} aria-busy="true" className="bank">
      <p role="status" className="border-b border-line px-3 py-2 text-xs text-ink-muted">
        {slow
          ? "Still loading. The server sleeps when nobody has used it for a while, and waking it can take up to a minute."
          : "Loading the item bank…"}
      </p>
      <div aria-hidden="true">
        {Array.from({ length: 8 }, (_, r) => (
          <div
            key={r}
            className="skeleton-row border-b border-line last:border-0"
          >
            <span className="grid gap-1.5">
              <span className="skeleton-bar w-4/5" />
              <span className="skeleton-bar w-3/5" />
            </span>
            <span className="grid gap-1.5">
              <span className="skeleton-bar" />
              <span className="skeleton-bar w-2/3" />
            </span>
            <span className="skeleton-bar w-3/4" />
            <span className="skeleton-bar ml-auto w-1/3" />
            <span className="skeleton-bar ml-auto w-1/3" />
            <span className="skeleton-bar w-1/2" />
            <span className="skeleton-bar h-7" />
          </div>
        ))}
      </div>
    </div>
  );
}
