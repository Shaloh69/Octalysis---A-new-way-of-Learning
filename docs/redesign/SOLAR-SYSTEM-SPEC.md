# SOLAR-SYSTEM-SPEC.md — The Galaxy, Redone as a Solar System
### Supersedes the spatial concept in `SKILL-TREE-3D.md` and `GAME-DESIGN.md` §2-4. Everything else in those files — the two-layer accessibility architecture, the performance budget, the stack choice, the invariants — carries over and is restated here, not reinvented.

> **Revised twice. Read the second banner too.**
>
> **R0 ruling, 1 September 2026 — four corrections, all measured against the
> live database, all now binding:**
>
> | # | Correction | Where |
> |---|---|---|
> | **F-1** | A stage with **no objectives** falls back to `Math.min(...stages.levels)`. Stage 00 has zero objectives, so "mean of its moons" was undefined for the first planet a student ever sees | §1.1 |
> | **F-2** | Ring radii are spaced by **occupancy**, not evenly. L1 carries 7 of 19 planets and 43 of 110 moons; even steps put 39% of the bodies on the second-smallest circumference | §1.1 |
> | **F-3** | Angle sweeps **~300°, not 360°**. At a full turn Stage 18 lands ~19° from Stage 00 and the map draws a closed ring around a chain that has no return | §1.1 |
> | **F-4** | **Stage 01 keeps its all-levels rendering.** Its objectives are all level 6, so mean-of-moons alone would collapse the one stage that is *about* the hierarchy into a point on the outermost ring | §1.1 |
>
> Two claims below did not survive the same review and are corrected in place:
> §1.1's promise that a stage's moons would "visibly spread across the rings it
> actually touches" **cannot happen in this course** (every stage's objectives
> are level-unanimous), and §1.3's ring sequence silently assumed a Stage 00
> value the rule never defined and counts **13** crossings where there are
> **12**. The SQL behind every number is in `docs/PROGRESS.md`.
>
> **Revised after R0's real-data review.** The R0 read against
> `db/schema.sql`, `content/stages/`, and `services/api/src/engine/seed.ts`
> found four spec bugs and one factual error about the seed mechanism in the
> version of this file that shipped before real data was checked against it.
> §1.1, §1.3, §2, §3, and §5 below are corrected. Nothing in §0, §1.2, §1.4,
> or §4 changed — those held up against the review. If you're reading this
> after building against an earlier draft, the ring-radius formula,
> angle formula, lock-reason UI, cosmetic-seed source, and moon draw-call
> budget all moved — re-read this file in full, don't diff it in your head.

---

## 0. Why redo the galaxy at all, and what has to survive the redo

`SKILL-TREE-3D.md` §2 already passes the design mandate's hardest test — every
axis encodes real data, nothing is decoration. That's the bar this redo has to
clear too, not just match on looks. The galaxy's one weakness, honestly: an
abstract vertical axis inside a starfield asks a first-time user to *learn*
that "up" means "closer to the user, further from the metal" before it means
anything. A solar system gets the same fact for free, because **"closer to the
center" already means "closer to the core" in everyday language** — nobody
has to be taught that the sun is the middle.

**What must survive from `SKILL-TREE-3D.md` unchanged, because it's correct
independent of theme:**
- §1 — the tree *is* the curriculum, `stages.prereq` is the only edge list, nothing is authored twice
- §1.2 — **19 nodes, 18 edges, one linear chain, no forks.** The instructor teaches straight down the syllabus. A solar system reframing must not imply branching paths — moons don't fork the chain, they sit inside one planet
- §3 — no force-directed layout. Positions are a deterministic pure function of stage data, computed once, unit-tested
- §4 — the two-layer architecture: DOM canonical layer (real buttons, focusable, always at `/app/map`), WebGL presentation layer (`aria-hidden`, the default at `/app`). If WebGL fails, is disabled, or the viewport is ≤640px, the DOM map still works, unchanged
- §6 — the performance budget: ≤250 KB gz for the whole 3D chunk, lazy-loaded, ≤50 draw calls, `frameloop="demand"`, 30fps floor on mid-range Android, hard fallback to 2D below the floor
- §7 — the accessibility contract, verbatim
- §9 — invariants INV-32/33/34 (map matches the seed exactly, states are server-derived, never client-computed)
- `GAME-DESIGN.md` §3.2's stack decision — pin nodes via `fx/fy/fz`, use `react-force-graph-3d` for picking/camera-easing only, not for layout

