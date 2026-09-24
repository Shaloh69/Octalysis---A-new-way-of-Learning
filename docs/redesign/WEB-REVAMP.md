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
| **Select a planet → camera zooms to it → sidebar opens** explaining the planet, with **ENTER JOURNEY** | **missing.** §3 |
| **Select a moon → camera zooms further → the sidebar updates to that moon**, with its own ENTER JOURNEY | **missing.** §3, R4 |
| Moons visible as subtopics | **missing.** R4 |
| **Biome only after ENTER JOURNEY** — never on the map, never in the sidebar | map is correct today; the rule must survive the rebuild (§3.5) |
| An authored one-line description per planet for the sidebar | **missing — 0 of 19 stages have a `summary`.** Content, not design; §3.4 |
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

## 3. Select, zoom, sidebar, ENTER JOURNEY

**Instructor ruling, 25 Sep 2026.** Supersedes the planet HUD of
`SOLAR-SYSTEM-SPEC.md` §2 and the moon popover of §1.4 — both notes are marked
there. The map is where you *choose*; the sidebar is where you *learn what you
are choosing*; ENTER JOURNEY is the only door into a planet's content, and the
biome is what you find on the other side of it.

```
system view ──select planet──▶ planet in focus + SIDEBAR(planet)
                                   │                      │
                          select moon                ENTER JOURNEY
                                   ▼                      ▼
                  moon in focus + SIDEBAR(moon)     landing ─▶ stage content
                                   │                          over its BIOME
                              ENTER JOURNEY ──────────────────▶ same, at that
                                                                 subtopic
  Escape / Back:  moon ─▶ planet ─▶ system, focus returns to the body you left
```

### 3.1 Selecting a planet

Click it, or Tab to it and press Enter. Keyboard parity is not optional —
`/app/map` already proves every stage can be a real focusable element, and that
survives the rebuild.

The camera eases to the planet over ~700ms, ease-out. `react-force-graph-3d` is
licensed **for picking and camera easing with nodes pinned** and nothing else —
never a force simulation, because positions are a pure function of seed data and
a simulation would rearrange the map between sessions.

At rest, **a sidebar opens** — right-hand at 1440, a bottom sheet at 380. It
carries, in this order:

1. Stage number and title
2. **What this planet is** — see §3.4 for where the words come from
3. Its level or levels, and estimated minutes
4. **State, in words:** locked, available, in progress with mastery, or
   mastered
5. **If locked: the reason and the distance, printed** — *"Unlocks when Stage 02
   reaches 70%. You're at 62%."* — taken verbatim from the API's `lockReason`.
   Never a tooltip: `SOLAR-SYSTEM-SPEC.md` §2 already caught that regression once,
   and three documents require the reason printed. **Never computed in the
   client** — hard rule 4; the sidebar renders what `is_stage_unlocked()`
   decided.
6. "N of M subtopics mastered", and the moons as a list of links — the DOM
   equivalent of clicking one
7. **ENTER JOURNEY** — the primary action. **Disabled when locked**, with the
   reason beside it rather than instead of it

### 3.2 Selecting a moon

A moon is one objective of its planet. Selecting it — click, or from the
sidebar's moon list — **zooms further, onto the moon**, and **the sidebar
updates in place to that moon**: objective code and text, its mastery state in
words, which planet it belongs to with a control back to it, and its own
**ENTER JOURNEY**, which lands in the stage at that subtopic's anchor rather
than at the top.

Moons are selectable only while their planet is in focus. At system scale they
are too small to hit and a mis-tap there is worse than no target at all.

### 3.3 Leaving

Escape, or the sidebar's Back control, steps out one level: moon → planet →
system. The camera eases back; **focus returns to the body you left**, never to
the top of the document. The sidebar closes only at system scale.

### 3.4 Where "what this planet is" comes from — a content gap, not a design one

**Measured: 0 of 19 stages have a `summary`.** That column is what the sidebar's
description would read. Writing 19 of them is authoring course content, and
hard rule 5 is absolute: stage prose comes from `docs/source/*.md` or the
database, and if content is missing, stop and say so.

So:

- **Until summaries exist, the sidebar shows the stage's objectives** (115 exist,
  every stage has them) under the heading *"What you will be able to do"*.
  Real content, already authored, never invented.
- **Drafting the 19 summaries from `docs/source/` is proposed work that needs the
  instructor's approval**, not something a design session writes on its own.

### 3.5 The biome appears only after ENTER JOURNEY

The biome is the **background of a planet's or moon's content** — the reading,
the activities, the minigames — and it appears **only once ENTER JOURNEY has been
pressed.** Never on the map. Never in the sidebar. `BIOME-AND-LOADING-SPEC.md`
§1b already keeps it off `/app` and `/app/map`; this extends the same line to
the sidebar and to a moon's detail, and that spec is amended to match.

ENTER JOURNEY hands over to the landing transition (`BIOME-AND-LOADING-SPEC.md`,
the loading screens), and the stage content mounts on top of the biome. The
reverse — leaving the content — returns through the same transition to the map,
**with the planet still selected and its sidebar open**, so the student lands
back exactly where they chose.

### 3.6 Motion, fallbacks and accessibility

- **`prefers-reduced-motion`:** no easing at any step. Cut to the planet, cut
  to the moon, cut into the content. The information is the destination.
- **Reduced motion, no WebGL, or a small viewport:** the flat map at `/app/map`
  opens **the same sidebar** from the same selections — in place, on the same
  route, never by redirect. `VISUAL-SYSTEM-3D.md` §5's ladder owns that rule.
- **The sidebar is DOM, and it is the accessibility contract.** A canvas has no
  semantics, so everything the 3D view shows must be readable here in words.
  It is a labelled region, not a modal: it does not dim the map, and focus moves
  to its heading on open.
- It is a page surface like any other: template, `SPEC.md`, spec, screenshot at
  1440 and 380, the gate.

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
