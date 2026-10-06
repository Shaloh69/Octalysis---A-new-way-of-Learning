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
- [x] **INV-33** (every edge on the map = an entry in `stages.prereq`, no
      editorializing) — re-verify against the flight-path line specifically
      **6 Oct 2026: SETTLED by instructor ruling (asked once): change the
      text, not the map.** The map draws no edge and invents none; Orientation
      no longer claims "every connection on it is a real prerequisite" (it now
      says a planet opens once its chapters are mastered, and a locked one names
      them: `map/body.tsx` prints the lock reason). Synced to the deployment.
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

**Re-run 7 Oct 2026** against the built app (preview :5185, reseeded):
`web-app.spec.ts` + `web-app-look.spec.ts` **68 passed, 18 skipped** (the
one-width behaviour tests), at 1440 and 380, two workers. Three tests added
for the lines nothing asserted in §7's own words ("the accessibility
contract (R5.2)").

- [x] Keyboard-only, full map, curriculum focus order
      **7 Oct:** from the top of the page Tab alone reaches the row at Stage
      00; the arrows then walk 01 → 18 in order (each opens its planet); the
      row's DOM order is the curriculum's. Gate 3: every control reachable,
      each moon and the moon panel included
- [x] Every planet and moon is a real labelled control
      **7 Oct:** 19 radios named "Stage NN · title, state[, your next
      stage]"; each moon a button with its id, objective and mastery in
      words (the R4.4 ARIA snapshot); a locked one's reason verbatim
- [ ] Screen-reader list-view equivalence, including moon data (R4.4)
      **7 Oct: still open, and the instructor's**: R4.4 rules it needs a
      person with a screen reader. The automated half is green (the
      accessibility tree carries every planet, its state, its moons and
      their mastery). Gap recorded: a stage's prerequisites are named in
      text only where they gate (a locked planet's server reason); an open
      planet's are not listed. The map draws no edge (INV-33 ruling, 6 Oct),
      so the list says no less than the picture
- [x] `prefers-reduced-motion` → fully static, verified by toggling
      **7 Oct:** toggled LIVE on one page (reduce → no-preference →
      reduce): `data-motion` still → orbit → still. Pixel-for-pixel
      stillness with a moon open was already asserted (R4.3)
- [x] All three base themes + palette variants (R2.4) pass WCAG AA, computed
      **7 Oct, restated:** apps/web has no base themes since ruling 2 (30
      Sep; the console keeps them and is not the map). Its sets (star HUD,
      seven biomes, the paper) are AA-swept over every accent hue by
      `packages/tokens/test/looks.spec.ts` (38 passed this session), and
      gate 4 computes AA on the map's panels, locked and open planets and
      moons included
- [x] 380px
      **7 Oct:** every test above runs at 380 too; gates 1-2 (nothing
      clipped, no sideways scroll) green there
- [x] WebGL disabled → map still works
      **7 Oct, disabled for real** (Chromium `--disable-3d-apis
      --disable-webgl`, the browser offering no webgl2), not stubbed: no
      canvas, the one-line notice, all 19 planets in the row, a planet
      chosen by keyboard opens its panel; captured at 1440 and 380 and
      looked at. The spec's own test stubs getContext and also passes
- [x] Colour never the only signal — locked/unlocked differs in shape/label
      too, restated for planets specifically (an unlit sphere vs. a dashed
      outline, not just a colour change)
      **7 Oct:** asserted on computed style: every locked planet's dot is a
      DASHED outline and its name says "locked"; no open one is dashed or
      says it; the key names the shape. In the picture a locked planet is
      its surface unlit (`--locked`, glow 0.02 vs 0.12)

## R5.3 — Performance re-check, full system
- [x] Bundle size with everything from R1-R4 included, still ≤250 KB gz for
      the 3D chunk
      **5 Oct 2026:** map chunk `StarMapScene` 226.6 KB gz with R4.7-R4.9
      and the merges (was 224.8 before R4.8); entry 109.6 KB gz; lazy
- [x] Draw calls still ≤50 with moons added
      **5 Oct 2026:** measured at the GL (`design/specs/web-app-perf.spec.ts`,
      every draw entry point wrapped, counted per frame): R4.8 left 89 for
      the whole system. Merged: the 19 orbit ellipses into one
      `LineSegments`, the 7 bands into one single-pass mesh (transparent
      double-sided rings were drawing twice each), the 7 centaurs into one
      `InstancedMesh`, the faint and bright rings single-pass. Now **43-44
      whole system, 36-37 a giant chosen, 43-44 eleven moons**, at 1440 and
      380; the spec asserts ≤50 on all six. `web-app.spec.ts` 54 passed, the
      capture unchanged
- [x] 30fps floor re-verified on a throttled/mid-range profile with the full
      system (rings + planets + moons + flight path + starfield) rendering,
      not just the R1 skeleton
      **7 Oct 2026:** `web-app-perf.spec.ts` "the 30 fps floor": Chrome's 4x
      CPU slowdown (Lighthouse mid-tier mobile), the whole system and the
      eleven-moon planet, frames counted at the GL over 5 s after the guard's
      window: **60 fps (the vsync cap), full quality, at 1440 and 380**, on
      the RTX 3050 through ANGLE D3D11. Margin: 57.5 fps at 8x; **24.1 at 16x
      with the guard's lower quality on**, which cuts GPU cost and so cannot
      rescue a CPU-bound device (a finding, not a failure of the floor). The
      default headless renderer, SwiftShader, gave ~27 fps with NO slowdown,
      so it measures itself, not the map: the test now runs on the hardware
      GPU and SKIPS, saying why, where only software GL exists. NOT measured:
      a real phone's GPU, which this laptop's flatters. (No flight path
      exists to render: R5.1's INV-33 note.)

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
