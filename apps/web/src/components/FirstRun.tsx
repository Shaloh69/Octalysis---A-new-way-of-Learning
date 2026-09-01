import { useState } from "react";

/**
 * The first-run tour of the map.
 *
 * `DESIGN-MANDATE.md` §2 governs this and is strict about the shape:
 *
 *   > Every new interaction gets a **30-second first-run**, once, at the moment
 *   > of first use. **Never a tour, never a modal carousel at signup.**
 *
 * So this is deliberately not a product tour. It does not dim the page, does
 * not trap focus, does not step you through five screens before letting you in,
 * and does not appear at registration. It is a small panel on the map, on the
 * first visit only, saying what the three things on screen mean — and it is
 * dismissible from the first frame.
 *
 * ══ THE COPY BELOW IS A PLACEHOLDER. IT IS NOT FINAL CONTENT. ══
 *
 * The structure, timing, dismissal and accessibility behaviour are real and
 * built. The WORDS are scaffolding, and they are labelled as such on screen so
 * nobody — a student in a pilot, a reviewer, the instructor — mistakes
 * unreviewed prose for the real thing.
 *
 * Root `CLAUDE.md` hard rule 5: **never invent course content.** Stage prose,
 * figures and definitions come from `docs/source/*.md` or the database, and if
 * content is missing the honest move is to say so rather than write something
 * plausible. A first-run tour is closer to UI chrome than to course material,
 * but it is still the first paragraphs a student reads in this app, and it was
 * written by nobody who teaches the course.
 *
 * TO REPLACE THIS: write the real copy, delete the `PLACEHOLDER` flag below and
 * the disclaimer it renders, and drop the steps in. Nothing else changes.
 *
 * One constraint the real copy inherits: **it must not name the rings.**
 * `SKILL-TREE-3D.md` §2 keeps the level hierarchy unlabelled until Stage 11 —
 * ten weeks of unexplained descent is the setup for that reveal, and a
 * tutorial that names them in week one would spend it. The same withholding
 * already applies to the Register Bar and the Depth Gauge.
 *
 * Dismissal is remembered per device. Nothing here is gradeable, so
 * `localStorage` is the right home for it (`apps/web/CLAUDE.md` bans it only
 * for anything that affects a grade).
 *
 * IT CAN BE REPLAYED. Once dismissed the panel is replaced, in the same slot,
 * by a `?` button that plays it again from step one. This is what makes "Skip"
 * honest: a student can leave immediately, on the first frame, without the
 * quiet cost of never being able to get the explanation back. Without a way
 * back, the only safe move is to read a tutorial you do not want, which is how
 * a courtesy turns into an obstacle.
 *
 * The button sits in the panel's own slot rather than floating over a corner,
 * so replaying does not shift the page and the control keeps a sane position in
 * the tab order.
 *
 * Replaying does NOT clear the seen flag: the student asked to see it once
 * more, not to be greeted by it again on their next visit.
 */

const SEEN = "octa:first-run-map";

/**
 * Flip to `false` when real copy lands, and delete the disclaimer it renders.
 * Kept as an explicit flag rather than inferred from the text, so removing the
 * placeholder is a deliberate act rather than something that happens by
 * accident when someone edits a string.
 */
const PLACEHOLDER = true;

/**
 * Placeholder steps.
 *
 * Each names the SUBJECT the real step should cover, so whoever writes it knows
 * what slot they are filling — but none of them assert anything about the
 * course. Three steps is the shape, not a requirement.
 */
const STEPS = [
  {
    title: "Placeholder — what the sun is",
    body: "Copy not written yet. This step will explain what sits at the centre of the map and why the whole course points at it.",
  },
  {
    title: "Placeholder — what distance means",
    body: "Copy not written yet. This step will explain what a planet's distance from the centre encodes. It must not name the levels: that reveal belongs to Stage 11.",
  },
  {
    title: "Placeholder — how the map fills in",
    body: "Copy not written yet. This step will explain that stages appear as they are reached, and where to find the full list of all nineteen.",
  },
] as const;

export function FirstRun(): JSX.Element | null {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(SEEN) === "1";
    } catch {
      // Private window: show it. Being told twice is better than never.
      return false;
    }
  });

  const finish = (): void => {
    setDone(true);
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* private window; it will greet them again next time */
    }
  };

  if (done) {
    return (
      <button
        type="button"
        className="first-run-replay"
        /*
         * A `?` alone is a glyph, not a name. The accessible name says what
         * pressing it does, and `title` gives sighted users the same sentence
         * on hover -- an icon-only control that only reads as "?" to a screen
         * reader is a control nobody can decide about.
         */
        aria-label="Show the map explanation again"
        title="Show the map explanation again"
        onClick={() => {
          setStep(0); // always from the beginning, never mid-sequence
          setDone(false);
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
    );
  }

  const current = STEPS[step];
  if (!current) return null;

  const last = step === STEPS.length - 1;

  return (
    // `role="note"`, not `dialog`: it is not modal and must not trap focus. A
    // student who ignores it entirely can use the whole page around it.
    <aside className="first-run" role="note" aria-label="About this map">
      {PLACEHOLDER && (
        // Said plainly, on screen, not only in a comment. A student in a pilot
        // should be able to tell scaffolding from the real thing without
        // reading the source.
        <p className="first-run-placeholder">
          Placeholder text — not real course content yet
        </p>
      )}

      <p className="first-run-step mono">
        {step + 1} / {STEPS.length}
      </p>
      <h2 className="first-run-title">{current.title}</h2>
      <p className="first-run-body">{current.body}</p>

      <div className="first-run-actions">
        <button type="button" className="first-run-skip" onClick={finish}>
          {/* Available from the first frame. A tour you cannot leave is a
              tour that has stopped being a courtesy. */}
          Skip
        </button>
        <button
          type="button"
          className="first-run-next"
          onClick={() => (last ? finish() : setStep((n) => n + 1))}
        >
          {last ? "Got it" : "Next"}
        </button>
      </div>
    </aside>
  );
}
