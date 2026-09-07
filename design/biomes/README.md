# `design/biomes/` — all seven landing biomes, one capture each

Re-capture with **`node scripts/capture-biomes.mjs`**, which sets
`<html data-biome>` directly rather than re-seeding a student, so the set is
deterministic and does not depend on which biome the cosmetic endpoint happens
to hand out. It prints the layer shape per biome as it goes, because the
interesting failure is not a crash — it is a biome quietly drawing four layers
when its manifest declares five, which looks fine in a screenshot.

**Check the port.** A different Vite project on 5173 answers 200, renders an
`<h1>` and screenshots happily; seven EngiRent pages once came within one commit
of being committed here as OCTA's biomes. Both the script and
`design/global-setup.ts` refuse to run against an app whose title is not OCTA,
but pass `OCTA_WEB_URL` if this project is not on the default port.

## What is here

Captured 7 September 2026. **All seven are pre-cut parallax packs** — none is
composed from loose elements any more, and none is procedural.

| Capture | Pack | Licence |
|---|---|---|
| `neutral.png` | MatiasVME, *Parallax background forest*, 8 layers | CC0 |
| `jungle.png` | ansimuz, *Forest Background*, 4 layers | CC0, confirmed twice |
| `desert.png` | Emcee Flesher, *Rocky desert landscape*, 4 layers | CC0, chain walked to Quantiset's CC0 original |
| `arctic.png` | Admurin, *Snowy Mountains*, 5 layers | **Not CC0** — terms verbatim in the pack directory |
| `ocean.png` | ansimuz, *Underwater Fantasy*, 4 layers | Permissive, not CC0 — terms verbatim in the pack directory |
| `cave.png` | ansimuz, *Warped: Super Grotto Escape*, 3 layers | CC0, confirmed twice |
| `city.png` | FabinhoSC, *Skyline Background*, 5 layers | CC0, confirmed twice |

Every biome directory ships a `LICENSE.txt` that travels with the art.

## What these captures are for

**Comparing compositions, not admiring them.** `BIOME-AND-LOADING-SPEC.md` §2c
requires that no two biomes share a structure, and the test is to desaturate all
seven: if two are hard to tell apart in greyscale, the palette is doing work the
composition should. That is why the set is captured at one width, in one run,
from one script.

## What this file used to say, and why that matters

It described **five blank captures** and explained at length why rendering
nothing was better than a gradient stand-in — because a gradient looks finished,
so an un-sourced biome would be reviewed and shipped as done. Then it listed the
outstanding work: art for `arctic` and `ocean`, and a replacement source for
`cave`.

All of that had been finished for days while this file still said otherwise, and
its "What is left" section was the most confidently wrong part of it. The rule it
was defending is still live — `PROCEDURAL` in `BiomeScene.tsx` is empty and kept
empty so the next unsourceable biome must opt in by name, and `biomes.spec.ts`
still asserts that a biome with no art draws nothing. What is gone is the
backlog, not the principle.
