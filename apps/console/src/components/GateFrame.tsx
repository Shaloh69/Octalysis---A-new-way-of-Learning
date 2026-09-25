import { useEffect, useRef, useState } from "react";
import { Backdrop } from "@/components/Backdrop";
import { cn } from "@/lib/utils";

/**
 * The console's gate: the frame every screen in front of the console wears.
 *
 * Three screens use it, because all three are the same gate
 * (`design/templates/console/signin/SPEC.md`): the sign-in, the "this is a
 * student account" screen, and the forced credential change. Until 25 Sep 2026
 * only the first had a frame; the other two were bare columns rendered from
 * `AppShell`, looking like a different product from the page in front of them.
 *
 * LAYOUT, from shadcn-admin's split auth block (`template.png`): the task in
 * the left half, a panel of its own in the right half, one column below 64rem
 * with the task FIRST. The right half is not a product screenshot. It is the
 * POST readout of `DESIGN-REFERENCES.md` §7 -- signing in IS the machine
 * booting -- over the shared bus backdrop, contained to that half so the form
 * never sits on moving lines.
 *
 * THREE RULES, carried over from the frame this replaces, all load-bearing:
 *
 *   1. **Never move focus.** Someone who tabs into the password field while the
 *      readout is still counting keeps it. The sequence decorates a form that
 *      is usable from the first frame; it is never a gate in front of one.
 *   2. **Never carry information only in the readout.** It is `aria-hidden`,
 *      and every line it prints is either decoration or said again in words
 *      (the fault line is a real `role="alert"` beside the fields).
 *   3. **Skip it entirely under `prefers-reduced-motion`** -- not shorten. The
 *      end state renders on the first frame.
 */

export interface ReadoutLine {
  /** Left column, mono, like a POST device name. */
  label: string;
  /** Right column. A state, in capitals. */
  value: string;
  /**
   * `accent` for the verdict when all is well, `fault` when the sequence has
   * halted, `warn` for a state that needs attention but is not a failure.
   * `fault` is never used on a screen a student sees: red is for failed STAFF
   * actions, and a student at the wrong door has done nothing wrong.
   */
  tone?: "accent" | "fault" | "warn" | undefined;
}

interface Props {
  /** The page's only `h1`: the task, not the brand. */
  title: string;
  /** One or two lines under the title. */
  lede?: React.ReactNode;
  /** The POST readout. The last line is the verdict. */
  readout: ReadoutLine[];
  /** Real text under the readout: what is true past this screen. */
  caption?: React.ReactNode;
  /** The form or the actions. */
  children: React.ReactNode;
  /** Small print under the task, separated by a rule. */
  footer?: React.ReactNode;
}

const STEP_MS = 90;

const TONE: Record<NonNullable<ReadoutLine["tone"]>, string> = {
  accent: "text-accent",
  fault: "text-danger",
  warn: "text-warning",
};

export function GateFrame({ title, lede, readout, caption, children, footer }: Props): JSX.Element {
  /*
   * Read once, before the first paint. Reading it in state would render the
   * first frame of the sequence and then correct itself, which is exactly the
   * flash the setting exists to prevent.
   */
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );

  // Reduced motion starts at the end state; everything else counts up to it.
  const [shown, setShown] = useState(reduced.current ? readout.length : 0);

  useEffect(() => {
    if (reduced.current || shown >= readout.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown, readout.length]);

  return (
    <main id="main" className="gate">
      <div className="gate-task">
        <div className="gate-task-inner">
          <Brand />

          <h1 className="mb-2 font-display text-2xl text-ink">{title}</h1>
          {lede ? <div className="mb-6 text-sm text-ink-muted">{lede}</div> : <div className="mb-6" />}

          {children}

          {footer ? (
            <div className="mt-6 space-y-2 border-t border-line pt-4 text-xs text-ink-muted">{footer}</div>
          ) : null}
        </div>
      </div>

      <div className="gate-machine">
        {/* Grid, accent bloom and bus pulses -- @octa/tokens/backdrop.css, held to this half. */}
        <Backdrop />

        <div className="gate-post">
          <div className="gate-post-inner">
            {/*
             * The readout. `aria-hidden` because it is decoration: four OK lines
             * read aloud before every sign-in would be noise, and the one line
             * that matters -- a fault -- is said beside the form in words.
             */}
            <p aria-hidden="true" className="mb-3 font-mono text-xs uppercase tracking-widest text-ink-muted">
              Power-on self-test
            </p>
            <dl aria-hidden="true" className="font-mono text-xs">
              {readout.map((l, i) => (
                <div
                  key={l.label}
                  className="flex justify-between gap-4 border-t border-line py-1.5 transition-opacity duration-base ease-out first:border-t-0"
                  style={{ opacity: i < shown ? 1 : 0 }}
                >
                  <dt className={l.tone ? TONE[l.tone] : "text-ink-muted"}>{l.label}</dt>
                  <dd className={cn("text-right", l.tone ? TONE[l.tone] : "text-ink")}>{l.value}</dd>
                </div>
              ))}
            </dl>

            {/*
             * The caption is real text, so it lives INSIDE the frame, on its
             * opaque surface. The first rebuild put it under the frame, on the
             * backdrop, and a bus trace ran through it like a strikethrough --
             * found by looking, held by "no text sits on a bus trace".
             */}
            {caption ? (
              <p className="mt-4 border-t border-line-strong pt-4 text-sm text-ink-muted">{caption}</p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * The OCTA mark, drawn in `currentColor` so it follows the theme: the favicon's
 * grammar (`packages/tokens/icon.svg`) -- a square core, the machine, inside
 * rings for the level hierarchy, one lit body on the outer ring. The favicon
 * has to carry literal colours because a browser tab cannot read a custom
 * property; this copy can, so it does.
 */
function Brand(): JSX.Element {
  return (
    <div className="mb-8 flex items-center gap-3">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true" focusable="false">
        <g className="text-ink-muted" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7">
          <circle cx="16" cy="16" r="6.5" />
          <circle cx="16" cy="16" r="10" />
          <circle cx="16" cy="16" r="13.2" />
        </g>
        <rect className="text-ink" x="13" y="13" width="6" height="6" rx="1.2" fill="currentColor" />
        <circle className="text-accent" cx="26" cy="16" r="2.6" fill="currentColor" />
      </svg>
      <div className="leading-tight">
        <p className="font-display text-base text-ink">OCTA</p>
        <p className="text-xs text-ink-muted">Teacher console</p>
      </div>
    </div>
  );
}
