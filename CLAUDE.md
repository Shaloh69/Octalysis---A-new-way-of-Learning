# OCTA — project context

Semester-long interactive learning platform for **Computer Systems & Assembly Language**
(BS Computer Engineering). Stage 00 orientation plus 17 graded stages over 14 weeks. Every
student receives a structurally unique but psychometrically equivalent question paper.

Read `START-HERE.md` before your first task. Read `VERIFICATION.md` before touching the schema.

## Repos

- `apps/web` — Vite + React 18 + TS + Tailwind v4 + shadcn/ui → **Vercel** (public + student)
- `apps/console` — same stack → **Vercel** (teacher/admin)
- `services/api` — Node 20 + Fastify + TS → **Render** (generation, grading, admin ops)
- `packages/contracts` — Zod schemas shared across all three
- `packages/tokens` — three themes + accent derivation, as CSS custom properties
- `db` — Supabase Postgres. Apply in order: `schema.sql` → `addendum-feedback.sql` → `addendum-audit.sql`

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
- Do not add: `htm`, an ORM over Supabase, a second UI library, `localStorage` for anything
  gradeable, client-side scoring.

## Local stack — production runs here until cloud projects exist

```bash
pnpm db:up      # Postgres 16 in Docker on :54329
pnpm db:reset   # drop, recreate, apply all four SQL files, run invariants
pnpm test:rls   # the 38-test denial suite
pnpm verify     # typecheck + tests + invariants
```

Apply order is load-bearing: `local-bootstrap.sql` → `schema.sql` → `addendum-feedback.sql` →
`addendum-audit.sql`. **`local-bootstrap.sql` is LOCAL ONLY** — it supplies the `auth` schema and
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

- **Ships to** `github.com/CodenameTempest14/Computer-Systems-Interactive-Lecture-Companion-`,
  branch **`shaloh-build`**, cut from `master`. That repo *is* the app OCTA replaces — its
  `src/data/lessonData.js` is the bug. Delete it in its own commit, with the reason in the body.
- **Everything is on a free tier:** Vercel Hobby ×2, Render Free ×1, Supabase Free ×1.
- **Render Free has no cron jobs.** Every scheduled job — unlocks, nightly `item_stats`, invariant
  runs, keep-alive — runs on **Supabase Cron (`pg_cron` + `pg_net`)**. Never write a Render Cron.
- **Supabase Free has no backups and pauses after 7 days idle.** Backup is a scheduled `pg_dump`
  you own, and it is not real until you have restored it once.
- **Alpha = complete skill tree, partial content.** Definition and exit criteria in `DELIVERY.md` §3.

## The skill tree

The tree is not a visualisation of the curriculum — it **is** the curriculum. `stages.prereq` is
the only edge list; nothing about the map may be authored twice. The 3D galaxy is a presentation
layer over a DOM layer that is always rendered and is the source of truth: a `<canvas>` has no
accessibility semantics, so the map must work with WebGL disabled. See `docs/SKILL-TREE-3D.md`.

## Structure of the domain

- **Stage** — one lesson unit. Has an `archetype` (A concept / B computation / C artifact /
  D simulator) that determines its beat sequence. See `docs/LESSON-PLAN-AND-LEVELS.md`.
- **Level** — abstraction level 0–6 from the Computer Level Hierarchy. Progression is *depth*,
  not points.
- **Competency** — `read` | `trace` | `build` at a given level. 7 × 3 = 21 cells. This replaces XP.
- **Bring-Up** — a subsystem coming online on stage completion. One celebration per stage, no more.

## Toolchain — do not substitute

The course is **16-bit DOS x86 with Borland TASM**, not MARIE. Stages 13-15 use 8086 registers,
8086 addressing modes, and TASM/MASM syntax. See `docs/TOOLCHAIN-CORRECTION.md`.

Never bundle `TASM.EXE` or `TLINK.EXE` — they are proprietary (Embarcadero). Validate with UASM
or the built-in interpreter instead.

## Design mandate

**A control exists only if pressing it changes what the student knows, can do, or can see. If it
only changes a number, delete it.** Four tests in `docs/DESIGN-MANDATE.md` §1 — consequence,
legibility, reversibility, teaching. Before writing JSX for any page, list its controls and state
which tests each passes.

## Design

Colors, type, spacing, and motion come from `packages/tokens`. **Never write a literal hex outside
that package** — a hook blocks it. Three themes (`bare-metal`, `blueprint`, `phosphor`) plus a
per-student accent derived in OKLCH from a stored hue, not a stored hex.

Type roles: display `Space Grotesk`, body `Inter`, mono `JetBrains Mono`. All numbers, register
values, hex, machine code, and assembly listings render in mono.

Motion: one orchestrated moment per stage. Respect `prefers-reduced-motion`. Incorrect answers get
a neutral response — never red, never a buzzer, never a shake.

## Definition of done

Compiles under strict TS · tests pass including at least one denial test if it touches data · RLS
implications stated out loud · works keyboard-only · works at 380px · and you have said which of
these you actually verified versus assumed.
