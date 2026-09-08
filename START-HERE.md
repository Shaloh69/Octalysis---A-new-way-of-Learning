# START-HERE.md

> **Claude Code: read this file completely before doing anything else.**
> It is the map. Everything else in `/docs` is detail.

---

## 1. What we are building

**OCTA** — a semester-long interactive learning platform for **CPE 412: Computer Architecture
and Organization**, BS Computer Engineering, University of Cebu.

Stage 00 orientation plus the syllabus's **18 chapters**, one stage each, across **four grading
periods** (Prelim, Midterm, Semi-finals, Finals). Textbook: Stallings, 9th ed. Prerequisite:
Microprocessors.

> This **replaced** an earlier target course. `docs/CPE412-CURRICULUM.md` records what changed and
> why; `docs/VERIFICATION.md` V-46 is the finding. Design docs carry a banner wherever their stage
> references describe the superseded curriculum.

Three things make it different from a quiz app:

1. **Every student gets a structurally unique paper.** 70 items on the final check, seeded per
   student, with different numbers, different distractors, different order — but the same
   blueprint, so the papers are equivalent in difficulty.
2. **The teacher controls stage access** globally, per section, and per student, with an audit
   trail.
3. **The teacher can talk back to the system** — a built-in feedback loop covering bug reports,
   bad-question reports, and a periodic usability survey.

Motivation design follows the **Octalysis Framework** (Yu-kai Chou), dialled deliberately:
heavy on intrinsic drives, light and always opt-in on pressure mechanics.

---

## 1b. Resuming after a `/clear`

**`docs/NEXT-SESSION.md` is the fastest correct entry point.** It carries the
phase, the measured local and live state, what is deferred and why, and the
session-closing inventory — each figure with the command that produced it. Read
it before the order below; the documents here are the reference it points into.

## 2. Read in this order

| # | File | Why |
|---|---|---|
| 1 | `START-HERE.md` | this file |
| 2 | `docs/MASTER-PLAN.md` | product definition, 17-stage curriculum, question engine, hosting |
| 3 | `db/schema.sql` | **the data model is the contract.** Read it before any data-touching task |
| 4 | `docs/PAGE-SPECS.md` | every route, its contents, its states, its empty/error copy |
| 5 | `docs/DESIGN-REFERENCES.md` | the real templates we're borrowing from, and what to take from each |
| 6 | `docs/PHASES.md` | P0 → P10, start to production, with exit criteria |
| 7 | `docs/LESSON-HANDLING.md` | how a lesson flows source → DB → screen, and the element/character system |
| 8 | `docs/TOOLCHAIN-CORRECTION.md` | **the course uses TASM x86-16, not MARIE** — supersedes Stages 13-15 in the master plan |
| 9 | `docs/STAGE-ENCOUNTERS.md` | what the student actually touches, stage by stage |
| 10 | `docs/DESIGN-MANDATE.md` | the design mandate and the per-page checklist every page must clear |
| 11 | `docs/SKILL-TREE-3D.md` | the map — the tree *is* the curriculum, the galaxy, and the accessible layer that is the source of truth |
| 12 | `docs/LAB-MANUAL.md` | the seventeen laboratory exercises, one per chapter, authored for this course |
| 12 | `docs/CPE412-CURRICULUM.md` | **READ THIS FIRST of the design docs.** The real syllabus, its 18 chapters, its references (including §4.1, the one chapter Stallings does not cover), and why the pre-CPE412 stage content was replaced |
| 13 | `docs/GAME-DESIGN.md` | **what kind of game this is**, the star map spec, per-stage themes, and the template list |
| 13 | `docs/VISUAL-SYSTEM-3D.md` | the galaxy as the app's visual language — one canvas, three tiers, and where 3D is banned |
| 13 | `docs/DELIVERY.md` | **where this ships:** the repo, the branch, local Docker, and what "alpha" means |
| 14 | `CLAUDE.md` | conventions and hard rules — reloaded every session |

