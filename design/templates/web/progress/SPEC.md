# `/app/progress` — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §8 row 7). Template: `template.png`
(`SOURCE.md`). Gate: `design/specs/web-progress.spec.ts` (and the state tests in
`student-states.spec.ts`).

## Realm

The star system: `html[data-realm="star"]`, no biome; the star shell.

## What it shows

- **Depth**: the emblem, the Computer Level Hierarchy as seven rings (L6
  outside, L0 at the core) lit down to `depth`; "Depth L<n>", the level's name
  only once stage 11 is open (the mission panel's reveal rule), and one line
  on what depth means. Decorative SVG, `aria-hidden`; the caption says it all
- **Survey**: stages mastered `n/19`, course mastery `P%`, cells at mastery
  `k/r` (r = cells an objective reaches), each a meter printing its number;
  the mastery threshold in words
- **READ / TRACE / BUILD**: the 21 cells, seven labelled meters each
  (`L<n> <name>`, the percentage in mono). A cell no objective reaches is
  listed, says "No objective yet", and has a dashed empty track
- **Empty** (no mastery anywhere): an invitation with Go to Stage NN

No controls of its own beyond Go to Stage NN (empty state) and Try again
(error). The four tests: Go to Stage passes all four (it enters the stage the
grid is waiting on); the page otherwise changes what the student KNOWS, which
is its job.

## Deferred, recorded (PAGE-SPECS.md §/app/progress)

PAGE-SPECS asks also for **per-objective mastery**, **attempt history as a
growth curve**, and **competency-named badges**. None is served:
`GET /api/v1/progress` returns the 21 cells and depth only, and no endpoint
returns a student's attempt history. Not built, deliberately, until an API
serves them; this line is the record (`NEXT-SESSION.md`).

## States

Loading: nothing under 400ms, the hub and three panels' shapes after, words
after 3s. Error: the shared `ErrorState` (the page's h1, the reason, Try
again). Offline: the shell's banner.

## Captures (opened, 30 Sep 2026, build at 5185, student 232129006)

`current` / `current-380` (the first screen), `current-full` /
`current-full-380` (the whole page; the fixed bars land mid-image in a
full-page capture, an artifact of the capture, not the page).
