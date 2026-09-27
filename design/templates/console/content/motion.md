# `/content` — motion

**No entrance, and nothing loops but the skeleton.** This is a page a teacher
reads and types on; a chapter of 31 blocks easing in would make them wait for
text they came to fix. Every state reads from a still frame, and
`prefers-reduced-motion` cuts everything.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| The send-back dialog, opening | `ease-dialog` (shared) | `--dur-fast` | the dialog and its scrim are there; focus is in it | cut |
| Toasts after Approve, Send back, Save | `octa-rise-in` (shared) | `--dur-fast` | the toast's words say what happened to what, or that nothing was saved | cut |
| Row hover in the chapter table | `background-color` transition | `--dur-fast` | none needed: hover adds nothing a still frame lacks | cut |
| Chapters / Summaries, Blocks / Preview (pressed) | `background-color` (the shared `Button`) | `--dur-fast` | `aria-pressed` and the accent fill; the view underneath changes | cut |
| The skeleton, after 400ms of loading | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence says the server may be waking | cut to one frame |

**Opening a block for editing does not animate.** The editor appears in place
and focus moves into the source; the block's row takes the surface-2 fill and
the preview marks the same block *Editing block N, not saved* with an accent
outline. Easing a textarea open would move the text under the cursor.

**The preview keeps the block being edited in view** with
`scrollIntoView({ block: "nearest" })`, which is a jump, never a smooth
scroll: the global reduced-motion rule sets `scroll-behavior: auto`, and
nothing here asks for `smooth`.

**The approved summary does not fly to its new group.** The list reloads and
focus moves to the next summary waiting; the toast says what happened.

Gate assertion 6 in `design/specs/console-content.spec.ts` checks both halves:
with motion allowed the send-back dialog MUST ease in (the positive control,
read through `motionStarted()`), and with `reducedMotion: "reduce"` emulated
nothing on the route may animate, through a reload, the dialog and a view
switch.
