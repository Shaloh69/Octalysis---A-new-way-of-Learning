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

const ROMAN = ["", "I", "II", "III", "IV"] as const;

/**
 * The four grading periods, as headings — WITHOUT naming them.
 *
 * This is where the act text went when it left the map. The map now draws;
 * this page reads. But the heading is a Roman numeral and a stage range, never
 * "Prelim" or "Midterm", and that is a deliberate dodge rather than an
 * oversight: **three sources give three different groupings.** `stages.act`
 * groups 00–05 / 06–09 / 10–13 / 14–18, root `CLAUDE.md` says Prelim 1–4 /
 * Midterm 5–8 / Semis 9–12 / Finals 13–17, and the superseded `StageMap`
 * rendered narrative act names that match neither.
 *
 * See `DESIGN-REVIEW-01.md` D-3 and `PROGRESS.md` F-7 — still the instructor's
 * call, and unchanged by this page. Printing "Prelim" over a group that
 * contains chapter 05 would be worse than printing nothing, because a student
 * would believe it and plan a review week around it. A numeral and the range
 * are true under all three readings.
 *
 * The range is stated in full so the grouping is checkable at a glance: if the
 * instructor's answer differs, the disagreement is visible rather than buried.
 */
function ActHead({ act, stages }: { act: number; stages: StageNode[] }): JSX.Element {
  const done = stages.filter((n) => n.state === "mastered").length;
  const first = stages[0]?.id ?? "";
  const last = stages[stages.length - 1]?.id ?? "";
  const pct = Math.round((stages.reduce((t, n) => t + n.mastery, 0) / stages.length) * 100);

  return (
    <div className="act-head">
      <span className="act-head-numeral" aria-hidden="true">{ROMAN[act] ?? act}</span>
      <span className="act-head-main">
        <span className="act-head-line">
          <span className="act-head-title">
            Act {ROMAN[act] ?? act}
            <span className="act-head-range mono"> · Stages {first}–{last}</span>
          </span>
          <span className="act-head-count mono">
            {done}/{stages.length} mastered
          </span>
        </span>
        {/* Mean mastery across the act. The bar is the fast read; the numbers
            beside it are the exact one, and neither is the only signal. */}
        <span className="stage-bar" aria-hidden="true">
          <span className="stage-bar-fill stage-bar-act" style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  );
}

export function StageList({
  data,
  onOpen,
}: {
  data: StageMapData;
  onOpen: (stageId: string) => void;
}): JSX.Element {
  // Curriculum order, so tabbing through walks the syllabus.
  const ordered = [...data.nodes].sort((a, b) => a.ordinal - b.ordinal);

  /*
   * Grouped by act, in curriculum order, WITHOUT reordering anything. The
   * grouping is presentational; `ordinal` still decides sequence, so focus
   * order continues to walk the syllabus exactly as it did when this was one
   * flat list.
   */
  const acts: Array<{ act: number; stages: StageNode[] }> = [];
  for (const n of ordered) {
    const tail = acts[acts.length - 1];
    if (tail && tail.act === n.act) tail.stages.push(n);
    else acts.push({ act: n.act, stages: [n] });
  }

  return (
    <div className="stage-acts">
      {acts.map((group) => (
        <section key={group.act} className="stage-act" aria-label={`Act ${ROMAN[group.act] ?? group.act}`}>
          <ActHead act={group.act} stages={group.stages} />
          <StageRows stages={group.stages} onOpen={onOpen} />
        </section>
      ))}
    </div>
  );
}

function StageRows({
  stages,
  onOpen,
}: {
  stages: StageNode[];
  onOpen: (stageId: string) => void;
}): JSX.Element {
  return (
    <ol className="stage-list">
      {stages.map((n) => (
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
