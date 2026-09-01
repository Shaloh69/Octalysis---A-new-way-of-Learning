# PROGRESS.md — Solar System Redesign, Live State

> Read this file, in full, before doing anything else in a new session on
> this redesign — after root `CLAUDE.md` and `docs/redesign/REDESIGN-CLAUDE.md`.
> Update it before ending any session, or before `/clear`, whichever comes first.

**Last updated:** 1 September 2026, end of the R2 session.
**Branch:** `main`. Not a `redesign/*` branch — root `CLAUDE.md` is explicit
about why (`shaloh-build` cost an hour when Vercel and Render both built `main`).

## Current phase

**R2 — COMPLETE. R3 (the page-template pass) is next.**

Two students now get visibly different systems over an identical curriculum,
and the boundary between the two is enforced by tests rather than by prose.

## R2 checklist status

### R2.1 — The cosmetic endpoint ✅
- [x] `GET /api/v1/cosmetics` in `services/api/src/routes/cosmetics.ts`,
      derived from `student_id` alone, returning
      `{ rotationOffset, paletteVariant, callsign, biomeIndex }`
- [x] **Never** imports `engine/seed.ts`, never sees `EXAM_SALT_SECRET`
- [x] `cosmetic-seed.ts` on the client is a thin consumer — it hashes nothing
- [x] **The avatar question has an answer, and it is "there isn't one."**
      R2.1 says to confirm how the avatar seeds today and match it.
      `DESIGN-MANDATE.md` §4 specifies DiceBear identicon seeded from
      `student_id`, but **nothing implements it** — no dicebear dependency, no
      avatar component, nothing. So this is the FIRST consumer of that seed,
      not a second one, and `DESIGN-MANDATE-V2.md` §4's "the same seed **now
      also** drives the solar system" describes extending something that does
      not exist. When the avatar is built it should read this endpoint rather
      than growing a second derivation

### R2.2 — What gets seeded ✅
- [x] One whole-system rotation offset, applied as a single `<group>` rotation
      at the renderer — never per-ring, never per-planet, never in `layout.ts`
- [x] Four planet palette variants, pre-computed and contrast-checked
- [x] A callsign (`HARBOUR-59`), shown as a name and shaped so it cannot
      collide with a nine-digit student number
- [x] A landing biome index, one of seven

### R2.2b — The seven biomes — CORRECTED MID-PHASE, then rebuilt

> **`BIOME-AND-LOADING-SPEC.md` §2 was revised by the instructor on
> 1 September 2026, and the revision REVERSES the default.** Real sourced CC0
> parallax art is now the default for six of seven biomes; procedural is the
> named exception, used only where no cleanly-licensed pack exists.
>
> **Why, recorded here so a later session does not quietly revert to
> procedural because an earlier draft said so:** `GAME-DESIGN.md` §9's "no
> asset packs" rule exists because an ENCOUNTER theme has to look
> content-honest, and four tokens plus a gradient genuinely achieves that — a
> switchboard looks like a switchboard. A biome's job is different. It exists
> so "jungle" and "desert" read as unmistakably different environments at a
> glance, which is the whole reason biomes are in this redesign. A flat
> gradient in two hues delivers a tinted rectangle, barely distinguishable
> from picking a different accent colour, and defeats the point.
>
> I had already built the procedural version before the correction landed. It
> was reverted, not adapted.

- [x] Seven pack manifests at `apps/web/src/biomes/packs/`, each carrying its
      own source URL, licence caveat and vendoring instructions
- [x] **Lazy-loaded, one biome per student, never all seven** — verified in the
      build output: Vite emits a separate chunk per biome, and the layer images
      will live in `public/` so the browser fetches only the referenced ones
- [x] **Volcanic is procedural, by exception**, from its two already-checked
      tokens. `BiomeScene` uses an explicit one-name allow-list rather than
      "no layers means draw the tokens", so an un-sourced biome renders
      **nothing** instead of a stand-in that looks finished
- [x] All seven still pass the contrast pipeline (`--biome-ink` at 4.5:1)
- [ ] **BLOCKED ON ASSETS — six of seven biomes render nothing today.** The
      packs are named and licence-checked in §2's table, but nothing is
      vendored: `apps/web/public/CREDITS.md` still says "Not yet vendored" for
      every asset category in the project. `REDESIGN-CLAUDE.md` §1b routes
      non-Kenney itch.io through a human glance for licence verification, and
      five of the six are non-Kenney. **Needs a human to fetch and verify.**
