# WEB-REVAMP.md
### The student app, rebuilt — features it never had, and a map that behaves like a solar system

> **The LOOK and the ORDER here are superseded, 30 Sep 2026: read `WEB-REMAKE.md`.**
> The instructor ruled the student app too bland and ordered a full remake as a
> game: a sci-fi HUD in the star system, the planet's biome (nav included)
> inside a planet or moon, a transition every time between them. What stands
> from this file: §2's feature list, §3 (the sidebar, moons, ENTER JOURNEY,
> asteroids, summaries) and §4 (Kepler). What does not: §1's "polish" framing,
> §6's route order, and the look of the three routes rebuilt 29-30 Sep, which are
> remade.

`CONSOLE-REVAMP.md` owns the teacher console and runs **first**. This is the
second pass and it is larger, because `apps/web` is not underpolished — it is
unfinished. Intended features are missing, layouts are wrong, and the theme is
applied inconsistently from one route to the next.

**Root `CLAUDE.md`'s REDO rule governs every route here.** Delete the JSX and
the styles, rebuild from `template.png` and `SPEC.md`. The old page is a
requirements document, not a starting point.

Same tree as the console: `design/templates/web/<route>/` holding
`template.png`, `SOURCE.md`, `SPEC.md`, `current.png`, `current-380.png`,
`motion.md`, gated by `design/specs/web-<route>.spec.ts` and the same six
assertions. One route at a time.

---

## 1. Evidence this is a rebuild, not a polish

Measured 25 Sep 2026, in the browser, on the deployment:

- **`styles.css` has no base `a { }` rule.** Anchors are styled inside
  `.app-nav` and `.encounter` and nowhere else, so every `<Link>` on `/app`
  renders browser-default purple and underlined. Improving the page would never
  surface this; rebuilding from a reference surfaces it in the first minute.
- **Stages 00 and 01 disagree about the theme** — dark panels on one, near-white
  on the other, same backdrop, same session.
- The biome backdrop is **pixelated at 1440** and competes with the text over it.
- A **clipped strip on the right edge** of both stage pages.
- **No control to leave a stage or mark it finished.**
- **No transitions are visible at all**, though the design rules allow one
  orchestrated moment per stage.
- **Neither app had a favicon** until this pass. Fixed:
  `packages/tokens/icon.svg`.

---

## 2. Missing features, by route

This is the "intended features" list. A route is not done when it looks right;
it is done when it does these things.

### `/app` — the map

| Feature | State |
|---|---|
| **Select a planet → camera zooms to it → sidebar opens** explaining the planet, with **ENTER JOURNEY** | **missing.** §3 |
| **Select a moon → camera zooms further → the sidebar updates to that moon**; its ENTER JOURNEY opens the moon's practice and minigame | **missing.** §3.2, R4 |
| Moons visible as subtopics | **missing.** R4 |
| **Sidebar background is the planet's biome**; the map canvas never carries one | **missing**: biomes are seeded once per student, not per planet (§3.5) |
| A tiny summary per planet, plus its objectives, in the sidebar | **19 drafted, 0 approved**: shown only once the instructor approves (§3.8) |
| **Moons unlock the next planet** | **missing**: nothing stores mastery per objective; two decisions open (§3.7) |
| **Minigames live in moons** | **none built**; placement proposed for approval (§3.6) |
| Orbital motion that reads as a solar system | **wrong.** §4 |
| "What do I do next" affordance | **done on `/app/map`, 29 Sep 2026**: *Pick up where you left off* / *Next up*, the server's states choosing the stage (`lib/next-stage.ts`). `/app` still says only *N of 19 subsystems online* |
| Lock reason legible on the map itself | **done on the flat map, 29 Sep 2026**: in each stage's name, and printed verbatim in the panel beside a disabled Enter journey. The 3D map does not yet |
| Degrade in place to the flat map | **works**, and since 29 Sep 2026 `/app` mounts the SAME `FlatMap.tsx` as `/app/map` (instructor ruling: one flat presentation), panel and all |

### `/app/map` — the flat map

