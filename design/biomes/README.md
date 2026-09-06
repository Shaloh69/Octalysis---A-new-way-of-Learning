# `design/biomes/` — all seven landing biomes, one capture each

Captured 2 September 2026 by `design/specs/biomes.spec.ts`, which sets
`<html data-biome>` directly rather than re-seeding a student, so the set is
deterministic and does not depend on which biome the cosmetic endpoint happens
to hand out.

| Capture | State |
|---|---|
| `neutral.png` `desert.png` `jungle.png` | **Render.** All three composed from Kenney Background Elements (CC0), with `LICENSE-kenney.txt` beside the art in each directory. 23 KB total |
| `volcanic.png` | **Renders procedurally**, from tokens. The one named exception in `BIOME-AND-LOADING-SPEC.md` §2, where no cleanly-licensed pack exists yet |
| `arctic.png` | **Renders.** Admurin's Snowy Mountains — not CC0, terms verbatim in the pack directory |
| `ocean.png` | **Renders.** ansimuz's Underwater Fantasy — permissive, terms verbatim in the pack directory |
| `cave.png` | **Draws nothing.** No approved source: the pack §2 named is do-not-use over an unresolved licence conflict |

## The five blanks are the point

The one blank is `cave`, and that is the design working rather than failing.

§2 was revised to forbid a gradient stand-in for an un-sourced biome, because
**a gradient looks finished**. A tinted rectangle where the art should be is
indistinguishable from a completed biome, so it would be reviewed, approved, and
quietly shipped as done. Rendering nothing is legible: it is obvious at a glance
that five biomes are outstanding.

`biomes.spec.ts` asserts both halves — that the five draw nothing, and that
`neutral` *does* draw. The second is what stops the first passing for the boring
reason that the scene is broken everywhere.

## What is left

Art for `arctic` and `ocean` — their packs are approved but itch.io downloads
need a browser session rather than a fetch. And a **replacement source for
`cave`**, which has none: the pack §2 named is do-not-use over an unresolved
licence conflict.

Two packs the spec named could not be used at all — see
`BIOME-AND-LOADING-SPEC.md` §2a.