- [ ] Per-biome weight not measured, because there is nothing to weigh yet.
      §2 asks for it in this file next to the 3D chunk budget; the row is
      reserved below

### Biome weights — reserved, per BIOME-AND-LOADING-SPEC.md §2

| Biome | Source | Vendored | Weight (gz) |
|---|---|---|---|
| neutral | Kenney Background Elements (CC0) | no | — |
| jungle | itch.io CC0 parallax, per-file check | no | — |
| desert | styloo Desert Parallax (CC0 1.0, explicit) | no | — |
| arctic | Admurin Snowy Mountains, verify page | no | — |
| volcanic | **procedural, by exception** | n/a | 0 |
| cave | itch.io — **licence disputed by its own author** | no | — |
| ocean | itch.io free ocean packs, per-file check | no | — |

### R2.2b — the superseded procedural plan
- [x] All seven procedural, as token blocks — no asset packs, same reasoning
      `GAME-DESIGN.md` §9 applied to the encounter themes
- [x] Each contrast-checked individually, not one representative example
- [ ] **Biomes are DEFINED but not yet RENDERED anywhere.** They are seeded,
      tokenised and checked; nothing paints them, because a biome wraps a
      stage's *landing*, and `/app/stage/:id` gets its pass in R3. Deferred
      deliberately, not forgotten

### R2.3 — The boundary, as a test ✅
`services/api/test/cosmetics.spec.ts`, 12 tests. The phase file says this test
*is* the enforcement, so it asserts the things that must never be true:
- [x] The cosmetic derivation does not move when `exam_salt` changes — the
      decisive property, since rotating the salt between terms must not repaint
      anyone's system
- [x] `layout.ts` contains no `studentId`, `seed`, `cosmetic` or
      `rotationOffset` — read from the real file, so it fails if anyone threads
      a seed in later
- [x] No file under `apps/web/src` calls `createHash`, `sha256` or
      `subtle.digest`
- [x] The signature cannot accept a salt — **asserted against the source, not
      `Function.length`.** A mutation check caught the first version being
      useless: `Function.length` ignores defaulted parameters, so
      `deriveCosmetics(key, examSalt = "")` still reported 1, and a defaulted
      parameter is exactly how a salt would get added
- [x] Mutation-verified: threading a seed into `layout.ts` fails 1, a defaulted
      salt parameter fails 1, adding client-side hashing fails 1

### R2.4 — Contrast ✅
- [x] Extended `scripts/check-contrast.mjs` rather than adding a second
      pipeline. **1174 checks now (1080 palette, 42 encounter, 52 cosmetic)**
- [x] It caught five real failures on first run, which is the point of it
- [x] Added a **mutual-distinguishability** check between palette variants,
      mirroring the one already applied to the twelve accents. The first draft
      of the variants all rendered as the same white planet — every one passed
      its own contrast check while the feature did nothing

### Definition of done ✅
- [x] Two students screenshotted side by side: `design/r2-cosmetics/`
- [x] Same 19 stages, same titles, same order, asserted

## Next phase

**R3 — Page template pass**, `docs/redesign/phases/R3-page-templates-and-redesign.md`.
44 routes. Expect to split it across sessions. Two carried-over items land
there: rendering the biomes (R2.2b), and projecting DOM controls onto their
planets (R1.2).

## Superseded — R1's status, kept for the record

**R1 — COMPLETE. R2 (per-student cosmetics) is next.**

The solar system renders, is the default on a capable device, degrades in place
on every rung of the ladder, and is under its performance budget. R1.2's one
deferred item is named below rather than quietly skipped.

## Completed phases

- **R0** — scope, guardrails, Playwright, the package move, and all R0.1b
  decisions.
- **R1** — the layout function, the two-layer architecture, base rendering, and
  the performance check.

## Next phase

