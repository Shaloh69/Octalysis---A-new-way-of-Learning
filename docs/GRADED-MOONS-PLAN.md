# Graded moons — plan v1, RULED 8 Oct 2026 (night)

Instructor, 8 Oct 2026 (night), after being told that a moon's journey is practice
and never reaches the gradebook:

> "No, I want everything to be graded. Moons are still as important as checks.
> Add a control for each moon to be able [to say] if graded or not."

Asked once, with a recommendation each; every answer was the recommended one:

| # | Asked | Ruled |
|---|---|---|
| 1 | How is a graded moon sat? | **Like a stage check**: a paper under hard rule 9 (start prompt, full screen, leaving submits, a recorded leave), several sittings with the best counting. The journey stays open practice beside it, and the practice is not graded |
| 2 | Where does it count? | **Into Quizzes**, as one more quiz weighing **the same as a stage check**, inside the syllabus's fixed 30%. The weights (Project 20, Quizzes 30, Exams 30, Labs 10, Participation 10) do not move |
| 3 | Starting state, and who flips it | **All 115 live moons start graded.** A teacher flips each moon in the Studio, through Draft then Publish with a reason, audited, because it changes grades |

A fourth ruling, the same night, from looking at a moon on the student's screen
(instructor: "when entering moons, instead of auto checks it defaults to this", about the
page headed "Moon journey, practice, never graded"):

| 4 | What does entering a moon do? | **For a graded moon, Enter goes to the CHECK**, the graded paper, behind its start prompt. Practice is still there, one step lower ("Practise first"), and a moon switched to not graded enters practice as before. The map's Enter key, the moon panel's main button and the stage page follow the same rule |

**Supersedes** WEB-REVAMP 3.7a's "a moon's journey is never graded, never in the
gradebook" for moons marked graded, and root `CLAUDE.md` hard rule 9's last sentence
("a moon's journey is practice and is exempt") for the journey ONLY: the journey is
still exempt; the moon's CHECK is a paper.

## What a graded moon is

- **`objectives.graded`** (boolean, default true). A draft moon is created graded.
  Flipping it is an edit like a wording change: a pending change, Publish, a reason,
  an audit row.
- **A moon check**: a new blueprint scope **`'moon'`**, one per moon (like a
  journey's), created lazily by the API the first time a student asks, with its own
  assessment and salt. It samples the moon's OWN live questions, every one the moon has
  (a moon holds three or four), seeded per student and attempt as a stage check is.
  Attempts allowed: **5**, as a stage check (instructor ruling 9 Sep), the best counts.
- **It is a paper**: every `scope <> 'objective'` test in the system already treats it
  as one: the sitting sweep (`sitting.ts`), the chat closing (`chat_paper_open`), the
  console's graded-work list. The student app runs it through the same `CheckPage` and
  `AttemptRunner` as a stage check, so Start, full screen, the page guard and the
  recorded leaves are the same code, not a second copy.
- **Its correct answers still count toward the moon** (`objective_progress`, which opens
  the next planet), exactly as a stage check's do. A moon check does not write
  `stage_progress` (that is the stage's).
- **Not sat is not zero.** As the gradebook has always said of a stage check: a moon
  check nobody in the class has sat is left out, and becomes a 0 inside Quizzes only once
  the class has sat it. So turning 115 moons on does not zero anyone.
- **Turning a moon off** removes it from the gradebook (the attempts and their answers
  stay: append-only, and a re-enable brings the marks back). Turning it on adds it.
- The moon **journey** is unchanged: open practice, no limit, no lockdown, not graded.

## Where it appears

- **Student**: the moon's panel on the map says **Graded** or **Practice only**. For a graded moon its main button, and the Enter key, is **Sit the moon's check** and **Practise first** is the second button; for a moon not graded, **Enter journey** is the only one (disabled with the server's
  reason when the planet is locked or the moon has no questions). The check opens at
  `/app/stage/:id/check?a=…&m=<moon>` behind its start prompt.
- **Teacher (Studio)**: a **Graded** switch on each moon row of a chapter. The Publish
  dialog says what changes in grades and how many students have already sat that moon's
  check.
- **Gradebook**: moon checks are columns beside the stage checks, inside Quizzes.
- **Student record (console)**: moon-check attempts are in the graded list (scope
  'moon').
- **Console `/assessments`**: moon checks are created by the API per moon and are NOT
  listed there (a teacher manages stage checks and finals there; a moon check is managed
  by the moon's switch).

## Not in this plan

- A different number of attempts per moon, or a window (`opens_at`/`closes_at`) per moon
  check: a moon check has none until the instructor asks.
- Weighting a moon differently from a check.
- Grading a moon through the AI or the bot.
- The console's `/assessments` listing moon checks.

## Order

Database (the eighteenth SQL file, on Supabase before the code, hard rule 10) -> denial
tests red first -> the API (engine, the check route, the gradebook) -> the student's moon
panel and check route -> the Studio's switch -> each page's gate at 1440 and 380.

## Built — 9 Oct 2026

All of the order above, in three commits (`220e04e` db + api, `4e141db` console, `1c72f8b` web).

- **Database:** `db/addendum-graded-moons.sql` (the eighteenth file). `objectives.graded`
  (default true; **all 115 live moons are graded on the deployment**), `objective_edits.graded`
  (null = unchanged), scope `moon` with exactly one check per moon, `live_objectives` carries
  `graded`, INV-12 exempts moon papers. Applied to Supabase (ref ddvxkbcelpqydnjkffdr,
  checked) before the push; invariants 0 failures.
- **API:** `POST /objectives/:id/check` (404 unknown/unpublished, 403 locked, 409 not graded or
  no live questions; creates no attempt, so nothing of the paper exists before Start). A moon
  check is sat like a stage check (five attempts, the best counts); the journey stays
  unlimited and ungraded. The gradebook: Quizzes is the mean over the stage checks sat AND the
  graded moon checks sat; a switched-off moon drops out and its sittings are kept; the CSV gains
  `moon_<id>` columns. The Studio's Publish applies `graded`, says so in its moves and audits a
  `grading` list (id, new state, students who had sat it).
- **Student app:** the moon panel's Grading row, **Sit the check** (Enter) with **Practise first**
  beside it; a moon not graded keeps **Enter journey**. A graded moon's journey says it is not the
  graded check and links to it. The check's start prompt says "moon", not "stage".
- **Console:** a Graded switch on each moon row (a word and a position, `aria-disabled` while it
  saves so keyboard focus survives); flipping back drops the staged change; the Publish dialog
  states the gradebook effect before it happens; the add form asks "Graded" (on by default). The
  gradebook's third view, **Moon checks**.
- **Also in this commit range:** `RouteBoundary` (web) and `PageBoundary` (console) so one render
  fault shows a retry instead of an empty page, after `/students/:id` went blank when an attempt
  was opened (an answer shaped `{index}` was rendered as an object).

**Measured:** `pnpm verify` exit 0 (API 1220 passed, web 336, console 272). Playwright:
`web-moon-check` 23, `console-studio-moons` 49 + 1 skip, `console-gradebook` 15 moon tests
beside the existing 52. **Not green, not mine:** `console-studio.spec.ts:637` asserts
`/classes? tak/`, which cannot match "1 class takes" (the regex needs "classe"); the local DB has
one class. Fix the regex to `/class(es)? take?s?/` or seed two classes.

**Not verified / open:** a graded moon sat end to end on the deployment by a real student; the
deployed Vercel/Render builds after this push; the 380 gradebook list with 18+ moons is a list by
rule, tested with 30.
