# R1 — Solar System Foundation

**Goal:** the deterministic layout function, the two-layer architecture, and
the base rendering — no per-student cosmetics yet, no moons yet. Get the
skeleton right and tested before adding variation on top of it.

## R1.1 — Layout function

> **This section was rewritten in R0, and its four open questions were ruled
> on 1 September 2026.** It previously specified the *superseded* rule —
> "ring radius from `stages.levels`, angular position within the ring from
> `stages.act` and `ordinal`" — which `SOLAR-SYSTEM-SPEC.md` §1.1 had already
> corrected and explicitly forbids (Act is off the spatial axes entirely;
> angle carries `ordinal`). An R1 session following the old text would have
> built the wrong coordinate system.
>
> **Rulings now folded in below: F-1 mean-of-moons with an explicit Stage 00
> fallback · F-2 occupancy-proportional ring spacing · F-3 a ~300° sweep, not
> a full turn · F-4 Stage 01 keeps its all-levels rendering.** Rationale and
> the measured numbers behind each are in `docs/PROGRESS.md`. R1.1 is
> unblocked.

- [ ] `layout.ts` — pure function, `stages[] + objectives[] -> Map<stageId | objectiveId, Vec3>`.
      **Moon** ring = that objective's own `level`. **Planet** ring = the mean
      of its own moons' rings (**F-1**). Act is NOT a spatial axis — it is a
      HUD chip and flight-path colour banding only
- [ ] **F-1 · Stage 00 fallback, stated not improvised.** Stage 00 has zero
      objectives, so its mean is undefined. **Rule: a stage with no objectives
      falls back to `Math.min(...stages.levels)`**, which puts Stage 00 on ring
      6 — the same ring the current map already gives it. Write it as a named
      branch with a comment, not a trailing default, and unit-test it by name.
      Expect it to stay a one-stage special case: every other stage has
      objectives, and all of them are level-unanimous
- [ ] **F-3 · angle sweeps ~300°, not 360°.** `ordinal` maps across roughly
      five-sixths of a turn, leaving a visible gap between Stage 18 and Stage
      00. At a full turn they land ~19° apart and the map draws a closed ring
      around a curriculum that is a chain with no forks and no return — the one
      thing the shape must not say. Unit-test that the angular gap between the
      first and last stage is the largest gap in the sequence
- [ ] **F-2 · ring radii are spaced by occupancy, not evenly.** Measured: L1
      carries 7 of 19 planets and 43 of 110 moons, while L4 and L5 carry
      nothing. Even steps put 39% of the bodies on the second-smallest
      circumference. Allocate each ring's radial step from how loaded it is, so
      arc length per body is roughly comparable. **Both invariants still hold
      and must both be tested:** radius stays strictly monotonic in level, and
      radius is identical for every student. `DESIGN-MANDATE-V2.md` §1B now
      states the rule this obeys — ordering is data, spacing is typography
- [ ] **F-4 · Stage 01 keeps its all-levels rendering.** It declares
      `{0,1,2,3,4,5,6}` and the current map draws it as a column crossing every
      stratum (`layout.ts:66`, `spansAllLevels`). Its objectives are all level
      6, so mean-of-moons alone would collapse it to a point on the outermost
      ring and lose the fact that this stage is *about* the hierarchy. Preserve
      it — a radial spoke or a ring-crossing band — and keep the
      `spansAllLevels` flag on the node. It is now the only such stage: the
      existing comment naming 06 and 11 is stale from the superseded curriculum
- [ ] Unit test: every stage in the seed has a position; every position maps
      to a seeded stage (INV-32, restated for the new coordinate system —
      same invariant, same test shape, new formula inside it)
- [ ] Unit test: **every objective in `content/stages/` has a moon position,
      and every moon maps back to a seeded objective** — INV-32 extended one
      level down. 110 moons; the count is asserted, not assumed
- [ ] Unit test: **moon-to-planet aggregation** — a planet sits at the mean
      of its own moons and nowhere else. This is the new contract and the old
      per-stage position test does not cover it
- [ ] Unit test: ring radius is monotonic in level — L0 always closer to
      centre than L1, etc. — this is the one property that must never
      regress, since it's the whole "depth = distance from sun" claim
- [ ] Unit test: **no radius depends on the cosmetic seed.** §1.1's hard rule
      — the per-student offset rotates the whole system by one angle and
      touches nothing else. Assert two different seeds produce identical radii

## R1.2 — Two-layer architecture

> **F-5 ruled: 3D is the default on capable devices, and it degrades IN PLACE.
> Nothing redirects.** `VISUAL-SYSTEM-3D.md` §5's automatic degradation ladder
> owns this behaviour. `CLAUDE.md`, `GAME-DESIGN.md` §2.1, `SKILL-TREE-3D.md`
> §4 and `PAGE-SPECS.md` §2 all describe a redirect and become pointers to §5.
>
> R0 measured what the code does today, in all four viewport × motion
> combinations: `/app` → `/app`, `canvas=0`, every time. Degrade-in-place is
> already built and is the half that was right. **The half that must change is
> the default:** 3D sits behind `localStorage` key `octa:map-mode`, which
> defaults to flat, so no student sees a canvas unless they find the toggle.
> Left alone, that makes the whole solar system invisible by default.

