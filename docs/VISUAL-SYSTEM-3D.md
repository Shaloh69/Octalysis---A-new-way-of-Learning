# VISUAL-SYSTEM-3D.md
### The galaxy as the app's visual language — one canvas, three tiers, and the places it is banned

> **COURSE CHANGED — read `docs/CPE412-CURRICULUM.md` first.**
>
> OCTA now targets **CPE 412 — Computer Architecture and Organization** (Stallings,
> 9th ed.), replacing the earlier "Computer Systems & Assembly Language". The
> **design principles in this file remain valid and course-agnostic**; any
> reference below to a specific stage TITLE, number or topic describes the
> superseded curriculum. The authoritative stage list is `db/schema.sql`'s seed.

`SKILL-TREE-3D.md` specifies the map. **This file specifies everything else** — backgrounds,
ambient depth, and the shared machinery that makes 3D affordable across the whole app rather than
a per-page cost.

> **Decision (locked):** OCTA uses a galaxy/3D visual language throughout — backgrounds included.
> This file is how that gets built without breaking the accessibility floor, the performance
> budget, or the assessment.

---

## 1. The rule that makes this affordable

**One `<Canvas>` for the entire application. Mounted once, never unmounted, never duplicated.**

The naive way to do "3D everywhere" is a `<Canvas>` per page. That gives you N WebGL contexts, N
render loops, a context-loss storm on mobile (browsers cap live contexts at around 8–16), and a
white flash on every route change. Do not do this.

Instead: a single persistent canvas lives behind the app shell. Routes do not create scenes — they
**declare** what the shared scene should be doing.

```
   <AppShell>
     <SolarSystemCanvas />       one WebGL context, in flow, behind the text
     <Routes>                    ordinary DOM, on top, fully accessible
   </AppShell>
```

```tsx
// A route says what it wants; it does not own a renderer.
useGalaxyScene({ mode: "ambient", density: "low", drift: true });
```

The scene reads that declaration and transitions. Route changes become camera moves and density
changes on a scene that was already warm — which is both cheaper and better-looking than mounting
a new one.

---

## 2. Three tiers, and only three

Every 3D surface in OCTA is one of these. If a proposed use is not on this list, it does not ship.

### Tier 1 — Ambient (backgrounds)

Where: public site, `/app` shell, stage reader, progress, notebook, settings.

What: a slow star field with parallax, drifting at a rate you notice only if you look for it. It
carries **one** piece of real information and otherwise stays out of the way:

- **Star field hue** follows the student's `accent_hue`. Their sky is theirs.
- **Depth of field** follows the Depth Gauge: at L6 the field is shallow and near; as the student
  descends toward L0 it deepens and the stars thin out and cool. **The background is quietly
  reporting how far into the machine they can see.**

Ambient is `aria-hidden`, `pointer-events: none`, and never carries meaning that exists nowhere
else.

### Tier 2 — Diegetic (the map)

Where: `/app` stage map, `/course` public map, `/app/machine`.

What: the skill-tree galaxy, fully specified in `SKILL-TREE-3D.md`. Every axis carries data. This
is the only tier where 3D objects represent real entities the student can act on — and it is the
tier with a mandatory DOM layer above it that is the actual source of truth.

### Tier 3 — Instrument (simulators)

Where: Stage 12 data path, Stage 13 FDE stepper, Stage 16 cache hierarchy.

What: 3D where the *spatial arrangement is the concept*. The von Neumann bottleneck is a
constriction you can see narrow. The cache hierarchy is a set of tiers stacked in front of RAM at
literal distance. The FDE cycle moves values along a bus you can follow with your eye.

This tier earns 3D more than any other, because here the geometry **is** the teaching. It is also
the tier to build last, because it is the most expensive.

---

## 3. Where 3D is banned

This is the important half of "everywhere", and it is not negotiable.

| Surface | Why |
|---|---|
| **Any graded assessment screen** (`/app/stage/:id/check`, `/app/final`) | A drifting background during a timed exam is a cognitive load tax on students who are already anxious. The Self-Test is flat, still, and quiet. `DESIGN-MANDATE.md` already forbids surprise interaction during grading; this is the same principle applied to motion. |
| **Lecture Mode projector** (`/console/live/present`) | Projectors are low-contrast and often low-refresh. Aggregate bars must be legible from the back row. Also: a lecturer's laptop is running a browser, a projector, and possibly a simulator — do not spend its GPU on decoration. |
| **Console data tables** (`/console/roster`, `/gradebook`, `/items`, `/locks`) | A teacher scanning 40 rows for one student needs contrast, not atmosphere. |
| **Any surface at ≤ 640px by default** | See §5. Opt-in only. |
| **`prefers-reduced-motion`** | All tiers become static. Not slowed — static. |
| **Error, offline, and maintenance states** | If something is broken, the page must be maximally plain. A galaxy behind an error message reads as the app not knowing it is broken. |

