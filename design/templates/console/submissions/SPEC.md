# `/submissions` — what was taken from the template, and what was not

Reference: `template.png` / `template-380-list.png` / `template-380.png`
(shadcn-admin's **Inbox**, a conversation open), with `template-tasks.png` /
`template-tasks-380.png` (the named **Tasks** lead) for density. Captured
27 Sep 2026, see `SOURCE.md`. Rebuilt 27 Sep 2026. Before:
`before-desktop-1440.png`, `before-mobile-380.png`. Implementation:
`current.png` (1440), `current-380.png` (380), and the state shots beside
them. Gate: `design/specs/console-submissions.spec.ts`.

Colours and fonts are ours, always: `packages/tokens`, three themes. Nothing
below is about colour.

## Audit: what the page owed, what it had, what it has

`PAGE-SPECS.md` has **no** `/console/submissions` row. The requirements come
from `apps/console/CLAUDE.md` (*"the lab and project marking queue. A graded
submission's content freezes; regrade is an explicit, audited unlock"*),
`TEMPLATE-LINKS.md` (*"`is_late` must be a visible column, not an inferred
one"*), `docs/LAB-MANUAL.md` §0.3 (the four-point rubric, reasoning worth a
full point) and `db/addendum-submissions.sql` (40% of the grade; late is a
fact, not a penalty; nobody deletes a submission).

| Owed | Before | Now |
|---|---|---|
| **Late as a visible column** | a badge only on a late row; nothing on the others, and the due date shown nowhere | a **Late** column on every row, in words (*on time*, *1 day late*, *no due date*), and the due date in the panel |
| **Regrade is an explicit, audited unlock** | on the page only. **The API re-marked a graded row in place** (`status in (…,'graded')`), no return, no reason | the API answers **409** to a mark on a graded row: *return it first*. Instructor-approved 27 Sep 2026, denial test watched failing at 200 |
| The return is audited | yes, with the reason, but it **overwrote the grader's feedback** and neither audit row kept it | the return's audit row keeps the **previous score, maximum, rubric and feedback**. Approved, test watched failing |
| A return unlocks a *mark* | **any status** could be returned, a draft included | only a graded row: **409** otherwise. Approved, watched failing at 200 |
| The four bands, for labs | yes, as radio inputs (a keyboard-gate failure, `NEXT-SESSION.md` §0c.5) | five pressed buttons, each Tab-reachable, the manual's words beside each number |
| Project and participation | marked 0-4 against **lab** wording; the manual defines no other rubric | **a score out of a maximum the grader states.** No rubric is invented. Approved 27 Sep 2026 |
| Drafts | listed with a **Mark** button that could only fail (404), while the page's copy said *"Drafts stay private"* | listed (who, which deliverable, last saved), **content withheld in the API payload**, no mark control. Approved |
| Grader, graded date | fetched, never shown | in the graded record |
| Filters | status only | status, **deliverable** (grouped by kind) and **search** by name or student ID. Approved |
| After a mark | the dialog closed; find the next one yourself | **save and advance** to the next waiting submission in the same view. Approved |
| 380 | names cut to *"Reym…"*; **every final-project row lost the student's name** to a one-pixel sliver | a list, one submission per item, the name on its own line |
| Void a submission | not built | **not built, by decision** (27 Sep 2026): the state exists in the schema with no route to set it. Recorded in `apps/console/CLAUDE.md` |

## Taken from the Inbox

- **Two panes: the queue left, the reading pane right.** Choosing a row opens
  it in the pane; the queue stays where it was. The chosen row is marked
  (`aria-current`), not only tinted.
- **The pane has its own header**: who (name, then student ID and the
  deliverable), actions on the right.
- **The decision sits at the foot of the pane**, under what is being decided
  on, the way the composer sits under the thread.
- **At 380, one pane at a time**: the queue, then the submission full width
  with **Back to the queue** at its top. Which one is open lives in the
  address (`?open=`), so the browser's Back does the same.

## Taken from Tasks

- **Density.** A table at 60rem of its own width and up, `table-layout:
  fixed`, one line per fact and never wider than its card; D-4's bound holds.
- The toolbar: search first, then filters that carry their counts.
- Status as a word, never as colour alone.

## Not taken

- The Inbox's **two-line message preview**. D-4 removed the body preview from
  this queue deliberately; the prose is read in the pane.
- A composer that sends and stays open. A mark is made once, and the pane then
  shows the frozen record instead of a form.
- Tasks' checkboxes and bulk actions: nothing here is marked in bulk.
- Pagination: one scroll, 61 rows.
- The Tasks table at 380 (it scrolls sideways and cuts its own filter field).

## The page

- **Header:** *Submissions*, *"Labs, the project and participation: 40% of the
  final grade."*, and a counts line in mono (`61 submissions · 21 to mark ·
  30 graded · 0 returned · 10 drafts`).
- **Toolbar:** search (*Name or student ID*); status as pressed buttons with
  counts (*To mark*, *Returned*, *Graded*, *Drafts*, *All*); a **Deliverable**
  menu (`components/ui/dropdown-menu.tsx`, `modal={false}`) grouped by kind,
  each deliverable's slug in mono. Never a native `<select>`: a slug carries
  numbers, and an `<option>` cannot be mono (`NEXT-SESSION.md` §0f.5).
- **The queue, wide:** Student (name, student ID in mono under it) ·
  Deliverable (slug, mono) · Handed in (date, mono) · **Late** (words) ·
  Mark (score in mono, or the state in a word). The student's name is the
  row's button.
- **The queue, narrow:** one button per submission: the name on its own line,
  then the state, the deliverable, the date and lateness as lines.
- **The pane:**
  - a facts box (label left, value right): state, handed in, due, late, and
    for a graded row the mark, who marked it and when;
  - *What they wrote*, then attachments and recorded values when there are any;
  - **to mark** (handed in or returned): the lab bands, or score / out of for
    a project or participation entry; feedback; **Save grade**. A returned row
    shows the reason it was returned above the form;
  - **graded**: the frozen record (band, score, feedback), a line saying it is
    frozen, and **Return for revision…**, which opens a dialog: a required
    reason, what the student will see, and that the mark and feedback are kept
    in the audit log. Not styled as destructive: nothing is deleted;
  - **draft**: one sentence. Not handed in; its content is the student's until
    they hand it in. No controls.
  - nothing chosen (wide only): how many are waiting, and **Open the oldest
    waiting**.
- Focus moves to the pane's heading when a submission is opened, and after
  save-and-advance to the next one's. The return dialog is opened from state,
  so it returns focus through `onCloseAutoFocus` and the remembered opener
  (`NEXT-SESSION.md` §0c.4).

## Loading, failure, feedback (`.claude/rules/design.md`)

- A skeleton shaped like the queue after 400ms; past 3s it says the API may be
  waking. A failed load: an alert with **Try again**.
- One toast per write, naming what happened to what: *"Graded 3/4: Maria
  Angelica Bacaltos, lab-07"*, *"Returned to Maria Angelica Bacaltos: lab-07"*.
- A refused write keeps the form (or the dialog) as it was, shows the server's
  sentence in place, and raises an error toast that stays. The toast must not
  cover the button that raised it (`NEXT-SESSION.md` §0f.3).
