# `/system` — motion

**No entrance.** A teacher opens this page to find out whether anything is
wrong; 28 rows easing in would make them wait for the one line they came for.
Every state reads from a still frame, and `prefers-reduced-motion` cuts
everything.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| Details, opening | `octa-rise-in` (shared) on `.sy-details` | `--dur-fast` | the fields and rows are there; the button reads `aria-expanded="true"` and its chevron points up; the row takes `--surface-2` | cut |
| The chevron on Details | `rotate` transition | `--dur-fast` | the panel under the row is open or not | cut |
| A **Needs attention** link | `scrollIntoView({ behavior: "smooth" })` to the check, whose Details opens and takes focus | the browser's smooth scroll | the check is at the top of the view, open, with focus on its Details | `behavior: "auto"`: a jump, and the global rule forces `scroll-behavior: auto` |
| Toasts after **Run again** | `octa-rise-in` (shared toaster) | `--dur-fast` | the toast says the new time and the counts; the run line under the heading shows the new time. A failed re-run's toast stays, and a line under the run line says when it failed | cut |
| Details hover | `background-color` transition | `--dur-fast` | none needed: hover adds nothing a still frame lacks | cut |
| The skeleton, after 400ms of a first load | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence **at its top** says the server may be waking | cut to one frame |

**Run again does not animate the results.** The previous run stays on screen
while the checks run (the button reads *Running…* and is disabled, with
`aria-busy`), then the new results replace it in one step. No spinner: the
words say it, and a spinning icon would be the page's only looping motion.

Gate assertion 6 in `design/specs/console-system.spec.ts` checks both halves:
with motion allowed, Details MUST ease open (the positive control, read
through `motionStarted(page, "main")`), and with `reducedMotion: "reduce"`
emulated nothing on the route may animate, through a reload, a Details and a
Needs-attention jump.
