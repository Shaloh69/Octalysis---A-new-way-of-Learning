import { useEffect, useRef } from "react";
import type { StageNode } from "../lib/api";
import { encounterFor } from "../lib/encounters";

/**
 * The planet HUD — what a click on a planet actually produces.
 *
 * `SOLAR-SYSTEM-SPEC.md` §2, which replaced the galaxy's "star dialog": signs
 * and compact labels instead of a modal wall of text, but with the two or three
 * genuinely load-bearing facts still printed in full.
 *
 * THE RULE THIS FILE EXISTS TO HOLD, because R0 caught it being broken once
 * already: **the lock reason is always printed, in text, next to the icon.**
 * The first draft of §2 moved it to a hover tooltip on the padlock. Three
 * separate documents forbid that — `DESIGN-MANDATE.md` §1 ("every lock states
 * its reason and the distance"), `SKILL-TREE-3D.md` §4, `PAGE-SPECS.md` §5 —
 * and the mandate calls a lock with no visible reason "the single most
 * demotivating UI element in ed-tech". It also had no story for touch devices
 * between 641px and 1024px, which stay on `/app` and have no hover at all.
 * Icons are additive here. They never gate the words.
 *
 * A SIDEBAR, NOT A MODAL, and that distinction is the whole design.
 *
 * It slides in from the right and the map stays live behind it: the camera has
 * just flown to the planet, its moons are rendered around it, and the point is
 * to look at both at once. A modal would dim the thing it is describing.
 *
 * That changes three behaviours from the modal it replaces:
 *   - **No `aria-modal`, no focus trap.** The map behind stays operable, and
 *     trapping focus in a panel that does not own the screen is a lie to a
 *     screen reader about what is reachable.
 *   - Escape still closes it, because a panel that opened on a click should
 *     close on the key everyone tries.
 *   - The scene keeps drifting; only the camera holds on the planet.
 *
 * `SOLAR-SYSTEM-SPEC.md` §2's substance is unchanged — the Act chip, the state
 * icon beside printed words, the lock reason printed in full, prerequisites
 * named, one Enter button. What moved is the container.
 *
 * MOONS ARE SELECTABLE HERE. §5's focused tier says a planet's own moons become
 * individually pickable once its HUD is open; this is where they are picked.
 * The scene highlights whichever is selected.
 */

/** Roman numerals, deliberately — see the Act chip note below. */
const ROMAN = ["", "I", "II", "III", "IV"] as const;

const STATE_LABEL: Record<StageNode["state"], string> = {
  locked: "Locked",
  available: "Available",
  in_progress: "In progress",
  mastered: "Mastered",
};

/**
 * A shape per state, not a colour per state.
 *
 * Colour is never the only signal (`SKILL-TREE-3D.md` §7): locked and unlocked
 * differ in shape and in label as well, which is what makes this readable for a
 * colour-blind student and in the phosphor theme.
 */
const STATE_GLYPH: Record<StageNode["state"], string> = {
  locked: "▲",
  available: "◆",
  in_progress: "◗",
  mastered: "●",
};

interface Props {
  readonly node: StageNode;
  /** Named prerequisites, resolved to titles by the caller. */
  readonly prereqs: readonly StageNode[];
  /** The selected moon's objective id, or null. Highlighted in the scene. */
  readonly selectedMoon: string | null;
  readonly onSelectMoon: (objectiveId: string | null) => void;
  readonly onEnter: (stageId: string) => void;
  readonly onClose: () => void;
}

