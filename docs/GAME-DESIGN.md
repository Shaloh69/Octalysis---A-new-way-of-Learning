# GAME-DESIGN.md
### The gaming layer — what kind of game this is, what it takes to build, and the templates to build it from

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

`DESIGN-MANDATE.md` governs whether a control earns its place. **This file governs
whether the thing feels like a game** — and is honest about the difference
between feeling like one and being one.

---

## 1. First, the honest answer: what kind of learning game is this?

There are four things people mean by "educational game", and they are not the
same. The distinction decides what OCTA should spend its effort on.

| Kind | What it means | Is OCTA this? |
|---|---|---|
| **Gamification** | Points, badges, leaderboards bolted onto an unchanged activity | **No — explicitly rejected.** No XP, no currency, no global leaderboard |
| **Serious game** | A full game with win/lose conditions, built to teach | **No.** There is no win state and no failure state |
| **Game-based learning** | Learning happens by playing an actual game | **Partly — only in the simulators** |
| **Gameful design** | Game *design* used to make the real activity intrinsically motivating | **Yes. This is what OCTA is.** |

The last one is Deterding's term, and he coined it precisely because mainstream
gamification is "uninspiring and manipulative." Yu-kai Chou places gameful design
above gamification for the same reason. OCTA's Octalysis dial — heavy White Hat,
light and opt-in Black Hat — is that argument already made.

### 1.1 The genre OCTA is closest to

Not Duolingo. Not Kahoot. **Zachtronics.**

| Game | What it does | Which stage it maps to |
|---|---|---|
| **Turing Complete** | Build a working CPU starting from a single NAND gate | Stage 10 → 13 → 14, exactly |
| **TIS-100** | Write assembly for a fictional corrupted machine; optimise cycles and instructions | Stage 15 |
| **Human Resource Machine** | Assembly concepts as an office metaphor | Stage 13 |
| **Shenzhen I/O** | Read a real datasheet, then build to spec | Stage 08 |

These are the honest comparables, and the resemblance is not accidental — the
course content *is* the content of those games. Turing Complete's premise is
"everything in a computer can be constructed from a NAND gate," which is Stage 10
followed by the rest of Act III.

**What makes a Zachtronics game work is not decoration.** There are no points, no
avatars and no story. What there is: a real system with real rules, a goal, and
the freedom to solve it wrongly first. The satisfaction is *comprehension*, and
the game's only job is to make comprehension legible.

### 1.2 Where OCTA is genuinely game-like today, and where it is not

Being blunt, because it decides where the effort goes:

| Surface | Game-like? |
|---|---|
| Skill tree | **No.** It is a map. A beautiful map is still a map |
| Stage reader | **No.** It is a document |
| Self-Test | **No.** It is a quiz with good psychometrics |
| Bring-Up celebration | **Barely.** A reward animation is the thinnest game element there is |
| **Stage 10 — build a half adder from gates** | **Yes.** This is a puzzle game |
| **Stage 13 — predict the register value, then step** | **Yes.** Commit-then-reveal is a real mechanic |
| **Stage 15 — write assembly that passes the tests** | **Yes.** This is TIS-100 |
| **Stage 16 — tune a cache to beat 90% hit rate** | **Yes.** Constraint optimisation with a target |

**Four of eighteen stages contain an actual game.** They are all in P6, and none
of them are built.

> **The uncomfortable conclusion:** a 3D galaxy, themed dialogs and per-node art
> will make OCTA *look* like a game and *feel* like a game for about two weeks.
> The simulators are what would make it *be* one, and students can tell the
> difference by week three. Build the shell — it is worth building, it carries
> the whole semester's navigation — but do not mistake it for the thing.

### 1.3 What the shell genuinely buys you

Not nothing. Three real things:

1. **Progression legibility.** A tree shows *why* the order exists. That is a
   cognitive service, not decoration — Stage 13 sits above Stage 12 because you
   cannot trace a cycle through a machine you cannot describe.
2. **Anticipation.** Seeing a locked Stage 15 for eleven weeks, knowing what it
   is, is Petal 6 scarcity doing honest work.
3. **A place to stand.** Fourteen weeks is long. A map is how a student answers
   "where am I" without asking anyone.

---

## 2. The decisions, restated

Four changes to what was previously specified, all at the user's direction:

| Was | Now |
|---|---|
| 3D as an opt-in enhancement over a canonical DOM map | **3D is the student's default and primary map** |
| A toggle switching the same page between 2D and 3D | **Flat map is a separate route,** `/app/map` |
| Clicking a node navigates to the stage page | **Clicking a star opens a dialog** describing the node; the dialog offers "Enter stage" |
| One visual system everywhere | **Per-stage encounter themes** — see §5 |

### 2.1 How "always 3D" and the accessibility floor coexist

They coexist **because the flat map becomes a real page rather than a fallback.**

That is the important distinction and it is not a workaround. A degraded mode
reached by toggling off an enhancement is a second-class experience. A **route**
— linked in the main navigation, bookmarkable, indexable, keyboard-first — is a
first-class one. The same content, two presentations, both real.

```
/app          the galaxy. WebGL, 3D, the default.
/app/map      the flat map. SVG + real buttons. Always available.
```

Non-negotiables that survive the change:

- **Every route in the header**, on every page. `/app/map` is never hidden behind
  a settings toggle.
