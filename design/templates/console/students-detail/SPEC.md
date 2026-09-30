# `/students/:userId` — what was taken from the templates, and what was not

References: `template.png` / `template-380.png` (TanStack Table's
*Sub Components* example, a row expanded), `template-subrows.png` (the named
*Expanding* example, kept for the record), and `template-header.png` /
`template-header-380.png` (GitHub Primer's `PageHeader`, *Pull request page*).
Captured 27 Sep 2026, see `SOURCE.md`. Rebuilt 27 Sep 2026. Implementation:
`current.png` (1440), `current-380.png` (380), and the state shots beside them.
Gate: `design/specs/console-student-detail.spec.ts`.

Colours and fonts are ours, always: `packages/tokens`, three themes. Nothing
below is about colour.

## Why the page was rebuilt, not fixed

Audited against `PAGE-SPECS.md` §`/console/students/:id` before any change:
*"Every attempt. Expand a row to see the exact variant that student saw,
regenerated from their stored seed: their numbers, their options in their
order, their answer, the correct answer, the rationale they were shown, and
time on item."*

| Planned | Before | Now |
|---|---|---|
| Every attempt | yes | yes, newest first, with time taken |
| Expand a row, in place | yes, one at a time | yes, one at a time |
| Regenerated from the stored seed | yes (`loadResolvedPaper(seed, engine_version)`) | unchanged |
| Their numbers | yes, resolved into the stem | unchanged |
| **Their options, in their order** | **no**: the API sent `options[]`; the page never drew them | lettered A, B, C… in the order they saw; theirs and the key marked **in words** |
| Their answer, the correct answer | yes, `Answered` / `Key` | yes; an ordering item shows both sequences, numbered |
| **The rationale they were shown** | **no**: sent, never drawn | shown, labelled as what the student saw |
| **Time on item** | **no**: `timeMs` sent, never drawn | per item, mono, and the paper's total |
| Right or wrong | a muted colour only | **in words**: Correct, Not correct, Not answered. Neutral, never red |
| Record header: who, section, registration, deactivated | name, ID, section, a badge; **no registration** | all four; registration with its date (`claimedAt`, added to the GET) |
| **Deactivate / reactivate, move to section** | absent | the roster's own `StatusDialog` and `MoveDialog`, reused, from the header's Actions menu (instructor, 27 Sep 2026) |
| Loading and failure | bare "Loading" text; an error with no retry | a skeleton shaped like the header and the list, after 400ms; an error with Retry |

## The answer key on this page — hard rule 1

This page shows correct answers. That is allowed here, and only because all
of these hold:

1. **Staff only.** `GET /console/students/:userId` and
   `GET /console/attempts/:attemptId` both call `requireStaff()` first. A
   student token gets 403 from both; `services/api/test/console.spec.ts`
   proves each denial.
2. **The console bundle, never the student's.** `scripts/scan-bundle.mjs` runs
   two profiles: the student bundle may not contain `correctValue` at all, and
   neither bundle may contain a live answer value from the database.
3. **Submitted attempts only, on this page.** The database grants staff the key
   for every status (`ai_after_submit: is_staff() or …`). The page is stricter,
   by instructor decision (27 Sep 2026): an **in-progress or abandoned**
   attempt expands to the questions and the answers given so far, **with no
   key, no verdict and no rationale**, and a line saying the key appears once
   it is submitted. A console gets projected; a key on a paper a student is
   still sitting is the one thing that must never be on the wall. This is a
   render decision, not a payload one: the API still sends the key to staff,
   and `/attempts/:attemptId` is unchanged until its own session.

Voided attempts show everything: they were submitted, and a voided paper is
exactly what a dispute reads.

## Structure taken from the templates

| Template | Here | Why |
|---|---|---|
| Primer: parent link above the title (at 380; ours at every width) | `← Students` | Back to the list is the most common move off this page |
| Primer: title | The student's name, `h1` | |
| Primer: status label, then a metadata sentence with mono values set apart | **Registered** or **Deactivated** as a word-badge, then the student ID (mono) · section · *registered 3 Sep 2026* | Four facts, one line, read left to right |
| Primer: actions at the right of the title (buttons at 1440, one `⋯` at 380) | **One Actions menu at every width**: Move to section… · — · Deactivate… / Reactivate… | Deactivate stays two presses away and set apart, as on the roster (`students/SPEC.md` §"Deactivate is hard to do by accident"). A button on the header would make it one press |
| Primer: tabs under the header | **Not copied** | Two sections, both short. Tabs would hide one of the two things a teacher came to compare |
| TanStack: a toggle in a leading position | The assessment's name **is** the toggle: a button with a chevron, `aria-expanded`, `aria-controls` | The name is what a teacher is looking for; a separate emoji button is a second target with no label |
| TanStack: a full-width row inserted beneath the expanded row | Same: one `td` spanning every column, holding the paper | It is one attempt's detail, not another row of the same shape |
| TanStack: the other rows stay put | Same, and **one open at a time** | Stacking open papers turns a scan list into a scroll |
| TanStack at 380: the table cut off at the edge | **A list**: each attempt a block with its toggle, and the paper opening under it | Assertion 1's defect; the 380 layout is ours, as on `/locks` and `/students` |

## What the page holds, in order

1. **Header** (above).
2. **Attempts**, the reason for the page. Table at 1440: *Assessment* (the
   toggle) · *#* · *Score* · *Status* · *Submitted* · *Time taken*. Status is a
   word. A score is mono, `6/8`. The paper opens under its row: a one-line
   summary (N questions · N correct · total time · engine version), then every
   question as a numbered list item:
   - the ordinal, the item type in words, the objective, time on item
   - the stem
   - the options in their order, each marked *their answer* and/or *key*;
     an ordering item shows the order they gave and the keyed order
   - the verdict in words
   - the rationale, labelled *shown to the student*
   - a link to the paper on its own page (`/attempts/:attemptId`), for a
     dispute that deserves the whole thing
3. **Progress by stage**, carried over: one bar per stage with the percentage
   in mono, and the bar has a text equivalent. Beside the attempts at 1440,
   under them at 380.
4. **Moons by stage** (instructor, 30 Sep 2026; WEB-REVAMP 3.7a), under
   Progress in the same side column. One row per gradeable, published stage:
   its code, its title and **N of M** moons mastered, in mono. A row expands in
   place to its moons, **one stage open at a time**, indented beneath it, which
   is `template-subrows.png` (TanStack's *Expanding*: child rows under their
   parent): each moon's code, the syllabus's words and its state **in a word**
   (Mastered, "1 of 3 right", Not started, No questions yet; `moonWords()` in
   `lib/record-view.ts`, tested). The numbers are the API's, from the one
   definition the map and the lock read (`moon_correct()`, `moon_mastered()`).
   **Journeys are not attempts here**: practice is never graded, so the
   Attempts list stays graded work only. Captures: `current-moons.png`,
   `current-moons-380.png` (stage 02 open, real demo moons), both opened.

## Controls, and the four tests (DESIGN-MANDATE §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| ← Students | returns to the roster | a link, named | back | — |
| Actions → Move to section… | changes the section locks and windows the student reads | the dialog says so first | move back, with a reason | — |
| Actions → Deactivate… / Reactivate… | refuses or restores every request | the dialog says what happens to this student | Reactivate | — |
| Attempt toggle | reveals the exact paper they sat | `aria-expanded`, chevron | the same control closes it | what the student saw, answered and was told |
| A stage's moons toggle | reveals that stage's moons and each one's state | `aria-expanded`, chevron, N of M | the same control closes it | where this student stands on each subtopic, and what still holds the next stage shut |
| Open paper on its own page | the full paper | a link, named | back | — |
| Retry (on failure) | fetches again | a named button | — | — |

Nothing on this page only changes a number.
