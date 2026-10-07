# `/teachers/:key` — motion

The same family as `/teachers` (`design/templates/console/teachers/motion.md`).

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| **A dialog opens** (assign, end or re-open a class, change a book, disable) | `ease-dialog`: fade and a small zoom | `--dur-base` | **Cut** |
| **A class menu opens** | the dropdown's fade | `--dur-fast` | **Cut** |
| **The skeleton** (first load past 400 ms) | static bars in the four stat cards | — | Same |
| **A write lands** | a toast saying what happened; the record reloads in place | toast `--dur-base` | The toast appears without sliding |

Nothing moves on its own. Proved by `console-teachers-detail.spec.ts`
assertion 6 (a positive control, then ≤1ms under emulated reduced motion);
dialogs are captured after their ease-in.
