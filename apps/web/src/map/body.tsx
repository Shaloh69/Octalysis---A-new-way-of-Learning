import { useEffect, useState, type ReactNode } from "react";
import type { StageNode } from "../lib/api";
import { ACT_NAMES } from "../lib/acts";
import { LEVEL_NAMES } from "../solar-system/layout";
import { NumberedTitle } from "../shell/MissionPanel";
import { WarpLink } from "../shell/RealmWarp";
import { byObjectiveId } from "./useSelection";

/**
 * One stage, described once: the BODY card the map shows for a selected
 * planet, and the same card `/app/stages` shows for a selected row. Two
 * routes, one description, so the map and the list cannot disagree about a
 * stage's state, its lock or its moons.
 */

/** The grading periods: names from lib/acts.ts, the one source (instructor ruling). */
const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
export const ACTS: Record<number, { roman: string; name: string }> = Object.fromEntries(
  Object.entries(ACT_NAMES).map(([k, name]) => [k, { roman: ROMAN[Number(k)] ?? k, name }]),
);
export const ARCHETYPES: Record<string, string> = { A: "Concept", B: "Computation", C: "Artifact", D: "Simulator" };
export const STATE_WORD: Record<StageNode["state"], string> = {
  locked: "Locked",
  available: "Open",
  in_progress: "In progress",
  mastered: "Mastered",
};

export function useWide(min: number): boolean {
  const q = `(min-width: ${min}px)`;
  const [w, setW] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setW(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [q]);
  return w;
}

export function levelSpan(levels: readonly number[]): string {
  const l = [...levels].sort((a, b) => a - b);
  return l.length === 0 ? "—" : l.length === 1 ? `L${l[0]}` : `L${l[0]}–L${l[l.length - 1]}`;
}

export function BodyPanel({
  node,
  byId,
  onShow,
  enterTo,
  extra,
}: {
  node: StageNode;
  byId: Map<string, StageNode>;
  onShow: (id: string) => void;
  enterTo: string | null;
  /** More actions after the page's own (the stages list adds Show on the map). */
  extra?: ReactNode;
}): JSX.Element {
  const pct = Math.round(node.mastery * 100);
  const levels = [...node.levels].sort((a, b) => a - b);
  const blocking = node.lockReason?.blockingStages[0];
  const moons = [...node.objectives].sort(byObjectiveId);
  return (
    <div className="starmap-body-main">
      <div className="starmap-survey">
        <span className="starmap-survey-label">
          <span>{node.gradeable ? "Mastery" : "Not graded"}</span>
          {node.gradeable && <span className="mono">{pct}%</span>}
        </span>
        {node.gradeable && (
          <span className="starmap-meter" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>

      <dl className="starmap-stats">
        <div>
          <dt>State</dt>
          <dd>
            {node.state === "locked" && <LockGlyph />}
            {STATE_WORD[node.state]}
          </dd>
        </div>
        <div>
          <dt>Levels</dt>
          <dd className="mono" title={levels.map((l) => LEVEL_NAMES[l]).join(", ")}>
            {levelSpan(levels)}
          </dd>
        </div>
        <div>
          <dt>Kind</dt>
          <dd>{ARCHETYPES[node.archetype] ?? node.archetype}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            <span className="mono">{node.estMinutes}</span> min
          </dd>
        </div>
        <div>
          <dt>Check</dt>
          <dd>{node.gradeable ? "Graded" : "Not graded"}</dd>
        </div>
      </dl>

      {node.state === "locked" && node.lockReason && (
        <p className="starmap-lock">
          <LockGlyph />
          <span>{node.lockReason.message}</span>
        </p>
      )}
      {node.summary && <p className="starmap-summary">{node.summary}</p>}

      <h3 className="starmap-moons-title">
        Moons <span className="mono">({moons.length})</span>
      </h3>
      {moons.length > 0 ? (
        <ul className="starmap-moons">
          {moons.map((m) => (
            <li key={m.id}>
              <span className="mono">{m.id}</span>
              <span>{m.description}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">No objectives are published for this stage yet.</p>
      )}

      <div className="starmap-actions">
        {enterTo ? (
          <WarpLink className="button hud-button button-primary" to={enterTo}>
            Enter journey
          </WarpLink>
        ) : blocking && byId.has(blocking) ? (
          <button type="button" className="button hud-button" onClick={() => onShow(blocking)}>
            <NumberedTitle text={`Show Stage ${blocking}`} />
          </button>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

export function LockGlyph(): JSX.Element {
  return (
    <svg className="glyph" aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="7" width="11" height="7.5" rx="1" fill="currentColor" />
    </svg>
  );
}
