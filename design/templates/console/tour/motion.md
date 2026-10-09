# The console's tour — motion

| What | Motion | Duration | Reduced motion |
|---|---|---|---|
| The popover appears on each step | fades up 4 px (`tour-in`) | `--dur-fast` | none: it is simply there |
| The spotlight moves between targets | `top`, `left`, `width`, `height` ease | `--dur-base`, `--ease-out` | none: it cuts to the next target |
| The ? | colour and border ease on hover | `--dur-fast` | none |
| The 380 nav sheet opening for the tour | the shell's own sheet | as the shell | as the shell |

Motion is never the only signal: the accent ring and the popover's arrow are
readable from a still frame, and "n of N" says where you are.
`console-tour.spec.ts` gate 6 records every animation and transition with the
media feature emulated and asserts none runs longer than 1 ms.
