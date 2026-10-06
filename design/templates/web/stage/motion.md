# `/app/stage/:id` — motion

| Moment | What moves | Duration | Reduced motion |
|---|---|---|---|
| Arriving from the map | the shell's warp (in), then the letter fades in (`rd-enter`) | 650ms, then `--dur-base` | a cut, no fade |
| A section chosen | the page scrolls to it | smooth | instant |
| The sheet (under 1024) | rises in | `--dur-base` | none |
| Leaving (Back to the map, Leave planet) | the shell's warp (out), landing on the map with this planet selected | 650ms | a cut |
| Skeleton | the loading bars | shown after 400ms | still |

| Listen: the mark moves to the next block | the accent edge, and the page scrolls the block into view | `--dur-fast`; smooth scroll | a cut and an instant scroll. Asserted: `web-listen.spec.ts` gate 6 |
