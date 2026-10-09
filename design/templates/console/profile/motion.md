# `/profile` (console) — motion

Recorded, not invented: the page uses what the console already moves with.

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| **The account menu opens** | the dropdown's fade | `--dur-fast` | **Cut** |
| **A dialog opens** (Remove picture, on `/students/:id`, `/teachers/:key`, `/chat`) | `ease-dialog`: fade and a small zoom | `--dur-base` | **Cut**: there on the first frame |
| **The picture changes** (a new one is set, or removed) | none: it swaps in place | — | Same |
| **Dragging the picture on the stage** | the pointer moves it directly; no easing | — | Same |
| **The skeleton** (first load past 400 ms) | static bars | — | Same |
| **A write lands** | a toast saying what happened | toast `--dur-base` | The toast appears without sliding |

Nothing moves on its own: no polling, no ambient loop, no spinner on the picture.
Proved by `console-profile.spec.ts` assertion 6 (a positive control that a
dialog eases in with motion allowed, then every animation and transition on the
page and in the dialog at most 1 ms under emulated reduced motion).
