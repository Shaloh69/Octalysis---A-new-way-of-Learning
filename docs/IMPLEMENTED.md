# IMPLEMENTED.md — what is actually built, audited from the code

**Audit date: 7 September 2026, re-measured 8 September.** Written from a **full read of the codebase and
a live database**, not from prior audit documents — those are cross-checked, not
trusted. That sentence is borrowed verbatim in spirit from EngiRent's
`Implemented.md`, which is the sibling thesis project this practice comes from
(`REDESIGN-CLAUDE.md` §2c).

**This file answers one question: does it exist?** It does not say whether a
thing is good, finished to spec, or design-reviewed — `PROGRESS.md` owns live
state, the phase files own the checklists, and `DESIGN-REVIEW-*.md` owns
quality. When this file and any of those disagree, **this one was measured** and
the other should be corrected.

**Every number here names the state it was measured in.** A count taken against a
truncated database is not wrong so much as meaningless (§2c rule 5), and this
audit was interrupted by exactly that — see *Content*, below.

---

## Hard rules — verified, not assumed

Root `CLAUDE.md` lists eight. Five are mechanically checkable and were checked
during this audit; the results are the point of doing it.

| # | Rule | How it was checked | Result |
|---|---|---|---|
| 1 | The answer key never reaches the browser | `grep -rn correct_value apps/web/src apps/console/src` | **no hits** |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` never in a `VITE_*` var | `grep -rn SERVICE_ROLE apps/*/src` | **no hits** |
| 3 | RLS is ON for every table in `public` | `pg_class.relrowsecurity` over `pg_tables` | **0 tables without it** |
| 3 | Every RLS table has ≥1 policy | `pg_policies` anti-join over `pg_tables` | **0 tables without one** |
| 7 | `responses` is append-only | `pg_trigger` on `responses` | **`responses_no_update`, `responses_no_delete`** |

Rule 7 was also demonstrated the hard way on 7 Sep: `demo-seed.sql` tried to
`delete from responses`, the trigger refused, and psql aborted the seed halfway.
The invariant was right and the seed was wrong. See `PROGRESS.md`.

Rules 4, 5, 6 and 8 are judgement rules and cannot be greped; they are enforced
by review and by the specs listed below.

---

## Routes

**22 routes exist**, read from the two `App.tsx` files. Existing is not the same
as designed — `R3-page-templates-and-redesign.md` tracks which have had the
template pass, and most have not.

**`apps/web` — 13**
`/` · `/login` · `/register` · `/maintenance` · `/app` · `/app/map` ·
`/app/stage/:id` · `/app/stage/:id/check` · `/app/stages` · `/app/progress` ·
`/app/work` · `/app/settings` · `*` (404)

`/` is currently `<Navigate to="/app">`. **The public marketing site does not
exist**, and no phase owns it — `PROGRESS.md` carries this as a blocker.

**`apps/console` — 15**
`/signin` · `/` · `/locks` · `/live` · `/students` · `/students/:userId` ·
`/attempts/:attemptId` · `/gradebook` · `/assessments` · `/items` ·
`/submissions` · `/content` · `/audit` · `/system` · `/feedback` · `*`

---

## Services

**`services/api` — 10 route modules**: `assessments` `attempts` `auth` `console`
`cosmetics` `feedback` `items` `live` `stages` `submissions`.

**The question engine — 11 modules**: `blueprint` `grade` `resolve` `scope` `seed`
`solver-core` `solvers` `solvers-act1` `solvers-act2` `solvers-act3` `solvers-act4`.
**60 solvers registered** under engine version 1.0.0 (4 original + 56 added 9 Sep).
`scope.ts` is the examinable-scope flag: the bank ships through **stage 08 and the
Midterm**, and acts 3–4 are written but deliberately out of scope. All grading is here; nothing in `apps/web` imports from it, which
`scripts/check-redesign-boundary.mjs` enforces.

**`packages/contracts`** is a single `index.ts`. **`packages/tokens`** ships
`tokens.css`, `accents.ts`, `backdrop.css`, `elements.svg`.

---

## Database

**22 tables in `public`**: `assessment_secrets` `assessments` `attempt_items`
`attempts` `audit_log` `audit_runs` `blueprints` `content_blocks` `feedback`
`feedback_prompts` `item_stats` `items` `level_progress` `objectives` `profiles`
`responses` `sections` `stage_locks` `stage_progress` `stages`
`student_directory` `submissions`.

**Applied from six SQL files, in order** — `local-bootstrap` (local only) →
`schema` → `addendum-feedback` → `addendum-submissions` → `addendum-audit` →
`addendum-cron`. `scripts/db-reset.mjs` is the authority. Root `CLAUDE.md`
documented five and omitted `addendum-submissions.sql` — which carries 40% of
the grade — until 7 Sep.

**Invariants: 28 registered**, IDs up to INV-33 with gaps. (This said 25, which
was the *clean* count from one run's output rather than the number registered —
`select count(*) from run_invariants()` returns 28.) `INV-32` and `INV-33`
were written on 7 Sep because `DELIVERY.md` §3.1 had cited them as alpha exit
criteria while the set stopped at INV-31.

### Content — **it depends entirely on which tool ran last**

Measured 8 Sep, and this is the single most confusing thing about working on
this project locally:

| | `items` | `assessments` | `objectives` |
|---|---|---|---|
| after `pnpm db:reset` | **0** | **0** | 115 |
| after `db:reset` + `db-demo` | **183** (all `review`) | **2** | 115 |
| after `pnpm verify` | 22 | 2 | **4** |
| after `node scripts/db-demo.mjs` | 22 | 2 | 115 |

**F-41 is fixed as of 9 Sep**: `sync-items.mjs` and `sync-assessments.mjs` run
inside `db-demo`, so a clean `db:reset` + `db-demo` yields 183 items and 2
assessments. The paragraph below describes the state BEFORE that and is kept
because the `pnpm verify` truncation behaviour it documents is still live.

`pnpm verify` runs the API suite, which **truncates objectives** and **creates
the 22 items and 2 assessments** as its own artefacts. `db-demo` restores
objectives and leaves the bank alone. `db:reset` drops everything, and nothing
in the repo seeded items or assessments (**F-41**) — so the only way to
get an item bank locally is to run the test suite, which nothing documents.

The original version of this section reported "19 stages, 4 objectives, 22
items" as a truncated-database artefact and left it at that. Half right: the 4
was truncation, the 22 was never seed data at all. **Always say which tool ran
last** — §2c rule 5, and the numbers here are why.

---

## The seven biomes

All seven are **pre-cut parallax packs**; none is composed from loose elements
and none is procedural. Manifests in `apps/web/src/biomes/packs/`:
`arctic` `cave` `city` `desert` `jungle` `neutral` `ocean`.

Five are CC0; `arctic` (Admurin) and `ocean` (ansimuz) are permissive but **not
CC0** and carry their terms verbatim in their own pack directory. Every biome
directory ships a `LICENSE.txt`. `PROCEDURAL` in `BiomeScene.tsx` is empty and
kept empty deliberately.

**The scatter renderer and `.biome-ground` are present but unused** — no manifest
declares `variants` since the 7 Sep rebuild. Both are kept on purpose, documented
where they live; the next biome sourced as loose elements needs them.

---

## Tests

- **`design/specs/` — 16 Playwright spec files** (10 on 7 Sep; five added 7–8 Sep:
  student states, the attempt runner, the console gate, the console teaching
  pages, and `/live` + `/feedback`; the item review queue added 9 Sep).
- **25 unit spec files** across `services/api/test`, `apps/web` and `apps/console`.
- **`pnpm test:rls` — 38 denial tests**, verified by running it 7 Sep.
- **`scripts/check-contrast.mjs` — 1181 checks** (1080 palette, 42 encounter,
  59 cosmetic).

`pnpm verify` = typecheck + unit tests + invariants. `pnpm qa` = the Playwright
suite, which needs a running web app **and the right one** —
`design/global-setup.ts` refuses to run against an app whose title is not OCTA,
after a full run once passed against a different project on port 5173.

---

## Deployment — measured, 9 September 2026

Read-only, with `node scripts/db-push-supabase.mjs --check`, which applies
nothing. Project `lqvkqdaqtkhxmnvodmyr`, PostgreSQL 17.6.

| | Live Supabase | Local |
|---|---|---|
| public tables | **21** | 22 |
| stages | **18** | 19 |
| objectives · content_blocks | 0 · 0 | 115 · 217 |
| items · assessments | 0 · 0 | 183 · 2 |
| profiles · attempts · responses | 0 · 0 · 0 | 25 · fixtures · fixtures |
| blueprints | 4 | 4 |

**The missing table is `submissions`** — 40% of the grade.
`db-push-supabase.mjs` omitted `addendum-submissions.sql`, the same defect root
already recorded against `db-reset.mjs`. Fixed in `d98ed0d`; **not yet applied
to the project**, which needs a `--reset` push and the instructor's go-ahead.

**18 stages** means the live schema predates the 18-chapter rebuild (`5b548e8`).

**Vercel and Render: unverified.** `origin/main` is current, but whether the
hosts are connected and building cannot be checked from here. `DELIVERY.md`
§3.4's deployment criterion remains unticked.

**So "live" currently means the hosts exist and the database answers.** No
student could use it: no stages 00–18, no objectives, no content, no bank, no
assessments, and no account that can sign in.

## What is NOT built

Recorded because an audit that only lists what exists is half an audit, and the
absences are what the next session needs.

- **The public marketing site.** `/` redirects to `/app`. Five routes, no owner.
- **The reverse travel transition** — leaving a stage back to the map. §4.2 says
  the arrival is "reversed on the way back out"; only the inbound half exists.
- **R3's remaining sign-off** — **41 of 49**, counted from the phase file on
  9 Sep. This entry said "28 of 49" and "R3.5's six-states sweep is not [closed]"
  while the phase file held 41 and R3.5 was ticked — the same drift this file
  exists to catch, in the file itself. R3.1, R3.2, R3.2b, R3.3 and R3.5 are all
  closed. What is open is one R3.4 item (both loading screens captured as frame
  sequences, not stills) and the seven Definition-of-done boxes, of which
  `design/templates/` being populated is the only one not substantively met.
- **R4 (moons and subtopics) and R5 (testing and sign-off)** — 0 of 13 and 0 of
  24. Nothing has started.
- **`docs/superseded/`** — named in §2c as an EngiRent practice worth copying,
  created 7 Sep alongside this file. Before that, stale documents were edited in
  place or left to rot.
- **A seed for the item bank or for assessments.** `db/demo-seed.sql` inserts
  neither, `sync-content.mjs` does not touch them, and the content files carry
  no items — so a clean `pnpm db:reset` + `node scripts/db-demo.mjs` leaves
  **`items = 0` and `assessments = 0`**. The whole assessment pipeline (bank →
  blueprint → assessment → attempt → grading) cannot be exercised from a clean
  checkout, and ten spec cases now skip naming **F-41** rather than fail. The
  rows this work was developed against were live-database artefacts that a reset
  destroyed. Needs an instructor's call: which blueprint, against which stage.
- **An avatar system.** `DESIGN-MANDATE.md` §4 specifies DiceBear seeded from
  `student_id`; nothing implements it. `routes/cosmetics.ts` is the first
  consumer of that seed and says so.

---

## How to redo this audit

Read the code, not this file. Specifically: both `App.tsx` files for routes,
`services/api/src/routes/` and `engine/` for the server, `pg_tables` and
`pg_policies` for the database, `design/specs/` for coverage. **Reseed first**
(`node scripts/db-demo.mjs`) so content counts mean something, and say which
state you measured in.
