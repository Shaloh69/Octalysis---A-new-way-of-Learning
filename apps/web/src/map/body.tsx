import { useEffect, useState, type ReactNode } from "react";
import type { MoonFacts, StageNode } from "../lib/api";
import { ACT_NAMES } from "../lib/acts";
import { LEVEL_NAMES } from "../solar-system/layout";
import { NumberedTitle } from "../shell/MissionPanel";
import { WarpLink } from "../shell/RealmWarp";
import { byObjectiveId } from "./useSelection";
import { encounterForMoon } from "../encounters/registry";

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

/*
 * A moon's state, one level down from a planet's (SOLAR-SYSTEM-SPEC 1.4, R4.2):
 * dim until a question of it is right, a partial glow at one, full at mastery.
 * Every fact is the server's (`MoonFacts`); this only names and draws it.
 */
export type MoonGlow = "dim" | "partial" | "full";
export function moonGlow(m: MoonFacts): MoonGlow {
  return m.mastered ? "full" : m.correct > 0 ? "partial" : "dim";
}

/** A moon's mastery in words (3.2 item 2). Numbers in mono. */
export function MoonState({ moon }: { moon: MoonFacts }): JSX.Element {
  if (moon.mastered) return <>Mastered</>;
  if (moon.questions === 0) return <>No questions yet</>;
  if (moon.correct === 0) return <>Not started</>;
  return (
    <>
      <span className="mono">{moon.correct}</span> of <span className="mono">{moon.questions}</span> right
    </>
  );
}

/** The state as a shape, so it never rests on a colour: empty, half, full. */
export function MoonGlyph({ glow }: { glow: MoonGlow }): JSX.Element {
  return (
    <svg className="glyph starmap-moon-glyph" data-glow={glow} aria-hidden="true" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {glow === "partial" && <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />}
      {glow === "full" && <circle cx="8" cy="8" r="6" fill="currentColor" />}
    </svg>
  );
}

export function BodyPanel({
  node,
  byId,
  onShow,
  onMoon,
  enterTo,
  extra,
}: {
  node: StageNode;
  byId: Map<string, StageNode>;
  onShow: (id: string) => void;
  /** Choose a moon (the map); without it the moons are listed, not chosen. */
  onMoon?: (id: string) => void;
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

      {node.moons ? (
        <>
          <h3 className="starmap-moons-title">
            Moons <span className="mono">({moons.length})</span>
          </h3>
          {/* 3.1 item 6: what opens the next planet (3.7), in the server's count. */}
          <p className="starmap-moons-count" data-moons-mastered="">
            <span className="mono">{node.moons.mastered}</span> of <span className="mono">{node.moons.total}</span>{" "}
            subtopics mastered
          </p>
          {moons.length > 0 ? (
            <ul className="starmap-moons">
              {moons.map((m) => {
                const glow = moonGlow(m);
                const inner = (
                  <>
                    <MoonGlyph glow={glow} />
                    <span className="mono starmap-moon-id">{m.id}</span>
                    <span className="starmap-moon-text">{m.description}</span>
                    <span className="starmap-moon-state">
                      <MoonState moon={m} />
                    </span>
                  </>
                );
                return (
                  <li key={m.id} data-glow={glow}>
                    {onMoon ? (
                      <button type="button" className="starmap-moon" onClick={() => onMoon(m.id)}>
                        {inner}
                      </button>
                    ) : (
                      <span className="starmap-moon">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="note">No objectives are published for this stage yet.</p>
          )}
        </>
      ) : (
        <>
          {/* Orientation (decided 25 Sep 2026): no moons, its objectives as text. */}
          <h3 className="starmap-moons-title">Objectives</h3>
          <p className="note">Not graded, so no moons: it never holds the next planet shut.</p>
          <ul className="starmap-moons">
            {moons.map((m) => (
              <li key={m.id}>
                <span className="starmap-moon">
                  <span className="mono starmap-moon-id">{m.id}</span>
                  <span className="starmap-moon-text">{m.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
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

/**
 * A moon, chosen (WEB-REVAMP 3.2): the panel updates in place to it. Its
 * objective in the syllabus's words, its mastery in words, the planet it
 * circles with a way back, and Enter journey into practice on its own
 * questions. Enter is disabled, with the reason beside it, when the planet is
 * locked (the server's sentence, verbatim) or the moon has no questions yet
 * (fail-closed, 3.7a). Its minigame is named when it has one (3.2 item 3;
 * placements approved 30 Sep 2026, `encounters/registry.ts`).
 */
export function MoonPanel({
  node,
  moon,
  enterTo,
  onBack,
}: {
  node: StageNode;
  moon: StageNode["objectives"][number];
  enterTo: string | null;
  onBack: () => void;
}): JSX.Element {
  const glow = moonGlow(moon);
  const game = encounterForMoon(moon.id);
  const why =
    node.state === "locked"
      ? node.lockReason?.message ?? "This planet is locked."
      : moon.questions === 0 && !moon.mastered
        ? "This moon has no questions yet."
        : null;
  return (
    <div className="starmap-body-main" data-moon={moon.id}>
      <p className="starmap-moon-objective">{moon.description}</p>

      <div className="starmap-survey">
        <span className="starmap-survey-label">
          <span>Mastery</span>
          <span className="starmap-moon-now" data-glow={glow}>
            <MoonGlyph glow={glow} />
            <MoonState moon={moon} />
          </span>
        </span>
      </div>

      {game && (
        <p className="starmap-moon-game" data-moon-game="">
          <span className="starmap-survey-label">Minigame</span>
          <span>
            {game.name}, a {game.kind.toLowerCase()} beside its questions
          </span>
        </p>
      )}

      {why && (
        <p className="starmap-lock" id={`moon-why-${moon.id}`}>
          <LockGlyph />
          <span>{why}</span>
        </p>
      )}

      {/* The action first, where a short screen still shows it; then the rule. */}
      <div className="starmap-actions is-stacked">
        {enterTo && !why ? (
          <WarpLink className="button hud-button button-primary" to={enterTo}>
            Enter journey
          </WarpLink>
        ) : (
          <button
            type="button"
            className="button hud-button button-primary"
            disabled
            aria-describedby={`moon-why-${moon.id}`}
          >
            Enter journey
          </button>
        )}
        <button type="button" className="button hud-button" onClick={onBack}>
          <NumberedTitle text={`Back to Stage ${node.id}`} />
        </button>
      </div>

      <p className="starmap-moon-rule">
        Practice, never graded. Two different questions right master this moon (it has{" "}
        <span className="mono">{moon.questions}</span>); every moon of this planet mastered opens the next one.
      </p>
    </div>
  );
}
