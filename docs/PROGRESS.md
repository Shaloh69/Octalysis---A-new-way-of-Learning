# PROGRESS.md — Solar System Redesign, Live State

> Read this file, in full, before doing anything else in a new session on
> this redesign — after root `CLAUDE.md` and `docs/redesign/REDESIGN-CLAUDE.md`.
> Update it before ending any session, or before `/clear`, whichever comes first.

**Last updated:** 1 September 2026, end of the R0 session.
**Branch:** `main`. Not a `redesign/*` branch — root `CLAUDE.md` is explicit
about why (`shaloh-build` cost an hour when Vercel and Render both built `main`).

## Current phase

**R0 — Scope, Guardrails, and Playwright Setup. Work complete; four rulings
outstanding before R1 can start.**

R1 is **blocked**, not merely "next": three of the open findings below change
`layout.ts`'s formula, which is R1.1's first deliverable.

## Completed phases

- **R0** — everything in the phase file except the R0.1b decisions, which are
  the human's to make and are listed under "Open findings" below.

## R0 checklist status

### R0.1 — Confirm understanding ✅
- [x] Read the nine package docs, in order
- [x] Read root `CLAUDE.md`, `START-HERE.md`, `SKILL-TREE-3D.md`,
      `GAME-DESIGN.md` §1-9, `DESIGN-MANDATE.md`, `PAGE-SPECS.md`,
      `DESIGN-REVIEW-01.md`
- [x] Read the **real data**, not just the docs: `db/schema.sql`'s stage seed,
      all 19 `content/stages/*.md` front matters, `services/api/src/engine/seed.ts`,
      and the existing `apps/web/src/lib/layout.ts`
- [x] Scope boundary restated and confirmed

### R0.1b — Open decisions surfaced, not resolved ⏳
- [x] Five minigame proposals summarised for a ruling — **awaiting answer**
- [x] `ADAPTIVE-SCORING-PROPOSAL.md` confirmed parked, out of scope for this track
- [ ] Any approved minigame gets its R3.2b line **before** R3 starts

### R0.2 — Boundary technically enforceable ✅
- [x] `is_stage_unlocked()` call sites recorded (below)
- [x] No client-side mastery/lock computation in `apps/web` today — verified
- [x] Cosmetic-seed transport decided (below)
- [x] Real curriculum numbers recorded as durable facts (below)
- [x] **Beyond the checklist:** the boundary is now a script, not a snapshot —
      `pnpm check:boundary`

### R0.3 — Playwright and screenshots ✅
- [x] Both Playwright states confirmed independently (below)
- [x] `@playwright/test` installed at the workspace root + `playwright.config.ts`
- [x] `design/` folders created; `screenshots/` and `qa-report/` gitignored,
      `templates/`, `baselines/`, `specs/`, `before-r0/` committed
- [x] Committed-folder guard rail: fixture data only, no real names
- [x] Smoke capture of `/app` and `/app/map` at 1440 and 380 — **and** in both
      motion states — passing, 8/8

### R0.4 — Package moved, references fixed ✅
- [x] Nine docs → `docs/redesign/`; phase files → `docs/redesign/phases/`
- [x] `ADAPTIVE-SCORING-PROPOSAL.md` and `KICKOFF_PROMPT.md` left at repo root
- [x] Three dangling `DESIGN-REVIEW-02-PLAN.md` citations fixed
- [x] Two stale copies corrected where they lagged the spec's own revision

### R0.5 — This file ✅

---

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
  moons' radii" is undefined for it. It is also the first planet a student ever
  sees.
- **Every stage's objectives are unanimous in level** — all 18 stages with
  objectives have a single distinct `objectives.level`. So the mean-of-moons
  radius always evaluates to that one level, and no planet's moons span more
  than one ring.
- **Ring sequence 00→18:** `(undefined), 6, 2, 1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 1,
  1, 1, 1, 0, 3`. That is **12 ring crossings and 9 direction reversals** over
  18 edges — `SOLAR-SYSTEM-SPEC.md` §1.3 says 13 crossings; 9 reversals is right.
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