> **Superseded by the F-5 ruling, 1 September 2026.** These three bullets each
> described a **redirect**. The app has never redirected — it degrades in place,
> deliberately, and that is the better answer because a route that always works
> on every device beats one that bounces you elsewhere. **`VISUAL-SYSTEM-3D.md`
> §5's degradation ladder is now the single owner of this behaviour.** What did
> change: 3D used to default to *off* behind a `localStorage` preference, which
> no document sanctioned and which made the map invisible to most students.
> See `docs/PROGRESS.md` F-5.

- **`prefers-reduced-motion` → the flat presentation, on the same route**, with
  a one-line notice. Not a silent swap, and not a redirect.
- **WebGL unavailable or context lost → the same fallback, silently.** A
  `<canvas>` has no accessibility semantics; when the canvas cannot exist the
  DOM layer is already underneath it, so nothing needs to move.
- **≤ 640px gets the flat presentation too.** 3D remains reachable by
  preference on a device that can handle it.
- **The star dialog is a real DOM dialog** — `<dialog>` or a focus-trapped modal
  — not a 3D billboard. Its content is text a screen reader can read.
- **The 3D scene stays `aria-hidden`.** The canvas is pixels; the dialog, the
  header and the flat route carry all meaning.

---

## 3. The star map — build spec

### 3.1 Reference: what "like Skyrim" actually means

Skyrim's skill tree reads as a constellation because of five specific things,
and each is cheap on the web:

| Property | Implementation |
|---|---|
| Deep black field, stars at varying brightness | Instanced `<Points>`, additive blending |
| Nodes glow, unearned nodes are dim outlines | Emissive material lifted above 0–1, `luminanceThreshold={1}` on Bloom |
| Thin lines connecting related nodes | `lineSegments`, low opacity, brighter when the prerequisite is satisfied |
| Camera drifts slowly, parallax on move | `useFrame`, small-amplitude trigonometric offsets |
| Selecting a node dims everything else and names it | Raycast → dialog, plus a focus/dim pass |

The Supabase engineering post on building an interactive constellation with
three.js and React Three Fiber is the closest published, open-source reference:
`circleGeometry` with few sides plus `meshStandardMaterial` with
`AdditiveBlending` for overlapping glow, and `useFrame` with `Math.sin`/`Math.cos`
for the drift.

### 3.2 Reconsidering `react-force-graph-3d`

`SKILL-TREE-3D.md` §3 argued against it, and **that argument was about layout
only.** It still holds: a force simulation cannot honour axis semantics, and a
map that rearranges between sessions destroys spatial memory.

But the library also ships the two things that are genuinely annoying to write —
**raycast picking and animated camera focus** — and its nodes can be *pinned* with
fixed coordinates, which removes the simulation entirely.

| Option | Cost | Verdict |
|---|---|---|
| Pin every node via `fx/fy/fz`, use the library for picking, `nodeThreeObject` and `cameraPosition(..., duration)` | One dependency (~30 KB on top of three) | **Recommended.** Deterministic layout AND free interaction |
| Hand-rolled R3F with our own raycaster | Zero extra deps, more code | Fine, but camera easing and hover states are fiddlier than they look |

**Recommendation: pin the nodes and use the library for interaction.** It is a
better answer than either of my previous two, and it costs one dependency.

### 3.3 The star dialog

Opens on click or Enter. Contains, in this order:

1. **Stage number and title** — `Stage 09 · Computer Arithmetic`
2. **State**, in words — Locked / Available / In progress 42% / Mastered
3. **The lock reason and the distance**, when locked — the design mandate's
   legibility test applies here more than anywhere
4. **One line of what the stage covers**, from `stages.summary`
5. **What you will actually do** — the encounter, from `STAGE-ENCOUNTERS.md`
6. **Prerequisites**, named as stages, each a link to its own star
7. **Primary action** — "Enter stage", or "See what unlocks this" when locked

Requirements: focus moves into the dialog on open and returns to the star on
close · Escape closes · the background scene stops animating while it is open ·
it is styled with the stage's **encounter theme** (§5), which is where the game
feel actually lands.

---

## 4. Templates and asset sources — all verified, all usable

### 4.1 The star map

| Source | Link | Take |
|---|---|---|
| **Supabase interactive constellation** | https://supabase.com/blog/interactive-constellation-threejs-react-three-fiber | The star-field technique, and it is open source |
| **react-force-graph-3d** | https://github.com/vasturiano/react-force-graph · https://vasturiano.github.io/3d-force-graph/ | Picking, hover, `cameraPosition` easing. MIT |
| **three.js examples** | https://threejs.org/examples/ | `webgl_points_*` for the field, `webgl_lines_fat` for readable traces |
| **R3F postprocessing** | https://react-postprocessing.docs.pmnd.rs/effects/bloom | Bloom is selective by default via `luminanceThreshold` |

### 4.2 The flat map page

| Source | Link | Take |
|---|---|---|
| **beautiful-skill-tree** | https://github.com/andrico1234/beautiful-skill-tree | React skill-tree component. Read its keyboard handling; the visuals are not ours |
| **React Flow** | https://reactflow.dev · https://reactflow.dev/learn/advanced-use/accessibility | MIT. Nodes and edges keyboard-focusable out of the box |
| **PoE skill-tree viewers** | https://github.com/triinkaz/skilltree05 · https://github.com/marcoaaguiar/poe2-tree | How a large node graph stays readable while panning. Study, do not copy |

