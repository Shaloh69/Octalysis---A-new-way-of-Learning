# SKILL-TREE-3D.md
### The galaxy map — spatial grammar, real stack, and the fallback that is actually the source of truth

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

`STAGE-ENCOUNTERS.md` says what a student touches inside a stage. **This file says what the map
between stages is**, and how it gets rendered without breaking the accessibility floor.

> **The one-line version:** the skill tree is not a visualisation of the curriculum. It *is* the
> curriculum — `stages.prereq` is the edge list — and the galaxy is a camera pointed at it.

---

> **SUPERSEDED IN PART — see `GAME-DESIGN.md` §2.** Four decisions in this file
> have changed at the user's direction:
>
> | This file says | Now |
> |---|---|
> | 3D is an optional enhancement over a canonical DOM map | **3D is the student's default and primary map** |
> | A toggle switches one page between 2D and 3D | **The flat map is a separate route,** `/app/map` |
> | Clicking a node navigates to the stage | **Clicking a star opens a dialog**, which then offers "Enter stage" |
> | §3 rejects `react-force-graph-3d` outright | **Reconsidered:** reject its LAYOUT, keep its picking and camera easing, with nodes pinned |
>
> Everything else here still holds — especially §1 (the tree is the curriculum),
> §2 (the spatial grammar) and the rule that the accessible representation is
> never a degraded mode. It is now a first-class *route* rather than a fallback,
> which is a stronger position than the toggle was.

## 1. The tree is the curriculum, and it already exists

There is no second data source. The graph is `stages.prereq`, seeded in `db/schema.sql`, and
`is_stage_unlocked()` is the only thing that decides whether a node is lit. **Nothing about the
map may be authored twice.** If the map and the database disagree, the map is wrong.

What the tree adds over a syllabus list is *legibility of the ordering*. A syllabus is a list of
weeks; a tree shows why the order exists. Stage 04 (Cache Memory) sits below Stage 03 (Top Level
View) because you cannot reason about a memory hierarchy inside a machine whose components you
cannot yet name. That argument is invisible in a list and obvious in a shape.

### 1.1 The actual graph, derived from the seed

**19 nodes, 18 edges, one linear chain.** This is not a sketch — it is exactly what
`stages.prereq` contains, and `apps/web/test/layout.spec.ts` parses that seed out of
`db/schema.sql` at test time so the two cannot drift:

```
00 ▶ 01 ▶ 02 ▶ 03 ▶ 04 ▶ 05 │ 06 ▶ 07 ▶ 08 ▶ 09 │ 10 ▶ 11 ▶ 12 ▶ 13 │ 14 ▶ 15 ▶ 16 ▶ 17 ▶ 18
└──── act 1, Prelim ────┘ └─ act 2, Midterm ─┘ └─ act 3, Semis ─┘ └─── act 4, Finals ───┘
```

| Property | Value | Consequence for the map |
|---|---|---|
| Nodes | 19 | Orientation plus the syllabus's 18 chapters. **Small** — see §3, this size decides the whole technology choice |
| Edges | 18 | One per chapter. Each requires exactly the one before it |
| Critical path | All 19 nodes | The chain *is* the spine. Nothing hangs off it |
| Forks (out-degree > 1) | none | — |
| Joins (in-degree > 1) | none | — |
| Leaves | `18` only | Distributed Systems Architecture, the last chapter |

### 1.2 There are no forks, and that is a finding, not a limitation

An earlier draft of this document described four forks, three joins, and a 15-node critical path
through a branching graph. That graph was a defensible reading of the *subject* — you really can
learn number systems and spec sheets in either order — and the wrong reading of the *delivery*.

Asked directly, the instructor was unambiguous: **"I teach based on the order of the syllabus
topics and go down the line."**

`stages.prereq` gates real students out of real content. It therefore has to model the course as
taught, not the subject's intellectual decomposition. A fork on the map is a promise that two
orders are both supported; if lectures only ever run one of them, the map is lying in a way that
costs a student marks.

So the branching came out. What the map still teaches is the *vertical* axis — depth into the
machine — which is where CPE 412's real structure lives: L6 at Introduction, down through cache
and memory to L0 at Internal Memory, back up through instruction sets, down again to L1 for
control unit operation and microprogramming. **The chain is horizontal; the descent is vertical.**
That is the shape worth drawing, and a list cannot show it.