**What's new:** the coordinate system, what a "node" looks like, what sits
between stages, and how per-student variation gets layered on without
touching any of the above.

---

## 1. The coordinate system

### 1.1 Orbit radius and angle — corrected after checking real data

**The version of this section that shipped before R0 was broken, and here's
why, stated plainly:** it said orbit radius = `stages.levels`, "mapped
exactly as it previously mapped to a Y coordinate." But `stages.levels` is an
array — ten of nineteen stages declare two or more levels, Stage 01 declares
all seven — and a planet has exactly one radius. The spec never said how the
array collapses to one number, and R0's check of the real seed showed that no
collapse rule produces a good result: two of seven rings end up completely
empty (L4, L5 — genuinely no content lands there in this syllabus), and the
crowding is inverted from what the geometry wants — the second-smallest ring
by circumference (L1) would carry over a third of both planets and moons.

**The fix: stop trying to give a multi-level stage one radius by fiat. Derive
radius from moons, which — unlike stages — have exactly one level each,
unambiguously, in real data** (every objective in `content/stages/` carries
a single level, unanimous within a stage). This isn't a workaround, it's more
honest than the original rule:

- **Moon radius** = that objective's own `level`, real data, one ring, no
  collapse needed
- **Planet radius** = the mean of its own moons' radii — a computed
  statistic, not an assumption. A stage that's entirely one level sits
  exactly on that ring.

  **What this bullet used to promise, and why it can't deliver it:** it said a
  multi-level stage would sit at its moons' center of mass "with its own moons
  visibly spread across the rings it actually touches." R0 checked all 19
  chapters. **Every stage's objectives declare a single, unanimous level** — so
  no planet's moons span more than one ring, no planet ever sits between rings,
  and the mean always lands exactly on a ring. The spread this rule was
  designed to render does not exist in this course's data. The rule is kept
  because it is the honest way to compute the number and stays correct if a
  future chapter ever does span levels — but it is no longer claimed as an
  improvement on the old single-coordinate galaxy, because on this data the two
  produce the same answer.

- **A stage with no objectives falls back to `Math.min(...stages.levels)`
  (F-1).** Stage 00 is the only one — zero objectives, so no moons and no
  mean. The fallback puts it on ring 6, which is where the existing map already
  places it. Write it as a named branch with a comment, not a trailing default
  that hides the case.
