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

## Controls, against the mandate's four tests

| Control | Consequence | Legible | Reversible | Teaching |
|---|---|---|---|---|
| A planet in the row (radio; arrows move) or in the scene (click/tap) | shows that stage's facts, zooms to it | its name and state in words | Close, Escape, Back | where the stage sits: level by ring, order by angle |
| Close (×, Escape) | returns to the whole system | yes | choose again | — |
| Enter journey | into the planet, through the warp | yes | Leave planet | — |
| Show Stage NN (locked) | selects the stage this one waits for | yes | Back | the prerequisite chain |
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
