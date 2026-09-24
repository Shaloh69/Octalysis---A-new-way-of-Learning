# MIGRATE-HOSTING.md
### Moving OCTA to new Vercel, Render and Supabase accounts

`DEPLOY.md` is how you deploy OCTA the first time. **This is how you move it**,
which is a different job: every key changes, four things have to learn each
other's new addresses, and there is an old deployment to retire without
stranding anyone.

Read `DEPLOY.md` §2's build traps and §3's monorepo Root Directory setting
before you start. They are not repeated here and they will both bite on a fresh
account, because a new account has no build cache and no saved settings.

Budget **90 minutes**, most of it waiting.

---

## 0. What actually has to move

| | Moves | Why |
|---|---|---|
| Git repository | **No** | Both hosts build from `github.com/Shaloh69/Octalysis---A-new-way-of-Learning`, branch `main`. Only the connection changes |
| Supabase project | **Your call — see below** | |
| Vercel projects x2 | Yes, recreated | Projects cannot be transferred between personal accounts |
| Render service | Yes, recreated | |
| Student data | **Nothing to move** | Measured 23 Sep 2026: 0 profiles, 0 attempts, 0 responses on the live project |

**Take the new Supabase project.** Not because migrating is hard, but because
there is nothing on the old one to lose and the old one is wrong anyway: 21
public tables where the schema defines 22 (`submissions` — 40% of the grade),
and 18 stages where the curriculum has 19. You would be migrating a stale schema
and then fixing it. A fresh project is fewer steps and ends somewhere known.

If you keep the old Supabase project, skip §2.1 and use its existing values —
but run `node scripts/db-push-supabase.mjs --check` first and expect the same
21/18 counts, which means §2.3's push is still required.

---

## 1. Before you open any dashboard

```bash
pnpm db:up && pnpm db:reset && pnpm verify
```

Green locally first, so a red build on a new account is a hosting problem and
not a code problem. If `pnpm db:reset` fails on an image pull, **Docker Desktop
has stopped** — it does that silently and the error reads like a build failure.

Then copy the four templates:

```bash
cp deploy/local-admin.env.example    deploy/local-admin.env
cp deploy/vercel-web.env.example     deploy/vercel-web.env
cp deploy/vercel-console.env.example deploy/vercel-console.env
cp deploy/render-api.env.example     deploy/render-api.env
```

`deploy/*.env` is gitignored. You fill each in as the values appear — they do
not all exist yet, which is why the order below matters.

---

## 2. Supabase first — everything downstream needs its URL and keys

### 2.1 Create the project

New organisation, new project. **Region: Southeast Asia (Singapore)** to match
`render.yaml`; a database on one continent and an API on another adds a round
trip to every query.

Save the database password when it is shown. It is shown once.

### 2.2 Collect the values

| Where in Supabase | Goes into |
|---|---|
| Settings → Data API → Project URL | `SUPABASE_URL`, `VITE_SUPABASE_URL` |
| Settings → API Keys → anon / publishable | `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` |
| Settings → API Keys → service_role / secret | `SUPABASE_SERVICE_ROLE_KEY` — **API and your laptop only** |
| Settings → API → JWT Settings → JWT Secret | `SUPABASE_JWT_SECRET` |
| Connect → Session pooler, port **5432** | `DATABASE_URL` in `local-admin.env` |
| Connect → Transaction pooler, port **6543** | `DATABASE_URL` in `render-api.env` |

**The two pooler strings are different and you need both.** The scripts run DDL
and bulk inserts and want a session connection; a free Render instance opening
direct connections exhausts Supabase's limit under a class of forty. The direct
`db.<ref>.supabase.co` host is IPv6-only and will not resolve on many networks —
that failure reads as "the project is down" when it is not.

### 2.3 Push the schema and the content

```bash
set -a; . deploy/local-admin.env; set +a

node scripts/db-push-supabase.mjs --check     # confirm WHICH project answers
node scripts/db-push-supabase.mjs --reset     # applies five files
node scripts/sync-content.mjs                 # 19 stages, 115 objectives
node scripts/sync-items.mjs                   # 183 items, all `review`
node scripts/sync-assessments.mjs             # 2 exams + 8 stage checks
```

**Run `--check` first, every time.** It applies nothing and prints the project
ref it reached. `--reset` runs `drop schema public cascade`; on a brand-new
project that costs nothing, and pointed at the wrong project it is
unrecoverable.