**R2 — Per-student seeded cosmetics**, `docs/redesign/phases/R2-per-student-seeded-cosmetics.md`.
The cosmetic endpoint's shape was decided in R0.2 and is recorded below; R2
builds it. **Read F-5 before touching the map:** 3D is now on by default, so a
cosmetic bug is visible to every student rather than to whoever found the
toggle.

## R1 checklist status

### R1.1 — Layout function ✅
- [x] `computeSolarLayout(stages, objectives)` at `apps/web/src/solar-system/layout.ts`
- [x] F-1 mean-of-moons, with the Stage 00 fallback as a **named branch**
- [x] F-2 occupancy-proportional ring spacing
- [x] F-3 ~300° sweep, largest gap between stage 18 and stage 00
- [x] F-4 stage 01 keeps `spansAllLevels` and renders as a spoke
- [x] 30 tests in `apps/web/test/layout-solar.spec.ts`. Stages parse from
      `db/schema.sql`, objectives from `content/stages/*.md` — **neither is
      copied**, for the reason `layout.spec.ts` already learned
- [x] **Mutation-verified, not just green:** a 360° sweep fails 2 tests,
      removing the Stage 00 fallback fails 4, even ring spacing fails 1, moons
      at solar radius fails 2

### R1.2 — Two-layer architecture ✅ (one item deferred, named)
- [x] **3D is the default on capable devices** — F-5's substance. Removed the
      `localStorage` default-of-off; the preference is now a real override in
      both directions
- [x] Degrade in place on every rung, nothing redirects — asserted for reduced
      motion, ≤640px and absent WebGL, each checking the URL is unchanged
- [x] WebGL-disabled path verified by actually nulling `getContext`. **This
      check was vacuous before R1** — no canvas rendered by default, so it
      passed without proving anything
- [x] `prefers-reduced-motion` freezes to static, via `page.emulateMedia`
- [x] R0's recorded matrix turned into hard assertions
- [x] Only one map draws at a time — the flat SVG is suppressed when the system
      is showing
- [ ] **DEFERRED, stated rather than quietly skipped:** DOM controls are not yet
      *positioned over* their planets. `SKILL-TREE-3D.md` §4's overlay wants
      real buttons projected onto their 3D counterparts. Today the act list
      carries all 19 stages as real labelled buttons in curriculum order, which
      satisfies the accessibility contract, but the projection is not built. R1
      shipped the layer, not the overlay. Do it in R3's `/app` pass; not blocking

### R1.3 — Base rendering ✅
- [x] Sun at centre, procedural, and **not** the student's accent — the accent
      marks the student's own progress and may never carry semantic meaning
- [x] Seven rings, radii from `layout.ts`, weight by occupancy. Empty rings still
      draw faintly: L4 and L5 carrying nothing is true information
- [x] 19 planets, state rendered from the server's resolved field, never computed
- [x] Flight path split travelled/ahead, drawn behind the bodies
- [x] Instanced star field, ≤3,000 points, deterministic
- [x] Rings unlabelled until Stage 11, gated on server-derived state
- [x] **No drei.** `VISUAL-SYSTEM-3D.md` §5 records it was deliberately dropped
      to get under budget; rings, path and star field are plain BufferGeometry

### R1.4 — Performance ✅ (one item not done, named)
Measured both ways — the change was stashed and the build re-run, so this is a
real delta rather than a guess:

| | HEAD (galaxy) | Solar system | Delta |
|---|---|---|---|
| Initial JS, gz | 69.62 KB | 70.45 KB | **+0.83 KB** |
| CSS, gz | 7.49 KB | 7.52 KB | +0.03 KB |
| 3D chunk, gz | 219.80 KB | **220.37 KB** | +0.57 KB |

- [x] 3D chunk **under the ≤250 KB budget**, ~30 KB of headroom for R2/R4
- [x] **Not preloaded** — `dist/index.html` has no `modulepreload`, which is the
      property that actually matters
- [x] Drift skips work entirely when the tab is hidden
- [ ] Frame rate on a throttled profile **not measured** — see the honesty
      section at the end. This is the phase's biggest gap

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

### R0.1b — Open decisions surfaced AND resolved ✅
- [x] Five minigame proposals put to the human — **all five approved**
- [x] `ADAPTIVE-SCORING-PROPOSAL.md` confirmed parked, out of scope for this track
- [x] All five written into R3 §R3.2b **at R0**, per that section's own rule
      about not adding them mid-phase
