# `/app/stage/:id` — motion

The stage's one orchestrated moment is the Bring-Up, and it does not live here
(it follows grading; deferred, `SPEC.md` decision 1). What the reader owns is
travel in and out, and small local easing. Every duration is a token, and the
tokens themselves go to `0ms` under `prefers-reduced-motion`
(`packages/tokens/tokens.css`), so each item below is a **cut** there, never a
slower version.

| Moment | What moves | Duration | Reduced motion |
|---|---|---|---|
| **Arriving** (`BIOME-AND-LOADING-SPEC.md` §4.2) | The biome is there at once (`biome-arrive`, owned by the biome system); the skeleton appears after 400ms with no pulse; the reading column fades up 6px when it lands (`reader-enter`) | `--dur-base` (240ms) | Biome static (its own rule); no fade, the reading is simply there |
| **Leaving** (the reverse travel transition, `.claude/rules/design.md`) | *Back to the map* fades the whole page, biome included, to 0 (`reader-leave`), then navigates. Opacity only: a transform on the page would re-anchor the biome's `position: fixed` | `--dur-base` | Navigates at once, no fade (`reduced()` in `StageReader.tsx` skips the animation; asserted in the spec) |
| A modified click on *Back to the map* (new tab or window) | Nothing: the browser's own behaviour | — | — |
| The browser's Back button | Nothing: a route change the page cannot intercept, so it is a cut in both modes | — | — |
| **A section chosen** from the rail or sheet | The page scrolls to it (`scrollIntoView`, smooth); the rail's mark moves (`background-color`, `border-color`) | smooth scroll; `--dur-fast` (160ms) | Instant scroll; the mark changes without easing |
| **The sheet** (380) | Rises 24px and fades in (`reader-sheet`) | `--dur-base` | Appears in place |
| Button hover | `background-color` | `--dur-fast` | none |

Motion is never the only signal: the current section is marked by weight, a
bar and `aria-current="location"`, and *Section N of M* says it in words; the
sheet's state is `aria-expanded`; arriving is announced as *Arriving at stage
NN* to a screen reader.

`web-stage.spec.ts` gate 6 records motion from before the first paint: the
positive control requires `reader-enter` of at least 100ms without the media
feature; with it emulated, nothing in `<main>` may run longer than 1ms through
arrival and a rail jump, and *Back to the map* must reach `/app` within 1s.
"leaving eases out" requires `reader-leave` to run without it.
