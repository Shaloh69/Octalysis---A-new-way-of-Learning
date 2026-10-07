# The Studio as an editor — plan v1, rulings APPROVED 8 Oct 2026; E1 in progress

Instructor, 8 Oct 2026, on Course Studio (CS1, built the same morning):

> "Change the design for the Studio. It should look more like an actual editor;
> also the sidebar should be on the right side. Also freedom of clicking and
> typing like MS Word for the topics or moons. Also check what the AI does: does
> it have the ability to create author topics for review, everything from the
> book?"

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | Where the sidebar goes and what it holds | **One right sidebar with two tabs: Outline and AI Assistant.** The chapter is a centred page under one toolbar; nothing on the left |
| 2 | How much freedom "like MS Word" | **All four:** click and type in place; add, delete and reorder topics; edit a moon's wording; add and delete moons |
| 3 | When typing reaches students | **Draft, then Publish.** Typing and saving make a working draft students never see; Publish puts it live. The editing teacher may publish their own edit |
| 4 | What the AI may author for review | **Also propose moons**, besides text, questions and figures from the book |

**What the answers reverse, so nobody finds out by surprise.** Each is a rule
written down earlier, now ruled otherwise by the instructor:

| Earlier decision | Where it lived | Now |
|---|---|---|
| "Adding, removing or reordering blocks in the console. Structure is the `.md` file's; sync owns it" | `design/templates/console/content/SPEC.md`, console CLAUDE.md | The console may add, delete and reorder topics. Once a chapter is published from the console, the database owns its structure |
| "Rich-text editing is not built: the source is the truth" | same | Typing in place with formatting (the reader's own small subset) |
| "A save changes what students read at once" (28 Sep) | same | Draft, then Publish. The old live-on-save route is retired |
| "Objectives are the syllabus's contract, transcribed verbatim" | `.claude/rules/content.md`, `check:objectives` | A teacher may edit a moon's wording and add or retire moons; the syllabus is where they started, not a lock |
| "Never their own edit" (ruling 6, 7 Oct) | `COURSE-STUDIO-PLAN.md` §3 | **For a teacher's own typed edit only:** the editor may publish it. Ruling 6 still binds drafts written by the AI or synced from files, summaries, figures and questions |
| Hard rule 5's two exceptions | root `CLAUDE.md` | A third: the AI may **propose** moons and topics from the book, each accepted by a teacher into a draft and published by a teacher |

## What the AI does today, and what it will do

**Today it does nothing a teacher can press.** The Studio's AI pane is locked
because the app that holds a teacher's keys is not built (CS3). What exists:
the **figure reader** (B1: all 380 figures of the book read exactly) and the
assistant's schema (B2). The chapter text for 08-13 and the 131 questions for
09-12 were drafted by Claude in working sessions, with quotes checked word for
word by `sync-content --verify`; that is not a feature a teacher can run.

**Planned (AI-ASSISTANT-PLAN.md §5, v6):** from the book, with the checks the
plan lists, it drafts **lesson text** (quotes by reference and pasted from the
book, every own-words sentence checked for a supporting passage), **questions**
(keys held by code, a blind second pass), **redrawn figures** and **figure
summaries**, each a PROPOSAL with a diff that a teacher accepts or discards.
Never anything a student sees without a teacher's approval.

**Ruled 8 Oct:** it may also **propose moons** (objectives) for a chapter, as
proposals, accepted into a draft and published by a teacher. "Everything from
the book" is therefore yes for text, questions, figures and moons, through
proposals; it is not yet built, and a moon it proposes needs questions before it
can open anything (E2).

## The design

### Look (E1)

A document editor, not a form. One **toolbar** above a centred **page** on a
canvas (Lexical's model), a **right sidebar** with two tabs (Outline, AI
Assistant; at 380 it is a sheet opened from the bar). The chapter is a stack of
**topics**; click into one and type. Tokens only; three themes; the page itself
uses the reader's own typography so what you type looks like what students read.

Offered: undo, redo, a block menu (paragraph, heading 2, heading 3), bold,
italic, inline code, bullet and numbered list, callout, a code listing, **Insert
topic**. Not offered (the reader renders none of them): fonts, sizes, colours,
alignment, links, images. What the editor offers is what a student can see.

### Topics: add, delete, reorder (E1)

A topic is a **block** (`content_blocks`): `prose`, `brief`, `callout`, `code`,
`quote`, `figure`. Each has a gutter with **Move up, Move down, Delete** (always
visible at 380, on hover and focus at 1440; drag is an extra, never the only way).
**Insert topic** adds a prose, callout or code topic between any two.

- **Quote topics** (`meta.source`) are **locked**: they may be moved or deleted,
  never edited or created in the console. They are checked word for word against
  the book, which the deployed API does not have. New quotes come from the
  assistant's app or `sync-content`.
- **Figure topics** reference an existing figure by id and may be moved or deleted.
- **Tables** (12, all inside callouts) are a **protected** node edited as text, so
  nothing in them is rewritten by the editor's own serialisation.

### Draft, then Publish (E1)

`chapter_drafts` already is a chapter's working copy: one row per chapter, the
whole ordered `blocks` array, a hash, a status, approval bound to the hash, and
`sync-content` already stops writing a chapter whose draft was ever approved.
E1 extends it, so there is **one** working-copy mechanism and **one** publish:

- `origin` (`file` | `console` | `ai`): who made the working copy. A console edit
  of a drafted chapter, or a first edit of any chapter, makes it `console`.
- Each draft block carries `blockId` (the live row's id), so a publish updates
  the right row, inserts new ones and deletes the missing, and **history follows
  the block, not the position**. Ordinals are re-assigned in one transaction.
- `base_hash`: the live chapter's hash when the draft began. A publish refuses
  (409) if live text changed since, in words, with both sides to compare.
- Saves are **autosaved** and carry the draft's version, so two teachers on one
  chapter cannot overwrite each other (409, the typed text kept).
- **Publish** is the existing approval by hash, with a **reason** (what changed),
  the existing audit row, and the old text archived as every replaced block is.
  For `origin = console` the editing teacher may publish their own work
  (`self_approved` is still recorded, so it is visible forever); a teacher of the
  subject or the admin is still required.
- **Discard draft** returns to live. A draft students never saw is not history.
- `sync-content` skips a chapter whose working copy is `console`, and never
  deletes it (it deleted any non-approved draft whose file had gone).

### Moons (E2)

A moon is an `objectives` row, and items, blueprints (one journey per moon),
each student's mastery and four minigames are keyed to its id; a stage opens
when **every** moon is mastered (`is_stage_unlocked()`, the lock layer).

- **Edit wording:** text only, in the same draft-and-publish flow. `sync-content`
  stops overwriting an objective a teacher edited.
- **Add a moon:** a form (wording, bloom level, level 0-6, competency read, trace
  or build), because those place it on the competency grid. A new moon is a
  **draft**: invisible to students and **not counted by the lock** until it has
  enough live questions to fill its journey and is published. Otherwise a planet
  would never open.
- **Delete = retire.** Evidence is never destroyed (rule 6 for items, rule 7 for
  responses): a retired moon disappears for students and from the lock's count;
  its mastery rows and items stay. A moon with a minigame says which one is orphaned.
- The lock function changes, so **E2 gets its own plan and denial tests first**
  (and the instructor's still-owed sign-off on the moon work's lock layer,
  REDESIGN-SIGNOFF.md §5, is a dependency worth settling first).

### The AI's side (E3, with CS3)

The proposal model is the draft model: a proposal is a diff against the working
copy; **Accept** writes it into the draft, **Discard** drops it, and an accepted
proposal is published like any typed edit. Nothing here builds the app.

## Costs and risks, said plainly

1. **Text in git stops being the whole truth.** Once a chapter is published from
   the console the database owns it, and Supabase Free has **no backups**.
   `scripts/export-content.mjs` (E1) writes every owned chapter back to
   `content/stages/NN.md` so git holds it, and `pg_dump` remains the backup.
2. **A new dependency:** an editor engine (TipTap, i.e. ProseMirror) in the
   console, **lazy-loaded with the chapter route** so the console's first load
   does not grow. The conversion between the reader's markdown and the editor is
   our own (a reader-AST ⇄ editor-doc converter), because the reader's markdown
   is a custom dialect and a generic converter would drift from it.
3. **The fidelity claim is tested, not hoped:** every block of all 754 in the
   chapters and drafts goes markdown → editor → markdown and must parse, with the
   reader's own parser, to exactly the same blocks as before. A block that cannot
   is shown as protected text, never silently changed.
4. **Rewriting the structure of a chapter is a bigger power than fixing a typo.**
   It is why Publish exists and why history, discard and the diff matter.
5. **E2 touches the lock layer.** Treated as the highest-risk piece, and last.

## Phases

| Phase | What | Gate |
|---|---|---|
| **E1.1** | Schema (`addendum-studio-editor.sql`, the fifteenth file, on Supabase first) and API: the working copy, autosave, discard, publish with block ids and ordering, the author rule for `console`; denial tests red first; `sync-content` guard | API tests |
| **E1.2** | The converter (reader AST ⇄ editor doc) and its 754-block round-trip test | unit tests |
| **E1.3** | The editor page: right sidebar tabs, page, toolbar, topic controls, Publish and Discard, REDONE from the templates; SPEC rewritten | spec at 1440 and 380, six assertions, captures opened |
| **E1.4** | `export-content.mjs`; docs | test |
| **E2** | Moons: its own plan first | its own gate |
| **E3** | AI proposals, with CS3 | with the app |

Templates, captured and opened 8 Oct 2026: `design/templates/console/studio-editor/`
(Lexical's playground for the Word-like toolbar over a page; TipTap's Simple
Editor for the toolbar's vocabulary; TipTap's Notion-like for blocks and the
outline rail). Novel and CKEditor's demos rejected, with reasons in `SOURCE.md`.
