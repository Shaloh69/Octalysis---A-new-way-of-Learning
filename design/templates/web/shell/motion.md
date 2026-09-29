# The shell — motion

| Moment | What moves | Duration | Reduced motion |
|---|---|---|---|
| Star → biome (a stage link, Continue, a bookmark followed by Back) | `RealmWarp`: an opaque cover appears on the new realm's FIRST frame (a layout effect, before paint), streaks rush outward, the cover clears | 650ms | **none**: a cut in one frame |
| Biome → star (Leave planet, Back) | the same cover, streaks drawing back in | 650ms | **none** |
| A deep link or reload | nothing: nothing was travelled | — | — |
| Tab hover, button hover | background colour | `--dur-fast` (160ms) | none |
| Report dialog | the scrim fades in | `--dur-base` (240ms) | none |
| Skeletons | a shimmer | `--dur-bringup` loop | stopped |

Motion is never the only signal: the nav's words change with the realm
(the tab strip, or "Leave planet" and the planet's name).
`web-shell.spec.ts` asserts the warp's direction both ways, no warp on a deep
link, and none under `prefers-reduced-motion`.
