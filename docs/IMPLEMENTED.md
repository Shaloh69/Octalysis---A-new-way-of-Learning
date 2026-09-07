# IMPLEMENTED.md — what is actually built, audited from the code

**Audit date: 7 September 2026.** Written from a **full read of the codebase and
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

**The question engine — 5 modules**: `blueprint` `grade` `resolve` `seed`
`solvers`. All grading is here; nothing in `apps/web` imports from it, which
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

**Invariants: 25 registered**, IDs up to INV-33 with gaps. `INV-32` and `INV-33`
were written on 7 Sep because `DELIVERY.md` §3.1 had cited them as alpha exit
criteria while the set stopped at INV-31.

### Content — **measured on a TRUNCATED database, and therefore not a real count**

At the moment of this audit the database held **19 stages, 4 objectives, 22
items, 2 assessments**. The objective count is wrong for the project, not for the
database: `pnpm verify` runs the API test suite, which truncates fixtures, and
this audit ran immediately after it. Seeded, `scripts/db-demo.mjs` reports
**115 objectives** and exits non-zero below 100.

This is recorded rather than quietly re-measured because it is the exact failure
§2c rule 5 names, it happened while writing the rule's own audit, and the number
looks plausible enough to have been believed.

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

- **`design/specs/` — 10 Playwright spec files.**
- **19 unit spec files** across `services/api/test` and `apps/web`.
- **`pnpm test:rls` — 38 denial tests**, verified by running it 7 Sep.
- **`scripts/check-contrast.mjs` — 1181 checks** (1080 palette, 42 encounter,
  59 cosmetic).

`pnpm verify` = typecheck + unit tests + invariants. `pnpm qa` = the Playwright
suite, which needs a running web app **and the right one** —
`design/global-setup.ts` refuses to run against an app whose title is not OCTA,
after a full run once passed against a different project on port 5173.

---

## What is NOT built

Recorded because an audit that only lists what exists is half an audit, and the
absences are what the next session needs.

- **The public marketing site.** `/` redirects to `/app`. Five routes, no owner.
- **The reverse travel transition** — leaving a stage back to the map. §4.2 says
  the arrival is "reversed on the way back out"; only the inbound half exists.
- **Most of R3's template pass** — 19 of 49 at the time of writing.
- **R4 (moons and subtopics) and R5 (testing and sign-off)** — 0 of 13 and 0 of
  24. Nothing has started.
- **`docs/superseded/`** — named in §2c as an EngiRent practice worth copying,
  created 7 Sep alongside this file. Before that, stale documents were edited in
  place or left to rot.
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
