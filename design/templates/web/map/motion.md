# `/app/map` — motion

The flat map is the surface that reduced-motion students and struggling devices
land on, so **the picture never moves**: no orbit, no drift, no twinkle, no
zoom, no `requestAnimationFrame`. `solar-system.spec.ts` "the flat galaxy holds
still" asserts both no movement and no declared CSS animation inside
`.galaxy-scroll`. What moves is the page around it, briefly, and all of it is
cut under `prefers-reduced-motion`.

| Moment | What moves | Duration | Reduced motion |
|---|---|---|---|
| **Arrival** (the map's data lands) | The route root fades in (`fm-enter`). Opacity only: a transform would make the root the containing block of the fixed 380 sheet | `--dur-base` (240ms), `--ease-out` | None: the map is simply there |
| **A stage is selected** | The panel's body fades up 8px (`fm-panel-enter`); at 380 that body is the bottom sheet's, so the sheet rises. Re-keyed per stage, so switching stages replays it | 240ms | None: a cut |
| The selected ring, the next-stage ring | `box-shadow` on the disc | `--dur-fast` (160ms) | None |
| Hover on a row or a button (380 rows, panel buttons) | background colour | 160ms | None |
| **Enter journey / Go to Stage NN** | §4.1's warp: the stars stretch and the picture fades, then the stage opens (`useFlatWarp`). No zoom: this surface has no camera and must not fake one | 620ms | **A cut**: `useFlatWarp` navigates at once and the CSS guard holds the frame (`web-map.spec.ts` 6: the URL within 1s, no `.is-warping`) |
| Leaving the panel (Escape, Close, Back) | Nothing: it closes at once and focus returns to the stage | — | — |

Motion is never the only signal: a selection is also the ink ring, the
`aria-expanded` state, the panel's heading taking focus and `?stage=NN` in the
address; the warp is also the navigation it precedes.

**Gate 6's positive control** (`web-map.spec.ts`): without the media feature,
`fm-enter` and `fm-panel-enter` are both recorded in `main` at ≥100ms; with it,
nothing in `main` records more than 1ms across load and a selection.
