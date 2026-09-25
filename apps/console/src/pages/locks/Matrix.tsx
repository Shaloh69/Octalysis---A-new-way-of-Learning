import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Lock, LockOpen } from "lucide-react";
import type { LockCell, LockMatrix, ScopeLock } from "@/lib/api";
import { cn } from "@/lib/utils";
import { cellKey, cellKind, cellLine, scopeLine, type CellKind } from "@/lib/locks-view";

/**
 * The whole matrix, at 62rem of available width and up. `SPEC.md` §"At 1440".
 *
 * Hard rule 4: `data-resolved` and the fill come from `cell.unlocked`, which
 * the API reads from `is_stage_unlocked()`. Nothing here decides it.
 */

export interface CellHandlers {
  /** Plain click or Enter: open the reason dialog for this one cell. */
  open: (c: LockCell) => void;
  /** Shift-click or Shift+Enter: extend the bulk selection to this cell. */
  extend: (row: number, col: number) => void;
}

export function CellMark({ kind }: { kind: CellKind }) {
  if (kind === "person-open") return <LockOpen className="lock-mark h-3.5 w-3.5" aria-hidden="true" />;
  if (kind === "person-closed") return <Lock className="lock-mark h-3.5 w-3.5" aria-hidden="true" />;
  return <span aria-hidden="true">{kind === "auto-open" ? "○" : "·"}</span>;
}

export function cellName(c: LockCell, who: string, stage: { id: string; title: string }, selected: boolean) {
  return `${who}, stage ${stage.id} ${stage.title}: ${cellLine(c)}${selected ? " Selected." : ""}`;
}

export function Matrix({
  data, cells, selected, scopeByStage, on,
}: {
  data: LockMatrix;
  cells: Map<string, LockCell>;
  selected: Set<string>;
  scopeByStage: Map<string, ScopeLock[]>;
  on: CellHandlers & { selectColumn: (stageId: string) => void };
}) {
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);
  const shown = hovered ?? active;

  function move(e: KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    const d =
      e.key === "ArrowRight" ? [0, 1] : e.key === "ArrowLeft" ? [0, -1]
        : e.key === "ArrowDown" ? [1, 0] : e.key === "ArrowUp" ? [-1, 0] : null;
    if (d) {
      e.preventDefault();
      const r = Math.max(0, Math.min(data.students.length - 1, row + d[0]!));
      const c = Math.max(0, Math.min(data.stages.length - 1, col + d[1]!));
      document.querySelector<HTMLButtonElement>(`button[data-lock][data-pos="${r}:${c}"]`)?.focus();
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.shiftKey) {
      e.preventDefault();
      on.extend(row, col);
    }
  }

  const openCount = (stageId: string) =>
    data.students.reduce((n, s) => n + (cells.get(cellKey(s.userId, stageId))?.unlocked ? 1 : 0), 0);

  return (
    <>
      <table className="lock-matrix" onMouseLeave={() => setHovered(null)}>
        <caption className="sr-only">
          Lock state for every student and stage. A cell opens a dialog to change it; Shift with a
          cell selects several; a column head selects that stage for every student.
        </caption>
        <colgroup>
          <col className="c-name" />
          {data.stages.map((s) => <col key={s.id} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="c-name-head">Student</th>
            {data.stages.map((s) => {
              const scoped = scopeByStage.get(s.id) ?? [];
              const global = scoped.find((l) => l.scope === "global");
              const descId = `stage-head-${s.id}`;
              return (
                <th key={s.id} scope="col">
                  <button
                    type="button"
                    className="lock-head"
                    title={s.title}
                    onClick={() => on.selectColumn(s.id)}
                    aria-label={`Select stage ${s.id} for every student. ${s.title}. Open for ${openCount(s.id)} of ${data.students.length}.`}
                    aria-describedby={scoped.length ? descId : undefined}
                    data-scope-lock={global ? "global" : scoped.length ? "section" : undefined}
                  >
                    <span className="num lock-head-id">
                      {s.id}
                      {scoped.length ? <Lock className="h-3 w-3" aria-hidden="true" /> : null}
                    </span>
                    <span className="num lock-head-count">
                      {openCount(s.id)}
                    </span>
                  </button>
                  {scoped.length ? (
                    <span id={descId} className="sr-only">
                      {scoped.map(scopeLine).join(" ")}
                    </span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.students.map((st, row) => (
            <tr key={st.userId}>
              <th scope="row" className="c-name">
                <Link to={`/students/${st.userId}`} className="lock-student">
                  {st.fullName}
                </Link>
                <span className="num block text-xs text-ink-muted">{st.studentId}</span>
              </th>
              {data.stages.map((s, col) => {
                const c = cells.get(cellKey(st.userId, s.id));
                if (!c) return <td key={s.id} />;
                const kind = cellKind(c);
                const isSel = selected.has(cellKey(st.userId, s.id));
                return (
                  <td key={s.id}>
                    <button
                      type="button"
                      className="lock-cell"
                      data-lock={kind}
                data-look={kind}
                      data-resolved={c.unlocked ? "open" : "closed"}
                      data-user={st.userId}
                      data-stage={s.id}
                      data-pos={`${row}:${col}`}
                      data-selected={isSel ? "" : undefined}
                      aria-label={cellName(c, st.fullName, s, isSel)}
                      onClick={(e) => (e.shiftKey ? on.extend(row, col) : on.open(c))}
                      onKeyDown={(e) => move(e, row, col)}
                      onFocus={() => setActive({ row, col })}
                      onMouseEnter={() => setHovered({ row, col })}
                    >
                      <CellMark kind={kind} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <Readout data={data} cells={cells} at={shown} scopeByStage={scopeByStage} />
    </>
  );
}

/**
 * Who, when and why, for the cell under the pointer OR with focus.
 *
 * `PAGE-SPECS.md` planned "hover shows who overrode it". Hover-only fails a
 * keyboard user and fails 380 entirely, so this strip follows focus as well,
 * and the same words are in every cell's accessible name and in the dialog.
 * Not a live region: announcing every cell the pointer crosses would be noise.
 */
function Readout({
  data, cells, at, scopeByStage,
}: {
  data: LockMatrix;
  cells: Map<string, LockCell>;
  at: { row: number; col: number } | null;
  scopeByStage: Map<string, ScopeLock[]>;
}) {
  const st = at ? data.students[at.row] : undefined;
  const sg = at ? data.stages[at.col] : undefined;
  const c = st && sg ? cells.get(cellKey(st.userId, sg.id)) : undefined;
  const scoped = sg ? (scopeByStage.get(sg.id) ?? []) : [];

  return (
    <div data-readout="" className="lock-readout">
      {st && sg && c ? (
        <>
          <p className="text-sm text-ink">
            <span className="font-medium">{st.fullName}</span>{" "}
            <span className="num text-xs text-ink-muted">{st.studentId}</span>
            <span className="text-ink-muted"> · </span>
            Stage <span className="num">{sg.id}</span> {sg.title}
          </p>
          <p className={cn("text-sm", c.override ? "text-ink" : "text-ink-muted")}>{cellLine(c)}</p>
          {scoped.map((l) => (
            <p key={l.id} className="text-xs text-ink-muted">Also on this stage: {scopeLine(l)}</p>
          ))}
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Point at or focus a cell to see who decided it, when, and why. Arrow keys move between
          cells. Shift with a click or Enter selects several.
        </p>
      )}
    </div>
  );
}