### 4.3 Game UI, dialogs and panels

| Source | Link | Take |
|---|---|---|
| **Game UI Database** | https://www.gameuidatabase.com/index.php?scrn=902 (Modals & Popups) · https://www.gameuidatabase.com/index.php?scrn=162 (Dialogue) | **Start here.** Thousands of real game UI screenshots, categorised. It is a reference library, not code |
| **RPGUI** | https://github.com/RonenNess/RPGUI | MIT. Old-school RPG GUI as a web framework — frames, buttons, progress bars |
| **rpg-css** | https://github.com/dlcNine/rpg-css | Classic-RPG-inspired CSS. Lighter than RPGUI |
| **CSS `border-image` / nine-slice** | https://coherent-labs.com/blog/uitutorials/nine-slice-modal/ · https://generalistprogrammer.com/tutorials/nine-slice-scaling-explained | **The technique that makes all of this work.** A nine-slice panel keeps its corners crisp at any size — this is how a themed dialog scales without distorting |

### 4.4 Per-theme art

| Theme | Source | Licence |
|---|---|---|
| **Pixel / Terraria** | Kenney Pixel UI Pack, 750 assets — https://kenney.nl/assets/pixel-ui-pack | **CC0** |
| **General UI** | Kenney UI Pack, 400+ sprites — https://kenney.nl/assets/ui-pack | **CC0** |
| **Dungeon / tileset** | 0x72 DungeonTileset II | CC0 |
| **Browse more** | https://itch.io/game-assets/assets-cc0/tag-pixel-art | Filter to CC0 before downloading; licences vary per file |

Kenney is already this project's audio source, so the pixel packs arrive from a
supplier whose licence terms are known and already credited on `/about`.

---

## 5. Per-stage encounter themes

The request: *some activities have their own theme — one node Terraria-style,
another modern.* Yes, and here is the boundary that makes it safe.

### 5.1 The rule that keeps this from becoming eighteen designs

> **A theme dresses the ENCOUNTER. It never dresses the ASSESSMENT.**

`STAGE-ENCOUNTERS.md` already establishes: *vary the practice, keep the assessment
steady.* A student meeting a brand-new interaction for the first time during a
graded Self-Test is being tested on the interface, not the concept.

The same applies to visual language. The lab may be a pixel-art workbench; the
Self-Test that follows is the same calm, flat, consistent surface every single
time — including its typography, its spacing and its colours.

**Themed:** the star dialog · the stage's LAB/DRILL/REMIX/BUILD beat · the
Bring-Up moment.
**Never themed:** the Self-Test · the Power-On Self Test · progress · the
notebook · anything in the console.

### 5.2 A theme is four tokens and a panel skin

Not a redesign. Each theme is a **token overlay** on the existing system:

```css
[data-encounter="switchboard"] {
  --enc-surface: …;      /* panel background     */
  --enc-edge: …;         /* border / nine-slice  */
  --enc-ink: …;          /* label colour         */
  --enc-font-display: …; /* headings only        */
  --enc-panel: url("…9slice.png");
}
```

Body text stays Inter. Every number stays JetBrains Mono. **Contrast is still
computed and still WCAG AA on all three base themes** — a theme that fails
contrast does not ship, and the CI check applies to encounter tokens too.

### 5.3 Theme per stage

Chosen so the skin says something true about the material, not just "here is a
different look".

| Stage | Encounter | Theme | Why it is honest |
|---|---|---|---|
| 01 What Programming Is | Card sort | **Base** (blueprint) | No machine yet; nothing to dress |
| 02 Machine Language | Eight toggle switches | **Switchboard** — 1960s relay panel, metal, toggle bats | This is literally what the deck describes: microscopic switches, off and on |
| 03 Assembly Language | Split pane, mnemonic ↔ opcode | **Base** (phosphor) | Where mnemonics lived |
| 04 High-Level Languages | Payroll remix | **Retro home computer** — 1980s BASIC, chunky border, cyan on blue | Figure 1.3 *is* a BASIC listing |
| 05 Why Assembly Matters | ESP32 register write | **Modern product** — dark IDE, clean, current | It is their actual hardware, today |
| 06 Org vs Architecture | Card sort | **Base** (blueprint) | Conceptual, deliberately plain |
| 07 Units & Cycle Time | Frequency dial + drill | **Bench instrument** — brushed panel, illuminated readout | It is a measurement, so it looks like measuring equipment |
| 08 Spec Sheet | 2026 sheet, hotspots | **Modern product** — clean, current, marketing-slick | The lesson is decoding marketing copy; it must look like marketing copy |
| 09 Number Systems | Bit-flip toggles | **Pixel / Terraria** — chunky bits, satisfying click, nine-slice panels | Bits are discrete and blocky; pixel art is *literally* a grid of bits |
| 10 Digital Logic | Drag gates, wire them | **Circuit sandbox** — dark board, copper traces, Turing Complete look | The most game-like stage; it should look like the game it resembles |
| 11 Level Hierarchy | Order seven levels | **Base + the reveal** | The Depth Gauge gets named here. Nothing may distract |
| 12 von Neumann | Assemble the data path | **Circuit sandbox** — hairline schematic variant | It is an architecture diagram |
| 13 Fetch–Decode–Execute | The stepper | **Bench instrument** — live registers, mono everywhere | Motion here is content |
| 14 Instruction Set | Field encoder | **DOS / TASM** — dense, monospace, byte-grid | Encoding is a byte-level activity |
| 15 Writing Assembly | Real editor, run it | **DOS / TASM** — 80×25, CGA palette, authentic | The course toolchain is 16-bit DOS TASM; the skin is honest |
| 16 Memory Hierarchy | Cache simulator | **Modern product** — sliders, live charts | It is a tuning problem |
| 17 Performance & Future | Upgrade puzzle | **Modern product** — mirrors Stage 08 | Deliberate callback: same look, now you can read it properly |

