# `/locks` — what was taken from the template, and what was not

Reference: `template.png` (shadcn.io *Tables · Permission Matrix*), with
`template-states.png` (*Dashboard · Permission Matrix*) for the cell grammar.
Captured 25 Sep 2026, see `SOURCE.md`. Rebuilt 25 Sep 2026. Implementation:
`current.png` (1440), `current-380.png` (380). Gate:
`design/specs/console-locks.spec.ts`.

Colours and fonts are ours, always: `packages/tokens`, three themes. Nothing
below is about colour.

## Hard rule 4 shapes everything

**The page renders `is_stage_unlocked()`'s answer and never computes a lock.**
Every cell's open/closed comes from the API's `unlocked`, which the API reads
from that function, the same one the student app reads. Where a person's
override and the database disagree (an override that opens a stage inside a
window that has not started), the cell shows **the database's answer** and the
readout says why they differ. The spec asserts exactly that case, from a
fixture built to disagree.

Counting open cells per column is counting the API's booleans, not deciding
one.

## Why the page was rebuilt, not fixed

Audited against `PAGE-SPECS.md` §`/console/locks` before any change:

| Planned | Before | Now |
|---|---|---|
| Students × stages grid | yes | yes |
| Click to toggle | cycled auto → open → closed → auto, so closing an automatic cell took two trips through the dialog | the dialog offers all three states; the current one is disabled |
| **Shift-click for bulk** | absent | shift-click / Shift+Enter selects a rectangle; column heads select a stage |
| Three visual states | "opened by a person" and "closed by a person" had the **same glyph** and differed only by colour | fill = what the database says; a padlock (open or shut) = a person decided |
| Reason prompt → `audit_log` | yes | yes, single and bulk; bulk writes one audit row per cell |
| **Hover shows who, when, why** | `title` tooltip, reason only; the API selected who and when and dropped them | readout strip on hover **and focus**; the dialog says it; the cell's accessible name says it |
| **Section-level and scheduled overrides, own tab** | absent; global overrides were fetched and never shown | "Sections & schedules" tab: list, add, return to automatic |

All three missing features were approved by the instructor on 25 Sep 2026
before they were built.

## Structure taken from the template

| Template | Here | Why |
|---|---|---|
| A card: title and one line of description left, a count right | `Lock matrix`, one line on what a cell means; right: students × stages and how many overrides | The page's one question is "who can open what", and the count says how much of it is a person's doing |
| Role columns carry a count (`11/13`) | Each stage column head carries **open for n of N** | A teacher closing a stage before a quiz wants to see the column go to 0 |
| A fixed column shown as a padlock, not a checkbox | A **course-wide or section override** marks its stage's column head with a padlock | It is a rule above the row, like the template's Admin column. Before, global overrides were fetched and never shown at all |
| Group rows between permission rows | **Not used at 1440**: one section exists | A group row per section is where a second section would go; the data carries `sectionId` for it |
| Header checkboxes toggle a whole column (`checkbox-toggle`, rejected as a layout) | A column head is a button that **selects that stage for every student** | Bulk without a mouse, and the commonest bulk task ("close 05 for everyone before the quiz") in one press |
| Lettered badges with a legend in the card header (`template-states.png`) | Four legend chips in the card header, each a glyph plus words | Nothing is told apart by colour alone |

### The cell

A 2.25rem square button, one per student × stage.

| State | Fill | Mark | Words (legend, readout, accessible name) |
|---|---|---|---|
| Open, the curriculum decided | success | `○` | Open, by the curriculum |
| Closed, the curriculum decided | locked | `·` | Closed, by the curriculum |
| A person opened it | as the database says | open padlock, 2px accent border | Opened by *who*, *when*: *why* |
| A person closed it | as the database says | shut padlock, 2px accent border | Closed by *who*, *when*: *why* |
| Selected for a bulk change | accent-muted | unchanged | "selected" in its name |

## At 1440: the whole matrix

The sticky name column and 19 stage columns fit in the space left beside the
sidebar: `table-layout: fixed`, 2.25rem cells. The table never scrolls
sideways. Assertion 1 treats a horizontal scroller as clipping, and the page this
replaced sat in one.

