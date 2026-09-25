# PROGRESS.md — Solar System Redesign, Live State

> **Read STATE NOW below. Do not read this file in full.**
>
> It said "read this file, in full, before doing anything else" while growing
> past **1,600 lines**, which is a rule that guarantees the thing it was trying
> to prevent: a session that starts by filling its context with history. The
> findings log beneath is **reference — consult it when a finding is cited**, not
> required reading. `REDESIGN-CLAUDE.md` §2c, rule 6.
>
> Still update it before ending a session or before `/clear`. Append new
> findings; do not rewrite old ones.

**Last updated:** 7 September 2026.
**Branch:** `main`. Not a `redesign/*` branch — root `CLAUDE.md` is explicit
about why (`shaloh-build` cost an hour when Vercel and Render both built `main`).

---

## STATE NOW

> **After a `/clear`, read `docs/NEXT-SESSION.md` first.** It carries the
> measured state with the command beside each figure, so a fresh session does not
> spend its first hour re-deriving what this one established.



**Phase: R3 — page templates and redesign.**

**Every number below was counted from the phase files on 7 Sep 2026, not
carried forward.** The previous table said R2 18/21 and R3 13/44; the files
actually held 19/21 and 17/49. Boxes had been ticked without the table moving,
and R3's denominator had grown. Count, do not copy.

| Phase | State |
|---|---|
| R0 scope and guardrails | ✅ 28 / 28 |
| R1 solar system foundation | ✅ 36 / 36 |
| R2 per-student cosmetics | ✅ **21 / 21** — closed 7 Sep, and closing it found **F-40** |
| **R3 page templates** | **42 / 72** ← live (14 per-route console boxes added 25 Sep; `pnpm phase` is the count) |
| R4 moons and subtopics | ▫️ 0 / 13 |
| R5 testing and sign-off | ▫️ 0 / 24 |

**Gates, last run — 8 Sep 2026. All green.**

| Gate | Result | Measured in |
|---|---|---|
| `pnpm verify` | **green** — 343 unit tests (266 API, 53 web, 24 console) | after `db:reset` |
| `pnpm test:rls` | **green** — 38 denial tests | seeded |
| `check-contrast.mjs` | **green** — 1181 checks | n/a |
| `pnpm qa` | **green** — 214 passed, 108 skipped, 0 failed | seeded, all three servers up |

**The 110 skips are the honest part.** Ten name **F-41**: nothing in this repo
seeds `items` or `assessments`, so on a clean fixture those pages are correctly
empty and the specs say so rather than passing silently.
| invariants | **25 clean, 1 warning** (INV-25, 5 seeded `content_report` rows), 0 failures | seeded |

**It took three runs to get that number, and the first two were lies.** 50
failures with the console dev server down; then 86 with Docker gone and the
database with it. Both looked like code. Neither was — §2c rule 4, three times
in one session. The old "150 passed" figure predated the suite growing and had
never been re-measured.

**Docker Desktop is unstable on this machine.** It has crashed twice in one
session, and `pnpm qa`, `pnpm verify` and the invariants all fail meaninglessly
when it is down. `docker ps` first (§2c rule 4).

**What is actually blocking, as of 8 September 2026.** This section used to
list three things, two of which had been struck through as DONE — a heading that
no longer described anything. The resolved ones are in
`PROGRESS-FINDINGS.md`; these two are live.

1. **F-41 — the item bank and the exams. BUILT; awaiting the instructor's review.**
   `pnpm db:reset && node scripts/db-demo.mjs` now yields **183 items in
   `review`**, authored from Stallings ch 1-8 and covering all 59 gradeable
   objectives in stages 01-08. The instructor's ruling scoped it to **stage 08
   and the Midterm**; Semi-final and Finals are deferred behind
   `engine/scope.ts`.

   **Proven, not assumed.** `bank-feasibility.spec.ts` fills a real Prelim and a
   real Midterm from the real files and asserts every constraint cell lands
   exactly, across 60 different student seeds, with papers that differ. It
   already caught the failure that mattered: act 2's only `apply` items were its
   14 parameterized ones, while the Midterm demands `apply: 14` AND `P: 13`
   together — so the bank looked complete on every per-dimension count and could
   not have produced one valid paper.

   **Assessments landed the same day.** `sync-assessments.mjs` seeds one per
   examinable blueprint — Prelim and Midterm, **five attempts**, every section,
   no dates — and refuses to touch one that already exists, so a re-run cannot
   reset a window set in the console. Both are therefore OPEN: a NULL bound is
   no bound, and `engine-repo.ts` enforces exactly that.

   **What still owes.** Every item is `review`: nothing is `live` until the
   instructor approves it at `/items`, which is the ruling and not a gap. And
   the console has no CONTROL for the exam window yet — `PATCH
   /api/v1/console/assessments/:id` exists, is guarded and is denial-tested, but
   `AssessmentsPage` does not expose it.