Every row above uses one of the **eight** themes in §9 — an earlier draft of this
table named fourteen, which is the contradiction the fifth verification pass
caught. Several are reused. **Two of them (08 and 17) are reused on
purpose** so the student notices they can now decode what they could not in week
six — that is a designed callback, not a shortcut.

---

## 6. What it takes to build — the actual ask

Grouped by what blocks what.

### 6.1 Student — the star map

- [ ] `layout3d.ts` — pinned positions per stage. **Fix the bug that was shipped:**
      the hit layer was positioned against the scroll container instead of the
      SVG's rendered box, so nodes drifted out of alignment, and node titles at
      `y + 38` collided with the next stratum. Positions need collision-aware
      spacing, not `col + 1`
- [ ] `GalaxyMap` — pinned `react-force-graph-3d`, star field, bloom, drift
- [ ] `StarDialog` — focus-trapped, themed, the seven contents in §3.3
- [ ] Camera focus animation on select; dim non-neighbours
- [ ] `/app/map` — the flat page, rebuilt properly with real geometry
- [ ] Redirect logic: reduced motion, no WebGL, small viewport
- [ ] Keyboard: arrow keys traverse the graph along edges, Tab follows curriculum order

### 6.2 Student — themes

- [ ] `packages/tokens/encounters.css` — eight overlays
- [ ] Nine-slice panel component, one implementation, `border-image`
- [ ] Kenney Pixel UI Pack vendored, credited in `/public/CREDITS.md`
- [ ] CI contrast check extended to encounter tokens
- [ ] **A rule test: no encounter theme class appears on an assessment route**

### 6.3 Teacher — the console does not exist yet

The API is complete and tested; there is no UI at all. This is the largest single
gap in the project.

- [ ] `apps/console` scaffold from **satnaing/shadcn-admin** (already the
      documented pick: Vite + React + TS + shadcn, MIT), palette replaced with
      `packages/tokens`
- [ ] `/console/locks` — the students × stages matrix, reason prompt on every toggle
- [ ] `/console/students/:id` — drill-down, the exact variant regenerated from the seed
- [ ] `/console/roster` — CSV import with dry-run preview
- [ ] `/console/items` — bank, stats inline, re-roll preview
- [ ] `/console/gradebook` — export
- [ ] `/console/audit/system` — the invariant results page

**The console is deliberately NOT themed and NOT 3D.** A teacher scanning forty
rows for one student needs contrast, not atmosphere.

### 6.4 The part that actually makes it a game

- [ ] Stage 10 gate sandbox — drag, wire, truth table fills in
- [ ] Stage 13 FDE stepper with predict-before-step
- [ ] Stage 15 x86-16 editor, assembler and runner
- [ ] Stage 16 cache simulator with a target to beat

**If only one group in this document gets built, it should be this one.**

---

## 7. Decisions taken

All three open questions are now settled:

| Question | Decision |
|---|---|
| Does pixel/Terraria survive the audience? | **Yes — playful, even childish, games are in**, bounded by the verb rule in §8.3 |
| Eight themes or three? | **Eight.** Locked, listed in §9 |
| Console before or after the simulators? | **Both, in full.** The semester constraint is lifted; roadmap in §12 |

---

## 8. Playful mini-games — the research, and the rule that makes them safe

**Decision: yes to playful, even childish, games — with one boundary that is not
a matter of taste.** The evidence is genuinely two-sided and it is worth knowing
both halves before building eighteen of these.

### 8.1 The evidence against decoration

The **seductive details effect** is one of the better-replicated findings in
multimedia learning. Adding interesting-but-unnecessary material to instruction
**measurably reduces comprehension and transfer**. Three mechanisms are proposed:

- **Distraction** — attention goes to the entertaining thing instead of the content
- **Disruption** — it breaks the coherent mental model the learner was building
- **Schema activation** — it primes the wrong prior knowledge

Mayer's **coherence principle** follows: people learn better when material
unrelated to the objective is *excluded*. Recent work finds seductive details
hamper learning **even when they do not visibly disrupt** the lesson — so "it
didn't seem to get in the way" is not evidence that it didn't.

**Read the definition carefully, because it is the whole argument.** A seductive
detail requires BOTH conditions:

1. it is interesting, **and**
2. **it is not necessary to accomplish the learning objective**

Condition 2 is the escape hatch, and it is a real one.

### 8.2 The evidence for play

Play in higher education is under-studied — fun is well accepted for children and
rare in the adult-education literature — but what exists is encouraging about
*climate* specifically. Students report that playfulness creates an environment
that **feels safe and encourages risk-taking**, with positive affect and
self-reported gains in engagement, retention and understanding.

