# R2 — Per-Student Cosmetic Seeding

**Goal:** make every student's system look like theirs, without touching
anything that determines what they can do. This phase has the tightest
boundary in the whole redesign — read `SOLAR-SYSTEM-SPEC.md` §3 again before
starting, not just once at kickoff.

## R2.1 — Build the cosmetic-seed endpoint, corrected mechanism (R0 found the original plan was unsafe)
- [ ] **Do not** derive cosmetics from `services/api/src/engine/seed.ts` or
      anything that touches `EXAM_SALT_SECRET` — that seed is
      `sha256(studentId ‖ stageId ‖ attemptNo ‖ examSalt)`, salt-bearing, and
      must never be reimplemented client-side or exposed to the browser.
      R0 caught this in the original draft of this phase; it's a hard rule
      now, not a suggestion
- [ ] Confirm how the avatar (`DESIGN-MANDATE.md` §4) actually derives its
      seed today — `student_id` alone, or something else — and match that
      pattern rather than assuming it shares code with the exam engine
- [ ] Add a new **read-only cosmetic endpoint** in `services/api` (permitted
      explicitly by `REDESIGN-CLAUDE.md` §1) that takes the authenticated
      student's `student_id`, runs it through a lightweight, non-secret hash
      (deliberately not cryptographically hardened — a guessable palette
      variant carries no stakes, unlike a guessable exam item), and returns
      `{ rotationOffset, paletteVariant, callsign, biomeIndex }`
- [ ] `cosmetic-seed.ts` on the client is a thin consumer of that endpoint's
      response — it does not compute the hash itself, it does not import
      anything from `services/api/src/engine/`, and it has zero knowledge of
      `EXAM_SALT_SECRET`'s existence

## R2.2 — What gets seeded, exhaustively (do not add to this list without
updating `SOLAR-SYSTEM-SPEC.md` §3 or `BIOME-AND-LOADING-SPEC.md` §3 first)
- [ ] **A single whole-system rotation offset** — one angle, applied equally
      to every stage's position, not a per-ring value (per-ring offsets were
      dropped in the §1.1 fix once angle started carrying real `ordinal`
      data — a global rotation can't disturb relative order or any radius,
      which is what keeps it safely cosmetic)
- [ ] Palette variant — 3-4 pre-computed, pre-contrast-checked variants per
      base theme, selected by seed
- [ ] Callsign — generated string, shown once on `/app/settings`, never used
      as an identifier
- [ ] **Landing biome** (`BIOME-AND-LOADING-SPEC.md`) — one of the seven
      biomes, same endpoint, same consumer pattern as the three items above. A
      moon inherits its parent planet's biome roll, it does not get its own
      independent one (§3 of that file, restated here so it isn't missed)

## R2.2b — Build the biomes themselves, per `BIOME-AND-LOADING-SPEC.md`
- [ ] Procedural default for all seven biomes first (§2's approach) — real
      asset packs are an optional upgrade, not required for this phase to be
      done
- [ ] Each biome variant screenshotted individually (not one representative
      example) per `REDESIGN-CLAUDE.md` §2's explicit requirement
- [ ] Each biome variant contrast-checked against every base theme it can
      appear alongside (R2.4 below extends to cover this, not a separate check)

## R2.3 — What must NOT be touched by this phase, verified explicitly
- [ ] Ring count, ring radius formula, which ring a planet or moon sits on —
      grep the diff for this phase and confirm zero changes to
      `layout.ts`'s output for any given `stages[]`/`objectives[]` input,
      regardless of `student_id`
- [ ] Moon count — derived from `objectives`, not from the cosmetic seed
- [ ] Lock state, mastery values, flight path shape — all still
      server-derived, unchanged by which student is looking at them
- [ ] The new cosmetic endpoint has zero import path to
      `services/api/src/engine/seed.ts` — grep-confirm this, don't just
      trust the code review
- [ ] Write a test that asserts this directly: two different `student_id`
      values produce identical `layout.ts` output and identical
      `is_stage_unlocked()` results, but different cosmetic-endpoint output.
      This test is the actual enforcement of the boundary — not the doc, this
      test

## R2.4 — Palette and biome contrast checking
- [ ] Every palette variant AND every biome runs through the same contrast
      check pipeline already computing 1122 pairs for the base themes and 42
      for encounter themes (`GAME-DESIGN.md` §9) — a variant that fails AA
      does not ship, same rule, same enforcement mechanism, not a new one

## Definition of done
- [ ] `docs/PROGRESS.md` updated
- [ ] R2.3's boundary test exists and passes
- [ ] Palette variants AND all seven biomes pass contrast checking, verified
      in CI not by eye
- [ ] Visually confirm (screenshot two different seeded students side by
      side) that the systems look different but the underlying map is
      identical in structure
