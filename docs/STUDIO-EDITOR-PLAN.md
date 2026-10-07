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

### E2 — the moons plan (v1, written 8 Oct 2026 night; NOT APPROVED — nothing below is built)

Written before any code, because it changes `is_stage_unlocked()`. Read from the
code, not from the docs: `objectives` (schema.sql:91), `is_stage_unlocked()` step 4
(:561-590), `moon_correct/moon_mastered` (addendum-audit.sql), `ensureJourney`
(engine-repo.ts:325), `routes/journeys.ts`, `routes/stages.ts`, `sync-content.mjs:533`,
`MOON_ENCOUNTERS` (apps/web/src/encounters/registry.ts), `ob_read`/`ob_staff`.

**What a moon is wired to today.** `objectives` row `NN.k` (text id, never reused).
Items point at it (`items.objective_id`), one journey blueprint per moon
(`blueprints_one_journey_per_moon`), mastery rows in `objective_progress`
(append-only, rule 7), the map's ring/competency cell (`level`, `competency`), and,
for four moons (01.2, 02.8, 03.9, 04.5), a minigame **in the web code** keyed by id.
A gradeable stage opens its successors when **every** `objectives` row of it is
mastered (2 distinct questions right) and **has a live question** (fail-closed).
About 20 queries in 9 files read `objectives` directly.

#### 1. What editing a moon changes, and what it must not

| Edit | Changes | Must not change |
|---|---|---|
| **Wording** (`description`) | what the map, the stage page and a lock reason print | items, journey, mastery, the lock, any id |
| **Bloom level** | metadata only (nothing draws from it) | — |
| **Level 0-6 / read-trace-build** | the moon's ring and its cell on the competency grid | mastery, the lock. The Publish summary says "moves 05.3 from ring 2 to ring 3" |
| **Add** | a new `NN.k` (next free `k` in the chapter, counting retired ones; never reused) | nothing a student sees, until it is published |
| **Retire** | the moon leaves the map, the stage page, the grid, the lock's count and every draw | `objective_progress`, items, blueprints, assessments, attempts (rules 6 and 7) |

`sync-content` stops overwriting an edited moon: `objectives.owner` ('file' | 'console'),
set to `console` at the first Studio publish that touches the moon (and at creation for
an added one). The upsert becomes `... do update ... where objectives.owner = 'file'`.
A moon retired in the Studio is never resurrected by a file: status is not in the
upsert's set list, and owner holds it. `check:objectives` still diffs the **files**
against the syllabus (unchanged: the syllabus is where the moons started).
`pnpm content:export` also writes `content/export/NN.moons.json` for any chapter with a
console-owned moon, because Supabase Free has no backups.

#### 2. The schema (the SIXTEENTH file, `db/addendum-studio-moons.sql`, idempotent, on Supabase BEFORE the code)

- `objectives.status text not null default 'live' check in ('draft','live','retired')`,
  `objectives.owner text not null default 'file' check in ('file','console')`,
  `retired_at`, `edited_by`. Every existing row becomes `live`/`file`: no behaviour change.
