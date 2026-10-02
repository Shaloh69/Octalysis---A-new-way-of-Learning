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
- [x] Verify focus-trap, Escape-closes, background-stops-animating still hold
      with the new content in the dialog — a content addition to an existing,
      tested interaction is exactly the kind of change that silently breaks
      one of those three without anyone noticing until DESIGN-REVIEW-03 finds
      it the hard way.
      **1 Oct 2026, with a moon's content in the panel** (`web-app.spec.ts`,
      "R4.3"): the panel is a labelled **region**, never a modal (no
      `role=dialog`, no `aria-modal`), so focus-trap is moot and asserted the
      other way: Tab leaves the panel. Escape steps out moon, then planet.
      Under reduced motion the map is pixel-identical across 0.9 s with the moon
      open, and the positive control (no reduced motion) is not

## R4.4 — Screen-reader equivalence
- [ ] The list-view equivalent of the map (required by
      `SKILL-TREE-3D.md` §7 already) includes objective/moon count and
      per-objective mastery per stage, not just stage-level state — this is
      `DESIGN-MANDATE-V2.md` §5's solar-system-specific gate item, verify it
      directly with a screen reader, not by reading the code.
      **Open, and the instructor's (a person with a screen reader).** The build
      half is done, 1 Oct 2026: the ACCESSIBILITY TREE (not the DOM text)
      carries the planet's "N of M subtopics mastered" and every moon as a
      button named with its id, objective and mastery in words
      (`web-app.spec.ts`, "R4.4", an ARIA snapshot, watched failing on wrong
      mastery words); `/app/stages` carries each planet's state and the
      server's lock reason. For the pass: on `/app/stages` each radio's label
      also appears as a separate text node, so a virtual cursor may read each
      planet twice

## Definition of done
- [x] `docs/PROGRESS.md` updated. **1 Oct 2026:** STATE NOW's R4 row, counted
- [x] Moons render correctly across a range of stages with different
      objective counts (test against a stage with 3 objectives and one with
      8+, don't just verify against one example). **30 Sep 2026:** no stage
      has 3; captured at 5 (01), 8 (02, real demo mastery) and 11 (03), at
      1440 and 380 (`design/templates/web/app/current-moons*.png`)
- [x] Zero new client-side gating logic — grep confirms it.
      **1 Oct 2026**, grep of `apps/web/src` for thresholds, lock and mastery
      assignments, reviewed hit by hit: every one renders a server fact
      (`state`, `lockReason`, `mastered`, `correct`, `questions` from `GET
      /stages`). The one conditional that withholds a control, the moon panel's
      Enter (`StarMap.tsx`, planet locked or no live question), is refused by the
      server on its own: `journeys.spec.ts`'s two DENIAL tests. The encounters
      gate nothing
- [ ] Screen-reader pass confirms moon data is present in the accessible
      equivalent, not just the visual one. **The instructor's**: the tree is
      asserted (R4.4 above); a person must still listen to it

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
- [x] Stage 03 encounter — bus wiring (Phaser), through the page gate, with a
      keyboard path and a non-canvas fallback. **1 Oct 2026:** Bus Contention on
      moon 03.9 (`design/templates/web/encounter-bus/`,
      `web-encounter-bus.spec.ts`, 38/38 at 1440 and 380). Every control is DOM,
      the spec runs the whole encounter from the keyboard; with the scene's chunk
      aborted the same bus is drawn in the DOM. Every sentence quoted from
      ch. 3 §3.3-3.5 (`bus-contention.spec.ts`, watched failing)
- [x] Stage 04 encounter — cache drill (DOM), through the page gate. **30 Sep 2026:**
      Cache Tuner on moon 04.5 (`design/templates/web/encounter-cache/`,
      `web-encounter-cache.spec.ts`). The address fields and sizes on the book's
      Example 4.2; the hit-rate meter is not built (no sourced trace)
- [x] **The Descent** (04→06, Phaser) — instructor's decision recorded: first
      release or Midterm. Its payoff lands in stage 06, which is Midterm content.
      **DECIDED 30 Sep 2026: the Midterm.** Not built with act 1
- [x] Phaser verified absent from the initial bundle — lazy-loaded per route,
      grep `dist/index.html` for a preload, same discipline as the 3D chunk.
      **1 Oct 2026:** Phaser 3.90 rides only in `bus-scene` (341.8 KB gz),
      reached only through `BusContention` (5.4 KB gz) on moon 03.9.
      `dist/index.html` names neither; the entry chunk has no Phaser; moon 03.10
      fetches neither. All asserted in `web-encounter-bus.spec.ts`
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

## R4.7 — A realistic system (instructor rulings, 1 Oct 2026)

The instructor asked for a realistic solar system (host star, elliptical
orbits, one dominant planet per orbit, moons within the Hill sphere and
outside the Roche limit, a frost line, belts, centaurs, comets, the
interplanetary medium). Three parts collided with rulings already built, and
were decided 1 Oct 2026: **gentle ellipses** (the level is the orbit a planet
follows, not its distance at an instant); **a level becomes a band** of
single-planet orbits; **the frost line decides a globe's look** (the biome
still dresses the planet's pages). Everything here is cosmetic over the same
data: no lock, mastery or moon count moves (SOLAR-SYSTEM-SPEC §3).
The instructor's text is kept as a source: `docs/source/solar-system-brief.md`.

- [x] **Gentle ellipses**, low eccentricity, Kepler's second law (faster at
      perihelion, slower at aphelion), no orbit leaving its level's band;
      unit-tested (equal areas in equal times, perihelion faster than
      aphelion, every point of every orbit inside its band); still under
      reduced motion
      **2 Oct 2026:** `solar-system/kepler.ts` (`kepler.spec.ts`: Kepler's
      equation, perihelion/aphelion, equal areas, the speed ratio (1+e)/(1-e),
      T² ∝ a³, the start angle; watched failing with the star off-focus);
      `layout-solar.spec.ts` R4.7 (e ≤ 0.12, inside its band). Still under
      reduced motion (`web-app.spec.ts` R4.3, pixel-still)