`--reset` is also why the admin comes later — it would delete one created now.

**`local-bootstrap.sql` is never applied to Supabase.** It supplies the `auth`
schema and three roles Supabase already provides; applying it shadows the real
ones and every RLS test silently becomes a lie. The push script skips it — do
not add it by hand in the SQL editor.

### 2.4 Confirm before moving on

```bash
node scripts/db-invariants.mjs   # 28 registered, 0 failures
pnpm test:rls                    # 38/38 against the real project
```

The denial suite against Supabase — not just locally — is the only thing that
proves RLS works on the deployment students will actually use.

### 2.5 Auth settings

`DEPLOY.md` §1.2 has the full table. Two entries matter most on a move:

- **Email signups: Disabled.** A fresh project defaults to enabled, and the
  first thing a stranger who finds the URL can do is create an account.
- **Redirect URLs** must be the **new** Vercel domains. You do not have them
  yet; come back at §4.6.

---

## 3. Render — the API

Connect the repository. **New → Blueprint, not New → Web Service.** A manually
created service ignores `render.yaml` forever and you hand-maintain the build
command, start command and health check instead.

Branch `main`. Paste `deploy/render-api.env` into Environment → Add from .env.

`CORS_ALLOWED_ORIGINS` cannot be right yet — the Vercel URLs do not exist.
Put a placeholder, deploy, and come back at §4.5. **This is the single most
likely thing to be wrong at the end of a migration**, because it is the only
value that depends on a step happening after it.

When the build finishes:

```bash
curl https://<your-new-api>.onrender.com/healthz
```

You want `{"ok":true,"version":"1.0.0","env":"production"}`.

**An HTML body means you are not looking at OCTA.** A 404 page from some other
service on a guessable hostname looks superficially like a deployment that
exists. OCTA's own 404 is
`{"error":{"code":"not_found","message":"No such endpoint."}}`.

Write that URL into `VITE_API_URL` in both Vercel env files now.

---

## 4. Vercel — two projects from one repository

### 4.1 Create both

| Project | Root Directory | Notes |
|---|---|---|
| `octa-web` | `apps/web` | the URL students get |
| `octa-console` | `apps/console` | `noindex`; staff only |

### 4.2 The setting that decides whether the build works at all

**Settings → General → Root Directory → tick "Include files outside of the Root
Directory in the Build Step."** On both projects.

Without it Vercel uploads the root files and the app folder only — and
`packages/contracts` and `packages/tokens`, `workspace:*` dependencies of both
apps, are not among them. The build does not error. It prints `Already
up-to-date` from an install that installed nothing, then hangs until it times
out. A new account has no saved setting to inherit, so this is a fresh trap on
every migration. `DEPLOY.md` §3 has the full tell.

### 4.3 Environment variables

Import `deploy/vercel-web.env` and `deploy/vercel-console.env`. Apply to
**Production, Preview and Development**, then **redeploy** — Vite inlines
`VITE_*` at build time, so changing a variable without rebuilding changes
nothing at all.

