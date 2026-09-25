import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Lock, LockOpen } from "lucide-react";
import { api, type LockCell, type ScopeLock } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { nextLockState } from "@/lib/csv";
import {
  bulkToast, cellKey, cellSentence, column, plural, rectangle, scopeLine, selectionSummary,
  singleToast, type LockTarget, type Pos,
} from "@/lib/locks-view";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { Matrix } from "./locks/Matrix";
import { StageList } from "./locks/StageList";
import { ScopeTab } from "./locks/ScopeTab";
import { ReasonDialog, type ReasonRequest } from "./locks/ReasonDialog";

/**
 * `/locks` — students × stages. Rebuilt 25 Sep 2026 against
 * `design/templates/console/locks/SPEC.md`; gated by
 * `design/specs/console-locks.spec.ts`.
 *
 * TWO RULES SHAPE THIS WHOLE PAGE.
 *
 * 1. **The console never computes a lock.** Every cell's open/closed is
 *    `unlocked` from the API, which reads `is_stage_unlocked()`, the same
 *    function the student app reads. Hard rule 4. If this page decided for
 *    itself, a teacher could be looking at an open cell while the student sees
 *    a closed one, and the teacher would be the one who is wrong.
 *
 * 2. **A reason is mandatory**, one cell or a hundred. The server rejects an
 *    override under 3 characters and INV-22 checks for it in the database.
 */

/** Below this much AVAILABLE width the 19 columns do not fit: one stage at a time. */
const WIDE_PX = 992; // 62rem: 14rem of names + 19 × 2.5rem of cells

type Tab = "matrix" | "scope";