- [x] **One planet per orbit; a level is a labelled band** of neighbouring
      orbits, so distance still reads as level; stage 01 stays its spoke
      **2 Oct 2026:** bands sized by their planets, one semi-major axis each,
      no two ellipses' distance ranges overlapping (`layout-solar.spec.ts`).
      **Shaded, not labelled in the canvas:** the level is named in words in
      the planet panel (LEVELS) and on the arrival screen; a canvas label
      would be a second copy no screen reader can read
- [x] **The frost line**, drawn; globes rocky inside it, gas and ice giants
      outside, still seeded per student
      **2 Oct 2026:** dashed, in the gap between L2 and L3 (`layout.frost`);
      `world.ts` picks the globe (`world.spec.ts`, every seed)
- [x] **Moons inside their planet's Hill sphere and outside its Roche limit**,
      and rings inside the Roche limit; unit-tested
      **2 Oct 2026:** `satellites.ts`, a real mass model and Hill radius, one
      200x magnification for every moon system (the map is not to scale);
      `layout-solar.spec.ts` checks every moon of every planet over five
      student seeds, rings inside Roche, the star over 99%; watched failing
      at 60x
- [x] **The populations**: an inner asteroid belt, centaurs among the giants,
      a Kuiper belt and an Oort cloud of comets (a coma and a tail near the
      star), dust and the solar wind. `aria-hidden`, unselectable, seeded,
      still under reduced motion, never mistaken for a planet or a moon, and
      inside the map chunk's budget on a phone
      **2 Oct 2026:** `populations.ts` (`populations.spec.ts`, 9 tests,
      watched failing first) and `map/Leftovers.tsx`, all `raycast`-empty,
      on the scene's one clock; the map chunk grew 1.3 KB gz
- [x] **Through `/app`'s page gate**: template captured, SPEC and motion
      updated, `web-app.spec.ts` green at 1440 and 380, captures opened
      **2 Oct 2026:** `template-inner.png`, `template-outer.png` (NASA-derived,
      public domain), SPEC/SOURCE/motion updated, `web-app.spec.ts` 50 passed
      at 1440 and 380 (10 one-width skips), captures `current-realism*`
      opened


## R4.8 — The rest of the brief (instructor, 2 Oct 2026: "implement them for the next session")

