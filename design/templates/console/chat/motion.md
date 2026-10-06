# `/chat` (console) — motion

| Moment | What moves | Duration | Reduced motion |
|---|---|---|---|
| A message arrives (sent, received, a room opened) | rises in (`octa-rise-in`) | `--dur-fast` | a cut. Asserted: `console-chat.spec.ts` gate 6, positive control first |
| The remove dialog | pops in, the scrim fades (shared `ease-dialog`) | `--dur-fast` | a cut |
| Choosing a room or a tab | background | `--dur-fast` | a cut |
| A toast | rises (shared) | `--dur-fast` | a cut |

The log keeps the newest message in view while the reader is at the bottom.