**Read `docs/VERIFICATION.md` all the way to the end.** Its third pass has thirteen findings,
three blocking, and unlike the first two passes **none of them are applied yet** — the SQL in it is
proposed, and `db/schema.sql` is unchanged. Four of them must land before P0's denial tests are
written.

**Design assets are real and already in the repo:** `packages/tokens/` has `tokens.css`
(three complete themes in OKLCH, 80 tokens), `accents.ts` (the twelve accent presets), and
`elements.svg` (19 symbols — the six-register cast, stage node states, the Depth Gauge, and the
eight Bring-Up subsystems). Use them; do not invent colours or icons.

---

## 3. Repo layout

```
octa/
├── START-HERE.md
├── CLAUDE.md
├── docs/
│   ├── MASTER-PLAN.md
│   ├── PAGE-SPECS.md
│   ├── DESIGN-REFERENCES.md
│   ├── PHASES.md
│   └── source/                  # the instructor's original decks, extracted
│       ├── day1-deck.md
│       └── chapter1-deck.md
├── content/
│   └── stages/00.md … 18.md     # authoring source of truth. 01-07 authored, 08-18 planned
├── apps/
│   ├── web/                     # Vite + React 18 + TS  → Vercel   (public + student)
│   └── console/                 # Vite + React 18 + TS  → Vercel   (teacher/admin)
├── services/
│   └── api/                     # Node 20 + Fastify + TS → Render
├── packages/
│   ├── contracts/               # Zod schemas shared across web/console/api
│   └── tokens/                  # design tokens, three themes, as CSS custom properties
└── db/
    ├── schema.sql
    ├── addendum-feedback.sql
    └── seed/
```

`web` and `console` are separate Vercel projects. A student bundle should never contain console
code, and vice versa.

---

## 4. Hard rules — violating any of these is a build failure

1. **The answer key never reaches the browser.** Keys live in `attempt_items.correct_value`,
   RLS-denied until `attempts.status='submitted'`. All grading runs in `services/api`.
   *(The app this replaces shipped `lessonData.js` with every answer in it. That is the bug we
   are fixing.)*
2. **`SUPABASE_SERVICE_ROLE_KEY` never appears in a `VITE_*` variable.** Vite inlines every
   `VITE_*` into the client bundle at build time. Service role only in `services/api`.
3. **RLS is ON for every table in `public`.** A table with RLS enabled and no policy blocks
   everything except `service_role` — that is the safe default, so enable first, then add
   policies.
4. **Never decide a stage lock client-side.** Call `is_stage_unlocked()`. The client renders a
   lock; it does not compute one.
5. **Never invent course content.** Stage prose, figures, and definitions come from
   `docs/source/*.md` or the database. If content is missing, stop and say so. Do not write
   plausible-sounding lecture text.
6. **Items are versioned, never edited in place.** Editing a live item creates version+1 and
   retires the old one. Stats do not carry over.
7. **`responses` and `attempt_items` are written only by the grading service, and `responses` is
   append-only.** No client INSERT path exists; DB triggers block UPDATE and DELETE, for
   `service_role` too. A student-side insert succeeding is a critical finding. Corrections void an
   attempt; they never edit history.
8. **Test authorization by testing denial.** For every policy, write the test that proves the
   *wrong* user is blocked — not just that the right user succeeds. Code that compiles and
   returns data can still be wide open.

---

## 5. THE KICKSTART PROMPT

Paste this into Claude Code as your very first message in a fresh session.

````
Read START-HERE.md, CLAUDE.md, docs/MASTER-PLAN.md, and db/schema.sql completely
before writing any code. Do not skim. When you're done reading, do NOT start
building — reply with the following and then stop:

1. A one-paragraph summary of what OCTA is, in your own words.
2. The eight hard rules from START-HERE §4, restated in your own words, with one
   sentence each on how you would violate it by accident.
