import { Link } from "react-router-dom";
import type { Gradebook, GradebookStudent } from "@octa/contracts";
import { SHORT_LABEL, checkText, pctText } from "@/lib/gradebook-view";

/**
 * The grid (`template-table.png`, the heatmap's shape without its shading):
 * students down, marks across, the final as the total column and the class
 * average as the total row. At 66rem of the page's own width and up, a table
 * that fits its card without scrolling sideways; below, a list with the same
 * facts. Every view, both layouts, carries the same data attributes, so the
 * spec reads one thing whatever the width.
 *
 * Three views: the final (the five components), the stage checks, and since
 * 8 Oct 2026 the MOON checks (docs/GRADED-MOONS-PLAN.md): each graded moon's
 * check counts as one more quiz inside Quizzes, and a moon the class has not
 * sat is not a column (it is not counted either).
 */

export type View = "final" | "stages" | "moons";

interface GridProps {
  book: Gradebook;
  rows: GradebookStudent[];
  view: View;
}

type Average = Gradebook["classAverage"];

const faint = (v: number | null) => (v === null ? "gb-none" : undefined);

/** A column of a check view: a stage's check, or a graded moon's. */
export interface CheckColumn {
  id: string;
  title: string;
}

/** The columns of a check view. Moons: only those the class has sat, as Quizzes counts them. */
export function columnsOf(book: Gradebook, view: View): CheckColumn[] {
  if (view === "stages") return book.stages;
  if (view === "moons") return book.moons.filter((m) => book.classAverage.moons[m.id] != null);
  return [];
}

type Marks = { checks: Record<string, number | null>; moonChecks: Record<string, number | null>; components: Record<string, number | null> };

const markOf = (v: Marks, view: View, id: string): number | null =>
  (view === "moons" ? v.moonChecks[id] : v.checks[id]) ?? null;

const averageMarks = (avg: Average): Marks => ({ checks: avg.checks, moonChecks: avg.moons, components: avg.components });

const attr = (view: View, id: string) => (view === "moons" ? { "data-moon-check": id } : { "data-check": id });

function Who({ s }: { s: GradebookStudent }) {
  return (
    <>
      <Link className="gb-name" to={`/students/${s.userId}`}>{s.fullName}</Link>
      <span className="gb-id num">{s.studentId}</span>
    </>
  );
}

/** Nothing to show in a check view yet: said, not an empty table. */
export function NoColumns({ view }: { view: View }) {
  return (
    <p className="gb-nomatch gb-empty" role="status" data-no-columns={view}>
      {view === "moons"
        ? "No moon check has been sat yet. Each graded moon appears here, and counts as one more quiz, once someone in the class has sat it."
        : "No stage check has been sat yet."}
    </p>
  );
}

/* ------------------------------------------------------------ wide */

