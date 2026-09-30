# `/app` — motion

| Moment | What moves | How long | Reduced motion |
|---|---|---|---|
| Ambient | planets orbit (Kepler: the outer ring takes 600s), a chosen planet's reticle and moons turn | continuous, slow | **none**: the clock holds at 0, every planet stays where the layout put it (`data-motion="still"`) |
| Choosing a planet | the camera eases to it and pulls in | settles in about 700ms (exponential, rate 6/s) | **a cut**: the camera jumps |
| Closing | the camera eases back to the whole system | about 700ms | a cut |
| Drag | the system yaws with the pointer | follows the pointer | follows the pointer (a direct manipulation, not an animation) |
| The body panel | fades in | `--dur-base` | none |
| Enter journey | the realm warp (the shell's `RealmWarp`) | 650ms | a cut |
| A chosen planet's moons (R4.2, 30 Sep) | each on its own circular orbit by the same Kepler law, on a clock ten times the planets' (the outermost moon goes round in a minute) | continuous | **none**: frozen with the planets |
| Orientation's asteroids (3.10) | a seeded belt, Keplerian around it | continuous | **none** |
| Each planet's own turn (1 Oct, `bodies.ts`) | spins on its tilted axis at its kind's pace (a gas giant's ten seconds a turn, Venus's minute); gas bands drift; an Earth-like's clouds turn a little faster than its ground | continuous | **none**: every surface holds still |
| The sun (1 Oct) | turns once in 90s, its surface churns slowly, the corona and halo breathe out of step | continuous | **none** |
| A texture arriving | the body swaps its biome tint for its surface | one frame | the same (a swap, not an animation) |
| Choosing a moon | the camera eases on to it, closer than to a planet | about 700ms | a cut |
| Stepping out of a moon (Escape, Close, Back to Stage NN) | the camera eases back to the planet | about 700ms | a cut |

Idle cost: `requestAnimationFrame` stops with a hidden tab. The frame-rate
guard drops to device-pixel-ratio 1 and 600 stars after 3 seconds under
30fps (the first 4s are not judged), remembered for seven days.