### 1.3 Every node is on the path

The dead-end question ("nothing lists `08` as a prerequisite, so it reads as skippable") was
decision **D1**, resolved by wiring `08` into `17`. **Linearisation superseded it.** In a chain
every node but the last has exactly one dependent, so no node can read as optional and there is
nothing left to wire.

### 1.4 The teacher still wins

Every edge above is the *default* policy layer only. `is_stage_unlocked()` resolves student
override → section override → global override → prereq policy, so the lock matrix bends the tree
to the class. If the class runs ahead, the teacher opens a node and the map redraws. **The map
renders the resolved state; it never computes it** (hard rule 4).

---

## 2. The spatial grammar — why this is a galaxy and not a decoration

The design mandate's fourth test is the strict one: *does the interaction itself carry meaning?*
A field of pretty stars fails it instantly. So every axis is assigned a real variable, and the
result happens to look like a galaxy because the data genuinely has that shape.

| Spatial property | Encodes | Source |
|---|---|---|
| **Vertical (Y)** | The Computer Level Hierarchy, L6 at the top down to L0 at the bottom | `stages.levels` |
| **Spiral arm (θ)** | Act I–IV | `stages.act` |
| **Radius (r)** | Position along the critical path | derived from `ordinal` |
| **Node brightness** | Mastery, 0 → 1 | `stage_progress.mastery` |
| **Node lit / dark** | Unlocked / locked | `is_stage_unlocked()` |
| **Edge as a bus trace** | Prerequisite | `stages.prereq` |
| **Halo** | The student's accent hue | `profiles.accent_hue` |

**The Y axis is the point.** `LESSON-PLAN-AND-LEVELS.md` §3 already establishes that a student's
level is *how deep into the machine they can see* — L6 user level at the start, L0 digital logic
by Stage 10 — and that the Depth Gauge is a vertical seven-segment indicator down the left edge.

> **The galaxy is the Depth Gauge with a third dimension added.** Descending the map and
> descending the abstraction hierarchy are the same motion. That is what makes this pass the
> teaching test rather than being a skin.

Stage 11 is still the reveal. In week 9 the student learns the thing they have been flying down
for ten weeks is Figure 1.5, and the map re-labels its strata in place. Do not label the Y axis
before Stage 11 — the ten weeks of unexplained descent is the setup for that moment, and the same
deliberate withholding already applies to the Register Bar and the Depth Gauge in
`DESIGN-MANDATE.md` §2.

### 2.1 What the four arms look like

```
        L6 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
              ·00       ·01                    ·07  ·08     ← Act I / Act II, user level
        L5 ┄┄┄┄┄┄┄ ·04 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
        L4 ┄┄┄ ·03 ┄┄┄┄┄ ·05 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ·15 ┄┄
        L3 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ·16 ┄┄┄┄┄┄┄
        L2 ┄┄ ·02 ┄┄┄┄┄┄┄┄┄┄┄┄┄ ·09 ┄┄ ·12 ┄┄ ·14 ┄┄┄┄
        L1 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ·13 ┄┄┄┄ ·17 ┄
        L0 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ·10 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
             ╰── Act I ──╯╰─ Act II ─╯╰─ Act III ─╯╰ IV ╯
                            ·06 and ·11 span all strata — render them as columns, not points
```

Stages 06 and 11 declare all seven levels in `stages.levels`. They are the two nodes that are
*about* the hierarchy rather than sitting in it, so they render as vertical columns crossing every
stratum. That is a free, honest piece of visual information straight out of the seed data.

---

## 3. Do not use a force-directed LAYOUT (but see §3.2 on the library)

