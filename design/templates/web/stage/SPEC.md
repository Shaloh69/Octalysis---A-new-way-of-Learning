# `/app/stage/:id` — SPEC

**One chapter's reading, from the database, verbatim, in one column a student
can read for an hour, over their biome. A rail says what the stage is for and
where they are in it. The page says plainly how to leave and what finishes the
stage, and a locked stage says why, from the server.**

`PAGE-SPECS.md` §/app/stage/:id is the plan: content left; a right rail at 1440
and a bottom sheet at 380 with the objectives, glossary terms, add to notebook
and section progress; figures as `kind='code'` blocks in mono, verbatim; a
full-page lock card naming the prerequisite and the current mastery.
`WEB-REVAMP.md` §2 adds: leave or finish the stage, the reverse travel
transition, mark read and resume, the Bring-Up. Reference: `SOURCE.md` (MDN's
article page). The biome is the page's background, behind the reading column
and never under the words (`BIOME-AND-LOADING-SPEC.md` §1b).

**Hard rule 5 governs every word of the reading.** The prose, figures and
objectives come from `GET /api/v1/stages/:id` and are rendered, never edited,
summarised or invented. **Hard rule 4 governs the lock.** The reason and the
distance are authored by the API from `is_stage_unlocked()` and printed
verbatim; the client computes no lock, no state and no threshold.

## What was missing — 29 Sep 2026, before the rebuild

Measured in `StageReader.tsx` and on the build, as `232129006` and `232129004`
(`before/*.png`):

- **Markdown drawn as text.** 47 `## ` and 3 `### ` headings in stages 01-07
  read with their hashes; 85 wrapped list lines made each such list one run-on
  paragraph with literal dashes; `*methods*` kept its asterisks; 19 table lines
  showed raw pipes; the 25 `quote` blocks looked like prose and lost their
  `source`; a `brief` nested `<p>` in `<p>` (NEXT-SESSION §0j.3)
- **The "← Map" button and the whole lock card were painted UNDER the biome.**
  Both are in the DOM; both are static siblings of a `position: fixed` scene,
  so on a locked stage a student saw objectives and nothing saying it is locked
- **The lock card did not name the prerequisite or the mastery.** The API's
  locked response carried no reason; only the map's `GET /api/v1/stages` did
- A 587px column with 45% of the page empty beside it; a clipped strip down
  the right edge; no Try again on a failed read; no 400ms rule; no words after
  3s; no reverse transition; nothing said what finishes a stage

## Instructor decisions, 29 Sep 2026

1. **Leave only.** *Back to the map*, at the top and again at the end, with the
   reverse travel transition. **No Finish button:** the end of the reading says
   in words what finishes the stage (its check reaching the threshold the API
   sends; a stage with no check says so). The Bring-Up stays with grading and
   is deferred. `stage_progress` is written by the grading service alone
2. **Resume, per device.** The rail's section list follows the section on
   screen; the last section reached is kept per device (`localStorage`, wrapped
   in try/catch; the page is whole without it; nothing gradeable, as the
   runner's flags). On arrival: *You were reading: <heading>* with **Resume**.
   No per-block "mark read" control: it would only change a number
3. **The lock reason comes from the server.** `GET /api/v1/stages/:id` returns
   the same `lockReason` the map authors, from one shared function in
   `routes/stages.ts`, with `state` and `masteryThreshold` beside it. Tested in
   `services/api/test/stages.spec.ts`
4. **The rail holds what has data.** The stage's sections (Brief, each `##`,
   Check) with the current one marked and `Section N of M`; the objectives, in
   words; the check's state. **Glossary and add-to-notebook are deferred:** no
   glossary data exists (hard rule 5 forbids writing one here) and there is no
   notebook table or `/app/notebook` page

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

