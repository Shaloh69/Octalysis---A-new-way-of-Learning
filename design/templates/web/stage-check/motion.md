# `/app/stage/:id/check` — motion (the remake)

An assessment is "the same calm, flat, consistent surface every single time"
(`GAME-DESIGN.md` §5.1). The paper spends almost nothing; the planet around it
spends only what the shell already does.

| What moves | How | Duration | Reduced motion |
|---|---|---|---|
| Arriving from the reader (Start) | none of its own: the biome does not change, so no warp | — | — |
| **A question arriving** (Next, Previous, a palette button, a resume) | `check-enter`: opacity 0 → 1 on `.check-question`, keyed by ordinal | `--dur-fast` | **Cut** (`--dur-fast: 0ms`, and the global block). Asserted: `web-stage-check.spec.ts` gate 6, positive control first |
| **The Submit confirmation** | `check-rise`: opacity on `.check-dialog`; the scrim dims the world and the shell's bars | `--dur-fast` | Cut |
| **A toast** | `check-rise` on `.toast`, landing above the shell's bottom bars | `--dur-base` | Cut |
| Palette buttons, options, paper buttons on hover or selection | `background-color` transitions | `--dur-fast` | Cut |
| **The verdict** | **Nothing.** It appears; no flash, slide or shake. Asserted: no CSS animation inside `[data-verdict]` | — | — |
| The skeleton | still bars, shown after 400ms, words after 3s | — | — |
| Leaving (Leave planet) | the shell's warp out to the map | 650ms | a cut |

Nothing here is the only carrier of a meaning: a still frame shows which
question is current (the palette's thick accent edge and `aria-current`, the
heading, the readout's PC), what was recorded (✓ and "Your answer"), and the
verdict in words.

Focus moves to the question's heading on a deliberate move (never on first
render), to **Keep working** when the confirmation opens, back to **Submit
paper** when it closes, and to the result's heading after a submit.
