# `/app` — motion

| Moment | What moves | How long | Reduced motion |
|---|---|---|---|
| Ambient | planets orbit (Kepler: the outer ring takes 600s), a chosen planet's reticle and moons turn | continuous, slow | **none**: the clock holds at 0, every planet stays where the layout put it (`data-motion="still"`) |
| Choosing a planet | the camera eases to it and pulls in | settles in about 700ms (exponential, rate 6/s) | **a cut**: the camera jumps |
| Closing | the camera eases back to the whole system | about 700ms | a cut |
| Drag | the system yaws with the pointer | follows the pointer | follows the pointer (a direct manipulation, not an animation) |
| The body panel | fades in | `--dur-base` | none |
| Enter journey | the realm warp (the shell's `RealmWarp`) | 650ms | a cut |

Idle cost: `requestAnimationFrame` stops with a hidden tab. The frame-rate
guard drops to device-pixel-ratio 1 and 600 stars after 3 seconds under
30fps (the first 4s are not judged), remembered for seven days.
