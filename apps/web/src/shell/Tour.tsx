import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * The first-run tour (8 Oct 2026; design/templates/web/tutorial/SPEC.md).
 *
 * Driver.js's shape, built by hand because the repo adds no UI library: the page
 * dims, the thing being explained is cut out of the dimness, and a popover says
 * what it is, with "n of N", Previous, Next and Skip. It runs once on a
 * student's first visit to the star system and again whenever they press the ?
 * in the top strip.
 *
 * It explains where things are, and never course content: every line here
 * describes the app. It lives in the star shell only. A stage check, a moon's
 * journey and an exam paper (hard rule 9) are BiomeShell routes, which have no
 * tour, no ? and no shortcut off them.
 *
 * Accessibility: the popover is a dialog that takes focus, Left and Right step,
 * Escape closes, Tab stays inside it, and focus returns to where it was. A
 * target that is not on screen (the tab bar at another width) is skipped to a
 * centred step rather than pointing at nothing. Reduced motion: it cuts.
 */

export interface TourStep {
  /** `data-tour` value of the element to explain; none: a centred step. */
  readonly target?: string;
  readonly title: string;
  readonly text: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: "Welcome to OCTA",
    text: "This is CPE 412, one chapter per planet. Here is where everything is. It takes under a minute, and the ? at the top brings it back whenever you want it.",
  },
  {
    target: "map",
    title: "The map",
    text: "Every planet is a chapter. Open one to read it, work through its moons and sit its check. A locked planet says what opens it.",
  },
  {
    target: "stages",
    title: "Stages",
    text: "The same chapters as a list, grouped by grading period, with where you stand in each.",
  },
  {
    target: "progress",
    title: "Progress",
    text: "How deep you have gone, and what you can read, trace and build, worked out from your own answers.",
  },
  {
    target: "work",
    title: "Your work",
    text: "Where you hand in labs and your project, and see what has been marked.",
  },
  {
    target: "chat",
    title: "Chat",
    text: "Your section's room, and a private line to your instructor. Chat closes while you have a paper open.",
  },
  {
    target: "settings",
    title: "Settings",
    text: "Your accent colour and the keyboard shortcuts, which you can turn off.",
  },
  {
    target: "profile",
    title: "Your profile",
    text: "Your picture, name and classes. Your classmates and your teachers see your picture.",
  },
  {
    target: "help",
    title: "The ? is always here",
    text: "Press it any time to see this tour again.",
  },
];

interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const PAD = 6; // breathing room around the spotlight
const GAP = 12; // between the spotlight and the popover
const EDGE = 8; // the popover never touches the screen's edge

/** The target's box, or null if it is not drawn (display: none, or off screen). */
function boxOf(target: string | undefined): Box | null {
  if (!target) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tour({ onClose }: { onClose: () => void }): JSX.Element {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [size, setSize] = useState({ w: 320, h: 180 });
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const pop = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const was = useRef<Element | null>(document.activeElement);
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  const step = TOUR_STEPS[i]!;
  const last = i === TOUR_STEPS.length - 1;

  const measure = useCallback(() => {
    setBox(boxOf(step.target));
    setView({ w: window.innerWidth, h: window.innerHeight });
    const p = pop.current?.getBoundingClientRect();
    if (p) setSize({ w: p.width, h: p.height });
  }, [step.target]);

  // Measure before paint so a step never flashes in the wrong place.
  useLayoutEffect(() => {
    measure();
  }, [measure, i]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // While the tour runs the rest of the page is inert: not focusable, not clickable and
  // out of the accessibility tree, so Tab and a screen reader's cursor stay with the
  // popover. (The spotlit control is still drawn; it is just not pressable until the
  // tour ends.)
  useEffect(() => {
    const parent = root.current?.parentElement;
    if (!parent) return;
    const held = [...parent.children].filter((c) => c !== root.current && !c.hasAttribute("inert"));
    for (const c of held) c.setAttribute("inert", "");
    return () => {
      for (const c of held) c.removeAttribute("inert");
    };
  }, []);

  // Focus the primary button on each step (Enter advances), and give focus back on close.
  useEffect(() => next.current?.focus(), [i]);
  useEffect(() => {
    const back = was.current;
    return () => {
      // Where focus was; or, if the tour started by itself and nothing had it, the ?
      // that brings the tour back, so the next Tab is somewhere sensible.
      const to =
        back instanceof HTMLElement && back !== document.body && document.contains(back)
          ? back
          : document.querySelector<HTMLElement>('[data-tour="help"]');
      to?.focus();
    };
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!last) setI(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (i > 0) setI(i - 1);
    } else if (e.key === "Tab") {
      // The popover is the only thing that takes focus while the tour runs.
      const stops = [...(pop.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
      if (stops.length === 0) return;
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const to = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : at === stops.length - 1 ? 0 : at + 1;
      e.preventDefault();
      stops[to]!.focus();
    }
  };

  // Where the popover sits: beside its target, on whichever side has room, kept on screen.
  const width = Math.min(320, view.w - EDGE * 2);
  let top: number;
  let left: number;
  let place: "above" | "below" | "center" = "center";
  if (box) {
    const room = view.h - (box.top + box.height + PAD + GAP);
    place = room >= size.h + EDGE || box.top < size.h + GAP + PAD + EDGE ? "below" : "above";
    top = place === "below" ? box.top + box.height + PAD + GAP : box.top - PAD - GAP - size.h;
    left = Math.min(Math.max(box.left + box.width / 2 - width / 2, EDGE), view.w - width - EDGE);
  } else {
    top = Math.max(EDGE, (view.h - size.h) / 2);
    left = Math.max(EDGE, (view.w - width) / 2);
  }
  // The little arrow points at the middle of the target, wherever the popover was clamped to.
  const arrowX = box ? Math.min(Math.max(box.left + box.width / 2 - left, 16), width - 16) : 0;

  return (
    <div ref={root} className="tour" data-tour-root="" onKeyDown={onKey}>
      {/* Blocks the page behind it, so a stray click cannot navigate away mid-tour. */}
      <div className="tour-shield" aria-hidden="true" />
      {box && (
        <div
          className="tour-spot"
          aria-hidden="true"
          style={{ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }}
        />
      )}
      {!box && <div className="tour-dim" aria-hidden="true" />}
      <div
        ref={pop}
        className="tour-pop hud-panel"
        data-place={place}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        style={{ top, left, width, ["--tour-arrow-x" as string]: `${arrowX}px` }}
      >
        <div className="tour-head">
          <p className="tour-count">
            <span className="mono">{i + 1}</span> of <span className="mono">{TOUR_STEPS.length}</span>
          </p>
          {!last && (
            <button type="button" className="tour-skip" onClick={onClose}>
              Skip the tour
            </button>
          )}
        </div>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        <p id={textId} className="tour-text">
          {step.text}
        </p>
        <div className="tour-actions">
          <span className="tour-spacer" />
          {i > 0 && (
            <button type="button" className="hud-button" onClick={() => setI(i - 1)}>
              Previous
            </button>
          )}
          <button
            ref={next}
            type="button"
            className="hud-button button-primary"
            onClick={() => (last ? onClose() : setI(i + 1))}
          >
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