export function GridTable({ book, rows, view }: GridProps) {
  const avg = book.classAverage;
  const cols = columnsOf(book, view);
  return (
    <table className="gb-table" data-grid="" data-view={view}>
      <caption className="sr-only">
        {view === "final"
          ? "Each student's score so far per grade component, and the final so far"
          : view === "stages"
            ? "Each student's best score per stage check"
            : "Each student's best score per graded moon check"}
      </caption>
      <colgroup>
        <col className="c-student" />
        {view === "final" ? (
          <>
            {book.components.map((c) => <col key={c.key} />)}
            <col className="c-final" />
            <col className="c-unmarked" />
          </>
        ) : (
          cols.map((s) => <col key={s.id} />)
        )}
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Student</th>
          {view === "final" ? (
            <>
              {book.components.map((c) => (
                <th key={c.key} scope="col" className="gb-col">
                  <span className="gb-th-name">{c.label}</span>
                  <span className="num">{c.weight}%</span>
                  {c.covered ? null : <span className="gb-th-note">no marks yet</span>}
                </th>
              ))}
              <th scope="col" className="gb-col gb-total">
                <span className="gb-th-name">Final so far</span>
                <span className="num">{book.coverage}%</span>
                <span className="gb-th-note">of the grade</span>
              </th>
              <th scope="col" className="gb-col">
                <span className="gb-th-name">Unmarked</span>
              </th>
            </>
          ) : (
            cols.map((s) => (
              <th key={s.id} scope="col" className="gb-col">
                <span className="num">{s.id}</span>
                <span className="sr-only"> {s.title}</span>
              </th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.userId} data-student={s.studentId}>
            <th scope="row" className="gb-who"><Who s={s} /></th>
            {view === "final" ? (
              <>
                {book.components.map((c) => {
                  const v = s.components[c.key] ?? null;
                  return (
                    <td key={c.key} className={faint(v)}>
                      <span className="num" data-component={c.key}>{pctText(v)}</span>
                    </td>
                  );
                })}
                <td className="gb-total">
                  <span className="num" data-final="">{pctText(s.final)}</span>
                </td>
                <td>
                  <span className="num" data-unmarked="">{s.unmarked}</span>
                </td>
              </>
            ) : (
              cols.map((st) => {
                const v = markOf(s, view, st.id);
                return (
                  <td key={st.id} className={faint(v)}>
                    <span className={v === null ? "gb-notsat" : "num"} {...attr(view, st.id)}>{checkText(v)}</span>
                  </td>
                );
              })
            )}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <AverageRow book={book} avg={avg} view={view} cols={cols} />
      </tfoot>
    </table>
  );
}

function AverageRow({ book, avg, view, cols }: { book: Gradebook; avg: Average; view: View; cols: CheckColumn[] }) {
  return (
    <tr data-average="">
      <th scope="row" className="gb-who">Class average</th>
      {view === "final" ? (
        <>
          {book.components.map((c) => {
            const v = avg.components[c.key] ?? null;
            return (
              <td key={c.key} className={faint(v)}>
                <span className="num" data-component={c.key}>{pctText(v)}</span>
              </td>
            );
          })}
          <td className="gb-total">
            <span className="num" data-final="">{pctText(avg.final)}</span>
          </td>
          <td className="gb-none">
            <span aria-hidden="true">–</span>
            <span className="sr-only">not averaged</span>
          </td>
        </>
      ) : (
        cols.map((st) => {
          const v = markOf(averageMarks(avg), view, st.id);
          return (
            <td key={st.id} className={faint(v)}>
              <span className={v === null ? "gb-notsat" : "num"} {...attr(view, st.id)}>{checkText(v)}</span>
            </td>
          );
        })
      )}
    </tr>
  );
}

/* ------------------------------------------------------------ narrow */

function Facts({ book, values, view }: { book: Gradebook; values: Marks; view: View }) {
  if (view === "final") {
    return (
      <dl className="gb-facts">
        {book.components.map((c) => {
          const v = values.components[c.key] ?? null;
          return (
            <div key={c.key} className="gb-fact">
              <dt>{SHORT_LABEL[c.key]} <span className="num">{c.weight}%</span></dt>
              <dd className={faint(v)}><span className="num" data-component={c.key}>{pctText(v)}</span></dd>
            </div>
          );
        })}
      </dl>
    );
  }
  return (
    <dl className="gb-facts gb-facts-stages">
      {columnsOf(book, view).map((st) => {
        const v = markOf(values, view, st.id);
        return (
          <div key={st.id} className="gb-fact">
            <dt><span className="num">{st.id}</span><span className="sr-only"> {st.title}</span></dt>
            <dd className={faint(v)}>
              <span className={v === null ? "gb-notsat" : "num"} {...attr(view, st.id)}>{checkText(v)}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function GridList({ book, rows, view }: GridProps) {
  return (
    <ul className="gb-list" data-grid="" data-view={view}>
      {rows.map((s) => (
        <li key={s.userId} className="gb-item" data-student={s.studentId}>
          <div className="gb-item-head">
            <span className="gb-item-who"><Who s={s} /></span>
            <span className="gb-item-final">
              <span className="gb-item-final-label">Final so far</span>
              <span className="num" data-final="">{pctText(s.final)}</span>
            </span>
          </div>
          <Facts book={book} values={s} view={view} />
          {view === "final" && s.unmarked > 0 ? (
            <p className="gb-item-note">
              <span className="num" data-unmarked="">{s.unmarked}</span> handed in, not marked yet
            </p>
          ) : null}
        </li>
      ))}
      <li className="gb-item gb-item-average" data-average="">
        <div className="gb-item-head">
          <span className="gb-item-who gb-name-static">Class average</span>
          <span className="gb-item-final">
            <span className="gb-item-final-label">Final so far</span>
            <span className="num" data-final="">{pctText(book.classAverage.final)}</span>
          </span>
        </div>
        <Facts book={book} values={averageMarks(book.classAverage)} view={view} />
      </li>
    </ul>
  );
}
