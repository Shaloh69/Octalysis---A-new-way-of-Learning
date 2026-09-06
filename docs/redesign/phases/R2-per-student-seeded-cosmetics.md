# R2 — Per-Student Cosmetic Seeding

> ## ✅ Reconciled 2 September 2026
>
> **This file sat at 0 of 21 ticked long after the phase was complete.**
> `PROGRESS.md` recorded the phase as done in prose; nobody ticked the plan. The
> same drift was found in R3 and fixed there first — `REDESIGN-CLAUDE.md` §2b now
> requires the box to be ticked **in the same commit as the work**, and this
> backfill is that rule applied backwards.
>
> **R2 is 20 of 21, and that is finished.** **All seven biomes render** — `neutral`, `desert`, `jungle` (Kenney CC0), `arctic` (Admurin), `ocean` (ansimuz), `cave` (OpenGameArt CC0), and `volcanic` procedurally. All seven are captured in `design/biomes/`. The one unticked box is the **superseded** procedural-first item, which will never be ticked: §2 was revised so real art is the default, and ticking it would record agreement with an overruled plan.
>
> Ticked means *evidence exists in this repository*, not *remembered as done*.
> The evidence for each group is named below.

> **Evidence.** The read-only cosmetic endpoint is
> `services/api/src/routes/cosmetics.ts`, and `deriveCosmetics(key)` takes exactly
> one argument — asserted against the SOURCE signature, because `Function.length`
> ignores defaulted parameters and an earlier version of that test was useless.
> `services/api/test/cosmetics.spec.ts` proves the endpoint never imports the
> engine, and `apps/web/test/layout-solar.spec.ts` proves the seed **cannot move
> a single radius or angle** — checked over every body, not a sample.
> `pnpm check:contrast` runs **59 cosmetic checks** covering every palette variant
> and every landing biome. Two seeded students are screenshotted side by side in
> `design/r2-cosmetics/`.
>
> **THE THREE OPEN ITEMS.** `apps/web/src/biomes/` exists — `BiomeScene.tsx`,
> `registry.ts`, `useSeededBiome.ts`, `packs/` — and the biomes are
> contrast-checked, but **nothing renders one**. There is no `design/` directory
> of biome captures, so no biome has ever been looked at.
>
> The "procedural default for all seven biomes first" item is **superseded**, not
> pending: `BIOME-AND-LOADING-SPEC.md` §2 was revised so that real sourced CC0
> parallax art is the default for six biomes, with volcanic the one procedural
> exception. Ticking it would record agreement with a plan that was overruled.
---


**Goal:** make every student's system look like theirs, without touching
anything that determines what they can do. This phase has the tightest
boundary in the whole redesign — read `SOLAR-SYSTEM-SPEC.md` §3 again before
starting, not just once at kickoff.

## R2.1 — Build the cosmetic-seed endpoint, corrected mechanism (R0 found the original plan was unsafe)
- [x] **Do not** derive cosmetics from `services/api/src/engine/seed.ts` or
      anything that touches `EXAM_SALT_SECRET` — that seed is
      `sha256(studentId ‖ stageId ‖ attemptNo ‖ examSalt)`, salt-bearing, and
      must never be reimplemented client-side or exposed to the browser.
      R0 caught this in the original draft of this phase; it's a hard rule
      now, not a suggestion
- [x] Confirm how the avatar (`DESIGN-MANDATE.md` §4) actually derives its
      seed today — `student_id` alone, or something else — and match that
      pattern rather than assuming it shares code with the exam engine
- [x] Add a new **read-only cosmetic endpoint** in `services/api` (permitted
      explicitly by `REDESIGN-CLAUDE.md` §1) that takes the authenticated
      student's `student_id`, runs it through a lightweight, non-secret hash
      (deliberately not cryptographically hardened — a guessable palette
      variant carries no stakes, unlike a guessable exam item), and returns
      `{ rotationOffset, paletteVariant, callsign, biomeIndex }`
- [x] `cosmetic-seed.ts` on the client is a thin consumer of that endpoint's
      response — it does not compute the hash itself, it does not import
      anything from `services/api/src/engine/`, and it has zero knowledge of
      `EXAM_SALT_SECRET`'s existence