**The one-line version:** 3D is for the surfaces where a student is exploring. It is off wherever
they are being measured, wherever a teacher is working, and wherever something has gone wrong.

---

## 4. It must never be the only carrier of meaning

The star field reports depth. The Depth Gauge **also** reports depth, in the DOM, with a label and
a number. The map colours a node by state. The DOM node **also** says "Locked — unlocks when Stage
09 reaches 70%. You're at 45%."

Every piece of information the 3D layer expresses exists in text somewhere a screen reader can
reach it. A `<canvas>` has no accessibility semantics at all; its contents are invisible to assistive
technology by construction. So the 3D layer is permitted to *reinforce* meaning and never to
*carry* it.

---

## 5. Performance budget

The audience is on mid-range Android phones on campus wifi. That is the design target, not a
fallback case.

### Measured, not assumed

| Budget | Limit | **Actual**, re-measured in R1 |
|---|---|---|
| Initial JS, gzipped | keep it small | **70.5 KB** + 7.5 KB CSS |
| 3D chunk, gzipped | ≤ 250 KB | **220.4 KB** |
| 3D in the initial load | never | **absent** — no preload link in `dist/index.html` |

> **The first two numbers used to read 51.9 KB and 3.8 KB, and they were
> stale.** R1 measured 69.6 KB / 7.5 KB at HEAD *before* any solar-system code
> — a 34% drift on the JS line, accumulated across P4–P9. The sentence three
> paragraphs down ("A budget nobody measures is a wish") turned out to describe
> this table: `pnpm scan:bundle` checks for answer-key and secret leaks, not
> size, so nothing in CI had ever compared these figures to reality. The 3D
> chunk budget — the one that actually protects the phone audience — held.
> Worth deciding whether `scan:bundle` should gain a size assertion.


Two things had to be fixed to get there, and both are the kind of mistake that
ships silently:

1. **`import * as THREE` defeats tree-shaking.** The namespace import pulled the
   whole library and the chunk came out at 269 KB gzipped, over budget. Named
   imports brought it to 220 KB. Also dropped `@react-three/drei` entirely — it
   was there for `<OrbitControls>` with pan, zoom and rotate all disabled, which
   is a dependency doing nothing.
2. **`manualChunks` made Vite PRELOAD the 3D chunk.** Forcing three.js into a
   named chunk emitted `<link rel="modulepreload" href="/assets/three-*.js">`
   into `index.html`, so every student downloaded 220 KB of 3D on first paint
   whether or not they ever opened the galaxy — precisely what the budget below
   forbids. Removing `manualChunks` lets Rollup place three.js inside the dynamic
   `SolarSystemCanvas` chunk, fetched when `/app` loads rather than with the whole app.

**Verify both after any dependency change:** read the chunk sizes from
`pnpm --filter @octa/web build`, and grep `dist/index.html` for `modulepreload`.
A budget nobody measures is a wish.

| Budget | Limit |
|---|---|
| 3D chunk, gzipped | **≤ 250 KB**, lazy-loaded, never in the initial bundle |
| Time to first meaningful paint | Unaffected — the DOM renders before the canvas exists |
| Ambient draw calls | ≤ 12 |
| Star field | **one** instanced `<Points>` buffer, ≤ 3,000 points. Not 3,000 meshes |
| Frame target | 60fps desktop · **30fps floor** mid-range Android |
| Idle behaviour | `frameloop="demand"` — the canvas stops rendering when nothing is changing, when the tab is hidden, and when the map is idle |
| Battery | A galaxy spinning in a student's pocket is a bug, not a feature |

### Automatic degradation ladder

Applied in order, without asking and without an error state:

1. `prefers-reduced-motion` → **static**, all tiers
2. Small viewport **held in portrait** → **Tier 1 off**, Tier 2 falls back to the 2D map.
   Corrected: this was "≤ 640px, full stop", which locked every phone out permanently. The reason
   was never the device, it was the ASPECT — a solar system in a 380×844 column is a thin strip
   with no room for orbits. Landscape gets the map; portrait is invited to turn.
3. WebGL unavailable, or context lost → **all tiers off**, DOM only, silently
4. Measured frame rate below 30fps for 3 consecutive seconds → **drop a tier** and remember the
   verdict for that device **for seven days**. Three corrections, all of them from one bug:
   - **The first 4 seconds are not measured.** Shaders compile, geometry uploads, the lazy chunk
     settles and React mounts the overlay. Judging the scene then judges it at the one moment it
     is guaranteed to look worst.
   - **A frame longer than 0.5s is discarded, not counted.** A tab switch, a GC pause or a laptop
     sleeping produces one enormous delta that reads as catastrophic frame rate.
   - **The verdict expires.** It used to be permanent, and that was the whole of the "why am I
     still on the 2D map" bug: one bad startup demoted a browser forever, nothing re-measured, and
     because this ladder is deliberately silent the student got no explanation and no way back.
     Stored as `{"at": <epoch ms>}`; the legacy `"1"` reads as stale, which releases every browser
     the old flag stranded.
