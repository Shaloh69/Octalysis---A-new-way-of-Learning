---
paths: ["db/**", "services/api/**"]
---
# Authorization rules

Testing that the right user succeeds proves nothing. For every policy, write and RUN the test
that proves the wrong user is blocked — and watch it fail before you make it pass.

The denial matrix is `docs/AUDITS.md` §3.1. Bold cells are the ones that matter. The lock truth
table is §3.2 — test at the boundary second on `unlock_at` and `lock_at`, not a minute either
side.

Six denials that must always hold:

1. A student cannot SELECT from `items` at all
2. A student cannot read `attempt_items.correct_value` while `status='in_progress'`
3. The same student CAN after `status='submitted'`
4. A student cannot change their own `profiles.role`
5. A student cannot read `content_blocks` for a locked OR unpublished stage
6. A student cannot read another student's attempts, responses, or progress

Anything enforceable by a constraint, trigger, or hook should be — not by a comment asking nicely.
