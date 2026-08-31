import type { Config } from "tailwindcss";

/**
 * THE PALETTE IS packages/tokens, AND NOTHING ELSE.
 *
 * Every colour below resolves to a CSS custom property defined in
 * `@octa/tokens/tokens.css` in OKLCH. There is not one literal hex in this file
 * and there must never be: a pre-commit hook blocks hex outside that package,
 * and `pnpm --filter @octa/console lint` fails the build on any `slate-*` or
 * `blue-*` utility (apps/console/CLAUDE.md, and PHASES.md P4 exit criteria).
 *
 * Tailwind's default palette is DELETED rather than extended. Extending it
 * would leave every upstream colour utility a VALID class that merely violates
 * a written rule; deleting it makes the violation produce no CSS at all, and
 * the scanner turns that into a build failure. `colors` below is the complete
 * set of colours this app can express.
 *
 * (The scanner flags a banned utility even inside a comment, on purpose, which
 * is why none is spelled out here. A rule you can document your way around is
 * not a rule.)
 *
 * The three base themes swap these variables at the `data-theme` attribute, so
 * every component below is theme-agnostic by construction -- there is no
 * `dark:` variant anywhere in this app, and there should not be.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // No `darkMode` strategy: themes are driven by [data-theme], not by a class.
  theme: {
    // NOT `extend` -- a full replacement. See the note above.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",

      surface: {
        0: "var(--surface-0)",
        1: "var(--surface-1)",
        2: "var(--surface-2)",
        3: "var(--surface-3)",
      },
      ink: {
        DEFAULT: "var(--ink)",
        muted: "var(--ink-muted)",
        faint: "var(--ink-faint)",
      },
      line: {
        DEFAULT: "var(--line)",
        strong: "var(--line-strong)",
      },
      accent: {
        DEFAULT: "var(--accent)",
        hover: "var(--accent-hover)",
        muted: "var(--accent-muted)",
        fg: "var(--accent-fg)",
        ring: "var(--accent-ring)",
      },
      success: { DEFAULT: "var(--success)", bg: "var(--success-bg)" },
      danger: { DEFAULT: "var(--danger)", bg: "var(--danger-bg)" },
      warning: { DEFAULT: "var(--warning)", bg: "var(--warning-bg)" },
      info: { DEFAULT: "var(--info)", bg: "var(--info-bg)" },
      locked: { DEFAULT: "var(--locked)", bg: "var(--locked-bg)" },
    },
    borderRadius: {
      none: "0",
      sm: "var(--radius-sm)",
      md: "var(--radius-md)",
      lg: "var(--radius-lg)",
      full: "var(--radius-full)",
    },
    fontFamily: {
      display: "var(--font-display)",
      body: "var(--font-body)",
      // Every number, register value, hex, opcode and listing renders in this.
      // CLAUDE.md, "Design". The console is mostly numbers, so it is used a lot.
      mono: "var(--font-mono)",
    },
    fontSize: {
      xs: ["var(--text-xs)", "var(--lh-xs)"],
      sm: ["var(--text-sm)", "var(--lh-sm)"],
      base: ["var(--text-base)", "var(--lh-base)"],
      lg: ["var(--text-lg)", "var(--lh-lg)"],
      xl: ["var(--text-xl)", "var(--lh-xl)"],
      "2xl": ["var(--text-2xl)", "var(--lh-2xl)"],
      "3xl": ["var(--text-3xl)", "var(--lh-3xl)"],
    },
    extend: {
      /*
       * `spacing` feeds padding, margin and gap -- and, by Tailwind's default,
       * width and height too. THAT LAST PART SHIPPED A BUG: `h-9` on every
       * input and button resolved to --space-9 (6rem) and drew a 96px box.
       *
       * Space is a layout ladder that steps fast; size is a control ladder that
       * steps slowly in the range space skips. They are separated below, and
       * the size values match Tailwind's own numerics so `h-9` means what a
       * developer reading the class name assumes it means.
       */
      spacing: {
        1: "var(--space-1)", 2: "var(--space-2)", 3: "var(--space-3)",
        4: "var(--space-4)", 5: "var(--space-5)", 6: "var(--space-6)",
        7: "var(--space-7)", 8: "var(--space-8)", 9: "var(--space-9)",
      },
      height: {
        4: "var(--size-4)",   5: "var(--size-5)",   6: "var(--size-6)",
        7: "var(--size-7)",   8: "var(--size-8)",   9: "var(--size-9)",
        10: "var(--size-10)", 11: "var(--size-11)", 12: "var(--size-12)",
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
      },
      width: {
        4: "var(--size-4)",   5: "var(--size-5)",   6: "var(--size-6)",
        7: "var(--size-7)",   8: "var(--size-8)",   9: "var(--size-9)",
        10: "var(--size-10)", 11: "var(--size-11)", 12: "var(--size-12)",
      },
      minWidth:  { 4: "var(--size-4)", 8: "var(--size-8)", 9: "var(--size-9)" },
      minHeight: { 4: "var(--size-4)", 8: "var(--size-8)", 9: "var(--size-9)" },
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      zIndex: {
        sheet: "var(--z-sheet)",
        dialog: "var(--z-dialog)",
        toast: "var(--z-toast)",
      },
    },
  },
  plugins: [],
} satisfies Config;