**Set every variable, and never to an empty string.** The current deployment has
`VITE_API_URL=""`, and empty is not the same as unset: `VITE_API_URL ?? "..."`
only falls back on nullish, so the bundle carries neither a host nor the
fallback, and every `/api/v1` call resolves against the Vercel origin — where
the SPA rewrite returns `index.html` with **HTTP 200 and `text/html`**, which
the client then tries to parse as JSON.

Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` is quieter still: the
sign-in form answers *"Sign-in is not configured on this build. Ask your
instructor."* and makes no network request at all. Both of those are the live
site's behaviour today, measured 23 Sep 2026.

### 4.4 Turn off Deployment Protection on the console

**Settings → Deployment Protection → Vercel Authentication → Disabled.**

While it is on, the console redirects to `vercel.com/login` and only someone
signed into the Vercel *team account* can open it. No instructor can. That is
the current state of the existing console deployment.

Hand people the **production domain**. A URL carrying a deployment hash —
`octa-console-<hash>-<team>.vercel.app` — is a per-deployment preview address
that changes every time you push.

### 4.5 Back to Render

Set `CORS_ALLOWED_ORIGINS` to both real Vercel origins, comma separated, no
trailing slashes, no paths. Redeploy.

A missing origin produces a browser CORS failure that looks exactly like the API
being down, and you will check Render for twenty minutes before you check this.

### 4.6 Back to Supabase

Auth → URL Configuration → **Redirect URLs** → both new Vercel domains. No
wildcards.

---

## 5. The first admin — nothing else creates one

Registration is roster-gated and only ever mints `{ role: "student" }`. The demo
seed inserts users with no password column. The schema push seeds no users. So:

```bash
set -a; . deploy/local-admin.env; set +a
node scripts/bootstrap-admin.mjs
```

Once, from your own machine — not CI, not the deployed service. It reads
`OCTA_ADMIN_EMAIL` / `OCTA_ADMIN_PASSWORD` / `OCTA_ADMIN_NAME`, so no password
lands in your shell history.

**The defaults, which are not secrets** — committed in
`deploy/local-admin.env.example` and printed to your terminal:

```
admin@octa.local  /  OctaTemp-2026-change-me
```

They are safe only because they cannot survive first contact. The script stamps
`app_metadata.must_change_credentials`; the console blocks on a change screen
while that flag is set; `POST /console/account/credentials` changes **email and
password together** and clears the flag in the same Admin API call; and that
route **refuses either default**, the email case-insensitively, so they cannot
be submitted back to clear the flag. The first thing you do on the new
deployment is replace both.

**The JWT is authoritative for role, not `profiles.role`.** Creating a user in
the dashboard and setting `profiles.role = 'admin'` by hand gives a row that
says admin and a token that says student: RLS denies, the console renders empty,
and nothing on screen says why. The script writes both, `app_metadata` first.

---

## 6. Scheduling — re-point it, do not assume it moved

**Render Free has no cron.** Every scheduled job is `pg_cron` + `pg_net` inside
Supabase, and each statement has your API URL and `CRON_SECRET` baked into it. A
new project has **no jobs at all**; a kept project has jobs still calling the
**old** API.

`db/addendum-cron.sql` §5 has the statements. Re-create all four against the new
URL and secret, then confirm:

```sql
select jobname, schedule, active from cron.job;
```

| Job | When |
|---|---|
| Keep-alive → `/healthz` | class hours only — 750 instance-hours/month, 24/7 burns ~730 |
| `recompute_item_stats()` | nightly |
| `apply_scheduled_locks()` | every few minutes |
| `run_invariants_nightly()` | nightly |

---

## 7. Prove the move, before anyone else does

```bash
pnpm build && pnpm scan:bundle
```

Then walk it **as a real student, in a real browser** — not with curl, and not
with a staff account. `is_stage_unlocked()` returns true for staff on its first
line, so an instructor walking the app sees everything open and learns nothing
about whether the gates work.

1. Sign in on the student URL.
2. Open a stage, read it, start its check.
3. Score at least 70% and watch the next stage unlock.
4. Sign in to the console, meet the forced credential-change screen, change both.
5. `/system` — invariants, live, 0 failures.

**Nothing is examinable until items are approved.** All 183 arrive as `review`,
and the engine's pool is `where i.status = 'live'`, so until you approve them at
`/items` every attempt fails to fill. Act 1 (stages 01–04, 96 items) is enough
for Ship 1.

**Stage 00 gates stage 01 and cannot be completed.** It is `gradeable = false`,
gets no stage check, and `is_stage_unlocked()` wants every prerequisite at 70%.
A real student is told *"Unlocks when Stage 00 (Orientation) reaches 70%. You're
at 0%."* Decide this before the cohort arrives — `NEXT-SESSION.md` §3a has the
three options and the reasoning.

---

## 8. Retire the old accounts — last

Only after §7 passes end to end.

1. Leave the old deployment up for a few days, unshared. Rollback is free while
   it exists and impossible afterwards.
2. **Roll the old keys.** Supabase → Settings → API → roll `anon` and
   `service_role`; reset the database password. They have been in terminals,
   transcripts and dashboards.
3. Delete the old Vercel projects, then the Render service, then the Supabase
   project. Database last — it is the only one holding anything.
4. Delete `deploy/*.env` from your laptop. They hold the service-role key.

---

## 9. What this does not cover

- **Load test.** 40 concurrent students against a 512 MB free instance has never
  been run, on either account.
- **Custom domains.** Everything here assumes `*.vercel.app` and
  `*.onrender.com`.
- **Supabase Free pauses after 7 days idle and has no backups.** Do not assume
  `pg_cron` activity resets the timer. Take a backup you have actually restored:
  `pnpm backup` dumps and rehearses the restore.

`docs/RUNBOOK.md` is what to do when something breaks in front of a class.
