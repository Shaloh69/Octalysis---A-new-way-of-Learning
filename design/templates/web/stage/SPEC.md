# `/app/stage/:id` — the reader, remade — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §3). Templates: `template.png`
(Stardew Valley's letter: a wide parchment over the world) and
`template-journal.png` (Stardew's journal: a scroll tab, framed rows with
badges), copied from `_direction/biome/` (sources and statuses in
`_direction/SOURCE.md`; both opened). The 29 Sep first pass (MDN's article page)
is kept in `first-pass/` as history: its behaviour carried over, its look did
not. Gate: `design/specs/web-stage.spec.ts` (with `arrival.spec.ts` and
`biomes.spec.ts`).

## Realm

Inside the planet: `html[data-realm="biome"][data-biome=<the planet's>]`. The
biome shell holds the page (sprite nav bar, the scene, the bottom bars).

## What it shows

- **The side bar** (`.rd-side`, a sprite panel, 1024 and up): "In this stage",
  "Section N of M", the sections (Brief, every `##`, Check), the current one
  marked in the student's accent (their own place) with a filled mark and bold
  words, and "What you should be able to do", in the syllabus's order (06.1,
  06.2 … 06.10: §0r.1 fixed here).
- **The letter** (`.rd-letter`, a sprite panel on the biome's paper): stage
  number, title, time and levels in mono, the state in words; Resume when a
  position is kept; the reading (`ReaderBlocks`: headings, lists, callouts,
  textbook quotes, figures verbatim and fitted, tables); the check card
  (Stardew's quest card); the end, which says what finishes the stage.
- **At 1023 and under**: a sprite Contents button (sticky, clear of the tab
  bar) opens the side bar as a sheet.

## Controls, against the mandate's four tests

| Control | Consequence | Legible | Reversible | Teaching |
|---|---|---|---|---|
| A section in the side bar or sheet | scrolls to it, focus follows | its heading's words | scroll | the stage's shape |
| Resume | back to where this device left off | names the section | scroll | — |
| Go to the check | opens the runner's start prompt; the attempt starts (or resumes) only on its Start, in full screen (ruling 3; the card says so first) | yes, with attempts used | Reading tab | — |
| Back to the map (the end; the shell's Leave planet at the top) | the map, this planet selected, through the warp | yes | Enter journey | where it sits |
| Go to Stage NN (locked) | the prerequisite | yes | Back | the chain |
| Try again (error) | reads again | yes | — | — |
| Contents / Close (sheet) | shows / hides the side bar | yes | yes | — |

## States

Loading (`[data-reader="loading"]`): the shell's biome at once; nothing under
400ms; a skeleton shaped like the side bar and the letter; words after 3s.
Error: the API's sentence, Try again, Back to the map. Missing: the sentence and
the way back, no retry. Empty: "not published yet", objectives kept. Locked:
the server's reason verbatim beside a padlock, Go to Stage NN, the objectives
as a preview.