2. **The live Supabase project is bare and stale — see F-43.** 21 public tables
   where the schema defines 22 (the missing one is `submissions`, 40% of the
   grade), 18 stages instead of 19, and zero objectives, content, items,
   assessments or profiles. `db-push-supabase.mjs` omitted
   `addendum-submissions.sql`; that is fixed but not yet applied to the project.
   Re-pushing needs `--reset`, which drops the schema — **not run, and it needs
   the instructor's explicit go-ahead.**

3. **No phase owns the public marketing site.** Five routes, including the
   landing page whose re-rollable demo `PAGE-SPECS.md` calls "the one
   interaction that sells the product". `/` is currently `<Navigate to="/app">`.

**Recently resolved** — biomes (all seven, pre-cut packs, licences recorded),
`INV-32`/`INV-33` (written and mutation-tested), **F-40** (the seeded look now
reaches the browser), and the multiple-choice answer bug in F-41's first half.


**Local stack:** web `:5183` (5173 belongs to another project), console `:5174`,
API `:8090` via **`pnpm dev:api`** — not the raw dev script, which boots from
`.env` and fails three ways that all look like app bugs (no
`SUPABASE_JWT_SECRET`; `SUPABASE_URL` present, so HS256 dev tokens are rejected
as `unacceptable alg`; CORS pinned to 5173/5174). **Port 8080 is another
project's Adminer.**

After `pnpm verify`, reseed with **`node scripts/db-demo.mjs`** — the API suite
truncates fixtures. It refuses to run over another user's attempt history and
tells you to `pnpm db:reset` first, because `responses` is append-only.

**Answered by the instructor, 9 Sep 2026:** F-41's question is settled — build
the complete bank, write the solvers, and scope it to **stages 01–08 / Prelim +
Midterm**. `engine/scope.ts` is the flag and `engine/scope.spec.ts` holds it
against the database.

**Still open:** whether chapter 18 belongs in the Finals (assumed yes, and
seeded that way). It does not block anything until act 4 is authored, which the
scope flag now defers.

---

## Current phase

**R3 — IN PROGRESS. 41 of 49, counted from the phase file on 8 Sep 2026.**
(This heading said "R2 complete, R3 next" for several sessions after R3 work had
already started, and later said "13 of 44" after the file had moved on. **Count
the boxes in `docs/redesign/phases/R3-page-templates-and-redesign.md`; do not
copy this number forward.**)

R0, R1 and R2 are complete. R3 is the page-template pass, **scoped down by the
F-12 ruling to the routes that actually exist** — 3 public + the catch-all, 7
student, 14 console. What has landed under R3 so far:

- **F-8** — `--ink-dim` and `--rule` aliased, so 47 inert declarations apply
- The **hit layer** — real focusable buttons projected onto their planets
- The **planet HUD** and camera fly-in (F-13), which had never been built
- **Ladder rungs 4 and 5** (F-14), which had never been built either
- **Biomes** — all seven, as pre-cut parallax packs, every licence verified and recorded beside the art
- The **callsign** on `/app/settings`
- **Progressive reveal**, growing ring spacing, biome-tinted planets, preview
  moons, mastery flags, comets, and the sun's non-anthropomorphic liveliness
- **The solar system as the app background** (`SOLAR-SYSTEM-SPEC.md` §1.5) with
  content surfaces opting out, and the prerequisite-trace toggle (§1.6)
- **Both loading screens** (`BIOME-AND-LOADING-SPEC.md` §4), built as states
  the backdrop moves through rather than overlays: the hub warp (§4.1) and the
  biome arrival that hands off out of the backdrop into a stage (§4.2)
- **The map override on `/app/settings`** — `VISUAL-SYSTEM-3D.md` §5's last
  line, and the last rung of its ladder to be built. Rungs 1–5 all decide *for*
  the student; this is the student deciding, which is why §5 requires it