The instructor re-sent the solar-system brief (`docs/source/solar-system-brief.md`)
on 2 Oct and asked for it in the next session. R4.7 already built most of it
(`f1c14ca`). Compared line by line, five things the brief names are NOT built.
Each is specified here, so the next session builds rather than guesses. All
cosmetic over the same data, `aria-hidden`, unpickable, seeded never random,
still under reduced motion, through `/app`'s page gate:

- [ ] **Lagrange companions**: "a massive planet paired with a smaller
      companion tucked 60 degrees ahead or behind it in a stable Lagrange
      point". Built as **Trojan swarms**: a small cloud at L4 (+60°) and L5
      (-60°) of each giant beyond the frost line, riding its orbit (the
      template already captured: `design/templates/web/app/template-inner.png`,
      Jupiter's Trojans and Greeks). NOT a second planet: every planet on the
      map is a stage, and a companion planet would be a stage that does not
      exist. Tested: each swarm's centre is 60° from its planet, on its orbit,
      at every t
- [ ] **Moons, the full range**: "from massive spheroidal worlds with
      subsurface oceans to tiny, captured irregularly-shaped asteroids". A
      giant's outermost moons drawn as small irregular captured bodies, the
      rest spheres; seeded per student. A moon stays a moon: same button in
      the panel, same three glow states legible, same pick target
- [ ] **Planetary rings beyond Saturn**: faint rings on the other giants
      (Jupiter-like, Uranus-like, Neptune-like worlds), every ring inside its
      planet's Roche limit (`satellites.ts`'s `ringSpan`, already tested)
- [ ] **Magnetic fields** (the interplanetary medium: "cosmic dust, solar
      wind ... and magnetic fields"): the star's field as faint Parker-spiral
      lines winding outward with the solar wind, one draw call
- [ ] **The host star's mass dictates speed and distance**: make it explicit.
      Periods from T = 2π√(a³/GM) with one star-mass constant, instead of
      scaling to the outermost orbit; tested that a heavier star turns every
      orbit faster in the same ratio, and that the map's speeds are unchanged
      at the chosen mass
- [ ] **Through `/app`'s page gate**, and the draw-call budget measured with
      all of it (`renderer.info.render.calls`; R5.3's ≤50): Trojans and the
      field lines as merged geometry, never a mesh each

## R4.9 — Scale, spacing and the comets (instructor, 2 Oct 2026, for the next session)

Asked after R4.7's captures: "make the comets move away from the map, also at a
much slower speed" (clarified the same day: **stay out at the edges**), "make
the map a tad bit bigger, smaller planets, a wider orbit with enough space
that they don't overlap with each other", "also a bigger sun". Cosmetic, the
same data; through `/app`'s page gate with captures at 1440 and 380, opened.

- [ ] **Comets stay out at the edges, much slower.** Drop the comets' 40x
      clock (`map/Leftovers.tsx`): they move at their real Kepler speed, so
      by the second law they spend almost all their time far out. Start each
      near aphelion (t = 0), in the Kuiper/Oort region beyond the last band.
      Tested (`populations.spec.ts` / `kepler.spec.ts`): every comet starts
      beyond the last band, and spends at least 90% of its period beyond the
      frost line; its coma and tail still appear only when it swings in
- [ ] **Smaller planets**: the drawn planet sizes shrink (`planetSize` in
      `satellites.ts`), moon systems with them; the Hill/Roche tests still pass
- [ ] **Wider orbits, and no two planets ever overlap**: `ORBIT_GAP` widened
      (`layout.ts`) until a new test holds: over a full outer period, sampled,
      the distance between every pair of planets' centres stays above the sum
      of their drawn radii plus a margin (the moving positions from
      `kepler.ts`, not just the semi-major axes); the band, frost-line and
      ellipse tests still pass
- [ ] **The map a tad bigger on screen**: the system fills more of the free
      area (the camera's fit margin in `Rig`, now 1.08), still with no part of
      the outer band clipped at 1440 or 380
- [ ] **A bigger sun**: the star drawn larger (`Sun` in `StarMapScene.tsx`),
      its corona included, still clear of the innermost band
      (`INNER_RADIUS` moves with it if needed); tested that the sun's drawn
      radius stays inside the innermost band's inner edge
- [ ] **Through `/app`'s page gate**: `web-app.spec.ts` green at 1440 and
      380, `current-realism*` recaptured and opened, before and after side by
      side in the SPEC