3. Three things in the schema you think are underspecified or that you'd design
   differently, and why. Be blunt — I want disagreement here, not agreement.
4. A list of every environment variable the system needs, split into
   client-safe and server-only.
5. Your proposed order of work for Phase P0 only, as a checklist.

Then stop and wait for my go-ahead. Do not create files, do not run commands,
do not scaffold anything in this session.

Context you need up front:
- Monorepo, pnpm workspaces. apps/web + apps/console (Vite/React/TS, Vercel),
  services/api (Fastify/TS, Render), Supabase Postgres.
- The single most important invariant: a student's browser must never be able to
  obtain an answer key, a locked stage's content, or another student's data.
- I would rather you tell me something is a bad idea than build it silently.
````

**Why this shape:** the failure mode on a project this size is Claude Code producing a confident,
good-looking scaffold that quietly gets the security model wrong. Making it restate the rules and
argue with the schema before it writes a line surfaces misunderstanding while it's still cheap.
Step 3 is the important one — if it agrees with everything, it hasn't read the schema.

---

## 5B. THE DESIGN-REVIEW KICKSTART PROMPT

For a session whose job is the design pass, not the build. It needs
**Playwright MCP connected** — `.mcp.json` configures it; restart Claude Code
and approve the server, then check `/mcp` says `playwright`.

Why a second prompt rather than the one above: this work fails differently. The
build fails loudly, by not compiling. A design pass fails quietly, by producing
confident opinions about pages nobody looked at. So this prompt spends its first
half forbidding conclusions until there are captures on disk.

````
This session is a DESIGN REVIEW. Do not write feature code until I say go.

Read first, completely, no skimming:
  CLAUDE.md · START-HERE.md §4 · .claude/rules/design.md
  docs/DESIGN-MANDATE.md · docs/DESIGN-REFERENCES.md · docs/PAGE-SPECS.md
  docs/GAME-DESIGN.md · docs/GAME-LAYER.md · docs/VISUAL-SYSTEM-3D.md
  docs/SKILL-TREE-3D.md · docs/STAGE-ENCOUNTERS.md
  packages/tokens/tokens.css · packages/tokens/backdrop.css

Then CAPTURE BEFORE YOU CONCLUDE. Use Playwright MCP. Do not describe a page
you have not loaded, and do not compare against a template you have not opened.

  Ours:      https://octa-web-beige.vercel.app   (student, public routes)
             https://octa-console.vercel.app     (staff — see the note below)
  Reference: https://shadcn-admin.netlify.app
             plus the demos cited in DESIGN-REFERENCES.md §1-3

Capture every page at 1440px AND at 380px. 380px is a hard requirement in the
definition of done, not a nice-to-have, and it is where our layouts are least
tested.

Then report, and STOP:

1. A table: our page | closest reference | what theirs solves that ours does not.
   Be specific — "denser table rows, 32px not 44px" beats "cleaner".
2. The three worst surfaces we have, ranked, with the capture that proves it.
3. Where our own documents CONTRADICT each other. Six subjects are authored two
   or three times: templates, the star map, encounter themes, animation rules,
   accent colour, per-page checklists. Name one owner per subject and say which
   copies should become pointers.
4. What you would change, smallest-first, each with the test it must still pass.
5. Anything in DESIGN-MANDATE.md §1 you think is WRONG. Four tests — consequence,
   legibility, reversibility, teaching. If you agree with all of it you have not
   read it against the screenshots.

Constraints that are not negotiable, and that a redesign will tempt you to break:
  - Every colour, size, space and duration comes from packages/tokens. A literal
    hex outside that package is blocked by a hook. Tailwind's default palette is
    DELETED in the console, not extended, so an upstream colour utility emits no
    CSS at all.
  - `pnpm check:contrast` computes 1122 pairs and has already rejected a theme.
    Anything you propose must survive it on all three themes.
  - prefers-reduced-motion must STOP motion, not slow it.
  - A wrong answer is never red, never a buzzer, never a shake.
  - One orchestrated moment per stage. No confetti per question.

