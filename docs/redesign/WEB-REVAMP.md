# WEB-REVAMP.md
### The student app, rebuilt — features it never had, and a map that behaves like a solar system

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
| **Select a planet → camera zooms to it** | **missing.** §3 |
| Moons visible as subtopics | **missing.** R4, 0/13 |
| Orbital motion that reads as a solar system | **wrong.** §4 |
| "What do I do next" affordance | **missing** — the page says *0 of 19 subsystems online* over an empty starfield and a lone `?` |
| Lock reason legible on the map itself | partial — the flat map carries it, the 3D map does not |
| Degrade in place to the flat map | **works** — keep it |

### `/app/stage/:id` — the reader

| Feature | State |
|---|---|
| **Leave / finish the stage** | **missing.** No control exists |
| **Reverse travel transition** back to the map | **missing** — a known gap, now visible |
| Mark a block read, resume where you left off | missing |
| The Bring-Up moment on completion | not visible |
| Objectives, prose, figures | works |

### `/app/stage/:id/check` — the attempt runner

| Feature | State |
|---|---|
| Ordering items answerable | **fixed this cycle** (`da5831b`) — was unanswerable and graded wrong every time |
| Tell the student the first answer is final | **missing** — `responses` is first-write-wins for every item type and nothing says so |
| Per-question time, flag-for-review, resume | partial |

### `/app/progress`, `/app/work`, `/app/settings`

Thin. `/app/work` is where submissions live — 40% of the grade — and it has had
no design pass at all.

---

## 3. Planet selection and zoom

The interaction the map was always supposed to have.

**Select → ease → inspect → return.**

1. **Select.** Click a planet, or Tab to it and press Enter. Keyboard parity is
   not optional; `/app/map` already proves every stage can be a focusable
   element and that property must survive the rebuild.
2. **Ease.** The camera moves to the planet over ~700ms with an ease-out curve.
   `react-force-graph-3d` is allowed **for picking and camera easing with nodes
   pinned** — that is its entire licence here. It must not run a force
   simulation. Positions are a pure function of seed data
   (`solar-system/layout.ts`) and a simulation would rearrange the map between
   sessions, destroying the spatial memory that makes a map worth having.
3. **Inspect.** At rest, the planet fills roughly a third of the viewport and
   **its moons become individually selectable** — that is R4, and it is the
   payoff for zooming at all. The dialog carries title, lock state or mastery,
   "N of M subtopics mastered", and the enter-stage action.
4. **Return.** Escape, or a visible Back control. The camera eases back to the
   system view. Focus returns to the planet that was selected, not to the top of
   the document.

**Under `prefers-reduced-motion`: no easing.** Cut straight to the target and
back. The information is the destination, not the journey.

**Under reduced motion, absent WebGL, or a small viewport**, the flat map at
`/app/map` carries the same selection — in place, on the same route, never by
redirect. `VISUAL-SYSTEM-3D.md` §5's degradation ladder owns that rule.

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
