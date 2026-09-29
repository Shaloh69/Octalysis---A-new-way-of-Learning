# `/app/stage/:id/check` — SPEC

**One paper, one question at a time, under the Register Bar. A student works
an answer out, records it deliberately, and is told the truth about what was
recorded. It grades: a defect here costs marks.**

`PAGE-SPECS.md` §/app/stage/:id/check is the plan: one item per screen, the
Register Bar showing the item index as PC, immediate per-item feedback with the
rationale, a neutral response to an incorrect answer, autosave, "refreshing
mid-attempt resumes exactly where you were", `aria-live="polite"` on the
verdict. Reference: `SOURCE.md` (Professor Layton's puzzle screen). Colours and
type are ours; no encounter theme dresses an assessment (`GAME-DESIGN.md` §5.1).

**Hard rule 1 governs this page from the student's side.** The paper arrives
through the one serializer (`services/api/src/serialize/student.ts`) with no
key. The precise rule, as built: **no key for a question the student has not
recorded, ever**; on a stage check the key for question N arrives only after N
is recorded (`revealVerdict = scope !== "final"`, the formative design); on a
final no key reaches the browser until the paper is submitted. The spec asserts
that rule against the real API, not a fixture.

## What was missing — 29 Sep 2026, before the rebuild

Measured in `AttemptRunner.tsx` and `routes/attempts.ts`:

- **An answer could be recorded by accident, and the screen could then lie
  about it.** A radio recorded on `onChange`, and arrow keys move the checked
  radio, so a keyboard user browsing the options recorded the first one they
  landed on. After that the radios still took clicks; the server kept the first
  answer (`on conflict do nothing`) but `recordAnswer` graded the NEW click, so
  the page could say **"Correct."** over an answer the paper marks wrong.
  Free entry recorded on blur, so pressing Next recorded whatever was half typed
- **Nothing said the first answer is final** (`WEB-REVAMP.md` §2)
- **A resumed paper looked blank**: `0 / 8 answered`, every pip unanswered,
  every question open, though its answers were recorded. The resume response
  carried no answers
- **The Register Bar idled** through the paper; PAGE-SPECS wants PC = the question
- **Submit was one click**, with questions unanswered, and cannot be undone
- A failed save claimed *"it will send when you reconnect"*; nothing retried
- Loading had no 400ms delay and no words after 3s; a failed start had no
  Try again; no toast anywhere (apps/web had no toast component)
- The result named objectives by code only

## Instructor decisions, 29 Sep 2026

1. **Choose, then Record.** Selecting (click, tap or arrow keys) only selects.
   **Record answer** commits it, as ordering items already did. A recorded
   question is read-only and shows the recorded answer. The head says, before
   the first question: *your first recorded answer to each question is final.*
2. **A resumed paper shows the student's own recorded answers and, on a stage
   check only, the verdicts they were already shown.** `POST /api/v1/attempts`
   returns them on resume, through the one serializer; the runner opens on the
   first unrecorded question. **A repeated answer gets the verdict of the
   RECORDED answer**, not of the new one, with the recorded answer beside it.
   On a final, answers come back and verdicts do not
3. **Test data: a key-free fixture plus a local live slice.** Layout and state
   specs run on `_stage-check-fixture.ts` (real bank items, resolved by the
   real engine, sent to the page through the serializer's shape; verdicts built
   in Node and sent only after a Record). The hard-rule-1 test and one real
   answer and resume run against the real API, with stage 07's items approved
   **locally only** for the run, then reset
4. **Also built:** one confirmation before Submit; the Register Bar's PC is the
   question during a paper; toasts in apps/web; flag for review

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

Teaching is the strict test, and an assessment is deliberately the same flat
surface every time (§1B rule 1), so for the paper's own controls the teaching
is carried by the item (the ordering IS the sequence being learned) and by the
rationale that follows a Record. Each control below passes the other three.

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **An option** (radio; letter + text) | Changes what Record will send | The option's own words, lettered | Yes, until recorded | The item's own options |
| **Record answer** | Writes the one response that counts | Verb and object; the head and the line beside it say it is final | **No, and said up front** in words, twice | The verdict and rationale follow it on a stage check |
| **Move up / Move down** (ordering) | Changes the sequence Record will send | Position numbers; end-stops disabled | Every move has an exact inverse | The sequence is the concept (instruction cycle, hierarchy) |
| **Record this order** | As Record answer | As Record answer | As Record answer | As above |
| **Answer box** (free entry) | Holds the value; **Enter or Record** commits, blur does not | Unit shown beside it in mono | Yes, until recorded | Parameterised numbers: the student computes |
| **Question N** (the paper's palette) | Puts question N on screen | Number, and state in words: recorded, flagged, not answered, current | Yes | Shows what is left |
| **Previous question / Next question** | Moves one question | Verb and object | Yes | — (navigation) |
| **Flag to come back to** | Marks an unrecorded question in the palette and in the Submit confirmation | Pressed state, and the word *flagged* | Toggle; recording an answer clears it | Only on unrecorded questions: a recorded answer cannot change, so a flag there would promise something false |
| **Submit paper** | Opens the one confirmation | Verb and object | The confirmation states the cost | — |
| **Submit now / Keep working** (confirmation) | Hands the paper in / closes the dialog | Names the unanswered and flagged counts: *"2 not answered score zero. This cannot be undone."* | Keep working is the undo | — |
| **Leave the paper** | Returns to the stage | Says the paper stays open and recorded answers stay | Yes: Start resumes it | — |
| **Try again** (failed start, failed Record) | Repeats the request | Beside the sentence saying what failed | Yes | — |
| **Back to the stage** (result) | Returns to the reader | Verb and object | Yes | — |

A flag is **not graded and never reaches the server**: it is kept per device
under the attempt's id (`localStorage`, wrapped in try/catch, and the page is
whole without it). `apps/web/CLAUDE.md` bans `localStorage` for anything
gradeable; a flag changes no mark.

## Layout

- **1440:** the runner's head across the top (eyebrow, title, the rule line,
  `N of M recorded`), then two columns: the **question** (max 44rem: number,
  worth when not 1, stem, working area, Record at the foot of the working area,
  the verdict under it) and a **paper rail** (the palette as a grid of
  numbered buttons, counts in mono, Flag, and **Submit paper** apart from the
  item's controls, as Layton sets Submit apart). Previous / Next under the question
- **380:** one column: head, the palette as a wrapping row, the question,
  Previous / Next, then Submit paper last. No sideways scroll; an option pushed
  off-screen is an answer a student cannot select
- The Register Bar shows `PC` = the question number, two digits, mono, while a
  paper is on screen, and idles again when it is not

## States

loading (nothing under 400ms, a skeleton of the question after, a sentence at
its top after 3s) · a failed start (what failed, Try again, Leave) · sitting ·
**saving** (Record pressed: "Recording…", the control disabled) · recorded
(read-only, the recorded answer labelled *Your answer*, the verdict) · a failed
Record (the selection kept, a sentence that says it was NOT recorded, Try
again; an alert toast that stays; retried once automatically when the browser
comes back online) · resumed (a status line, recorded answers restored, on the
first unrecorded question) · confirming submit · submitting · submitted (score,
by objective in words, what was missed with the stem, their answer and the
key) · a failed submit (alert toast, the paper still open)

## Feedback

- **Correct**: the word *Correct.*, in ink, with the rationale if any. No
  accent flash: `apps/web/CLAUDE.md` says accent may not colour
  correct/incorrect, and it outranks `design.md`'s "120ms accent flash" here
- **Incorrect**: *Not this one. The answer is `X`.* and the rationale. Neutral:
  never red, never a buzzer, never a shake
- **Withheld** (final): *Recorded. This paper shows its results after you submit.*
- All three in one `aria-live="polite"` region
- Toasts: Submit → *"Stage 07 Check submitted: 5 of 8"* (`role=status`, ~4s);
  a failed Record or Submit → `role=alert`, stays until dismissed, says the
  next move. No toast per recorded answer: the verdict beside the control IS
  the confirmation, and eight toasts over eight questions is noise
