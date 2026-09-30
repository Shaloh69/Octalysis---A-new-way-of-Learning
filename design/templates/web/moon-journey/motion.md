# `/app/stage/:id/moon/:objectiveId`: motion

The runner's motion, unchanged (`design/templates/web/stage-check/motion.md`):
a question arriving fades in at `--dur-fast`, the Finish confirmation and the
toast rise at `--dur-fast` / `--dur-base`, the verdict never moves, and every
one of them is a cut under `prefers-reduced-motion`. Asserted:
`web-moon-journey.spec.ts` gate 6, positive control first.

What a journey does NOT have, because it is practice: no Start, so no
transition into full screen; no cover; and Back to the moon is an ordinary
route change back to the map, carried by the shell's warp out (650ms, a cut
under reduced motion).