Already running from the previous session; `octa-db` up on :54329, API on :8090,
web on :5173, console on :5174. Launch sequence is in `DESIGN-REVIEW-01.md`.
**Re-run `db/demo-seed.sql` after `pnpm verify`** — the API suite's `resetAll()`
truncates and leaves two fixtures. It was in exactly that state at the start of
this session (3 profiles, 4 objectives); after reseeding: 25 profiles, 110
objectives, 215 content blocks.

---

## Open findings — ALL need a ruling before R1

Numbered so later sessions and the phase files can cite them.

### F-1 · Moon-derived planet radius is the number the code already computes, and it breaks Stage 00
`SOLAR-SYSTEM-SPEC.md` §1.1's longest argument retires a collapse rule for
`stages.levels`. That rule already exists in shipped, tested code —
`Math.min(...levels)`, `apps/web/src/lib/layout.ts:69` — and because every
stage's objectives are level-unanimous, "mean of its moons" returns the
identical number for all 18 stages that have objectives. It is the old rule by
a longer route. What it adds is a division by zero on Stage 00. And its stated
payoff — moons "visibly spread across the rings it actually touches" — cannot
occur anywhere in this course.
**Options:** (a) keep `Math.min(...levels)` and drop the moon-derivation, moons
inherit their planet's ring; (b) keep moon-derivation and state a Stage 00
fallback explicitly; (c) something else.

