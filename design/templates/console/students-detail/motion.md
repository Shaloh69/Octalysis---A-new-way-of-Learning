# `/students/:userId` — motion

The console's budget is small: local state changes ease, nothing loops except
the skeleton's breath, and `prefers-reduced-motion` cuts everything. Nothing
here is the only signal for anything; every state reads from a still frame.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| A paper opening under its row | `octa-rise-in`: fades up by `--space-2` | `--dur-base` (240ms) | the paper is there; the toggle's `aria-expanded` is `true`; the row is shaded | cut: it is simply there |
| The toggle's chevron | `rotate` 0 → 90deg | `--dur-fast` (160ms) | right-pointing closed, down-pointing open | cut |
| Row hover, toggle and link colour | `background-color` / `color` transition | `--dur-fast` | hover is never needed to read anything | cut |
| The Actions menu | `.ease-menu`, `octa-fade-in` (shared primitive) | `--dur-fast` | the menu is open | cut |
| The deactivate / move dialogs | `.ease-dialog` pop in, fade out; `.dialog-scrim` fades (shared, from `/students`) | `--dur-fast` | the dialog is open over a dimmed page | cut |
| Toasts after a deactivation or move | `octa-rise-in` (shared) | `--dur-fast` | the toast's text | cut |
| The skeleton, after 400ms of loading | `octa-shimmer`, a slow breath | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy` | cut to one frame |

**Closing a paper is a cut**, on purpose: the row it belonged to is already in
view, and an exit animation on a table row delays the list a teacher is
scanning.

The global reduced-motion rule in `index.css` sets every animation and
transition to 0.01ms; the tokens' `--dur-*` are also 0 under it. Gate
assertion 6 in `design/specs/console-student-detail.spec.ts` checks both
halves: with motion allowed the paper MUST ease in (the positive control), and
with `reducedMotion: "reduce"` emulated nothing on the route may animate,
including the deactivate dialog.
