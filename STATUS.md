# STATUS.md
### What is built, what is verified, and what is not

Written at the end of the build session. `PHASES.md` is the plan; this is the
honest accounting against it.

**Everything below marked "verified" was executed, not inspected.** Where a thing
was assumed rather than run, it says so.

---

## Verified totals

| | |
|---|---|
| Tests green | **206** (189 API + 17 web) · 1 skipped (live JWKS, needs `.env`) |
| TypeScript strict | clean across 4 packages |
| Invariants | 22 clean, 0 failures (3 notices expected on an unseeded database) |
| Schema | applies from scratch locally **and on the live Supabase project** |
| Denial suite vs Supabase | **38/38 pass on the real project** |
| Local Postgres state | **19 stages, 18 edges** (one linear chain), 75 content blocks, **110 objectives** |
| Supabase live state | seeded before V-47; **needs a re-push** for the 18-chapter seed |
| Initial JS bundle | 51.9 KB gz + 3.8 KB CSS |
| 3D chunk | 219.8 KB gz, on demand only, no preload |
| Bundle scan | clean — no answer keys, no server-only names, no source maps |

Run it all: `pnpm db:up && pnpm db:reset && pnpm verify`

---

## Phase by phase

### P0 — Foundation & security harness · **DONE**

pnpm monorepo, Docker Postgres, Zod-validated env that refuses to boot if a
server-only secret carries the client prefix, Fastify with one error shape,
`/healthz` and `/readyz`, and the RLS denial suite.

**38 denial tests, watched failing first.** Three policies were deliberately
sabotaged in the running database; six tests went red, each mapping to its break,
including the one asserting the literal answer string never reaches a response
body.

Three defects found by running rather than reading — recorded as V-28/29/30:
an empty-string GUC that would have caused intermittent total authorisation
failure under connection pooling, a column `REVOKE` that silently did nothing,
and a policy that silently denied everything.

### P1 — Auth · **DONE (one gap)**

Roster-gated registration, non-enumerating resolve, roster import with dry-run
by default and audit logging.

Off-roster and already-claimed IDs return **byte-identical** responses. A failure
after the claim deletes the auth user and releases the row — tested by simulating
the failure and proving the student can still register afterwards.

**Gap:** tested against a fake Supabase Admin client. The real `createUser` call
has never run, because that needs the service-role key. See "What is blocked".

### P2 — Content pipeline + Stages 00–05 · **DONE**

`scripts/sync-content.mjs`: parses `content/stages/*.md`, verifies every sourced
block against the decks, writes `content_blocks` and `objectives`. Idempotent —
a second run reports 31 unchanged and writes nothing.

Stages 00–05 authored from `day1-deck.md`, definitions and Figures 1.1–1.4
verbatim, 31 blocks and 16 objectives. The fidelity check caught one real
transcription slip of mine.

Stage map API, reader API, and the 7×3 progress grid.

### P3 — The question engine · **DONE**

`seed` (SplitMix64), `solvers` (cycle-time, unit-convert, twos-complement,
amat), `resolve`, `blueprint`, `grade`, and the single student serializer.
Three attempt endpoints wired to the database.

**The exit criterion is executable:** `test/attempts.spec.ts` generates papers
for two real students and prints both — same blueprint shape, completely
different items and numbers. `133 MHz → 7.52 ns` passes. Median item overlap 0%,
p95 under 25%, across 4,950 pairs.

Three bugs found by running: a distractor colliding with the correct answer at
exactly 1000 MHz, two algebraically identical distractors, and an O(n²) scarcity
scorer.

### P4 — Console v1 · **API DONE · UI NOT BUILT**

Routes: roster, lock matrix, lock set with a **mandatory reason**, student
drill-down, audit log, system audit, gradebook CSV. 13 tests including
staff-only enforcement on every route.

The drill-down regenerates a student's exact paper from the stored seed and is
asserted byte-identical to what the student saw.

