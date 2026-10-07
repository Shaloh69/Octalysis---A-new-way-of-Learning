# `/studio` — Course Studio — SPEC (CS1)

One page for a course's material: **is it there, is it right, and who has
read it.** It takes in `/content` and `/content/:stageId` (both redirect here,
so old links work) and, in CS3, the planned `/assistant`. Plan:
`docs/COURSE-STUDIO-PLAN.md` §1-§3 (rulings approved 7 Oct 2026, night).

References: `SOURCE.md` here (shadcn's sidebar-15 for the three panes,
BlockNote's editor and AI menu). The old `/content` SPEC
(`../content/SPEC.md`) is the requirements document for everything the page
carries over, and every rule it keeps still binds. Colours and type are ours.

## What the page is for

A teacher opens it for five reasons, and the page is built around them:

1. **Where does each chapter stand?** Per chapter, never an aggregate
   (authored / planned / empty; hard rule 5's dashboard).
2. **What is waiting for me to read?** Summaries, drafted lesson text and
   figures, in one queue. Approve the exact text on screen, or send it back
   with a reason.
3. **Fix a typo now**, without a redeploy: edit one block, see it as a student
   will, save it with a reason and the version opened.
4. **Which subjects and books exist?** Add a subject (a code and a title),
   rename it, add and edit its books, set its default book.
5. **(CS3, locked now) Check a chapter with the AI.** The pane is there and
   says plainly that the app is not released yet.

## Routes

| Route | The editor pane shows |
|---|---|
| `/studio` | **Overview**: the KPI row and every chapter, as `/content` did |
| `/studio/review` | **To review**: summaries, drafted lesson text, figures, grouped by state |
| `/studio/:subject` (`/studio/cpe-412`) | **The subject**: its code and title, its books, its classes (a count, and where they are assigned) |
| `/studio/:subject/:stageId` (`/studio/cpe-412/04`) | **One chapter**, with tabs in the address (`?tab=`) |
| `/content` | redirects to `/studio` (`?view=summaries` to `/studio/review`) |
| `/content/:stageId` | redirects to `/studio/cpe-412/:stageId` |

A subject's address is its code, lowercased, the space a hyphen
(`CPE 412` -> `cpe-412`). An unknown subject or chapter renders a "not found"
line in the editor pane with a link to the Overview, never a blank.

## Structure — three panes (sidebar-15)

```
 ┌ Outline (16rem) ────┬ Editor (fluid) ─────────────────────┬ AI (18rem) ──────────┐
 │ Overview            │ [≡ Outline] CPE 412 › 04 Cache  [AI]│ AI Assistant  locked │
 │ To review  · 7      │ h1 04 · Cache Memory                │ The AI Assistant app │
 │ ─ Subjects ──── [+] │ line: period, state, blocks, edits  │ is not released yet. │
 │ CPE 412 ▾           │ [Blocks · Summary · Figures · Draft │ When it is: the four │
 │   Books (2)         │  · Objectives]                      │ checks, proposals    │
 │   00 Orientation    │ the tab's content                   │ with a diff, accept  │
 │   01 ... 18         │                                     │ or discard.          │
 └─────────────────────┴─────────────────────────────────────┴──────────────────────┘
```

**At 1440** (the page's own width at 72rem and up): all three panes. The bar
over the editor holds **Outline** and **AI** toggles that hide and show their
pane (pressed = shown); the editor takes the room.

**At 380** (below 72rem of its own width): the editor is the page. **Outline**
and **AI** open as sheets from the left and right (a modal dialog: focus
moves in, Escape closes, focus returns to the button). Choosing a chapter in
the outline sheet closes it.

The console's own nav stays: Studio replaces **Content** in the Course group.

### The outline (left)

1. **Overview** and **To review · n** (n = summaries, drafts and figures
   waiting), each a link; the current one is marked (`aria-current`).
2. **Subjects**, an h2 with **Add subject** (a `+` button with a text label
   for screen readers and a tooltip).
3. Each subject, code (mono) and title, a disclosure button (expanded state in
   `aria-expanded`); under it:
   - **Books (n)**, a link to the subject's page
   - **Chapters**: every stage, a link each: id (mono), title, and a state in
     a word beside it when one needs reading ("to review"). Only CPE 412 has
     chapters. Any other subject says, in words: *"No chapters yet. A subject's
     own star system arrives with CS2."*

### The editor (middle)

**Overview** (`/studio`): h1 *Course Studio*, one line saying what the page is
for; the four KPI tiles (chapters authored, summaries approved, edits not in
git, live items) with their qualifiers exactly as `/content` had them; *The
item bank is the schedule*; the chapters as a table at 56rem of its own width
and up, a list below (columns as `/content`: Stage, Chapter, Period, Status,
Text, Summary, Blocks, Figures, Objectives, Live items). The caption on where
text comes from.

**To review** (`/studio/review`): h1 *To review*; three sections, each an h2
with its count: **Summaries** (to review / sent back / approved, as
`/content`'s Summaries view), **Drafted lesson text** (each waiting chapter, a
link to its Draft tab), **Figures** (each waiting figure, a link to its
chapter's Figures tab). An empty section says so in words.

**A subject** (`/studio/cpe-412`): h1 `CPE 412 · Computer Architecture and
Organization`; **Rename**; **Books**: one row each (title, author, edition in
mono, *Default* as a word), **Edit** and **Make default** on each, **Add
book**; **Classes**: how many classes take it, how many have a teacher, and a
line that classes are assigned on Teachers (the admin's page). A subject with
no chapters says what CS2 will add.

**A chapter** (`/studio/cpe-412/04`): a breadcrumb (`CPE 412 › 04 Cache
Memory`), h1 `04 · Cache Memory`, a line (period, authoring state, block
count, "n edited in the console, not yet in git"). Tabs (`role="tablist"`,
arrow keys move, the tab in `?tab=`):

| Tab | Content (carried over from `/content/:stageId`) |
|---|---|
| **Blocks** (default) | the blocks beside the preview drawn by the student reader's own rules; at 62rem of its own width a split, below it *Blocks* / *Preview* pressed buttons. Edit, Save (a change, a reason, the version opened; 409 on a stale one), Cancel, History, Use this text. Quotes read-only, said in words |
| **Summary** | the planet summary, its state in words, Approve / Send back |
| **Draft** (only when a draft exists) | the drafted lesson text card: what approving does, Approve by hash, Send back, the draft as a student would read it |
| **Figures** (only when the chapter has figures) | each figure, Approve by hash / Send back |
| **Objectives** | the chapter's syllabus objectives, read-only, with the count of live and in-review questions per chapter and a link to Items |

A tab with something waiting carries a word ("to review") in its label.

### The AI pane (right), LOCKED in CS1

h2 *AI Assistant*, a lock icon and the word **Locked**, then:

> The AI Assistant app is not released yet. When it is, you will install it
> on your laptop and connect it here; it checks a chapter against the book,
> the syllabus, your students' results and its writing, and every change it
> suggests is a proposal you accept or discard. Nothing reaches students
> without a teacher's approval.

and the four checks as a plain list (not checkboxes: nothing can be ticked).
**No button**: there is nothing to do yet, and the pane says so instead of
offering a control that does nothing (DESIGN-MANDATE §1). CS3 replaces the
first sentence with "No AI Assistant connected with this device. Download here
and install" when the app exists.

## The approval rule (plan §3, rulings 6 and 7 Oct 2026, night)

**The approver is a teacher of the subject, and never the author of the
version approved. The ADMIN may approve their own edit, recorded as
self-approved.** For summaries, drafted lesson text, figures and items, held
by the database (`db/addendum-studio.sql`), checked by the API first so the
refusal is in words:

- a teacher of the subject = a staff account holding an un-ended class of it,
  or the admin;
- the author of a summary, a draft or a figure is `authored_by` (null: written
  from the files by `sync-content`, so no teacher wrote it); of an item,
  `author_id`;
- every approval row records `self_approved`, set by the database, never by
  the client.

In the Studio, an Approve the viewer may not use is **shown disabled with the
reason beside it in words** ("You wrote this version; another teacher of CPE
412 approves it." / "Only a teacher of CPE 412 or the admin approves its
content."), never hidden: a teacher must be able to tell why.

**Not changed, and the instructor's call:** a block edit still reaches
students at once ("Fix a typo now", 28 Sep 2026). Ruling 6 could be read to
need a second teacher for those too; that is recorded as a question, not
decided here.

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Overview / To review / a chapter** (outline links) | the editor answers a different question | `aria-current`; the address says it | Back | — |
| **Outline / AI** (bar toggles) | a pane appears or goes (1440), or opens as a sheet (380) | pressed state; the sheet is titled | press again / Escape | — |
| **Subject disclosure** | its books and chapters show or hide | `aria-expanded`, a chevron | press again | — |
| **Add subject** (dialog: code, title, reason) | a subject exists; books can be added and classes assigned to it; audit row | the dialog says it has no chapters until CS2 | Rename; a subject is never deleted (classes refer to it) | — |
| **Rename** (dialog: title, reason) | the subject's title changes everywhere it is shown; audit row | the old and new title in the dialog | rename again | — |
| **Add book / Edit** (dialog: title, author, edition, reason; *make it the default* on Add) | the subject's book list changes; audit row | the dialog names the subject | Edit again | which book a class reads is the book the AI checks against (CS3) |
| **Make default** (dialog: reason) | classes with no book of their own now read this one; audit row | the dialog says how many classes follow the default | make the other one default | — |
| **Tabs** (chapter) | shows another part of the chapter | `aria-selected`; the address says it | another tab | — |
| **Approve** (summary, draft, figure) | students see this exact text or drawing; audit row (self-approved when the admin approves their own) | labelled with the stage or figure; disabled with the reason in words when the viewer may not | **Send back** withdraws it | the teacher reads the exact words first |
| **Send back** (dialog, reason required) | it leaves or never reaches students; the reason is kept | the dialog says what students will see | a new draft in the file returns it to review | the reason tells the author what to change |
| **Edit / Save / Cancel / History / Use this text** (blocks) | as `/content/:stageId` (its SPEC) | as there | as there | as there |
| **Blocks / Preview** (narrow) | shows the other half | pressed | press the other | — |

## States

| State | What renders |
|---|---|
| Loading, under 400ms | nothing (space reserved) |
| Loading, over 400ms | a skeleton the shape of the pane being loaded |
| Loading, over 3s | the skeleton and a sentence: the API may be waking |
| Load failed | an alert naming the failure, with **Try again**, in the pane that failed (the outline failing does not blank the editor) |
| Unknown subject or chapter | "No subject cpe-999." / "No chapter 42 in CPE 412." with a link to the Overview |
| A subject saved | toast: "CPE 413 added. Give it a book next." / "CPE 412 renamed." |
| A book saved / made default | toast naming the book and the subject |
| A refusal (a code already used, a twin book, a stale page) | error toast that stays; the dialog keeps what was typed |
| Approve refused (not allowed) | the button was already disabled with the reason; if the API refuses anyway, an error toast in its words |
| Every other state | as `../content/SPEC.md` States |

## Type and colour

Every code, number, ordinal, version, hash, file path and edition is mono.
Status is a word, never a colour alone (success: authored, approved; info:
planned, to review; warning: sent back; neutral: empty, none). No `danger`
anywhere on the page: nothing here deletes, and sending back is not a failure.
The locked AI pane is neutral, not a warning: nothing is wrong.

## What is not built, by decision

- **Deleting a subject or a book.** Classes and (from CS2) a subject's
  chapters refer to them; a wrong one is renamed or edited.
- **Changing a subject's code.** It is the key classes refer to; a new code
  is a new subject.
- **A new subject's chapters.** CS2 (= T3): a subject as its own star system.
- **The AI sidebar's work.** CS3, with the assistant's app.
- Everything `/content` did not build (adding, removing or reordering blocks;
  editing a summary's text; rich-text editing) stays not built, for the
  reasons in `../content/SPEC.md`.

## The gate

`design/specs/console-studio.spec.ts`, at 1440 and 380: the six assertions
(nothing clipped, no horizontal page scroll, keyboard reachable, AA contrast
on all three themes, tokens used, reduced motion honoured) on the Overview, a
chapter, a subject, To review, and the AI pane / sheets; plus the behaviour
`console-content.spec.ts` held (moved here), the redirects, the subject and
book dialogs, and the approval rule's disabled Approve with its reason.
Captures `current.png` and `current-380.png` here, opened.