5. Battery Saver / `navigator.connection.saveData` → **Tier 1 off**

**The flat presentation is the SAME galaxy, drawn still.** It used to be a level-strata DAG with
its own layout function — a second authoring of the map, which root `CLAUDE.md` forbids, and a
different picture of the same curriculum, so a student sent here had to rebuild their mental model
instead of recognising a quieter version of what they knew. It now reads `computeSolarLayout`, the
same function the canvas uses: same rings, same angles, same moons, projected x/z → x/y in SVG.
No canvas, no `requestAnimationFrame`, and **no motion at all** — see `BIOME-AND-LOADING-SPEC.md`
§4.1b for the star-field technique and for why selecting a planet warps rather than zooms.

**The flat presentation is not a punishment and is never deleted.** A `<canvas>` carries no
accessibility semantics at all, so the DOM layer is the only path for a screen reader, for reduced
motion, for a portrait phone and for a machine without WebGL. Rung 4 exists to protect a student on
a weak device, not to take the map away from one on a capable device — so when it is wrong, it must
be wrong *temporarily*.

And a manual override in `/app/settings`: **Full / Reduced / Off**. It passes all four mandate
tests — it changes what you see, its label is legible, it is instantly reversible, and it is a real
preference rather than a number.

---

## 6. Colour comes from tokens, not from the shader

**Never write a literal hex in a 3D scene.** The hook blocks it in `apps/`, and the per-student
accent system depends on every colour flowing through a token.

Read the resolved CSS custom properties once at scene setup and convert.

> **This did not work for the first two years of the 3D layer, and it is worth
> knowing why.** The conversion was `new THREE.Color(raw)`, and every token in
> this project is authored in OKLCH — which three.js's colour parser does not
> understand. Every read threw, hit its catch, and returned a hardcoded HSL
> fallback, so the scene had never used a design token at all. Nothing caught
> it: `scan:palette` passes (there is no literal hex), `check:contrast` passes
> (the tokens were fine, they just were not reaching the scene), and it is
> valid TypeScript. It surfaced in R2 only because two students with different
> seeded palettes rendered identically in a screenshot.
>
> `SolarSystemCanvas.tsx` now converts by painting one pixel to a 1×1 canvas
> and reading it back, so the browser does the colour maths — which also avoids
> a second copy of OKLCH→sRGB drifting from the one in
> `scripts/check-contrast.mjs`.

The shape of the read:

```ts
// Colours live in packages/tokens. The scene reads them; it does not define them.
const css = getComputedStyle(document.documentElement);
const accent = new THREE.Color().setStyle(css.getPropertyValue("--accent").trim());
```

Re-read on theme change and on accent change. Three themes × twelve accents means the galaxy is
never authored per-combination — it is derived, the same way every other colour in the app is.

**Bloom is selective by default:** set `luminanceThreshold={1}` and only materials whose colour is
lifted above the 0–1 range glow. That is how a mastered node glows and a locked one does not,
without a second render pass.

---

## 7. The stack

Identical to `SKILL-TREE-3D.md` §5 — one dependency set for all three tiers, all MIT:

`three` · `@react-three/fiber` · `@react-three/drei` · `@react-three/postprocessing`

Pin exact versions at install time. Do not add a second 3D library, a second animation library
(Motion is already the choice), or a physics engine.

---

## 8. Build order

3D is now the student's DEFAULT map surface (`GAME-DESIGN.md` §2), but it is still built after
the flat route exists — `/app/map` is what the accessibility floor is measured against, and it is
what ships if the galaxy runs long.

| Phase | Deliverable |
|---|---|
| **P2** | `layout.ts` + the **2D DOM map**. No WebGL at all yet. This is what "skill tree complete" is measured against. |
| **P5** | `SolarSystemCanvas` shell (was `GalaxyCanvas`, deleted in R2) + **Tier 1 ambient** on the student surfaces. Degradation ladder complete and tested with WebGL disabled. |
| **P6** | **Tier 3** for Stage 12 and 16, where geometry is the concept. Stage 13 stays 2D until the stepper itself is correct. |
| **P9** | **Tier 2** — the full galaxy map, the Stage 11 stratum reveal, the accent-driven sky. |

**Do not start Tier 2 before the question engine's tests are green.** That is the project's actual
purpose, and `START-HERE.md` §6 is explicit: everything else is scaffolding around it.

---

## 9. Invariants

- **INV-36** — exactly one `<Canvas>` element exists in the DOM at any time. *(CI: a render test
  that visits every route and counts canvases.)*
- **INV-37** — no route in the banned list of §3 mounts a 3D scene. *(CI: route/scene registry
  check.)*
- **INV-38** — every information channel expressed in 3D has a DOM equivalent with a text label.
  *(Review, and an axe pass that must find the same facts.)*
- **INV-39** — no literal hex appears in any scene file. *(Already enforced by
  `.claude/hooks/guard.mjs` for `apps/`.)*
