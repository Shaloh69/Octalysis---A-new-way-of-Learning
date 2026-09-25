import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { LockCell, LockMatrix } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cellKey, cellKind, cellLine, scopeLine } from "@/lib/locks-view";
import { CellMark, cellName } from "./Matrix";

/**
 * Below 62rem of available width: one stage at a time. `SPEC.md` §"At 380".
 *
 * Nineteen columns do not fit in 348px, and a horizontal scroller is the
 * defect assertion 1 exists for. So the page pivots: pick a stage, and every
 * student is a row that says its state in words. There is no hover here, so
 * nothing on the row is hover-only; the words ARE the row.
 */
export function StageList({
  data, cells, stageId, setStageId, selected, toggle, selectColumn, open,
}: {
  data: LockMatrix;
  cells: Map<string, LockCell>;
  stageId: string;
  setStageId: (id: string) => void;
  selected: Set<string>;
  toggle: (key: string) => void;
  selectColumn: (stageId: string) => void;
  open: (c: LockCell) => void;
}) {
  const i = Math.max(0, data.stages.findIndex((s) => s.id === stageId));
  const stage = data.stages[i]!;
  const scoped = data.scopeLocks.filter((l) => l.stageId === stage.id);
  const openN = data.students.filter((s) => cells.get(cellKey(s.userId, stage.id))?.unlocked).length;

  return (
    <div className="lock-stage-view">
      <div className="flex items-end gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label="Previous stage"
          disabled={i === 0}
          onClick={() => setStageId(data.stages[i - 1]!.id)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <label htmlFor="lock-stage" className="mb-1 block text-xs font-medium text-ink-muted">
            Stage
          </label>
          <select
            id="lock-stage"
            className="h-control-md w-full rounded-md border border-line bg-surface-0 px-2 text-sm text-ink"
            value={stage.id}
            onChange={(e) => setStageId(e.target.value)}
          >
            {data.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.title}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="icon"
          variant="outline"
          aria-label="Next stage"
          disabled={i === data.stages.length - 1}
          onClick={() => setStageId(data.stages[i + 1]!.id)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <p className="mt-3 text-sm text-ink">
        Open for <span className="num">{openN}</span> of <span className="num">{data.students.length}</span>{" "}
        students.
      </p>
      {scoped.map((l) => (
        <p key={l.id} className="mt-1 text-xs text-ink-muted">
          {scopeLine(l)}
        </p>
      ))}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => selectColumn(stage.id)}>
          Select every student
        </Button>
      </div>

      <ul data-stage-view="" className="lock-rows">
        {data.students.map((st) => {
          const c = cells.get(cellKey(st.userId, stage.id));
          if (!c) return null;
          const key = cellKey(st.userId, stage.id);
          const isSel = selected.has(key);
          const kind = cellKind(c);
          return (
            <li key={st.userId} data-selected={isSel ? "" : undefined}>
              <input
                type="checkbox"
                className="lock-check accent-accent"
                checked={isSel}
                onChange={() => toggle(key)}
                aria-label={`Select ${st.fullName}`}
              />
              <div className="min-w-0">
                <Link to={`/students/${st.userId}`} className="lock-student text-sm">
                  {st.fullName}
                </Link>{" "}
                <span className="num text-xs text-ink-muted">{st.studentId}</span>
                <p className={c.override ? "text-xs text-ink" : "text-xs text-ink-muted"}>{cellLine(c)}</p>
              </div>
              <button
                type="button"
                className="lock-cell"
                data-lock={kind}
                data-look={kind}
                data-resolved={c.unlocked ? "open" : "closed"}
                data-user={st.userId}
                data-stage={stage.id}
                data-selected={isSel ? "" : undefined}
                aria-label={cellName(c, st.fullName, stage, isSel)}
                onClick={() => open(c)}
              >
                <CellMark kind={kind} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
