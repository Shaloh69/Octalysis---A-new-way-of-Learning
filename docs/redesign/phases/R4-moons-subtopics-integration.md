# R4 — Moons: Subtopics Made Visible

**Goal:** wire the objective-per-stage data that already exists into the
solar system as moons, per `SOLAR-SYSTEM-SPEC.md` §1.4. This phase is
additive visualisation over real data, not a new mastery model — say so
explicitly at every step, since it's the easiest phase in this redesign to
accidentally scope-creep into "let's also change how mastery is computed."

## R4.1 — Confirm the data before building the visual
- [ ] Locate where `objectives` per stage are currently exposed to the client
      (`/app/progress` already does per-objective mastery per `PAGE-SPECS.md`
      — reuse that read path, don't build a second one)
- [ ] Confirm objective count per authored stage (Stages 00-05 per
      `STATUS.md` — 16 objectives across 6 stages at time of writing; this
      number will grow as more stages are authored, moons must scale with it,
      not assume a fixed count)

## R4.2 — Moon rendering
- [ ] Moon count per planet = objective count for that stage, computed, not
      hardcoded per stage
- [ ] Three-state visual language: dim/unlit, partial glow, full glow — same
      language as the planet itself, one level down, per §1.4
- [ ] Moon click → compact popover: objective text, mastery status, "Review
      this" link into the stage reader at that objective's anchor
- [ ] Explicitly NOT built: any new gating logic. A planet's own
      locked/available/mastered state still comes from `is_stage_unlocked()`
      and `stage_progress.mastery` exactly as before moons existed. If moon
      completion should someday gate planet completion, that's flagged as an
      open decision for the instructor (§10 of `SKILL-TREE-3D.md` already
      shows this project's pattern for "not mine to fix" decisions — use it)

## R4.3 — Planet dialog update
- [ ] Add the "N of M subtopics mastered" line per
      `SOLAR-SYSTEM-SPEC.md` §2, item 5
- [ ] Verify focus-trap, Escape-closes, background-stops-animating still hold
      with the new content in the dialog — a content addition to an existing,
      tested interaction is exactly the kind of change that silently breaks
      one of those three without anyone noticing until DESIGN-REVIEW-03 finds
      it the hard way

## R4.4 — Screen-reader equivalence
- [ ] The list-view equivalent of the map (required by
      `SKILL-TREE-3D.md` §7 already) includes objective/moon count and
      per-objective mastery per stage, not just stage-level state — this is
      `DESIGN-MANDATE-V2.md` §5's solar-system-specific gate item, verify it
      directly with a screen reader, not by reading the code

## Definition of done
- [ ] `docs/PROGRESS.md` updated
- [ ] Moons render correctly across a range of stages with different
      objective counts (test against a stage with 3 objectives and one with
      8+, don't just verify against one example)
- [ ] Zero new client-side gating logic — grep confirms it
- [ ] Screen-reader pass confirms moon data is present in the accessible
      equivalent, not just the visual one
