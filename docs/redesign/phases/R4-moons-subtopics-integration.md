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
- [x] Locate where `objectives` per stage are currently exposed to the client
      (`/app/progress` already does per-objective mastery per `PAGE-SPECS.md`
      — reuse that read path, don't build a second one)
      **30 Sep 2026:** `GET /api/v1/stages` (and `/stages/:id`) carries each
      objective with its mastery (`moon_correct()`, `moon_mastered()`): one read
      path, the map's own. `/app/progress` never had per-objective mastery
- [x] Confirm objective count per authored stage (Stages 00-05 per
      `STATUS.md` — 16 objectives across 6 stages at time of writing; this
      number will grow as more stages are authored, moons must scale with it,
      not assume a fixed count)
      **Measured 30 Sep 2026:** 00: 5, 01: 5, 02: 8, 03: 11, 04: 8 (115 across
      19 stages); moons are counted from the payload, never a fixed number

## R4.2 — Moon rendering
- [x] Moon count per planet = objective count for that stage, computed, not
      hardcoded per stage — **for gradeable stages only**. Stage 00 has five
      objectives and no moons (decided 25 Sep 2026); its objectives still appear
      in its sidebar as text
- [x] Three-state visual language: dim/unlit, partial glow, full glow — same
      language as the planet itself, one level down, per §1.4
- [x] Moon select → camera zooms onto the moon and the **map sidebar updates to it**
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
- [x] Add the "N of M subtopics mastered" line per
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
- [x] Moons render correctly across a range of stages with different
      objective counts (test against a stage with 3 objectives and one with
      8+, don't just verify against one example). **30 Sep 2026:** no stage
      has 3; captured at 5 (01), 8 (02, real demo mastery) and 11 (03), at
      1440 and 380 (`design/templates/web/app/current-moons*.png`)
- [ ] Zero new client-side gating logic — grep confirms it
- [ ] Screen-reader pass confirms moon data is present in the accessible
      equivalent, not just the visual one

## R4.5 — The first release: act 1 as the full experience

Instructor decision, 25 Sep 2026: act 1 (stages 00–04) ships with moons and its
minigames, not as a bare exam. `REVAMP-PROMPTS.md` §4 owns the scope.

- [x] Moons live on **planets 00–04** first — one per objective, three-state
      glow, select-to-zoom with the sidebar updating — verified by screenshot at
      1440 and 380
      **30 Sep 2026:** planets 01-04 carry moons; 00 carries its asteroids
      instead (decided 25 Sep). `design/templates/web/app/current-moon*.png`,
      `-asteroids`, `-moons-11`, each at 1440 and 380, opened
- [x] Stage 01 encounter — Sort (DOM), through the page gate. **30 Sep 2026:**
      Two Columns on moon 01.2 (`design/templates/web/encounter-sort/`,
      `web-encounter-sort.spec.ts`, cards proven quoted by `two-columns.spec.ts`)
- [x] Stage 02 encounter — Drill (DOM), through the page gate. **30 Sep 2026:**
      Clock Bench on moon 02.8 (`design/templates/web/encounter-drill/`,
      `web-encounter-drill.spec.ts`; the book's Example 2.2 reproduced and
      quoted, `clock-bench.spec.ts`)
- [ ] Stage 03 encounter — bus wiring (Phaser), through the page gate, with a
      keyboard path and a non-canvas fallback
- [x] Stage 04 encounter — cache drill (DOM), through the page gate. **30 Sep 2026:**
      Cache Tuner on moon 04.5 (`design/templates/web/encounter-cache/`,
      `web-encounter-cache.spec.ts`). The address fields and sizes on the book's
      Example 4.2; the hit-rate meter is not built (no sourced trace)
- [x] **The Descent** (04→06, Phaser) — instructor's decision recorded: first
      release or Midterm. Its payoff lands in stage 06, which is Midterm content.
      **DECIDED 30 Sep 2026: the Midterm.** Not built with act 1
- [ ] Phaser verified absent from the initial bundle — lazy-loaded per route,
      grep `dist/index.html` for a preload, same discipline as the 3D chunk
- [x] No encounter dresses an assessment — grep confirms `data-encounter` never
      wraps the attempt runner. **30 Sep 2026:** set only in `MoonEncounterSlot`
      (a sibling of the runner) and the reader's LAB block; asserted in the
      Sort's spec

## R4.6 Moons unlock the next planet, and hold the minigames

Instructor rulings, 25 Sep 2026 (`WEB-REVAMP.md` §3.6 and §3.7). **These
supersede the R4.2 box above that says no new gating logic is built.**

- [x] **Instructor decision recorded: the moon threshold. DECIDED 25 Sep 2026:
      2 of 3.** A moon is mastered when 2 of its 3 questions have been answered
      correctly, counting the best result per question across attempts, so
      practice can raise it and nothing lowers it. A per-moon 70% bar would have
      meant a perfect score on every subtopic
- [x] **Instructor decision recorded: stage 00's moons. DECIDED 25 Sep 2026:
      Orientation has no moons.** It gets purely cosmetic asteroids instead
      (below). Because a planet with no moons has nothing to master, **a
      non-gradeable prerequisite never blocks** — which is what resolves
      decision 3a: stage 01 is open from the start
- [x] **Stage 00's asteroids** — a small belt orbiting Orientation, purely
      cosmetic: seeded per student (never `Math.random`), so the same student
      sees the same belt every session; irregular, grey and unlit so no one
      mistakes them for moons; `aria-hidden`, not focusable, not selectable,
      absent from the flat map and the sidebar; frozen under `QA_MODE`, still
      under `prefers-reduced-motion`; Keplerian like everything else
- [x] **`is_stage_unlocked()`: a non-gradeable prerequisite never blocks.**
      Server-side, denial test first — including the test that a student still
      cannot open stage 02 without stage 01's moons. This is independent of the
      rest of moon gating and can land first, which removes one of the two
      non-design Prelim blockers on its own. **Done 30 Sep 2026:** `rls.spec.ts`
      §3.7 (nine tests, watched failing), `stages.spec.ts`. Until moons gate,
      "without stage 01's moons" reads "without stage 01 at 70%"; the moon form
      of that test lands with the box below that makes moons gate
- [x] **Instructor decisions recorded: where moon mastery lives
      (`WEB-REVAMP.md` §3.7a). DECIDED 30 Sep 2026:** (1) a correct answer on a
      moon journey **or** a stage check counts toward its moon, a final never;
      (2) a moon's journey is **practice**, not a hard-rule-9 paper; (3) a moon
      with no `live` question is **fail-closed**: its planet does not open the
      next, and the lock reason says so
- [x] Objective mastery stored server-side, written only by the grading
      service, RLS'd like `stage_progress`, with its denial tests written and
      watched failing first. **Done 30 Sep 2026:** `objective_progress` in
      `addendum-audit.sql` (idempotent), written by `recordAnswer()` in one
      transaction with the response. `rls.spec.ts` §3.7a (eleven tests) watched
      red three ways: no table (11), no protections (7 write denials), RLS alone
      off (B reads A); `attempts.spec.ts` (three, two red before the write)
- [x] `is_stage_unlocked()` opens the next planet when every moon of its
      prerequisite is mastered. Server-side only (hard rule 4); the client
      renders the result and the `lockReason` names the moons still missing.
      **Done 30 Sep 2026:** step 4 reads `moon_mastered()`; a gradeable
      prerequisite with no moons, or a moon with no live question, holds it
      shut (fail-closed). `moons.spec.ts` (denials watched red against the 70%
      rule: 02 shut at 100% stage mastery; an unwritten moon; a voided attempt;
      an empty planet), `rls.spec.ts`, `stages.spec.ts`. The demo cohort earns
      its moons through real answers (`db/demo-moons.sql`); its lock picture
      is unchanged, measured: 0 of 399 student-stage pairs differ
- [x] A moon's ENTER JOURNEY opens practice on that objective's own questions
      **30 Sep 2026:** `POST /api/v1/objectives/:id/journey` (`journeys.spec.ts`)
      and `/app/stage/:id/moon/:objectiveId` (`web-moon-journey.spec.ts`,
      `design/templates/web/moon-journey/`)
- [x] **Minigame placement on moons approved** (`WEB-REVAMP.md` §3.6).
      **APPROVED 30 Sep 2026, all four:** 01.2 Two Columns (Sort), 02.8 Clock
      Bench (Drill), 03.9 Bus Contention (Phaser), 04.5 Cache Tuner. Each is
      built on its moon through the page gate by the R4.5 boxes above
- [x] Biome seeded **per planet** (student and stage), cosmetic only, shown as
      the sidebar background; a moon uses its planet's biome. **SUPERSEDED 30
      Sep 2026 (instructor):** ruling 2 keeps the map's panels on the one star
      HUD. The per-planet biome is seeded (`/api/v1/cosmetics`
      `planetBiomes`) and dresses everything after Enter journey, the moon's
      journey included, which is where it belongs

