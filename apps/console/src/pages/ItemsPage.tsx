import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FileUp, Flag, ListChecks, Search,
} from "lucide-react";
import { api, type BankItem } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import {
  MIN_EXPOSURES, NO_FILTER, STATUSES, TYPE_LABEL, exportFileName, filterItems,
  firstAwaitingReview, isFiltered, nextAfter, objectiveOptions, paginate, sortForReview,
  statusCounts, type ItemsFilter,
} from "@/lib/items-view";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { BankSkeleton, BankTable } from "./items/BankTable";
import { ReviewDialog } from "./items/ReviewDialog";
import { ImportDialog } from "./items/ImportDialog";

/**
 * `/items` — the item bank and its review queue. REBUILT 25 Sep 2026 against
 * `design/templates/console/items/template.png`; `SPEC.md` beside it records
 * what was taken from the template and what was not.
 *
 * `PHASES.md` calls the bank the real project: the code is finite, the bank is
 * continuous. This page is where "approve every one by hand before it goes
 * live" becomes something a person can actually do -- 96 act-1 items stand
 * between the Prelim and a student, and every one of them is approved here.
 *
 * WHAT THE NUMBERS MEAN, because a psychometric without its reading is just a
 * number a teacher will ignore:
 *
 *   p-value        the proportion who got it right: DIFFICULTY, and HIGH means
 *                  EASY. Below ~0.25 on a 4-option item is at guessing.
 *   discrimination point-biserial. Below ~0.15 the item does not separate
 *                  students who know the material from those who do not, and a
 *                  NEGATIVE value means the students who did best on the paper
 *                  did worst on this item -- almost always a wrong key.
 *
 * Both need 30 exposures before they mean anything, and the page says so once.
 *
 * The whole bank is fetched once and filtered here (`lib/items-view.ts`), so
 * every count is counted over the list the table shows, and the review queue
 * advances through exactly the order the reviewer is looking at.
 */

const PAGE_SIZES = [25, 50, 100] as const;

