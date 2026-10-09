import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

/**
 * The console's first-run tour (9 Oct 2026; design/templates/console/tour/SPEC.md).
 *
 * The same tour the student app has (apps/web/src/shell/Tour.tsx; template
 * Driver.js running, `design/templates/web/tutorial/`), built by hand because the
 * repo adds no UI library, and dressed in the console's tokens: the page dims, the
 * thing being explained is cut out of the dimness, and a popover says what it is,
 * with "n of N", Previous, Next and Skip. It runs once per account on a teacher's
 * first visit (remembered in the database, `profiles.tour_seen_at`) and again
 * whenever they press the ? in the shell.
 *
 * It explains where things are, never course content. The projector view
 * (`/live/present`) has no shell and so no tour.
 *
 * Accessibility: the popover is a dialog that takes focus, Left and Right step,
 * Escape closes, Tab stays inside it, the rest of the page is `inert` while it
 * runs, and focus returns to where it was. A target that is not on screen is
 * skipped to a centred step rather than pointing at nothing. Reduced motion: it cuts.
 */

export interface TourStep {
  /** `data-tour` value of the element to explain; none: a centred step. */
  readonly target?: string;
  readonly title: string;
  readonly text: string;
  /** Shown to the admin only (the Teachers page is theirs). */
  readonly adminOnly?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: "Welcome to the OCTA console",
    text: "This is where you run CPE 412: who is in your classes, what they can open, and how they are doing. Here is where everything is. It takes under a minute, and the ? brings it back whenever you want it.",
  },
  {
    target: "nav-in-class",
    title: "In class",
    text: "Locks, Live and Chat: the three pages for when the room is in front of you. Open or close a stage for one student, watch what the room is doing, and talk to a section.",
  },
  {
    target: "nav-students",
    title: "Students",
    text: "The roster and each student's record, the labs and project waiting to be marked, and the gradebook.",
  },
  {
    target: "nav-course",
    title: "Course",
    text: "What a student can sit (Assessments), the question bank (Items), and the course's own material and its review (Studio).",
  },
  {
    target: "nav-records",
    title: "Records",
    text: "Who changed what and why, whether the system is healthy, what students reported, and what changed day by day.",
  },
  {
    target: "nav-teachers",
    adminOnly: true,
    title: "Teachers",
    text: "Yours alone as the admin: every teacher, their classes, and the teacher roster.",
  },
  {
    target: "account",
    title: "Your account",
    text: "Your profile and picture, the theme, and Sign out. Your students and the other staff see your picture; the admin can remove it.",
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

/** The target's box (the first one that is drawn), or null if none is on screen. */
function boxOf(target: string | undefined): Box | null {
  if (!target) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) continue;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

export function Tour({ admin, onClose }: { admin: boolean; onClose: () => void }): JSX.Element {
  const steps = TOUR_STEPS.filter((s) => !s.adminOnly || admin);
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
  const step = steps[i]!;
  const last = i === steps.length - 1;

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
  // out of the accessibility tree, so Tab and a screen reader's cursor stay with the popover.
  useEffect(() => {
    const parent = root.current?.parentElement;
    if (!parent) return;
    const held = [...parent.children].filter((c) => c !== root.current && !c.hasAttribute("inert"));
    for (const c of held) c.setAttribute("inert", "");
    return () => {
      for (const c of held) c.removeAttribute("inert");
    };
  }, []);

  // Escape closes it wherever focus is (a click on the dimness leaves focus on the page, not the popover).
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

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
          : [...document.querySelectorAll<HTMLElement>('[data-tour="help"]')].find((e) => e.getBoundingClientRect().width > 0);
      to?.focus();
    };
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
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
  const width = Math.min(340, view.w - EDGE * 2);
  let top: number;
  let left: number;
  let place: "above" | "below" | "right" | "center" = "center";
  if (box) {
    const roomRight = view.w - (box.left + box.width + PAD + GAP);
    if (roomRight >= width + EDGE && box.width < view.w / 2) {
      // Beside it (the nav is a column down the left edge).
      place = "right";
      left = box.left + box.width + PAD + GAP;
      top = Math.min(Math.max(box.top + box.height / 2 - size.h / 2, EDGE), Math.max(EDGE, view.h - size.h - EDGE));
    } else {
      const room = view.h - (box.top + box.height + PAD + GAP);
      place = room >= size.h + EDGE || box.top < size.h + GAP + PAD + EDGE ? "below" : "above";
      top = place === "below" ? box.top + box.height + PAD + GAP : box.top - PAD - GAP - size.h;
      left = Math.min(Math.max(box.left + box.width / 2 - width / 2, EDGE), view.w - width - EDGE);
    }
  } else {
    top = Math.max(EDGE, (view.h - size.h) / 2);
    left = Math.max(EDGE, (view.w - width) / 2);
  }
  // The little arrow points at the middle of the target, wherever the popover was clamped to.
  const arrowX = box && place !== "right" ? Math.min(Math.max(box.left + box.width / 2 - left, 16), width - 16) : 0;
  const arrowY = box && place === "right" ? Math.min(Math.max(box.top + box.height / 2 - top, 16), size.h - 16) : 0;

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
        className="tour-pop"
        data-place={place}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        style={{ top, left, width, ["--tour-arrow-x" as string]: `${arrowX}px`, ["--tour-arrow-y" as string]: `${arrowY}px` }}
      >
        <div className="tour-head">
          <p className="tour-count">
            <span className="num">{i + 1}</span> of <span className="num">{steps.length}</span>
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
            <Button variant="outline" onClick={() => setI(i - 1)}>
              Previous
            </Button>
          )}
          <Button ref={next} onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
