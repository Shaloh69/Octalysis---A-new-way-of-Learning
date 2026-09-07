# SUPERSEDED — per-phase checklist copies that lived in PROGRESS.md

**Retired 7 September 2026.** Moved here rather than deleted, per the
`docs/superseded/` practice in `REDESIGN-CLAUDE.md` §2c — a stale claim should
stop being loaded without losing the reasoning that produced it.

## Why these were retired

`PROGRESS.md` carried its own copies of the R0, R1 and R2 checklist state,
alongside the real checklists in `docs/redesign/phases/`. **That is the
"authored twice" problem the whole project is built to avoid**, applied to its
own tracking: two places recorded the same counts, and they disagreed. On
7 Sep the table said R2 18/21 and R3 13/44 while the phase files held 19/21 and
17/49.

**`docs/redesign/phases/*.md` are the authority.** Count the boxes there; do not
copy a number forward. `PROGRESS.md` now links to them instead of restating
them.

Nothing below should be trusted as current. It is kept because the prose
around the counts records decisions that the bare checkboxes do not.

---

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
- [x] **`neutral` is vendored and rendering.** Kenney Background Elements, CC0,
      verified against the pack's own `License.txt` and credited in
      `public/CREDITS.md`. Proves the whole pipeline end to end: CC0 source ->
      vendored under `public/biomes/<name>/` -> per-biome lazy chunk ->
      composed parallax band. Weight recorded in the table above.
- [ ] **Composition is crude, and worth knowing before sourcing the rest.**
      These packs ship individual ELEMENTS, not pre-cut strips, so a layer is
      one sprite tiled with `repeat-x` — which at a single size read as
      wallpaper. Fixed enough by using two tree sprites at two depths with
      aerial perspective, and it now reads as a forest rather than a green
      rectangle, which is the bar §2 sets. But the tiling is still regular.
      Doing it properly means generating a wide strip per layer with
      randomised placement, which is real image work and a reasonable future
      improvement rather than a blocker.
- [ ] **BLOCKED ON ASSETS — five of seven biomes render nothing today.** The
      packs are named and licence-checked in §2's table, but nothing is
      vendored: `apps/web/public/CREDITS.md` still says "Not yet vendored" for
      every asset category in the project. `REDESIGN-CLAUDE.md` §1b routes
      non-Kenney itch.io through a human glance for licence verification, and
      all five remaining are non-Kenney. **Needs a human to fetch and verify.**
      Kenney was fetchable unattended precisely because §1b says so.
- [ ] Per-biome weight not measured, because there is nothing to weigh yet.
      §2 asks for it in this file next to the 3D chunk budget; the row is
      reserved below

### Biome weights — reserved, per BIOME-AND-LOADING-SPEC.md §2

| Biome | Source | Vendored | Weight (gz) |
|---|---|---|---|
| neutral | Kenney Background Elements (CC0) | **yes** | **10.2 KB** of PNG (5 sprites referenced; 27 KB vendored incl. licence) + 0.27 KB gz chunk |
| jungle | edermunizz *Free Pixel Art Forest* — **NOT CC0, credit REQUIRED**, no NFT/crypto. 9 layers | no | — |
| desert | styloo *Desert Parallax* — spec says CC0 1.0 explicit, **not yet opened and verified** | no | — |
| arctic | Admurin *Snowy Mountains* — **NOT CC0.** Any project; no standalone redistribution; no NFT; **no AI training**; credit appreciated. 5 layers, 384×216 | no | — |
| volcanic | **procedural, by exception** — no third-party art | n/a | 0 |
| cave | **candidate REJECTED.** Admurin's *Caves* has the same art on DeviantArt under CC 3.0; author asked directly, never reconciled it. Needs a different pack | no | — |
| ocean | ansimuz *Underwater Fantasy* — personal/commercial, modify, credit appreciated. Cleanest of the four checked, still not CC0. 3 layers | no | — |

**Four of the six sourced packs are not CC0**, and each carries different
obligations — edermunizz's requires credit, Admurin's forbids AI training and
standalone redistribution. `BiomeManifest.credit.obligations` exists so those
are impossible to miss from the code, and `public/CREDITS.md` carries them in
prose. Do not collapse any of this to "CC0".

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
- [x] **DONE — was deferred from R1, built after R2.** Real `<button>`s are now
      positioned over their planets: `PlanetHits` in `StageMap.tsx` reads
      screen-space positions written each frame by `Projector` in
      `SolarSystemCanvas.tsx`. A ref, not state — the camera drifts, and
      routing 19 positions through React frame would re-render the map sixty
      times a second to move some buttons. Focus order is curriculum order, not
      screen position. Mutation-verified: dropping the seeded rotation from the
      projector moves stage 00's button ~600px off its planet, so the alignment
      is real and not a coincidence.
- [ ] ~~DEFERRED~~ superseded by the line above. `SKILL-TREE-3D.md` §4's overlay wants
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
