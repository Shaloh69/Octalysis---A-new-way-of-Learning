# OCTA — project context

Semester-long interactive learning platform for **CPE 412 — Computer Architecture and
Organization** (BS Computer Engineering, University of Cebu). Stage 00 orientation plus the
syllabus's **18 chapters**, one stage each, across four grading periods. Every student receives a
structurally unique but psychometrically equivalent question paper.

**Textbook:** Stallings, *Computer Organization and Architecture: Designing for Performance*, 9th
ed. **Prerequisite:** Microprocessors. Syllabus archived at `docs/source/CPE 412.docx.pdf`;
full analysis in `docs/CPE412-CURRICULUM.md`.

Read `START-HERE.md` before your first task. Read `VERIFICATION.md` before touching the schema.

## Repos

- `apps/web` — Vite + React 18 + TS, hand-written CSS over `packages/tokens` → **Vercel**
  (public + student). No Tailwind, no shadcn: its surfaces are bespoke.
- `apps/console` — Vite + React 18 + TS + shadcn/ui → **Vercel** (teacher/admin). Data tables and
  forms, where a component library genuinely pays.
- `services/api` — Node 20 + Fastify + TS → **Render** (generation, grading, admin ops)
- `packages/contracts` — Zod schemas shared across all three
- `packages/tokens` — three themes + accent derivation, as CSS custom properties
- `db` — Supabase Postgres. Apply in order: `schema.sql` → `addendum-feedback.sql` →
  **`addendum-submissions.sql`** → `addendum-audit.sql` → `addendum-cron.sql` (local
  prepends `local-bootstrap.sql`). `addendum-submissions.sql` carries labs, project and
  participation — **40% of the grade** — and was missing from this list while
  `scripts/db-reset.mjs` had been applying it all along.

## Hard rules

1. **The answer key never reaches the browser.** Keys live in `attempt_items.correct_value`,
   RLS-denied until `attempts.status='submitted'`. All grading runs in `services/api`.
2. **`SUPABASE_SERVICE_ROLE_KEY` never appears in a `VITE_*` variable.** Vite inlines those into
   the client bundle at build time.
3. **RLS is ON for every table in `public`,** and every RLS-enabled table has at least one policy.
4. **Never decide a stage lock client-side.** Call `is_stage_unlocked()`. The client renders a
   lock; it does not compute one.
5. **Never invent course content.** Stage prose, figures, and definitions come from
   `docs/source/*.md` or the database. If content is missing, stop and say so.
6. **Items are versioned, never edited in place.** New version = new row sharing `family_id`.
   Old version is retired, not deleted.
7. **`responses` and `attempt_items` are written only by the grading service, and `responses` is
   append-only.** No client INSERT path exists; DB triggers block UPDATE and DELETE, for
   `service_role` too. A student-side insert succeeding is a critical finding. Corrections void an
   attempt; they never edit history.
8. **Test authorization by testing denial.** For every policy, write the test that proves the
   wrong user is blocked — and watch it fail before you make it pass.

## Conventions

- TypeScript strict. No `any` without a `// why:` comment.
- Zod at every API boundary, shared via `packages/contracts`.
- Server errors: `{ error: { code, message } }`. Never a stack trace, never raw SQL.
- Vitest. Every question-engine function needs a test. UI does not.
- Conventional commits, small and frequent. The commit history is project evidence.
- Do not add: `htm`, an ORM over Supabase, a second UI component library, `localStorage` for
  anything gradeable, client-side scoring.
- **Explicitly allowed, and only these:** `three` + `@react-three/fiber` (the star map),
  `react-force-graph-3d` (picking and camera easing, nodes pinned), `phaser` (five canvas
  encounters only — stages 03, 12, 14, 18 and the 04→06 span; re-derived from the
  real curriculum, `GAME-DESIGN.md` §10.3), `codemirror` (stages 10-11, the x86 listings). Each is **lazy-loaded per
  route** and none may enter the initial bundle. See `GAME-DESIGN.md` §10.

## Local stack — production runs here until cloud projects exist

```bash
pnpm db:up      # Postgres 16 in Docker on :54329
pnpm db:reset   # drop, recreate, apply all SIX SQL files, run invariants
pnpm dev:api    # the API on :8090, configured for LOCAL auth  <- not `pnpm dev`
pnpm test:rls   # the 38-test denial suite
pnpm verify     # typecheck + tests + invariants
```

