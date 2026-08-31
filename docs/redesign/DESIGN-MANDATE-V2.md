# DESIGN-MANDATE-V2.md — The Game-Facing Half, Redone
### `DESIGN-MANDATE.md` §1 (the four control tests) and §5.1 (the universal per-page checklist) are correctness rules and carry over verbatim — restated in §5 below so this file is complete on its own, not because they changed. What's actually redone is §1B (the gaming mandate) and §4 (the avatar system, extended). §2 (introductions/first-run) and §3 (animation spec) are inherited unchanged and referenced, not copied.

---

## 1. The mandate — unchanged

> A control exists only if pressing it changes what the student knows, can do,
> or can see. If it only changes a number, delete it.

Consequence, Legibility, Reversibility, Teaching. Same four tests,
`DESIGN-MANDATE.md` §1, in full force over every new solar-system control.
Applied fresh to what's new in this redesign:

- ✅ **Clicking a planet** — real consequence (opens the stage dialog), legible
  (a planet reads as "a thing you enter," same affordance a star already had)
- ✅ **Clicking a moon** — consequence (opens objective detail + review link),
  legible at a glance once the pattern is learned once
- ❌ **A moon that only shows a checkmark with no link back into content** —
  fails Teaching. If it doesn't connect to the actual material, it's a badge,
  and this project doesn't do badges (§1B below)
- ❌ **A "fly to the sun" cinematic with no destination** — fails Consequence.
  Motion without a state change is decoration, same rule that killed confetti

## 1B. The gaming mandate — redone for the solar system

`GAME-DESIGN.md` §1 already settled the genre question: **gameful design, not
gamification** — Zachtronics-adjacent, not Duolingo-adjacent. No XP, no
currency, no global leaderboard. The solar system reframing does not reopen
that decision; it's a coordinate system, not a genre change. What's restated
here is how the five rules from the old mandate apply to rings, planets, and
moons specifically.

### The rule that makes a solar system honest, not decorative

`DESIGN-MANDATE.md`'s old §1B rule 2 said: *a skin must say something true.*
The solar system passes this the same way the galaxy did, restated:

> **Distance from the sun is depth into the machine. That is not a metaphor
> layered on top of the data — the Computer Level Hierarchy already is a
> depth measure, and which ring a body sits on is that measure, unchanged,
> read differently.**

Stated precisely, because R0 found this rule written against a formula
`SOLAR-SYSTEM-SPEC.md` §1.1 had already replaced (it said "orbit radius is
`stages.levels`", which stopped being true when planet radius moved to the
mean of its moons' levels):

- **Which ring a body sits on is data, and is never adjusted.** A moon's ring
  is its objective's own `level`; a planet's is the mean of its moons'. If
  that assignment is ever nudged for composition, the system has become
  decoration and needs rebuilding honest, not patching.
- **How far apart the rings are drawn is a rendering constant**, chosen once
  and identical for every student. Changing the radial step — evenly spaced,
  or spaced by how crowded each ring actually is — changes legibility, not
  meaning, and does not break this rule so long as radius stays strictly
  monotonic in level and identical across students.

The line between those two is the whole rule: **ordering is data, spacing is
typography.**

### The five rules, restated for rings/planets/moons

1. **Theatre dresses the practice, never the assessment.** The planet dialog
   and the LAB/DRILL/REMIX/BUILD beat may use the stage's encounter theme
   (`GAME-DESIGN.md` §9, unchanged). The Self-Test, same as before, is never
   themed — flat, calm, identical surface regardless of which planet it's
   attached to.
2. **A skin must say something true.** See above — this is the test the
   whole redesign has to pass, restated as the mandate's own rule rather than
   left implicit.
3. **Spectacle capped at one moment per stage.** The Bring-Up stays exactly
   as specified — 2000ms, once, `--dur-bringup`. A planet "coming online" at
   Bring-Up is the same moment the old spec called a subsystem fading in; the
   solar system doesn't add a second celebration for "entering orbit" or
   similar — that would be the confetti-per-question mistake at a different
   scale.
4. **The game layer may never be the only carrier of meaning.** Every fact
   the solar system expresses — level, act, lock state, mastery, objective
   count — exists in text on `/app/map` and in the planet/moon dialogs. A
   ring with no label in the flat map would violate this; the flat map's
   text equivalents are not optional set-dressing, they're the actual
   accessibility contract (`SOLAR-SYSTEM-SPEC.md` §5).
5. **A playful mechanic is safe when its verb is the objective's verb.**
   Unchanged rule, restated because it's the test a future "should moons be
   collectible" idea needs to pass: a moon that must be *mastered* (verb:
   understand) is content. A moon that must be *collected* (verb: acquire) is
   a seductive detail and fails this test — see `GAME-DESIGN.md` §8.3 for the
   research behind why that distinction isn't pedantic.

