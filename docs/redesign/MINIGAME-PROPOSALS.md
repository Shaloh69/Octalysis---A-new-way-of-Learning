# MINIGAME-PROPOSALS.md — Five More Mini-Games, None of Them Decoration
### Status: **ALL FIVE APPROVED, 1 September 2026.** Superseded header below kept for the reasoning, not the status.
> The instructor's ruling came in at R0.1b: all five are approved and scheduled into
> `docs/redesign/phases/R3-page-templates-and-redesign.md` §R3.2b. Two things that ruling does
> **not** change: every "what this explicitly is not" constraint below still binds (no lives, no
> game-over, no timer feeding a grade, never the only path through a stage, ungraded and
> opt-in), and each one still waits on its own chapter being authored — **chapters 01–07 are
> written; 08–18 are scaffolds**, and all five of these sit on 14–18. A minigame for a lesson
> that does not exist yet is a game, not a learning activity (root `CLAUDE.md` hard rule 5).
> `GAME-DESIGN.md` §11's table and §12's Track D both need updating for this, together with the
> rewrite that table already needs for the 18-chapter curriculum.

### Original header — PROPOSED, not decided. Same treatment as every other "not mine to fix" item in this project (see `SKILL-TREE-3D.md` §10) — these need the instructor's sign-off before they're scheduled into Track D. Nothing here is added to `GAME-DESIGN.md` §11's table silently.

---

## Why this needed real design work, not just "sure, add more minigames"

`GAME-DESIGN.md` §8 already cites the research directly: interesting-but-unnecessary
material *measurably reduces* comprehension and transfer, even when it doesn't
visibly disrupt the lesson. §11's existing mini-game table passes every entry
through one test — **the interaction's verb has to equal the objective's
verb** — and only 3 of 18 stages earned a canvas game at all, because most
objectives are better served by an accessible DOM interaction than a game
engine. Minigames bolted on for "more fun" would be exactly the failure mode
the project's own docs warn about.

So every proposal below had to clear the same bar the existing table clears,
and each is placed as an **optional bonus layer, never the only path through a
stage's content** — the same rule that already governs the 3D solar system
versus `/app/map`: a richer presentation may sit *alongside* the accessible
one, never replace it. `/console` never needs to know these exist; they don't
touch grading.

---

## Proposal 1 — "Hazard Interceptor" (shooter), Stage 14 · Instruction-Level Parallelism

**Why this stage specifically, and why now:** `GAME-DESIGN.md` §11's table
maps mini-games against the *superseded* curriculum (`CPE412-CURRICULUM.md`'s
banner on every game/design doc says as much) — that table's "Stage 14"
entry describes a chapter that no longer exists under the new 18-chapter
syllabus. **Stage 14 is genuinely, currently open** — this isn't
overriding a locked decision, it's filling a slot the curriculum change left
empty.

**The verb match:** the actual skill in pipelining/ILP is *spotting a hazard
before it causes a stall* — structural, data, or control. That's a
recognize-and-classify-under-a-stream verb. A shooter's core loop —
**things arrive, you classify them correctly before they pass** — is that
verb, not a costume on top of it.

**How it plays:** instructions scroll down a pipeline visual (five stages,
same stage names the content already teaches — Fetch, Decode, Execute,
Memory, Writeback). A reticle follows the pointer/touch. Tag each incoming
instruction with its hazard type (or "clean") before it reaches the end of
the visible pipeline. Correct tag = it passes through cleanly. Wrong tag = it
stalls visibly (a real, honest consequence — a stalled pipeline *is* what a
missed hazard causes) and the correct classification is shown, no buzzer, same
neutral-correction language as Bit Forge's overflow flash.

**What it explicitly is not:**
- **No lives, no game over.** A wrong tag stalls that one instruction and
  moves on — same "get it wrong and it's simply wrong, no drama" rule as
  every other encounter
- **No timer feeding a grade.** Pace is adjustable, self-paced by default.
  Stage 07's "rapid-fire drill with infinite re-roll" is the existing
  precedent for *tempo as a drill feature* — this follows that precedent,
  not a new exception to the "no timers on anything graded" rule, because
  it's never graded to begin with
- **Never the only way through Stage 14.** The DOM-accessible version of this
  content (whatever the primary encounter turns out to be, per the normal
  `GAME-DESIGN.md` §10.3 DOM-first process) stays the required path. This is
  a "Try it as a game" button next to it, nothing more