**The console revamp has its first route through the gate — `/items`, 25 Sep
2026.** Rebuilt from `design/templates/console/items/template.png`; the six
`CONSOLE-REVAMP.md` §2 assertions green at 1440 and 380 in
`console-items.spec.ts` (29 passed, 5 skipped by design), watched red first on
the clipped action column. Toasts, skeleton, error-with-retry and eased dialogs
exist for the first time. The four features `PAGE-SPECS.md` planned and the
instructor approved on 25 Sep are built: type and objective filters, bulk
approve drafts (into review only), import JSON (dry run first, drafts only,
never a live item) and export JSON. The review dialog now shows an ordering
item's key, which it never had. R3 gained one box per console route; 1 of 14
is ticked.

**R3's route pass has started.** `design/specs/r3-inventory.spec.ts` captures
all **42** built route × width combinations, asserts every route throws no page
error, and asserts **no route scrolls sideways at 380px** — which none does.
Captures live in `design/r3-inventory/`.

Two findings from that first pass:

- **`DESIGN-REVIEW-01` D-4 is FIXED** — the submissions queue went from 3,436px
  to **1,219px**, so all 21 items fit on one screen instead of three. Against
  the named reference, not by taste.
- **`/live` cannot be captured with `networkidle`** — Lecture Mode holds an open
  request to `/api/v1/console/live` for as long as it is on screen, so that wait
  never fires. The page is fine; the harness was wrong. All routes now use
  `domcontentloaded` plus an element wait.

Still to do in R3: the per-route template application itself against
`TEMPLATE-LINKS.md` and `CONSOLE-DATA-AND-TEMPLATES.md`, route by route.

## Confirmed scope boundary (do not re-litigate without flagging it explicitly)

- **Redone:** solar-system navigation shell, per-page templates, the
  game-facing half of the design mandate
- **Untouched:** schema, RLS, auth, question engine, the 8 locked encounter
  themes, `PHASES.md`'s P0–P10 structure
- **"Unique per student" = cosmetic only** — whole-system rotation offset,
  palette variant, callsign, landing biome. Never curriculum, unlock logic,
  objective sets, or assessment content.

**The line, in one sentence:** the exam paper's uniqueness decides what a
student is *asked* and is a fairness guarantee enforced server-side; the solar
system's uniqueness decides only what a student *looks at*, derives from
`student_id` alone, and the moment a seeded value could change what anyone can
do, learn, attempt or be graded on, it has stopped being cosmetic and become a
curriculum decision.

---

## Performance numbers

Measured 1 September 2026, at `/app`, 1440×900, five-second samples. Re-measure
after R4 (110 moons) and after any dependency change.

| Metric | Budget | Measured | Source |
|---|---|---|---|
| 3D chunk, gzipped | ≤ 250 KB | **220.6 KB** | `pnpm --filter @octa/web build` |
| 3D in the initial load | never | **absent** | no `modulepreload` in `dist/index.html` |
| Initial JS, gzipped | — | **71.8 KB** (+7.9 KB CSS) | same build |
| Draw calls per frame | ≤ 50 | **21** (was 32) | GL context wrapped, counted live |
| Frame rate, desktop | 60 target | **60.1 fps** | Playwright + rAF, 5s |
| Frame rate, 6× CPU throttle | **30 floor** | **57.7 fps** (was 47.4) | CDP `Emulation.setCPUThrottlingRate` |

**Both improved after progressive reveal**, which was not the goal but is the
obvious consequence: a locked planet has no body, so a fresh student draws 3
planets instead of 19. The additions since the last measurement — preview
moons, comets, the sun's corona and ray sweep, mastery flags — are all one
instanced or buffered draw each, and together they cost less than the 16 planet
meshes reveal removed.
| Biome art — `neutral` | — | **10.2 KB** PNG referenced (27 KB vendored) + 0.27 KB gz chunk | `du` + build |
| Biome art — other six | — | not vendered | — |

**What this does and does not prove.** The 30fps floor holds with real headroom
— 47.4fps at a 6× CPU slowdown, which is Chrome's low-end-mobile profile. Draw
calls came in at 32, which happens to match the "low 30s" R1 reasoned to
without measuring, so that estimate was sound.

**The honest caveat: CPU throttling is not GPU throttling.** A real mid-range
Android has a far weaker GPU than this machine's, and nothing here exercises
that. Fill rate, not CPU, is the likely limit on a phone. So this is a genuine
measurement of the thing that was never measured, and it is still not the same
as running it on a phone — which `SKILL-TREE-3D.md` §6 asks for and remains
undone.

