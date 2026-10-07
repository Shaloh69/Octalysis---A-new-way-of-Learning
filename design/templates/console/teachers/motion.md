# `/teachers` — motion

The page is `/students`' family, so it moves as `/students` does
(`design/templates/console/students/motion.md`). Recorded here is what it has.

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| **A dialog opens** (import, disable, assign) | `ease-dialog`: fade and a small zoom | `--dur-base` | **Cut**: it is there on the first frame |
| **The row menu opens** | the dropdown's fade | `--dur-fast` | **Cut** |
| **A filter is pressed** | the button's background and border | `--dur-fast` | **Cut** |
| **The skeleton** (first load past 400 ms) | static bars | — | Same |
| **A write lands** | a toast saying what happened to whom; the list reloads in place | toast `--dur-base` | The toast appears without sliding |

Nothing moves on its own: no polling, no ambient loop.

Proved by `console-teachers.spec.ts` assertion 6: a positive control (a
dialog eases in with motion allowed), then every animation and transition
through a dialog and the import preview ≤1ms under emulated reduced motion.

**Captured after the ease-in.** A dialog captured as it opens is still half
transparent and reads as a defect (seen 7 Oct 2026); the capture test waits
past it.
