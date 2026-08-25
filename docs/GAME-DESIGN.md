# GAME-DESIGN.md
### The gaming layer — what kind of game this is, what it takes to build, and the templates to build it from

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
- **`prefers-reduced-motion` redirects `/app` to `/app/map`** on entry, with a
  one-line notice and a link back. Not a silent swap.
- **WebGL unavailable or context lost → same redirect.** A `<canvas>` has no
  accessibility semantics; when the canvas cannot exist the student is sent
  somewhere that does, not left with a blank hero.
- **≤ 640px defaults to `/app/map`.** 3D remains reachable by direct link.
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

1. **Stage number and title** — `Stage 09 · Number Systems & Data Representation`
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
| 01 What Programming Is | Card sort | **Blueprint** (base) | No machine yet; nothing to dress |
| 02 Machine Language | Eight toggle switches | **Switchboard** — 1960s relay panel, metal, toggle bats | This is literally what the deck describes: microscopic switches, off and on |
| 03 Assembly Language | Split pane, mnemonic ↔ opcode | **Phosphor terminal** (base) | Where mnemonics lived |
| 04 High-Level Languages | Payroll remix | **Retro home computer** — 1980s BASIC, chunky border, cyan on blue | Figure 1.3 *is* a BASIC listing |
| 05 Why Assembly Matters | ESP32 register write | **Modern embedded** — dark IDE, clean, current | It is their actual hardware, today |
| 06 Org vs Architecture | Card sort | **Blueprint** (base) | Conceptual, deliberately plain |
| 07 Units & Cycle Time | Frequency dial + drill | **Bench instrument** — brushed panel, illuminated readout | It is a measurement, so it looks like measuring equipment |
| 08 Spec Sheet | 2026 sheet, hotspots | **Modern product page** — clean, current, marketing-slick | The lesson is decoding marketing copy; it must look like marketing copy |
| 09 Number Systems | Bit-flip toggles | **Pixel / Terraria** — chunky bits, satisfying click, nine-slice panels | Bits are discrete and blocky; pixel art is *literally* a grid of bits |
| 10 Digital Logic | Drag gates, wire them | **Circuit sandbox** — dark board, copper traces, Turing Complete look | The most game-like stage; it should look like the game it resembles |
| 11 Level Hierarchy | Order seven levels | **Base + the reveal** | The Depth Gauge gets named here. Nothing may distract |
| 12 von Neumann | Assemble the data path | **Schematic** — hairline technical drawing | It is an architecture diagram |
| 13 Fetch–Decode–Execute | The stepper | **Instrument HUD** — live registers, mono everywhere | Motion here is content |
| 14 Instruction Set | Field encoder | **Hex editor** — dense, monospace, byte-grid | Encoding is a byte-level activity |
| 15 Writing Assembly | Real editor, run it | **DOS / TASM** — 80×25, CGA palette, authentic | The course toolchain is 16-bit DOS TASM; the skin is honest |
| 16 Memory Hierarchy | Cache simulator | **Modern dashboard** — sliders, live charts | It is a tuning problem |
| 17 Performance & Future | Upgrade puzzle | **Modern product page** — mirrors Stage 08 | Deliberate callback: same look, now you can read it properly |

Eight distinct themes, several reused. **Two of them (08 and 17) are reused on
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

## 7. Decisions still needed

1. **Does the pixel/Terraria theme survive contact with the audience?** A CpE
   class may read it as juvenile — the brainstorm template's own warning about a
   "childish arcade skin". Stage 09 is the test case; build one, show three
   students, keep or cut on what they say rather than on taste.
2. **Eight themes or three?** Eight is roughly three extra weeks of design work.
   Three (base, pixel, instrument) gets most of the variety for a third of the
   cost.
3. **Console before or after the simulators?** The console is what makes the
   pilot *runnable*; the simulators are what make it *good*. With a semester
   deadline that ordering is a real trade.