- [x] F-1 … F-5 ruled; folded into `SOLAR-SYSTEM-SPEC.md`, `phases/R1`,
      `DESIGN-MANDATE-V2.md`, and the four documents F-5 demoted to pointers

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

Already running from the previous session; `octa-db` up on :54329, API on :8090,
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

## The findings behind those rulings

Kept because the measurements are the reasoning, and a later session should not
have to rebuild them. Numbered so the phase files can cite them.

### F-1 · Moon-derived planet radius is the number the code already computes, and it breaks Stage 00
**RULED: mean of moons, with an explicit Stage 00 fallback to `Math.min(...stages.levels)`.**
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
**RULED: adopt occupancy-proportional ring spacing.**
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
**RULED: adopt the ~300° sweep with a visible gap.**
Stage 18 lands ~19° from Stage 00. The single most important true fact about
this graph is that it is a chain with no forks and no return, and the layout
draws it as a near-closed ring.
**Proposal:** sweep ~300° with a visible gap, or advance radius per turn.

### F-4 · Stage 01 loses information the galaxy carried
**RULED: preserve the all-levels rendering.**
`stages.levels` is `{0,1,2,3,4,5,6}` and the current map renders it as a column
crossing every stratum (`layout.ts:66`, `spansAllLevels`). Its objectives are
all level 6, so under the new rule it collapses to a point on the outermost
ring and "this stage is *about* the hierarchy" disappears. The spec never
mentions the regression.

### F-5 · `/app` does not redirect and never renders a canvas — and that is deliberate code, contradicting four documents
**RULED: 3D default on capable devices, degrade in place, nothing redirects.
`VISUAL-SYSTEM-3D.md` §5 owns the rule; the other four documents now point at it.**
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

~~**Not mine to fix.** Both are product decisions.~~ **Both answered.** Question 1
resolved in favour of degrade-in-place, with §5 named as owner. Question 2
resolved: 3D becomes the default, so R1 must remove the default-off behaviour
while keeping the preference as a genuine override.

### F-6 · The map graphic is close to unreadable at both widths
See `design/before-r0/`. At 1440px the graph occupies a fraction of the width as
tiny dark discs; at 380px it is a scatter of near-black specks with no labels and
no visible edges. The act list beneath it carries all the actual information, and
carries it well. Same class as `DESIGN-REVIEW-01` D-1, and invisible to every
green gate. R1/R3 input, not a blocker.

### F-10 · The 3D layer had never used a design token
**NEW in R2, and the most consequential finding so far.**

`tokenColor()` in the canvas did `new THREE.Color(raw)` on a token's value.
**Every token in this project is authored in OKLCH**, which three.js's colour
parser does not understand — it handles hex, `rgb()`, `hsl()` and named
colours. So every read threw, hit its catch, and returned a hardcoded HSL
fallback. The galaxy had been running that way since it was written.

`VISUAL-SYSTEM-3D.md` §6 opens "Never write a literal hex in a 3D scene… Read
the resolved CSS custom properties once at scene setup and convert." The read
was there. The convert never happened.

Why nothing caught it: `scan:palette` passes because there is no literal hex;
`check:contrast` passes because the tokens were fine — they simply never
reached the scene; TypeScript sees a valid constructor call. It surfaced only
because two students with deliberately different palette variants rendered
identically in a screenshot, and the screenshot was looked at.

**Fixed:** the canvas now paints one pixel to a 1×1 2D canvas and reads it
back, so the browser does the colour maths. That also avoids a second copy of
OKLCH→sRGB drifting from the one `scripts/check-contrast.mjs` already owns.
`docs/VISUAL-SYSTEM-3D.md` §6 records the whole thing.

**Related and now removed:** `apps/web/src/components/GalaxyCanvas.tsx` was
dead after R1 and carried the same broken conversion. Deleted rather than left
as a second, wrong copy of the map renderer.

### F-11 · The visual harness was flaky, and it was my fault
**NEW in R2. Fixed in the same session.**

`design/specs/*.spec.ts` used `waitForTimeout(1800)` as a synchronisation
primitive. That passes at one worker and fails at eight against a single Vite
dev server — four tests failed, all of them assertions about `.act-list`, which
reads exactly like a product bug and is not one.

