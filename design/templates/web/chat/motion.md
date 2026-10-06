# `/app/chat` — motion

| Moment | What moves | Duration | Reduced motion |
|---|---|---|---|
| A message arrives (sent, received, a room opened) | fades in, rising 4 px | `--dur-fast` | a cut. Asserted: `web-chat.spec.ts` gate 6, positive control first |
| Choosing a room | the button's fill | `--dur-fast` | a cut |
| A toast (delete, a failed send) | rises (shared) | `--dur-base` | a cut |

The log keeps the newest message in view while the reader is at the bottom; a
reader who scrolled up is not pulled down by a new message.
