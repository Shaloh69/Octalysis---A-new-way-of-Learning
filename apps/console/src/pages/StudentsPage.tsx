import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, Upload } from "lucide-react";
import { api, type RosterRow } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { rosterCounts, rosterMatches, rosterState, type RosterState } from "@/lib/roster-view";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { RosterTable } from "./students/RosterTable";
import { RosterList } from "./students/RosterList";
import { ImportDialog } from "./students/ImportDialog";
import { StatusDialog } from "./students/StatusDialog";
import { MoveDialog } from "./students/MoveDialog";
import type { RowActions } from "./students/RowMenu";

/**
 * `/students`: the roster. Rebuilt 25 Sep 2026 against
 * `design/templates/console/students/SPEC.md`; gated by
 * `design/specs/console-students.spec.ts`.
 *
 * The roster is what stops anyone with the URL from creating an account:
 * a student registers by claiming their own row. So this page answers who is
 * on it, who has registered, and who can sign in, and it owns the three writes
 * that change those answers: import (dry run first, every row's outcome in
 * words), deactivate (one student, a reason, the ID typed back) and the section
 * move (a reason; locks and assessment windows follow the student).
 *
 * Every write is audited by the API, with an actor and a reason.
 */

/** Below this much AVAILABLE width eight columns do not fit: a list instead. */
const WIDE_PX = 896; // 56rem

type StateFilter = RosterState | "all";
const FILTERS: Array<[StateFilter, string]> = [
  ["all", "All"],
  ["registered", "Registered"],
  ["not-registered", "Not registered"],
  ["deactivated", "Deactivated"],
];