- `objective_edits` — **one pending change per moon**: `objective_id` pk, `action`
  ('edit' | 'retire'), the proposed `description / bloom_level / level / competency`,
  `base_hash` (the live moon's fields when the change began), `version`, `edited_by/at`.
  RLS on, staff **read**, no client write; the API is the only writer. Column grants decided
  on purpose (V-29); the policy needs no cross-table subquery (V-30).
- `view live_objectives` = `objectives where status = 'live'`. **Every student-facing reader
  moves to it** and a static test (`moon-readers.spec.ts`, like `check:boundary`) fails if a
  student route's SQL names `objectives` outside an allow-list, so a 21st query cannot forget.
- `is_stage_unlocked()` step 4 reads `live_objectives`: "has a live moon, and none of them
  unmastered". A **draft** moon is not counted; a **retired** one is not counted.
  `moon_correct/moon_mastered` are unchanged. A gradeable prerequisite left with **no** live
  moon still blocks (fail-closed, as today).
- `moon_publishable(objective_id)`: **at least 3 distinct live questions (families)**; one
  definition, read by Publish and the console. (2 right masters a moon; a third leaves room
  for one miss. A moon with 1 live question could never be mastered and would shut its
  planet forever.)
- `ob_read` (students) becomes `status = 'live' and stage published`; staff see all.
  **`ob_staff` is dropped**, as `cb_staff` was in E1: a staff client can no longer write
  `objectives`; the API (service role) is the only writer, so Publish cannot be bypassed.
- INV-28 reads live moons; one new **warning** invariant: a console-owned live moon with
  fewer than 3 live questions (it can only get there by questions being retired later).

#### 3. A NEW moon is a draft the lock does not count

Add creates `objectives` row `status = 'draft'` at once (questions must be able to point at
it before it is published). A teacher writes or assigns questions to it through the usual
items flow (the item editor's moon picker lists live **and draft** moons of the stage). Draft
moons are invisible to students (RLS and `live_objectives`), absent from the lock, from the
map, the grid, `/progress`, journeys (404), and from **every draw**: stage checks sample only
items whose moon is live, so a draft moon's approved questions cannot appear in a paper
before the moon does. **Publish** flips `draft -> live` only if `moon_publishable()` says
yes; otherwise 409, naming the moon and how many questions it has (3 needed). Discard on a
draft with no items and no evidence **deletes** the row (nothing exists to protect);
otherwise it **retires** it.

*The consequence, stated plainly:* publishing a moon into a planet some students have
already mastered **re-closes that planet's successors for them** until they master the new
moon (the lock is evaluated live). So Publish runs in a transaction, computes
before-and-after `is_stage_unlocked()` for every student, and the dialog says "**N students
who have 06 open would see it close until they master 05.9**". Preview = the same function
rolled back.

#### 4. RETIRE = the moon disappears, the evidence stays

- Gone for students: map, stage page, "N of M moons", the grid, journeys (404), the lock's
  count. Opens planets, never closes them (so retiring needs no re-lock warning).
- Kept: the row (`status = 'retired'`), its items (still `live`/whatever they were, but
  excluded from draws by the live-moon join; reassigning one is a new item version, rule 6),
  blueprints, assessments, every `objective_progress` row (append-only, DB-enforced), and an
  in-flight journey attempt can still be submitted.
- **Refused (409, in words):** retiring the **last live moon** of a gradeable stage (its
  successors would be held shut forever; the instructor opens a planet by hand on /locks
  instead); retiring a moon whose removal leaves a **stage check unable to fill** (the
  engine's own feasibility function, run before commit).
- **A moon with a minigame says so.** The four games are keyed by moon id in the web code,
  and reachable only through that moon's journey. The list of ids moves into
  `packages/contracts` (`MOON_GAMES`, id -> name) so the API can say "01.2 carries **Two
  Columns**; retiring it takes the game off the map; the game's code stays". A test pins the
  web registry's keys to that list.

#### 5. Who may do what

| Act | Who |
|---|---|
| Type a moon's wording, add a draft moon, save a pending edit/retire, discard it | any staff (a teacher of the subject or the admin), as with a topic: it changes nothing a student reads |
| **Publish** (edit, add, retire; one chapter's moon changes at a time, a reason, the hash read) | **a teacher of the subject or the admin** (`approval_verdict`); the editing teacher may publish their own typed edit and it is recorded `self_approved`. A teacher of another subject, a student, an unclaimed account: 403 |
| The AI's proposed moon (E3) | the author rule (never its proposer; ruling 6): not built, the schema leaves `authored_by` for it |

Audit: one `moon.publish` row per publish (what changed per moon, the reason, the impact
counts), `moon.discard`, `moon.add`.

#### 6. The Studio (after approval, from a captured template)

The chapter's Moons card (today read-only, `current-moons.png`) is REDONE as an editor:
each moon a row you type in (wording), with its ring/competency/bloom as small selects,
a status chip (Live, Draft, Retired, "edited, unpublished"), live-question count with the
"needs 3" gap, the minigame badge, **Retire**; **Add a moon** at the foot (wording, bloom,
level 0-6, read/trace/build); one **Publish moons…** dialog (what changes, the re-lock
count, a reason). Template first (captured and opened, in `design/templates/console/
studio-moons/`), then `console-studio-editor.spec.ts` gains the moon claims at 1440 and 380.

#### 7. Denial tests, written RED FIRST

1. A student token cannot INSERT/UPDATE/DELETE `objectives` or `objective_edits` (RLS).
2. **A staff token cannot either** (`ob_staff` dropped): only the API writes; watched red
   with `ob_staff` still in place.
3. A student cannot read a `draft` or `retired` moon (RLS) nor see it in `/stages`,
   `/stages/:id`, `/progress`, the lock reason; `POST /objectives/:id/journey` on one is 404.
4. **A draft moon does not hold a planet shut:** every live moon mastered + a draft moon with
   0 questions -> `is_stage_unlocked()` stays true. Watched red against the old function.
5. **A published moon does:** after Publish the planet closes for a student who has not
   mastered it; the Publish response counted that student.
6. Publish refuses a draft with 2 live questions (409); with 3 it goes live.
7. **A retired moon's evidence survives:** `objective_progress`, items, blueprint and
   assessment rows are all still there; the lock ignores it; UPDATE/DELETE on
   `objective_progress` still raises; a stage check no longer draws its items.
8. Retiring the last live moon of a gradeable stage -> 409; so does retiring the moon a
   stage check needs to fill.
9. **A teacher of another subject cannot publish** (403, and nothing changed); a student
   cannot; an unauthenticated call is 401.
10. `sync-content` leaves a console-owned moon's wording alone and does not resurrect a
    retired one.
11. A stale save (the version moved) is 409 and keeps the typing; Publish of a hash that
    moved is 409.
12. The static `moon-readers` test: no student SQL names `objectives`.

#### 8. Open decisions for the instructor

1. **Sign off the moon work's lock layer** (REDESIGN-SIGNOFF §5, still open) — E2 is built
   on it and changes it again (step 4 reads live moons only).
2. **Minimum questions to publish a moon: 3** (recommended) — or another number?
3. **Publishing a new moon into a planet students already mastered re-closes the planets
   after it for them** until they master it (recommended: allow, with the count shown in the
   Publish dialog; the teacher may open a planet by hand on /locks). The alternative —
   grandfather those students — needs a per-student exemption table and is not in this plan.
4. Edits to an existing live moon's wording go through Publish too (ruling 3), though no
   student's progress depends on a sentence. Recommended: yes, keep one rule.

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
| **E1.1** *(built 8 Oct)* | Schema (`addendum-studio-editor.sql`, the fifteenth file, on Supabase first) and API: the working copy, autosave, discard, publish with block ids and ordering, the author rule for `console`; denial tests red first; `sync-content` guard | API tests |
| **E1.2** *(built 8 Oct)* | The converter (reader AST ⇄ editor doc) and its 754-block round-trip test | unit tests |
| **E1.3** *(built 8 Oct; gate green)* | The editor page: right sidebar tabs, page, toolbar, topic controls, Publish and Discard, REDONE from the templates; SPEC rewritten | spec at 1440 and 380, six assertions, captures opened |
| **E1.4** *(built 8 Oct)* | `export-content.mjs` (`pnpm content:export`); docs | test |
| **E1.5** *(not built)* | Per-topic History in the editor: what the old block editor's History and Use this text did, on a topic | spec at 1440 and 380 |
| **E2** *(plan v1 written 8 Oct, awaiting approval)* | Moons: see "E2 — the moons plan" above | its own gate |
| **E3** | AI proposals, with CS3 | with the app |

Templates, captured and opened 8 Oct 2026: `design/templates/console/studio-editor/`
(Lexical's playground for the Word-like toolbar over a page; TipTap's Simple
Editor for the toolbar's vocabulary; TipTap's Notion-like for blocks and the
outline rail). Novel and CKEditor's demos rejected, with reasons in `SOURCE.md`.