That matters enormously here. `GAME-LAYER.md` §5 already anchors on the CS
test-anxiety research; a student who feels safe being wrong will attempt Stage 10
instead of avoiding it.

**But be honest about the ceiling:** meta-analytically, playful and game-based
designs raise **near-term engagement** with **modest, context-dependent effects on
achievement** and **limited evidence of better delayed retention or transfer**.

> Play buys you attempts, not comprehension. Attempts are worth a great deal —
> a student who tries Stage 10 four times learns more than one who opens it once
> — but do not expect the fun itself to do the teaching.

### 8.3 The rule

> **A themed game is safe when the game's core VERB is the objective's verb.**

The test, applied to any proposed mini-game:

```
Strip the theme away. Is the remaining activity still the learning objective?

  YES  -> the theme is a SKIN. Safe. Make it as playful as you like.
  NO   -> the activity WAS the theme. Now ask: is that activity the objective?
            YES -> it is CONTENT, not decoration. Safe. This is the best case.
            NO  -> it is a SEDUCTIVE DETAIL. Cut it. It measurably harms learning.
```

Worked through:

| Proposed | Core verb | Objective's verb | Verdict |
|---|---|---|---|
| Stage 09: flip pixel-art bit toggles, watch overflow | flip bits to represent a value | represent a value in two's complement | **Same verb. Content.** Ship it |
| Stage 10: drag gates, wire them, truth table fills | wire gates into an adder | build a half adder | **Same verb. Content.** Ship it |
| Stage 02: throw switches, watch the instruction assemble | set switches to form machine code | read machine code as switch states | **Same verb. Content.** Ship it |
| Collect coins while answering cycle-time questions | collect coins | compute cycle time | **Different. Seductive detail.** Cut |
| Platformer where you jump onto the correct answer | jump and time a landing | compute cycle time | **Different. Seductive detail.** Cut |
| A mascot that cheers between questions | none | none | **Pure decoration.** Cut |

**The pattern:** every safe example is a game whose mechanic IS the concept. Every
unsafe one wraps a quiz in an unrelated activity. That is also exactly what
separates Turing Complete from a maths quiz with a dragon on it.

### 8.4 Where playful is safe, and where it is banned

| Surface | Playful? | Why |
|---|---|---|
| **The LAB / DRILL / REMIX / BUILD beat** | **Yes, fully** — when §8.3 passes | The mechanic is the objective |
| **The Bring-Up moment** | **Yes** | Two seconds, no learning is happening, pure reward |
| **The star dialog and map chrome** | **Yes, lightly** | Navigation, not instruction |
| **First exposure to a concept (LEARN beat)** | **No** | Coherence principle: this is where seductive details do the most damage |
| **Any assessment** | **No, ever** | Already the rule in §5.1 |
| **Console** | **No** | A teacher scanning 40 rows needs contrast, not atmosphere |

---

## 9. The eight themes — LOCKED

Decision taken: **eight**, not three. Full list, each with its asset source.

| # | Theme | Stages | Look | Built from |
|---|---|---|---|---|
| 1 | **Base** | 01, 06, 11, 13 | The token system, unmodified | `packages/tokens` |
| 2 | **Switchboard** | 02, 15 | 1960s relay panel — brushed metal, panel lamps | Two hairline gradients. No asset |
| 3 | **Retro home computer** | 04 | 1980s BASIC — chunky border, cyan on blue | Border width and two tokens |
| 4 | **Pixel** | 09 | Chunky bits, square corners, stepped edge | `image-rendering: pixelated`, no asset |
| 5 | **Circuit sandbox** | 03, 12, 14 | Dark board, copper traces | Two gradients at 16px |
| 6 | **Bench instrument** | 05, 07 | Illuminated readout, mono everywhere | `--font-mono` on the panel |
| 7 | **DOS** | 10, 16 | 80×25, CGA palette, flat and square | `--font-mono`, zero radius |
| 8 | **Modern product** | 08, 17, 18 | Clean, current, lighter weight | Base tokens, larger radius |

**Stage numbers are the 18-chapter curriculum**, not the 17-chapter draft this
table was first written against.

**NO ASSET PACKS.** The original table cited Kenney's CC0 packs and a
public-domain VGA font. None is used, and none is needed: every one of these is
four tokens plus a gradient or a border rule. Adding ~750 sprite assets to get
seven panel skins would have been a large download, a licence file, and an
attribution page for something CSS does in six lines. If a theme ever genuinely
needs artwork, Kenney remains the right source — it just does not yet.

**Stages 08, 17 and 18 deliberately share theme 8** — a designed callback, so the
student notices they can now decode what they could not in week six.

Each theme is **four tokens and a panel skin**, not a redesign — see §5.2. Body
text stays Inter, every number stays JetBrains Mono, and **contrast is computed
and AA**. A theme that fails contrast does not ship, and that is now literally
true: `scripts/check-contrast.mjs` runs **42 encounter checks** and CI fails on
any of them. It has already rejected one — `modern`'s panel edge at 2.82:1
against its own panel.

**They are SELF-CONTAINED**, which is the decision that makes them safe. Each
brings its own panel, ink and accent, so it looks identical on all three base
themes and needs checking once rather than 8 × 3 times. The only thing that
genuinely varies is how the panel sits *on* the page, so the panel edge is
checked against all three page grounds at the 3:1 non-text threshold.

