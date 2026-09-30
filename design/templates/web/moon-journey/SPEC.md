# `/app/stage/:id/moon/:objectiveId`: a moon's journey, SPEC

WEB-REVAMP §3.2 item 5 and §3.7a; instructor decisions of 30 Sep 2026.
Practice on one objective's own live questions. **Never graded**: its correct
answers are written to `objective_progress` and count toward the moon, and a
planet's moons, all mastered, open the next planet. Template: `template.png`
(the runner's own; see `SOURCE.md`). Gate: `design/specs/web-moon-journey.spec.ts`;
the server's half is `services/api/test/journeys.spec.ts`.

## The surface

The runner (`components/AttemptRunner.tsx`) with `journey={{ objectiveId }}`.
Everything in `design/templates/web/stage-check/SPEC.md` about **the paper**
holds: biome chrome (the planet's; a moon wears its planet's, §3.5), the
question palette as the planet's sprite side bar, and everything a student
reads or answers on `[data-paper]`, the one neutral set. Choose then Record;
the first recorded answer is the one that counts; a verdict at once, in words,
and a wrong one neutral; a resumed journey restores the answers given.

## What practice owes that a paper does not (decision 2: practice)

- **No prompt, no Start, no full screen.** It opens at once
  (`POST /api/v1/objectives/:id/journey`), never `/attempts`
- **Nothing is held, covered or recorded.** Leaving the page or full screen
  covers nothing and posts no `attempt_events`; the shell keeps Leave planet,
  its tabs and its keys ("Paper in progress" never appears)
- **Back to the moon, always**, beside Finish: it returns to the map with the
  planet and the moon chosen (`/app?stage=NN&moon=NN.N`, §3.3)
- **The header says what this is:** "Moon journey · practice", the moon's
  code, the objective in the syllabus's words, and the rule: never graded, two
  different questions answered right master the moon
- **Finish** asks once ("Finish Moon NN.N?"), names what is unanswered and that
  the next visit starts a new journey; no "cannot be undone", because nothing
  graded is at stake. The result is the runner's, headed "Journey finished"
- **Left midway it resumes; finished, the next entry is a new paper.** (The
  question put to the instructor described "the next visit is a new attempt";
  this is that, for a finished journey, and a resume for an unfinished one.)

## The server's refusals, printed verbatim

| Answer | When | The page |
|---|---|---|
| 403 "This moon's planet is locked." | the planet is shut for this student (hard rule 4, `is_stage_unlocked()`) | "This journey did not open", the sentence, Try again, Back to the moon |
| 409 "This moon has no questions yet." | no `live` question (fail-closed, decision 3) | the same, with that sentence |
| 404 | no such moon, or not on this planet (the page checks `NN.` prefix first) | an error state with Back to the map |

## Controls

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| An option / ordering moves / the answer box | Selects; records nothing | "Choose an answer, then record it" | Yes, until Record | The question itself |
| **Record answer** | Records the answer; the verdict at once; a correct one counts toward the moon | Says it is final for the question | No (first write wins) | The rationale, and the key when wrong |
| Question palette, Previous, Next | Moves between the moon's questions | ✓ recorded, current marked | Yes | — |
| Flag to come back to | Marks it on this device | ⚑ and aria-pressed | Yes | — |
| **Finish the journey** | Ends this journey (submit); the result | Asks once, names what is open | No, but a new journey is one press away | The result by objective, what was missed and why |
| **Back to the moon** | Leaves; the journey stays open | "Answers you recorded already count" | Yes: entering again resumes | — |

## Captures (all opened, 30 Sep 2026, on the build at 5185, fixture data)

`current` (jungle, resumed, a wrong verdict), `-fresh` (desert, nothing
recorded), `-ordering` (cave), `-confirm`, `-done` (jungle), `-error` (arctic,
a locked planet's moon); each at 1440 and `-380`.

## A moon's minigame (30 Sep 2026)

A moon that carries an encounter (`encounters/registry.ts`; §3.6, approved)
shows it **below the paper, never around it**, in its own section wearing
`data-encounter`. The first is moon 01.2's Two Columns
(`design/templates/web/encounter-sort/`). A moon without one is its practice
alone, and is not unfinished.