Two things you will otherwise discover the hard way:
  - The console shows a SIGN-IN PAGE and nothing else until a staff account
    exists. Everything past that gate needs Supabase configured. Do not report
    the console as "one page".
  - Console screenshots contain real student names on /students, /gradebook and
    /attempts. .playwright/ is gitignored for that reason. Never paste one into
    a document, an artifact, or a commit.
````

**Why this shape:** step 3 is the one that pays. The docs are 2,674 lines across
eight files and they already caused a real bug — `apps/console/CLAUDE.md` told a
reader to build a projector view that existed, because the fact lived in three
places and two rotted. Step 5 is the honesty check, same as step 3 in the build
kickstart: agreement means it did not look.

---

## 6. After the kickstart

Run one phase per session. `/clear` between phases. Phase prompts are in
`docs/PHASES.md` and the detailed engine prompts in
`docs/CLAUDE-CODE-PROMPTS.md`.

| Phase | Name | Weeks |
|---|---|---|
| P0 | Foundation & security harness | 1 |
| P1 | Auth (student ID + email + password) | 1 |
| P2 | Content pipeline, Stages 00–05 | 2 |
| P3 | **Question engine** — seeded, blueprinted, server-graded | 2 |
| P4 | Teacher console v1 | 2 |
| P5 | Stages 06–11 + interactive diagrams | 2 |
| P6 | Simulators (FDE stepper, x86-16 interpreter, cache) | 2 |
| P7 | Item analytics & psychometrics | 1 |
| P8 | Feedback system | 1 |
| P9 | Themes, audio, accessibility, mobile | 1 |
| P10 | Pilot, hardening, production launch | 2 |

**Start with P0 and P3.** Everything else is scaffolding around the question engine.

---

## 7. Session discipline

- **One vertical slice per session.** "Build the question engine" works. "Build the app"
  produces a demo.
- **Paste the schema at the start of any data-touching session.** The failure mode is Claude
  Code inventing a table that half-overlaps one that exists.
- **Every phase prompt ends with checkable done-criteria.** Without them you get code that
  compiles and doesn't work.
- **Write the test first for anything with a correct answer.** The seeded generator and the
  solvers are the two places where a subtle bug becomes a grading incident affecting real
  students.
- **End every session with:** *"Which parts of this did you actually run, and what are you
  unsure about?"* The honest answer is usually the most valuable output of the session.
- **Ask for the diff, not the file.** On a big codebase, "show me what changed and why" catches
  drift that a wall of regenerated code hides.

---

## 8. Definition of done, for any task

A task is done when:

- [ ] It compiles under TypeScript strict
- [ ] Its tests pass, including at least one **denial** test if it touches data
- [ ] RLS implications were considered and stated out loud
- [ ] It works keyboard-only
- [ ] It works at 380px wide
- [ ] Claude Code has said which of the above it actually verified and which it assumed

---

## 9. Two decisions already made — don't relitigate

**Name.** Ship as **OCTA**. "Octalysis" is Yu-kai Chou's trademarked framework name; using it
as the product name is an unnecessary risk. OCTA reads as *octal* (base-8, which the course
actually teaches in Stage 09) and as *8 core drives*. The framework gets credited on `/about`.

**Render's free tier sleeps after ~15 minutes** and cold-starts in 30–60 seconds. A lecturer
opening Lecture Mode in front of 40 students cannot wait a minute. **Decided: everything stays on
free tiers**, and Render Free has **no cron jobs at all** — so the keep-alive is a `pg_cron` +
`pg_net` GET to `/healthz` from Supabase, which is free on every plan. Same for scheduled unlocks,
nightly item stats, and the nightly invariant run. See `docs/DELIVERY.md` §2 and `VERIFICATION.md`
V-26.
