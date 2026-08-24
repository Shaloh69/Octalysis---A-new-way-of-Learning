# db

Apply in this order. **The order is load-bearing** — `inv_24` calls `sus_score()`, which the
feedback addendum defines.

**Local (Docker) — four files.** Just run `pnpm db:reset`, which does all of this:

```bash
psql "$DATABASE_URL" -f db/local-bootstrap.sql   # 0  LOCAL ONLY
psql "$DATABASE_URL" -f db/schema.sql            # 1
psql "$DATABASE_URL" -f db/addendum-feedback.sql # 2
psql "$DATABASE_URL" -f db/addendum-audit.sql    # 3
```

**Supabase — three files. Skip step 0.** `local-bootstrap.sql` creates the `auth` schema,
`auth.uid()`, and the three roles that Supabase already provides. Running it against a Supabase
project would shadow the real ones, and every RLS test would silently become a lie.

Then:

```sql
select * from run_invariants() where offending_count > 0;
```

On a fresh database the bank-health checks return rows (there are no items yet). That's expected.
Every *structural* check should come back clean.

| File | Contents |
|---|---|
| `local-bootstrap.sql` | **LOCAL ONLY.** `auth` schema shim, `auth.uid()`, the three Supabase roles |
| `schema.sql` | 18 tables, RLS + an explicit `TO` clause on every policy, column grants, 18 seeded stages (21 prereq edges) |
| `addendum-feedback.sql` | `feedback`, `feedback_prompts`, `sus_score()` |
| `addendum-audit.sql` | `audit_runs`, 25 invariant functions, `run_invariants()` |

Corrections already applied are documented in `docs/VERIFICATION.md` — read it before changing
anything it explains, or you'll reintroduce a bug that was already caught.
