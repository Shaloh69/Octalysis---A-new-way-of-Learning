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
│   └── stages/00.md … 17.md     # authoring source of truth for lesson content
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