### What this explicitly does not authorise — unchanged, restated in full

Streaks that punish · hearts or lives · timers on anything graded · loot boxes
or random rewards attached to grades · a mascot with a face · confetti per
question · sound effects on failure. **Add to this list, specific to the
solar-system redesign:** no "exploration currency" for visiting planets, no
achievement badge for "completing a system," no leaderboard of whose system
has the most mastered planets. Every one of these is the XP counter in a new
shape, and the old mandate already explained why OCTA has none.

## 2. Introductions — inherited, one addition

`DESIGN-MANDATE.md` §2's table stands. One row added, following its own
pattern exactly (introduce once, ungraded, at first use):

| Element | Introduced at | Form |
|---|---|---|
| Moons | Stage 01 — **corrected in R0** | A one-line callout the first time a planet with moons is opened: "Each subtopic in a stage is a moon. Master it, and it lights up." Never repeated afterwards |

**Why this moved off Stage 00.** The row above originally read "the
orientation stage's single objective renders as one moon." R0 checked
`content/stages/00.md`: **Stage 00 has zero objectives**, so it has no moons
and there is nothing there to introduce them with. Stage 01 is the first
planet that has any (five). Introducing moons on a planet that has none would
have been an introduction to an absence.

This leaves a real question that is not a design detail and is **not mine to
fix** — same treatment as `SKILL-TREE-3D.md` §10: *should Stage 00 have
objectives at all?* It is `gradeable=false` orientation, so zero may be
entirely correct and the map should simply render it as a moonless planet.
But every other planet in the system has moons, and a moonless first planet
is the student's first impression of the whole metaphor. Either answer is
defensible; the instructor picks. Until then the map renders what the data
says, which is a planet with no moons.

**INV-31** (already in force — no interaction appears graded before it's been
met ungraded) extends automatically; nothing new to write here.

## 3. Animation — inherited exactly, no new entries

`DESIGN-MANDATE.md` §3's table is the complete motion vocabulary and stays
complete. Orbit drift (`SOLAR-SYSTEM-SPEC.md` §5) is **ambient decoration**
under the existing "hover/toggle" tier's spirit — continuous, low-amplitude,
frozen entirely by `prefers-reduced-motion` — and does not need its own row
because it carries no information the frozen state doesn't also carry. Do
not invent a "planet orbit" duration token; if the drift needs tuning, tune
`--dur-fast`'s spirit, don't add a tenth row to a nine-row table for a
purely cosmetic effect.

## 4. The avatar system — extended, not replaced

`DESIGN-MANDATE.md` §4 stands in full: DiceBear, identicon style, seeded from
`student_id`, self-hosted, CC0. **New, additive:** the same seed now also
drives the solar system's cosmetic variation, specified in full in
`SOLAR-SYSTEM-SPEC.md` §3. This is one extra consumer of an existing seed, not
a new seed and not a new system — do not implement a second student-facing
PRNG anywhere in the codebase.

**Where the avatar appears — unchanged:** profile, notebook cover,
certificate, cohort study-pair matching. **Never in Lecture Mode aggregates.**
Same rule, same reasoning, restated because it's easy to forget once a second
seeded system exists alongside it.

## 5. Per-page checklist — universal gate, unchanged, restated in full

No page ships without all nine, exactly as `DESIGN-MANDATE.md` §5.1:

- [ ] Six states: loading (skeleton), empty, locked, error, offline, saving
- [ ] 380px wide, no horizontal scroll, no clipped controls
- [ ] Keyboard-only completable, visible focus everywhere
- [ ] All three base themes AND every encounter theme pass WCAG AA, computed
- [ ] Zero literal hex — tokens only, hook-enforced
- [ ] Mono for every number, register value, hex, listing
- [ ] `prefers-reduced-motion` honoured
- [ ] Every control passes the four tests in §1
- [ ] Error copy says what happened and how to fix it

**Solar-system-specific additions to the gate, for `/app` and `/app/map` only:**

- [ ] Ring radius, planet position, and moon count are all derived from
      `layout.ts` and `objectives`/`stages.levels` — never hand-placed
- [ ] Frozen (reduced-motion) state is pixel-for-pixel as legible as the
      animated one — verified by actually toggling the OS setting, not
      assumed
- [ ] The flat map (`/app/map`) names every ring, planet, and moon in text,
      independent of whether Stage 11 has been reached yet by that student
      (the *reveal* is a map-page framing device for a sighted, animated
      user; a screen-reader user is never made to wait ten weeks for
      information that's otherwise available immediately — this is a real
      tension worth stating plainly rather than quietly resolving one way:
      the withholding is allowed to be cosmetic, it is not allowed to be an
      accessibility gap)