export function StudentsPage() {
  const roster = useAsync(() => api.roster(), []);
  const data = roster.data;
  const firstLoad = roster.loading && !data;
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

  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [importOpen, setImportOpen] = useState(false);
  const [statusFor, setStatusFor] = useState<RosterRow | null>(null);
  const [moving, setMoving] = useState<RosterRow[] | null>(null);
  /** What opened the dialog, so focus goes back there (NEXT-SESSION §0c.4). */
  const opener = useRef<HTMLElement | null>(null);
  const remember = (el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  };
  const dialogOpen = importOpen || statusFor !== null || moving !== null;

  const students = useMemo(() => data?.students ?? [], [data]);
  const sections = data?.sections ?? [];
  const counts = rosterCounts(students);
  const shown = useMemo(
    () =>
      students.filter(
        (r) =>
          (stateFilter === "all" || rosterState(r) === stateFilter) &&
          (sectionFilter === "all" || r.sectionId === sectionFilter) &&
          rosterMatches(r, query),
      ),
    [students, stateFilter, sectionFilter, query],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  // Escape clears a selection -- unless a dialog or menu is open, which owns Escape.
  useEffect(() => {
    if (selected.size === 0 || dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=menu]")) clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, dialogOpen, clear]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const all = shown.length > 0 && shown.every((r) => prev.has(r.studentId));
      const next = new Set(prev);
      for (const r of shown) {
        if (all) next.delete(r.studentId);
        else next.add(r.studentId);
      }
      return next;
    });
  }

  const on: RowActions = {
    move: (s, from) => {
      remember(from);
      setMoving([s]);
    },
    status: (s, from) => {
      remember(from);
      setStatusFor(s);
    },
  };

  const picked = students.filter((s) => selected.has(s.studentId));

  return (
    <div ref={box} className="roster">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink">Students</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Who is on the roster, who has registered, and who can sign in. A student registers by
            claiming their own row with their student ID; nothing is ever sent to them.
          </p>
          {data ? (
            <p className="mt-1 text-xs text-ink-muted" data-roster-counts="">
              <span className="num text-ink">{counts.all}</span> on the roster ·{" "}
              <span className="num text-ink">{counts.registered}</span> registered ·{" "}
              <span className="num text-ink">{counts["not-registered"]}</span> not registered ·{" "}
              <span className="num text-ink">{counts.deactivated}</span> deactivated
            </p>
          ) : null}
        </div>
        <Button
          onClick={() => {
            remember();
            setImportOpen(true);
          }}
          disabled={!data}
        >
          <Upload className="h-4 w-4" aria-hidden="true" /> Import roster
        </Button>
      </header>

      {roster.error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The roster could not be loaded. <span className="text-ink-muted">{roster.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={roster.reload}>
            Try again
          </Button>
        </div>
      ) : firstLoad || !data ? (
        showSkeleton ? <RosterSkeleton wide={wide} slow={slow} /> : <div className="min-h-[32rem]" aria-busy="true" />
      ) : students.length === 0 ? (
        <Empty
          title="The roster is empty"
          hint="Students cannot register until their ID is on the roster. That is what stops anyone with the URL from creating an account. Import one to begin."
          action={
            <Button
              onClick={() => {
                remember();
                setImportOpen(true);
              }}
            >
              Import roster
            </Button>
          }
        />
      ) : (
        <>
          <div className="roster-toolbar">
            <div className="roster-search">
              <Search className="roster-search-icon h-4 w-4" aria-hidden="true" />
              <Input
                aria-label="Search the roster"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, ID or section"
                className="roster-search-input"
              />
            </div>
            <div className="roster-filters" role="group" aria-label="Registration">
              {FILTERS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="roster-filter"
                  aria-pressed={stateFilter === id}
                  onClick={() => setStateFilter(id)}
                >
                  {label} <span className="num">{counts[id]}</span>
                </button>
              ))}
            </div>
            {sections.length > 1 ? (
              <label className="roster-section-filter">
                <span className="text-xs text-ink-muted">Section</span>
                <select
                  className="roster-select"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                >
                  <option value="all">Every section</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {roster.error ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-danger bg-danger-bg px-3 py-2">
              <p className="min-w-0 flex-1 text-xs text-ink">Refreshing failed: {roster.error}</p>
              <Button size="sm" variant="outline" onClick={roster.reload}>
                Try again
              </Button>
            </div>
          ) : null}

          <section className="roster-card" aria-label="Roster">
            {selected.size > 0 ? (
              <div role="region" aria-label="Bulk change" className="bulk-bar roster-bulk">
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="num">{selected.size}</span> selected
                  {picked.length !== shown.filter((r) => selected.has(r.studentId)).length ? (
                    <span className="text-ink-muted"> (some are hidden by the filter)</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      remember();
                      setMoving(picked);
                    }}
                  >
                    Move to section…
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clear}>
                    Clear selection
                  </Button>
                </div>
              </div>
            ) : null}

            {shown.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted">
                {query.trim() ? <>No student matches &ldquo;{query.trim()}&rdquo;</> : "No student is in this view"}
                {stateFilter !== "all" || sectionFilter !== "all" ? " with the filters set." : "."}
              </p>
            ) : wide ? (
              <RosterTable rows={shown} selected={selected} toggle={toggle} toggleAll={toggleAll} on={on} />
            ) : (
              <RosterList rows={shown} selected={selected} toggle={toggle} toggleAll={toggleAll} on={on} />
            )}
          </section>
        </>
      )}

      <ImportDialog
        open={importOpen}
        sections={sections}
        onClose={() => setImportOpen(false)}
        onDone={roster.reload}
        returnFocus={() => opener.current}
      />
      <StatusDialog
        student={statusFor}
        onClose={() => setStatusFor(null)}
        onDone={roster.reload}
        returnFocus={() => opener.current}
      />
      <MoveDialog
        students={moving}
        sections={sections}
        onClose={() => setMoving(null)}
        onDone={() => {
          clear();
          roster.reload();
        }}
        returnFocus={() => opener.current}
      />
    </div>
  );
}

/** The table's shape, before the table: same row height, eight columns. */
function RosterSkeleton({ wide, slow }: { wide: boolean; slow: boolean }) {
  return (
    <div
      data-skeleton=""
      data-cols={wide ? 8 : 1}
      aria-busy="true"
      aria-label="Loading the roster"
      className="roster-card min-h-[32rem]"
    >
      {slow ? (
        <p role="status" className="px-4 pt-3 text-sm text-ink-muted">
          Still loading. If the API has been asleep it can take up to a minute to wake.
        </p>
      ) : null}
      <div className="p-3">
        {Array.from({ length: 10 }, (_, r) => (
          <div key={r} className={wide ? "roster-skel-row" : "roster-skel-row roster-skel-narrow"}>
            {wide
              ? Array.from({ length: 8 }, (_, c) => <span key={c} className="skeleton-bar" />)
              : <span className="skeleton-bar" />}
          </div>
        ))}
      </div>
    </div>
  );
}

