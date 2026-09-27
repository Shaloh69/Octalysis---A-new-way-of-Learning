import { Link } from "react-router-dom";
import type { Gradebook } from "@octa/contracts";
import { countedWords, coveredWords, pctText, stageRange } from "@/lib/gradebook-view";

/**
 * The top of `/gradebook`: the dashboard's KPI row, then its chart card beside
 * a card that explains the chart's numbers (`template.png`). Every value is
 * text, in mono; the chart's bars only restate what its numbers say.
 */

function Kpi({ id, label, value, children }: { id: string; label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="gb-card gb-kpi" data-kpi={id}>
      <p className="gb-kpi-label">{label}</p>
      <p className="gb-kpi-value">{value}</p>
      <p className="gb-kpi-note">{children}</p>
    </div>
  );
}

export function Kpis({ book }: { book: Gradebook }) {
  const sat = book.components.find((c) => c.key === "quizzes")?.counted.map((c) => c.id) ?? [];
  return (
    <section className="gb-kpis" aria-label="The course so far">
      <Kpi id="average" label="Class average so far" value={<><span className="num">{pctText(book.classAverage.final)}</span>{book.classAverage.final === null ? null : <span className="gb-kpi-of num">%</span>}</>}>
        {book.coverage === 0 ? "nothing marked yet" : <>over <span className="num">{book.coverage}%</span> of the grade</>}
      </Kpi>
      <Kpi
        id="covered"
        label="Grade covered"
        value={<><span className="num">{book.coverage}</span> <span className="gb-kpi-of">of <span className="num">100</span></span></>}
      >
        {coveredWords(book.components)}
      </Kpi>
      <Kpi
        id="sat"
        label="Stage checks sat"
        value={<><span className="num">{sat.length}</span> <span className="gb-kpi-of">of <span className="num">{book.stages.length}</span></span></>}
      >
        {sat.length === 0 ? "none yet" : <>stages <span className="num">{stageRange(sat)}</span></>}
      </Kpi>
      <Kpi id="awaiting" label="Awaiting marking" value={<span className="num">{book.awaitingMarking}</span>}>
        {book.awaitingMarking === 0 ? "nothing handed in is waiting" : <Link className="gb-link" to="/submissions">Mark them in Submissions</Link>}
      </Kpi>
    </section>
  );
}

/** Class average by stage check: one bar per gradeable stage, the value as text at its tip. */
export function StageChart({ book }: { book: Gradebook }) {
  return (
    <section className="gb-card gb-chart" data-chart="" aria-labelledby="gb-chart-title">
      <h2 id="gb-chart-title" className="gb-h2">Class average by stage check</h2>
      <p className="gb-sub">Each student's best score, averaged over the students who sat it.</p>
      <ol className="gb-bars">
        {book.stages.map((s) => {
          const v = book.classAverage.checks[s.id] ?? null;
          return (
            <li key={s.id} className="gb-bar-row" data-bar={s.id}>
              <span className="gb-bar-label">
                <span className="num">{s.id}</span> {s.title}
              </span>
              {v === null ? (
                <span className="gb-bar-none">not sat yet</span>
              ) : (
                <span className="gb-bar-track">
                  <span className="gb-bar" style={{ width: `${Math.max(v, 1)}%` }} aria-hidden="true" />
                  <span className="gb-bar-value num" data-value="">{Math.round(v)}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="gb-caption">
        A stage where the whole class sits low is a signal about the teaching, not about the students.
      </p>
    </section>
  );
}

/** The five components in the syllabus's order, their weights, and what each is made of so far. */
export function Weights({ book }: { book: Gradebook }) {
  return (
    <section className="gb-card gb-weights" aria-labelledby="gb-weights-title">
      <h2 id="gb-weights-title" className="gb-h2">How the grade is weighted</h2>
      <p className="gb-sub">The syllabus's weights for CPE 412. They are fixed.</p>
      <ul className="gb-weight-list" data-weights="">
        {book.components.map((c) => (
          <li key={c.key} className="gb-weight" data-weight={c.key} data-covered={c.covered ? "" : undefined}>
            <span className="gb-weight-name">{c.label}</span>
            <span className="gb-weight-pct">
              <span className="num" data-pct="">{c.weight}</span>
              <span className="num">%</span>
            </span>
            <span className="gb-weight-note">
              {c.covered ? <>counts · {countedWords(c)}</> : countedWords(c)}
            </span>
          </li>
        ))}
      </ul>
      <p className="gb-caption">
        {book.coverage === 0 ? (
          "Nothing has been marked yet, so there is no final to show."
        ) : (
          <>
            The final so far is rescaled over the <span className="num">{book.coverage}%</span> of the grade that has
            marks. Work not handed in counts as 0; work handed in and not yet marked is left out until it is.
          </>
        )}
      </p>
    </section>
  );
}
