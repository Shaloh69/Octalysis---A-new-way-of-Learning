import type { StageNode, StageMapData } from "../lib/api";

/**
 * Every stage, as progress and a planet mark rather than a wall of prose.
 *
 * This replaces the act list that used to sit under the map. That list was
 * correct and complete and nobody could read it: four columns of paragraphs
 * covering the whole page, which is what "too many words" meant — a student
 * scanning for where they are had to read every lock reason to find out.
 *
 * WHAT IT KEEPS, because these are the accessibility contract and not styling:
 *   - all 19 stages, locked ones included
 *   - every state named in words
 *   - **every lock reason and its distance, printed**. `DESIGN-MANDATE.md` §1
 *     calls a lock with no visible reason "the single most demotivating UI
 *     element in ed-tech", and `SOLAR-SYSTEM-SPEC.md` §1.4b makes this
 *     explicit: the 3D layer may withhold for effect, the accessible layer
 *     never does.
 *   - focus order following curriculum order, never screen position
 *
 * WHAT CHANGED is only how it is arranged: a progress bar carries mastery at a
 * glance where a percentage buried in a sentence did not, and a planet mark
 * ties each row to the body it represents on the map.
 */

/** Mastery as a bar. The number stays in text beside it — the bar is the fast read. */
function ProgressBar({ node }: { node: StageNode }): JSX.Element {
  const pct = Math.round(node.mastery * 100);
  return (
    <span className="stage-bar" aria-hidden="true">
      <span
        className={`stage-bar-fill stage-bar-${node.state}`}
        style={{ width: `${Math.max(pct, node.state === "locked" ? 0 : 2)}%` }}
      />
    </span>
  );
}

/**
 * The planet mark.
 *
 * Deliberately the same visual language as the scene: filled for mastered, an
 * outline for reachable, a dashed outline for a stage whose body has not formed
 * yet. Colour is never the only signal — the state is also a word in the row.
 */
function PlanetMark({ node }: { node: StageNode }): JSX.Element {
  return <span className={`stage-planet stage-planet-${node.state}`} aria-hidden="true" />;
}

const STATE_WORD: Record<StageNode["state"], string> = {
  locked: "Locked",
  available: "Available",
  in_progress: "In progress",
  mastered: "Mastered",
};

export function StageList({
  data,
  onOpen,
}: {
  data: StageMapData;
  onOpen: (stageId: string) => void;
}): JSX.Element {
  // Curriculum order, so tabbing through walks the syllabus.
  const ordered = [...data.nodes].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <ol className="stage-list">
      {ordered.map((n) => (
        <li key={n.id} className={`stage-row stage-row-${n.state}`}>
          <button type="button" className="stage-row-btn" onClick={() => onOpen(n.id)}>
            <PlanetMark node={n} />

            <span className="stage-row-main">
              <span className="stage-row-head">
                <span className="mono stage-row-id">{n.id}</span>
                <span className="stage-row-title">{n.title}</span>
                <span className={`stage-row-state stage-row-state-${n.state}`}>
                  {STATE_WORD[n.state]}
                  {n.state === "in_progress" && (
                    <span className="mono"> {Math.round(n.mastery * 100)}%</span>
                  )}
                </span>
              </span>

              <ProgressBar node={n} />

              {/* Printed, always. Never a tooltip, never behind a hover. */}
              {n.state === "locked" && n.lockReason && (
                <span className="stage-row-lock">{n.lockReason.message}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
