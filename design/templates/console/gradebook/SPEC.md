# `/gradebook` — SPEC

Rebuilt 28 Sep 2026 from `template.png` (shadcn-admin's Dashboard: the frame),
`template-table.png` (shadcn.io's heatmap table: the grid) and
`template-tasks.png` (shadcn-admin's Tasks: the toolbar). See `SOURCE.md` for
what each rendered and what was rejected. Gated by
`design/specs/console-gradebook.spec.ts`, plus `console-teaching.spec.ts`'s two
older gradebook tests, extended and never overwritten.

## What the page is for

`PAGE-SPECS.md`: *"Per-stage mastery + final score. Weighting configuration.
CSV / XLSX export shaped for the university's format."* The page answers two
questions, one per view:

- **Final grade**: what each student has so far, component by component,
  weighted by the syllabus. This is the default view.
- **Stage checks**: which chapters the class has sat, and how each student did
  on each one.

## Instructor decisions, 28 Sep 2026

Asked before building. Each one is a test.

1. **The weights are the syllabus's and FIXED**: Project 20, Quizzes 30, Major
   exams 30, Laboratory exercises 10, Class participation 10
   (`CPE412-CURRICULUM.md` §1.1). `GRADE_WEIGHTS` in `packages/contracts`, the
   only place they are written. **"Weighting configuration" is NOT built, by
   decision**: changing weights mid-term is a grading-policy change, not a
   setting. If it is ever wanted, it is a new table, a staff-only write with a
   reason, and an audit row.
2. **The final is a score SO FAR.** A component the class has no marks in yet
   is left out and the others rescaled, and the page says how much of the
   grade that covers (*"covers 40% of the grade"*). Within a component that
   has marks, work a student did not hand in or sit counts as 0; work handed
   in and not yet marked (submitted, or returned for revision) is left out of
   that student's component and counted as *unmarked* on their row.
3. **CSV only. XLSX and "the university's format" are NOT built, by
   decision**: no document says what that format is. They wait for a sample
   grade sheet from the instructor. The CSV names each weight in its column
   (`quizzes_30`) so the file explains itself.
4. **A stage check not sat is EMPTY in the CSV and "not sat" on the page**,
   never 0. A real 0% stays 0.

And from the `/submissions` session (`NEXT-SESSION.md` §0g): only
`status = 'graded'` scores (a returned row keeps its old score in the table),
and every mark is normalised by its own `max_score` (the seed's labs are out of
100, the console marks out of 4). The arithmetic is one pure function,
`services/api/src/gradebook/compute.ts`, with a unit test per rule; the page
and the CSV both come from it.

## Structure, top to bottom

1. **Header** (dashboard): *Gradebook* and one line saying what the numbers are;
   **Download CSV** on the right, beside the title. At 380 it stays in the
   header row, wrapping below the title if it must.
2. **KPI row** (dashboard): four tiles, each a label, a mono value and a line
   saying what the value is *of*:
   - *Class average so far*: the mean final, "over N% of the grade"
   - *Grade covered*: "40 of 100", naming the components that have marks
   - *Stage checks sat*: "7 of 18", with the range of stages
   - *Awaiting marking*: handed in and not marked, with a link to
     `/submissions`
   Four across at 1440; two by two at 380. No icons.
3. **Two cards side by side** (dashboard: chart + list), stacked at 380:
   - **Class average by stage check**: one row per gradeable stage, number and
     title, a horizontal bar, and **the value as text at the bar's tip**
     (mono). A stage nobody has sat says **"not sat yet"** in place of a bar.
     Under it, the load-bearing sentence: *"A stage where the whole class sits
     low is a signal about the teaching, not about the students."*
   - **How the grade is weighted**: the five components in the syllabus's
     order, each with its weight (mono), and in words whether it counts yet
     and what it is made of ("7 stage checks", "3 labs", "no marks yet").
4. **The table card**: a toolbar (Tasks: filter field on the left; the view as
   two pressed buttons), then the grid (heatmap):
   - First column: the student's name (a link to their record) with the
     student ID under it in mono. 21rem in the Final grade view, so a long
     name with a comma stays on one line and a row stays under 60px; 11rem in
     the Stage checks view, where a long name may take two lines. Nothing is
     pinned: the table never scrolls sideways, so nothing needs to be.
   - *Final grade* view: one column per component, headed with its weight,
     then **Final so far** (the heatmap's total column: bold, its own
     surface), then *Unmarked*. A component with no marks yet says "no marks
     yet" in its header and "–" in its cells. The Unmarked column's footer is
     "–": a count has no class average, and a sum on a row labelled *Class
     average* would be a false label (seen in the first screenshot).
   - *Stage checks* view: one column per gradeable stage (01-18), "not sat"
     in words where a student has not sat it.
   - A **Class average** row at the foot (the heatmap's total row), in both
     views.
   - Default order: by student ID, the registrar's order.
5. **Below 66rem of the page's OWN width** (a ResizeObserver, like
   `/students` and `/submissions`): the grid becomes a list, one student
   per item: the name and ID, the final so far, then the view's values as a
   list of facts (two columns of components with SHORT names, because
   "Laboratory exercises 10%" wrapped its own weight at 380; three columns of
   stage checks). The class average closes the list as its own item. **Why
   66rem and not 48:** the gate counts a sideways-scrolling table as clipping,
   and 18 stage columns plus the student column need 66rem to fit the card
   outright. At 1440 the page is ~70rem wide, so the table shows there.

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Download CSV** | the teacher leaves with a file the registrar can read; a toast says what was in it | labelled in words; the file's weights are in its column names | read-only | the weights travel with the numbers |
| **Filter by name or student ID** | the rows narrow to the student asked about; "no student matches" when none do | a labelled field | clear it | — |
| **Final grade / Stage checks** (pressed buttons, `aria-pressed`) | the grid shows a different question's columns | the pressed one is the one shown | press the other | — |
| **A student's name** | opens their record, where every attempt is | a link, underlined on hover | Back | — |
| **"Mark them"** on *Awaiting marking* | opens the marking queue | a link, in words | Back | the unmarked work is why the final is provisional |

Not offered: sorting (the registrar's order is the student ID, and 21 rows
are one screen), a section filter (one section exists; add it when a second
does), editing a mark (marks are made in `/submissions` and are frozen there).

## States

| State | What renders |
|---|---|
| Loading, under 400ms | nothing (the space is reserved) |
| Loading, over 400ms | a skeleton the shape of the KPI row, the two cards and the grid |
| Loading, over 3s | the skeleton plus a sentence: the API may be waking |
| Load failed | an alert naming the failure, with **Try again** |
| No students | an empty state that says the roster is empty and where to import it |
| No marks at all | the grid renders; *Final so far* is "–" and the KPI says "nothing marked yet" |
| Filter matches nobody | "No student matches" with the query, in the grid's place |
| Download ok | a success toast: "Gradebook downloaded: 21 students, 40% of the grade covered" |
| Download failed | an error toast that stays until dismissed and says to try again |

## Type and colour

Every number, ID, weight and percentage is mono (`.num`). Nothing is red: a low
score is a number, not an alarm, and the console can end up on a projector.
The bars are `--accent`, one hue, per the dataviz skill (a single series needs
no legend; the card's title names it). The heatmap's cell shading is **not**
taken (`SOURCE.md`).

## Why the chart is HTML, not Recharts

Every number the chart shows must also be readable as text. As HTML the bar
values are DOM text that the gate's contrast, token and clipping checks can
measure; as SVG they would pass unexamined. It also takes Recharts (~105 KB
gz) off the route: no console page imports it now, and
`console-gradebook.spec.ts` proves no loaded chunk carries it. The route
stays lazy-loaded (`App.tsx`).

## The Moon checks view (9 Oct 2026)

A third view beside Final grade and Stage checks (`docs/GRADED-MOONS-PLAN.md`):
each graded moon's check counts as one more quiz inside Quizzes, so the page
shows them. One column per moon the class has sat (a moon nobody sat is not a
column, as Quizzes does not count it), the best sitting per student, **"not sat"
never 0**, a class-average row. More than 18 columns fall to the list at any
width. With none sat the view says so in words and shows no empty table.
Captures: `current-moons`, `current-moons-380` (six moons, fixture data) and
`current-moons-empty-380` (the real, empty state). Opened 9 Oct 2026. The
third button is a pressed-state button like the other two (consequence: it
changes what the teacher can see).