"A Start button on a stage page" is on the mandate's kill list: **arriving is
starting.** Nothing here starts the stage. The one control that commits
anything is the check's, and it says what it costs.

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Back to the map** (head, end) | Leaves for `/app`, with the reverse travel transition | Verb and object | Yes; the reading position is kept on this device | — (navigation) |
| **A section** (rail; sheet at 380) | Brings that section to the top of the reading | The chapter's own heading | Yes | The list IS the chapter's outline, in the author's words |
| **Resume** | Brings the section last read on this device to the top | Names the section: *You were reading: RAID: what to do when a disk dies* | Yes | — |
| **Contents** (380 only) | Opens / closes the sheet with the rail's contents | Says the section: *Contents · 3 of 7*; `aria-expanded` | Yes; Escape or Close | — |
| **Go to Stage 07 Check** (end of the reading) | Opens the runner, which starts an attempt or reopens the one left open | Verb and object; beside it: attempts used of allowed, in mono, and that opening starts or resumes an attempt | **Stated up front**; leaving a paper keeps it open (the runner's SPEC) | The check is where the objectives above are measured |
| **Go to Stage 00** (lock card) | Opens the prerequisite the lock names | Verb and object, the id from `lockReason.blockingStages` | Yes | The lock IS the prerequisite graph |
| **Try again** (a failed read) | Repeats the read | Beside the sentence saying what failed | Yes | — |

The check's control is disabled with its reason in words when it has not
opened, has closed, or every attempt is used; dates and counts in mono.

## Layout

- **1440:** the reader's own ground (`--surface-0`) as two opaque surfaces
  over the biome: the **reading column** (max 46rem: back link, eyebrow
  `Stage 06`, the title, the meta line, the state line, Resume when there is
  one, then the brief, the sections, the check, the end) and a **sticky rail**
  (17rem: *In this stage* with `Section N of M`, the section list, the
  objectives, the check's state). The biome shows in the margins behind a
  token scrim, receding rather than competing
- **380:** one column; the rail's contents move into a **bottom sheet** opened
  by a pill fixed bottom-LEFT (*Contents · 3 of 7*), opposite the shell's
  *Report a problem* pill bottom-right, so neither covers the other. The page
  keeps room at its foot for both
- **Figures verbatim, and never sideways.** A `code` block is a mono figure
  with every line as written. Its lines run to 73 characters, which fit 380
  at no readable fixed size, and a figure that wraps is no longer the figure
  while one that scrolls sideways fails the gate. So each figure's mono size
  is `min(--text-sm, fit)`, where *fit* is the figure's own width over its
  longest line (`container-type: inline-size`; JetBrains Mono's advance is
  0.6em). A 30-character figure keeps the body size; the 73-character one
  shrinks until it fits. Pinch zoom stays available
- Tables wrap their cells; none scrolls sideways
- The shell's nav is inside `<main>` (NEXT-SESSION §0p.2), so the surface
  checks are scoped to `[data-reader]`, as the runner's are to `[data-runner]`

## Rendering the blocks

The renderer is a small parser (`lib/markdown.ts`, unit-tested), not a library:
the content is authored in this repo and reviewed in git. It supports exactly
what the content uses, measured over every block of stages 00-18:

| Content | Renders as |
|---|---|
| `## `, `### ` | `h2`, `h3` (the page's `h1` is the title). Each `##` opens a section of the rail |
| `- ` / `1. ` lists, with wrapped continuation lines | `ul` / `ol`; a continuation line belongs to its item |
| `> ` inside prose | `blockquote` |
| `\| … \|` tables | `table`; a header row only when it has words |
| `**bold**`, `*italic*`, `_italic_`, `` `code` `` | `strong`, `em`, `em`, `code` (mono) |
| a number in running text | a mono span: *"all numbers … render in mono"* (`.claude/rules/design.md`); the sentence around it stays prose |
| `brief` | the lead, larger, paragraphs as siblings (no `p` in `p`) |
| `quote` | `figure` + `blockquote` + a caption from `meta.source` (`ch-04.md 4.2` → *Chapter 4, §4.2*) |
| `callout` | an `aside` on its own surface; `planned`/`scaffold` keep *Coming in a later update* |
| `code` | a mono `figure`, verbatim, with `meta.caption` |

**No beat an archetype does not declare, and none the data lacks.** Every
archetype declares BRIEF, LEARN and CHECK, and those are what the blocks hold
(`brief`, the reading, the stage's assessment). PROBE, SORT, DRILL, TRACE,
LAB and the rest have no blocks (INV-27 warns on 9 stages), so the page shows
no placeholder for them.

## States

loading (the biome at once, as the arrival; **nothing else under 400ms**, a
skeleton of the head, the column and the rail after, and a sentence at its top
after 3s) · reading · **locked** (full page: eyebrow, title, *Not open yet*,
`lockReason.message` verbatim, *Go to Stage NN* for each blocking stage, the
objectives as a preview, Back to the map) · **no such stage** (404: the API's
sentence, Back to the map) · **a failed read** (what failed, Try again, Back to
the map) · **empty** (unlocked, no blocks: says the reading has not been
published, and keeps the objectives and the check) · offline (the shell's
banner). **Saving:** nothing on this page writes to the server, so no toast;
the reading position is kept on the device, silently.

## Words

- State line, from the API's `state` and `mastery`: *Not started* · *In
  progress: your best check is 45%* · *Mastered: your best check is 82%*;
  a stage with `gradeable: false`: *Not graded*
- The end: *End of the reading.* Then, with a check: *This stage is mastered
  when your best check reaches 70%* (the API's `masteryThreshold`); without
  one: *This stage has no check.*
- Loading after 3s: *Still arriving. The server may be waking up, which can
  take up to a minute.*