**They dress the LAB beat and never an assessment.** A themed exam would mean
two students sitting the same paper in different clothes, and the fairness
argument this whole project rests on is that the papers are equivalent.

---

## 10. The mini-game engine

### 10.1 Choice: Phaser 3, via the official React + TypeScript template

| Candidate | Verdict |
|---|---|
| **Phaser 3** — https://phaser.io · https://github.com/phaserjs/phaser | **Chosen.** MIT, the most mature 2D web framework, more ready-made templates than any alternative, and it has been used for educational content at scale |
| **Official template** — https://github.com/phaserjs/template-react-ts | **Use this.** Phaser 3 + React + TypeScript + Vite, with a React↔Phaser communication bridge already built. Our exact stack |
| Kaboom.js | Simpler and friendlier, but a smaller ecosystem and fewer patterns for the component-heavy work here |
| PixiJS | A renderer, not a game framework. We would rebuild input, scenes and physics |
| Plain DOM/SVG | **Still correct for several encounters** — see §10.3 |

Comparison of Phaser 3 against Kaboom.js on identical mechanics, if the choice
needs revisiting: https://github.com/ourcade/phaser3-vs-kaboomjs

### 10.2 The cost, stated plainly

Phaser is roughly **1 MB minified**. That is four times the entire 3D budget.

Non-negotiable consequences:

- **Lazy-loaded per stage**, never in the initial bundle — same discipline as the
  galaxy chunk, and verified the same way (grep `dist/index.html` for a preload)
- **Only stages that need a canvas game load it.** Most do not
- The **initial bundle stays at 51.9 KB gzipped.** If a change moves that number,
  the change is wrong

### 10.3 Not everything should be a Phaser game — re-derived for the real curriculum

A canvas game is the wrong tool when the interaction is fundamentally form-like,
because canvas has no accessibility semantics — the same argument as the galaxy.

**The previous version of this table was keyed to the SUPERSEDED course.** It
assigned Phaser to "Gate sandbox (10)" for digital logic — a subject this
syllabus does not contain — and to "FDE stepper (13)", where chapter 13 is
Reduced Instruction Set Computers. Building from it would have put a half-adder
sandbox inside a chapter about instruction sets. Re-derived below against the
19 stages that actually exist.

**The archetype decides the interaction, not taste.** `stages.archetype` already
fixes each chapter's beat sequence (`LESSON-PLAN-AND-LEVELS.md` §1), so the
minigame is the stage's signature beat rather than an arcade game bolted onto
it:

| Archetype | Signature beat | So its minigame is |
|---|---|---|
| **A** concept | SORT | a classification — sort, group, decide |
| **B** computation | DRILL | a parameterised drill with a computed answer |
| **C** artifact | REMIX | modify a given artifact and see what changes |
| **D** simulator | LAB · BUILD · BREAK | a running model you can perturb |

Only **D** stages are candidates for canvas at all, and only where free-form
spatial arrangement or continuous motion IS the content.

| Encounter | Build with | Why |
|---|---|---|
| Sorts (01, 13) | **DOM** | List reorder and classification. Native drag + tap fallback, fully accessible |
| Drills (02, 04, 09, 17) | **DOM** | Native `<input type=range>` and buttons with `aria-pressed` are keyboard-accessible for free |
| Remixes (05, 06, 10) | **DOM** | Editing an artifact is form-like. Pixel art via CSS, not canvas |
| DOM simulators (07, 08, 11, 15, 16) | **DOM** | State machines with discrete steps. A table that updates is clearer than a canvas that animates |
| **Interconnection (03)** | **Phaser** | Free-form spatial wiring; the shared bus visibly constricting is the lesson |
| **Processor structure (12)** | **Phaser** | Continuous animation of the fetch–decode–execute cycle *is* the content |
| **Parallelism (14)** | **Phaser** | Hazards arrive in time; a stall has to be felt, not tabulated |
| **Memory hierarchy (04→06)** | **Phaser** | "The Descent" is a platformer. Descending the hierarchy is literal movement |
| **Distributed systems (18)** | **Phaser** | "Fault Line" routes traffic around failures in continuous time |
| **Assembly listings (10, 11)** | **CodeMirror 6 + custom VM** | Not a game-engine problem |

**This is five Phaser scenes, revised up from three, and the reason is worth
stating rather than hiding.** The old count predated the five approved
proposals, three of which are canvas-native by construction (a shooter, a
platformer, a tower-defense). The marginal cost is **not** another megabyte
each: Phaser is one lazily-loaded chunk shared by every scene that uses it, so
after the first such route it is browser-cached. What each new scene really
costs is build effort and its own accessibility work.

**So each Phaser scene owes a documented DOM path to the same objective.** The
accessibility floor is not negotiable and a canvas cannot meet it alone. Where a
scene cannot offer one, it is a bonus encounter and never the assessment —
which is already true of every game marked *bonus* below.

---

## 11. Mini-game designs, per stage

Rewritten 2 September 2026 against the real 19-stage curriculum. **Every stage
number in the previous table was wrong** — it named chapters from the superseded
course ("02 Machine Language" when chapter 2 is Computer Evolution and
Performance; "16 Memory Hierarchy" when chapter 16 is Microprogrammed Control).
Only the designs survived; every attachment has been re-derived.