### F-2 · The crowding §1.1 claims to fix is not fixed
Stated reason for the change was that L1 "would carry over a third of both
planets and moons." Measured after the correction: **7 of 19 planets and 43 of
110 moons**, on the second-smallest circumference. Worse, stages 12–16 are five
*consecutive* ordinals all on L1, so with angle = `ordinal` they crowd into a
~95° arc of a small ring carrying 26 moons. The last third of the course renders
as a flat arc, not the "corkscrew" §1.3 promises.
**Proposal:** allocate radial steps by occupancy instead of evenly. Stays
deterministic, stays monotonic in level, keeps the honesty claim. Now explicitly
permitted by the reworded `DESIGN-MANDATE-V2.md` §1B ("ordering is data, spacing
is typography").

### F-3 · Angle = ordinal over a full 360° closes a loop on a chain that has none
Stage 18 lands ~19° from Stage 00. The single most important true fact about
this graph is that it is a chain with no forks and no return, and the layout
draws it as a near-closed ring.
**Proposal:** sweep ~300° with a visible gap, or advance radius per turn.

### F-4 · Stage 01 loses information the galaxy carried
`stages.levels` is `{0,1,2,3,4,5,6}` and the current map renders it as a column
crossing every stratum (`layout.ts:66`, `spansAllLevels`). Its objectives are
all level 6, so under the new rule it collapses to a point on the outermost
ring and "this stage is *about* the hierarchy" disappears. The spec never
mentions the regression.

### F-5 · `/app` does not redirect and never renders a canvas — and that is deliberate code, contradicting four documents
Measured, all four combinations: `/app` → `/app`, `canvas=0`, always. `/app` and
`/app/map` are the same component with a `flat` prop; 3D is opt-in via
`localStorage["octa:map-mode"]`, defaulting to `"2d"`. The code says so in a
comment and cites `VISUAL-SYSTEM-3D.md` §5, whose "automatic degradation ladder"
does say *degrade in place* rather than redirect.

Against that: root `CLAUDE.md`, `GAME-DESIGN.md` §2.1, `SKILL-TREE-3D.md` §4 and
`PAGE-SPECS.md` §2 all say `/app` is a 3D galaxy **by default** that **redirects**
to `/app/map`. Two separate questions, and the second is the dangerous one:

1. **Redirect vs. degrade-in-place** — a genuine doc-vs-doc contradiction. The
   code's answer is arguably the better one. Needs one owner named and the
   losing copies turned into pointers, per `DESIGN-REVIEW-01`'s step 3.
2. **3D default-off** — *no* document sanctions this. If it stands, **the solar
   system R1–R5 builds is invisible to every student unless they find a toggle.**
   That is not a detail; it decides whether this redesign has a user.

**Not mine to fix.** Both are product decisions.

### F-6 · The map graphic is close to unreadable at both widths
See `design/before-r0/`. At 1440px the graph occupies a fraction of the width as
tiny dark discs; at 380px it is a scatter of near-black specks with no labels and
no visible edges. The act list beneath it carries all the actual information, and
carries it well. Same class as `DESIGN-REVIEW-01` D-1, and invisible to every
green gate. R1/R3 input, not a blocker.

### F-7 · Inherited from DESIGN-REVIEW-01, and this redesign makes it worse
**D-3, act grouping.** Three sources, three answers: `StageMap.tsx:297` renders
narrative act names, `stages.act` groups 00–05/06–09/10–13/14–18, and `CLAUDE.md`
says Prelim 1–4 / Midterm 5–8 / Semis 9–12 / Finals 13–17. Confirmed still
present in the R0 captures. **This redesign promotes Act to a HUD chip *and*
four-colour banding on the flight path**, so an unresolved grouping gets rendered
more prominently, not less. Still the instructor's call.

**D-4, submissions-queue density**, also still open. `CONSOLE-DATA-AND-TEMPLATES.md`
§2 now points at it correctly rather than at a plan file that does not exist.

---

## Decisions made this session worth remembering

- Package lives at `docs/redesign/`, phase files at `docs/redesign/phases/`.
  `FOLDER-STRUCTURE.md` never placed the phase files; it does now.
- Work on `main`. `KICKOFF_PROMPT.md`'s suggestion of a `redesign/*` branch is
  overridden by root `CLAUDE.md` and has been corrected in that file.
- `DESIGN-MANDATE-V2.md` §1B was stating the honesty rule against a formula
  §1.1 had already replaced. Reworded to separate **ordering (data, never
  adjusted)** from **spacing (a rendering constant)**.
- `DESIGN-MANDATE-V2.md` §2 introduced moons on Stage 00's "single objective".
  Stage 00 has none. Moved to Stage 01, with the underlying question — *should
  Stage 00 have objectives at all?* — flagged as the instructor's, not silently
  answered by inventing content (hard rule 5).
- `phases/R1` §R1.1 specified the superseded formula. Rewritten, with the new
  moon-aggregation and cosmetic-independence tests added, and gated on F-1..F-4.

## Next concrete step

1. Get rulings on **F-1 through F-5** and the five minigame proposals.
2. F-1/F-2/F-3/F-4 land in `layout.ts` → fold the answers into
   `docs/redesign/phases/R1-solar-system-foundation.md` §R1.1.
3. F-5 decides whether R1 also has to re-establish the redirect/default rules,
   or whether the solar system inherits the current opt-in model. **Do not start
   R1 without this one** — it changes what R1 is building.
4. Then R1.1: `layout.ts`, tests first.

## Which parts of this were actually run, and what I am unsure about

**Ran, and watched succeed or fail:** the package move; `pnpm add -Dw
@playwright/test` and `npx playwright install chromium`; `pnpm qa` (8/8, four
times, including one run that exposed my own broken motion emulation);
`node scripts/sync-content.mjs` (215 blocks, 110 objectives); `db/demo-seed.sql`;
`pnpm check:boundary` clean, then failing on a deliberately planted violation,
then clean again after removing it; direct SQL for every number in the ring
table; a standalone Chromium probe for the redirect matrix.

**Verified by reading real files, not documentation:** every claim in the
durable-facts and boundary-baseline sections.

**Assumed, not verified:**
- `pnpm verify` was **not** run this session. Typecheck over the new
  `playwright.config.ts` and `design/specs/*.ts` is unproven — neither is in a
  workspace `tsconfig`, so they may not be covered by `pnpm typecheck` at all.
  Worth settling early in R1.
- The ≤250 KB 3D-chunk budget was not re-measured. `VISUAL-SYSTEM-3D.md` §5
  records 219.8 KB, but `@react-three/drei`, `@react-three/postprocessing` and
  `react-force-graph-3d` are **not installed** and R1 assumes `<Line>`,
  `<Stars>`, `OrbitControls`, bloom and pinned-node picking. Note that §5 says
  drei was deliberately *dropped* to get under budget. Re-measure in R1.4 before
  assuming headroom exists.
- Nothing was captured on the console app; R0 only needed the student map.
- The captures came from an API and dev servers already running from a previous
  session. I confirmed they were healthy and serving the reseeded database, but
  I did not start them myself and do not know the exact env they booted with
  beyond the JWT secret, which I verified by minting a token that worked.
