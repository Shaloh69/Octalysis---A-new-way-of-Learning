# `/live` and `/live/present` — SPEC

**Lecture Mode: what the room is doing, in aggregate, and one question put to
the room. The projector view is read from the back of a lecture hall and names
no one, ever.**

`PAGE-SPECS.md` §/console/live is the plan: *"Push an item to all connected
students. Live aggregate distribution via Supabase Realtime. Separate
projector view at `/console/live/present` — large type, high contrast, no
names. Timer for collective timed challenges (framed as a class effort, not
individual pressure)."* `MASTER-PLAN.md` §6.2, `GAME-LAYER.md` Petals 5-6,
`DESIGN-MANDATE.md` §5.4 and `VISUAL-SYSTEM-3D.md` (no decoration on the
projector; "aggregate bars must be legible from the back row") agree.

References: `SOURCE.md` (shadcn.io's Session Analytics for the control view,
Awards Vote Results for the projector, Quick Poll for starting a question).
Colours and type are ours.

## What was missing — 29 Sep 2026, before the rebuild

Measured in the browser against the build, with the API alive:

- **The page polled in a tight loop: 2,467 requests in 10 seconds.**
  `useEffect(..., [snap])` restarted the poll on every response, so "every 5
  seconds" was ~250 a second, against a Render free-tier API, for as long as
  the projector was up
- **The projector was an overlay at `?present=1`** over the shell: Tab walked
  through five nav links hidden behind it, with focus invisible, and it had no
  way out but the browser's Back
- **"Anonymity: safe to show" with 0 people working**, and a projector headed
  *Where the room is* over bars that were every student's all-time average
- `GET /live/health` existed and the page never called it
- The API's `spread` grouped answers by question *number* across every open
  paper (question 3 of one stage check mixed with question 3 of another), and
  the page never drew it
- A stage's average went to the projector however few students it covered:
  one student on stage 07 was "07 · 1 student · 83%"
- "Working now" counted a paper only by its start: a student 25 minutes into
  one dropped out of the count
- **Push, sessions, the timer: not built.** No student end exists either:
  `/app/live` is not a route in `apps/web`

## Instructor decisions, 29 Sep 2026

1. **Build the server and console half of "push an item".** One question at a
   time, course-wide; a LIVE item only; who may answer (everyone or one
   section); **started and ended with a reason**, each an `audit_log` row with
   the actor. The split is scoped to that question. Students cannot answer
   until `/app/live` exists, and the page says so, plainly, where the teacher
   starts one
2. **The projector is its own route, `/live/present`**, staff-guarded, outside
   the shell's nav, with an Exit control and Escape. `?present=1` redirects
3. **A stage's average is withheld below five students** (server side, like
   the split); **the health strip** is shown; **"working now" counts
   activity** (a paper started or answered in the last 20 minutes); **honest
   labels** (the class so far, by stage, not "where the room is") and **stage
   titles** beside the numbers
4. **The timer is deferred** with the student half: it times a pushed
   challenge, and students cannot answer one yet

Realtime: **still polled, every 5 seconds**, as `live.ts` recorded. The
teacher's view loses nothing by it; the local stack has no Realtime, so a
pushed version could not be tested here; and `AUDITS.md`'s "< 1.5 s fanout to
40 clients" is about delivering a question to students, which is the unbuilt
half. That target is for the `/app/live` session.

## `/live`, top to bottom

1. **Header**: *Live* (h1), a line saying what the page is and that no name is
   loaded for it; **Open the projector view** (a new window, so the laptop
   keeps the controls while a second screen shows the room). Under it, when
   the page last read, in mono, and that it reads every 5 seconds
2. **A stale notice** when a read fails after a good one: the numbers stay,
   and the notice says they are the previous reading
3. **The question** (a card):
   - none running: *No question is running*, what starting one does, and the
     sentence that students cannot answer yet; **Start a question**, disabled
     with the reason beside it when no item is live (today: all 96 act-1 items
     are at review), and a link to Items
   - running: the item's slug (mono) and type in words, the stage number and
     title, the objective's own words (never the stem), who may answer, since
     when; **Answered** and **Correct** as figures; the class's share as one
     bar, or *held back until 5 have answered*; **End question**
4. **The room**: four counts in one row (2×2 at 380): *Working now*, *Papers
   open*, *Handed in* and *Reports*, each "in the last 20 minutes", the last
   linking to Feedback when it is not zero
5. **The class so far, by stage**: a row per stage with any progress: number
   (mono), title, a bar, the average (mono) and how many students; a withheld
   row says *fewer than 5, not sent* instead of an average, and no bar
6. The claim, unconditional: *No name, student ID, or user ID is ever loaded
   for this view — not filtered out here, never fetched. A field that is not
   loaded cannot leak.*

The page lays out on its **own width** (CSS container queries on `.lv`): the question's
figures beside its words at 44rem and up, stacked below; four counts in a
row at 40rem and up, 2×2 below. A stage row keeps its bar on one line with its
number and value at 30rem and up; below, the bar drops under the title. Nothing
scrolls sideways.

