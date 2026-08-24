---
paths: ["services/api/src/engine/**", "services/api/test/engine*"]
---
# Question engine rules

This code decides real students' grades. A subtle bug here is invisible: every number will look
plausible.

1. **Determinism is non-negotiable.** `Math.random` is banned. Use the seeded PRNG and consume
   the stream in a defined order so a seed reproduces a paper byte-for-byte.
2. **Uniqueness without equivalence is unfair.** Every paper must satisfy every blueprint
   constraint cell exactly. An unsatisfiable blueprint THROWS, naming the cell and the shortfall.
   It never silently under-fills.
3. **Distractors encode real misconceptions** — wrong unit scale, inverted ratio, off-by-one bit
   width. Never a random number near the answer. Name the misconception in a comment.
4. **No function in this directory may return a correct answer** to a caller that serves students.
5. **Answer position must be uniformly distributed** across papers. If the correct option lands
   at B 40% of the time, students find it by week 4.
6. **Pin behavior to `attempts.engine_version`.** Never change a solver in place; add a version.
7. Sampling excludes stages where `gradeable = false` (Stage 00).

Worked example that must pass, taken from the instructor's own deck:
- cycle time: 133 MHz -> 7.52 ns
