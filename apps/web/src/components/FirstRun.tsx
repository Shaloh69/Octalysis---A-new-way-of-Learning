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
 * The content is the map's own spatial grammar, which is the one thing a
 * student cannot infer by looking: that distance from the sun is depth into the
 * machine. Everything else on the page explains itself.
 *
 * WHAT IT DOES NOT SAY: what the rings are called. `SKILL-TREE-3D.md` §2 keeps
 * the level hierarchy unlabelled until Stage 11 — ten weeks of unexplained
 * descent is the setup for that reveal, and a tutorial that names them in week
 * one would spend it. The same withholding already applies to the Register Bar
 * and the Depth Gauge.
 *
 * Dismissal is remembered per device. Nothing here is gradeable, so
 * `localStorage` is the right home for it (`apps/web/CLAUDE.md` bans it only
 * for anything that affects a grade).
 */

const SEEN = "octa:first-run-map";

const STEPS = [
  {
    title: "The sun is the machine",
    body: "Everything on this map orbits it. The whole course is a descent toward the hardware, and the sun is where you are heading.",
  },
  {
    title: "Closer in means deeper down",
    body: "A planet's distance from the sun is how far into the machine that chapter goes. Nothing here is decoration — every position comes from the syllabus.",
  },
  {
    title: "Planets form as you reach them",
    body: "Only the stages you have reached have a body yet. Click one to see what it covers, and what it needs first. The full list is always on the Stages page.",
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

  if (done) return null;
  const current = STEPS[step];
  if (!current) return null;

  const last = step === STEPS.length - 1;

  return (
    // `role="note"`, not `dialog`: it is not modal and must not trap focus. A
    // student who ignores it entirely can use the whole page around it.
    <aside className="first-run" role="note" aria-label="About this map">
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
