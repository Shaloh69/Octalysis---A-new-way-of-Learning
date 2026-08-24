import { LEVELS, LEVEL_NAMES } from "../lib/layout";
import type { ProgressGrid as Grid } from "../lib/api";

/**
 * The 7 x 3 competency grid. This replaces every progress bar in the app.
 *
 * Depth says how far down you can see; competency says what you can do there.
 * There is no XP, no points, and no currency -- if a design needs a number here
 * it is a mastery percentage, and it compares the student only to themselves.
 */
const COMPETENCIES = ["read", "trace", "build"] as const;

const MEANING: Record<string, string> = {
  read: "You can interpret an artifact at this level",
  trace: "You can follow execution through it",
  build: "You can produce one yourself",
};

export function ProgressGrid({ data }: { data: Grid }): JSX.Element {
  const cell = (level: number, competency: string) =>
    data.grid.find((g) => g.level === level && g.competency === competency);

  return (
    <section className="progress">
      <h1>What you can do, and how deep</h1>
      <p className="progress-sub">
        Twenty-one cells. Each one is a sentence you could say about yourself in an
        interview -- which is more than &quot;level 14&quot; has ever been worth.
      </p>

      <div className="progress-scroll">
        <table className="progress-table">
          <caption className="sr-only">
            Competency by level. Rows are levels 6 down to 0; columns are read, trace and build.
          </caption>
          <thead>
            <tr>
              <th scope="col">Level</th>
              {COMPETENCIES.map((c) => (
                <th key={c} scope="col">
                  <span className="comp-name">{c}</span>
                  <span className="comp-meaning">{MEANING[c]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((level) => (
              <tr key={level}>
                <th scope="row">
                  <span className="mono">L{level}</span> {LEVEL_NAMES[level]}
                </th>
                {COMPETENCIES.map((c) => {
                  const g = cell(level, c);
                  const pct = Math.round((g?.mastery ?? 0) * 100);
                  const reachable = (g?.objectives ?? 0) > 0;
                  return (
                    <td key={c} className={reachable ? "" : "cell-unreachable"}>
                      {reachable ? (
                        <>
                          <span className="mono cell-pct">{pct}%</span>
                          <span
                            className="cell-fill"
                            style={{ width: `${pct}%` }}
                            aria-hidden="true"
                          />
                          <span className="sr-only">
                            {pct} percent, {g?.objectives} objective(s)
                          </span>
                        </>
                      ) : (
                        <span className="cell-none" title="No objective reaches this cell yet">
                          <span aria-hidden="true">--</span>
                          <span className="sr-only">
                            No objective covers this cell yet
                          </span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
