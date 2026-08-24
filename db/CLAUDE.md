# db — Supabase Postgres

Apply in order. **The order is load-bearing** — `inv_24` calls `sus_score()`, defined in the
feedback addendum.

**Local (Docker):** `pnpm db:reset` runs all four.
```
local-bootstrap.sql -> schema.sql -> addendum-feedback.sql -> addendum-audit.sql
```

**Supabase: skip `local-bootstrap.sql`.** It creates the `auth` schema, `auth.uid()`, and the
three roles that Supabase already provides. Running it there shadows the real ones and every RLS
test silently becomes a lie.

## Corrections already applied (see docs/VERIFICATION.md)
- **V-1** `stages.gradeable`; Stage 00 is `false`; blueprint sampling excludes it
- **V-2** role changes blocked by the `profiles_no_self_promote` TRIGGER, not by a
  self-referencing RLS policy (a policy that selects from its own table recurses)
- **V-3** `items.family_id` is the stable identity across versions; `items.id` is per-version;
  `attempt_items` references `items.id` only — there is no `item_version` column
- **V-4** no client INSERT policy on `responses` or `attempt_items`, deliberately
- **V-7** `cb_read` checks `stages.published` as well as `is_stage_unlocked()`

## Applied — third and fourth verification passes

All thirteen third-pass findings are **applied directly in `schema.sql`** (there is no deployed
database to migrate, so they went into the file rather than an addendum). The fourth pass added
three more, found by running the schema rather than reading it. Full record in
`docs/VERIFICATION.md`.

**Three Postgres semantics this schema has already been bitten by. Do not undo these:**

1. **`nullif(current_setting('x', true), '')` before every cast.** A rolled-back custom GUC reverts
   to the empty string, not NULL. `''::jsonb` raises — inside `jwt_role()`, inside `is_staff()`,
   inside nearly every policy, on any pooled connection. (V-28)
2. **Column privileges are additive to table privileges.** `revoke select (seed)` did nothing while
   table-level SELECT was granted. The table grant is revoked and readable columns are granted back
   by name; a column added later is unreadable to students until granted. (V-29)
3. **A policy's subqueries are subject to RLS.** `rs_own` joined to the staff-only `blueprints` and
   therefore denied everything for students, silently. Checks that must see a staff-only table go
   in a `security definer` helper — `attempt_withholds_verdict()`, like `is_stage_unlocked()`. (V-30)

**`assessment_secrets` has a `using(false)` deny-all policy, not zero policies.** RLS-on-with-no-
policy would also be service-role-only, but INV-02 flags it and the intent would be inferred from
an absence. The explicit policy writes it down.

## Invariants
Every structural rule that CAN be a constraint SHOULD be a constraint. `run_invariants()` is for
rules a constraint cannot express. Do not write a checker for something a unique index already
guarantees.

## Never
- Disable RLS "temporarily" to debug. Use the service role in a scratch branch instead.
- Add an UPDATE or DELETE path to `responses`. Corrections void an attempt; they never edit
  history.
- Add a client INSERT policy to `responses` or `attempt_items`.
- Drop an item row. Retire it.
