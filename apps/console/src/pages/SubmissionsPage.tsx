import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { api, type Submission } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import {
  KIND_WORD, counts, deliverables, isWaiting, matches, matchesScope, nextToMark,
  type Filter, type StatusFilter,
} from "@/lib/submissions-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueueList, QueueSkeleton, QueueTable } from "./submissions/Queue";
import { Pane } from "./submissions/Pane";
import { ReturnDialog } from "./submissions/ReturnDialog";

/**
 * `/submissions`: labs, the project and participation, 40% of the final grade.
 * Rebuilt 27 Sep 2026 against `design/templates/console/submissions/SPEC.md`
 * (shadcn-admin's Inbox: the queue beside a reading pane); gated by
 * `design/specs/console-submissions.spec.ts`.
 *
 * It owns two writes, both audited by the API: a mark, and a return. A GRADED
 * submission is frozen: the API answers 409 to a mark on one, and the only way
 * to change it is a return with a reason, whose audit row keeps the mark and
 * feedback it replaces. A draft is listed and never read: the API withholds
 * its body.
 */

/** Below this much AVAILABLE width the queue and the pane do not both fit. */
const WIDE_PX = 992; // 62rem

const STATUS_BUTTONS: Array<[StatusFilter, string, keyof ReturnType<typeof counts>]> = [
  ["submitted", "To mark", "submitted"],
  ["returned", "Returned", "returned"],
  ["graded", "Graded", "graded"],
  ["draft", "Drafts", "draft"],
  ["all", "All", "all"],
];