**Not built:** `apps/console`. The API is complete and tested; there is no React
app in front of it.

### P5 — Stages 06–11 · **NOT BUILT**

Content for 06–17 is not authored. The pipeline, the map, and the reader all
handle them the moment the markdown exists — the stages are seeded and the map
renders all 18 nodes today.

The encounter components (`CardSort`, `BitArray`, `SliderRig`, `NodeCanvas`) do
not exist.

### P6 — Simulators · **NOT BUILT**

FDE stepper, x86-16 interpreter, cache simulator. `MASTER-PLAN.md` §13.6 already
names the fallback: ship Stages 15 and 16 as read + parameterized questions and
add simulators later.

### P7 — Item analytics · **SQL DONE · UI NOT BUILT**

`recompute_item_stats()` computes p-value and point-biserial discrimination and
auto-flags after 30 exposures. **Verified against real submitted attempts** — 8
items updated with correct p-values.

Scheduled nightly via `pg_cron`. No review-queue UI.

### P8 — Feedback · **SCHEMA ONLY**

`feedback`, `feedback_prompts` and `sus_score()` exist and are covered by
`inv_24`. No routes, no UI.

### P9 — Themes, motion, accessibility, 3D · **SUBSTANTIALLY DONE**

Three themes wired, accent derived in OKLCH from a stored hue, **not one literal
hex** in the stylesheet. `prefers-reduced-motion` zeroes every duration. Skip
link, visible focus, `sr-only`, 380px layout, real 44px touch targets.

The galaxy: two layers with the accessible one canonical, lazy-loaded, absent
under reduced motion or a small viewport, and silently absent when WebGL fails.

**Not done:** audio (Howler), automated axe/contrast checks in CI, and a manual
screen-reader pass.

### P10 — Pilot & hardening · **NOT STARTED**

No load test, no backup rehearsal, no rollback drill, no Sentry.

---

## What is blocked, and on what

| Blocked | Needs |
|---|---|
| Real email/password sign-in | Supabase **anon** and **service-role** keys in `.env`; Auth settings per `DELIVERY.md` §0.1 |
| Vercel deploy (web + console) | A Vercel project each, `VITE_*` env set |
| Render deploy (api) | A Render web service, server env set |
| Keep-alive proving itself | The deployed API URL, then one `cron.schedule` call (`db/addendum-cron.sql` §5) |
| 7-day-pause behaviour | A deliberately quiet week on a scratch project — **do not assume `pg_cron` counts as activity** |
| Backup story | Free tier has none. Scheduled `pg_dump` + one rehearsed restore |
| Load test (40 concurrent) | The deployed free Render instance, not a laptop |

---

## Things I would flag before a pilot

1. **The item bank is the schedule, and it is nearly empty.** 22 test items exist.
   The plan calls for ~40 per stage. `VERIFICATION.md` V-6 is right that this is
   the real project, and no amount of code substitutes.

2. **P1's happy path has never touched real Supabase Auth.** The fake admin
   client has the same interface, which is exactly the kind of gap that looks
   fine until it doesn't.

3. **`teacher` and `admin` are intentionally identical** (decision D4). That is
   fine for one instructor and wrong the moment there is a TA. `VERIFICATION.md`
   V-18 has the fix if that changes.

4. **`db:push:reset` broke the live project once, and the fix is worth knowing.**
   `drop schema public cascade` destroys the `ALTER DEFAULT PRIVILEGES` Supabase
   attaches to that schema, so every table created afterwards had no grants and
   the entire database answered `42501 permission denied` — to the grading
   service too. RLS looked perfect; nothing could reach the tables to be
   filtered. The script now restores the default privileges before applying the
   schema. If you ever reset by hand in the SQL editor, do the same.

5. **The commit message on `322498e` says "180 tests" where the run reported 167.**
   The number was right for a later commit, not that one. Noted rather than
   rewritten, because rewriting pushed history is worse than an inaccurate line.
