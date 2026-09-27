# `/assessments` — motion

The console's budget is small: local state changes ease, nothing loops except
the skeleton's breath, and `prefers-reduced-motion` cuts everything. Nothing
here is the only signal for anything; every state reads from a still frame.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| The create, window, rotate and bank dialogs | `.ease-dialog`: pop in, fade out; `.dialog-scrim` fades (shared) | `--dur-fast` (160ms) | the dialog is open over a dimmed page | cut |
| The bank's answer landing in the create form, and changing when the blueprint changes | `.ease-swap`, `octa-fade-in`, keyed on the answer | `--dur-fast` | the verdict line and its numbers | cut |
| The bank box while it checks | skeleton bars, `octa-shimmer`; the box keeps its height so nothing jumps when the answer lands | `--dur-base` × 6, looping | `aria-busy`, "Checking the bank" | cut to one frame |
| The row `⋯` menu | `.ease-menu` (shared primitive) | `--dur-fast` | the menu is open | cut |
| Row hover, the `⋯` button, the Items link | `background-color` / `color` transition | `--dur-fast` | hover is never needed to read anything | cut |
| Toasts after create, window and rotate | `octa-rise-in` (shared) | `--dur-fast` | the toast's text | cut |
| The list skeleton, after 400ms of loading | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence | cut to one frame |

**A saved change does not animate its row.** The list reloads and the row
simply reads its new window, state or salt date: an entrance on a row a
teacher is already looking at delays the thing they came to check.

The global reduced-motion rule in `index.css` sets every animation and
transition to 0.01ms, and the tokens' `--dur-*` are 0 under it. Gate assertion
6 in `design/specs/console-assessment-window.spec.ts` checks both halves: with
motion allowed the create form MUST ease in (the positive control), and with
`reducedMotion: "reduce"` emulated nothing on the route may animate, through
the create form and the rotate dialog.
