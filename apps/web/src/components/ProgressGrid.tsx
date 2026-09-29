import { LEVELS, LEVEL_NAMES } from "../lib/layout";
import type { ProgressGrid as Grid, StageNode } from "../lib/api";
import { nextStage } from "../lib/next-stage";
import { NumberedTitle } from "../shell/MissionPanel";
import { WarpLink } from "../shell/RealmWarp";

/**
 * `/app/progress`: Starfield's character menu
 * (`design/templates/web/progress/template.png`, WEB-REMAKE.md §8 row 7).
 *
 *   DEPTH      the emblem at the centre: the seven levels of the Computer
 *              Level Hierarchy as rings, L6 outside to L0 at the core, lit
 *              down to the student's depth. Depth says how far down they can
 *              see; it is not a score
 *   SURVEY     stages mastered, course mastery, and cells at mastery, each a
 *              meter that prints its number
 *   READ / TRACE / BUILD
 *              the 21 cells, seven labelled meters per competency. A cell no
 *              objective reaches is shown, and says so: the grid never hides
 *              the shape of the course
 *
 * There is no XP, no points and no currency; every number is a mastery
 * percentage and compares the student only to themselves.
 */
const COMPETENCIES = ["read", "trace", "build"] as const;

const MEANING: Record<string, string> = {
  read: "Interpret an artifact at this level",
  trace: "Follow execution through it",
  build: "Produce one yourself",
};

export function ProgressGrid({ data, nodes }: { data: Grid; nodes: StageNode[] }): JSX.Element {
  const cell = (level: number, competency: string) =>
    data.grid.find((g) => g.level === level && g.competency === competency);
  const depth = data.depth;
  const threshold = Math.round(data.thresholdForMastery * 100);
  const revealed = (nodes.find((n) => n.id === "11")?.state ?? "locked") !== "locked";

  const reachable = data.grid.filter((g) => g.objectives > 0);
  const atMastery = reachable.filter((g) => g.mastery >= data.thresholdForMastery).length;
  const mastered = nodes.filter((n) => n.state === "mastered").length;
  const graded = nodes.filter((n) => n.gradeable);
  const course = graded.length ? Math.round((graded.reduce((s, n) => s + n.mastery, 0) / graded.length) * 100) : 0;
  const untouched = data.grid.every((g) => g.mastery === 0);
  const next = nextStage(nodes);

  return (
    <section className="prog" data-progress="" aria-labelledby="prog-title">
      <header className="prog-head">
        <h1 id="prog-title" className="prog-title">
          Progress
        </h1>
        <p className="prog-sub">What you can do, and how deep. Compared only to yourself.</p>
      </header>

      {untouched && (
        <p className="prog-empty" data-empty="">
          <span>Nothing mastered yet. A cell fills as you pass the checks that reach it.</span>
          {(next.kind === "start" || next.kind === "resume") && (
            <WarpLink className="button hud-button button-primary" to={`/app/stage/${next.node.id}`}>
              <NumberedTitle text={`Go to Stage ${next.node.id}`} />
            </WarpLink>
          )}
        </p>
      )}

      <div className="prog-hub">
        <figure className="prog-depth" aria-labelledby="prog-depth-caption">
          <svg className="prog-rings" viewBox="0 0 200 200" aria-hidden="true">
            {LEVELS.map((level, i) => (
              <circle
                key={level}
                cx="100"
                cy="100"
                r={94 - i * 13}
                className={level >= depth ? "is-reached" : ""}
              />
            ))}
            <circle cx="100" cy="100" r="6" className="prog-core" />
          </svg>
          <figcaption id="prog-depth-caption" className="prog-depth-caption">
            <span className="prog-depth-label">
              Depth <span className="mono">L{depth}</span>
            </span>
            {revealed && <span className="prog-depth-name">{LEVEL_NAMES[depth]}</span>}
            <span className="prog-depth-note">How far into the machine you can see, L6 at the surface to L0.</span>
          </figcaption>
        </figure>

        <section className="hud-panel prog-survey" aria-labelledby="prog-survey-title">
          <h2 id="prog-survey-title" className="hud-caption">
            Survey
          </h2>
          <ul className="prog-meters">
            <Meter label="Stages mastered" value={`${mastered}/${nodes.length}`} pct={nodes.length ? (mastered / nodes.length) * 100 : 0} />
            <Meter label="Course mastery" value={`${course}%`} pct={course} />
            <Meter label="Cells at mastery" value={`${atMastery}/${reachable.length}`} pct={reachable.length ? (atMastery / reachable.length) * 100 : 0} />
          </ul>
          <p className="prog-note">
            A cell is at mastery from <span className="mono">{threshold}%</span>. Of the 21, <span className="mono">{reachable.length}</span> are reached by an objective so far.
          </p>
        </section>
      </div>

      <div className="prog-comps">
        {COMPETENCIES.map((c) => (
          <section key={c} className="hud-panel prog-comp" aria-labelledby={`prog-${c}`}>
            <h2 id={`prog-${c}`} className="hud-caption">
              {c}
            </h2>
            <p className="prog-meaning">{MEANING[c]}</p>
            <ul className="prog-meters">
              {LEVELS.map((level) => {
                const g = cell(level, c);
                if (!g || g.objectives === 0) {
                  return (
                    <li key={level} className="prog-meter is-none" data-cell={`${c}-${level}`}>
                      <span className="prog-meter-label">
                        <span className="mono">L{level}</span> {LEVEL_NAMES[level]}
                      </span>
                      <span className="prog-meter-value">No objective yet</span>
                      <span className="prog-meter-track" aria-hidden="true" />
                    </li>
                  );
                }
                const pct = Math.round(g.mastery * 100);
                return (
                  <li key={level} className="prog-meter" data-cell={`${c}-${level}`}>
                    <span className="prog-meter-label">
                      <span className="mono">L{level}</span> {LEVEL_NAMES[level]}
                    </span>
                    <span className="prog-meter-value mono">{pct}%</span>
                    <span className="prog-meter-track" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number }): JSX.Element {
  return (
    <li className="prog-meter">
      <span className="prog-meter-label">{label}</span>
      <span className="prog-meter-value mono">{value}</span>
      <span className="prog-meter-track" aria-hidden="true">
        <span style={{ width: `${Math.round(pct)}%` }} />
      </span>
    </li>
  );
}

/** The page's shape while the grid is on its way: the hub and three panels. */
export function ProgressSkeleton({ slow }: { slow: boolean }): JSX.Element {
  return (
    <section className="prog" data-progress="loading" aria-busy="true" aria-labelledby="prog-title">
      <header className="prog-head">
        <h1 id="prog-title" className="prog-title">
          Progress
        </h1>
      </header>
      {slow && <p className="prog-slow">Still loading your progress. The server may be waking up, which can take up to a minute.</p>}
      <div className="prog-hub" data-skeleton="">
        <span className="prog-skel prog-skel-ring" />
        <span className="prog-skel prog-skel-panel" />
      </div>
      <div className="prog-comps">
        {COMPETENCIES.map((c) => (
          <span key={c} className="prog-skel prog-skel-comp" />
        ))}
      </div>
    </section>
  );
}