**Rebuilt 29-30 Sep 2026** (`design/templates/web/map/SPEC.md`), on the instructor's rulings of 29 Sep: the planet panel of §3.1 lands here (no biome and no moon mastery yet: no data); the resume card; one flat presentation for both routes; the 18 edges always drawn. Every stage a real button in curriculum order, on its planet at a map 560px wide or more, a row below it. `NEXT-SESSION.md` §0r carries what it parked.

### `/app/stage/:id` — the reader

**Rebuilt 29 Sep 2026** (`design/templates/web/stage/SPEC.md`), on the instructor's rulings of that day.

| Feature | State |
|---|---|
| **Leave / finish the stage** | **done**: *Back to the map* at the top and the end. **No Finish button, by ruling**: the end says what finishes a stage (its check reaching the API's threshold; "no check" where there is none). `stage_progress` stays the grading service's |
| **Reverse travel transition** back to the map | **done**: the page fades, then the map; a cut under reduced motion (`motion.md`) |
| Mark a block read, resume where you left off | **resume done, per device** (ruling): the rail follows the section on screen; *You were reading: …* with **Resume**. No per-block mark: it would only change a number |
| The Bring-Up moment on completion | **deferred** (ruling): completion happens when a check is graded, in the runner, not in the reader |
| The lock card: prerequisite and current mastery | **done**: the API's own `lockReason`, verbatim, with *Go to Stage NN* |
| Right rail / bottom sheet | **done**: sections with `Section N of M`, objectives. **Glossary and add-to-notebook deferred** (ruling): no glossary data exists and hard rule 5 forbids writing one here; no notebook table or `/app/notebook` |
| Objectives, prose, figures | **rebuilt**: headings, wrapped lists, tables, quotes with their source, numbers in mono (`lib/markdown.ts`); figures verbatim and fitted to 380 |

### `/app/stage/:id/check` — the attempt runner

| Feature | State |
|---|---|
| Ordering items answerable | **fixed this cycle** (`da5831b`) — was unanswerable and graded wrong every time. Recordable as it arrives since 29 Sep |
| Tell the student the first answer is final | **done 29 Sep 2026**: choose, then **Record answer**; said before the first question. An arrow key used to record an answer |
| Resume | **done 29 Sep 2026**: the start returns the student's own recorded answers (and on a stage check the verdicts already shown); opens on the first unrecorded question |
| Flag for review | **done 29 Sep 2026**: per device, never sent, unrecorded questions only, named in the Submit confirmation |
| Per-question time | summed across visits, sent with the Record (it used to reset on every visit) |
| The Register Bar's PC during a paper | **done 29 Sep 2026** (`lib/registers.ts`) |
| One confirmation before Submit, toasts | **done 29 Sep 2026**. apps/web has toasts now (`lib/toast.ts`) |
| Hint tokens, re-roll, sounds, `/results/:attemptId` | **deferred**, `NEXT-SESSION.md` §0p.14 |

### `/app/progress`, `/app/work`, `/app/settings`

Thin. `/app/work` is where submissions live — 40% of the grade — and it has had
no design pass at all.

---

## 3. Planets, moons, the sidebar, and ENTER JOURNEY

**Instructor rulings, 25 Sep 2026.** Supersede the planet HUD of
`SOLAR-SYSTEM-SPEC.md` §2 and the moon popover of §1.4.

### 3.0 The model

```
PLANET  = one topic, a chapter of the syllabus              (Stage 04 · Cache Memory)
  holds: its summary, its reading, its stage check, its biome
  MOON  = one subtopic, one of that chapter's objectives    (04.5 · Compute for cache
    holds: the objective, its practice questions,                    addresses and size)
           its minigame if one is attached, and its mastery
```

**A planet is where you learn the topic; a moon is where you prove a piece of
it.** The reading is one continuous sequence per planet. `content_blocks` carry
no objective, and splitting 217 blocks across 115 objectives is not planned. The
questions are already per moon: every item has an `objective_id`, and every
act-1 moon has exactly three. That is what makes a moon a place worth going.

### 3.1 Selecting a planet: the planet sidebar

Click, or Tab and Enter. The camera eases in over ~700ms, nodes pinned, no force
simulation. The sidebar opens (right-hand at 1440, a bottom sheet at 380) and
carries:

1. Stage number and title
2. **A tiny summary**: `stages.summary`, one or two sentences. Drafted for all
   19 stages and **shown only once the instructor approves it** (§3.8). Until
   then this line is simply absent; nothing stands in for it
3. **The objectives**: the planet's moons, listed in words, each with its
   mastery state. Always shown; they are the syllabus's own wording
4. Level or levels, estimated minutes
5. State in words, and **if locked, the reason and the distance printed
   verbatim from the API's `lockReason`**. Never a tooltip, never computed in
   the client (hard rule 4)
6. "N of M subtopics mastered", which is now also what unlocks the next planet
   (§3.7)
7. **ENTER JOURNEY**, into the planet's reading and stage check. Disabled when
   locked, with the reason beside it

**The sidebar's background is that planet's biome** (§3.5).

### 3.2 Selecting a moon: the moon sidebar

Select a moon, on the canvas or from the planet sidebar's objective list, and
the camera zooms onto it; **the sidebar updates in place to that moon:**

1. The objective, code and wording
2. Its mastery in words: *not started, 1 of 3, 2 of 3, mastered*
3. Its minigame, named, if one is attached (§3.6)
4. The planet it belongs to, with a control back to it
5. **ENTER JOURNEY**, into **the moon's journey**: practice on that objective's
   own questions, and its minigame if it has one. This is what finally gives a
   moon something to hold. It is not a second door into the planet's reading

Moons are selectable only while their planet is in focus; at system scale they
are too small to hit.

### 3.3 Leaving

Escape or Back steps out one level (moon, then planet, then system) and focus
returns to the body you left. Leaving a journey returns to the map with that
planet or moon still selected and its sidebar open.

### 3.4 What the biome covers, and what it does not

The **map canvas** never carries a biome: the solar system is its background
(`BIOME-AND-LOADING-SPEC.md` §1b). **The sidebar does**, and so does everything
after ENTER JOURNEY.

### 3.5 The biome is the sidebar's background (reversed on 25 Sep)

*The previous version of this section said the sidebar never shows a biome. The
instructor reversed that the same day.* The sidebar is a small window into where
you are about to go, so it wears that world:

- **A planet's sidebar** shows that planet's biome
- **A moon's sidebar** shows **its planet's** biome. A moon is part of its
  planet's world, and giving each of 115 moons its own would break that
- After ENTER JOURNEY the same biome becomes the full-page background of the
  reading, the practice and the minigames

**One biome per planet does not exist yet.** Today a biome is seeded **once per
student** (`cosmetic-seed.ts` holds a single `biomeIndex`), so every planet a
student visits looks the same. The sidebar needs a biome **per planet, seeded
from student and stage**, deterministic, cosmetic only: never touching a lock, a
ring or a grade, the same boundary `SOLAR-SYSTEM-SPEC.md` §3 already draws.

**Legibility is not negotiable.** Sidebar text sits on a token surface laid over
the biome, held to AA **computed on all three themes and all seven biomes**, the
same rule `BIOME-AND-LOADING-SPEC.md` applies to a full-page background. A biome
that cannot hold AA behind a sidebar gets a stronger scrim, not an exemption.

### 3.6 Minigames live in moons

A minigame belongs to the **subtopic it exercises**, not to the whole planet. The
act-1 encounters, placed on the moon each one actually teaches. **Proposed, for
the instructor's approval:**

| Moon | Objective | Minigame | Built with |
|---|---|---|---|
| 01.2 | Differentiate Computer Organization and Computer Architecture | **Sort**: features into *visible to the programmer* vs *chosen underneath*, the question stage 01 is built on | DOM |
| 02.8 | Compute for CPI, MIPS rate and MFLOPS rate | **Drill**: parameterised, computed answer | DOM |
| 03.9 | Enumerate the elements of bus design | **Bus wiring**: the shared bus visibly constricting is the lesson | Phaser |
| 04.5 | Compute for cache addresses and size | **Cache drill**: `<input type=range>`, keyboard-accessible for free | DOM |
| 04.3 | Illustrate the memory hierarchy | **The Descent**: unlocked after 04, paid off at 06. First release or Midterm is still the instructor's call | Phaser |

Every other moon's journey is its practice alone. A moon without a minigame is
not unfinished; a minigame on the wrong moon teaches the wrong verb, which is
exactly what `MINIGAME-PROPOSALS.md`'s correction of 2 Sep 2026 caught once.

Minigames still dress practice, **never an assessment**, and Phaser is still
lazy-loaded per route and never in the initial bundle.

### 3.7 Moons unlock the next planet

**Instructor ruling, 25 Sep 2026: a planet is completed through its moons, and
completing it is what opens the next planet.** This supersedes R4's line that
moons add no gating. It changes `is_stage_unlocked()`: server-side only, never
decided in the client (hard rule 4), denial tests first, and `VERIFICATION.md`
read before the schema moves.

Three things have to be settled before it can be built. Two are measured facts
that make the obvious version wrong:

1. **Where moon mastery lives.** Nothing stores mastery per objective today,
   only `stage_progress` and `level_progress`. It needs a table written by the
   grading service alone, RLS'd like `stage_progress`.
2. **The threshold. DECIDED 25 Sep 2026: 2 of 3.** Every act-1 moon has
   **three** questions, so a moon can only score 0, 33, 67 or 100%, and the
   course's 70% bar applied per moon would have meant a perfect score on every
   subtopic. A moon is mastered when **2 of its 3 questions have been answered
   correctly**, counting the best result per question across attempts, so
   practice can raise it and nothing lowers it.
3. **Stage 00. DECIDED 25 Sep 2026: no moons — cosmetic asteroids instead.**
   Orientation has 5 objectives and zero questions, so its moons could never be
   mastered. It gets a belt of asteroids that is **purely cosmetic** (§3.10),
   and its objectives stay in its sidebar as text. The rule that follows: **a
   non-gradeable prerequisite never blocks.** A planet with no moons has nothing
   to master, so stage 01 is open from the start. **This resolves decision
   3a**, open since 14 Sep.

The stage check stays what it is: the graded measure of the planet, feeding the
Prelim and the gradebook. **Moons decide what opens; the check decides what is
recorded.** A stage check draws 8 questions, at most 2 per objective, so on a
planet with 11 moons (stage 03) it cannot touch every moon. That is one more
reason moon mastery has to come from the moons' own journeys.

**Step 1 BUILT 30 Sep 2026:** `is_stage_unlocked()` counts only gradeable
prerequisites, and the API's `lockReason` names only those. Stage 01 is open
from the start; a gradeable prerequisite still blocks at 70% stage mastery until
the moons below replace that rule.

#### 3.7a Where moon mastery lives — PROPOSED 30 Sep 2026, awaiting approval

Nothing below is migrated. Measured on the local bank, 30 Sep: stages 01-08
have every objective carrying 3 or 4 question families (05, 06 and 07 have some
with 4), all at `review`; stages 09-18 have no items at all.

**The table: `objective_progress`, one row per correct answer that counts.**
`(attempt_id, ordinal)` is the key, a foreign key to `responses`, so every row
is backed by a real graded answer by construction. It carries `user_id`,
`objective_id` and `family_id` (the question across versions, V-3), copied
from the attempt and the item. A trigger refuses a row whose response is not
correct, or whose user, objective or family does not match the attempt and the
item. Append-only, like `responses`: triggers block UPDATE and DELETE for
`service_role` too.

**Who writes it, and when.** The grading service only, in `recordAnswer()`,
in the same step that inserts a correct response into an attempt that counts.
No client INSERT, UPDATE or DELETE policy; unlike `stage_progress`, **no staff
write policy either** (a hand-set mastery would be a second author of a fact the
responses already hold). RLS: a student reads their own rows, staff read all.

**What "mastered" means.** A moon is mastered when the student has answered
**2 distinct questions** of it correctly, counting every attempt that is not
voided. Fixed at 2, not a fraction of the bank: on a moon of 4 questions a
fraction would move the bar when a question is approved, and a moon already
mastered would fall back, which the ruling forbids ("nothing lowers it").
A voided attempt stops counting through the join, with no delete path.

**How `is_stage_unlocked()` reads it.** Step 4 becomes: every gradeable
prerequisite has every one of its moons mastered. `stage_progress` stops gating
and keeps its other job, the stage check's recorded result.

**A planet whose moons are not all authored.** A moon with no `live` question
cannot be mastered, so its planet does not open the next one, and the lock
reason says so in words ("01.3 has no questions yet"). **Proposed as
fail-closed:** a missing bank never opens the course. The other reading,
extending "a non-gradeable prerequisite never blocks" to an empty bank, would
open stages 02-18 to every student today, because nothing is `live`.

**What must exist before the rule flips,** or every student is shut at 02: the
moon's journey (practice on the objective's own questions, a new
`blueprints.scope = 'objective'`), and act 1's items approved to `live`.