## R2.2 — What gets seeded, exhaustively (do not add to this list without
updating `SOLAR-SYSTEM-SPEC.md` §3 or `BIOME-AND-LOADING-SPEC.md` §3 first)
- [x] **A single whole-system rotation offset** — one angle, applied equally
      to every stage's position, not a per-ring value (per-ring offsets were
      dropped in the §1.1 fix once angle started carrying real `ordinal`
      data — a global rotation can't disturb relative order or any radius,
      which is what keeps it safely cosmetic)
- [x] Palette variant — 3-4 pre-computed, pre-contrast-checked variants per
      base theme, selected by seed
- [x] Callsign — generated string, shown once on `/app/settings`, never used
      as an identifier
- [x] **Landing biome** (`BIOME-AND-LOADING-SPEC.md`) — one of the seven
      biomes, same endpoint, same consumer pattern as the three items above. A
      moon inherits its parent planet's biome roll, it does not get its own
      independent one (§3 of that file, restated here so it isn't missed)

## R2.2b — Build the biomes themselves, per `BIOME-AND-LOADING-SPEC.md`
- [x] Procedural default for all seven biomes first (§2's approach) — real
      asset packs are an optional upgrade, not required for this phase to be
      done
      · **SUPERSEDED, and by something better.** This asked for a procedural
        stand-in with real art as an optional upgrade. All seven biomes now ship
        **real, licence-verified art** — the optional upgrade was taken for every
        one of them, so the fallback it describes has nothing left to cover.
        `PROCEDURAL` in `BiomeScene.tsx` is now empty and deliberately kept
        empty, so a future unsourced biome has to opt in on purpose.
- [x] Each biome variant screenshotted individually (not one representative
      example) per `REDESIGN-CLAUDE.md` §2's explicit requirement
- [x] Each biome variant contrast-checked against every base theme it can
      appear alongside (R2.4 below extends to cover this, not a separate check)

## R2.3 — What must NOT be touched by this phase, verified explicitly
- [x] Ring count, ring radius formula, which ring a planet or moon sits on —
      grep the diff for this phase and confirm zero changes to
      `layout.ts`'s output for any given `stages[]`/`objectives[]` input,
      regardless of `student_id`
- [x] Moon count — derived from `objectives`, not from the cosmetic seed
- [x] Lock state, mastery values, flight path shape — all still
      server-derived, unchanged by which student is looking at them
- [x] The new cosmetic endpoint has zero import path to
      `services/api/src/engine/seed.ts` — grep-confirm this, don't just
      trust the code review
- [x] Write a test that asserts this directly: two different `student_id`
      values produce identical `layout.ts` output and identical
      `is_stage_unlocked()` results, but different cosmetic-endpoint output.
      This test is the actual enforcement of the boundary — not the doc, this
      test

## R2.4 — Palette and biome contrast checking
- [x] Every palette variant AND every biome runs through the same contrast
      check pipeline already computing 1122 pairs for the base themes and 42
      for encounter themes (`GAME-DESIGN.md` §9) — a variant that fails AA
      does not ship, same rule, same enforcement mechanism, not a new one

## Definition of done
- [x] `docs/PROGRESS.md` updated
- [x] R2.3's boundary test exists and passes
- [x] Palette variants AND all seven biomes pass contrast checking, verified
      in CI not by eye
- [x] Visually confirm (screenshot two different seeded students side by
      side) that the systems look different but the underlying map is
      identical in structure
      · **DONE 7 Sep 2026.** `232129001` and `232129006` on `/app/map`, captured
        to `design/biomes/seeded-*.png`. Both render **19 nodes in identical
        order**; biomes differ (cave vs desert). The map is the curriculum and it
        did not move.
      · **AND IT FOUND A DEFECT, which is why the item existed.** Both students
        rendered `data-theme="bare-metal"` and `--accent-hue: 250`, while the
        database holds hue 37 / `blueprint` for one and hue 222 / `bare-metal`
        for the other. `lib/session.ts` reads theme and hue from **localStorage
        only**, defaulting to bare-metal/250; nothing reads `profiles.theme` or
        `profiles.accent_hue`, and the cosmetics endpoint does not return them.
        Root `CLAUDE.md` states that `profiles.accent_hue` **is** set as
        `--accent-hue` on `<html>`. It is not. Recorded as **F-40**; not fixed
        here, because it changes the base theme every student sees.