export function ItemsPage() {
  const bank = useAsync(() => api.items({ limit: 2000 }), []);
  const stagesQ = useAsync(() => api.stages(), []);

  const [filter, setFilter] = useState<ItemsFilter>(NO_FILTER);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<BankItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [moving, setMoving] = useState(false);
  const lastReviewed = useRef<string | null>(null);

  const firstLoad = bank.loading && !bank.data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  const all = useMemo(() => bank.data?.items ?? [], [bank.data]);
  const view = useMemo(() => sortForReview(filterItems(all, filter)), [all, filter]);
  const pg = paginate(view, page, size);
  const counts = statusCounts(all, filter);
  const objectives = useMemo(() => objectiveOptions(all, filter.stageId), [all, filter.stageId]);
  const flaggedCount = filterItems(all, filter, "flaggedOnly").filter((i) => i.stats.flagged).length;
  const stageCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of filterItems(all, filter, "stageId")) m.set(i.stageId, (m.get(i.stageId) ?? 0) + 1);
    return m;
  }, [all, filter]);
  const stageTitle = new Map(stagesQ.data?.nodes.map((n) => [n.id, n.title]) ?? []);
  const nextUp = firstAwaitingReview(view);

  /** Any filter change starts from page one, with nothing selected. */
  function update(patch: Partial<ItemsFilter>): void {
    setFilter((f) => {
      const next = { ...f, ...patch };
      // An objective from another stage would silently empty the table.
      if (patch.stageId !== undefined && next.objectiveId && !next.objectiveId.startsWith(`${next.stageId}.`)) {
        next.objectiveId = "";
      }
      return next;
    });
    setPage(1);
    setSelected(new Set());
  }

  function review(item: BankItem): void {
    lastReviewed.current = item.id;
    setReviewing(item);
  }

  /**
   * After a decision, the NEXT item in the list being looked at -- taken before
   * the reload, because afterwards the decided item may have left the filter
   * and every index moves.
   */
  function advanceFrom(item: BankItem): void {
    const next = nextAfter(view, item.id);
    if (next) review(next);
    else setReviewing(null);
    bank.reload();
  }

  /** Focus comes home to the row of the item last reviewed, if it is on screen. */
  function returnFocus(e: Event): void {
    const id = lastReviewed.current;
    const el = id ? document.querySelector<HTMLButtonElement>(`[data-review-id="${id}"]`) : null;
    if (el) {
      e.preventDefault();
      el.focus();
    }
  }

  async function exportView(): Promise<void> {
    setExporting(true);
    try {
      const file = await api.exportItems(view.map((i) => i.id));
      const name = exportFileName(new Date(), filter.stageId);
      const url = URL.createObjectURL(
        new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success(
        `Exported ${file.items.length} items`,
        `Saved as ${name}. It holds the answer keys: keep it where students cannot reach it.`,
      );
    } catch (e) {
      toast.error("Nothing was exported", e instanceof Error ? e.message : "Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function sendSelectedToReview(): Promise<void> {
    setMoving(true);
    try {
      const r = await api.bulkSendToReview([...selected]);
      const n = r.moved.length;
      toast.success(
        `${n} draft${n === 1 ? "" : "s"} sent to review`,
        r.skipped.length > 0
          ? `${r.skipped.length} skipped: ${r.skipped.map((s) => s.reason).join("; ")}`
          : "Each one is still approved on its own.",
      );
      setSelected(new Set());
      bank.reload();
    } catch (e) {
      toast.error("No drafts were moved", e instanceof Error ? e.message : "Try again.");
    } finally {
      setMoving(false);
    }
  }

  const summary = bank.data?.summary ?? {};
  const inBank = Object.values(summary).reduce((a, b) => a + b, 0);
  const queuePosition =
    reviewing && view.findIndex((x) => x.id === reviewing.id) >= 0
      ? { at: view.findIndex((x) => x.id === reviewing.id) + 1, of: view.length }
      : null;

  return (
    <div className="grid gap-4">
      {/* ---------------------------------------------------------- header */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink">Items</h1>
          <p className="text-sm text-ink-muted">
            {bank.data ? (
              <>
                <span className="num text-ink">{inBank}</span> in the bank ·{" "}
                <span className="num text-ink">{summary.live ?? 0}</span> live ·{" "}
                <span className="num text-ink">{summary.review ?? 0}</span> awaiting review ·{" "}
                <span className="num text-ink">{summary.draft ?? 0}</span> draft ·{" "}
                <span className="num text-ink">{summary.retired ?? 0}</span> retired
              </>
            ) : (
              "Every item is approved by hand before a student can draw it."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <FileUp className="h-4 w-4" aria-hidden="true" /> Import JSON
          </Button>
          <Button
            variant="outline"
            disabled={exporting || view.length === 0}
            onClick={() => void exportView()}
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export {view.length} as JSON
          </Button>
          <Button disabled={nextUp === null} onClick={() => nextUp && review(nextUp)}>
            <ListChecks className="h-4 w-4" aria-hidden="true" /> Review next
          </Button>
        </div>
      </header>

      {/* --------------------------------------------------------- toolbar */}
      <div className="grid gap-2 lg:flex lg:flex-wrap lg:items-center">
        <div className="relative lg:w-72">
          <label htmlFor="items-query" className="sr-only">
            Filter items
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <Input
            id="items-query"
            type="search"
            className="h-control-sm pl-6 text-xs"
            placeholder="Filter by slug, stem or objective"
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            id="items-status"
            label="Status"
            value={filter.status}
            onChange={(v) => update({ status: v as ItemsFilter["status"] })}
          >
            <option value="">All statuses ({Object.values(counts).reduce((a, b) => a + b, 0)})</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "review" ? "Awaiting review" : s[0]!.toUpperCase() + s.slice(1)} ({counts[s]})
              </option>
            ))}
          </FilterSelect>

          <FilterSelect id="items-stage" label="Stage" value={filter.stageId} onChange={(v) => update({ stageId: v })}>
            <option value="">Every stage</option>
            {[...stageCounts.keys()].sort().map((id) => (
              <option key={id} value={id}>
                {id}
                {stageTitle.get(id) ? ` · ${stageTitle.get(id)}` : ""} ({stageCounts.get(id)})
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="items-type"
            label="Type"
            value={filter.type}
            onChange={(v) => update({ type: v as ItemsFilter["type"] })}
          >
            <option value="">Every type</option>
            {(["S", "P", "G"] as const).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t][0]!.toUpperCase() + TYPE_LABEL[t].slice(1)}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="items-objective"
            label="Objective"
            value={filter.objectiveId}
            onChange={(v) => update({ objectiveId: v })}
          >
            <option value="">Every objective</option>
            {objectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id}
                {o.text ? ` · ${o.text}` : ""}
              </option>
            ))}
          </FilterSelect>

          <Button
            size="sm"
            variant={filter.flaggedOnly ? "default" : "outline"}
            aria-pressed={filter.flaggedOnly}
            onClick={() => update({ flaggedOnly: !filter.flaggedOnly })}
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Flagged <span className="num">({flaggedCount})</span>
          </Button>

          {isFiltered(filter) ? (
            <Button size="sm" variant="ghost" onClick={() => update(NO_FILTER)}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {/* -------------------------------------------------------- bulk bar */}
      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk review"
          className="bulk-bar flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-accent-muted px-3 py-2"
        >
          <p className="min-w-0 flex-1 text-sm text-ink">
            <span className="num">{selected.size}</span> draft{selected.size === 1 ? "" : "s"} selected.
            Sending them to review puts them in the queue; each is still approved on its own.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
          <Button size="sm" disabled={moving} onClick={() => void sendSelectedToReview()}>
            Send {selected.size} to review
          </Button>
        </div>
      ) : null}

      {/* --------------------------------------------------------- content */}
      {bank.error && !bank.data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The item bank could not be loaded. <span className="text-ink-muted">{bank.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={bank.reload}>
            Try again
          </Button>
        </div>
      ) : firstLoad ? (
        // Space reserved either way, so nothing moves when the rows land.
        showSkeleton ? <BankSkeleton slow={slow} /> : <div className="min-h-[28rem]" aria-busy="true" />
      ) : view.length === 0 ? (
        <Empty
          title={inBank === 0 ? "The bank is empty" : "No items match"}
          hint={
            inBank === 0
              ? "Import a file, or run sync-items. Target: roughly 40 live items per gradeable chapter."
              : "Nothing in the bank matches every filter at once."
          }
          action={
            inBank > 0 ? (
              <Button size="sm" variant="outline" onClick={() => update(NO_FILTER)}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="bank">
          {bank.error ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-danger bg-danger-bg px-3 py-2">
              <p className="min-w-0 flex-1 text-xs text-ink">Refreshing failed: {bank.error}</p>
              <Button size="sm" variant="outline" onClick={bank.reload}>
                Try again
              </Button>
            </div>
          ) : null}
          {/* The 30-exposure rule, ONCE. Per row it was 22 copies of one sentence. */}
          <p className="border-b border-line px-3 py-2 text-xs text-ink-muted">
            p-value and discrimination stay blank until an item has been seen{" "}
            <span className="num">{MIN_EXPOSURES}</span> times; below that the numbers do not mean
            anything yet.
          </p>
          <BankTable
            rows={pg.rows}
            viewKey={`${JSON.stringify(filter)}:${pg.page}:${size}`}
            busy={bank.loading}
            selected={selected}
            onToggle={(id) =>
              setSelected((s) => {
                const n = new Set(s);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            onToggleAll={(ids, on) =>
              setSelected((s) => {
                const n = new Set(s);
                for (const id of ids) {
                  if (on) n.add(id);
                  else n.delete(id);
                }
                return n;
              })
            }
            onReview={review}
          />
        </div>
      )}

      {/* ------------------------------------------------------ pagination */}
      {view.length > 0 ? (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="items-page-size" className="text-xs text-ink-muted">
              Rows per page
            </label>
            <select
              id="items-page-size"
              className="h-control-sm rounded-md border border-line bg-surface-0 px-2 text-xs text-ink"
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <p data-total={pg.total} className="text-xs text-ink-muted">
            <span className="num text-ink">
              {pg.from}–{pg.to}
            </span>{" "}
            of <span className="num text-ink">{pg.total}</span> · page{" "}
            <span className="num text-ink">{pg.page}</span> of <span className="num text-ink">{pg.pages}</span>
          </p>
          <div className="flex items-center gap-1">
            <PageButton label="First page" disabled={pg.page <= 1} onClick={() => setPage(1)} icon={ChevronsLeft} />
            <PageButton label="Previous page" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)} icon={ChevronLeft} />
            <PageButton label="Next page" disabled={pg.page >= pg.pages} onClick={() => setPage(pg.page + 1)} icon={ChevronRight} />
            <PageButton label="Last page" disabled={pg.page >= pg.pages} onClick={() => setPage(pg.pages)} icon={ChevronsRight} />
          </div>
        </nav>
      ) : null}

      <ReviewDialog
        item={reviewing}
        position={queuePosition}
        onClose={() => setReviewing(null)}
        onDecided={advanceFrom}
        onCloseFocus={returnFocus}
      />
      <ImportDialog open={importing} onOpenChange={setImporting} onImported={bank.reload} />
    </div>
  );
}

/**
 * A native select with a label kept for screen readers. The first option names
 * the filter ("Every stage"), so the visible control says what it is.
 */
function FilterSelect({
  id, label, value, onChange, children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          "h-control-sm w-full rounded-md border bg-surface-0 px-2 text-xs text-ink sm:w-auto sm:max-w-[16rem]",
          value ? "border-accent" : "border-line",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function PageButton({
  label, disabled, onClick, icon: Icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: typeof ChevronLeft;
}) {
  return (
    <Button size="icon" variant="outline" className="h-control-sm w-8" aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
