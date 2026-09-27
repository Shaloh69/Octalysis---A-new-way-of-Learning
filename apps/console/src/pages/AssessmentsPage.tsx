import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Plus } from "lucide-react";
import { api, type Assessment } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { counts, unfillable, windowState } from "@/lib/assessments-view";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { AssessList, AssessTable } from "./assessments/Views";
import { CreateDialog } from "./assessments/CreateDialog";
import { BankDialog, RotateDialog, WindowDialog } from "./assessments/RowDialogs";
import type { RowActions } from "./assessments/Row";

/**
 * `/assessments`: what a student can open. Rebuilt 27 Sep 2026 against
 * `design/templates/console/assessments/SPEC.md`; gated by
 * `design/specs/console-assessment-window.spec.ts`.
 *
 * This is the route that made the engine reachable, and its job is to be
 * honest about Start before a student presses it: every row says whether the
 * live bank can fill its paper, and a banner counts the ones a student can
 * reach that cannot. It owns four writes, each audited by the API with an
 * actor and a reason where one is due: create (which mints the exam salt),
 * the window, and rotating the salt between terms.
 */

/** Below this much AVAILABLE width ten columns do not fit: a list instead. */
const WIDE_PX = 1024; // 64rem

export function AssessmentsPage() {
  const list = useAsync(() => api.assessments(), []);
  const data = list.data;
  const firstLoad = list.loading && !data;
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

  const [creating, setCreating] = useState(false);
  const [windowFor, setWindowFor] = useState<Assessment | null>(null);
  const [bankFor, setBankFor] = useState<Assessment | null>(null);
  const [rotateFor, setRotateFor] = useState<Assessment | null>(null);
  /** What opened the dialog, so focus goes back there (NEXT-SESSION §0c.4). */
  const opener = useRef<HTMLElement | null>(null);
  const remember = (el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  };

  const on: RowActions = {
    window: (a, from) => { remember(from); setWindowFor(a); },
    bank: (a, from) => { remember(from); setBankFor(a); },
    rotate: (a, from) => { remember(from); setRotateFor(a); },
  };

  const rows = data?.assessments ?? [];
  const c = counts(rows);
  const reachable = rows.filter((a) => windowState(a) !== "closed").length;
  const short = unfillable(rows).length;

  const startCreate = () => {
    remember();
    setCreating(true);
  };

  return (
    <div ref={box} className="assess">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink">Assessments</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            What a student can open. Each draws a paper per student from a blueprint and the
            student&apos;s own seed, from the live bank only.
          </p>
          {data ? (
            <p className="mt-1 text-xs text-ink-muted" data-counts="">
              <span className="num text-ink">{c.all}</span> assessments · <span className="num text-ink">{c.open}</span> open ·{" "}
              <span className="num text-ink">{c.scheduled}</span> scheduled · <span className="num text-ink">{c.closed}</span> closed
            </p>
          ) : null}
        </div>
        <Button onClick={startCreate} disabled={!data}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New assessment
        </Button>
      </header>

      {list.error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The assessments could not be loaded. <span className="text-ink-muted">{list.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={list.reload}>
            Try again
          </Button>
        </div>
      ) : firstLoad || !data ? (
        showSkeleton ? <AssessSkeleton wide={wide} slow={slow} /> : <div className="min-h-[32rem]" aria-busy="true" />
      ) : rows.length === 0 ? (
        <Empty
          title="No assessments yet"
          hint="Until one exists, a student has nothing to sit: the stage reader shows the material and no check. Create one from a blueprint."
          action={<Button onClick={startCreate}>Create the first one</Button>}
        />
      ) : (
        <>
          {short > 0 ? (
            <div className="assess-banner" data-bank-banner="">
              <AlertTriangle className="assess-banner-icon h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0 text-sm text-ink">
                <strong>
                  <span className="num">{short}</span> of <span className="num">{reachable}</span>
                </strong>{" "}
                assessments students can reach cannot be filled from the live bank. Pressing Start on one
                gives a student an error, not a paper. Items are approved on the{" "}
                <Link to="/items" className="assess-link">
                  Items
                </Link>{" "}
                page.
              </p>
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

          <section className="assess-card" aria-label="Assessments">
            {wide ? <AssessTable rows={rows} on={on} /> : <AssessList rows={rows} on={on} />}
          </section>
        </>
      )}

      {data ? (
        <CreateDialog
          open={creating}
          blueprints={data.blueprints}
          sections={data.sections ?? []}
          onClose={() => setCreating(false)}
          onCreated={list.reload}
          returnFocus={() => opener.current}
        />
      ) : null}
      <WindowDialog assessment={windowFor} onClose={() => setWindowFor(null)} onDone={list.reload} returnFocus={() => opener.current} />
      <RotateDialog assessment={rotateFor} onClose={() => setRotateFor(null)} onDone={list.reload} returnFocus={() => opener.current} />
      <BankDialog assessment={bankFor} onClose={() => setBankFor(null)} returnFocus={() => opener.current} />
    </div>
  );
}

/** The table's shape, before the table: same row height, ten columns. */
function AssessSkeleton({ wide, slow }: { wide: boolean; slow: boolean }) {
  return (
    <div data-skeleton="" aria-busy="true" aria-label="Loading the assessments" className="assess-card min-h-[32rem]">
      {slow ? (
        <p role="status" className="px-4 pt-3 text-sm text-ink-muted">
          Still loading. If the API has been asleep it can take up to a minute to wake.
        </p>
      ) : null}
      <div className="p-3">
        {Array.from({ length: 10 }, (_, r) => (
          <div key={r} className={wide ? "assess-skel-row" : "assess-skel-row assess-skel-narrow"}>
            {wide
              ? Array.from({ length: 10 }, (_, col) => <span key={col} className="skeleton-bar" />)
              : <span className="skeleton-bar" />}
          </div>
        ))}
      </div>
    </div>
  );
}