Also unmeasured: **the 380px path never renders a canvas at all** (the
degradation ladder falls back to flat below 640px), so there is no 3D frame
rate to measure on a small viewport. That is the ladder working, not a gap.

## Durable facts, measured — do not rebuild this reasoning from a diagram

Verified twice: from `content/stages/*.md` front matter, and independently from
the database after `node scripts/sync-content.mjs`.

**19 planets · 18 edges · one linear chain, no forks · 110 moons.**

| Ring (level) | Planets | Moons | % of moons |
|---|---|---|---|
| L0 | 3 — stages 05, 09, 17 | 16 | 14.5% |
| **L1** | **7** — 03, 07, 12, 13, 14, 15, 16 | **43** | **39.1%** |
| L2 | 4 — 02, 04, 10, 11 | 27 | 24.5% |
| L3 | 3 — 06, 08, 18 | 19 | 17.3% |
| L4 | 0 | 0 | — |
| L5 | 0 | 0 | — |
| L6 | 1 — stage 01 | 5 | 4.5% |

- **Stage 00 has ZERO objectives.** No moons, so "planet radius = mean of its
  moons' radii" is undefined for it — and it is the first planet a student ever
  sees. **F-1 rules the fallback:** `Math.min(...stages.levels)`, which puts it
  on ring 6.
- **Every stage's objectives are unanimous in level** — all 18 stages with
  objectives have a single distinct `objectives.level`. So the mean-of-moons
  radius always evaluates to that one level, and no planet's moons span more
  than one ring.
- **Ring sequence 00→18:** `(undefined), 6, 2, 1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 1,
  1, 1, 1, 0, 3`. That is **12 ring crossings and 9 direction reversals** over
  18 edges. §1.3 said 13 crossings and opened the sequence `6,6,…`, assuming a
  Stage 00 value the rule never defined; **both corrected in the spec**.
- **Stages 12–16 are five consecutive ordinals all on ring L1**, carrying 26
  moons. The last third of the course runs flat along one ring — it does not
  corkscrew. This is what F-2's occupancy spacing has to make legible.
- **L4 and L5 are genuinely empty** for this syllabus. That is true information,
  not a gap to fill.
- The **moon data path exists and works**: `content/stages/*.md` front matter →
  `scripts/sync-content.mjs` → `objectives` table → `services/api/src/routes/stages.ts`.
  Verified end to end: 215 content blocks, 110 objectives upserted.
- **But `GET /api/v1/stages` does not return objectives.** Per-stage objectives
  come from `GET /api/v1/stages/:id` only (`routes/stages.ts:158`). R4 needs
  either a new field on the map response or a second call — decide before building.

## Boundary baseline, recorded so a later regression is attributable

- `is_stage_unlocked()` is called **only** from `db/schema.sql` (its definition
  and the `content_blocks` RLS policy), `services/api/src/routes/stages.ts:49,148`,
  and `services/api/src/routes/console.ts:79`. The only mentions inside `apps/`
  are two **comments** (`apps/console/src/pages/LocksPage.tsx:22`,
  `apps/console/CLAUDE.md:38`). Zero client calls.
- No client-side mastery or lock threshold comparison exists in `apps/web`
  today. Every `state` rendered comes from the server's resolved field.
- `db/schema.sql` fingerprint at R0: **`273e65dfa168ff75`** (sha256, first 16).
  `pnpm check:boundary` compares against `OCTA_R0_SCHEMA_HASH` when set.
- `pnpm check:boundary` passes clean, and was verified to actually catch a
  planted violation before being trusted.

## Cosmetic-seed transport — DECIDED

A **new read-only endpoint in `services/api`**, e.g.
`services/api/src/routes/cosmetics.ts` → `GET /api/v1/cosmetics`, derived from
`profiles.student_id` alone via a lightweight non-secret hash.

**Not** a shared package with the engine seed. `makeAttemptSeed` is
`sha256(studentId ‖ stageId ‖ attemptNo ‖ examSalt)` joined on spaces
(`services/api/src/engine/seed.ts:31-37`) and embeds `EXAM_SALT_SECRET`. That
construction is now published in the redesign docs, so any cosmetic value
derived from it and computed in a browser is a bruteforce oracle against the
salt. `pnpm check:boundary` enforces this.

