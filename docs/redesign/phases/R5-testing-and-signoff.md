# R5 — Testing and Sign-off

**Goal:** prove the redesign didn't regress anything `SKILL-TREE-3D.md` and
`DESIGN-MANDATE.md` already guaranteed, and that everything new is actually
tested rather than assumed. This phase closes the redesign, same spirit as
`PHASES.md`'s own exit-criteria discipline.

## R5.1 — Re-run the existing invariants against the new coordinate system
- [ ] **INV-32** (map matches seed exactly) — re-verify against `layout.ts`'s
      new ring-based formula
- [ ] **INV-33** (every edge on the map = an entry in `stages.prereq`, no
      editorializing) — re-verify against the flight-path line specifically
- [ ] **INV-34** (states are server-derived, never client-computed) —
      re-verify, including the new moon states from R4

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
