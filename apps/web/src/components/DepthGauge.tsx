import { LEVELS, LEVEL_NAMES } from "../lib/layout";

/**
 * The Depth Gauge.
 *
 * Not a progress bar and not counting anything. It shows how far into the
 * machine the student can currently SEE. It is present from Stage 00 and
 * NAMED only from Stage 11 -- ten weeks of unexplained descent is the setup for
 * that reveal, and the withholding is designed.
 */
export function DepthGauge({ depth, revealed }: { depth: number; revealed: boolean }): JSX.Element {
  return (
    <aside
      className="depth-gauge"
      aria-label={revealed ? "Depth gauge: the Computer Level Hierarchy" : "Depth gauge"}
    >
      <ol>
        {LEVELS.map((level) => {
          const reached = level >= depth;
          return (
            <li
              key={level}
              className={`depth-seg ${reached ? "depth-reached" : ""}`}
              aria-current={level === depth ? "step" : undefined}
            >
              <span className="depth-mark mono">L{level}</span>
              {revealed && <span className="depth-label">{LEVEL_NAMES[level]}</span>}
              <span className="sr-only">
                {revealed ? LEVEL_NAMES[level] : `Level ${level}`}
                {reached ? ", reached" : ", not yet reached"}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
