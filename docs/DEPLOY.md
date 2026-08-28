# DEPLOY.md
### Getting OCTA onto Vercel, Render and Supabase — in order, with the traps named

Everything is free tier: **Vercel Hobby ×2, Render Free ×1, Supabase Free ×1.**
The order below matters — each step needs a value from the one before it.

Budget about an hour. Most of it is waiting for builds.

---

## 0. Before you touch a dashboard

**Rotate the credentials.** The Supabase keys and the database password were
pasted into a chat transcript. Treat all three as compromised:

- Supabase → Settings → API → **roll** the `anon` and `service_role` keys
- Supabase → Settings → Database → **reset** the database password

Do this first, because every step below copies those values somewhere.

Then run the whole gate locally once, so a red build later is a deployment
problem and not a code problem:

```bash
pnpm db:up && pnpm db:reset && pnpm verify
```

---

## 1. Supabase — the database goes first

Everything else needs its URL and keys.

### 1.1 Apply the schema

**Skip `local-bootstrap.sql`.** It creates the `auth` schema and the three roles
Supabase already provides; running it there shadows the real ones and **every
RLS test silently becomes a lie.**

Apply the other five, in this order — the order is load-bearing, twice over
(`inv_24` calls `sus_score()`, and `run_invariants()` registers `INV-31`):

```
db/schema.sql
db/addendum-feedback.sql
db/addendum-submissions.sql
db/addendum-audit.sql
db/addendum-cron.sql
```

`pnpm db:push` does this for you. **Never `db:push:reset` against a project you
care about** — see §6.

### 1.2 Auth settings

| Setting | Value | Why |
|---|---|---|
| Email signups | **Disabled** | Registration goes through `/auth/register`, which claims a roster row. Public signup lets anyone with the URL create an account, and the first thing a stranger finds is a working exam |
| Email confirmations | Disabled | `/auth/register` sets `email_confirm: true` itself |
| Email enumeration protection | **On** | The API already returns one generic message; this closes the same hole at Supabase's layer |
| Redirect URLs | Your two exact Vercel URLs | No wildcards |
| OTP expiry | ≤ 1 hour | |
| MFA on your own account | **On** | You hold the service-role key |

### 1.3 Confirm it before moving on

```bash
pnpm db:invariants     # 23 clean
pnpm test:rls          # 38/38 against the real project
```

**Run the denial suite against Supabase, not just locally.** It is the only
thing that proves RLS is doing its job on the deployment students will use.

---

## 2. Render — the API

Connect the repo; Render reads `render.yaml`. Branch **`main`**.

Use **New → Blueprint**, not New → Web Service. A manually created service ignores
`render.yaml` forever, and you hand-maintain the build command, start command
and health check instead.

Set these in the dashboard — never in the file:

| Variable | Note |
|---|---|
| `DATABASE_URL` | **The POOLER string, port 6543.** Not the direct one. A free instance opening direct connections exhausts Supabase's limit under a class of forty |
| `EXAM_SALT_SECRET` | `openssl rand -hex 32` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | From Settings → API |
| `CRON_SECRET` | `openssl rand -hex 32`. Authenticates Supabase Cron → `/internal/*` |
| `CORS_ALLOWED_ORIGINS` | Both Vercel URLs, comma separated |

**`CORS_ALLOWED_ORIGINS` is the most likely thing to be wrong.** A missing
origin produces a browser CORS failure that looks exactly like the API being
down, and you will spend twenty minutes checking Render before you check this.

### Two things that will fail the build before your code ever runs

**Do not add `corepack enable`.** Render's image has pnpm at `/usr/bin/pnpm` on
a read-only filesystem, and corepack's first act is to unlink the binary it is
replacing:

```
Internal Error: EROFS: read-only file system, unlink '/usr/bin/pnpm'
```

It is also unnecessary — Render reads `packageManager` from `package.json` and
provisions that pnpm itself.

**Node is pinned to 20.18.1**, in `.node-version` and in `render.yaml`. The
`engines` field says `>=20.11.0`, which is an open range, and Render resolved it
to **Node 26** — a version nothing here has ever been tested on. An open engines
range on a host that always takes the newest is a build that changes underneath
you with no commit to blame.

Verify: `curl https://<api>/healthz` → `{"ok":true}`.

---

## 3. Vercel — two projects, one repo

Create **two separate projects** from the same repository.

| | Root directory | Domain |
|---|---|---|
| Student | `apps/web` | the one you give students |
| Console | `apps/console` | anything; it is `noindex` |