**Template:** build on `phaserjs/template-react-ts` (already the locked
engine choice, `GAME-DESIGN.md` §10.1) — https://github.com/phaserjs/template-react-ts.
For the core mechanic, Phaser's own **"Phaser by Example" book** explicitly
covers shoot-em-up construction (arcade physics, sprite groups, overlap
detection) — that's the mechanical reference, not a themed asset source; the
actual visuals should stay procedural/CSS-adjacent per this project's existing
"no asset packs where tokens suffice" discipline (`GAME-DESIGN.md` §9).

---

## Proposal 2 — "The Descent" (platformer), unlocked after Stage 11, paid off at Stage 16 · Memory Hierarchy

**Why not just drop a platformer wherever:** `GAME-DESIGN.md` §11 marks Stage
11 explicitly: *"the Depth Gauge gets named here. Nothing may distract."*
That's a deliberate restraint rule, and a platformer at the reveal moment
would break it. So this doesn't go at Stage 11 — it goes **after** it, as a
bonus that pays off the metaphor once it's actually been earned.

**The verb match, and it's a strong one:** the entire app's spatial language
— the Depth Gauge, the vertical/orbital axis, "closer to the sun is closer to
the hardware" — is already a *descent* metaphor (`SKILL-TREE-3D.md` §2,
`SOLAR-SYSTEM-SPEC.md` §1). A side-scrolling descent through the seven
Computer Level Hierarchy tiers (L6 User down to L0 Digital Logic), where each
floor is a real memory tier by the time you reach Stage 16's content
(registers → L1 → L2 → L3 → RAM → disk) with real latency numbers attached to
how "heavy" that floor feels to move through, isn't a skin — **it's the same
data the whole app already encodes, walked through on foot instead of viewed
from orbit.** That's about as honest as a game mechanic gets in this project.

