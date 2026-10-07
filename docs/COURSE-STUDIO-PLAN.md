# Course Studio — plan v1, rulings APPROVED 7 Oct 2026 (night), nothing built

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
| **CS1** | Course Studio without AI: subjects (add, rename; a code and a title), their books (add, edit, set the default), the outline, and today's `/content` work moved in (chapter status, the block editor, summaries, figures, chapter drafts), with the **new approval rule** (the subject's teachers, never your own edit). For CPE 412 only, because only CPE 412 has a star system | **NOW**, before profiles |
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

## 4. Order (APPROVED, 7 Oct 2026, night)

T1 (done) → **CS1** → profiles → T2 → **CS2 (T3)** → the student bot and the
Study Session → the assistant's app with **CS3**.