export function SubmissionsPage() {
  const list = useAsync(() => api.submissions(), []);
  const all = useMemo(() => list.data?.submissions ?? [], [list.data]);
  const firstLoad = list.loading && !list.data;
  const showSkeleton = useDelayed(firstLoad, 400);
  const slow = useDelayed(firstLoad, 3000);

  const box = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [filter, setFilter] = useState<Filter>({ status: "submitted", deliverable: null, q: "" });
  const scoped = all.filter((s) => matchesScope(s, filter));
  const rows = all.filter((s) => matches(s, filter));
  const c = counts(all);
  const cScoped = counts(scoped);
  const groups = deliverables(all);

  /* The open submission lives in the address, so Back and a reload keep it. */
  const [params, setParams] = useSearchParams();
  const openId = params.get("open");
  const open = all.find((s) => s.id === openId) ?? null;

  const heading = useRef<HTMLHeadingElement>(null);
  const focusPane = useRef(false);
  /** The row to send focus back to when the pane closes at 380. */
  const cameFrom = useRef<string | null>(null);

  function setOpen(id: string | null, focus: boolean) {
    focusPane.current = focus && id !== null;
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (id) next.set("open", id);
        else next.delete("open");
        return next;
      },
      { replace: wide },
    );
  }

  useEffect(() => {
    if (focusPane.current && open) {
      focusPane.current = false;
      heading.current?.focus();
    }
  }, [open?.id, open]);

  useEffect(() => {
    if (open || !cameFrom.current || wide) return;
    const el = document.querySelector<HTMLElement>(`[data-submission="${cameFrom.current}"] [data-open]`);
    cameFrom.current = null;
    el?.focus();
  }, [open, wide]);

  const opener = useRef<HTMLElement | null>(null);
  const [returning, setReturning] = useState<Submission | null>(null);

  function onGraded(s: Submission) {
    // Save and advance: the next to mark in the view the teacher is looking at.
    const next = nextToMark(rows, s.id);
    setOpen(next, true);
    list.reload();
  }

  const oldest = rows.find(isWaiting) ?? null;
  const deliverableLabel = !filter.deliverable
    ? "every deliverable"
    : filter.deliverable.startsWith("kind:")
      ? KIND_WORD[filter.deliverable.slice(5) as Submission["kind"]]
      : filter.deliverable;

  const queueVisible = wide || !open;

  return (
    <div ref={box} className="subs">
      <header className="mb-4">
        <h1 className="font-display text-2xl text-ink">Submissions</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Labs, the project and participation: <strong className="text-ink">40% of the final grade</strong>.
        </p>
        {list.data ? (
          <p className="mt-1 text-xs text-ink-muted" data-counts="">
            <span className="num text-ink">{c.all}</span> submissions · <span className="num text-ink">{c.submitted}</span> to
            mark · <span className="num text-ink">{c.graded}</span> graded · <span className="num text-ink">{c.returned}</span>{" "}
            returned · <span className="num text-ink">{c.draft}</span> drafts
          </p>
        ) : null}
      </header>

      {list.error && !list.data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The submissions could not be loaded. <span className="text-ink-muted">{list.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={list.reload}>
            Try again
          </Button>
        </div>
      ) : firstLoad || !list.data ? (
        showSkeleton ? <QueueSkeleton wide={wide} slow={slow} /> : <div className="min-h-[32rem]" aria-busy="true" />
      ) : all.length === 0 ? (
        <Empty
          title="Nothing handed in yet"
          hint="Labs, the project and participation appear here as students hand them in."
        />
      ) : (
        <>
          {queueVisible ? (
            <div className="subs-toolbar">
              <div className="subs-search">
                <Search className="h-4 w-4" aria-hidden="true" />
                <Input
                  className="pl-6"
                  aria-label="Search by name or student ID"
                  placeholder="Name or student ID"
                  value={filter.q}
                  onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
                />
              </div>
              <div className="subs-filters" role="group" aria-label="Show">
                {STATUS_BUTTONS.map(([st, word, key]) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={filter.status === st ? "default" : "outline"}
                    aria-pressed={filter.status === st}
                    className="subs-filter"
                    onClick={() => setFilter((f) => ({ ...f, status: st }))}
                  >
                    {word}{" "}
                    <span className="num">{cScoped[key]}</span>
                  </Button>
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Deliverable:{" "}
                    <span className={filter.deliverable && !filter.deliverable.startsWith("kind:") ? "num" : undefined}>
                      {deliverableLabel}
                    </span>
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
                  <DropdownMenuItem onSelect={() => setFilter((f) => ({ ...f, deliverable: null }))}>
                    <Tick on={!filter.deliverable} /> Every deliverable <span className="num ml-auto">{all.length}</span>
                  </DropdownMenuItem>
                  {groups.map((g) => (
                    <div key={g.kind}>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setFilter((f) => ({ ...f, deliverable: `kind:${g.kind}` }))}>
                        <Tick on={filter.deliverable === `kind:${g.kind}`} />
                        <span className="font-medium">{KIND_WORD[g.kind]}</span>
                        <span className="num ml-auto">{g.n}</span>
                      </DropdownMenuItem>
                      {g.slugs.map((d) => (
                        <DropdownMenuItem key={d.slug} onSelect={() => setFilter((f) => ({ ...f, deliverable: d.slug }))}>
                          <Tick on={filter.deliverable === d.slug} />
                          <span className="num">{d.slug}</span>
                          <span className="num ml-auto">{d.n}</span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {list.error ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-danger bg-danger-bg px-3 py-2">
              <p className="min-w-0 flex-1 text-xs text-ink">Refreshing failed: {list.error}</p>
              <Button size="sm" variant="outline" onClick={list.reload}>
                Try again
              </Button>
            </div>
          ) : null}

          <div className="subs-split" data-wide={wide ? "" : undefined}>
            {queueVisible ? (
              <section className="subs-card" aria-label="The queue">
                {rows.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-ink-muted">Nothing here with these filters.</p>
                ) : wide ? (
                  <QueueTable rows={rows} openId={openId} onOpen={(s) => setOpen(s.id, true)} />
                ) : (
                  <QueueList
                    rows={rows}
                    openId={openId}
                    onOpen={(s) => {
                      cameFrom.current = s.id;
                      setOpen(s.id, true);
                    }}
                  />
                )}
              </section>
            ) : null}

            {open ? (
              <div className="subs-card subs-pane-box">
                <Pane
                  ref={heading}
                  s={open}
                  onBack={wide ? null : () => setOpen(null, false)}
                  onGraded={onGraded}
                  onReturn={(s, from) => {
                    opener.current = from;
                    setReturning(s);
                  }}
                />
              </div>
            ) : wide ? (
              <div className="subs-card subs-pane-box">
                <div className="subs-empty" data-pane-empty="">
                  {oldest ? (
                    <>
                      <p>
                        <span className="num text-ink">{rows.filter(isWaiting).length}</span> waiting to be marked in
                        this view. Choose one from the queue, or start with the oldest.
                      </p>
                      <Button onClick={() => setOpen(oldest.id, true)}>Open the oldest waiting</Button>
                    </>
                  ) : (
                    <p>Nothing is waiting to be marked in this view. Choose any submission to read it.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      <ReturnDialog
        submission={returning}
        onClose={() => setReturning(null)}
        onDone={list.reload}
        returnFocus={() => opener.current}
      />
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return <Check className={on ? "h-3 w-3" : "h-3 w-3 opacity-0"} aria-hidden="true" />;
}
