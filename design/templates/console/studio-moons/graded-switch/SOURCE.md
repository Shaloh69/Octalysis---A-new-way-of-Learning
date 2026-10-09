# The Graded switch on a moon: source and spec

Added 9 Oct 2026, with `docs/GRADED-MOONS-PLAN.md` (instructor, 8 Oct 2026: "add a
control for each moons to be able if graded or not").

## Reference (captured, opened)

- **URL:** https://ui.shadcn.com/docs/components/switch
- **Captured:** 9 Oct 2026, Playwright at 1440, HTTP 200, title "Switch - shadcn/ui"
- **What rendered:** the Switch page; the demo is a track-and-thumb switch with its
  label beside it ("Airplane Mode"), off state shown. `template.png` is that page.
- **What was taken from it:** the pattern only: a track with a sliding thumb, the
  label as part of the control, `role="switch"` and `aria-checked`. Our console owns
  its components in-repo and ships no Radix Switch, so it is hand-built in
  `MoonsEditor.tsx` (`GradedSwitch`) with `.mn-switch*` in `index.css`, in our tokens.
- **What is ours, by design:** the colour (accent track when on), and the WORD beside
  it ("Graded" / "Practice only"), because a position and a colour are not enough on
  their own.

## The control against the four tests (`docs/DESIGN-MANDATE.md` §1)

| Test | The Graded switch |
|---|---|
| Consequence | Pressing it stages a change that, once published, makes the moon's check a graded paper (one more quiz) or practice only. It changes what students can do and what the gradebook counts. |
| Legibility | A word ("Graded" / "Practice only"), a thumb position, and a sentence of what it means beside it; a pending flip says "Grading change waiting to publish". |
| Reversibility | Pressing it back drops the staged change (nothing is saved as a no-op). Publishing is the point of no return, and every sitting is kept either way. |
| Teaching | The Publish dialog names the gradebook effect before it happens ("The gradebook changes. 01.2 stops counting. Every sitting is kept."). |

## Keyboard and motion

Space (and Enter) toggles it. It stays focused while the save runs (`aria-disabled`
while busy, not `disabled`, which dropped focus; found by the spec). Under reduced
motion the thumb snaps.

## Captures (all opened, 9 Oct 2026, local API, 1440 and 380)

`../current-graded` (a flip waiting), `../current-graded-publish` (the dialog),
each with `-380`.
