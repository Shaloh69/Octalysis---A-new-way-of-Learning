# `/app/stage/:id` — motion

| Moment | What moves | Duration | Reduced motion |
|---|---|---|---|
| Arriving from the map | the shell's warp (in), then the letter fades in (`rd-enter`) | 650ms, then `--dur-base` | a cut, no fade |
| A section chosen | the page scrolls to it | smooth | instant |
| The sheet (under 1024) | rises in | `--dur-base` | none |
| Leaving (Back to the map, Leave planet) | the shell's warp (out), landing on the map with this planet selected | 650ms | a cut |
| Skeleton | the loading bars | shown after 400ms | still |

| Listen: the mark moves to the next block | the accent bar | `--dur-base` | a cut |
| Listen: the sentence being said | its tint and the word's light move with the voice | at once (it follows speech) | the same |
| Listen: the line under the sentence | fills left to right, line by line, over the sentence's estimated length; word to word when the voice reports words | linear, the sentence's length; `--dur-fast` per word | drawn full at once, or to the word at once |
| Listen: the strip's progress line | glides through the sentence being said | linear, the sentence's length | jumps per sentence |
| Listen: the strip arrives | rises in | `--dur-base` | a cut |
| Listen: keeping the sentence in view | the page scrolls when the sentence nears the strip or the top | smooth | instant. Asserted: `web-listen.spec.ts` gate 6 |