export function LocksPage() {
  const matrix = useAsync(() => api.locks(), []);
  const data = matrix.data;
  const firstLoad = matrix.loading && !data;
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

  const [tab, setTab] = useState<Tab>("matrix");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [request, setRequestState] = useState<ReasonRequest | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  /** Open the reason prompt, remembering what had focus so it goes back there. */
  const setRequest = useCallback((r: ReasonRequest | null) => {
    if (r) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequestState(r);
  }, []);
  const [stageId, setStageId] = useState<string>("01");

  const cells = useMemo(() => {
    const m = new Map<string, LockCell>();
    for (const c of data?.cells ?? []) m.set(cellKey(c.userId, c.stageId), c);
    return m;
  }, [data]);

  const scopeByStage = useMemo(() => {
    const m = new Map<string, ScopeLock[]>();
    for (const l of data?.scopeLocks ?? []) m.set(l.stageId, [...(m.get(l.stageId) ?? []), l]);
    return m;
  }, [data]);

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  // Escape clears a bulk selection -- unless a dialog is open, which owns Escape.
  useEffect(() => {
    if (selected.size === 0 || request) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, request, clear]);

  /* ------------------------------------------------------------ actions */

  function openCell(c: LockCell) {
    if (!data) return;
    const st = data.students.find((s) => s.userId === c.userId)!;
    const sg = data.stages.find((s) => s.id === c.stageId)!;
    const current: LockTarget = c.override ?? "auto";
    const { state, decided } = cellSentence(c);
    const scoped = scopeByStage.get(c.stageId) ?? [];
    setRequest({
      title: `Change stage ${sg.id} for this student`,
      subject: `${st.fullName} · Stage ${sg.id} ${sg.title}`,
      now: (
        <>
          <p>
            <span className="font-medium">Now: {state.toLowerCase()}.</span>{" "}
            {c.override ? `${decided}.` : `Decided by the curriculum; no person has changed it.`}
          </p>
          {c.override && (c.override === "unlocked") !== c.unlocked ? (
            <p className="mt-1 text-xs text-ink-muted">
              The override opens it, but the database still says closed: its window has not
              started. The student sees closed.
            </p>
          ) : null}
          {scoped.map((l) => (
            <p key={l.id} className="mt-1 text-xs text-ink-muted">Also on this stage: {scopeLine(l)}</p>
          ))}
        </>
      ),
      choices: [
        { value: "unlocked", label: "Open early", disabled: current === "unlocked" },
        { value: "locked", label: "Close", disabled: current === "locked" },
        { value: "auto", label: "Return to automatic", disabled: current === "auto" },
      ],
      initial: nextLockState(c.override),
      note: (next) =>
        next === "auto"
          ? "The prerequisite rule takes over again: whether it is open then depends on the student's mastery, not on this setting."
          : null,
      save: async (next, reason) => {
        try {
          await api.setLock({ scope: "user", stageId: c.stageId, state: next, userId: c.userId, reason });
        } catch (e) {
          toast.error(
            `Stage ${c.stageId} was not changed for ${st.fullName}`,
            "The dialog is still open with your reason in it. Try again.",
          );
          throw e;
        }
        toast.success(singleToast(c.stageId, next, st.fullName));
        matrix.reload();
      },
    });
  }

  function extend(row: number, col: number) {
    if (!data) return;
    if (!anchor) {
      setAnchor({ row, col });
      setSelected(new Set(rectangle(data, { row, col }, { row, col })));
      return;
    }
    setSelected(new Set(rectangle(data, anchor, { row, col })));
  }

  function selectColumn(id: string) {
    if (!data) return;
    setSelected(new Set(column(data, id)));
    setAnchor({ row: 0, col: data.stages.findIndex((s) => s.id === id) });
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function bulk(target: LockTarget) {
    const keys = [...selected];
    const sum = selectionSummary(keys);
    const verb = target === "unlocked" ? "Open" : target === "locked" ? "Close" : "Return";
    setRequest({
      title:
        target === "auto"
          ? `Return ${plural(sum.cells, "cell")} to automatic`
          : `${verb} ${plural(sum.cells, "cell")}${target === "unlocked" ? " early" : ""}`,
      subject: `${plural(sum.students, "student")} × ${plural(sum.stages, "stage")}: ${sum.stageIds.join(", ")}`,
      now: "One reason covers every cell. Each one is written to the audit log on its own row, in one change: all of them land, or none do.",
      choices: [{ value: target, label: verb }],
      initial: target,
      save: async (next, reason) => {
        try {
          await api.setLocks({
            state: next,
            reason,
            cells: keys.map((k) => {
              const [userId, stage] = k.split("|") as [string, string];
              return { userId, stageId: stage };
            }),
          });
        } catch (e) {
          toast.error(`${plural(sum.cells, "cell")} not changed`, "Nothing was applied. Try again.");
          throw e;
        }
        toast.success(bulkToast(keys, next));
        clear();
        matrix.reload();
      },
    });
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next: Tab = tab === "matrix" ? "scope" : "matrix";
    setTab(next);
    document.getElementById(`locks-tab-${next}`)?.focus();
  }

  /* ------------------------------------------------------------- render */

  const overrides = data?.cells.filter((c) => c.override !== null).length ?? 0;

  return (
    <div ref={box} className="locks">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink">Locks</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Who can open which stage. Every cell is the database&apos;s answer, the same one the
            student sees. Every change asks why, and the answer goes to the audit log.
          </p>
        </div>
        {data ? (
          <p className="text-xs text-ink-muted">
            <span className="num text-ink">{data.students.length}</span> students ·{" "}
            <span className="num text-ink">{data.stages.length}</span> stages ·{" "}
            <span className="num text-ink">{overrides}</span> per-student{" "}
            {overrides === 1 ? "override" : "overrides"} ·{" "}
            <span className="num text-ink">{data.scopeLocks.length}</span> course-wide or section
          </p>
        ) : null}
      </header>

      {matrix.error && !data ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The lock matrix could not be loaded. <span className="text-ink-muted">{matrix.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={matrix.reload}>
            Try again
          </Button>
        </div>
      ) : firstLoad || !data ? (
        showSkeleton ? <MatrixSkeleton wide={wide} slow={slow} /> : <div className="min-h-[32rem]" aria-busy="true" />
      ) : data.students.length === 0 ? (
        <Empty
          title="No students have registered yet"
          hint="The matrix fills in as students claim their roster entry. Import a roster first, then students register with their student ID."
          action={
            <Button asChild variant="outline">
              <Link to="/students">Go to the roster</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div role="tablist" aria-label="Lock views" className="lock-tabs">
            {(
              [
                ["matrix", "Students × stages"],
                ["scope", `Sections & schedules (${data.scopeLocks.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                id={`locks-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`locks-panel-${id}`}
                className="lock-tab"
                onClick={() => setTab(id)}
                onKeyDown={onTabKey}
              >
                {label}
              </button>
            ))}
          </div>

          {matrix.error ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-danger bg-danger-bg px-3 py-2">
              <p className="min-w-0 flex-1 text-xs text-ink">Refreshing failed: {matrix.error}</p>
              <Button size="sm" variant="outline" onClick={matrix.reload}>
                Try again
              </Button>
            </div>
          ) : null}

          {tab === "matrix" ? (
            <section
              id="locks-panel-matrix"
              role="tabpanel"
              aria-labelledby="locks-tab-matrix"
              className="lock-card"
            >
              <header className="lock-card-head">
                <div className="min-w-0">
                  <h2 className="text-base">Lock matrix</h2>
                  <p className="text-xs text-ink-muted">
                    The fill is what the student sees. A padlock means a person decided it. The number under each stage counts the students it is open for.
                  </p>
                </div>
                <Legend />
              </header>

              {selected.size > 0 ? (
                <BulkBar
                  keys={selected}
                  onOpen={() => bulk("unlocked")}
                  onClose={() => bulk("locked")}
                  onAuto={() => bulk("auto")}
                  onClear={clear}
                />
              ) : null}

              {wide ? (
                <Matrix
                  data={data}
                  cells={cells}
                  selected={selected}
                  scopeByStage={scopeByStage}
                  on={{ open: openCell, extend, selectColumn }}
                />
              ) : (
                <StageList
                  data={data}
                  cells={cells}
                  stageId={stageId}
                  setStageId={setStageId}
                  selected={selected}
                  toggle={toggle}
                  selectColumn={selectColumn}
                  open={openCell}
                />
              )}
            </section>
          ) : (
            <section id="locks-panel-scope" role="tabpanel" aria-labelledby="locks-tab-scope">
              <ScopeTab data={data} reload={matrix.reload} ask={setRequest} />
            </section>
          )}
        </>
      )}

      <ReasonDialog request={request} onClose={() => setRequest(null)} returnFocus={() => opener.current} />
    </div>
  );
}

function Legend() {
  return (
    <ul className="lock-legend" aria-label="Legend">
      <li><span className="lock-swatch" data-look="auto-open" aria-hidden="true">○</span>Open, by the curriculum</li>
      <li><span className="lock-swatch" data-look="auto-closed" aria-hidden="true">·</span>Closed, by the curriculum</li>
      <li>
        <span className="lock-swatch" data-look="person-open" aria-hidden="true">
          <LockOpen className="lock-mark h-3.5 w-3.5" />
        </span>
        Opened by a person
      </li>
      <li>
        <span className="lock-swatch" data-look="person-closed" aria-hidden="true">
          <Lock className="lock-mark h-3.5 w-3.5" />
        </span>
        Closed by a person
      </li>
    </ul>
  );
}

function BulkBar({
  keys, onOpen, onClose, onAuto, onClear,
}: {
  keys: Set<string>;
  onOpen: () => void;
  onClose: () => void;
  onAuto: () => void;
  onClear: () => void;
}) {
  const s = selectionSummary(keys);
  return (
    <div role="region" aria-label="Bulk change" className="bulk-bar lock-bulk">
      <p className="min-w-0 flex-1 text-sm text-ink">
        <span className="num">{s.cells}</span> {s.cells === 1 ? "cell" : "cells"} selected{" "}
        <span className="text-ink-muted">
          ({plural(s.students, "student")} × {plural(s.stages, "stage")})
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onOpen}>Open early</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
        <Button size="sm" variant="outline" onClick={onAuto}>Return to automatic</Button>
        <Button size="sm" variant="ghost" onClick={onClear}>Clear selection</Button>
      </div>
    </div>
  );
}

/** The matrix's shape, before the matrix: same row height, 19 cells a row. */
function MatrixSkeleton({ wide, slow }: { wide: boolean; slow: boolean }) {
  return (
    <div
      data-skeleton=""
      data-cols={wide ? 19 : 1}
      aria-busy="true"
      aria-label="Loading the lock matrix"
      className="lock-card min-h-[32rem]"
    >
      <div className="lock-card-head">
        <span className="skeleton-bar w-40" />
      </div>
      {slow ? (
        <p role="status" className="px-4 pt-3 text-sm text-ink-muted">
          Still loading. If the API has been asleep it can take up to a minute to wake.
        </p>
      ) : null}
      <div className="p-3">
        {Array.from({ length: 10 }, (_, r) => (
          <div key={r} className={wide ? "lock-skel-row" : "lock-skel-row lock-skel-narrow"}>
            <span className="skeleton-bar" />
            {wide
              ? Array.from({ length: 19 }, (_, c) => <span key={c} className="skeleton-bar lock-skel-cell" />)
              : <span className="skeleton-bar lock-skel-cell" />}
          </div>
        ))}
      </div>
    </div>
  );
}