export function PlanetHud({
  node,
  prereqs,
  selectedMoon,
  onSelectMoon,
  onEnter,
  onClose,
}: Props): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);

  // Focus moves into the HUD on open and Escape closes it. Focus returning to
  // the planet button is handled by the caller, which owns that ref.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const focusable = el.querySelector<HTMLElement>("button, [href], [tabindex]");
    focusable?.focus();

    /*
     * Escape closes. Tab is NOT trapped.
     *
     * The modal version trapped focus, which was right for a modal and is wrong
     * here: this panel does not own the screen, the map behind it stays
     * operable, and trapping focus would tell a screen-reader user that nothing
     * else is reachable when everything still is.
     */
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [onClose]);

  const locked = node.state === "locked";
  const objectives = node.objectives.length;

  return (
    <aside
      className="hud"
      role="complementary"
      aria-labelledby="hud-title"
      ref={panel}
      // Themed with the stage's own encounter theme -- GAME-DESIGN.md §9,
      // untouched by this redesign. Theatre dresses the map and the practice;
      // it never dresses an assessment.
      data-encounter={encounterFor(node.id)}
    >
      <div className="hud-head">
        {/*
          The Act chip. A ROMAN NUMERAL, not a name, and that is a deliberate
          dodge: DESIGN-REVIEW-01's D-3 is still open — StageMap rendered the
          superseded narrative act names, `stages.act` groups differently again,
          and CLAUDE.md names a third grouping (Prelim/Midterm/Semis/Finals).
          Three sources, three answers. A numeral is true under all three;
          printing "Prelim" over a group containing chapter 05 would be a worse
          error than a stale name, because a student would believe it.
        */}
        <span className="hud-act" title={`Act ${ROMAN[node.act] ?? node.act}`}>
          {ROMAN[node.act] ?? node.act}
        </span>
        <p className="hud-eyebrow mono">Stage {node.id}</p>
        <h2 id="hud-title">{node.title}</h2>
      </div>

      {/* State: icon AND the word, always both, never the icon alone. */}
      <p className={`hud-state hud-state-${node.state}`}>
        <span aria-hidden="true" className="hud-glyph">{STATE_GLYPH[node.state]}</span>
        <span>{STATE_LABEL[node.state]}</span>
        {node.state === "in_progress" && (
          <span className="mono hud-pct">{Math.round(node.mastery * 100)}%</span>
        )}
      </p>

      {/* The lock reason, printed. Not a tooltip. See this file's header. */}
      {locked && node.lockReason && (
        <p className="hud-lock-reason">{node.lockReason.message}</p>
      )}

      {/* One still-printed summary line, with a pictogram beside it rather
          than instead of it. */}
      {node.summary && (
        <p className="hud-summary">
          <span aria-hidden="true" className="hud-pictogram" />
          {node.summary}
        </p>
      )}

      {/*
        Subtopic dots. The COUNT is real — it comes from `objectives` on the map
        payload. Per-dot lighting is not, and is deliberately not faked: there is
        no per-objective mastery anywhere in the API today. `/api/v1/progress`
        aggregates by (level, competency), not per objective, so "lit = mastered"
        has no data behind it yet. That arrives with R4, which is the moons
        phase and the right place for it. Showing the count honestly beats
        lighting dots from stage mastery, which would be inventing per-objective
        state out of an average.
      */}
      {objectives > 0 && (
        <div className="hud-moons">
          <p className="hud-moons-head">
            <span className="mono">{objectives}</span> subtopics — the moons
            around this planet
          </p>
          <ul className="hud-moon-list">
            {node.objectives.map((o) => {
              const on = selectedMoon === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`hud-moon${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    // Selecting highlights that moon in the scene. Selecting it
                    // again clears, so the control is its own undo -- the
                    // mandate's reversibility test, satisfied by the same press.
                    onClick={() => onSelectMoon(on ? null : o.id)}
                  >
                    <span className="hud-dot" aria-hidden="true" />
                    <span className="mono hud-moon-id">{o.id}</span>
                    <span className="hud-moon-level">L{o.level}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Prerequisites, NAMED in text. The traced line in the scene is
          additive: a line alone fails a screen reader, and fails anyone who
          cannot easily follow a thin stroke across a busy field. */}
      {prereqs.length > 0 && (
        <p className="hud-prereq">
          Needs{" "}
          {prereqs.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <span className="mono">{p.id}</span> {p.title}
            </span>
          ))}
        </p>
      )}

      <div className="hud-actions">
        {/* One button. Nothing to enter when locked -- the padlock and the
            printed reason already said so, and a disabled "Enter" that does
            nothing would fail the mandate's consequence test. */}
        {!locked && (
          <button type="button" className="hud-enter" onClick={() => onEnter(node.id)}>
            Enter
          </button>
        )}
        <button type="button" className="hud-close" onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );
}
