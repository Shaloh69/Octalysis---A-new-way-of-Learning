import { useEffect, useRef, useState } from "react";

/**
 * The POST panel — the frame that assembles itself around the auth forms.
 *
 * `DESIGN-REFERENCES.md` §7: signing in IS the machine booting. A computer
 * running Power-On Self-Test counts memory, reports each check, and hands off
 * with SYSTEM READY. That sequence is already what this course teaches, so the
 * animation is the first lesson rather than decoration bolted onto a form.
 *
 * The assembly idea is Arwes' (MIT, unmaintained — we took the timing
 * discipline, not the dependency) and the notched shape is the CSS-Tricks
 * `clip-path: polygon()` technique driven by a `--notch` custom property, with
 * `corner-shape: bevel` layered on as progressive enhancement.
 *
 * THREE THINGS THIS MUST NOT DO, all of them easy to get wrong:
 *
 *   1. **Never move focus.** A student who tabs into the password field while
 *      the frame is still drawing keeps it. The sequence is decoration over a
 *      form that is already usable, not a gate in front of one.
 *   2. **Never carry information only in the animation.** Every line the POST
 *      prints is also in the DOM when the sequence is skipped.
 *   3. **Skip entirely under `prefers-reduced-motion`.** Not shorten — the end
 *      state renders immediately.
 */

export interface BootLine {
  /** Left column, mono, like a POST device name. */
  label: string;
  /** Right column. Usually a size, a count, or OK. */
  value: string;
}

interface Props {
  title: string;
  subtitle?: string;
  lines: BootLine[];
  children: React.ReactNode;
}

const STEP_MS = 90;

export function BootPanel({ title, subtitle, lines, children }: Props): JSX.Element {
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // `shown` counts how many POST lines have printed. It starts AT THE END when
  // motion is reduced, so the same markup renders either way and nothing is
  // conditional on having watched it.
  const [shown, setShown] = useState(reduced.current ? lines.length : 0);
  const [ready, setReady] = useState(reduced.current);

  useEffect(() => {
    if (reduced.current) return;

    const timers: number[] = [];
    lines.forEach((_, i) => {
      timers.push(window.setTimeout(() => setShown(i + 1), 120 + i * STEP_MS));
    });
    timers.push(
      window.setTimeout(() => setReady(true), 160 + lines.length * STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [lines]);

  return (
    <div className={"boot" + (ready ? " boot-ready" : "")}>
      <div className="boot-frame" aria-hidden="true">
        {/* Four corner brackets that draw in. Decorative only. */}
        <span className="boot-corner boot-corner-tl" />
        <span className="boot-corner boot-corner-tr" />
        <span className="boot-corner boot-corner-bl" />
        <span className="boot-corner boot-corner-br" />
      </div>

      <div className="boot-inner">
        <header className="boot-head">
          <p className="boot-eyebrow mono">OCTA · POWER-ON SELF-TEST</p>
          <h1 className="boot-title">{title}</h1>
          {subtitle && <p className="boot-sub">{subtitle}</p>}
        </header>

        {/*
         * The POST readout. `aria-hidden` because it is atmosphere, not
         * content -- a screen reader announcing "MEM 640K OK" before the form
         * would be noise. Everything a student actually needs is in the form.
         */}
        <ul className="boot-post mono" aria-hidden="true">
          {lines.map((l, i) => (
            <li key={l.label} className={i < shown ? "boot-post-on" : ""}>
              <span className="boot-post-label">{l.label}</span>
              <span className="boot-post-dots" />
              <span className="boot-post-value">{l.value}</span>
            </li>
          ))}
        </ul>

        <div className="boot-form">{children}</div>
      </div>
    </div>
  );
}
