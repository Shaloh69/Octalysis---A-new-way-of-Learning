# R3.4's loading screens, as frame sequences

`REDESIGN-CLAUDE.md` §2: a transition is captured as a short sequence, not a
still. Written by `design/specs/r3-loading-frames.spec.ts` under `OCTA_CAPTURE=1`
(it asserts on every run and writes only on request; green at 1440 and 380); `sequence.png` and `sequence-380.png` are the contact sheets to open.

- **The realm warp** (`--dur-warp`, 1.1s since 2 Oct 2026): `warp-in-*` and
  `warp-out-*` at 0, 180, ... 1080ms. The frames are exact, not raced: the
  warp's animations are paused the instant it mounts and sought to each time.
  `warp-in-arrival` is the arrival screen the warp clears onto (the planet's
  biome and its caption; `design/templates/web/arrival/`).
- **The biome arrival** on a deep link with the stage held open:
  `arrival-0100` (the biome, no skeleton), `-0700` (skeleton), `-3300` (the
  words), `-landed` (the reading).

Found by these frames and nothing else, 2 Oct 2026: on a deep link with an
empty browser cache the first frames paint the fallback biome, and the
planet's own biome replaces it about half a second later (`arrival-0100` vs
`-0700`). Recorded in `docs/NEXT-SESSION.md` §0z.