**Decisions for the instructor:** (1) do only moon journeys count, or stage
checks too (a final never counts: its verdicts are withheld, and a planet opening
mid-exam would leak them)? (2) Is a moon's journey a paper under hard rule 9, or
practice without the start prompt and full screen? (3) Fail-closed for an
unauthored moon, as proposed?

### 3.8 The summaries: drafted, gated on approval

**Instructor ruling, 25 Sep 2026:** summaries may be drafted, because the
instructor reviews every one before a student sees it. All 19 are written in
`content/stages/NN.md` as `summary:` (then with `summary_status: draft`), grounded in
each stage's own authored brief (00 to 07) and its syllabus objectives (08 to
18). `.claude/rules/content.md` already allows original prose organised around
the objectives; these define nothing, so no definition is paraphrased.

**Superseded 28 Sep 2026 (instructor ruling): review is on `/content`, in the
database.** `sync-content.mjs` writes each `summary:` to `stage_summaries` as a
draft and never approves anything; the `summary_status:` lines are gone and the
key is refused. On `/content` (Summaries view, or the chapter's own page) a
teacher approves one, which copies **that exact text** to `stages.summary`, or
sends it back with a reason. A draft whose text later changes loses its
approval and leaves students' screens on the next sync. The draft never sits on
`stages` (readable by every student for a published stage); a trigger refuses
any `stages.summary` that is not the approved text, for every role.
`services/api/test/content.spec.ts`, `content-sync.spec.ts`, `rls.spec.ts`.

### 3.9 Motion, fallbacks and accessibility

- `prefers-reduced-motion`: no easing anywhere. Cut to planet, cut to moon, cut
  into the journey
- Reduced motion, no WebGL or a small viewport: `/app/map` opens **the same
  sidebars** in place, never by redirect (`VISUAL-SYSTEM-3D.md` §5)
- The sidebar is DOM and it is the accessibility contract: everything the canvas
  shows must be readable there in words. A labelled region, not a modal; focus
  moves to its heading on open
- It is a page surface like any other: template, `SPEC.md`, spec, screenshot at
  1440 and 380, the gate

### 3.10 Stage 00's asteroids — purely cosmetic

Orientation carries no moons, so it gets a small belt of asteroids instead,
decided by the instructor on 25 Sep 2026. They are decoration and must never be
mistaken for anything else:

- **Seeded, not random.** "Random" means seeded per student from
  `cosmetic-seed.ts`, the same way biomes are — never `Math.random`. The same
  student sees the same belt every session; spatial memory is the point of a
  map
- **Unmistakably not moons.** Irregular shapes, grey, unlit, never glowing. A
  moon's glow means mastery; an asteroid has no state and must not look like it
  has one
- **Invisible to assistive technology and to input.** `aria-hidden`, not
  focusable, not selectable, not in the flat map, not in the sidebar. Selecting
  Orientation opens its sidebar exactly as before
- **Motion rules like everything else.** Keplerian around Orientation, frozen
  under `QA_MODE`, still under `prefers-reduced-motion`
- **Cheap.** A handful of instanced meshes, inside the 3D chunk's existing
  budget — no new dependency

---

## 4. Orbital motion — real physics, applied where it belongs

The complaint is that the orbits look wrong. They do, and the reason is
specific: **angular speed is not tied to orbit radius**, so every ring sweeps at
the same rate and the whole thing reads as one rotating disc rather than a
system of bodies.

### What real orbital mechanics says

**Kepler's Third Law.** The square of the orbital period is proportional to the
cube of the semi-major axis:

```
T² ∝ a³        →  T ∝ a^1.5        →  ω ∝ a^-1.5
```

Inner bodies orbit faster. That single relationship is what makes a solar system
look like a solar system, and it is the one thing the current map does not do.

**Kepler's First Law** says orbits are ellipses. **We deliberately do not apply
it.** `SOLAR-SYSTEM-SPEC.md` §1.1 makes orbit radius mean the Computer Level
Hierarchy — L0 innermost through L6 outermost. An eccentric orbit makes radius
vary over time, so a planet's level would become ambiguous as it moved. **Keep
circles; borrow the periods.** Pedagogy wins on placement, physics wins on
motion.

**Kepler's Second Law** (equal areas in equal times) is a consequence of the
first; with circular orbits it reduces to constant angular velocity per body,
which is what we want anyway.

### The compression that makes it usable

Applied literally, the real range is unusable: Mercury takes 88 days and
Neptune 165 years, a ratio near 700:1. At that spread the outer rings would
appear frozen.

With seven rings and an outer-to-inner radius ratio of about 4:1, Kepler gives
an angular-velocity ratio of `4^1.5 = 8:1`. **That is already a natural-looking
spread and needs no fudging** — L0 completes a lap roughly eight times for every
one of L6. Use the real exponent, not a tuned one; if it ever needs softening,
reduce the *radius* spread rather than inventing an exponent, so the relationship
stays honest.

### Constraints this must not break

- **Positions stay deterministic.** Motion animates *phase*, never the radius or
  the ordinal angle. Same seed, same layout, every session.
- **`QA_MODE=1` freezes all of it** — orbit drift, biome parallax, every ambient
  loop — so screenshots are stable. `playwright.config.ts` already sets this.
- **`prefers-reduced-motion` stops orbital motion entirely.** A static, correct
  diagram is the accessible form, not a slower animation.
- Moons follow the same law locally around their planet, with a much shorter
  period, and are only animated while their planet is the selected one.

### To verify rather than assume

A unit test over `layout.ts` asserting `ω(L0) / ω(L6)` equals `(r6/r0)^1.5`
within tolerance, and that the ratio is monotonic across all seven rings. The
engine rules already ban `Math.random` here; orbital phase must come from the
same seeded PRNG so two students see the same sky.

---

## 5. The icon — done this pass

`packages/tokens/icon.svg`, wired into both apps at `/icon.svg`. Neither app had
a favicon before; both showed browser defaults.

A square core inside concentric rings — the map's own grammar, since the sun is
the machine and orbit radius is the level hierarchy. Three rings rather than
seven, because seven strokes inside 32px fall under one device pixel each and
mush into a grey disc. It lives in `packages/tokens` because that is the only
place `.claude/hooks/guard.mjs` permits a literal hex, and a favicon cannot
resolve a CSS custom property.

Verified by rendering at 96, 48, 32 and 16px on light and dark chrome:
`design/templates/icon-preview.png`.

One bug worth remembering: the first version would not render at all. A **double
hyphen is illegal inside an XML comment**, and the comment named
`--surface-0`/`--ink`/`--accent`. Malformed XML, silent refusal, broken-image
glyph. Looking at the render caught it; nothing else would have.

---

## 6. Route order

| # | Route | Why here |
|---|---|---|
| 1 | `/app/stage/:id/check` | It grades. A defect here costs marks |
| 2 | `/app/stage/:id` | The reader, and where "leave the stage" is missing |
| 3 | `/app/map` | Flat map. Keyboard-correct already — that must not regress |
| 4 | `/app` | 3D map: §3 selection and zoom, §4 orbital motion |
| 5 | `/app/work` | Submissions — 40% of the grade, no design pass yet |
| 6 | `/login`, `/claim` | First contact |
| 7 | `/app/progress`, `/app/settings` | Lower traffic |

Moons (R4) land with route 4, not before — a moon is only meaningful once
zooming to a planet exists to reveal it.