Fixed properly rather than by raising the number: the specs now wait on real
conditions (`html[data-planet]` for "the cosmetics fetch has landed",
`.act-list` for "the DOM layer rendered", `canvas` only where the ladder says
one should exist), and `playwright.config.ts` caps workers at 4 locally and 2
in CI because one dev server and one API process are a real bottleneck.

Worth knowing for R3, which adds a lot more specs: a fixed sleep in a visual
test is a latent false failure, and the tell is passing serially while failing
in parallel.

### F-8 · 47 CSS declarations reference custom properties that do not exist
**NEW in R1. Not caused by this work — it predates it.**

`apps/web/src/styles.css` uses `var(--ink-dim)` **27 times** and `var(--rule)`
**20 times**. Neither is defined anywhere in `packages/tokens/tokens.css`. With
no fallback those declarations are invalid at computed-value time: `color`
inherits instead of dimming, and a border falls back to `currentColor`.

Every gate stayed green, each for a specific reason worth writing down.
`scan:palette` passes because there is no literal hex. `check:contrast` passes
because it computes **token pairs**, and these are not tokens at all.
TypeScript never sees CSS. Same shape as `DESIGN-REVIEW-01`'s
finding-behind-the-findings: a class of defect no automated check here can see.

The intent looks obvious — `--ink-dim` wanting `--ink-muted`, `--rule` wanting
`--line`, both of which exist — but "looks obvious" is an inference about
someone else's intent across 47 sites, so this is a **decision, not a cleanup**:
alias the two names in `packages/tokens` (lower risk, keeps the call sites), or
rewrite the call sites (one fewer concept). Recommend aliasing first so the
visual change lands in one reviewable step, then deciding whether to rename.

`GalaxyCanvas.tsx` reads `--ink-dim` three times too, so the star field and edge
colours have been hardcoded HSL fallbacks all along — in the one file most
committed to routing every colour through a token. `SolarSystemCanvas.tsx` uses
`--ink-faint`, which exists.

### F-9 · The documented bundle baseline is stale, and nothing measures it
**NEW in R1.**

`VISUAL-SYSTEM-3D.md` §5 records "51.9 KB + 3.8 KB CSS" as the initial bundle.
Measured at HEAD **before** any R1 change: **69.62 KB JS + 7.49 KB CSS**. The JS
figure has drifted 34%; the CSS has nearly doubled. Presumably across P4–P9.

That section ends "A budget nobody measures is a wish", which turned out to be
exactly right: `pnpm scan:bundle` checks for answer-key and secret leaks, not
size, so nothing in CI has ever compared these numbers to the document.

The ≤250 KB **3D chunk** budget — the one that actually protects the phone
audience — is intact at 220.37 KB. It is the initial-bundle line that rotted.
Worth doing: correct §5's numbers, and decide whether `scan:bundle` should gain
a size assertion so the next drift is caught by CI rather than by someone
reading a document three phases later.

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

**Start R3 — the page-template pass.** It is the largest phase by page count;
split it across sessions and update this file after each batch of routes.

1. Read `docs/redesign/TEMPLATE-LINKS.md` for the per-route template, and
   `CONSOLE-DATA-AND-TEMPLATES.md` for the console's real merges — the console
   section of TEMPLATE-LINKS is only the baseline.
