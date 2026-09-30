# Clock Bench: motion

**None, by design.** A dial moves under the student's hand (direct
manipulation, not an animation), and the readouts change in place. Nothing
eases, fades or slides, with or without `prefers-reduced-motion`. Asserted:
`web-encounter-drill.spec.ts` gate 6, which checks that turning both dials
starts no animation or transition on the bench. There is no positive control
to run, because there is no motion to control for.

Nothing here is carried by motion alone: every value is printed.
