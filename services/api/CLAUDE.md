# services/api — Fastify on Render

Owns everything a student must not be able to compute: paper generation, grading, lock
resolution, role assignment, roster claims.

## Serialization
There is exactly ONE serializer for student-facing item payloads, in `src/serialize/student.ts`.
Every student route uses it. Never strip `correct_value` ad hoc per endpoint — that is how a leak
gets shipped.

## Engine
`src/engine/{seed,solvers,resolve,blueprint,grade}.ts`

- `seed`: splitmix64. **`Math.random` is banned in this directory.**
- Determinism is a hard requirement: same seed + same `engine_version` = byte-identical paper.
- `attempts.engine_version` pins the solver registry version. Old versions are kept forever.
- Every distractor comes from a real student misconception, never a random number near the
  answer. Name the misconception in a comment.
- Blueprint sampling excludes stages where `gradeable = false`.

## Assembly interpreter
Stage 15 is TASM x86-16 (see docs/TOOLCHAIN-CORRECTION.md), NOT MARIE. The interpreter lives in
`src/engine/x86/` and must be deterministic — Stage 15 items are graded by running a program
server-side and comparing register state. Same program + same seeded inputs = same final state,
always.

## Errors
`{ error: { code, message } }`. Auth failures use ONE generic message for unknown-user and
wrong-password alike — no enumeration. Same for unknown vs already-claimed student IDs.

## Rate limits
`/auth/resolve` 5/min/IP. `/attempts` 10/min/user. Roster import: staff only, dry-run by default.

## Render specifics
Free tier sleeps after ~15 min; a cold start mid-lecture is the worst failure mode in this
system. `/healthz` must stay trivially cheap. A cron pings it during class hours.