### Start a question (dialog)

Two columns from 64rem of viewport (what to ask left; who and why right), one
below: the first capture showed a one-column dialog scrolled past its own
Stage choice at 1440. **Stage** (pressed buttons, one per stage that has live items, number in mono)
→ **Question** (full-width pressed rows: slug in mono, type, the objective's
words) → **Who may answer** (pressed: Everyone, then each section code in
mono) → **Why** (required, 3 characters at least; it goes to the audit log).
**Start question** stays disabled until a question and a reason are chosen.
The body scrolls and the refusal and footer are pinned (`NEXT-SESSION.md`
§0m.1). A refusal keeps the dialog and its choices, says the server's sentence
in a `role=alert`, and raises an error toast that stays.

### End question (dialog)

The slug, how many answered, **Why** (required), **End question**.

## `/live/present`, top to bottom

Full viewport, `--surface-0`, no shell. A thin top line: *CPE 412 · Lecture
Mode* (h1), a stale marker when a read fails, **Exit** (back to `/live`;
Escape does the same).

- **A question running**: *Stage 04 · Cache Memory*, the objective's words at
  display size; **how many answered** as the large figure; *The class got
  60%* with one bar and "7 of 12", or *The result appears once 5 have
  answered*
- **None running**: people working now as the large figure; *The class so far*
  with a bar per stage (up to eight, the most students first), number, title,
  average, and withheld rows in words
- Foot: *No names are shown here, ever.*

Type is large (the figure clamps to the viewport), every value mono, and its
contrast is **computed on all three themes** like every other state. At 380 it
still reads: the same order, one column.

## Loading, failure, feedback (`.claude/rules/design.md`)

- First load: nothing for 400ms, then a skeleton shaped like the page (the
  question card, four counts, stage rows); past 3s a sentence **at its top**.
  The projector shows a single quiet line past 400ms instead of a skeleton
- A failed first load: a `role=alert` sentence and **Try again** (both views)
- A failed later read: the last reading stays, with a stale notice
- Start / End: one toast each, what happened to what: *"P-07-cycle-1 put to the
  room, for everyone"* / *"P-07-cycle-1 ended after 12 answers"*. A refusal
  keeps the dialog, says why in it, and its toast stays
- **One read per 5 seconds, never overlapping**: a read is scheduled only after
  the previous one settles

## Controls, and the mandate's four tests

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Open the projector view | a second window showing the room at projector size | says it opens a new window | close it | the class sees its own aggregate, never a person |
| Start a question | one live item is put to the room, audited | the dialog names the item, who may answer and why; disabled with its reason | End question | a shared question, answered together |
| Stage / Question / Who may answer (in the dialog) | choose what Start will do | pressed state, in words | choose again before Start | — |
| End question | the question stops taking answers, audited | names the item and how many answered | start another | the result is frozen as a record |
| Reports → Feedback | opens the queue | says how many in the last 20 minutes | Back | a spike means one broken item, not forty confused students |
| Exit (projector) | back to `/live` | a word and Escape | reopen it | — |
| Try again | re-reads after a failure | a word | — | — |

## API

- `GET /console/live` → `LiveSnapshot` (`packages/contracts`): `cohort`,
  `minCohort`, `stages[]` (`title`, `students`, `avgMastery` **null below 5**),
  `session` (null or the one open question, with `answered` and `correct`
  **null below 5**), `at`. The ordinal `spread` and the top-level `suppressed`
  are gone
- `GET /console/live/options` → live items and sections
- `POST /console/live/sessions` `{ itemId, sectionId, reason }` → 201; 400
  without a reason; 404 unknown item or section; 409 an item not live ("…is at
  review"), or a question already running
- `POST /console/live/sessions/:id/end` `{ reason }` → 200; 400, 404, 409 when
  already ended
- `GET /console/live/health` unchanged in shape; `inProgress` counts activity
- `live_sessions` and `live_responses` (`db/schema.sql`): staff-read,
  client-write-never, one open session (a unique index), an ended session
  cannot change, answers append-only and refused once ended, for every role.
  `rls.spec.ts` and `live.spec.ts`, each denial watched failing

## What is deliberately not built

- **The student half**: `/app/live` (reading the pushed question through the
  one student serializer, answering it through the grading service, seeing
  the split only after answering). Nothing writes `live_responses` yet. It is
  a student-app route and `WEB-REVAMP.md` work
- **A per-option distribution** ("12 chose B"): needs the student half to
  decide how an answer is stored; options are shuffled per student, so "B" is
  not one thing across a room. Correct / not correct is what exists
- **The timer** (instructor, 29 Sep 2026), deferred with the student half
- **Realtime**, as above

## Motion (`motion.md`)

No entrance on `/live`; the projector's bars grow in once when a figure lands. Everything cut
under `prefers-reduced-motion`.
