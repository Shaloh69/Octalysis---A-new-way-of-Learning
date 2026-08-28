import { useEffect, useRef, useState } from "react";

/**
 * The console's POST frame.
 *
 * `DESIGN-REFERENCES.md` §7: signing in IS the machine booting. `apps/web` has
 * had this since the student sign-in was built; the console never got a sign-in
 * page at all, so it never got this either, and a teacher's first impression of
 * OCTA was an unstyled dead-end.
 *
 * This is the SAME IDEA in a different stylesheet, not shared code. `apps/web`
 * is hand-written CSS and this package is Tailwind over the same tokens
 * (`apps/web/CLAUDE.md` explains why the two apps diverge here). Sharing the
 * component would mean shipping one app's styling approach into the other.
 *
 * The staff readout differs from the student one on purpose. A student sees a
 * machine come up; staff see the things they are about to be trusted with —
 * roster mounted, policies armed, audit recording. It is a quiet reminder that
 * every action past this screen is attributable.
 *
 * THREE RULES, all easy to get wrong and all load-bearing:
 *
 *   1. **Never move focus.** Someone who tabs into the password field while the
 *      frame is still drawing keeps it. This is decoration over a form that is
 *      already usable, never a gate in front of one.
 *   2. **Never carry information only in the animation.** Every line printed
 *      here is in the DOM from first paint; the sequence reveals, it does not
 *      supply.
 *   3. **Skip entirely under `prefers-reduced-motion`** — not shorten. The end
 *      state renders immediately, on the first frame.
 */

export interface BootLine {
  /** Left column, mono, like a POST device name. */
  label: string;
  /** Right column. A count, a state, or OK. */
  value: string;
}

interface Props {
  title: string;
  subtitle?: string;
  lines: BootLine[];
  children: React.ReactNode;
}

const STEP_MS = 90;

export function BootFrame({ title, subtitle, lines, children }: Props): JSX.Element {
  /*
   * Read once, in a ref, before the first paint. Reading it in state would
   * render the animated first frame and then correct itself, which is exactly
   * the flash the setting exists to prevent.
   */
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );

  // Reduced motion starts at the end state; everything else counts up to it.
  const [shown, setShown] = useState(reduced.current ? lines.length + 1 : 0);

  useEffect(() => {
    if (reduced.current || shown > lines.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [shown, lines.length]);

  const settled = shown > lines.length;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/*
       * The backdrop: an engineering grid, drawn from the line token so it
       * re-tints with the theme and cannot drift from the palette. Two
       * gradients, no image, no request.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 100%)",
          opacity: 0.5,
        }}
      />

      <section
        className="relative w-full max-w-md border border-line-strong bg-surface-1 p-6 shadow-2"
        style={{
          // The notched corner, driven by a custom property so the shape is one
          // number rather than four coordinates to keep in sync.
          ["--notch" as string]: "18px",
          clipPath:
            "polygon(var(--notch) 0, 100% 0, 100% calc(100% - var(--notch)), calc(100% - var(--notch)) 100%, 0 100%, 0 var(--notch))",
        }}
      >
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-ink-faint">
          OCTA · Teacher console
        </p>
        <h1 className="mb-1 font-display text-2xl text-ink">{title}</h1>
        {subtitle ? <p className="mb-5 text-xs text-ink-muted">{subtitle}</p> : null}

        {/*
         * The readout. `aria-hidden` because it is decoration: it reports state
         * a screen-reader user cannot act on, and reading four OK lines before
         * every sign-in would be noise. The form below is the content.
         */}
        <dl
          aria-hidden="true"
          className="mb-5 border-y border-line py-2.5 font-mono text-xs"
        >
          {lines.map((l, i) => (
            <div
              key={l.label}
              className="flex justify-between py-0.5 transition-opacity duration-base ease-out"
              style={{ opacity: i < shown ? 1 : 0 }}
            >
              <dt className="text-ink-faint">{l.label}</dt>
              <dd className="text-ink-muted">{l.value}</dd>
            </div>
          ))}
          <div
            className="flex justify-between py-0.5 transition-opacity duration-base ease-out"
            style={{ opacity: settled ? 1 : 0 }}
          >
            <dt className="text-accent">CONSOLE</dt>
            <dd className="text-accent">READY</dd>
          </div>
        </dl>

        {children}
      </section>
    </div>
  );
}