Each passes the §8.3 verb test: **the core verb of the game is the core verb of
the objective.** A game whose verb does not match is decoration, however good it
is.

| Stage | Arch | Mini-game | Core verb = objective's verb |
|---|---|---|---|
| **01** Introduction | A | **Two Columns.** Each design decision — instruction set, cache size, signal timing — dropped into *architecture* or *organization*. The boundary is the whole chapter | classify a decision ↔ distinguish architecture from organization |
| **02** Computer Evolution and Performance | B | **The Clock Bench.** A frequency dial; cycle time, MIPS and speedup read out live. Then rapid-fire drill with infinite re-roll | turn frequency into period ↔ compute performance |
| **03** Top Level View and Interconnection | D · **Phaser** | **Bus Contention.** Drag CPU, memory and I/O into place and wire the bus. When it is right a value flows — and the single shared bus visibly constricts under load | assemble the interconnection ↔ explain the bottleneck |
| **04** Cache Memory | B | **Cache Tuner.** Size, block size and associativity as sliders against a live hit-rate meter. **Target: beat 90%** | tune parameters to hit a target ↔ reason about locality |
| **05** Internal Memory | C | **Cell Bench.** Build a DRAM cell and an SRAM cell side by side; refresh cost, area and speed update as you change them | modify a cell ↔ differentiate DRAM and SRAM |
| **06** External Memory | C | **RAID Builder.** Arrange disks into RAID 0/1/5, then pull one out. What survives is the answer | arrange redundancy ↔ evaluate RAID levels |
| **07** Input/Output | D | **The I/O Desk.** Service devices by polling, interrupt or DMA against a CPU-time meter. The meter is the argument | choose a transfer method ↔ compare I/O techniques |
| **08** Operating System Support | D | **Page Fault.** A page table, a replacement policy, and a working set that will not fit. Watch the fault rate move | apply a replacement policy ↔ explain virtual memory |
| **09** Computer Arithmetic | B | **Bit Forge.** Chunky bit toggles at 8 and 16 bits. Flip the sign bit and watch the value invert; overflow flashes once, neutrally | flip bits to represent a value ↔ two's complement |
| **10** Instruction Sets: Characteristics | C | **Opcode Anatomy.** Dissect a real x86 instruction into opcode and operands, byte by byte, in mono | take an instruction apart ↔ describe instruction elements |
| **11** Instruction Sets: Addressing and Formats | D | **Where Is The Operand.** Pick an addressing mode and trace where the value actually comes from. Immediate, direct, indirect, indexed — each traced, not recited | trace an operand ↔ compare addressing modes |
| **12** Processor Structure and Function | D · **Phaser** | **The Stepper.** Play / pause / step with live registers. **Before each step you commit a prediction of the next register value.** The prediction is the assessment | predict then verify ↔ trace the cycle |
| **13** Reduced Instruction Set Computers | A | **RISC or CISC.** Classify design decisions, then a register-window visualiser showing what a call actually costs on each | classify a design ↔ contrast RISC and CISC |
| **14** Instruction Level Parallelism | D · **Phaser** | **Hazard Interceptor** *(approved proposal 1)*. Data and control hazards arrive down the pipeline; you resolve each by forwarding, stalling or reordering | resolve a hazard ↔ identify pipeline hazards |
| **15** Control Unit Operation | D | **Micro-op Sequencer.** Order the micro-operations for one instruction. A wrong order does not buzz — the machine simply does the wrong thing, visibly | sequence micro-operations ↔ describe control unit operation |
| **16** Microprogrammed Control | D | **Microcode Editor.** Write control words and watch the signals they fire. The horizontal/vertical trade-off is a width slider you can feel | write a control word ↔ explain microprogrammed control |
| **17** Multicore Computers | B | **The Amdahl 500** *(approved proposal 4)*. One budget, several cores. Amdahl's Law decides which purchase actually wins | allocate under a constraint ↔ apply Amdahl's Law |
| **18** Distributed Systems Architecture | A · **Phaser** | **Fault Line** *(approved proposal 3)*. Route traffic across a cluster while links fail. The routing decision is the objective | route around failure ↔ evaluate cluster architectures |

**Spanning encounters**, which belong to no single stage:

| Span | Mini-game | Why it spans |
|---|---|---|
| **04 → 06** · **Phaser** | **The Descent** *(approved proposal 2)*. A platformer descending registers → cache → main memory → disk, each level slower and larger than the last. Unlocked after **04**, paid off at **06** | The memory hierarchy is not one chapter. Descending it is literal movement, which is why this is a platformer and not a table |
| **10 → 11** bonus | **Mnemonic Sprint** *(approved proposal 5)*. A typing drill on x86 mnemonics, against the clock | Mnemonics are introduced in 10 and used throughout 11. Root `CLAUDE.md`: the listings this course shows are Intel x86, chapters 10 and 11 |

**Stage 12's predict-before-step is still the single best mechanic in the list.**
Commit-then-reveal is a real game mechanic, it makes the student's mental model
explicit, and it converts a passive animation into an assessment. It is also
already demanded by `DESIGN-MANDATE.md` §1. It moved from chapter 13 to chapter
12 in this rewrite because chapter 12 is where the fetch–decode–execute cycle is
actually taught.

