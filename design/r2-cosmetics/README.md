# `design/r2-cosmetics/` — two students, one curriculum

The picture R2's definition of done asks for: two seeded students side by side,
so it is visible that their systems look different and their map does not.

Regenerate with `pnpm qa design/specs/cosmetics.spec.ts`. Both students are
rows from `db/demo-seed.sql` — fixture data, no real names.

| | Student A (`232129001`) | Student B (`232129006`) |
|---|---|---|
| Palette | `v3` — magenta | `v1` — cyan |
| Biome | cave | desert |
| Rotation | 2.997 rad | 3.745 rad |
| Callsign | `HARBOUR-59` | `SEXTANT-BD` |
| **Stages** | **19, same titles, same order** | **19, same titles, same order** |
| **Locks** | server-derived | server-derived |

The whole redesign rests on that last block being identical while the rows above
it are not.

## What these captures caught that no test did

**Three times, the seeding silently did nothing and everything stayed green.**

1. `data-planet` was set on the map's own `<div>`, but the canvas resolves
   tokens from `document.documentElement` — so it read nothing and used its
   hardcoded fallback.
2. Fixed, and still white: the canvas caches its colours in `useMemo(…, [])` at
   mount, before the cosmetics fetch lands.
3. Fixed, and *still* white — the real cause. `tokenColor` did
   `new THREE.Color(raw)`, and every token in this project is authored in
   **OKLCH**, which three.js's colour parser does not understand. Every read
   threw, hit its catch, and returned the fallback. **The 3D layer had never
   used a design token at all**, since the galaxy was written.

None of that is visible to any gate: `scan:palette` passes (no literal hex),
`check:contrast` passes (the tokens were fine — they were just never reaching
the scene), and all three are valid TypeScript. It took two students rendering
identically in a screenshot.

`SolarSystemCanvas.tsx` now converts by painting one pixel to a 1×1 canvas and
reading it back, so the browser does the colour maths — which also avoids a
second copy of OKLCH→sRGB drifting from the one in `scripts/check-contrast.mjs`.