2. Two items carried in from earlier phases, both named and neither forgotten:
   **render the biomes** (R2.2b — defined, checked, unpainted; they belong on
   `/app/stage/:id`), and **project DOM controls onto their planets** (R1.2 —
   `SKILL-TREE-3D.md` §4's overlay).
3. **F-8 belongs here**: 47 declarations referencing `--ink-dim` and `--rule`,
   which do not exist. It is a decision (alias vs. rewrite), not a cleanup.
4. Still outstanding from R0's rulings: `GAME-DESIGN.md` §11's mini-game table
   (rewrite for the 18-chapter curriculum, add the five approved games) and
   §12's Track D.
5. **F-7/D-3 is still the instructor's**, and R3 will render act names on more
   surfaces, not fewer.

## Superseded — R2's plan, kept for the record

**Start R2 — per-student seeded cosmetics.**

1. Build the cosmetic endpoint per the shape decided in R0.2:
   `services/api/src/routes/cosmetics.ts` -> `GET /api/v1/cosmetics`, from
   `profiles.student_id` alone. **Never** import from
   `services/api/src/engine/seed.ts`; `pnpm check:boundary` enforces it.
2. The whole-system rotation offset is the only cosmetic touching the map's
   geometry, and it must rotate **every** body by the same angle. A per-ring or
   per-planet offset would put a seeded value inside the semantic encoding.
   `layout-solar.spec.ts` already asserts `computeSolarLayout` takes no seed
   parameter at all -- keep it that way and apply the rotation at the renderer.
3. Housekeeping still outstanding from R0's rulings: `GAME-DESIGN.md` 11's
   mini-game table (rewrite for the 18-chapter curriculum, add the five
   approved games) and 12's Track D.
4. F-8 and F-9 are cheap and belong in R3's design pass.

### Superseded — R1's plan, kept for the record

1. `layout.ts` — tests first, per `phases/R1` §R1.1. Six unit tests are named
   there: INV-32 for planets, INV-32 extended to all 110 moons,
   moon-to-planet aggregation, the Stage 00 fallback by name, radius monotonic
   in level, and radius independent of the cosmetic seed. Plus F-3's
   largest-gap assertion.
2. Then §R1.2 — make 3D the default, keep degrade-in-place, and turn R0's
   recorded viewport × motion matrix into hard assertions.
3. **Before R1.4's performance check, note what is not installed:**
   `@react-three/drei`, `@react-three/postprocessing` and
   `react-force-graph-3d` are all absent, and `VISUAL-SYSTEM-3D.md` §5 records
   that drei was deliberately *dropped* to get the chunk under 250 KB (219.8 KB
   measured). Re-measure before assuming headroom.
4. Housekeeping the rulings created, cheapest first: `GAME-DESIGN.md` §11's
   table (rewrite for the 18-chapter curriculum, add the five minigames) and
   §12's Track D.

## R1 · what changed outside `apps/web`, and why

One change landed in `services/api`, and it is exactly the kind
`REDESIGN-CLAUDE.md` §1 says to flag rather than make quietly:

**`GET /api/v1/stages` now returns each stage's objectives** as `{id, level}`
pairs, no description text. The layout needs them — a planet's ring is the mean
of its own moons' levels, and without them every stage would silently take the
no-objectives fallback and the rendered map would disagree with its own tests.

Why this sits inside the boundary rather than crossing it:
- **No schema change.** No new table, column, function or policy.
- **Read-only and additive**, on an existing student-facing route.
- **RLS-neutral.** `ob_read` already lets an authenticated user read objectives
  of any **published** stage — deliberately not requiring *unlocked*, which is
  why `/api/v1/stages/:id` can already return a locked stage's objectives, and
  why `PAGE-SPECS.md` §2 can promise a preview of the next locked stage's
  objectives. The query filters to the same published set the route already
  filtered to, so it exposes nothing that was not already reachable.
- **Nothing to do with** grading, the question engine, or the exam seed.

250 API tests still pass and `pnpm check:boundary` is clean.

## Which parts of this were actually run, and what I am unsure about

**R1 — ran, and watched succeed or fail:** `pnpm verify` end to end (typecheck,
lint, palette, env, 1122 contrast checks, objectives, book map, **321 tests**
across web/console/api, 23 invariants, 0 failures); `pnpm qa` (**19/19**); the
four-way mutation check on `layout.ts`; `pnpm --filter @octa/web build` twice —
once with the change and once with it stashed — for a real before/after bundle
delta rather than a guess; a Chromium probe that located the 5px 380px overflow;
the API restarted and its new payload inspected directly (110 objectives across
19 stages, Stage 00 with zero, Stage 03 with 11 at level 1 — matching the layout
tests exactly).

**Looked at, not merely asserted:** five screenshots during R1, and the first
two were wrong in ways no test would have caught — the solar system drawn as a
full-viewport backdrop *underneath* the flat SVG map, two maps stacked with the
act list scrolling over both; then the page title pushed below the map; then the
camera cropping the outer rings. All three were found by opening the picture.


**Ran, and watched succeed or fail:** the package move; `pnpm add -Dw
@playwright/test` and `npx playwright install chromium`; `pnpm qa` (8/8, four
times, including one run that exposed my own broken motion emulation);
`node scripts/sync-content.mjs` (215 blocks, 110 objectives); `db/demo-seed.sql`;
`pnpm check:boundary` clean, then failing on a deliberately planted violation,
then clean again after removing it; direct SQL for every number in the ring
table; a standalone Chromium probe for the redirect matrix.

**Verified by reading real files, not documentation:** every claim in the
durable-facts and boundary-baseline sections.

**R2 — ran, and watched succeed or fail:** `pnpm verify` end to end (**333
tests** across web/console/api, 1174 contrast checks, 23 invariants, 0
failures); `pnpm qa` **22/22**; three mutation checks on the boundary tests,
one of which exposed my own assertion being useless; the contrast extension
caught five real failures before passing; two students captured side by side
and compared by eye.

**Looked at, not merely asserted — and this is where R2's real finding came
from:** the seeding rendered identically for both students THREE times while
every test stayed green. Wrong element for the attribute, then a memo caching
the colour before the fetch landed, then the actual cause — three.js cannot
parse OKLCH, so the 3D layer had never read a token at all. Only the screenshot
showed it, each time.

**Assumed, not verified — R2:**
- **The biomes are defined, checked, and rendered nowhere.** Seven token sets
  pass contrast; nothing paints them yet. Deferred to R3 on purpose, but it
  means "all seven biomes screenshotted individually" — a `REDESIGN-CLAUDE.md`
  §2 requirement — is **not** done, and cannot be until they render.
- **Only the default theme was looked at**, again. The contrast maths covers
  all three; the rendered canvas has only ever been seen on one.
- **The callsign is generated but displayed nowhere.** `SOLAR-SYSTEM-SPEC.md`
  §3 puts it on `/app/settings`, which R3 owns.
- Frame rate still not measured, carried from R1 and still the biggest gap.

**Assumed, not verified — R1:**
- **Frame rate was never measured.** R1.4's 30fps-floor check on a throttled or
  mid-range profile did not happen. Bundle size and draw-call structure are
  under budget, but that is not the same claim, and the audience is on mid-range
  Android. This is the biggest unverified item in the phase.
- **Draw calls were not counted**, only reasoned about: 19 planet meshes + 7
  ring loops + 2 path segments + 1 starfield + sun ≈ low 30s. Under 50 by
  argument, not by measurement. R4 adds 110 moons and should count for real.
- **Only one theme was looked at.** Every capture is the default theme. The
  contrast gate computes all three, but a canvas reading tokens at scene setup
  is not what that gate covers.
- The Stage 11 ring-reveal flag is threaded through and unit-covered at the data
  level, but **no student in the demo seed has mastered Stage 11**, so the
  revealed state has never been rendered.
- `design/specs/*.ts` and `playwright.config.ts` are still **not** in any
  workspace `tsconfig`, so `pnpm typecheck` does not cover them. I typechecked
  them by hand again. Worth wiring properly rather than remembering each time.
- Moons are **not rendered** — deliberate, R1's goal says skeleton first and R4
  is the moon phase. The layout computes and tests all 110; nothing draws them.

**Assumed, not verified — R0 (carried forward, and two are now settled):**
- ~~`pnpm verify` was not run.~~ **SETTLED in R1:** run end to end, green.
  The `tsconfig` coverage gap for `design/specs/*.ts` and
  `playwright.config.ts` is real and still open — see the R1 list above.
- ~~The ≤250 KB 3D-chunk budget was not re-measured.~~ **SETTLED in R1:**
  220.37 KB, measured, with the before/after taken by stashing the change and
  rebuilding. drei, postprocessing and react-force-graph-3d were **not**
  installed and were **not** added — R1.3 builds rings, path and star field from
  plain BufferGeometry, which is why the chunk barely moved. See F-9 for the
  initial-bundle figure, which had rotted.
- Nothing was captured on the console app; R0 only needed the student map.
- The captures came from an API and dev servers already running from a previous
  session. I confirmed they were healthy and serving the reseeded database, but
  I did not start them myself and do not know the exact env they booted with
  beyond the JWT secret, which I verified by minting a token that worked.
