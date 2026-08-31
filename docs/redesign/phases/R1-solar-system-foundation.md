# R1 — Solar System Foundation

**Goal:** the deterministic layout function, the two-layer architecture, and
the base rendering — no per-student cosmetics yet, no moons yet. Get the
skeleton right and tested before adding variation on top of it.

## R1.1 — Layout function

> **This section was rewritten in R0.** It previously specified the
> *superseded* rule — "ring radius from `stages.levels`, angular position
> within the ring from `stages.act` and `ordinal`" — which
> `SOLAR-SYSTEM-SPEC.md` §1.1 had already corrected and §1.1 explicitly
> forbids (Act is off the spatial axes entirely; angle carries `ordinal`).
> An R1 session following the old text would have built the wrong coordinate
> system. **Three of R0's findings are still awaiting a ruling and they land
> in this file — see `docs/PROGRESS.md`, "Open findings". Do not start R1.1
> until they are answered.**

- [ ] `layout.ts` — pure function, `stages[] + objectives[] -> Map<stageId | objectiveId, Vec3>`,
      per `SOLAR-SYSTEM-SPEC.md` §1.1 as corrected: **moon** radius = that
      objective's own `level`; **planet** radius = the mean of its own moons'
      radii; **angle = `ordinal`**, swept once around 360° for the whole
      19-stage sequence. Act is NOT a spatial axis — it is a HUD chip and
      flight-path colour banding only
- [ ] **Handle Stage 00 explicitly.** It has zero objectives in
      `content/stages/00.md`, so it has no moons and the mean is undefined.
      This is the first planet a student ever sees; it needs a stated
      fallback, not a `NaN`
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
- [ ] DOM canonical layer at `/app/map`: real buttons per planet, focusable,
      labelled with title/state/lock-reason, unchanged mechanism from the
      galaxy, ring/planet language instead of star/node language in the copy
- [ ] WebGL presentation layer at `/app`: `aria-hidden`, `pointer-events: none`
      on the canvas, DOM overlay handles all interaction — same overlay
      technique as before, per `SKILL-TREE-3D.md` §4
- [ ] Verify: disable WebGL in the browser, confirm `/app` still works (the
      DOM layer renders regardless)
- [ ] Verify: `prefers-reduced-motion` freezes to static — every ring/planet
      at its base deterministic position, no drift

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
- [ ] Screenshot captured and compared against the "before" galaxy screenshot
      from R0 — structurally sound before moving to per-student variation
