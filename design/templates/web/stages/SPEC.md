# `/app/stages` — the discoveries list — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §8 row 6). Template: `template.jpg`
(`SOURCE.md`). Gate: `design/specs/web-stages.spec.ts`.

## Realm

The star system: `html[data-realm="star"]`, no `data-biome`. The star shell
(tab nav, mission panel, readout strip, key hints; the bottom bar on a phone).

## What it shows

- **The head**: "Stages", `N of 19 mastered · course mastery P%` (numbers in
  mono) and a meter
- **STAR SYSTEMS** (a HUD panel): the four grading periods as SYSTEM rows
  (name, stage range, `n of m mastered`), each followed by its stages as
  planet rows: the biome-tinted planet dot (dashed when locked, ringed when
  mastered), number, title, state in words (padlock beside "Locked", the
  percentage when in progress, a NEXT badge on the student's next stage, in
  their accent), and **a locked stage's reason printed on its row, always**
  (`SOLAR-SYSTEM-SPEC.md` §1.4b: this list never withholds)
- **The card**: the chosen stage, the map's BODY card (`map/body.tsx`, shared):
  mastery, State / Levels / Kind / Time / Check, the lock verbatim beside a
  padlock, the approved summary, the moons (objectives, in syllabus order), and
  the actions. At 900 and up it sits beside the list, sticky, scrolling inside
  itself when taller than the screen; under 900 it opens under its own row
- With nothing chosen, the card shows the stage `lib/next-stage.ts` names

## Controls and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **A planet row** (one radio group: one Tab stop, arrow keys walk the syllabus) | Shows that stage's card; `?stage=NN` | Number, title, state and lock in words | Choose another | The card names the stage's objectives and what gates it |
| **Enter journey** (open stages) | Into the planet: the warp, its biome, the reader | Verb and object | Leave planet | The stage itself |
| **Show Stage NN** (locked) | Chooses the stage the lock waits on | Names it | Choose another | Walks the prerequisite chain |
| **Show on the map** | `/app?stage=NN`: the same planet, open, on the 3D map | Verb and object | Stages tab | Where the stage sits by level |

## States

Loading: nothing under 400ms, a skeleton of the list after, words after 3s.
Error: the server's message and Try again (`ShellData.reload`). Empty cannot
occur (19 stages always exist; locked ones are listed).

## Captures (opened, 30 Sep 2026, build at 5185, student 232129006)

`current` (nothing chosen: the next stage, 06), `current-locked` (04: the lock
on the row and in the card), each at 1440 and `-380`; `current-inline-380`
(the card under its row).
