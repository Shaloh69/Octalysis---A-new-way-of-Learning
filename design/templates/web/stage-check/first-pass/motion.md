# `/app/stage/:id/check` — motion

An assessment is "the same calm, flat, consistent surface every single time"
(`GAME-DESIGN.md` §5.1), so this page spends almost nothing. It is not a
stage's orchestrated moment (the Bring-Up is, and it is not here).

| What moves | How | Duration | Reduced motion |
|---|---|---|---|
| **A question arriving** (Next, Previous, a palette button, a resume) | `check-enter`: opacity 0 → 1 and 4px up to rest, on `.check-question` (keyed by ordinal, so it replays per question) | `--dur-fast` (160ms), `--ease-out` | **Cut.** The tokens set `--dur-fast: 0ms`, and the global `prefers-reduced-motion` block caps every animation at 0.001ms. Asserted: `web-stage-check.spec.ts` gate 6, positive control first (without the feature the entrance is recorded), then nothing over 1ms with it |
| **The Submit confirmation** | `check-rise`: opacity and 8px up, on `.check-dialog` | `--dur-fast` (160ms) | Cut, as above |
| **A toast** | `check-rise` on `.toast` | `--dur-base` (240ms) | Cut, as above |
| Palette buttons, options, buttons on hover or selection | `border-color` / `background-color` transitions | `--dur-fast` | Cut |
| **The verdict** | **Nothing.** It appears; it does not flash, slide or shake. `design.md`'s "120ms accent flash" on a correct answer is NOT used: `apps/web/CLAUDE.md` forbids accent on correct/incorrect, and a flash only on correct would make its absence the wrong-answer signal. Asserted: no CSS animation runs inside `[data-verdict]` | — | — |
| The skeleton | The shared `.skel` pulse | 1.4s loop | Cut by the global block |

Nothing here is the only carrier of a meaning: a still frame shows which
question is current (the palette's border and `aria-current`, the heading,
the Register Bar's PC), what was recorded (✓ and the words "Your answer"), and
the verdict in words.

Focus moves to the question's heading on a deliberate move (never on first
render), to **Keep working** when the confirmation opens (so Enter on arrival
does not hand the paper in), back to **Submit paper** when it closes, and to
the result's heading after a submit.
