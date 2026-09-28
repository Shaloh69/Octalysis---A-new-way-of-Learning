# `/attempts/:attemptId` — SPEC

**One paper, as the student sat it: regenerated from the stored seed, every
question in their order, their answer, and, once it was handed in, the key,
the verdict and the rationale they were shown. A grade dispute is read here.**

`PAGE-SPECS.md` §/console/students/:id and `MASTER-PLAN.md` §6.3 are the plan:
*"the exact variant that student saw, regenerated from their stored seed:
their numbers, their options in their order, their answer, the correct answer,
the rationale they were shown, and time on item."* The record
(`/students/:userId`) opens the same paper in place; this is the paper on its
own page, linked from there ("Open paper on its own page") and addressable, so
a teacher can send it or come back to it.

Reference: `SOURCE.md` (Canvas's quiz results page, from Instructure's own
guide). Colours and type are ours.

**Hard rule 1 governs this page.** The key reaches this browser because the
reader is staff (`requireStaff()`, a student is refused 403, tested in
`services/api/test/console.spec.ts` and in the spec), this is the console's
bundle and never the student's (`scripts/scan-bundle.mjs`, two profiles), and
`ai_after_submit` grants staff the same read in the database.

## What was missing — 29 Sep 2026, before the rebuild

Measured against the code and the API, with the stack up:

- **The key, the verdict and the rationale were shown on EVERY status**,
  in progress included. The record withholds them on an in-progress or
  abandoned paper (instructor, 27 Sep 2026), and links here: one click undid
  that ruling. `CONSOLE-REVAMP.md` §3, the R3 box and `apps/console/CLAUDE.md`
  all called this "the only place the key is shown", which §0e.3 found was
  never true
- **An ordering item showed no key and no order.** The page matched each
  option against `correctValue`, which for type G is the whole sequence
  (`a | b | c`), so nothing ever matched: no "key", no keyed order, no
  student's order
- **It could not say whose paper it was.** The GET returned the id, status,
  engine version and items only. `<h1>` read "Paper" over a UUID, and Back was
  `history.back()`, which from a link or a bookmark goes nowhere useful
- **A malformed id answered 500**, "Something went wrong on our side. Try
  again": an invitation to retry something that can never work. An unknown
  UUID answered 404 correctly
- A voided paper said nothing but its badge
- Loading was bare text with no delay; a failure had no Try again

## Instructor decisions, 29 Sep 2026

1. **The key, verdicts and rationales are withheld on an in-progress or
   abandoned paper, render-side**, exactly as the record does (27 Sep): the
   same `showsKey()` from `lib/record-view.ts`, so the two pages cannot
   disagree. The API still returns the key to staff for every status (the
   API-side option was offered again and not chosen)
2. **The GET says who, what and when.** Additive fields: `student` (userId,
   studentId, fullName), `assessmentTitle`, `scope`, `attemptNo`, `startedAt`,
   `submittedAt`, `score`, `maxScore`. Back becomes a link to the student's
   record. A malformed id answers **404 "No such attempt."**, like an unknown one

A **voided** paper shows everything, as on the record: it was handed in, and
it is exactly what a dispute reads. It says it no longer counts.

## Structure

```
← {Full name}'s record                                   (link)
{Assessment title}                                        <h1>
{Status word} · {student ID} · attempt {n} · {Full name}
[a sentence for in progress / abandoned / voided]
Regenerated from the stored seed with engine {v}: …      (one line)

┌ the paper ───────────────────────────┐  ┌ facts (aside) ───────┐
│ Question 1   single choice · 01.2 ·  │  │ Score        5 of 8  │
│              41 s · Correct          │  │ Answered     7 of 8  │
│ stem                                 │  │ Started      …       │
│ Options, in the order they saw       │  │ Handed in    …       │
│  A  …                                │  │ Time taken   …       │
│  B  …          Their answer          │  │ On questions …       │
│  C  …          Key                   │  │ Engine       1.0.0   │
│ Shown to the student: rationale      │  ├ Questions ───────────┤
├──────────────────────────────────────┤  │ 1 ✓ 2 – 3 ✓ 4 – …    │
│ Question 2 …                         │  └──────────────────────┘
```

- **A document, not a dashboard.** One column of questions in the order sat.
  Each question is an `<article>`-like `<li>` headed by an `<h2>` "Question
  n", so a screen reader can walk the paper by heading, and it has an `id`
  (`q-n`) so a question has an address
- **The facts beside the paper** at 60rem of the page's own width and up (a
  container query, as on `/live`): a 17rem aside, sticky inside `<main>`.
  Below 60rem it sits **above** the paper, the facts as a two-column list
- **Questions, as links** under the facts: one per question, its number in
  mono and a mark for its result (✓ correct, – not correct, ○ not answered),
  with the result in words in its accessible name. On a withheld paper the
  mark says only answered or not
- **Every option in the order they saw, lettered** (`list-style-type`, set
  explicitly: Tailwind's preflight strips it, §0e.4), with **"Their answer"**
  and **"Key"** as words beside the option. An ordering item shows "Shown in
  this order", then **Their order** and **Keyed order** side by side (or
  stacked). A computed answer typed rather than picked is printed on its own
  line
- **Mono** wherever the value is one the machine produced: every number (the
  question number, times, score, dates, the engine version, the student ID),
  every option, answer and key of a computed item, and the parameters a
  computed item drew ("Drawn for this variant: `a = 3 · b = 4`"). Prose
  options stay in the body face, as the student read them
- **An incorrect answer is never red**: the word *Not correct* in a neutral
  chip. Correct is the word *Correct* with the success border; the word, not
  the colour, carries it
- **"This student in the audit log"** links to `/audit?q={student ID}`, the
  whole log filtered to them

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| ← record (link) | takes the teacher to this student's attempts | names the student | Back returns | — (staff) |
| Question n (links) | brings question n into view in a 50-question paper | its number and result in words | scroll back | — |
| This student in the audit log (link) | shows every change made to them | says where it goes | Back returns | — |
| Try again (on a failed read) | reads the paper again | beside the sentence saying it failed | — | — |

Nothing on this page writes. There is no regrade, void or edit control here:
corrections void an attempt (hard rule 7), and `voided` has no route to set it
yet (`/submissions`' SPEC records the same absence for submissions).

## States

| State | What shows |
|---|---|
| Loading, under 400ms | nothing (a still frame, `aria-busy`) |
| Loading, after 400ms | a skeleton shaped like the page: header lines, the aside, three question blocks |
| Loading, after 3s | a sentence **at the top of the skeleton**: the API may be waking |
| Failed read | `role=alert`, the sentence, **Try again** |
| No such attempt (404) | "No such attempt." and a link to Students; no Try again, because trying again cannot help |
| Submitted | everything |
| Voided | everything, and "Voided. Kept for the record; it no longer counts toward a grade." |
| In progress | answers so far; no key, verdict or rationale; a sentence saying so and when it will appear |
| Abandoned | as in progress, with its own sentence |

## Widths

`<main>` is 70rem at 1440. The aside joins at 60rem of the page's own width.
Nothing scrolls sideways: a long unbroken stem or option wraps
(`overflow-wrap: anywhere`), and an ordering item's two sequences stack below
24rem each. 380: one column, the facts first.

## Deferred, recorded

- **Print.** A printed paper is the reference's own medium, and Ctrl+P works;
  a print stylesheet (no shell, no aside) was not asked for and is not built
- **A Zod contract for this response.** The shape is a TypeScript interface in
  `apps/console/src/lib/api.ts`, as it was; the other console reads that moved
  to `packages/contracts` did so in their own sessions
