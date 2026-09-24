# R4 — Moons: Subtopics Made Visible

**Goal:** wire the objective-per-stage data that already exists into the
solar system as moons, per `SOLAR-SYSTEM-SPEC.md` §1.4. This phase is
additive visualisation over real data, not a new mastery model — say so
explicitly at every step, since it's the easiest phase in this redesign to
accidentally scope-creep into "let's also change how mastery is computed."

> **Depends on `WEB-REVAMP.md` §3.** A moon is only meaningful once selecting a
> planet and zooming to it exists to reveal one. Do not start R4 until route 4
> of `WEB-REVAMP.md` §6 is green; moons rendered on a map nobody can zoom into
> are decoration, and decoration is what this project deletes.
>
> Moons follow the same Kepler relationship locally around their planet
> (`WEB-REVAMP.md` §4), animated only while their planet is selected.

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
- [ ] Moon select → camera zooms onto the moon and the **map sidebar updates to it**
      (`WEB-REVAMP.md` §3.2) — objective, mastery in words, back-to-planet, and
      ENTER JOURNEY into the stage at that subtopic. This replaces the earlier
      compact popover (objective text, mastery, a "Review this" link), which is
      no longer built
- ~~SUPERSEDED 25 Sep 2026 by R4.6: moons now DO gate the next planet.~~
      Kept for the reasoning: explicitly NOT built: any new gating logic. A planet's own
      locked/available/mastered state still comes from `is_stage_unlocked()`
      and `stage_progress.mastery` exactly as before moons existed. If moon
      completion should someday gate planet completion, that's flagged as an
      open decision for the instructor (§10 of `SKILL-TREE-3D.md` already
      shows this project's pattern for "not mine to fix" decisions — use it)

## R4.3 — Planet sidebar (was: planet dialog update)

> The dialog became a sidebar on 25 Sep 2026 (`WEB-REVAMP.md` §3.1). The
> "N of M subtopics mastered" line below lands in the sidebar.
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

## R4.5 — The first release: act 1 as the full experience

Instructor decision, 25 Sep 2026: act 1 (stages 00–04) ships with moons and its
minigames, not as a bare exam. `REVAMP-PROMPTS.md` §4 owns the scope.

- [ ] Moons live on **planets 00–04** first — one per objective, three-state
      glow, select-to-zoom with the sidebar updating — verified by screenshot at
      1440 and 380
- [ ] Stage 01 encounter — Sort (DOM), through the page gate
- [ ] Stage 02 encounter — Drill (DOM), through the page gate
- [ ] Stage 03 encounter — bus wiring (Phaser), through the page gate, with a
      keyboard path and a non-canvas fallback
- [ ] Stage 04 encounter — cache drill (DOM), through the page gate
- [ ] **The Descent** (04→06, Phaser) — instructor's decision recorded: first
      release or Midterm. Its payoff lands in stage 06, which is Midterm content
- [ ] Phaser verified absent from the initial bundle — lazy-loaded per route,
      grep `dist/index.html` for a preload, same discipline as the 3D chunk
- [ ] No encounter dresses an assessment — grep confirms `data-encounter` never
      wraps the attempt runner

## R4.6 Moons unlock the next planet, and hold the minigames

Instructor rulings, 25 Sep 2026 (`WEB-REVAMP.md` §3.6 and §3.7). **These
supersede the R4.2 box above that says no new gating logic is built.**

- [ ] **Instructor decision recorded: the moon threshold.** Every act-1 moon has
      3 questions, so a per-moon 70% bar means a perfect score on every
      subtopic. Proposed: 2 of 3 correct, best result per question across
      attempts
- [ ] **Instructor decision recorded: stage 00's moons.** 5 moons, 0 questions,
      so under moon gating stage 01 never opens. Proposed: Orientation has no
      moons
- [ ] Objective mastery stored server-side, written only by the grading
      service, RLS'd like `stage_progress`, with its denial tests written and
      watched failing first
- [ ] `is_stage_unlocked()` opens the next planet when every moon of its
      prerequisite is mastered. Server-side only (hard rule 4); the client
      renders the result and the `lockReason` names the moons still missing
- [ ] A moon's ENTER JOURNEY opens practice on that objective's own questions
- [ ] **Minigame placement on moons approved** (`WEB-REVAMP.md` §3.6), then each
      minigame built on its moon through the page gate
- [ ] Biome seeded **per planet** (student and stage), cosmetic only, shown as
      the sidebar background; a moon uses its planet's biome

