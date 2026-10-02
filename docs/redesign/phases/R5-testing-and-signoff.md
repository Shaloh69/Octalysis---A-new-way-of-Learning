# R5 — Testing and Sign-off

**Goal:** prove the redesign didn't regress anything `SKILL-TREE-3D.md` and
`DESIGN-MANDATE.md` already guaranteed, and that everything new is actually
tested rather than assumed. This phase closes the redesign, same spirit as
`PHASES.md`'s own exit-criteria discipline.

## R5.1 — Re-run the existing invariants against the new coordinate system
- [x] **INV-32** (map matches seed exactly) — re-verify against `layout.ts`'s
      new ring-based formula
      **2 Oct 2026, restated for R4.7-R4.9** (a planet is an ellipse in its
      level's band, moving): every stage one planet and every objective one
      moon, order-independent (`layout-solar.spec.ts` INV-32, green on the
      R4.9 layout); NEW in `R5.1`: the cosmetic seed cannot move a band, an
      axis, an eccentricity or a perihelion; each planet's whole ellipse in
      its own level's band; a student's rotation turns the moving system
      rigidly (every distance the same, at every t; watched failing with
      the rotation dropped from ω)
- [ ] **INV-33** (every edge on the map = an entry in `stages.prereq`, no
      editorializing) — re-verify against the flight-path line specifically
      **2 Oct 2026: NOT TICKED, and the reason is a finding.** There is no
      flight-path line to verify. The 30 Sep remake (`0d6828a`, ruling 2,
      Starfield's system map) deleted `FlightPath` with the old canvas and
      recorded it nowhere; `layout.ts`'s `flightPath()` is now called only
      by tests. What holds: the map draws NO edge, so it invents none, and
      the API's own INV-32/33 (`services/api/test/stages.spec.ts`: 19 nodes,
      18 edges, every edge a real prereq row) and the database's
      (`inv_33_edges_resolve`) are green. What fails is the other half,
      "every prereq entry is drawn". Restoring a line is a planned feature
      gone missing: planned and parked for the instructor (NEXT-SESSION 0za),
      not rebuilt unasked
- [x] **INV-34** (states are server-derived, never client-computed) —
      re-verify, including the new moon states from R4
      **2 Oct 2026:** `pnpm check:boundary` clean (no client-side lock or
      mastery threshold); a planet's state is the API node's `state`
      (`map/StarMap.tsx`), a moon's glow its server `mastered` flag, with
      `correct > 0` choosing only the partial glyph (`map/body.tsx`
      `moonGlow`); every R4.7-R4.9 addition is cosmetic and reads no state

## R5.2 — Re-run `SKILL-TREE-3D.md` §7's accessibility contract in full
- [ ] Keyboard-only, full map, curriculum focus order
- [ ] Every planet and moon is a real labelled control
- [ ] Screen-reader list-view equivalence, including moon data (R4.4)
- [ ] `prefers-reduced-motion` → fully static, verified by toggling
- [ ] All three base themes + palette variants (R2.4) pass WCAG AA, computed
- [ ] 380px
- [ ] WebGL disabled → map still works
- [ ] Colour never the only signal — locked/unlocked differs in shape/label
      too, restated for planets specifically (an unlit sphere vs. a dashed
      outline, not just a colour change)

## R5.3 — Performance re-check, full system
- [ ] Bundle size with everything from R1-R4 included, still ≤250 KB gz for
      the 3D chunk
- [ ] Draw calls still ≤50 with moons added
- [ ] 30fps floor re-verified on a throttled/mid-range profile with the full
      system (rings + planets + moons + flight path + starfield) rendering,
      not just the R1 skeleton

## R5.4 — The boundary tests, run one final time
- [ ] R2.3's test (different students, identical structure, different
      cosmetics) still passes
- [ ] Grep the full diff of this redesign for any reference to
      `db/schema.sql`, `is_stage_unlocked()`, or the grading service outside
      of read-only consumption — flag anything found, don't silently accept it
- [ ] Confirm the 8 encounter themes' files are untouched — `git diff` on
      `packages/tokens/encounters.css` (or wherever they live) should be empty

## R5.5 — Full page-template coverage check
- [ ] Every route from R3's checklist has a committed template screenshot
      and a passing Playwright baseline
- [ ] `npm run test:visual` (or this repo's equivalent) passes clean across
      all 44 routes

## R5.6 — Sign-off report
- [ ] Write `docs/redesign/REDESIGN-SIGNOFF.md` — what changed, what stayed
      the same (link back to `00-START-HERE.md`'s boundary table), the
      before/after screenshot comparison from R0/R1, and any open decisions
      surfaced along the way (following the "not mine to fix" pattern already
      established in this project for instructor-level calls)
- [ ] Update `docs/PROGRESS.md` to mark the redesign complete

## Definition of done
- [ ] Every checkbox above checked
- [ ] `REDESIGN-SIGNOFF.md` committed
- [ ] Nothing outside the declared scope boundary was touched, verified by
      diff, not by memory
