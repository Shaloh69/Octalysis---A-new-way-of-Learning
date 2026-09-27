import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useDelayed } from "@/lib/useDelayed";
import { exportedWords, matches } from "@/lib/gradebook-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { Kpis, StageChart, Weights } from "./gradebook/Overview";
import { GridList, GridTable, type View } from "./gradebook/Grid";

/**
 * `/gradebook`: every student's score so far, weighted by the syllabus.
 * Rebuilt 28 Sep 2026 against `design/templates/console/gradebook/SPEC.md`
 * (shadcn-admin's Dashboard for the frame, a heatmap table for the grid);
 * gated by `design/specs/console-gradebook.spec.ts`.
 *
 * The page computes nothing. The weights, the rescaling over what has marks,
 * "not sat" versus 0 and graded-only counting are `services/api`'s
 * `computeGradebook()`, and the CSV comes from the same function, so the page
 * and the file a teacher hands the registrar cannot disagree.
 *
 * It makes no writes. Marks are made, and frozen, in `/submissions`.
 */

/** Below this much of its own width the 18 stage columns do not fit the card, so the grid is a list. */
const WIDE_PX = 1056; // 66rem

const VIEWS: Array<[View, string]> = [
  ["final", "Final grade"],
  ["stages", "Stage checks"],
];

export function GradebookPage() {
  const q = useAsync(() => api.gradebook(), []);
  const book = q.data;
  const firstLoad = q.loading && !book;
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

  const [view, setView] = useState<View>("final");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => (book?.students ?? []).filter((s) => matches(s, query)), [book, query]);
  const sections = useMemo(
    () => [...new Set((book?.students ?? []).map((s) => s.section).filter((s): s is string => !!s))],
    [book],
  );

  const [downloading, setDownloading] = useState(false);
  async function download() {
    setDownloading(true);
    try {
      const csv = await api.gradebookCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `octa-gradebook-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Gradebook downloaded", book ? exportedWords(book.students.length, book.coverage) : undefined);
    } catch {
      toast.error("The gradebook could not be downloaded", "Nothing was saved. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div ref={box} className="gb">
      <header className="gb-head">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink">Gradebook</h1>
          <p className="max-w-2xl text-sm text-ink-muted">
            Every student's score so far, weighted by the syllabus. Marks are made in Submissions and the stage checks.
          </p>
        </div>
        <Button onClick={() => void download()} disabled={downloading || !book} className="gb-download">
          <Download className="h-4 w-4" aria-hidden="true" />
          {downloading ? "Preparing…" : "Download CSV"}
        </Button>
      </header>

      {q.error && !book ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger bg-danger-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink">
            The gradebook could not be loaded. <span className="text-ink-muted">{q.error}</span>
          </p>
          <Button size="sm" variant="outline" onClick={q.reload}>
            Try again
          </Button>
        </div>
      ) : firstLoad || !book ? (
        showSkeleton ? <Skeleton slow={slow} /> : <div className="min-h-[40rem]" aria-busy="true" />
      ) : book.students.length === 0 ? (
        <Empty
          title="No students on the roster yet"
          hint="The gradebook lists every registered student. Import the class list first."
          action={<Link className="gb-link" to="/students">Import the roster on Students</Link>}
        />
      ) : (
        <>
          <Kpis book={book} />
          <div className="gb-pair">
            <StageChart book={book} />
            <Weights book={book} />
          </div>

          <section className="gb-card gb-grid-card" aria-labelledby="gb-grid-title">
            <div className="gb-grid-head">
              <div className="min-w-0">
                <h2 id="gb-grid-title" className="gb-h2">Students</h2>
                <p className="gb-sub">
                  <span className="num">{book.students.length}</span> students
                  {sections.length > 0 ? <> · {sections.join(", ")}</> : null} · by
                  student ID
                </p>
              </div>
              <div className="gb-toolbar">
                <div className="gb-search">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <Input
                    className="pl-6"
                    aria-label="Filter by name or student ID"
                    placeholder="Name or student ID"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="gb-views" role="group" aria-label="Show">
                  {VIEWS.map(([v, word]) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={view === v ? "default" : "outline"}
                      aria-pressed={view === v}
                      onClick={() => setView(v)}
                    >
                      {word}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="gb-nomatch" role="status">
                No student matches “{query.trim()}”.
              </p>
            ) : wide ? (
              <GridTable book={book} rows={rows} view={view} />
            ) : (
              <GridList book={book} rows={rows} view={view} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** The shape of what is coming: four tiles, two cards, a grid. */
function Skeleton({ slow }: { slow: boolean }) {
  return (
    <div data-skeleton="" aria-busy="true" aria-label="Loading the gradebook">
      {slow ? (
        <p className="mb-3 text-sm text-ink-muted" role="status">
          Still loading. The server may be waking up; this can take up to a minute.
        </p>
      ) : null}
      <div className="gb-kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="gb-card gb-kpi gb-skel" />)}
      </div>
      <div className="gb-pair">
        <div className="gb-card gb-skel gb-skel-chart" />
        <div className="gb-card gb-skel gb-skel-chart" />
      </div>
      <div className="gb-card gb-skel gb-skel-grid" />
    </div>
  );
}