The obvious pick for "3D node graph in React" is
[`react-force-graph-3d`](https://github.com/vasturiano/react-force-graph) (MIT, wraps
[`3d-force-graph`](https://github.com/vasturiano/3d-force-graph) over three.js and `d3-force-3d`).
It is a good library. **It is the wrong tool here, for three reasons:**

1. **A force simulation produces a different layout every run.** Curriculum order is fixed and
   meaningful. A map that rearranges itself between sessions destroys the spatial memory that
   makes a map worth having, and it cannot honour §2's axis assignments at all — the simulation
   decides positions, not your semantics.
2. **19 nodes.** Force-directed layout exists to make *thousands* of nodes tractable. At 19 nodes
   with a known DAG, positions should be computed once, deterministically, and committed. You can
   literally write them down.
3. **It brings its own renderer and its own scene graph**, which then fights the postprocessing,
   theming, and accessibility layers described below.

**Instead: compute the 18 positions deterministically from `act`, `levels`, and `ordinal`, and
render them yourself.** The layout function is perhaps forty lines, it is pure, and it is
unit-testable — which matters, because "the map matches the prerequisite graph" then becomes an
assertion rather than a vibe.

Keep `react-force-graph-3d` on the list for exactly one thing: if you later build the
**objective-level** graph (~70 objectives × prerequisite relations) for `/console/analytics`, that
is a real graph problem and the library earns its place there.

---

## 4. Architecture — two layers, and the accessible one is canonical

This is the part that keeps the 3D map from breaking the project's own accessibility floor.

```
   ┌──────────────────────────────────────────────────────────┐
   │  layout.ts        pure fn: stages[] → Map<stageId, Vec3>  │  ← tested, deterministic
   └────────────┬─────────────────────────────┬───────────────┘
                │                             │
   ┌────────────▼──────────────┐   ┌──────────▼────────────────┐
   │  CANONICAL LAYER (DOM)    │   │  PRESENTATION LAYER (GL)  │
   │  real <button>s, focusable│   │  three.js / R3F canvas    │
   │  aria, labels, lock copy  │   │  aria-hidden="true"       │
   │  keyboard + screen reader │   │  pointer-events: none     │
   │  ALWAYS AT /app/map       │   │  THE DEFAULT AT /app      │
   └───────────────────────────┘   └───────────────────────────┘
```

**The DOM layer is the source of truth and is always present.** The WebGL canvas sits *behind* it
and is marked `aria-hidden`. Every click, focus, and screen-reader announcement is handled by real
DOM elements positioned over their 3D counterparts. This is the standard overlay technique for
accessible WebGL: keep native DOM interactivity and let the canvas be pixels.

> A `<canvas>` is not in the accessibility tree at all — its contents have no semantics and are
> invisible to a screen reader. Any 3D UI that is the *only* representation of its content is
> inaccessible by construction, no matter how much ARIA is bolted on afterwards.

Consequences that are non-negotiable:

- **If WebGL fails to initialise, is lost, or is disabled, the map still works.** No error state,
  no "your browser is unsupported", and no redirect — the DOM layer is already there and the canvas
  simply never appears. Test this by disabling WebGL in the browser, not by hoping. **Note this
  bullet already describes degrade-in-place**, which is why §5 of `VISUAL-SYSTEM-3D.md` won the
  F-5 ruling: this was the consistent answer all along, and the redirect language elsewhere in this
  file was the outlier.
- **`prefers-reduced-motion` disables camera drift, parallax, and bloom pulsing.** The map becomes
  a static projection. State still changes, instantly, per `DESIGN-MANDATE.md` §3.
- **At ≤ 640px `/app` falls back to the flat presentation in place** — it does **not** redirect.
  `VISUAL-SYSTEM-3D.md` §5's degradation ladder owns this; see `docs/PROGRESS.md` F-5.
- **Focus order follows curriculum order** (`ordinal`), never screen position. A student tabbing
  through the map walks the syllabus.
- **Every lock still states its reason and distance** — *"Unlocks when Stage 09 reaches 70%.
  You're at 45%."* The 3D layer may dim a node; the DOM layer must still say why in words.

If building both layers is too much for the semester, **build the DOM layer and ship it.** It is
the one that satisfies the requirements. The galaxy is now the DEFAULT surface at `/app`, and the
flat map is a first-class route rather than a fallback -- a stronger accessibility position than
the toggle it replaced, because a route is bookmarkable, linkable and never hidden in a setting.

---

## 5. The actual stack

All MIT unless noted. **Pin exact versions at install time and record them here** — do not trust
the numbers in any document, including this one.

### 5.1 Presentation layer

| Package | Link | What it does here |
|---|---|---|
| `three` | https://threejs.org · https://github.com/mrdoob/three.js | The renderer. MIT. |
| `@react-three/fiber` | https://docs.pmnd.rs/react-three-fiber · https://github.com/pmndrs/react-three-fiber | React reconciler for three.js — lets the scene be components with the same state as the rest of the app |
| `@react-three/drei` | https://github.com/pmndrs/drei | Helpers you would otherwise write: `<OrbitControls>`, `<Points>`, `<Billboard>`, `<Text>`, `<Line>`, `<Stars>` |
| `@react-three/postprocessing` | https://react-postprocessing.docs.pmnd.rs · https://github.com/pmndrs/react-postprocessing | Bloom. Note: `<Bloom>` is **selective by default** — set `luminanceThreshold={1}` and nothing glows except materials whose colour you lift above the 0–1 range. That is how a *mastered* node glows and a locked one doesn't, with no second render pass. |
| `@react-three/a11y` | https://github.com/pmndrs/react-three-a11y | Focusable meshes, if you want the canvas itself reachable. **Use only as a supplement** — the DOM layer in §4 is still the contract. |

### 5.2 Canonical layer

| Package | Link | Why |
|---|---|---|
| `@xyflow/react` (React Flow) | https://reactflow.dev · https://github.com/xyflow/xyflow | MIT. Nodes and edges are keyboard-focusable and operable out of the box — Tab to a node, Enter/Space to select, Escape to clear, arrow keys to move — and it exposes `nodesFocusable` / `edgesFocusable` / `disableKeyboardA11y`. Its a11y guide is at https://reactflow.dev/learn/advanced-use/accessibility |
| *or* plain SVG + `<button>`s | — | **Seriously consider this.** 19 nodes and 18 edges is a small hand-written SVG. React Flow is built for user-editable node graphs; ours is read-only and fixed. If you only need focusable circles and lines, you do not need a graph framework. |

**Recommendation: plain SVG + real buttons.** Pick React Flow only if the console's
objective-graph editor materialises and you want one library across both.

### 5.3 Motion

Already decided in `DESIGN-MANDATE.md` §3: **Motion (`motion.dev`) and nothing else.** Do not add
GSAP or Lottie for the map. Camera moves inside the R3F canvas are driven by `useFrame`, not by a
tweening library.

### 5.4 Reference material worth reading before building

| Source | Link | For |
|---|---|---|
| R3F documentation | https://docs.pmnd.rs/react-three-fiber/getting-started/introduction | The mental model — scene as component tree |
| Bruno Simon, Three.js Journey | https://threejs-journey.com | The "Galaxy Generator" chapter is the closest published thing to what we're building |
| three.js examples | https://threejs.org/examples/ | `webgl_points_*` for the star field, `webgl_lines_fat` for readable bus traces at any zoom |
| drei storybook | https://drei.pmnd.rs | Every helper, live |
| R3F performance guide | https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance | Read before, not after |
| React Flow a11y | https://reactflow.dev/learn/advanced-use/accessibility | The canonical layer's contract |

---

## 6. Performance budget, and the phone problem

This is where a galaxy map most plausibly goes wrong, so the limits are written down first.

**The audience is on phones.** `GAME-LAYER.md` §2 and `MASTER-PLAN.md` §13 both say so, and the
universal checklist requires 380px. A large share of the class will open this on a mid-range
Android device on campus wifi.

| Budget | Limit | Why |
|---|---|---|
| Added JS, gzipped | **≤ 250 KB** for the entire 3D chunk | It is an enhancement; it may not dominate the bundle |
| Loading | **Lazy, `React.lazy` + dynamic import** | The 3D chunk must not exist in the initial bundle. Nothing on `/app` first paint depends on it |
| Draw calls | ≤ 50 | 19 nodes, 18 edges, one instanced star field |
| Star field | One `<Points>` with an instanced buffer, ≤ 3,000 points | Not 3,000 meshes |
| Target | 60fps desktop / **30fps floor mid-range Android** | Below the floor, auto-fall back to 2D and say so |
| Idle | Canvas **stops rendering when the tab is hidden or the map is idle** | `frameloop="demand"` — a spinning galaxy burning battery in a student's pocket is a bug |

**Defaults:**

- Viewport ≤ 640px → **2D map**, with a "View in 3D" control.
- `prefers-reduced-motion` → **2D map**, always. Not a degraded 3D.
- WebGL unavailable or context lost → **2D map**, silently.
- Everything else → 3D at `/app`, with `/app/map` always in the header (Ownership, Petal 4 — and it
  passes all four mandate tests: it changes what you see, its label is legible, it is reversible,
  and it is a genuine preference rather than a number).

**Free-tier note:** the 3D chunk is a static asset on Vercel Hobby, which allows 100 GB/month of
bandwidth. A 250 KB chunk fetched by 40 students a few hundred times a semester is negligible. The
3D map costs nothing on the hosting side — its cost is entirely device-side. See
`VERIFICATION.md` V-26 for where the free tier *does* bite.

---

## 7. Accessibility contract

Non-negotiable, and it is also a marking-rubric item.

- [ ] Full map operable **keyboard-only**, focus order = curriculum order
- [ ] Every node is a real, labelled control announcing **title, state, and reason when locked**
- [ ] Screen-reader users get an equivalent **list view** of the same graph — stages grouped by
      Act, each with its prerequisites named in text
- [ ] `prefers-reduced-motion` → static, no camera drift, no bloom pulse
- [ ] All three themes pass **WCAG AA** for node, edge, and label contrast — computed, not eyeballed
- [ ] Works at **380px**
- [ ] **Works with WebGL disabled** — verified by disabling it, not by assuming
- [ ] Colour is never the only signal — locked/unlocked also differs in **shape and label**
      (colour-blind safety; the accent system deliberately never carries semantic meaning)

---

## 8. What ships when

The map is not one deliverable. Splitting it is what keeps it from eating the semester.

| Phase | Deliverable |
|---|---|
| **P2** | `layout.ts` (pure, tested) + the **2D DOM map** with real lock reasons. This is the map. It ships. |
| **P5** | Interactive polish on the 2D map: read-only preview of the next stage's objectives, act grouping, mastery rings |
| **P9** | **The galaxy.** Lazy-loaded 3D layer at `/app`, star dialog, reduced-motion and small-viewport redirects to `/app/map`, Stage 11's stratum re-label |
| P9+ | Optional: bring-up flythrough on stage completion, reusing the existing 2000ms `--dur-bringup` budget — **not a new celebration**, the same one, seen from the map |

**Do not build the 3D layer before P9.** It is the highest-risk, lowest-necessity component in the
app, and every hour spent on it in P3–P6 is an hour not spent on the question engine, which is the
thing the project is actually for.

---

## 9. Invariants

Add to the suite (`docs/AUDITS.md`, `db/addendum-audit.sql`):

- **INV-32** — every stage in `stages` has a position in `layout.ts`, and every position maps to a
  seeded stage. A node the map invents, or a stage the map forgets, is a defect. *(CI, not SQL.)*
- **INV-33** — every edge drawn on the map corresponds to an entry in `stages.prereq`, and every
  `prereq` entry is drawn. The map may not editorialise the curriculum. *(CI, not SQL.)*
- **INV-34** — the map's node states are derived from an `is_stage_unlocked()` response, never
  computed client-side. Enforced by review and by hard rule 4; a client-side mastery comparison in
  `apps/web` is a blocking finding. *(Review + lint.)*

---

## 10. Open decisions

Three, and they are the instructor's, not Claude Code's:

1. ~~Stage 08's dead end~~ — **decided: wired in.** See §1.3.
2. ~~Is the 3D map in scope for the pilot?~~ **Decided: yes, and it is the default.** It is a P9 item, and
   P10 is a two-week pilot. Cutting it costs nothing that a student would notice.
3. **Does the galaxy framing survive contact with the instructor's taste?** The brainstorm template
   warns against a "childish arcade skin," and this is the single design decision in the project
   most exposed to that critique. The defence is §2 — every axis carries real data, and the
   vertical axis *is* the course's own Figure 1.5. If that defence doesn't convince the person
   teaching the course, build the 2D map and stop.
