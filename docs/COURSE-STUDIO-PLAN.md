# Course Studio — plan v1, rulings APPROVED 7 Oct 2026 (night); **CS1 BUILT 8 Oct 2026**, CS2 and CS3 not

Instructor, 7 Oct 2026 (night), on the gap "there is no screen to add a
subject or a book":

> "This part is where the AI shines, remember: to help with the course
> content. Name that page to that. An editor of sorts to check the courses
> with the AI on a separate sidebar. Also maybe find templates and ask me
> questions of things you don't understand."

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | The name | **Course Studio** |
| 2 | Its relation to `/content` and the planned `/assistant` | **One page for all three.** Subjects and books, chapters and their editor, and the AI sidebar in one place; `/content` and `/assistant` fold into it |
| 3 | Who uses it | **Every teacher, fully**: any teacher adds subjects and books and edits any content (supersedes the teachers plan's "the API writes subjects, the admin manages them") |
| 4 | When | **Split it**: the subjects, books and editor part NOW (before profiles); the AI sidebar with the assistant's app, locked until then |
| 5 | A new subject (CPE 413) | **Its own star system**: its own planets (chapters), moons, questions, checks and grades; a CPE 413 class's students see that map. This is the teachers plan's **T3** |
| 6 | Who approves content for students | **The subject's teachers**, never their own edit: a second teacher who holds a class of that subject, or the admin |
| 7 | What the AI checks | **All four:** against the book (quotes, facts, figures), against the syllabus (every objective taught and asked), against student results (where they keep failing), and writing quality (clear, no padding, the right level, consistent terms) |

Unchanged and binding: the AI runs through the teacher's own app on their own
keys (round six), so the sidebar is **locked** ("No AI Assistant connected
with this device. Download here and install") until it is connected; every
AI result is a **proposal** with a diff, accepted or discarded, never written
straight in; nothing reaches students unapproved (hard rule 5); the
assistant's rules (`.claude/rules/assistant.md`) bind the sidebar.

Templates, captured and opened 7 Oct 2026: `design/templates/console/studio/`
(shadcn's sidebar-15 for the three panes, BlockNote's AI menu, BlockNote's
editor). Prodly, the closest match, rejected: behind a sign-in.

## 1. The page (`/studio`, console, every teacher)

```
 ┌ Outline ─────────────┬ Editor ──────────────────────────┬ AI ───────────────────┐
 │ Subjects             │ CPE 412 › Ch 12 Pipelining       │ (locked until the app │
 │  CPE 412 ▾           │  [Blocks · Objectives · Figures  │  is connected)        │
 │   Books (2)          │   · Questions · Summary]         │ Check this chapter:   │
 │   Chapters 00-18     │  the block editor (today's       │  ☐ the book           │
 │    12 Pipelining ●   │  /content/:stageId rules: a      │  ☐ the syllabus       │
 │  CPE 413 ▾ (draft)   │  reason and the version on every │  ☐ student results    │
 │  + Add subject       │  save; quotes read-only)         │  ☐ writing            │
 │                      │  Approve / Send back (not your   │ Proposals: diff,      │
 │                      │  own edit)                       │  Accept / Discard     │
 └──────────────────────┴──────────────────────────────────┴───────────────────────┘
```

At 380 the outline and the AI are sheets opened from the bar; the editor is
the page. Its route replaces `/content` and `/content/:stageId` (redirects
kept, so old links work) and `/assistant`.

## 2. Phases (the instructor's "split it", and T3)

| Phase | What | When |
|---|---|---|
| **CS1 (BUILT 8 Oct 2026; NEXT-SESSION 0zj, the SPEC's "As built")** | Course Studio without AI: subjects (add, rename; a code and a title), their books (add, edit, set the default), the outline, and today's `/content` work moved in (chapter status, the block editor, summaries, figures, chapter drafts), with the **new approval rule** (the subject's teachers, never your own edit). For CPE 412 only, because only CPE 412 has a star system | **Done 8 Oct 2026** |
| **CS2 = T3** | A subject is its own star system: stages, objectives, items, blueprints, assessments and the student map keyed by subject; a new subject's chapters are created in Studio; a CPE 413 class's students see CPE 413's map. Touches nearly every table and the student app | After T2 (approved) |
| **CS3** | The AI sidebar, through the teacher's app: the four checks, proposals with diffs, chapter drafting (the assistant plan's B5-B6 inside Studio) | With the assistant's app |

## 3. What CS1 changes in rules already built

- **Subjects and books are written by every teacher** (through the API, with
  a reason, audited), not the API alone on the admin's behalf. The RLS stays
  "no client write": the API's `requireStaff()` route does it.
- **The approval rule changes everywhere content is approved** (chapter
  drafts, summaries, figures, items): the approver must not be the author of
  the version approved. Today `/items` already gates self-approval on
  authorship; CS1 makes it the rule for all, in the database where it can be.
  **Decided (instructor, 7 Oct 2026, night): the ADMIN may approve their own
  edit**, so a one-teacher department is never stuck; every such approval is
  recorded in the audit log as self-approved. No other teacher may.

## 5. The student side of CS2: many star systems around a black hole

Instructor, 7 Oct 2026 (night): "If a student has different teachers, each
with its own star system, it will be a different page. For the map it will
be the solar systems orbiting a huge black hole, with Enter Journey
explaining: this star system is for the subject, etc." And: "chats,
summarization and course progress will update depending on that star
system." Templates captured and opened: `design/templates/web/galaxy/`.

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | A student with ONE subject | **Straight to their system**, as today; the galaxy appears with two or more |
| 2 | What `/app` is with several systems | **`/app` is the galaxy**: the black hole with each subject's system on its own orbit; each system's map moves to **`/app/<subject>`** (e.g. `/app/cpe-412`); old links redirect. **Amends the 30 Sep ruling** "/app is the 3D map and the ONLY map": the galaxy is a second 3D view, above the systems |
| 3 | What follows the star system | **Everything inside a system is that subject's:** Stages, Progress, Your Work, Chat and Settings; its planet summaries, the student bot's study summaries and sheets, and the progress summary |
| 4 | The galaxy's own pages | With more than one subject, the main level has **its own Progress and Your Work** (across the subjects), **with the black hole as the main view** |
| 5 | Motion | **It zooms out and zooms in**: entering a system zooms into it from the black hole; leaving zooms back out (a cut under reduced motion) |

The page (to its SPEC when built): the black hole at the centre, each
system an orb on an orbit that keeps the Kepler rule; choosing one opens a
card ("This star system is CPE 412 · Computer Architecture and Organization,
taught by …, section …; N planets, you are P% through") with **Enter
Journey**. The accessible layer binds (`VISUAL-SYSTEM-3D.md` §5): every system
is also a real button, reduced motion freezes the orbits and cuts the zoom,
no WebGL keeps the list. Chat rooms become per class (section x subject).

### 5a. The galaxy's engineering: real physics, detail by distance, measured speed

Instructor, 7 Oct 2026 (night): "This galaxy should follow the rules of real
physics, and textures of those animations; some solar systems only visible,
like planets, if we get close. Make sure it is also fps friendly, with proper
LODs. Make sure this works as intended."

**Real physics, a compressed scale.** The LAWS are real; the DISTANCES are not
(at true scale every system would be an invisible point and the black hole a
dot). Kept exactly:

- **Kepler's third law** for every orbit, systems around the black hole as
  planets around a sun already do (`WEB-REVAMP.md` §4): angular speed
  proportional to a^-1.5, so an inner system laps an outer one; T^2 / a^3 the
  same for all of them.
- **The black hole by its own radii:** the event horizon (r_s), the photon
  ring at 1.5 r_s, and the accretion disc's inner edge at the innermost
  stable circular orbit, 3 r_s (6GM/c^2 for a non-spinning hole); the disc
  itself Keplerian (its inner edge turns fastest).
- **Doppler beaming:** the side of the disc moving toward the camera is
  brighter, and gravitational redshift dims and reddens the inner edge.
- **Gravitational lensing** of the disc and the stars behind the hole: a
  screen-space shader on the highest quality tier only; lower tiers keep the
  photon ring and a fixed lensed glow (honest: true ray-traced lensing does
  not hold 30 fps on a mid-range phone).
- Textures procedural (noise in the shader), not downloaded images, so the
  look costs no bandwidth; colours from tokens (`VISUAL-SYSTEM-3D.md` §6).

**Detail by distance (LOD), with hysteresis so nothing flickers at a border:**

| Level | When | What is drawn |
|---|---|---|
| L0, the galaxy | the default view | the black hole and disc; each subject's system as ONE glowing star on its orbit (one instanced draw for all of them) and its orbit ring; **no planets** |
| L1, approaching | the camera within a system's near radius, or a system selected | that system's planets appear as points on their orbits (one instanced draw for the system), fading in |
| L2, entered | after Enter Journey's zoom | the full system scene as today (planet meshes, moons, the HUD); the galaxy's other systems culled; its chunk already loaded |

Frustum culling, shared geometry and materials, instancing, the device pixel
ratio capped, `frameloop="demand"` (no frame drawn while nothing moves), and
the existing degradation ladder (reduced motion, no WebGL, a slow device,
Battery Saver) all apply unchanged.

**"Make sure this works as intended": what CS2 must show before it is done.**

1. **Physics, unit-tested:** T^2/a^3 constant within 0.1% across the systems;
   the disc's inner edge at 3 r_s and the photon ring at 1.5 r_s; inner disc
   faster than outer; the approaching side brighter than the receding one.
2. **LOD, tested in the browser:** at L0 no planet is in the scene and the
   draw calls are within budget; moving inside a near radius brings that
   system's planets in; moving back and forth across a border does not
   flicker (hysteresis); after Enter Journey only the entered system remains.
3. **Speed, measured as `PROGRESS.md` measures `/app` today:** 60 fps at
   1440 on desktop; at least 30 fps at a 6x CPU slowdown; draw calls at most
   50 (the galaxy's own ambient at most 12); the 3D chunk at most 250 KB
   gzipped and still never preloaded; idle draws nothing.
4. **On a real phone:** a mid-range Android, because CPU throttling is not a
   weak GPU (fill rate is the phone's limit). Owed by the instructor or
   whoever holds the phone; recorded, not assumed.
5. **Seen:** captures of L0, L1, the zoom mid-way and L2, at 1440 and 380,
   opened and looked at; reduced motion and no-WebGL captured too.

## 6. CS2 = T3, the data side — plan v1, 15 Oct 2026 — **RULED the same day (§6.6); nothing built**

§5 and §5a own what a student SEES (the galaxy, the zoom, the LOD). This section is what the data must
become first, with ruling 4 (9 Oct 2026, `TEACHERS-AND-SUBJECTS-PLAN.md` §5.9): **the Prelim, Midterm and
Finals are global; stage checks and moons follow the class's BOOK.**

### 6.1 What is true today (read from the schema, 15 Oct 2026)

- A stage is `stages.id` text `'00'..'18'`, one global set; about ten tables key on that text (`objectives`,
  `content_blocks`, `items`, `blueprints`, `stage_progress`, `stage_locks`, `chapter_drafts`, `figures`,
  `submissions`, …). `content_subject_of(stage)` returns `'CPE 412'` for every stage: it is the one place
  the subject is "known".
- `classes.book_id` already records a class's book (null = the subject's default, Stallings 9th).
- Every assessment's blueprint points at a stage or is a final; T2 5.10 (built today) adds a class's own
  window over a shared stage check.

### 6.2 The model, in one sentence

> **A book is a curriculum: it owns its chapters (stages), their moons, questions, stage checks and moon
> checks. A class takes one book; its students see that book's system. A subject owns its exams, drawn
> from its own bank.**

| Thing | Keyed by | Who changes it |
|---|---|---|
| chapters (stages), moons (objectives), lesson text, figures | **book** (`stages.book_id`) | the subject's teachers, through Studio (Draft then Publish, as CS1) |
| questions (items) | the stage, so the book | as today (`/items`, approval rule) |
| a stage check, a moon check | the stage, so the book; a class's window over it (5.10) | the admin sets the shared one; a class's teacher their class's |
| Prelim, Midterm, Finals | **the subject** (global across its classes) | the admin |
| locks, progress, mastery | the student and the stage (unchanged) | as today |

### 6.3 Stage ids (the one decision that touches everything)

**Proposed: keep CPE 412's `'00'..'18'` exactly as they are, bound to the 9th-edition book; every new
stage gets an id `<book-key>-NN`** (e.g. `s10-12` for Stallings 10th, chapter 12). No existing row, URL or
attempt changes; `stages.book_id` is added and back-filled; `content_subject_of(stage)` becomes a lookup.
The rejected alternative (renumber everything to `cpe412-9e-07`) rewrites every foreign key and every
student's history for no gain a student can see.

### 6.4 Phases, each its own session and its own gate

| | What | Students see |
|---|---|---|
| **CS2a** | `stages.book_id` (+ `subjects` linkage), `content_subject_of()` a lookup, the API and RLS asking "which book does this student's class take?" (the class's book, else the subject's default); every query that lists stages filters by it. Denial tests: a student never reads another book's stage, item, check or progress | **nothing changes** for CPE 412 (one book in use) |
| **CS2b** | Studio makes a book's chapters: **Start this book's chapters** (empty, or as a DRAFT copy of the default book's, the teacher's choice), then the CS1 editor, moons (E2), figures; questions on `/items` per book | nothing until Publish |
| **CS2c** | Per-book stage checks and moon checks (created with the book's stages, as the 13 today were); the exams per subject drawing from that subject's live bank across its books | a class on the new book sits that book's checks |
| **CS2d** | The student galaxy, §5 and §5a, built to §5a's five proofs | the galaxy, for a student with two or more subjects |

### 6.5 Asked with this plan

1. **Stage ids**: keep `'00'..'18'` for CPE 412 and give new books `<book-key>-NN` (recommended), or renumber?
2. **"A teacher uploads a book"**: in CS2 a book's chapters are **written in Studio** (or copied from the
   default book as drafts); reading a PDF and drafting from it is the AI's work, CS3. Agreed?
3. **The exams when one subject's classes take different books**: draw from **every live item of the
   subject** (both books), or from **the default book's** only? Recommendation: the default book's, so every
   student of the subject sits an equivalent paper (the uniqueness-with-equivalence rule).
4. **Two classes on one book**: they **share** that book's stage checks (and each may set its own window,
   5.10). Recommendation: share.

### 6.6 Ruled 15 Oct 2026 (question tool)

1. **Stage ids: keep `'00'..'18'`, prefix new books' chapters.** As recommended.
2. **Changed: "Need PDF. Book upload is the start. Via the AI that will help draft and author all of the
   objectives, the stages, the exams, the items, and [teachers are] left with editing and manual reviews."**
   So a new book begins with **uploading its PDF**, and the AI drafts everything a book owns: chapters
   (stages), moons (objectives), questions (items) and the exams. Teachers edit and review; nothing reaches a
   student until it is published and approved (hard rule 5's third ruling stands).
3. **The exams draw from the default book's live bank only.** As recommended.
4. **Two classes on one book share its stage checks**, each with its own window (5.10). As recommended.

**What ruling 2 changes in the phases.** The AI runs through each teacher's own app on their own keys (round
six; `.claude/rules/assistant.md`), and that app does not exist yet. So:

| | Revised |
|---|---|
| **CS2a** | unchanged: the data keyed by book, invisible to students. **Buildable now.** |
| **CS2b** | **Upload a book**: a PDF to a private, staff-only bucket (one per book; storage counts against the free tier's 1 GB, so a size cap and a stated limit), its text extracted and kept beside it, and the book's page on Studio showing what was read. No AI yet. Buildable after CS2a. A textbook is copyrighted: the file is staff-only, never served to a student, never in a bundle |
| **CS2c** | **The AI drafts the book**: chapters, moons, questions and exam blueprints as DRAFTS in Studio and `/items`, each with its source pages, every quote checked against the extracted text (as `sync-content --verify` does for Stallings today). **Needs the assistant's app (CS3)**: the two land together |
| **CS2d** | per-book stage and moon checks; exams per subject from the default book's bank |
| **CS2e** | the student galaxy (§5, §5a) |

**Still to ask before CS2b:** the size cap for a book PDF (the free tier holds 1 GB in all, shared with chat
attachments and pictures), and whether a scanned PDF (images, no text layer) must be read too (that needs OCR).

## 4. Order (APPROVED, 7 Oct 2026, night)

T1 (done) → **CS1** → profiles → T2 → **CS2 (T3)** → the student bot and the
Study Session → the assistant's app with **CS3**.
