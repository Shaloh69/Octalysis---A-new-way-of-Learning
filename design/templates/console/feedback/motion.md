# `/feedback` — motion

**No entrance.** A teacher opens this page to work down a queue; rows easing
in would make them wait for the first report. Every state reads from a still
frame, and `prefers-reduced-motion` cuts everything.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| A group's detail, opening | `octa-rise-in` (shared) on `.fb-detail` | `--dur-fast` | the reports and the triage are there; the button reads **Close** with `aria-expanded="true"` and its chevron points up; the row takes `--surface-2` | cut |
| The chevron on Triage / Close | `rotate` transition | `--dur-fast` | the detail under the row is open or not | cut |
| Groups brought in by **Load older** | `octa-fade-in` on `[data-new]`, once | `--dur-base` | *Showing N of M* grows; the button is replaced by *That is every report this filter matches.* at the end | cut |
| Toasts after **Save** and **Export CSV** | `octa-rise-in` (shared toaster) | `--dur-fast` | the toast says how many reports moved to which state (or how many were exported, and the file's name); a refusal also shows **in the detail** and its toast stays | cut |
| Row hover in the table; Triage hover | `background-color` transition | `--dur-fast` | none needed: hover adds nothing a still frame lacks | cut |
| Status, kind, Move to, Severity (pressed) | `background-color` (the shared `Button`) | `--dur-fast` | `aria-pressed` and the accent fill | cut |
| The skeleton, after 400ms of a first load | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence **at its top** says the server may be waking | cut to one frame |

**A filter change does not animate.** The rows already shown stay while the
new ones load (a `Loading…` status beside the count), then the new rows
replace them in one step. **Save does not animate the row away**: the queue
reloads and the group appears under its new status, or leaves the current
filter, in one step, and the toast says where it went.

Gate assertion 6 in `design/specs/console-feedback.spec.ts` checks both
halves: with motion allowed, a group's detail MUST ease open (the positive
control, read through `motionStarted(page, "main")`), and with
`reducedMotion: "reduce"` emulated nothing on the route may animate, through a
reload, a detail and a Load older.
