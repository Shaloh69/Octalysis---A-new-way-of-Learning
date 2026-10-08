# The tour — motion

One orchestrated moment is still one per stage (the Bring-Up); the tour is a
help surface and keeps its motion small.

| What | Motion | Duration | Reduced motion |
|---|---|---|---|
| The popover appears on each step | fades up 4 px (`tour-in`) | `--dur-fast` | none: it is simply there |
| The spotlight moves between targets | `top`, `left`, `width`, `height` ease | `--dur-base`, `--ease-out` | none: it cuts to the next target |
| The ? | colour and border ease on hover | `--dur-fast` | none |

Motion is never the only signal: the spotlight's accent ring and the popover's
arrow are readable from a still frame, and "n of 9" says where you are.
`web-tour.spec.ts` gate 6 records every animation and transition with the media
feature emulated and asserts none runs longer than 1 ms.