- **Ring SPACING is proportional to occupancy (F-2), and so is ring weight.**
  The original rule kept radii at fixed, evenly-spaced steps and varied only
  stroke width and opacity. Measured, that fails the very thing it set out to
  fix: L1 ends up carrying **7 of 19 planets and 43 of 110 moons — 39% of
  everything — on the second-smallest circumference**, which is the same
  crowding inversion §1.1 was written to correct. So the radial *step* is
  allocated from each ring's load, giving crowded rings more circumference to
  spread across. **Two things this may never break, both unit-tested:** radius
  stays strictly monotonic in level (L0 always innermost), and radius is
  identical for every student. `DESIGN-MANDATE-V2.md` §1B states the principle
  — *ordering is data, spacing is typography*. Stroke width and opacity still
  scale with occupancy too. A ring with nothing
  on it (L4, L5, honestly, for this syllabus) renders as a thin, dim
  baseline circle — present for the Computer Level Hierarchy's sake, not
  pretending to be occupied. Don't force content onto an empty ring to make
  the composition symmetric; an empty ring is true information (this course
  doesn't spend time at that level), same as an empty section of the old
  galaxy's horizontal strata

**Angle stops being Act.** With radius now spent on level, Act has nowhere
principled left to live spatially — R0 caught this too: Act-as-angle-within-
ring was about to become an arbitrary formula once critical-path position
moved onto the flight path, and an arbitrary formula is decoration, which
`SKILL-TREE-3D.md` §2's bar exists to prevent. **Angle instead = `ordinal`,
swept across ~300° — NOT a full turn (F-3)** — Stage 00 near the top, Stage 18
about five-sixths of the way round, with a deliberate, visible gap between
them. The original rule said "once around the full 360°", which puts Stage 18
roughly 19° from Stage 00 and draws a closed ring — and a closed ring says the
curriculum returns to its start. It does not: 19 nodes, 18 edges, one chain, no
forks, no return (§0). The gap is the part that tells the truth, so it has to
be wide enough to read as one. This is real data doing
real work (the same role radius played for critical-path position in the old
galaxy, now that radius is spoken for), and it has a direct payoff for §1.3
below: since angle now moves smoothly and predictably with curriculum order,
the flight path becomes a legible spiral instead of a shape that jumps
around in both axes at once.

**Act is still real, still shown — just not spatially.** It moves to the
Act chip in the planet HUD (§2) and to a simple color-coding on the flight
path itself (four color bands along the spiral, one per Act) — visible, not
lost, just no longer forced into an angle that had nothing left to encode.

Updated table:

| Old (galaxy) | New (solar system), corrected |
|---|---|
| Y (height) = Computer Level | **Orbit radius** = Computer Level. **Moons: their own objective's real level.** Planets: the mean of their own moons' levels, falling back to `min(stages.levels)` when a stage has no objectives (F-1). Ring *spacing* is allocated by occupancy, not even steps (F-2) |
| Spiral arm (θ) = Act | **Angle** = `ordinal`, swept across **~300°, not a full turn** (F-3), leaving a visible gap between the last stage and the first. Act moves to a HUD chip + flight-path color banding, not a spatial axis |
| Radius (r) = critical-path position | **The flight path** (§1.3) — now a spiral, since angle already carries ordinal order |
| Node brightness = mastery | Planet surface glow / lit hemisphere = mastery, 0 → 1 |
| Node lit/dark = unlocked/locked | Planet illuminated vs. dim/unformed; locked = dashed orbit outline, no body |
| Halo = accent hue | Ring tint = accent hue |

**The sun is the machine itself** — not a specific chapter, the destination
the whole course is descending toward. This is the same idea `SKILL-TREE-3D.md`
§2 already states ("the galaxy is the Depth Gauge with a third dimension
added") — the solar system version makes it literal instead of abstract:
**you are flying toward the hardware, and the hardware is the sun.**

**Stage 01 still renders as crossing every stratum (F-4).** It declares
`{0,1,2,3,4,5,6}` in `stages.levels`, and the existing map already draws it as a
column crossing all seven — the honest rendering of a stage that is *about* the
hierarchy rather than sitting in it. Its objectives are all level 6, so
mean-of-moons alone would quietly collapse it to a point on the outermost ring
and lose that. Keep the `spansAllLevels` flag and render it as a radial spoke or
ring-crossing band. **It is the only such stage** — the code comment naming 06
and 11 describes the superseded curriculum.

Seven concentric rings, L0 through L6, radius increasing outward, step size
allocated by occupancy per F-2 above. `layout.ts`'s pure function maps `stages[]` + each stage's
`objectives[]` to a `Map<stageId | objectiveId, Vec3>` — a genuinely bigger
contract than the old "one node per stage" version, and R1's unit tests need
to cover the new moon-to-planet aggregation specifically (see R1.1's
updated checklist), not just re-run the old per-stage position test.

**One rule that must not get patched back in later, because R0 flagged
exactly this temptation: radius is fixed per ring, never phase-dependent.**
No elliptical orbits, no "radius wobbles with orbital phase for visual
interest" — if radius ever varies with the cosmetic phase offset (§3), a
seeded per-student value has leaked into the semantic depth encoding, which
breaks both the "nothing here is decoration" bar and the "frozen must be as
legible as moving" accessibility rule (§5). Cosmetic phase offset rotates
the *entire system* by one fixed angle per student — every stage's angle
shifts by the same amount, so relative ordering and all radii stay exactly
what the data says, always.

### 1.2 Stage 11's reveal, preserved exactly

`SKILL-TREE-3D.md` §2 is explicit that the Y axis is unlabelled until Stage 11,
ten weeks in, when the student learns what they've been descending toward. The
solar system keeps this **exactly** — rings are visually present from Stage 00
(a student can see there are concentric orbits) but **unlabelled** until Stage
11's Bring-Up names them: *"You've been flying inward the whole time. This is
how far down you've gone."* Don't add ring labels earlier for the sake of a
prettier first screenshot — the withholding is the design, same as the
Register Bar and Depth Gauge.

### 1.3 The flight path — the honest shape, not the pretty one

**The version of this section that shipped before R0 was built on the wrong
curriculum.** It quoted `SKILL-TREE-3D.md` §2.1's ASCII diagram — "dives to
L0 at Stage 10, climbs back to L1 for Stages 13 and 17" — as a "better story
in a solar system than it ever was in a galaxy." That diagram carries its own
`COURSE CHANGED` banner. Under the real 18-chapter seed, Stage 10 is
*Instruction Sets: Characteristics* at level 2, not L0 — the actual L0 stages
are 05, 09, and 17. The dive-and-climb story doesn't happen. R0 computed the
real ring sequence from `db/schema.sql`: **00→18 moves
`(00: no objectives — F-1 places it on 6), 6,2,1,2,0,3,1,3,0,2,2,1,1,1,1,1,0,3`**
— **12** ring crossings and 9 direction reversals across 18 edges. (This
sequence originally opened `6,6,…`, quietly assuming a Stage 00 value the rule
never defined, and counted 13 crossings. Recomputed from the live `objectives`
table; the SQL is in `docs/PROGRESS.md`.) That's not a dive and a partial climb, it's a real
back-and-forth across most of the depth range, repeatedly.

**The honest version is still a good story, it's just a different one.**
With angle now carrying `ordinal` (§1.1's fix), this sequence doesn't render
as a scribble jumping across the whole canvas — angle sweeps steadily
forward, one direction, the whole way around, while radius genuinely swings
in and out as the real levels dictate. The shape that produces is a
**spiral that dives and surfaces as it sweeps** — closer to a corkscrew than
either a smooth descent or a random tangle. That's an accurate picture of
what a 14-week systems course actually does: it doesn't march monotonically
toward the hardware, it keeps returning to concepts at different depths as
the material demands it. That's worth saying to a student directly, once,
probably at the Stage 11 reveal alongside the ring labels: *"Notice it
doesn't go straight down. Neither does learning this."*

**One shape fact the original text missed, and it is the awkward one:** stages
**12 through 16 are five consecutive ordinals all on ring L1**, carrying 26
moons between them. Whatever else the path does, its last third does not
corkscrew — it runs flat along a single ring. F-2's occupancy spacing is what
makes that stretch legible instead of a pile-up. Do not also try to fix it by
nudging any of those five off L1: that would be adjusting data to suit a
picture, which is the one move this whole section exists to forbid.

**What this means for rendering, concretely, since 12 crossings in 18 edges
is genuinely a lot of line for the eye to track:**
- Render the path with a depth-based opacity/color gradient along its
  length (older segments dimmer, the current position brightest) rather
  than one flat-opacity line — the full 19-stage path is a lot to parse at
  once, and a student is only ever standing at one point on it
- The path renders **behind** planets and moons (lower render order, or a
  slight z-offset) so it reads as context, not clutter, when it happens to
  pass near a body it isn't connecting to
- Default to showing only the **traveled portion plus the next unlocked
  stage** at full opacity; the remaining future path fades to near-invisible
  until reached — this is also an honest "don't spoil the shape of what's
  ahead" move, consistent with the Stage 11 reveal's own withholding logic
- Four-color banding by Act (since Act moved off the angle axis in §1.1)
  gives a second, independent way to read progress along the spiral without
  adding a new spatial dimension

This is one line, one `<Line>` from drei, points computed from the same
deterministic layout function — no change to that part of the original
plan, only to what shape it actually turns out to draw and how it's styled
for legibility once drawn.

### 1.4 Moons — where the "more subtopics" ask lives

Each stage already has `objectives` (per-stage, already tracked — `/app/progress`
does per-objective mastery today). **A moon is one objective, rendered
orbiting its planet.** A planet's own state (locked/available/in
progress/mastered) is still driven by `is_stage_unlocked()` and
`stage_progress.mastery` exactly as before — moons are a **visualisation of
data that already exists**, not a new mastery model, and not a new gate. If a
future decision wants moons to individually gate the planet's own completion,
that's a curriculum-policy change and belongs in a review of
`is_stage_unlocked()`, not silently implied by adding orbiting spheres.

- **Moon count = objective count for that stage — real data now confirmed:
  110 moons across the 18 authored/seeded chapters, unevenly distributed
  (Stage 03 alone has 11).** The old draft's "~5 average" was an estimate
  made before the real seed was checked; §5's performance budget below is
  rebuilt around the actual 110, not the estimate
- Moon state: dim/unlit = not yet attempted, partial glow = attempted not
  mastered, full glow = mastered — same three-state visual language as the
  planet itself, applied one level down
- Clicking a moon opens a compact popover: objective text, mastery status, a
  "Review this" link into the stage reader at that objective's anchor — reuses
  the exact link `/app/stage/:id/results/:attemptId` already sends a student
  to for a weak objective (`PAGE-SPECS.md` §2, results page)
- **Moons do not get their own star-dialog-equivalent modal.** A moon is a
  glance-level detail, not a destination — opening a stage is still done by
  clicking the planet, per §2 below

---

## 2. Approach and land — the planet dialog redone as signs, corrected after R0

Revised after seeing the current flat map's word density in practice (a real
screenshot, not a hypothetical) — the fix belongs here, at the 3D layer,
**not** by trimming `/app/map`, which is supposed to spell everything out in
full sentences for the users who rely on it (§4 below still applies
unchanged: the DOM layer's text is the accessibility contract, not a rough
draft of this dialog).

**R0 caught a real regression in the first version of this section, and it's
fixed here, not softened.** The first draft moved the lock reason to a
hover/focus tooltip on the padlock icon. Three separate documents already
require it printed: `DESIGN-MANDATE.md` §1 ("Every lock states its reason
and the distance"), `SKILL-TREE-3D.md` §4 ("the DOM layer must still say why
in words" — and the padlock dialog is not the DOM layer's job to cover for),
and `PAGE-SPECS.md` §5 ("Always name the reason and the current distance").
The mandate itself calls a lock with no visible reason "the single most
demotivating UI element in ed-tech" — hiding it behind hover was exactly
that mistake, made new. It also had no story for touch devices between
641px and 1024px, which stay on `/app` (not redirected to `/app/map`) and
have no hover at all — those students would have gotten a padlock and
nothing else. **Fixed: the lock reason is always printed, in text, next to
the icon. The icon adds a fast visual read; it never gates the words.**

**The interaction:** click a planet → camera flies to it, easing per
`GAME-DESIGN.md` §3.2's already-decided `cameraPosition(..., duration)` →
a compact **HUD ring** appears around the planet, not a modal wall of text.

| Old star dialog (text, 7 items) | New planet HUD (signs), corrected |
|---|---|
| "Act I — Languages & Abstraction" | A small colour-coded **Act chip**, one word or a roman numeral — now the primary place Act shows up spatially at all, since §1.1's fix moved Act off the angle axis |
| "State: Locked" | An **icon** — padlock / pulsing ring / checkmark — plus the state named in one word right beside it, always visible, not hover-only |
| The lock reason, as a sentence | **Printed, always, next to the padlock icon** — "Unlocks when Stage 09 reaches 70%. You're at 45%." Not a tooltip. The icon is additive, not a gate on the words |
| "N of M subtopics mastered" | **Orbiting dots around the planet itself** — lit = mastered, dim = not yet. Count is visible at a glance without opening anything; hovering/focusing a dot surfaces its one-line objective text (a moon's own text, not the lock reason, is the one thing that's fine to keep progressive — it's supplementary detail, not the single most-needed fact on a locked planet) |
| "What you will actually do" (a paragraph) | A **small pictogram** matching the stage's encounter theme, sitting *beside* one still-printed summary line from `stages.summary` — the pictogram speeds recognition, it doesn't replace the sentence |
| Prerequisites, named, each a link | A **thin traced line back along the flight path** to the prerequisite planet, visually, **plus the prerequisite still named in text** in the HUD (a line alone fails a screen reader and fails anyone who can't easily trace a thin line across a busy scene) |
| Primary action | One button: **"Enter"** — or nothing at all if locked, since the padlock icon plus the printed reason already say there's nothing to enter yet |

**What doesn't change:** focus-trap, Escape closes, background stops
animating while open, themed per the stage's encounter theme (`GAME-DESIGN.md`
§9, untouched) — same requirements as the old star dialog. What changed from
the original redo: icons and dots now sit **alongside** printed text as a
faster visual read, not **instead of** it. That's the actual fix for the
word-density complaint that started this section — cut the paragraph-length
prose down to compact labels and pictograms everywhere it's safe to, and
leave the two or three facts (state, lock reason, prerequisites) that are
genuinely load-bearing printed in full, always.

**Accessibility position, restated correctly:** every fact is in text, by
default, not deferred to hover — this is not a progressive-disclosure
pattern, it's signs *augmenting* required text, which is the actual
difference between this version and the one R0 caught. `/app/map`'s DOM
layer keeps printing everything in full sentences as before, and now the 3D
HUD does too for the facts that matter most, just more compactly laid out.

---

## 3. Per-student cosmetic seeding — corrected after R0's security check

`DESIGN-MANDATE.md` §4 seeds the avatar from `student_id` directly. The
draft of this section before R0 claimed cosmetics could reuse "the same
generator already used for exam papers" — **that claim was wrong, and it
wasn't a harmless simplification.** R0 read the real code
(`services/api/src/engine/seed.ts:27`): the attempt seed is
`sha256(studentId ‖ stageId ‖ attemptNo ‖ examSalt)` — it embeds
`EXAM_SALT_SECRET`, lives server-side in `services/api`, and is never meant
to reach a browser. If a cosmetic value were derived from that seed and
computed client-side, the browser would be shipped a value computed from the
salt — and with the hash construction public (it's in this very doc now),
that's a bruteforce oracle against the secret. **Deriving cosmetics from
`student_id` alone is fine and was always the actual intent — the mistake
was describing it as sharing a mechanism with the exam engine, which it
must not.**

**Seeded, cosmetic only:**
- **A single whole-system rotation offset** — not per-ring, one fixed angle
  applied to every stage's position equally, so no two students' systems
  look identically oriented at a glance. A single global offset can't
  disturb relative ordering or any radius, which is what keeps it safely
  cosmetic even after §1.1's fix moved real ordinal data onto the angle axis
- Planet texture/palette variant within the student's chosen theme (e.g. three
  or four palette variants per base theme, picked by seed) — never breaks
  WCAG AA, since variants are pre-computed and contrast-checked the same way
  the three base themes already are (`DESIGN-MANDATE.md` §5.1)
- A generated system callsign — something like a registry name, mono type,
  shown once on `/app/settings`, cosmetic only, **not used as an identifier
  anywhere it could collide with a real one**
- A landing biome index (`BIOME-AND-LOADING-SPEC.md`)

**Never seeded, never varies:** ring count, ring radius, which ring a planet
or moon sits on, moon count (that's `objectives`, real data), the flight
path, lock logic, mastery thresholds, or anything in
`stages`/`stage_progress`. If it would change what two students can *do*
rather than what their session *looks like*, it does not go through this
seed — see `00-START-HERE.md`'s closing section, this is the same boundary
restated with the concrete list.

**Implementation, corrected:** derive all cosmetic values from `student_id`
alone, via a lightweight, non-secret-bearing hash — this is deliberately
**not** cryptographically hardened the way the exam seed is, because a
guessable cosmetic (someone figuring out your planet's palette variant)
carries no stakes, unlike a guessable exam configuration. Compute it
**server-side, behind a new read-only endpoint** (`REDESIGN-CLAUDE.md` §1
already permits exactly this kind of addition) rather than shipping any
derivation logic to the client — not because the value is sensitive, but
because the endpoint boundary keeps `services/api/src/engine/seed.ts`
untouched and un-imported-from, which is the actual scope-boundary win here.
This is a new, small, clearly-scoped consumer of `student_id` — not a
second PRNG in the sense of competing with the exam engine's algorithm, and
not a shared code path with it either.

---

## 4. Stack, reference builds, and what to take from each

Same libraries as `SKILL-TREE-3D.md` §5 — do not introduce a second 3D
library or a second physics/orbit math approach because a tutorial used one.
Below are real, verified builds using this exact stack, for the layout and
interaction patterns specifically (not for texture assets — see §5).

| Source | Link | Take |
|---|---|---|
| **r3f-solar-system** (jjteoh-thewebdev) | https://github.com/jjteoh-thewebdev/r3f-solar-system | Built explicitly as an *educational* R3F solar system — closest genre match. Take the click-a-body → detail-panel interaction pattern for the planet dialog |
| **Solar_System** (osamakashif) | https://github.com/osamakashif/Solar_System · live: https://osamakashif.github.io/Solar_System/ | States plainly that orbit *speeds* are relative/realistic while *distances* are compressed for legibility — exactly the move this spec makes (rings encode level, not real astronomical distance). Read the README's reasoning, it's the same argument this file is making |
| **3D-Solar-System** (Vaibhavii3) | https://github.com/Vaibhavii3/3D-Solar-System | Dynamic camera transitions focusing on a selected body, at varying orbit speeds — the reference for the "camera focus animation on select, dim non-neighbours" requirement carried over from `GAME-DESIGN.md` §6.1 |
| **Chris Waitt — Interactive Solar System** | https://cwaitt.dev/projects/solar-system | Click a planet → zoom in → detail overlay. Closest published reference for the planet-dialog *transition*, not its content |
| **Build 3D Apps with React: Animated Solar System** (Medium, Dilum) | https://medium.com/geekculture/build-3d-apps-with-react-animated-solar-system-part-1-c4c394a8574c | Step-by-step base scene setup (`Canvas`, camera, lights, `OrbitControls` from drei) — use as the "how do I even start the file" reference, not for final structure |
| **Supabase interactive constellation** (already cited, `GAME-DESIGN.md` §4.1) | https://supabase.com/blog/interactive-constellation-threejs-react-three-fiber | Still the source for the background star field behind the rings — the solar system sits inside a starfield, it doesn't replace it |

**What to leave from all of the above:** every one of these renders
*astronomically inspired* orbits — real relative speeds, real-ish textures,
a "wow" camera intro. None of them encode curriculum data, and none of them
should be copied wholesale. Same rule `DESIGN-REFERENCES.md`'s header states
for the console templates: **take the layout and the interaction mechanics,
leave the identity.**

### 4.1 Textures and sprites — procedural default, real Kenney sources if not

Don't source planet textures from any of the astronomy demos above without
checking their license individually — `markshenouda/Solar-System` (seen
during research) uses Solar System Scope's textures under **CC BY 4.0**,
which requires attribution; that's a real constraint if reused, credit it on
`/about` same as every other asset. Simpler and consistent with `GAME-DESIGN.md`
§9's own reasoning for the encounter themes ("NO ASSET PACKS... four tokens plus
a gradient"): **prefer procedural materials** (`meshStandardMaterial` with a
flat colour + roughness/metalness per theme-tinted ring, no photographic
textures) over downloaded planet textures. It keeps bundle size inside the
existing ≤250 KB budget and needs no license file.

**If procedural ends up looking too plain and real sprites/models are
wanted, three concrete Kenney sources — same supplier already trusted for
audio, all CC0, no attribution required (though appreciated):**

| Need | Pack | Link | Format |
|---|---|---|---|
| 2D planet sprites, for the flat map or a lighter-weight 3D billboard approach | **Planets** | https://kenney-assets.itch.io/planets | 50+ PNG sprites, mix-and-match, `kenney_planets.zip` — direct download link visible on the page, no click-through gate |
| Full 3D planet/station models, if going past billboards | **Space Kit** | https://kenney-assets.itch.io/space-kit | 150+ models, OBJ/FBX/DAE/STL/glTF |
| A themed HUD chrome for the planet dialog (§2) instead of building panel/border CSS from scratch | **UI Pack — Sci-Fi** | https://kenney.nl/assets/ui-pack-sci-fi (mirror: https://kenney-assets.itch.io if the primary site's download button misbehaves — some users report it opening a donation prompt instead of downloading; the itch.io mirror is more consistently direct) | 130 PNG sprites + vector source |

**Still default to procedural first and treat these as an upgrade, not a
requirement** — same rule as the encounter themes and the biomes. If any of
these get vendored, they go through the same license-credit pipeline as
Kenney's existing audio assets on `/about`, and the same
`REDESIGN-CLAUDE.md` permission-scoping applies to actually fetching them
(see that file's new asset-download section).

---

## 5. Performance and accessibility — the budget, corrected to include moons

Carried forward from `SKILL-TREE-3D.md` §6-7, with solar-system-specific
notes where the shape genuinely changes the numbers.

**R0 caught a real omission here: the original budget arithmetic — "19
planets + 18 flight-path segments + 7 ring outlines + one instanced
starfield" — never included the 110 moons, which are the entire reason this
redesign exists (the "more subtopics" ask). Fixed below with a real
level-of-detail strategy, not just a bigger number.**

**The LOD rule:** moons don't need individual pickable geometry until a
student is actually looking at their planet. Two tiers:
- **Unfocused (the default view of the whole system):** all 110 moons render
  as **one instanced mesh** — same technique already planned for the
  starfield, one draw call, dim/lit/mastered state carried per-instance via
  an attribute buffer, not individual raycast targets. At this zoom level a
  moon is a dot, not yet an interactive object
- **Focused (a planet's HUD is open, per §2):** only *that planet's* moons
  — at most 11, per the real Stage 03 count — get individual pickable
  colliders and hover popovers. Every other planet's moons stay in the
  instanced tier. The pickable set is bounded by "moons on one stage," never
  "moons in the whole course"

| Budget | Limit | Solar-system note, corrected |
|---|---|---|
| Added JS, gzipped | ≤ 250 KB total | Procedural materials (§4.1) keep this achievable without texture downloads |
| Draw calls | ≤ 50 | 19 planet draws + 7 ring draws + 1 flight-path line + 1 instanced starfield + **1 instanced moon mesh (all 110, unfocused tier)** + up to **11 individual moon overlays** for whichever single planet is currently focused ≈ high 30s at worst, verify against the real number once built, don't assume the estimate holds without measuring |
| Orbiting motion | Ambient only, `frameloop="demand"` when idle | Planets (and moons, in their instanced tier) may drift continuously **only** as ambient decoration — `prefers-reduced-motion` freezes every body at its deterministic base position. Orbit angle is never load-bearing information; a frozen system must be exactly as legible as a moving one, which is also why §1.1 forbids radius ever depending on this motion |
| WebGL unavailable / reduced motion / ≤640px | Fall back to `/app/map` | Unchanged. The flat map's content changes to match §1-2 (ring/planet/moon language instead of star/node language) but the *mechanism* — DOM canonical layer, always present — does not change at all. The flat map's moon list doesn't need a LOD tier at all — it's a real list, not a rendered scene, so all 110 just render as list items grouped under their stage |

All of §7's accessibility contract checklist items apply verbatim, plus one
addition specific to moons:

- [ ] Screen-reader list view (already required for the whole map) includes
      each stage's objective/moon count and mastery-per-objective, not just
      the stage-level state
- [ ] **New:** the focused-tier pickable-moon transition (instanced dot →
      individually pickable body) doesn't change what a screen reader
      announces — the DOM layer's list was never tiered in the first place,
      so this is a WebGL-presentation-layer-only concern, verify it stays
      that way rather than assuming it