### 11.1 Reference implementations to read before building

Named so nobody starts from a blank file. These are **references, not vendored
code** — read the approach, then build it against our own tokens, our own
accessibility floor, and the React↔Phaser bridge in §10.1's official template.

| For | Source |
|---|---|
| Every Phaser scene | **Official Phaser 3 + React + TS template** — https://github.com/phaserjs/template-react-ts · already chosen in §10.1, MIT, our exact stack |
| **Fault Line** (18) | Phaser's own tower-defense tutorial — https://phaser.io/news/2018/12/tower-defense-tutorial · and https://gamedevacademy.org/how-to-make-tower-defense-game-with-phaser-3/ for the wave and upgrade loop |
| **The Descent** (04→06) | Phaser 3 bootstrap platformer — https://phaser.io/news/2018/02/phaser-3-bootstrap-platformer · a full platform project built on the Phaser 3 API |
| **Hazard Interceptor** (14) | Top-down shooter patterns in https://github.com/jojoee/phaser-examples and https://github.com/noowxela/phaser-examples · community collections covering waves and collision |
| **Bus Contention** (03) · **The Stepper** (12) | No template fits: both are bespoke diagrams that happen to animate. Build on the official template directly |
| **Mnemonic Sprint** (10→11) | No engine. A DOM input, a timer, and `aria-live` — deliberately not a canvas |

**Check each licence before taking more than an idea.** Phaser itself is MIT and
the official template is MIT; the tutorials and community collections above have
**not** each been licence-verified, because nothing is being copied from them. If
that changes, verify first — the same discipline `BIOME-AND-LOADING-SPEC.md` §2
applies to art, learned the hard way when a biome pack turned out to be
do-not-use.

---

## 12. Full implementation — the roadmap

Semester constraint lifted; **both tracks, in full.** Ordered by what unblocks
what, not by what is most fun to build.

### Track A — Teacher console (unblocks running a class at all)

| # | Deliverable |
|---|---|
| A1 | `apps/console` scaffold from `satnaing/shadcn-admin`, palette replaced with `packages/tokens`, no `slate-`/`blue-` classes surviving |
| A2 | `/console/locks` — students × stages, reason prompt on every toggle, three visual states |
| A3 | `/console/students/:id` — drill-down, exact variant regenerated from the seed |
| A4 | `/console/roster` — CSV import, dry-run preview |
| A5 | `/console/items` — bank, stats inline, re-roll preview, review queue |
| A6 | `/console/gradebook` + `/console/audit/system` |
| A7 | `/console/live` — Lecture Mode, projector view, **no names ever** |

### Track B — The star map, properly

| # | Deliverable |
|---|---|
| B1 | `layout3d.ts` — pinned, collision-aware positions. **Rebuild, not patch** |
| B2 | `GalaxyMap` — pinned `react-force-graph-3d`, star field, selective bloom, drift |
| B3 | `StarDialog` — focus-trapped, themed per stage, the seven contents in §3.3 |
| B4 | Camera focus easing on select; dim non-neighbours |
| B5 | `/app/map` — the flat route, rebuilt from real geometry |
| B6 | Redirects: reduced motion, no WebGL, ≤640px |
| B7 | Keyboard: arrows traverse along edges, Tab follows curriculum order |

### Track C — Themes

| # | Deliverable |
|---|---|
| C1 | `packages/tokens/encounters.css` — the eight overlays |
| C2 | One nine-slice panel component, `border-image` |
| C3 | Kenney Pixel UI Pack vendored + credited in `/public/CREDITS.md` |
| C4 | CI contrast check extended to encounter tokens |
| C5 | **Test: no encounter theme class on any assessment route** |

### Track D — The games (the part that makes it a game)

| # | Deliverable |
|---|---|
| D1 | DOM encounters: `SwitchBank`, `BitForge`, `CardSort`, `SliderRig`, `Encoder` |
| D2 | Phaser harness — lazy per stage, React↔Phaser bridge, from the official template |
| D3 | **Gate Sandbox** (10) — the flagship |
| D4 | **The Stepper** (13) with predict-before-step |
| D5 | **Data Path** (12) |
| D6 | **The Terminal** (15) — CodeMirror + 8086 subset VM |
| D7 | **Cache Tuner** (16) + **The Budget** (17) |

### Track E — Content

| # | Deliverable |
|---|---|
| E1 | Stages 06–11 authored from `chapter1-deck.md` |
| E2 | Stages 12–17 authored (largely new material) |
| E3 | Item bank toward ~40 per stage — **the real project** (`VERIFICATION.md` V-6) |

### How the tracks map onto `PHASES.md`

The tracks are a **re-cut of the same work**, not a replacement numbering.
`PHASES.md` stays authoritative for exit criteria.

| Track | Phases it covers |
|---|---|
| A Console | **P4**, plus P7's review queue and P8's triage tab |
| B Star map | **P2** (flat route) and **P9** (galaxy) |
| C Themes | **P9** |
| D Games | **P5** (DOM encounters) and **P6** (Phaser + editor) |
| E Content | **P2** and **P5**, then continuous |

**Suggested order: A → B → C → D → E**, with E running continuously alongside
everything from the start. The console makes a pilot possible; the map makes it
navigable; themes make it feel like itself; the games make it worth doing twice.
