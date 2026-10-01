# The arrival screen: motion

Follows the realm warp into a planet or moon (`RealmWarp`, now `--dur-warp`,
1.1s, lengthened by the instructor on 2 Oct 2026 "to last a bit longer").

- **In:** the screen is already mounted under the warp's cover when the warp
  clears, so the biome and the caption are revealed, not animated in. The
  shell's bars and the page are hidden underneath.
- **The ring turns** once per `--dur-bringup` while the screen waits.
- **Out, seamless:** on Continue, a click, any key, or after `--dur-arrival`
  (6s, reading time), the caption fades out over `--dur-base` (240ms) while
  the bars and the page fade in over it; the biome behind never moves.

**`prefers-reduced-motion`:** no warp (it was already a cut); the arrival cuts
in; the ring is still (its duration is a motion token, 0 under the setting);
the hand-over to the page is a cut (`--dur-base` is 0). The reading time is NOT a
motion token and is unchanged: the facts are content.

Asserted (`design/specs/web-arrival.spec.ts`): gate 6, reduced motion
emulated, no warp and no animation over 1ms inside the screen; "the warp is
longer now", the warp's animation measured at 1.1s. Nothing is carried by
motion alone: every word is on the panel and announced by `role="status"`.
