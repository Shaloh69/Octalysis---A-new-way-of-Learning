# `/content` — SPEC

> **SUPERSEDED 8 Oct 2026 by Course Studio** (`../studio/SPEC.md`): `/content` and
> `/content/:stageId` redirect to `/studio` and `/studio/cpe-412/:stageId`. This
> file stays as the requirements document every rule the Studio kept came from.

Two routes, one job: **is the course text ready, and is it right.**

- `/content` — every chapter's authoring state, and the planet summaries
  waiting for review
- `/content/:stageId` — one chapter: its summary, and its blocks with an editor
  beside a preview of what a student reads

References: `SOURCE.md` (Decap's split editor, Dillinger's source pane,
shadcn-admin's Tasks table). Colours and type are ours.

## What the page is for

A teacher opens it for three reasons, and the page is built around them in this
order:

1. **Which chapter has no teaching text yet?** The status table, per chapter,
   never an aggregate (hard rule 5's dashboard: 8 of 19 authored must stay
   8 of 19)
2. **Is this summary fit for students?** Approve it, or send it back with a
   reason. Nothing reaches the map sidebar unreviewed (`WEB-REVAMP.md` §3.8)
3. **Fix a typo now, without a redeploy.** Edit one block, see it as a student
   will, save it with a reason

## Instructor decisions, 28 Sep 2026

| Question | Ruling |
|---|---|
| Where does summary approval live? | **In the database, bound to the text.** `sync-content` writes each draft to `stage_summaries`; approving copies that exact text to `stages.summary`. A changed draft withdraws its approval. The `.md` `summary_status` line is no longer the gate |
| Build the editor? | **Yes**: edit a block with a live preview; each save is a new version with an audit row |
| What does sync do to a console edit? | **Keep, report, pull back.** Sync never overwrites a console edit. File unchanged: the edit stays and is listed. Both changed: the edit stays and sync reports a conflict. `sync-content --pull` writes console edits back into `NN.md`, so they reach git and `--verify` |
| Quote blocks (`source="ch-NN.md …"`)? | **Read-only in the console.** They are checked word for word against the book, which the deployed API does not have. Edited in `NN.md` |
| Where is summary review? | **Both**: a Summaries view on `/content`, advancing to the next like `/items`' queue, and the summary on each chapter's page |

## Structure, top to bottom

### `/content`

1. **Header**: *Content*, one line saying what the page is for
2. **KPI row**, four tiles, each a label, a mono value and a qualifier:
   - *Chapters authored* `8/19` · "11 planned: objectives and outline, prose to come"
   - *Summaries approved* `0/19` · "19 to review" (a link to the Summaries view)
   - *Edits not in git* `n` · "run sync-content --pull" when n > 0, else "every edit is in the files"
   - *Live items* `0/720` · "% of the target bank"
3. **The item bank is the schedule**: kept, shortened. It is the one place the
   page says why the live-item number matters
4. **View**: two pressed buttons, *Chapters* and *Summaries · N to review*. The
   view is in the address (`?view=summaries`), so Back and a reload keep it
5. **Chapters** (default): a table at 56rem of its own width and up, a list
   below. Columns: Stage (mono), Chapter (the link to its editor; "not graded"
   beside Orientation), Period, Status (*Authored* / *Planned* / *Empty*),
   Summary (*To review* / *Approved* / *Sent back* / *None*), Blocks (mono, "+n
   edited" when the console holds edits not in git), Objectives, Live items
   ("+n in review"). The list carries the same facts, every one visible at
   380: this is the defect in `before-380.png`
6. **Summaries**: three groups under h2s, in this order: *To review*, *Sent
   back*, *Approved*. Each entry: stage and title (a link to the chapter), the
   summary in full, and its state in words with who and when; a sent-back one
   carries its reason. Controls: **Approve** and **Send back** on a draft;
   **Send back** alone on an approved one (it withdraws it from students)
7. A line under the table: where the text comes from and how an edit reaches
   git

### `/content/:stageId`

1. **Header**: a back link to *Content*; h1 `04 · Cache Memory`; a line: period,
   authoring state, block count, "n edited in the console, not yet in git"
2. **Summary card**: the text, its state, and the same Approve / Send back
3. **Editor and preview**: at 62rem of its own width and up, two columns. Below
   it, two pressed buttons, *Blocks* and *Preview*, one at a time
   - **Blocks** (left): every block in order. A row: ordinal (mono), kind,
     the first line, and its facts in words (version, "edited in the console",
     "quote from ch-04.md 4.3, edit it in content/stages/04.md"). **Edit** opens
     the block in place: the source in a mono textarea with its character
     count, *What changed* (required), **Save** and **Cancel**. **History**
     lists the versions this block replaced, each with who, when, why and how
     (console, sync, direct), and **Use this text** loads one into the editor,
     so restoring is an ordinary edit with a reason
   - **Preview · as a student reads it** (right): the whole chapter, rendered
     by the same rules as the student reader (`StageReader.tsx`'s `Block`:
     paragraphs, lists, bold, code in mono, callouts, the planned-chapter note).
     The block being edited shows what is typed, as it is typed, and is marked
     *editing*

## Controls, and the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Chapters / Summaries** (pressed) | the page answers a different question | the pressed one is shown; the address says so | press the other | — |
| **A chapter's title** | opens its editor | a link | Back | — |
| **Approve** (summary) | students see this text in the map sidebar; a toast says so, audit row | labelled with the stage | **Send back** withdraws it | the teacher reads the exact words first; the approval is of *that* text |
| **Send back** (dialog, reason required) | the summary leaves students' screens, or never reaches them; the reason is kept | the dialog says what students will see (nothing) | a new draft in `NN.md` returns it to review | the reason tells the author what to change |
| **Edit** (block) | opens the source in place; the preview follows the typing | the block is marked *editing* in the preview | **Cancel** | — |
| **Save** (reason required) | the students' text changes now; a version is kept; audit row; a toast | disabled until the text differs and a reason is given; says the version it makes | **History → Use this text** | the preview showed the result first |
| **History / Use this text** | lists replaced versions; loads one into the editor | who, when, why, how on each | Cancel | — |
| **Blocks / Preview** (380) | shows the other half | pressed | press the other | — |

Nothing on a quote block is editable, and it says why in words beside it.

## States

| State | What renders |
|---|---|
| Loading, under 400ms | nothing (space reserved) |
| Loading, over 400ms | a skeleton the shape of the KPI row and 19 rows; on a chapter, the header, the card and block rows |
| Loading, over 3s | the skeleton and a sentence: the API may be waking |
| Load failed | an alert naming the failure, with **Try again** |
| No summary for a stage | the Summaries view lists it under none; the chapter card says "No summary drafted in content/stages/NN.md" |
| Approve ok | toast: "Stage 04 summary approved. Students see it on the map now." Focus to the next draft's Approve |
| Approve refused (text changed since the page loaded) | error toast that stays: "This summary changed since you opened it. Read it again." and the list reloads |
| Send back ok | toast: "Stage 04 summary sent back." |
| Save ok | toast: "Stage 04, block 3 saved as version 4." The row says "edited in the console" |
| Save refused (someone saved it first) | error toast that stays; the editor keeps the text, and says reload to see theirs |
| Save refused (quote block, empty text) | an alert in the editor, in words |

## Type and colour

Every number, ordinal, version, file path and the block source is mono. Status
is a word, never a colour alone: Authored/Approved use the success tone,
Planned/To review info, Sent back warning, Empty/None neutral. No `danger`
anywhere: nothing here is destructive, and sending back is not a failure.

## What is not built, by decision

- **Adding, removing or reordering blocks** in the console. Structure is the
  `.md` file's; sync owns it, and an ordinal is what ties a block to its place
  in the file
- **Editing a summary's text** in the console. Drafts are written in `NN.md`
  (hard rule 5's narrow exception covers a drafted summary *because* it is
  reviewed); the console reviews them
- Rich-text editing. The student reader renders a small subset; the source is
  the truth

## Drafted lesson text (instructor ruling, 5 Oct 2026)

"Author everything for me so that I can approve them in the admin." Lesson
text had no approval step: a chapter's blocks reached students the moment
they synced. Now a chapter drafted from the textbook (`content/stages/NN.draft.md`)
goes to the staff-only `chapter_drafts` and waits here:

- **The draft card** on `/content/:stageId`: status in words, what approving
  does ("replaces the chapter's 4 blocks with these 52"), how many blocks
  quote the book (each checked by `sync-content --verify`), **Approve stage NN
  lesson text** (posts the hash of the text on screen; 409 if it changed) and
  **Send back** (a reason required, dialog says what happens), and the draft
  drawn as a student would read it.
- The chapters list says **Text to review / approved / sent back** beside a
  chapter's status.
- **Found by looking:** the preview drew `##` and `*x*` literally. Its
  "mirror" of the reader still copied the OLD reader, from before 29 Sep. It
  now uses a copy of the reader's own parser (`lib/reader-markdown.ts`), held
  to the original over every block of every chapter and draft by
  `test/reader-markdown.spec.ts`.

`console-content.spec.ts`: the six gate assertions on the draft card, approval
by hash, the refusal that stays, send-back, the list's words. 73 passed at
1440 and 380 with `console-teaching.spec.ts` 80. Captures `current-draft` and
`current-draft-380`, opened.
