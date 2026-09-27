# `/gradebook` — motion

One entrance, and it carries information: the chart's bars grow from their
baseline, so the eye reads length as the thing that matters. Nothing loops but
the skeleton's breath, and `prefers-reduced-motion` cuts everything. Every
state reads from a still frame.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| The chart's bars, when the page lands | `octa-grow`: `transform: scaleX(0 → 1)` from the left edge, `--ease-out` | `--dur-base` (240ms) | the value printed at each bar's tip; "not sat yet" where there is no bar | cut: the bars are drawn at full length |
| Row hover in the grid | `background-color` transition | `--dur-fast` (160ms) | none needed: hover adds nothing a still frame lacks | cut |
| The view buttons, pressed | `background-color` (the shared `Button`) | `--dur-fast` | the pressed button carries `aria-pressed` and the accent fill; the grid's columns change | cut |
| Toasts after Download CSV | `octa-rise-in` (shared) | `--dur-fast` | the toast's text says what went into the file, or that nothing was saved | cut |
| The skeleton, after 400ms of loading | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence says the server may be waking | cut to one frame |

**Switching between Final grade and Stage checks does not animate the grid.**
The columns are replaced. Easing 21 rows of numbers in would make a teacher
wait for figures they came to read, and the pressed button is the signal.

**The bars grow once per page load, not on a view switch or a filter.** The
chart does not change when the grid does.

The global reduced-motion rule in `index.css` sets every animation and
transition to 0.01ms, and the tokens' `--dur-*` are 0 under it. Gate assertion
6 in `design/specs/console-gradebook.spec.ts` checks both halves: with motion
allowed the bars MUST grow in (the positive control, read through
`motionStarted()`), and with `reducedMotion: "reduce"` emulated nothing on the
route may animate, through a reload and both views.
