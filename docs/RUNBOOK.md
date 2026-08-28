# RUNBOOK.md
### What to do when it breaks, written for the person it breaks in front of

This page assumes a class is in progress and you have about ninety seconds of
patience in the room. Everything here is a command you can run from a phone or a
laptop without reading anything else first.

**Print this, or keep it open in a pinned tab.** A runbook you have to find is a
runbook you do not have.

---

## 0. The two facts about this deployment you must not forget

1. **There are no vendor backups.** Supabase Free provides none. The only
   backups that exist are the ones `scripts/backup.mjs` makes and you keep.
2. **Production pauses after 7 days of inactivity.** A quiet week — a semester
   break, a long holiday — and the database is paused, not gone. Restarting it
   from the Supabase dashboard takes a few minutes and loses nothing, but the
   first person to hit it gets an error, and that person should not be a student
   sitting an exam.

Both are consequences of the free tier and both are written into
`DELIVERY.md` §2. Neither is a surprise; they are only a problem if nobody knew.

---

## 1. Something is wrong in class, right now

**Do not debug. Restore service, then debug.** In order:

### 1.1 Is it the API, or the site?

Open `https://<api-host>/healthz`. It should answer instantly with `{"ok":true}`.

| What you see | What it means | Go to |
|---|---|---|
| Answers immediately | The API is fine — the problem is the front end | §1.3 |
| Answers after 30–60 s | Render cold start. Nothing is broken | §1.2 |
| Times out or 5xx | The API is down | §1.4 |
| The page itself won't load | Vercel or DNS | §1.3 |

### 1.2 It was just slow (Render cold start)

Render Free spins a service down after ~15 minutes idle, and the next request
pays a ~60-second cold start. **This is the single worst failure mode in this
system**, because it happens exactly when a class begins.

Nothing to fix in the moment — it is already warming. To prevent it, the
`pg_cron` keep-alive must be scheduled and running: see `db/addendum-cron.sql`
§5. Check it is actually there:

```sql
select jobname, schedule, active from cron.job;
```

If the keep-alive job is missing or inactive, that is your root cause. Schedule
it **for class hours**; keeping the service awake 24/7 burns ~730 of the 750
free instance-hours a month and will take you over the ceiling.

### 1.3 The site is broken but the API is healthy

This is a bad front-end deploy. **Roll back — do not fix forward mid-class.**

**Vercel, from the dashboard (fastest, ~30 seconds):**
1. Project → **Deployments**
2. Find the last deployment that was working — it is the one before the newest
3. **⋯ → Promote to Production**

**Vercel, from the CLI:**
```bash
vercel rollback            # interactive: pick the previous production deploy
vercel ls                  # if you need to see the list first
```

Then tell the room: *"give it thirty seconds and reload."* Then, and only then,
work out what went wrong.

### 1.4 The API is down

**Render, from the dashboard:**
1. Service → **Events**, confirm the most recent deploy is the suspect
2. **Manual Deploy → Deploy a specific commit** → choose the last known good SHA

**Or redeploy the previous commit from git:**
```bash
git log --oneline -5                       # find the last good SHA
git push origin <good-sha>:main -f         # only if you are certain
```

`-f` rewrites the branch. Prefer the dashboard route in a live incident; use
this only when you have no dashboard access.

### 1.5 It is the database

Check the Supabase dashboard first — a **paused** project is by far the most
likely cause, and unpausing it is a button.

If the data itself is wrong (a bad migration, a mistaken bulk edit), go to §3.
**Do not** try to repair rows by hand while a class is running. Void the
affected attempts instead — that is what `attempts.status = 'voided'` is for,
it preserves the history, and it is reversible in a way that hand-editing is
not.

---

## 2. Backups

### 2.1 Make one

```bash
pnpm backup            # dump AND rehearse the restore
pnpm backup:dump       # dump only — for a scheduled job
```

`pnpm backup` does not just write a file. It restores that file into a scratch
database and checks five things: row counts match, `run_invariants()` returns
the same verdict as the source, RLS is still on for every table in `public`, the
append-only triggers on `responses` survived, and `attempt_items` still has its
policies.

**A backup you haven't restored is a guess.** That is why the rehearsal is the
default and `--dump-only` prints a warning saying the backup is unproven.

### 2.2 Verify an old one

```bash
pnpm backup:verify db/dumps/octa-2026-08-26T01-54-22.sql
```

Do this **before** you need it, not during an incident. It has caught a
truncated dump and a dump that restored with RLS disabled — the second is the
dangerous one, because it restores cleanly and looks like success.

### 2.3 Where they live

`db/dumps/`, gitignored, seven kept locally. **That is not off-site.** Before
the pilot, copy them somewhere that is not this laptop — Supabase Storage, a
drive, anywhere with a different failure mode.

---

## 3. Restoring for real

> Do this with nobody using the system. Announce it first.

```bash
# 1. Prove the backup you are about to trust.
pnpm backup:verify db/dumps/<the-one-you-want>.sql

# 2. Take a dump of the CURRENT state first, however broken it is.
#    You may need to compare, and you can never get it back afterwards.
pnpm backup:dump

# 3. Restore.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/dumps/<the-one-you-want>.sql

# 4. Prove it.
pnpm db:invariants
pnpm test:rls
```

**Step 4 is not optional.** `db:push:reset` broke the live project once by
dropping the `public` schema, which destroys the `ALTER DEFAULT PRIVILEGES`
Supabase attaches to it: every table created afterwards had no grants, and the
whole database answered `42501 permission denied` — to the grading service too.
RLS looked perfect. Nothing could reach the tables to be filtered. It was caught
only because the POSITIVE control tests failed. See `VERIFICATION.md`.

---

## 4. A student says their grade is wrong

You can answer this exactly, months later. Do not guess.

1. Console → **Students** → the student → their attempt → **Open paper**
2. That page regenerates the exact paper from their stored seed: same numbers,
   same options, same order, with the key shown and their answer beside it
3. Console → **Audit log**, filter by their name, to see every lock or override
   that touched them and the reason someone gave at the time

If the item itself is wrong, **do not edit it in place.** Items are versioned:
a new version is a new row sharing `family_id`, and the old one is retired, not
deleted. Then void the affected attempts. Corrections void an attempt; they
never edit history.

---

## 5. Escalation

| | |
|---|---|
| **Owner / first contact** | Shem Joshua Dumpor — `dumporshemjoshua@gmail.com` |
| **Course** | CPE 412, University of Cebu, College of Engineering |
| **Repo** | `github.com/Shaloh69/Octalysis---A-new-way-of-Learning`, branch `main` |
| **Hosting** | Vercel Hobby ×2 (web, console) · Render Free ×1 (api) · Supabase Free ×1 |

**Fill in before the pilot:** a second contact who can reach the owner, and the
Supabase/Vercel/Render account recovery path. One person with all the
credentials is itself an incident waiting to happen.

---

## 6. What is NOT covered here, honestly

- **Load testing.** 40 concurrent students against the real free-tier Render
  instance has not been run. It needs a deployed instance and cannot be
  simulated on a laptop, because the thing being tested is a 512 MB instance
  with no scaling.
- **The 7-day pause.** Documented, not observed. Verifying it needs a
  deliberately quiet week on a scratch project. **Do not assume `pg_cron`
  activity counts** as activity for the pause timer — that is the assumption
  most likely to be wrong, and the most expensive to be wrong about.
- **Off-site backups.** The rehearsal is real; the off-site copy is not set up.
- **Sentry.** Not wired. There is no error tracking on either app today.

Each of these is a real gap, listed so nobody discovers it during an incident.