**Use `pnpm dev:api`, not the raw dev script.** Root `.env` describes the
*deployed* service, and starting the API from it fails three ways that all look
like application bugs: it has no `SUPABASE_JWT_SECRET` (so every dev token is
rejected), it *does* have `SUPABASE_URL` (which switches `identityFrom()` to
asymmetric JWKS and rejects HS256 dev tokens with `unacceptable alg: HS256`),
and its `CORS_ALLOWED_ORIGINS` is pinned to 5173/5174 while Vite may be on 5183.
`scripts/dev-api.mjs` fixes all three and refuses to run under
`NODE_ENV=production`. **Port 8080 is another project's Adminer on this machine**
— it answers 200 with an HTML login page, so `apps/web/.env.example`'s
`VITE_API_URL=http://localhost:8080` is wrong locally.

**Reseed with `node scripts/db-demo.mjs`.** It refuses to run over attempt
history from another user and tells you to `pnpm db:reset` first — because
`responses` is append-only (hard rule 7), so a seed cannot purge it. It used to
try, get blocked by the trigger, and abort *halfway*, leaving a database that
presented as "stage 00 is locked".

Apply order is load-bearing: `local-bootstrap.sql` → `schema.sql` → `addendum-feedback.sql` →
`addendum-submissions.sql` → `addendum-audit.sql` → `addendum-cron.sql`. **Six files, not
five** — this said five and omitted `addendum-submissions.sql`, which holds labs, project
and participation. `scripts/db-reset.mjs` is the authority and always applied it; anyone
applying to Supabase BY HAND from this list would have skipped 40% of the grade.
**`local-bootstrap.sql` is LOCAL ONLY** — it supplies the `auth` schema and
the three roles that Supabase provides; running it against a Supabase project would shadow the
real ones and every RLS test would become a lie.

Three Postgres semantics this project has already been bitten by — see `VERIFICATION.md` fourth pass:

1. **Always `nullif(current_setting('x', true), '')` before casting.** A rolled-back custom GUC
   reverts to `''`, not `NULL`, and `''::jsonb` raises inside every policy.
2. **Column privileges are additive.** `revoke select (col)` does nothing while table-level
   `SELECT` is granted. Revoke the table, grant the columns back by name.
3. **A policy's subqueries are subject to RLS.** If a `USING` clause reads a staff-only table, use
   a `security definer` helper or it will silently deny everything.

## Delivery — read `docs/DELIVERY.md` before deploying or committing

- **Ships to** `github.com/Shaloh69/Octalysis---A-new-way-of-Learning`, branch **`main`**.
  Work on `main` and push to `main`. `shaloh-build` is gone — it existed for eighteen commits
  while `main` sat on the P0 skeleton, and every host defaults to `main`: Vercel and Render each
  built the skeleton, failed differently, and cost an hour between them.
  The repo OCTA *replaces* is `CodenameTempest14/Computer-Systems-Interactive-Lecture-Companion-`,
  whose `src/data/lessonData.js` shipped every answer to the browser. That is the bug this project
  exists to fix; it is not a dependency and nothing is merged from it.
- **Everything is on a free tier:** Vercel Hobby ×2, Render Free ×1, Supabase Free ×1.
- **Render Free has no cron jobs.** Every scheduled job — unlocks, nightly `item_stats`, invariant
  runs, keep-alive — runs on **Supabase Cron (`pg_cron` + `pg_net`)**. Never write a Render Cron.
- **Supabase Free has no backups and pauses after 7 days idle.** Backup is a scheduled `pg_dump`
  you own, and it is not real until you have restored it once.
- **Alpha = complete skill tree, partial content.** Definition and exit criteria in `DELIVERY.md` §3.

## The skill tree