## Playwright — both states, confirmed independently

- **`@playwright/mcp`** — configured in `.mcp.json`, stdio, `--output-dir ./.playwright`,
  gitignored. Produced `DESIGN-REVIEW-01`'s captures. Ad-hoc, agent-driven.
- **`@playwright/test`** — **was not installed.** Now at the workspace root,
  v1.62.1, Chromium downloaded, `playwright.config.ts` with
  `snapshotDir: design/baselines`, `outputDir: design/screenshots/test-runs`,
  HTML reporter → `design/qa-report`, projects at 1440×900 and 380×844.
- Scripts: `pnpm qa`, `pnpm qa:update`, `pnpm qa:report`, `pnpm check:boundary`.
- QA freeze variable is **`VITE_QA_MODE`** — this is Vite, not Next. Register it
  in `scripts/check-env-names.mjs` when R1 first uses it.
- **Trap, already hit once:** `test.use({ reducedMotion })` silently did nothing
  here — a diagnostic spec showed `matchMedia` reporting `false` under both
  declared values, so half the matrix was running unreduced and reporting green.
  Use `page.emulateMedia({ reducedMotion })`. The spec now asserts the emulation
  actually applied, so this cannot rot again silently.

## Local stack used for captures

Already running from the previous session; `octa-db` up on :15432, API on :8090,
web on :5173, console on :5174. Launch sequence is in `DESIGN-REVIEW-01.md`.
**Re-run `db/demo-seed.sql` after `pnpm verify`** — the API suite's `resetAll()`
truncates and leaves two fixtures. It was in exactly that state at the start of
this session (3 profiles, 4 objectives); after reseeding: 25 profiles, 110
objectives, 215 content blocks.

---

## Rulings — decided 1 September 2026

| # | Ruling | Landed in |
|---|---|---|
| **F-1** | **Mean of moons, plus an explicit Stage 00 fallback** to `Math.min(...stages.levels)` | `SOLAR-SYSTEM-SPEC.md` §1.1 · `phases/R1` §R1.1 |
| **F-2** | **Ring spacing allocated by occupancy**, not even steps | same |
| **F-3** | **Angle sweeps ~300°**, leaving a visible gap between Stage 18 and Stage 00 | same |
| **F-4** | **Stage 01 keeps its all-levels rendering** | same |
| **F-5** | **3D is the default on capable devices, degrading in place. Nothing redirects.** `VISUAL-SYSTEM-3D.md` §5 is the owner | `phases/R1` §R1.2 · pointers added to `CLAUDE.md`, `GAME-DESIGN.md` §2.1, `SKILL-TREE-3D.md` §4, `PAGE-SPECS.md` §2 |
| **Minigames** | **All five approved.** Constraints in each proposal still bind; each waits on its chapter being authored | `phases/R3` §R3.2b · `MINIGAME-PROPOSALS.md` header |

**The one that changes the most work: F-5.** Degrade-in-place is already built
and stays. What must change in R1 is the *default* — 3D currently sits behind
`localStorage["octa:map-mode"]` defaulting to flat, so no student sees a canvas
unless they find the toggle.

**The one most likely to be misread later: the minigame approval.** Approved is
not the same as buildable. **Chapters 01–07 are authored; 08–18 are scaffolds**
carrying only syllabus objectives and a topic outline
(`services/api/src/routes/console.ts:341`). All five approved minigames sit on
stages 14–18, and The Descent's payoff stage (16) and gate stage (11) are
scaffolds too. So the expected R3 outcome is five *deferred* lines with the
reason recorded — which is not a reversal of the approval, and not a slip.

---

## Findings and history — deliberately not here

- **`docs/PROGRESS-FINDINGS.md`** — the numbered findings log, F-1 onward.
  Reference: consult it when a finding is cited, do not read it through.
- **`docs/superseded/PROGRESS-phase-checklists.md`** — the per-phase checklist
  copies this file used to carry. They duplicated
  `docs/redesign/phases/*.md`, and the two disagreed, which is the
  "authored twice" problem applied to the project's own tracking.
- **`docs/redesign/phases/*.md`** — the authoritative checklists. **Count the
  boxes there. Never copy a number forward.**

This file was 2,003 lines on 7 Sep 2026 with the live state buried at the top of
forty findings. §2c rule 6 asks that the first screen be the truth and not the
history.