**How it plays:** unlocked once Stage 11 is complete (so the reveal has
already happened and nothing is being spoiled). A side-scrolling descent,
Phaser's own official "Making Your First Phaser Game" tutorial structure
(running/jumping platforms, collecting, avoiding) —
https://docs.phaser.io/phaser/getting-started/making-your-first-phaser-game
— reskinned so platforms are memory tiers and "collectibles" are successful
accesses. Falling further = going deeper = slower, real latency numbers shown
plainly in mono type as you pass each floor (same "every number stays
JetBrains Mono" rule as everywhere else). Framed explicitly at Stage 16 as
*"revisit the descent, now with real numbers attached"* — a callback, same
pattern this project already uses deliberately for Stages 08/17 sharing a
theme "so the student notices they can decode what they couldn't in week six."

**What it explicitly is not:**
- **Does not replace Stage 16's existing Cache Tuner (DOM sliders).** That
  interaction is DOM specifically *because* `GAME-DESIGN.md` §10.3 already
  decided canvas has no accessibility semantics for a tuning interaction —
  this proposal doesn't reopen that decision, the DOM version stays required
  and primary
- **No lives, no fall damage, no game over** — a "bad" descent just means
  slower/heavier passage through a tier, which is itself the lesson
  (locality matters), not a punishment
- **Ungraded, opt-in, bonus only**

---

## Proposal 3 — "Fault Line" (routing/tower-defense), Stage 18 · Distributed Systems Architecture

**Why this stage:** the last chapter, and genuinely open the same way Stage 14
is — the curriculum change means nothing in `GAME-DESIGN.md` §11's table maps
to it under the current syllabus.

**The verb match:** distributed-systems architecture is, honestly, *about*
routing requests across nodes while something keeps failing — load
balancing, redundancy, avoiding a single point of failure. A tower-defense
game's core loop — **requests/enemies travel a path, you place
routing/handling logic to keep them flowing without an overload** — isn't a
costume on that content, it largely *is* that content, walked instead of read.

**How it plays:** a small network diagram (nodes and links, not towers on a
fantasy map) — incoming request "packets" travel from a source toward a
destination. The student places routing logic at junctions: load-balance
across two paths, add redundancy before a known-unreliable link, detect and
reroute around a node that just went down. Success is measured as throughput
maintained under increasing load and simulated node failures — literally the
subject matter, not a skin on top of it.

**What it explicitly is not:** no "towers" that deal damage, no enemies to
defeat — reframe every visual as network/traffic language, not combat
language, since combat framing would be the "seductive detail" that doesn't
match the objective's actual verb. No lives; a dropped packet is shown and
explained, not penalized with a game-over. Ungraded, opt-in, never the only
path through Stage 18.

**Template:** Phaser's own official tower-defense tutorial —
https://phaser.io/news/2018/12/tower-defense-tutorial (walkthrough at
https://gamedevacademy.org/how-to-make-tower-defense-game-with-phaser-3/) —
covers exactly the mechanical pieces needed (path-following entities, arcade
physics for detecting what reaches what, placement logic) with combat
mechanics that get reframed to network language rather than reused literally.
**`thilo-behnke/phaser3-tower-defense`** — https://github.com/thilo-behnke/phaser3-tower-defense
— a real TypeScript implementation, useful as a structural reference since
it matches this project's TS-strict discipline.

---

## Proposal 4 — "The Amdahl 500" (prediction race), Stage 17 bonus · Performance & Future

**Why alongside, not instead of, the existing Budget mini-game:** Stage 17
already has "The Budget" (`GAME-DESIGN.md` §11 — allocate under a constraint,
Amdahl's Law decides the winner). This is an optional second framing of the
*same* underlying math, not a replacement — the same relationship the shooter
and platformer proposals have to their DOM-primary interactions.

**The verb match:** Amdahl's Law predicts a speedup *before* you observe it —
the actual skill is committing a quantitative prediction, then checking it
against reality. A race where you calculate expected speedup for two
hardware configurations, predict which wins and by how much, *then* watch
the race play out, is commit-then-verify — the exact mechanic
`GAME-DESIGN.md` §11 already calls "the single best mechanic in the list"
for Stage 13's Stepper. This reuses that proven mechanic rather than
inventing a new one.

**How it plays:** two lanes, two hardware configurations shown as real
numbers (parallel fraction, core count — Amdahl's Law's actual inputs).
Student computes/estimates expected speedup, commits a prediction, then a
short animated race plays out at a pace derived from the real math — not an
arbitrary animation, the *actual computed ratio* drives how fast each lane
moves. Getting the prediction right or wrong is shown plainly, calmly, no
buzzer, same as everywhere else.

**What it explicitly is not:** not a twitch-reflex racing game — no
steering, no obstacles, no skill-based input during the race itself. The
only "skill" is the prediction; the race is the reveal, not the challenge.
No lives, no lap timer counting against a grade.

**Template:** simple tween-driven motion, already inside the existing Motion
(`motion.dev`) vocabulary this project uses everywhere else —
**this one likely doesn't need Phaser at all**, a DOM/CSS animation
(two divs racing along a track, driven by `motion.dev`) is probably the
right build, which also means zero extra Phaser-scene budget. Worth
deciding explicitly whether this needs the game engine or not before
building it — the honest answer may be "no."

---

## Proposal 5 — "Mnemonic Sprint" (typing drill), Stage 15 bonus · Writing Assembly

**Why alongside The Terminal:** Stage 15 already has a real editor + 8086
subset VM ("The Terminal," `GAME-DESIGN.md` §11). This is a much smaller
addition — a fluency drill, not a second full encounter.

**The verb match:** part of what separates a fluent assembly programmer from
a struggling one is not having to think about mnemonic syntax — `MOV`, `ADD`,
`CMP`, addressing modes — while thinking about the actual logic. A
typing-speed drill for correct mnemonic syntax is a direct verb match for
"fluency," the same way Stage 07's rapid-fire cycle-time drill already
established tempo-based practice as an accepted pattern in this project.

**How it plays:** a short instruction (in English — "move 5 into AX") appears,
student types the correct TASM syntax (`MOV AX, 5`), speed and correctness
both tracked, infinite re-roll, same "practice the concept, not one
memorized instance" principle as every re-roll elsewhere in this project.

**What it explicitly is not:** ungraded, no leaderboard (§1B's ban on
competitive rankings applies here same as everywhere), no penalty for slow
typing beyond the practice itself being the point.

**Template:** this is closer to a typing tutor than a game — no dedicated
template search needed, it's a text-input-plus-timer component, buildable
in DOM (per `GAME-DESIGN.md` §10.3's own logic: this is form-like, not
spatial, so it doesn't need Phaser either).

---

## What all five proposals cost, stated plainly

Only three of the five need Phaser: **Hazard Interceptor** (1), **The
Descent** (2), and **Fault Line** (3) — three more scenes on an engine
already being loaded lazily per-stage for Stages 10/12/13, not a fourth
scene *type* to reason about. **The Amdahl 500** (4) and **Mnemonic Sprint**
(5) are proposed as DOM/CSS builds instead, per `GAME-DESIGN.md` §10.3's own
logic that form-like or simple-motion interactions don't need a canvas
engine — cheaper, and more consistent with why most of this project's
encounters are DOM already. None of the five should move the initial bundle
size; verify that the same way `GAME-DESIGN.md` §10.2 already requires (grep
for a preload, confirm the 51.9 KB gz baseline doesn't move).

## What happens next

These are proposals. If the instructor says yes to any of them, each gets its
own line in `GAME-DESIGN.md` §11's table (once that table is updated for the
new 18-chapter curriculum anyway — worth doing together) and its own Track D
line item in §12. Until then, they stay here, not in the locked docs.