- [ ] **Make 3D the default on capable devices.** Remove the default-off
      behaviour; keep the preference as a real override. The degradation ladder
      still decides capability — reduced motion, ≤640px, absent WebGL, a
      measured sub-30fps run, and Save-Data all still fall back to flat, in
      place, silently, per `VISUAL-SYSTEM-3D.md` §5
- [ ] **`/app` and `/app/map` stay the same component**, `flat` prop and all.
      That was a good decision and this ruling keeps it. `/app/map` remains a
      first-class route reached by choice, never a degraded mode
- [ ] DOM canonical layer: real buttons per planet, focusable, labelled with
      title/state/lock-reason, ring/planet language instead of star/node
      language in the copy
- [ ] WebGL presentation layer: `aria-hidden`, `pointer-events: none` on the
      canvas, DOM overlay handles all interaction — same overlay technique as
      before, per `SKILL-TREE-3D.md` §4
- [ ] Verify: disable WebGL in the browser, confirm `/app` still works. **This
      check was vacuous before** — no canvas rendered by default, so it passed
      without proving anything. It only becomes meaningful once 3D is on
- [ ] Verify: `prefers-reduced-motion` freezes to static — every ring and planet
      at its base deterministic position, no drift. Use
      `page.emulateMedia({ reducedMotion })`, **not**
      `test.use({ reducedMotion })`, which silently does nothing in this repo:
      R0 lost half a capture matrix to it, and
      `design/specs/before-baseline.spec.ts` now asserts the emulation applied
- [ ] Turn R0's recorded matrix into hard assertions now that the rules are
      settled — landing path, canvas presence and toggle presence, per
      viewport × motion. `design/before-r0/README.md` holds the "before" table
- [ ] **Docs housekeeping this ruling creates:** edit the four documents above
      so they point at `VISUAL-SYSTEM-3D.md` §5 rather than each restating a
      redirect rule that is not what the app does. One owner per fact — the
      same medicine `DESIGN-REVIEW-01.md` step 3 prescribes

## R1.3 — Base rendering
- [ ] Sun at the center (procedural material, not a texture — see
      `SOLAR-SYSTEM-SPEC.md` §4.1)
- [ ] Seven ring outlines, unlabelled until Stage 11 per §1.2
- [ ] 19 planets, positioned via `layout.ts`, illuminated/dim per
      `is_stage_unlocked()` and `stage_progress.mastery` — read-only, never
      computed client-side
- [ ] Flight path: one traced line through curriculum order, per §1.3,
      draw-progress reflecting actual student advancement
- [ ] Background starfield, instanced `<Points>`, per existing budget (≤3,000
      points, one draw call)
- [ ] Camera: `OrbitControls` from drei, focus-on-select animation per
      `GAME-DESIGN.md` §6.1's requirement, reference behavior from
      `SOLAR-SYSTEM-SPEC.md` §4's cited builds

## R1.4 — Performance check
- [ ] Bundle size of the whole 3D chunk, gzipped, checked against the ≤250 KB
      budget — before adding cosmetics or moons, so you know the headroom
      remaining for R2/R4
- [ ] Draw call count checked against ≤50
- [ ] `frameloop="demand"` confirmed — canvas stops rendering when idle or tab
      hidden
- [ ] Frame rate on a throttled/mid-range profile (Chrome DevTools CPU
      throttling as a stand-in if a real mid-range Android device isn't
      available) checked against the 30fps floor

## Definition of done
- [ ] `docs/PROGRESS.md` updated
- [ ] Both layers render correctly, WebGL-disabled and reduced-motion paths
      verified by actually toggling them
- [ ] Layout unit tests passing, INV-32-equivalent holds
- [ ] Performance budget checked and under budget with headroom noted for R2/R4
      — bundle size and draw calls
- [ ] **FRAME RATE measured on a throttled / mid-range profile, against the
      30fps floor. Its own line, on purpose.**

      This is separated from the budget item above because bundling the two is
      exactly how it kept getting skipped: "performance budget checked" was
      ticked twice — R1 and again after R2 — on the strength of bundle size and
      draw-call reasoning alone, while the frame rate was never measured once.
      Bundle size is not frame rate. They are different claims with different
      failure modes, and the audience is on mid-range Android
      (`GAME-LAYER.md` §2, `MASTER-PLAN.md` §13), which is precisely where
      a 220 KB chunk can load fine and still render at 12fps.

      Record the number in `docs/PROGRESS.md`'s "Performance numbers" section.
      A range or a caveat is fine; leaving it blank is not.
- [ ] Screenshot captured and compared against the "before" galaxy screenshot
      from R0 — structurally sound before moving to per-student variation
