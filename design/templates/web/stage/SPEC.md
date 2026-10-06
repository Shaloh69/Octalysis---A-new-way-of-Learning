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

## Orientation finishes itself (instructor, 5 Oct 2026)

"If orientation is done reading, automatically mark it as mastered then move
to the next stage." For an UNGRADED stage (Orientation is the only one) the
end of the letter carries a finish block (`ReadToTheEnd`):

- **Reaching the end records it**: the end of the letter coming into view
  sends `POST /api/v1/stages/:id/read` once. The SERVER records the stage
  mastered (`stage_progress.mastery = 1`) and names the next stage by
  curriculum order; it refuses a graded stage, a locked or unknown one, staff
  without a student ID, and no token (`services/api/test/orientation.spec.ts`,
  denials first). The lock rule does not change: Orientation never blocked 01.
- **It says so, then carries**: a status line ("Stage 00 is mastered. Taking
  you to Stage 01 in 5s."), a success toast, the map's data reloaded, and after
  5 seconds the student is on Stage 01. **Go now** and **Stay here** are
  real controls. A countdown in words, not motion, so it runs under reduced
  motion too.
- **Only the first finish carries**: a stage already mastered offers "Go to
  Stage 01" and never records or moves again. A failed record says so, stays,
  and offers Try again (error toast, `role=alert`).
- A graded stage has none of it: its moons master it.

Controls against the mandate: Go now and Stay here each change where the
student is (consequence), say so in words (legibility), and Stay here undoes
the carry (reversibility). Captures (5 Oct 2026, build at 5185):
`current-orientation-done`, `-380`, opened. `web-stage.spec.ts` 62 passed,
8 one-width skips, at 1440 and 380 (twice; a first run against a dev API ten
seconds into a cold start failed 5 and is not counted).


## Listen — the audiobook (6 Oct 2026)

Instructor rulings (`docs/FIGURES-AND-AUDIO.md`): the browser's own voice now
(Web Speech API), MP3s later. `components/ListenBar.tsx`, `lib/listen.ts`
(the text and the plan, unit-tested), `lib/follow.ts` (the page half); gate
`design/specs/web-listen.spec.ts`. Template: `template-listen.png`
(SOURCE.md): a read-aloud page mid-playback, with the word lit and a progress
bar.

It **follows the voice** (instructor, 6 Oct 2026: "change the way it follows
or highlights the sentences while it reads, with animation like a line or
progress bar along the bottom"):

- the **sentence** being said is tinted with the student's soft accent (the
  CSS Custom Highlight API, so the text is never rewrapped or re-rendered);
- the **word** being said is lit solid where the voice reports words
  (`onboundary`; Google's online voices do not, and then only the sentence moves);
- a **line under the sentence** fills as it is read: gliding on an estimate,
  or jumping word to word when words are reported;
- a **strip along the bottom**, just above the biome's bottom bar, carries
  Pause / Resume / Stop, "Sentence N of M" and the lesson's progress line, so
  the controls stay in reach however far the reading scrolls;
- the block keeps a rounded accent bar at its left; a block whose sentences
  cannot be found on the page (a table read row by row) keeps the tinted panel.

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Listen** (header) | the lesson is read aloud from the start | the strip appears; the sentence is lit | Stop | hear the lesson hands-free |
| **Pause / Resume / Stop** (strip) | the voice holds, carries on, or ends | "Paused: sentence N of M"; the lines hold still | Resume, Listen | — |
| **Speed** 0.75× to 1.5× | the voice's rate, from the paragraph being read | pressed, in mono | pick another | — |
| **Voice** | another of the device's English voices, from the paragraph being read; remembered per device | the select shows it | pick another | — |

Reads prose, headings, list items, quotes, callouts and tables (row by row,
cells named by column); a figure only by its caption; **never a code listing**.
Whole paragraphs per utterance where the voice allows (Google voices: up to 200
characters, whole sentences). Leaving the page stops the voice. No speech
synthesis: no control, one line says so. Never on a paper (hard rule 9): only
the reader mounts it.

Captures (opened, 6 Oct 2026, build at 5185, student 232129006, stage 06):
`current-listen-idle.png` / `-380`, `current-listen-playing.png` / `-380`
(first sentence, its line starting to fill), `current-listen-follow.png` /
`-380` (word by word, mid-paragraph).