**The readout strip** is the card's footer. It shows the cell under the pointer
**or with focus**: student, stage number and title, the state in words, who,
when and why, plus any course-wide or section override on that stage. That is
where the stage title lives; 19 titles do not fit in 19 column heads.

## At 380 (below 56rem of available width): one stage at a time

19 columns do not fit in 348px, and neither template solves it: both cut their
own grid off at the card's edge. So the page pivots:

- A **stage picker** (previous / select / next) chooses the stage.
- Below it, that stage's **course-wide or section override**, if any, in words.
- Then **every student as a row**: name, ID, the state in words and glyph, and
  the cell button ("Change"). The row is the readout; nothing is hover-only.
- Bulk at 380 has no Shift key: each row has a **Select** checkbox, and
  "Select every student" selects the column.

The switch is measured on the page's own width (a `ResizeObserver`), not the
viewport's, for the same reason `/items` reflows on a container query: the
sidebar takes a quarter of a laptop screen.

## Bulk, precisely

- **Shift+click, or Shift+Enter / Shift+Space** on a cell: the first one starts
  a selection at that cell; each one after selects **the rectangle from the
  first cell to this one**. Stage 05 for everyone is two presses; stages 03 to
  06 for one student is two presses.
- A **column head** selects that stage for every student.
- **Escape** or "Clear selection" clears it.
- A bar appears: *N cells selected (k students × m stages)* → **Open early**,
  **Close**, **Return to automatic**. Each opens the same reason dialog.
- One request (`POST /api/v1/console/locks/bulk`), **one transaction**, one
  audit row per cell, one toast.

## Sections & schedules (the second tab)

- A table of every **course-wide** and **section** override: scope, stage,
  state, window (opens at / closes at), who and when, reason, and **Return to
  automatic**. Below 56rem each row stacks.
- A form to add one: scope (every student, or a section), stage, open or
  closed, optional *opens at* and *closes at*, reason. A window that closes
  before it opens is refused in words on the page and again by the API. A
  course-wide override says, before it is saved, that it changes the stage for
  every student.
- The window is printed as stored. The page does not say whether a window is
  "active now"; `is_stage_unlocked()` decides that, and its answer is on the
  matrix.

## Deliberately NOT copied

- **The per-row "configure" chevron** (`template-states.png`). A cell is the
  control; there is nothing behind a row to expand.
- **Staggered entrance animations** (the dashboard block's framer-motion). The
  console's motion budget is local state changes, 120–200ms (`motion.md`).
- **Checkboxes as cells.** A cell has three states and a reason; a checkbox has
  two and none.
- **The template's own 380.** It cuts its grid off at the card edge.

## Loading, failure, feedback (`.claude/rules/design.md`)

- Under 400ms: nothing, space reserved. Over: a skeleton shaped like the matrix
  (the same row height, 19 cells a row). Past 3s: a sentence saying the API may
  be waking, because Render's free tier sleeps.
- A failed load: `role="alert"`, what failed, **Try again**.
- Every save raises one toast saying what happened to what: *"Stage 05 closed
  for Juan Miguel Dela Cruz"*, *"Stage 05 closed for 21 students"*. A failure
  keeps the dialog open with the error in it, and raises a toast that stays
  until dismissed.

## The shared dialog's scrim (NEXT-SESSION.md §0a.1): fixed here

The reason prompt is this page's central interaction and it opened over an
undimmed page. `bg-surface-0/80` emitted no CSS, because Tailwind 3 cannot put
an opacity modifier on a `var()` colour. It is now `.dialog-scrim`, a
`color-mix()` of `--surface-0` in `index.css`. That changes every console
dialog, so every console spec was re-run after it.

## What this page must never do

- Compute a lock (hard rule 4).
- Save an override without a reason (INV-22; the API refuses under 3 characters).
- Write a lock from a spec. `console-locks.spec.ts` **intercepts every lock
  write**; a spec that toggled real locks to prove a layout would be changing
  what a student can open.
