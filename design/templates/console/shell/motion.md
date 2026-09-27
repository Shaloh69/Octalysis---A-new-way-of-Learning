# motion.md: the console shell

The shell moves in three places, all local state changes (`.claude/rules/design.md`:
120-200ms for a local change, 240ms for a panel). There is no orchestrated
moment here; the console's budget for one is zero.

| What | How | Duration | Reduced motion |
|---|---|---|---|
| **The 380 sheet opening** | The `<aside>` slides in from the left (`octa-sheet-in`, `translate: -100% 0` to `0 0`) | `--dur-base` (240ms), `--ease-out` | Cut: `--dur-base` is 0ms under the media query, and the global rule caps every animation at 0.01ms. It is simply there |
| The scrim behind it | `.dialog-scrim` fade, shared with every dialog | `--dur-fast` (160ms) | Cut, the same way |
| **The account menu** | `ease-menu`: fades in upward from the foot | `--dur-fast` (160ms) | Cut |
| Nav link and account hover | Background and colour, `transition` | `--dur-fast` | Cut |

**Closing is a cut, not an animation.** The sheet unmounts when it closes, on
Escape, the scrim, a route change or Tab into the page, so the next page is
never drawn behind a sheet still on its way out. The focus return to the menu
button is what says it closed.

**Motion is never the only signal.** The sheet's open state is also
`aria-expanded="true"` on its button and the button's label (*Close menu*); the
current page is a filled pill, an accent edge and a heavier weight, never a
transition.

**Asserted, not assumed** (`console-shell.spec.ts`, test 6): with motion
allowed, the sheet's slide is recorded at 380 and the menu's fade at 1440, both
read through `motionStarted()` (the positive control). With
`prefers-reduced-motion: reduce` emulated, nothing in the shell or the menu
records a duration over 1ms. `_gate.ts`' recorder learned the `shell` and
`menu` surfaces for this, after `main`, so no other route's reading changed.

The loading skeleton (`.skeleton-bar`'s shimmer) is the one ambient loop, shown
only once checking access has taken 400ms; under reduced motion its duration is
0ms and it is a still bar.
