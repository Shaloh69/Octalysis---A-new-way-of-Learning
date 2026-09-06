# `design/biomes/` — all seven landing biomes, one capture each

Captured 2 September 2026 by `design/specs/biomes.spec.ts`, which sets
`<html data-biome>` directly rather than re-seeding a student, so the set is
deterministic and does not depend on which biome the cosmetic endpoint happens
to hand out.

| Capture | State |
|---|---|
| `neutral.png` | **Renders.** Five vendored Kenney layers — clouds, trees, grass — with `LICENSE-kenney.txt` beside them in `public/biomes/neutral/` |
| `volcanic.png` | **Renders procedurally**, from tokens. The one named exception in `BIOME-AND-LOADING-SPEC.md` §2, where no cleanly-licensed pack exists yet |
| `jungle.png` `arctic.png` `ocean.png` `desert.png` `cave.png` | **Draw nothing.** Their packs are chosen and licence-checked but not vendored |

## The five blanks are the point

They are byte-identical at 63,584 bytes, and that is the design working rather
than failing.

§2 was revised to forbid a gradient stand-in for an un-sourced biome, because
**a gradient looks finished**. A tinted rectangle where the art should be is
indistinguishable from a completed biome, so it would be reviewed, approved, and
quietly shipped as done. Rendering nothing is legible: it is obvious at a glance
that five biomes are outstanding.

`biomes.spec.ts` asserts both halves — that the five draw nothing, and that
`neutral` *does* draw. The second is what stops the first passing for the boring
reason that the scene is broken everywhere.

## What is left

Vendoring art for the five. That needs a scoped download permission
(`REDESIGN-CLAUDE.md` §1b) and one licence problem resolved first: **cave's
chosen pack is marked do-not-use** and needs replacing.
