# `/app` — the 3D map, and the only map — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §0.3-§0.5). Templates:
`template.png` (Starfield's system map: the system centred, a SYSTEM and a BODY
panel on the left, a key-hint bar bottom right) and `template-zoom.png` (the
same panel after zooming into a body). Both copied from
`_direction/star/` (sources, statuses and what they show are in
`_direction/SOURCE.md`); both opened before use. Gate:
`design/specs/web-app.spec.ts`. Replaced `solar-system.spec.ts`,
`before-baseline.spec.ts` and `web-map.spec.ts`, whose subject (the flat map
and its ladder) is removed.

## Realm

The star system: `html[data-realm="star"]`, no `data-biome`.

## What it shows

- **The scene** (`map/StarMapScene.tsx`, lazy, `aria-hidden`): the sun, one
  orbit ring per planet radius, 19 planets on circular orbits (radius = the
  stage's level, `computeSolarLayout`) moving by Kepler's third law
  (`solar-system/orbit.ts`, 6 unit tests), each tinted by its OWN biome
  (`--biome-planet-<biome>`, per planet since 30 Sep); locked planets drawn in
  `--locked`; a ring on mastered planets; the student's next stage ringed in
  their accent (their own place, never a state); the chosen planet's reticle,
  moons and name tag. The camera fits and centres the system in the space the
  panels leave (measured), eases to a chosen planet, and yaws on drag.
- **SYSTEM panel** (the accessible layer): designation, planet count, the
  course, the row of bodies (one radio per planet, grouped by act, named
  "Stage 04 · Cache Memory, locked"), a key to the rings, course mastery as a
  printed meter, and the next stage.
- **BODY panel**: the planet's name, stage and act, its mastery meter (or "Not
  graded"), a stat table (state in words with a padlock when locked, levels,
  kind, time, check), the lock's reason verbatim, the approved summary, its
  moons (objectives, in the syllabus's order), and Enter journey (open) or
  Show Stage NN (locked). A bottom sheet on a phone.

## Moons (R4.2, R4.3, R4.6; WEB-REVAMP 3.1-3.3, 3.7a, 3.10; 30 Sep 2026)

- **A gradeable planet's moons are its objectives**, in the syllabus's order,
  drawn while the planet is chosen, each on its own circular orbit by the
  planets' Kepler law. **Three states, one level down from a planet's**: dim
  (nothing right yet, drawn in `--locked`), a partial glow (one question right),
  a full glow with a ring (mastered: 2 different questions right). Every fact
  is the server's (`correct`, `mastered`, `questions` per objective, 3.7a); the
  client names and draws it, and decides nothing
- **The planet panel** says "N of M subtopics mastered" (the server's count)
  and lists each moon as a button: a shape (empty, half, full circle), its
  code, the syllabus's words, and its state in words ("Not started", "1 of 3
  right", "Mastered", "No questions yet")
- **Choosing a moon** (its button, or the moon in the scene) updates the panel
  IN PLACE (3.2): "Moon NN.N", "Circles Stage NN", the objective, its mastery,
  **Enter journey** into `/app/stage/NN/moon/NN.N` (practice, never graded;
  `design/templates/web/moon-journey/`), and Back to Stage NN. Enter is
  **disabled with the reason beside it** when the planet is locked (its
  `lockReason`, verbatim) or the moon has no questions yet (fail-closed). No
  minigame is named: none is placed on a moon yet (3.6 awaits approval)
- **Escape, Close and Back step out one level**: moon, then planet, then the
  system (3.3). `?stage=NN&moon=NN.N` is a bookmark; a journey's Back to the
  moon lands on it
- **Orientation has no moons**: its objectives are listed as text under
  "Objectives" with no count and nothing to choose, and the scene draws a
  seeded belt of grey, irregular, unlit rocks (3.10) that no click can pick.
  A `moon=00.N` link names no moon
- `/app/stages` shows the same moon rows as text, with the same states (R4.4)

## Controls, against the mandate's four tests

| Control | Consequence | Legible | Reversible | Teaching |
|---|---|---|---|---|
| A planet in the row (radio; arrows move) or in the scene (click/tap) | shows that stage's facts, zooms to it | its name and state in words | Close, Escape, Back | where the stage sits: level by ring, order by angle |
| Close (×, Escape) | returns to the whole system | yes | choose again | — |
| Enter journey | into the planet, through the warp | yes | Leave planet | — |
| Show Stage NN (locked) | selects the stage this one waits for | yes | Back | the prerequisite chain |
| A moon (its button in the panel, or in the scene) | shows the moon in place: objective, mastery, Enter journey; the camera eases to it | code, words and state in words | Escape, Close, Back to Stage NN, Back | what this subtopic is and how far along it is |
| Enter journey (a moon) | into the moon's journey: practice on its own questions | yes; disabled with the reason when it cannot open | Back to the moon | the objective's questions, with a verdict and why at once |
| Back to Stage NN (a moon) | steps out to the planet | yes | choose the moon again | — |
| Next: Stage NN | selects the next stage | yes | Close | what to do next |
| Drag | spins the system | the picture moves | Reset view (R) | none claimed; cosmetic |
| Key hints: Enter journey, Close, Stages (S), Reset view (R) | as the key | label and cap | per action | — |

Removed by ruling 2: the flat map (`/app/map` redirects here), its Settings
override, the "Show connections" toggle and the first-run placeholder tour.

## States

Loading: the page skeleton until the map arrives (the shell fetches it once).
Error: `ErrorState` with Try again. No WebGL: the scene is not drawn, a line
says so, every panel and control remains. Low frame rate: lower quality for
seven days, never the map. A phone: the scene stays; panels become a top strip
and a bottom sheet; choosing a planet folds the system panel to its caption.

## Captures, moons (30 Sep 2026, build at 5185, reduced motion; all opened)

`current-moons` (stage 01, its moons in every state: the stages payload is
patched for 01 only, as `web-app.spec.ts`'s `moonsInEveryState` does, because
locally no question is live), `current-moon` (01.2, one right), `current-moon-empty`
(01.5, no questions yet), `current-moon-locked` (04.1, real data: the planet's
own reason), `current-asteroids` (Orientation's belt), `current-moons-11`
(stage 03, eleven moons, real data); each at 1440 and `-380`.
