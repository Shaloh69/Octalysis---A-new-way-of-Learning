# `/submissions` — motion

The console's budget is small: local state changes ease, nothing loops except
the skeleton's breath, and `prefers-reduced-motion` cuts everything. Nothing
here is the only signal for anything; every state reads from a still frame.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| The return dialog | `.ease-dialog`: pop in, fade out; `.dialog-scrim` fades (shared) | `--dur-fast` (160ms) | the dialog is open over a dimmed page | cut |
| The Deliverable menu | `.ease-menu` (shared primitive) | `--dur-fast` | the menu is open | cut |
| Row hover, the chosen row's tint, a band being pressed | `background-color` / `border-color` transition | `--dur-fast` | the chosen row carries `aria-current` and an accent edge; a pressed band carries `aria-pressed` and an accent border | cut |
| Toasts after a mark and after a return | `octa-rise-in` (shared) | `--dur-fast` | the toast's text | cut |
| The queue skeleton, after 400ms of loading | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence | cut to one frame |
| A refused save at 380 | the page scrolls the action row above the toast's band (`scroll-margin-bottom`) | instant (no `behavior: smooth`) | the alert sentence above Save grade | unchanged: it was never animated |

**Opening a submission does not animate the pane.** The pane's content is
replaced and focus moves to its heading. A teacher marking twenty labs in a
row is not helped by an entrance on each one; the heading changing, and the
queue's chosen row moving, are the signal.

**Save and advance does not animate either.** The next submission's name is
the new heading, focused, and the one just marked leaves the *To mark* view
when the queue reloads.

The global reduced-motion rule in `index.css` sets every animation and
transition to 0.01ms, and the tokens' `--dur-*` are 0 under it. Gate assertion
6 in `design/specs/console-submissions.spec.ts` checks both halves: with motion
allowed the return dialog MUST ease in (the positive control, read through
`motionStarted()` so a late `animationstart` is not a false red), and with
`reducedMotion: "reduce"` emulated nothing on the route may animate, through
a pane, the graded record and the return dialog.
