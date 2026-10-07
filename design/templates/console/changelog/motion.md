# /changelog — motion

| What moves | How | Reduced motion |
|---|---|---|
| A disclosure's background on hover | `background-color`, `--dur-fast` (160ms), `--ease-out` | cut (`--dur-fast: 0ms`) |
| Opening "All n changes" | none: the list appears, the chevron turns from ▸ to ▾ | the same |
| The index links | none (an anchor jump) | the same |

Nothing ambient. Asserted by `console-changelog.spec.ts` 6 (a hover eases with
motion allowed; nothing over 1ms with `reduce` emulated).
