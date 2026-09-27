import { Link } from "react-router-dom";
import type { Gradebook, GradebookStudent } from "@octa/contracts";
import { SHORT_LABEL, checkText, pctText } from "@/lib/gradebook-view";

/**
 * The grid (`template-table.png`, the heatmap's shape without its shading):
 * students down, marks across, the final as the total column and the class
 * average as the total row. At 66rem of the page's own width and up, a table
 * that fits its card without scrolling sideways; below, a list with the same
 * facts. Both views, both layouts, carry the same data attributes, so the
 * spec reads one thing whatever the width.
 */

export type View = "final" | "stages";

interface GridProps {
  book: Gradebook;
  rows: GradebookStudent[];
  view: View;
}

type Average = Gradebook["classAverage"];

const faint = (v: number | null) => (v === null ? "gb-none" : undefined);

function Who({ s }: { s: GradebookStudent }) {
  return (
    <>
      <Link className="gb-name" to={`/students/${s.userId}`}>{s.fullName}</Link>
      <span className="gb-id num">{s.studentId}</span>
    </>
  );
}

/* ------------------------------------------------------------ wide */

export function GridTable({ book, rows, view }: GridProps) {
  const avg = book.classAverage;
  return (
    <table className="gb-table" data-grid="" data-view={view}>
      <caption className="sr-only">
        {view === "final"
          ? "Each student's score so far per grade component, and the final so far"
          : "Each student's best score per stage check"}
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
          book.stages.map((s) => <col key={s.id} />)
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
            book.stages.map((s) => (
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
              book.stages.map((st) => {
                const v = s.checks[st.id] ?? null;
                return (
                  <td key={st.id} className={faint(v)}>
                    <span className={v === null ? "gb-notsat" : "num"} data-check={st.id}>{checkText(v)}</span>
                  </td>
                );
              })
            )}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <AverageRow book={book} avg={avg} view={view} />
      </tfoot>
    </table>
  );
}

function AverageRow({ book, avg, view }: { book: Gradebook; avg: Average; view: View }) {
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
        book.stages.map((st) => {
          const v = avg.checks[st.id] ?? null;
          return (
            <td key={st.id} className={faint(v)}>
              <span className={v === null ? "gb-notsat" : "num"} data-check={st.id}>{checkText(v)}</span>
            </td>
          );
        })
      )}
    </tr>
  );
}

/* ------------------------------------------------------------ narrow */

function Facts({ book, values, view }: {
  book: Gradebook;
  values: { checks: Record<string, number | null>; components: Record<string, number | null> };
  view: View;
}) {
  return view === "final" ? (
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
  ) : (
    <dl className="gb-facts gb-facts-stages">
      {book.stages.map((st) => {
        const v = values.checks[st.id] ?? null;
        return (
          <div key={st.id} className="gb-fact">
            <dt><span className="num">{st.id}</span><span className="sr-only"> {st.title}</span></dt>
            <dd className={faint(v)}>
              <span className={v === null ? "gb-notsat" : "num"} data-check={st.id}>{checkText(v)}</span>
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
        <Facts book={book} values={book.classAverage} view={view} />
      </li>
    </ul>
  );
}