The tree is not a visualisation of the curriculum — it **is** the curriculum. `stages.prereq` is
the only edge list; nothing about the map may be authored twice. The 3D galaxy is a presentation
layer. `/app` is the 3D map and is the student's default; `/app/map` is a flat, fully
keyboard-operable route that is always available and is never a degraded mode. A `<canvas>` has no
accessibility semantics, so reduced motion, absent WebGL and small viewports fall back to the flat
presentation — **in place, on the same route, without redirecting.**
**`docs/VISUAL-SYSTEM-3D.md` §5's degradation ladder owns this rule; every other document points
at it.** (R0 ruling, 1 Sep 2026: four documents each restated a redirect the app has never done,
and the app's degrade-in-place answer is the better one. `docs/PROGRESS.md` F-5.) See `docs/SKILL-TREE-3D.md` and `docs/GAME-DESIGN.md` §2.

## Structure of the domain

- **Stage** — one chapter of the syllabus. Has an `archetype` (A concept / B computation / C artifact /
  D simulator) that determines its beat sequence. See `docs/LESSON-PLAN-AND-LEVELS.md`.
- **Level** — abstraction level 0–6 from the Computer Level Hierarchy. Progression is *depth*,
  not points.
- **Competency** — `read` | `trace` | `build` at a given level. 7 × 3 = 21 cells. This replaces XP.
- **Bring-Up** — a subsystem coming online on stage completion. One celebration per stage, no more.
- **Act == grading period.** Four of them: Prelim (ch 1-4), Midterm (5-8), Semi-finals (9-12),
  Finals (13-17). This is a change: acts used to be a narrative arc.

## Toolchain

CPE 412's prerequisite is **Microprocessors**, so 8086 assembly is assumed knowledge rather than
taught here. Where the course shows listings (chapters 10 and 11) they are **Intel x86**, matching
the textbook.

`docs/TOOLCHAIN-CORRECTION.md` documents the TASM decision for the SUPERSEDED course. Its rule
still stands if assembly tooling is ever bundled: never ship `TASM.EXE` or `TLINK.EXE`, they are
proprietary (Embarcadero).

## Design mandate

**A control exists only if pressing it changes what the student knows, can do, or can see. If it
only changes a number, delete it.** Four tests in `docs/DESIGN-MANDATE.md` §1 — consequence,
legibility, reversibility, teaching. Before writing JSX for any page, list its controls and state
which tests each passes.

## Design

Colors, type, spacing, and motion come from `packages/tokens`. **Never write a literal hex outside
that package** — a hook blocks it. Three base themes (`bare-metal`, `blueprint`, `phosphor`) plus a
per-student accent derived in OKLCH from a stored hue, not a stored hex.

On top of those sit **eight encounter themes** (`GAME-DESIGN.md` §9) — each is four tokens and a
nine-slice panel, never a redesign. They dress the LAB beat and never an assessment, and they are
held to the same computed AA contrast on all three base themes.

Type roles: display `Space Grotesk`, body `Inter`, mono `JetBrains Mono`. All numbers, register
values, hex, machine code, and assembly listings render in mono.

Motion: one orchestrated moment per stage. Respect `prefers-reduced-motion`. Incorrect answers get
a neutral response — never red, never a buzzer, never a shake.

## Where we are

**Say the phase out loud, every session.** The redesign runs R0–R5 in
`docs/redesign/phases/`; `docs/PROGRESS.md` records which one is live and what
has landed in it. Name the phase and the sub-item when you start, tick the phase
file's box **in the same commit as the work**, and name what the phase still owes
when you finish.

This is a rule because the project has drifted repeatedly: `PROGRESS.md` claimed
"R2 complete, R3 next" for sessions after R3 had started; R3's checklist sat at 0
of 44 while eight of its routes were reworked and committed; R0/R1/R2 sat at 0 of
85 while all three were called complete. Full rule: `REDESIGN-CLAUDE.md` §2b.

**Against context degradation** — §2c, with the rules that matter most here:
verify a claim before repeating it, check the stack is alive (and is the right
app) before believing a red run, measure on real data and say which state you
measured in, and trust the code over the docs when they disagree.

**On stopping** — §2d. Default is to keep going: name the phase, do the work,
record it, continue. Stop only for a genuinely ambiguous reading, an
instructor's call, something irreversible, or a rule that would have to be
broken.

## Definition of done

Compiles under strict TS · tests pass including at least one denial test if it touches data · RLS
implications stated out loud · works keyboard-only · works at 380px · and you have said which of
these you actually verified versus assumed.