Each has a `vercel.json` that sets the build command, the SPA rewrite and
security headers. Set the environment variables from the matching
`.env.example`.

### The setting that makes or breaks a monorepo build

**Settings → General → Root Directory → tick "Include files outside of the
Root Directory in the Build Step."**

Without it Vercel uploads only the root files and the app's own folder — 44 of
this repo's 229 — and **`packages/contracts` and `packages/tokens` are not among
them.** Both are `workspace:*` dependencies of both apps.

The failure is silent and slow, which is what makes it expensive:

```
Downloading 44 deployment files...
Running "install" command: 'cd ../.. && pnpm install --frozen-lockfile ...'
Already up-to-date
```

...and then nothing, until the build times out. `pnpm install` finishing in
under a second on a machine that just said *"Previous build caches not
available"* is the tell: it installed nothing, because from the app folder
`cd ../..` landed somewhere with no workspace in it. There is no error line to
search for.

Count the files in the log against `git ls-files | wc -l`. If it is short, this
is why.

`--prod=false` is on both install commands for the same reason it is on
Render's: `vite`, `tsc` and `vitest` are devDependencies, and a build host that
sets `NODE_ENV=production` makes pnpm skip exactly the tools the build needs.

**Everything with a `VITE_` prefix is public.** Vite inlines it into the bundle
at build time. `pnpm check:env` fails the build if a server-only name appears
with that prefix.

### The Hobby-tier thing to write down

**Preview deployments cannot be password-protected on Hobby.** A preview URL is
unlisted, not protected. Either accept that, or keep previews off. Do not
describe them as private.

---

## 4. Scheduling — all of it on Supabase

**Render Free has no cron jobs.** Every scheduled job runs as `pg_cron` +
`pg_net` from the database. `db/addendum-cron.sql` §5 has the statements; fill
in your API URL and `CRON_SECRET`.

Four jobs:

| Job | When | Why |
|---|---|---|
| Keep-alive → `/healthz` | **Class hours only** | Render sleeps after ~15 min and costs ~60 s to wake. Free tier gives 750 instance-hours; 24/7 burns ~730 of them |
| `recompute_item_stats()` | Nightly | p-value, discrimination, auto-flag after 30 exposures |
| `apply_scheduled_locks()` | Every few minutes | Stage unlock windows |
| `run_invariants_nightly()` | Nightly | Writes to `audit_runs` |

Confirm with `select jobname, schedule, active from cron.job;`

---

## 5. Before you let students in

```bash
pnpm build && pnpm scan:bundle
```

The bundle scan is the permanent guard against the bug this project exists to
fix. It runs two profiles — the student bundle may not contain the database's
answer-key column names; **neither bundle may contain a live answer value**, and
that check pulls real values from the database to search for.

Then, in the console:

1. **Import the roster.** Nobody can register until their ID is on it. Preview
   first — the import is dry-run by default.
2. **Publish items.** The bank is empty. Nothing can be sat until it is not.
3. **Check `/system`** — 23 invariants, live.

And take a backup you have actually restored:

```bash
pnpm backup     # dumps AND rehearses the restore
```

---

## 6. Two things that have already gone wrong

**`db:push:reset` broke the live project once.** `drop schema public cascade`
destroys the `ALTER DEFAULT PRIVILEGES` Supabase attaches to that schema, so
every table created afterwards had no grants and the entire database answered
`42501 permission denied` — to the grading service too. RLS looked perfect;
nothing could reach the tables to be filtered. The script restores default
privileges now, but if you ever reset by hand in the SQL editor, do the same.

It was caught only because the **positive** control tests failed. Denial tests
alone would have passed a database nobody could read.

**Supabase Free pauses after 7 days idle and provides no backups.** The pause
loses nothing but the first request after it fails. Do not assume `pg_cron`
activity resets the timer — that is the assumption most likely to be wrong and
most expensive to be wrong about.

---

## 7. What is not covered, honestly

- **Load test.** 40 concurrent students against the real 512 MB instance has not
  been run. It needs the deployment to exist and cannot be faked on a laptop.
- **The 7-day pause.** Documented, never observed.
- **Off-site backups.** The restore rehearsal is real; the off-site copy is not
  set up. `db/dumps/` is gitignored and on one laptop.
- **Sentry.** `SENTRY_DSN` is wired through the env schema and nothing reads it.

`docs/RUNBOOK.md` is what to do when something breaks in front of a class.
Read it before the first lecture, not during one.
