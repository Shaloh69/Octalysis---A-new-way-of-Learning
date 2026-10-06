# apps/web — student + public

Vite + React 18 + TS. Deploys to Vercel.

**Styling is hand-written CSS over `packages/tokens`, not Tailwind and not shadcn/ui.** An earlier
draft of this file claimed both; neither is installed. The student app's surfaces are bespoke
(star map, reader, competency grid, themed encounters), so a component library would have been
carried for almost no reuse. `apps/console` is the opposite case and DOES use shadcn.
Route groups: `/` public (unauthenticated), `/app/*` student (role `student`).

## Two realms — the remake, 30 Sep 2026 (`docs/redesign/WEB-REMAKE.md`)
- **The star system** (`/app`, `/app/stages`, `/app/progress`, `/app/work`, `/app/settings`, and
  the public pages): **one** game HUD for everyone, with the seeded accent. No variants: apps/web
  never sets `data-theme` (ruling 2, 30 Sep). Never a biome.
- **Inside a planet or moon** (`/app/stage/:id` and everything under it): **that planet's biome,
  nav, side bars and buttons in sprites**, one biome per planet seeded from student and stage; a
  moon wears its planet's.
- **`/app` is the 3D map and the only map.** `/app/map` redirects to it. The map's accessible
  layer (the row of bodies, the body panel) is what keyboard and screen-reader students use.
- The realm is decided once, in the shell, from the route (`data-realm`, `data-biome` on
  `<html>`), correct on the first paint. Moving between realms is always a transition; a cut
  under reduced motion.
- **A stage check: biome chrome, neutral paper.** The question card, options, Record, Submit and
  verdicts are identical for every student.
- **A paper is sat behind Start, with no way back, in full screen** (ruling 3, 30 Sep 2026; root
  hard rule 9, WEB-REMAKE.md §4a). Nothing of it exists before Start; from Start to Submit the
  shell has no Leave, no tabs and no shortcut off it (lib/sitting.ts), Back is held; leaving full
  screen or the page covers the questions and is recorded (POST /attempts/:id/events). Every
  check and exam, and /app/live when it is built.
- **Leaving submits it** (ruling 4, 6 Oct 2026): leaving full screen, closing or reloading,
  or more than 15 s away hands the paper in as it stands and uses the attempt (AttemptRunner,
  `services/api/src/sitting.ts`). Under 15 s away it stays covered and recorded.

## Never in this package
- Any import from `services/api/src/engine/**`
- The string `SERVICE_ROLE` anywhere
- A literal hex color (use `packages/tokens`) — a hook blocks it
- `localStorage` for anything that affects a grade
- Client-side scoring, client-side lock computation

## The three progression axes — do not invent a fourth
- **Depth** (7 levels, Depth Gauge on the left edge) — from stage completion
- **Competency** (21 cells at `/app/progress`) — from objective mastery
- **Hardware** (subsystems online at `/app/machine`) — from Bring-Up

There is no XP, no points, no currency. If a design needs a number, it is a mastery percentage.

## Stage archetypes drive the reader UI
Read `stages.archetype` and render the matching beat sequence:

```
A concept    BRIEF LEARN PROBE SORT  CHECK BRING-UP LOG
B compute    BRIEF LEARN PROBE DRILL CHECK BRING-UP LOG
C artifact   BRIEF LEARN TRACE REMIX CHECK BRING-UP LOG
D simulator  BRIEF LEARN LAB   BUILD BREAK CHECK BRING-UP LOG
```

Do not add a beat a stage's archetype doesn't declare. See docs/LESSON-PLAN-AND-LEVELS.md §1.

## Accent
The accent is a **hue** (0-359) set as `--accent-hue` on `<html>`, and it is **derived**,
not read from `profiles`. `GET /api/v1/cosmetics` returns `themeIndex` and `accentHue`
from the same digest that already seeds the biome, and `applySeededLook()` applies each
**only if the student has not chosen that part** — an explicit Settings pick wins for
ever, and theme and hue are tracked separately so changing one keeps the seed for the
other.

`profiles.accent_hue` is NOT the source, despite existing. Its column default is 250, so
it is a preference column awaiting a persistence path, not a seeded value — reading it
would have given every real student the same 250 that **F-40** was about. Fixed 7 Sep
2026; this section previously described the applying as already happening, for weeks
during which it was not. All accent colors derive in
OKLCH with lightness and chroma fixed per theme, which is what keeps contrast constant across
hues. Never store or read a hex accent.

Accent MAY color: the student's own progress, their map node, Register Bar highlight, focus rings.
Accent MAY NOT color: correct/incorrect, danger, warning, success, locks, or anything in Lecture
Mode aggregates.

## Every component needs six states
loading (skeleton, not a spinner) · empty (an invitation, not an apology) · locked (name the
reason and the distance to unlocking) · error (what happened + how to fix) · offline (banner +
queued autosave) · **saving**.

**The sixth is `saving`, not `380px`** — corrected 8 Sep 2026 against
`DESIGN-MANDATE.md` §201, which is the authority. This line said `380px` and
conflated two different checklists: 380px is one of the **mechanical five** that
`r3-gate.spec.ts` runs on every route, not one of the six states. The confusion
had a cost — a spec written from this line tested 380px as a state and never
tested saving at all, on a graded surface where saving is the whole promise
("answers save as you give them"). See `docs/PAGE-SPECS.md` §5.

## Feedback tone
Incorrect answers: neutral low tick, calm rationale card, offer a re-roll. Never red, never a
buzzer, never a shake. These students are already anxious about a hard course.
