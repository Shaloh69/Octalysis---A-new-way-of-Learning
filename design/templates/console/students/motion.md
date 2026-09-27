# `/students` — motion

The console's budget is small: no orchestrated moment on this page. Every
transition below is local, 120 to 200ms (`--dur-fast`), and none carries
meaning that a still frame does not also show.

| What | How | Reduced motion | Readable from a still frame because |
|---|---|---|---|
| Import, deactivate/reactivate and move dialogs | `.ease-dialog`: `octa-pop-in` in, `octa-fade-out` out | cut | the dialog is either there or not |
| The scrim behind every dialog | `.dialog-scrim`: fade in and out | cut | the page behind is dimmed |
| The row menu (`⋯`) | `.ease-menu`: `octa-fade-in` | cut | the menu is either open or not |
| The bulk bar, when the first row is ticked | `.bulk-bar`: `octa-rise-in` | cut | it says "N selected" |
| Row hover, row selected | `background-color` transition | cut | a selected row keeps its tint and its ticked box |
| Registration filter pressed | colour, border and background transition | cut | `aria-pressed`, and the accent border stays |
| Toasts | `.toast`: `octa-rise-in` (shared) | cut | the toast's text |
| Skeleton | `octa-shimmer`, a slow breath, only after 400ms | cut to a still bar | the bars are the table's shape |

"Cut" is the global `prefers-reduced-motion: reduce` rule in `index.css`
(every animation and transition to 0.01ms). The spec's assertion 6 proves it
with the media feature **emulated**, after a positive control that sees the
deactivate dialog ease in with motion allowed.

Nothing on this page loops except the skeleton, and the skeleton only exists
while the roster has not arrived.
