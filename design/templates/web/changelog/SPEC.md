# `/app/changelog` — What's new — SPEC

**What changed in OCTA for the student, newest first.** Instructor, 7 Oct
2026 (night): "Add Changelogs to both the admin/teachers and student web to
show the Updates We made." Answered the same night: **students see their
changes only**, and one simple line of progress; no console, database or
phase jargon (the full commit list is the console's `/changelog`).

Reference: `SOURCE.md` (Linear's changelog: a date rail beside each update;
the date above the card on a phone). Worn in the star HUD (`looks.css`),
the star system's one look (WEB-REMAKE.md). Colours and type are ours.

## Data

`apps/web/src/generated/changelog.json`, written by `pnpm changelog`
(`scripts/changelog.mjs`) from `content/changelog/highlights.json`'s
`students` lists and the redesign's counted boxes. Nothing is fetched, so the
page has no loading or error state: it is in the bundle.

## Structure

1. **Where it is reached:** "What's new" in the HUD's top strip, beside Sign
   out (a link, `aria-current` on the page). Not a seventh tab: the bottom bar
   at 640 keeps its six.
2. **Header:** h1 *What's new* (the HUD face), one line: "What changed in OCTA
   for you, newest first."
3. **How far it is** (a `hud-panel` with its caption): "The student app's
   redesign: 238 of 245 steps done (97%)." and a meter. Neutral ink, never the
   accent (the accent marks only a student's own progress), and worded as the
   redesign's steps, because that is what is counted: it does not claim the
   whole platform is 97% built.
4. **Updates**, an ordered list, newest first. Each: a dot and the date (mono)
   on the rail, and a `hud-panel` card: the update's title (h2, the HUD face)
   and what changed for students, as a list. At 640 and under the rail goes
   and the date sits above its card.

## Controls, and the four tests

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **What's new** (top strip) | opens this page | a labelled link; current when here | Back, or any tab | — |

The page itself has no control: it reports. (DESIGN-MANDATE §1: nothing is
added that only changes a number.)

## States

None to load: the data is in the bundle. An update with no student-facing
change is not listed (it is on the console's changelog).

## Type and colour

Dates and numbers mono; titles in the HUD face (never a number in it: the
date is mono, outside the title); body in Inter. No red, no warning colour:
nothing here is a problem.

## The gate

`design/specs/web-changelog.spec.ts`, at 1440 and 380: the six assertions on
the route, plus: every update in the generated file is listed with its items;
the progress line equals the file's; the top strip links here from another
star page; no phase id, commit hash or console route appears. Captures
`current.png`, `current-380.png`, opened.
