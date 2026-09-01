import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  useReactTable, type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Upload } from "lucide-react";
import { api, type RosterRow } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { parseRoster } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Empty, ErrorNote, Loading } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * The roster.
 *
 * The import is DRY RUN BY DEFAULT, and the plan is shown before anything is
 * written — the server defaults `apply` to false for the same reason. A roster
 * import that silently rewrites forty rows because someone forgot a checkbox is
 * not recoverable without reading the audit log, and by then a student has
 * already failed to register.
 *
 * A claimed row is never overwritten. It is reported as skipped, in the plan,
 * before you commit.
 */
export function StudentsPage() {
  const { data, error, loading, reload } = useAsync(() => api.roster(), []);
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [importOpen, setImportOpen] = useState(false);

  const columns = useMemo<ColumnDef<RosterRow>[]>(
    () => [
      {
        accessorKey: "studentId",
        header: "Student ID",
        cell: (ctx) => <span className="num text-xs">{ctx.getValue<string>()}</span>,
      },
      {
        accessorKey: "fullName",
        header: "Name",
        cell: (ctx) => {
          const r = ctx.row.original;
          return r.userId ? (
            <Link to={`/students/${r.userId}`} className="text-ink hover:text-accent hover:underline">
              {r.fullName}
            </Link>
          ) : (
            <span className="text-ink-muted">{r.fullName}</span>
          );
        },
      },
      { accessorKey: "sectionCode", header: "Section",
        cell: (ctx) => ctx.getValue<string | null>() ?? "—" },
      {
        accessorKey: "status",
        header: "Registration",
        cell: (ctx) => {
          const r = ctx.row.original;
          if (r.deactivated) return <Badge tone="danger">Deactivated</Badge>;
          const s = ctx.getValue<RosterRow["status"]>();
          return s === "claimed" ? (
            <Badge tone="success">Registered</Badge>
          ) : s === "disabled" ? (
            <Badge tone="locked">Disabled</Badge>
          ) : (
            <Badge tone="neutral">Not yet</Badge>
          );
        },
      },
      {
        accessorKey: "attempts",
        header: "Attempts",
        cell: (ctx) => <span className="num">{ctx.getValue<number>()}</span>,
      },
      {
        accessorKey: "avgMastery",
        header: "Avg mastery",
        cell: (ctx) => {
          const v = ctx.getValue<number | null>();
          return <span className="num">{v === null ? "—" : `${v}%`}</span>;
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.students ?? [],
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) return <Loading what="the roster" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data?.students ?? [];
  const registered = rows.filter((r) => r.status === "claimed" && !r.deactivated).length;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl">Students</h1>
          <p className="text-sm text-ink-muted">
            <span className="num">{registered}</span> of <span className="num">{rows.length}</span>{" "}
            on the roster have registered.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" aria-hidden="true" /> Import roster
        </Button>
      </header>

      {rows.length === 0 ? (
        <Empty
          title="The roster is empty"
          hint="Students cannot register until their ID is on the roster — that is what stops anyone with the URL from creating an account. Import one to begin."
          action={<Button onClick={() => setImportOpen(true)}>Import roster</Button>}
        />
      ) : (
        <>
          <div className="mb-3 max-w-xs">
            <Label htmlFor="roster-filter">Filter</Label>
            <Input
              id="roster-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Name, ID, or section"
            />
          </div>

          <div className="table-scroll rounded-lg border border-line bg-surface-1">
            <Table>
              <THead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted(); // false | "asc" | "desc"
                      return (
                        /*
                         * `aria-sort` on the TH, not on the button. It is the
                         * COLUMN that is sorted, and this is the attribute a
                         * screen reader reads when it lands on the cell.
                         * Nothing carried sort state before: the icon was one
                         * fixed glyph, `aria-hidden`, identical in all three
                         * states. Pressing it reordered the table and told you
                         * nothing -- which fails the design mandate's
                         * legibility test outright, since you cannot see what
                         * the control did.
                         */
                        <TH
                          key={h.id}
                          aria-sort={
                            sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : "none"
                          }
                        >
                          <button
                            type="button"
                            /*
                             * `--control-h-sm` (2rem / 32px) is the design
                             * system's own floor, described in tokens.css as
                             * "dense table actions" -- which is exactly what
                             * this is. These rendered at 18px because the
                             * button had no height at all and simply hugged its
                             * text. Negative margin keeps the header row from
                             * growing now that the target does.
                             *
                             * NOT `w-full`: that was tried, and it pushed the
                             * roster table wider than 380px. Height is what the
                             * target-size finding was about; width was me
                             * gold-plating and breaking a gate to do it.
                             */
                            className="-my-1 inline-flex h-8 items-center gap-1 hover:text-ink"
                            onClick={h.column.getToggleSortingHandler()}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {/*
                              The glyph reflects DIRECTION rather than being
                              decoration. Sort state reaches assistive tech via
                              `aria-sort` on the TH above, which is the standard
                              mechanism for exactly this.

                              A redundant `sr-only` span was tried here and is
                              deliberately gone: Tailwind's `sr-only` is
                              `position: absolute`, `.table-scroll` is not
                              `position: relative`, so the spans escaped the
                              scroller's clipping, took their static position out
                              near the right edge of a 554px-wide table, and
                              pushed the DOCUMENT to 497px at a 380px viewport.
                              An invisible element broke a layout gate, which is
                              a good reason not to add one you do not need.
                            */}
                            {sorted === "asc" ? (
                              <ArrowUp className="h-3 w-3" aria-hidden="true" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
                            )}
                          </button>
                        </TH>
                      );
                    })}
                  </tr>
                ))}
              </THead>
              <TBody>
                {table.getRowModel().rows.map((r) => (
                  <TR key={r.id}>
                    {r.getVisibleCells().map((c) => (
                      <TD key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {table.getRowModel().rows.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No student matches “{filter}”.</p>
          ) : null}
        </>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={reload} />
    </>
  );
}

/* ------------------------------------------------------------------ import */

function ImportDialog({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [sectionCode, setSectionCode] = useState("BSCPE-2A");
  const [term, setTerm] = useState("2026-1");
  const [csv, setCsv] = useState("");
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof api.importRoster>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parsed = parseRoster(csv);

  async function run(apply: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.importRoster({ sectionCode, term, rows: parsed.rows, apply });
      setPlan(res);
      if (apply) {
        onDone();
        onClose();
        setCsv("");
        setPlan(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import roster</DialogTitle>
          <DialogDescription>
            One student per line: <span className="num">ID,Full Name</span>. Nothing is written
            until you have seen the plan.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="section">Section code</Label>
            <Input id="section" value={sectionCode} onChange={(e) => setSectionCode(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="term">Term</Label>
            <Input id="term" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
        </div>

        <Label htmlFor="csv">Roster</Label>
        <Textarea
          id="csv"
          rows={8}
          className="num text-xs"
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setPlan(null); }}
          placeholder={"21-1234-567,Dela Cruz, Juan\n21-1234-568,Santos, Maria"}
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          <span className="num">{parsed.rows.length}</span> readable
          {parsed.bad > 0 ? (
            <> · <span className="num text-warning">{parsed.bad}</span> line(s) skipped as unreadable</>
          ) : null}
        </p>

        {plan ? (
          <div className="mt-4 rounded-md border border-line bg-surface-0 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Plan — nothing written yet
            </p>
            <ul className="space-y-1 text-sm">
              <li>
                <span className="num text-success">{plan.summary.insert}</span> new student(s) added
              </li>
              <li>
                <span className="num text-info">{plan.summary.update}</span> existing row(s) updated
              </li>
              <li>
                <span className="num text-warning">{plan.summary.skipped}</span> skipped — already
                registered, and never overwritten
              </li>
            </ul>
          </div>
        ) : null}

        {err ? <p className="mt-3 text-sm text-danger" role="alert">{err}</p> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="outline"
            onClick={() => void run(false)}
            disabled={busy || parsed.rows.length === 0}
          >
            {busy ? "Checking…" : "Preview"}
          </Button>
          <Button onClick={() => void run(true)} disabled={busy || plan === null}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
