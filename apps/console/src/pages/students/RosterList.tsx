import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { RosterRow } from "@/lib/api";
import { plural, rosterState, STATE_WORDS } from "@/lib/roster-view";
import { RowMenu, type RowActions } from "./RowMenu";
import { STATE_TONE } from "./RosterTable";

/**
 * The roster below 56rem of available width. The template's table is cut off
 * after two columns at 380 (`template-380.png`); a list says everything a row
 * says, with the same controls, and nothing needs hover or a sideways scroll.
 */
export function RosterList({
  rows, selected, toggle, toggleAll, on,
}: {
  rows: RosterRow[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  on: RowActions;
}) {
  const all = rows.length > 0 && rows.every((r) => selected.has(r.studentId));
  const some = !all && rows.some((r) => selected.has(r.studentId));
  return (
    <>
      <label className="roster-list-head">
        <input
          type="checkbox"
          className="roster-check"
          aria-label="Select every student shown"
          checked={all}
          ref={(el) => { if (el) el.indeterminate = some; }}
          onChange={toggleAll}
        />
        <span className="text-xs text-ink-muted">Select all {plural(rows.length, "student")} shown</span>
      </label>
      <ul className="roster-list" aria-label="Students">
        {rows.map((r) => {
          const state = rosterState(r);
          return (
            <li
              key={r.studentId}
              data-student={r.studentId}
              data-state={state}
              data-selected={selected.has(r.studentId) ? "" : undefined}
            >
              <input
                type="checkbox"
                className="roster-check"
                aria-label={`Select ${r.fullName}`}
                checked={selected.has(r.studentId)}
                onChange={() => toggle(r.studentId)}
              />
              <div className="min-w-0">
                {r.userId ? (
                  <Link to={`/students/${r.userId}`} className="roster-name">
                    {r.fullName}
                  </Link>
                ) : (
                  <span className="roster-name">{r.fullName}</span>
                )}
                <p className="roster-list-meta">
                  <span className="num">{r.studentId}</span>
                  <span>{r.sectionCode ?? "no section"}</span>
                  <Badge tone={STATE_TONE[state]}>{STATE_WORDS[state]}</Badge>
                </p>
                <p className="roster-list-meta">
                  <span>
                    <span className="num">{r.attempts}</span> {r.attempts === 1 ? "attempt" : "attempts"}
                  </span>
                  <span>
                    mastery <span className="num">{r.avgMastery === null ? "—" : `${r.avgMastery}%`}</span>
                  </span>
                </p>
              </div>
              <RowMenu student={r} on={on} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
