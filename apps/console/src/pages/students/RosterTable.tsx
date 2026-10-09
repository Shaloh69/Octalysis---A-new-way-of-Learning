import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/Avatar";
import type { RosterRow } from "@/lib/api";
import { rosterState, STATE_WORDS } from "@/lib/roster-view";
import { RowMenu, type RowActions } from "./RowMenu";

export const STATE_TONE = { registered: "success", "not-registered": "neutral", deactivated: "locked" } as const;

/**
 * The roster at 56rem of available width and up: eight columns, a checkbox,
 * six of data and the menu, in `table-layout: fixed` so the table is exactly
 * as wide as its card. It never scrolls sideways: assertion 1 counts a
 * horizontal scroller as clipping, and the page this replaced sat in one.
 */
export function RosterTable({
  rows, selected, toggle, toggleAll, on,
}: {
  rows: RosterRow[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  on: RowActions;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<RosterRow>[]>(
    () => [
      { accessorKey: "studentId", header: "Student ID" },
      { accessorKey: "fullName", header: "Name" },
      { accessorKey: "sectionCode", header: "Section" },
      { id: "state", accessorFn: (r) => STATE_WORDS[rosterState(r)], header: "Registration" },
      { accessorKey: "attempts", header: "Attempts" },
      { accessorKey: "avgMastery", header: "Avg mastery", sortUndefined: "last" },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (r) => r.studentId,
  });

  const all = rows.length > 0 && rows.every((r) => selected.has(r.studentId));
  const some = !all && rows.some((r) => selected.has(r.studentId));

  return (
    <table className="roster-table">
      <colgroup>
        <col className="c-check" />
        <col className="c-id" />
        <col />
        <col className="c-section" />
        <col className="c-state" />
        <col className="c-num" />
        <col className="c-num" />
        <col className="c-menu" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">
            <input
              type="checkbox"
              className="roster-check"
              aria-label="Select every student shown"
              checked={all}
              ref={(el) => { if (el) el.indeterminate = some; }}
              onChange={toggleAll}
            />
          </th>
          {table.getHeaderGroups()[0]!.headers.map((h) => {
            const sorted = h.column.getIsSorted();
            return (
              <th
                key={h.id}
                scope="col"
                className={h.id === "attempts" || h.id === "avgMastery" ? "num-col" : undefined}
                aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
              >
                <button type="button" className="roster-sort" onClick={h.column.getToggleSortingHandler()}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {sorted === "asc" ? (
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  ) : sorted === "desc" ? (
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-60" aria-hidden="true" />
                  )}
                </button>
              </th>
            );
          })}
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {table.getRowModel().rows.map(({ original: r }) => {
          const state = rosterState(r);
          return (
            <tr
              key={r.studentId}
              data-student={r.studentId}
              data-state={state}
              data-selected={selected.has(r.studentId) ? "" : undefined}
            >
              <td>
                <input
                  type="checkbox"
                  className="roster-check"
                  aria-label={`Select ${r.fullName}`}
                  checked={selected.has(r.studentId)}
                  onChange={() => toggle(r.studentId)}
                />
              </td>
              <td className="num text-xs">{r.studentId}</td>
              <td>
                <span className="roster-who">
                  <Avatar avatar={r.avatar} size="md" />
                  {r.userId ? (
                    <Link to={`/students/${r.userId}`} className="roster-name">
                      {r.fullName}
                    </Link>
                  ) : (
                    <span className="roster-name">{r.fullName}</span>
                  )}
                </span>
              </td>
              <td>{r.sectionCode ?? <span className="text-ink-muted">none</span>}</td>
              <td>
                <Badge tone={STATE_TONE[state]}>{STATE_WORDS[state]}</Badge>
              </td>
              <td className="num num-col">{r.attempts}</td>
              <td className="num num-col">{r.avgMastery === null ? "—" : `${r.avgMastery}%`}</td>
              <td className="c-menu-cell">
                <RowMenu student={r} on={on} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
