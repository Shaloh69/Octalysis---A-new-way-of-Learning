# LOCAL-STACK.md — running OCTA on a developer machine

Split out of root `CLAUDE.md` on 7 September 2026. That file is loaded at the
start of **every** session, and Anthropic's own guidance is to keep it under
200 lines with universal rules at the root and conditional detail in scoped
files (`REDESIGN-CLAUDE.md` §2c rule 6). None of this is needed to write a
component; all of it is needed the moment the database or the API misbehaves.

**Read this when:** the stack will not start, a gate fails for no reason you can
see, or you are applying SQL by hand.

## Local stack — production runs here until cloud projects exist

```bash
pnpm db:up      # Postgres 16 in Docker on :54329
pnpm db:reset   # drop, recreate, apply all SIX SQL files, run invariants
pnpm dev:api    # the API on :8090, configured for LOCAL auth  <- not `pnpm dev`
pnpm test:rls   # the 38-test denial suite
pnpm verify     # typecheck + tests + invariants
```

**Use `pnpm dev:api`, not the raw dev script.** Root `.env` describes the
*deployed* service, and starting the API from it fails three ways that all look
like application bugs: it has no `SUPABASE_JWT_SECRET` (so every dev token is
rejected), it *does* have `SUPABASE_URL` (which switches `identityFrom()` to
asymmetric JWKS and rejects HS256 dev tokens with `unacceptable alg: HS256`),
and its `CORS_ALLOWED_ORIGINS` is pinned to 5173/5174 while Vite may be on 5183.
`scripts/dev-api.mjs` fixes all three and refuses to run under
`NODE_ENV=production`. **Port 8080 is another project's Adminer on this machine**
— it answers 200 with an HTML login page, so `apps/web/.env.example`'s
`VITE_API_URL=http://localhost:8080` is wrong locally.

**Reseed with `node scripts/db-demo.mjs`.** It refuses to run over attempt
history from another user and tells you to `pnpm db:reset` first — because
`responses` is append-only (hard rule 7), so a seed cannot purge it. It used to
try, get blocked by the trigger, and abort *halfway*, leaving a database that
presented as "stage 00 is locked".

Apply order is load-bearing: `local-bootstrap.sql` → `schema.sql` → `addendum-feedback.sql` →
`addendum-submissions.sql` → `addendum-audit.sql` → `addendum-cron.sql`. **Six files, not
five** — this said five and omitted `addendum-submissions.sql`, which holds labs, project
and participation. `scripts/db-reset.mjs` is the authority and always applied it; anyone
applying to Supabase BY HAND from this list would have skipped 40% of the grade.
**`local-bootstrap.sql` is LOCAL ONLY** — it supplies the `auth` schema and
the three roles that Supabase provides; running it against a Supabase project would shadow the
real ones and every RLS test would become a lie.

Three Postgres semantics this project has already been bitten by — see `VERIFICATION.md` fourth pass:

1. **Always `nullif(current_setting('x', true), '')` before casting.** A rolled-back custom GUC
   reverts to `''`, not `NULL`, and `''::jsonb` raises inside every policy.
2. **Column privileges are additive.** `revoke select (col)` does nothing while table-level
   `SELECT` is granted. Revoke the table, grant the columns back by name.
3. **A policy's subqueries are subject to RLS.** If a `USING` clause reads a staff-only table, use
   a `security definer` helper or it will silently deny everything.

---

## Ports on this machine, and the two that lie

| Port | What is there |
|---|---|
| `54329` | `octa-db`, Postgres 16 in Docker |
| `8090` | the API — **`pnpm dev:api`** |
| `5183` | `apps/web` (5173 belongs to another project) |
| `5174` | `apps/console` |

**`8080` is another project's Adminer.** It answers **200** with an HTML login
page, so every "is the API up?" check passes while nothing works. Both
`.env.example` files pointed at it until 7 Sep.

**`5173` is another project's app.** It answers 200 and renders an `<h1>`, so a
full Playwright run once passed against it — seven of its pages came within one
commit of being committed as OCTA's biomes. `design/global-setup.ts` now refuses
to run against an app whose title is not OCTA.

## Docker is unstable here

Docker Desktop crashed **twice in one session** on 7 Sep. When it is down,
`pnpm verify`, `pnpm qa` and the invariants all fail in ways that look like code
failures — one full `pnpm qa` reported 86 failures purely because the database
had gone. **`docker ps` before believing a red run** (§2c rule 4).

## After `pnpm verify`, reseed

The API test suite truncates fixtures. `node scripts/db-demo.mjs` restores them
and prints the counts; it exits non-zero if objectives fall under 100, because a
seeded database with 4 objectives looks fine until the map is empty.
