# PHASES.md
### P0 → P10, foundation to production

One phase per Claude Code session. `/clear` between phases. Every phase has **exit criteria** —
if you can't tick them all, the phase isn't done, regardless of how much code exists.

**Where the alpha sits:** the alpha release is **P0 → P4 (partial), plus a complete skill tree** —
not all topics implemented, but every one of the 19 nodes, all 18 prerequisite edges, and full
server-resolved lock behaviour. Definition, scope boundary, and exit criteria in `DELIVERY.md` §3.
Everything ships to branch `shaloh-build` on the existing course repo; see `DELIVERY.md` §1.

---

## P0 — Foundation & security harness · **DONE**

> **Status: complete and verified against a running Postgres 16 in Docker.**
>
> | Exit criterion | Result |
> |---|---|
> | `pnpm db:reset` runs clean from scratch | pass — all four SQL files apply |
> | All six denial tests pass, seen failing first | **38/38 pass**; three policies sabotaged, six tests went red, each mapping to its break |
> | Blocking third-pass findings applied | V-15, V-16, V-19, V-25 applied — plus V-17, V-20, V-21, V-22, V-23, V-24, V-27 |
> | Invariants | 22 clean, 0 warnings, 0 failures (3 notices expected on an unseeded database) |
> | TypeScript strict | clean across the workspace |
> | Hosting decision recorded | free tier; scheduling moves to `pg_cron` + `pg_net` |
>
> **Three defects were found by running it that no amount of reading would have caught** — an
> empty-string GUC that would have caused intermittent total authorisation failure under connection
> pooling, a column `REVOKE` that silently did nothing, and a policy that silently denied
> everything. All three are fixed and documented as V-28/V-29/V-30.
>
> **Not yet done, and not blocking:** Supabase Security Advisor (needs a Supabase project), and the
> 7-day-pause verification (same). Both move to the phase where a cloud project first exists.

### What P0 originally specified

**Build:** pnpm monorepo. `services/api` on Fastify + TS strict. Zod-validated env that fails
fast on boot naming the missing var. `db/schema.sql` applied. `/healthz`. Vitest. GitHub Actions
running typecheck + tests + a WCAG contrast check on the token files.

**Then, before any feature:** write `test/rls.spec.ts` proving denial —

1. A student cannot `SELECT` from `items` at all
2. A student cannot read `attempt_items.correct_value` while `status='in_progress'`
3. The same student *can* after `status='submitted'`
4. A student cannot `UPDATE` their own `profiles.role`
5. A student cannot read `content_blocks` for a locked stage
6. A student cannot read another student's `attempts`

**Also in P0, before the denial tests:** apply `db/addendum-p0-hardening.sql` — the blocking
findings from `VERIFICATION.md`'s third pass. **V-15** (`exam_salt` and `attempts.seed` are
client-readable, and no policy has a `TO` clause, so every one includes `anon`), **V-16**
(`is_stage_unlocked()` never reads `lock_at`, so no lock window ever closes), **V-19**
(`profiles.accent_hue` does not exist), **V-25** (a malformed role claim locks a user out of every
table). Write the six denial tests against the *fixed* schema, plus three new ones V-15 demands:
*anon cannot read `assessments`* · *a student cannot read `attempts.seed`* · *anon cannot read
`objectives` for an unpublished stage*.

**Exit criteria**
- [ ] `pnpm db:reset` runs clean from scratch
- [ ] All six denial tests pass, and you have seen them fail first
- [ ] Supabase Security Advisor reports zero errors
- [ ] Blocking third-pass findings applied: V-15, V-16, V-19, V-25
- [ ] Hosting decision recorded — **and it is already made: everything is free tier.** Render Free
      spins down at 15 min with a ~60s cold start and **has no cron jobs**; the keep-alive is a
      `pg_cron` + `pg_net` GET to `/healthz` from Supabase. See `DELIVERY.md` §2.
- [ ] Supabase's 7-day pause behaviour verified against a `pg_cron` heartbeat — **observed, not
      assumed** (`VERIFICATION.md` V-26.2)

---

## P1 — Auth · 1 week

**Build:** roster CSV import with dry-run. `POST /auth/register` (roster-gated, transactional,
sets `app_metadata.role` + `student_id`). `POST /auth/resolve` (ID → email, rate-limited,
non-enumerating). Login and register pages.

**Exit criteria**
- [ ] Sign-up with an off-roster ID fails, with the *same* message as an already-claimed ID
- [ ] A failed `profiles` insert leaves no orphaned auth user
- [ ] Resolve endpoint trips its rate limiter at the 6th request
- [ ] Public signup is disabled in the Supabase dashboard
- [ ] Email enumeration protection is on; redirect wildcards removed

---

## P2 — Content pipeline + Stages 00–07 · 2 weeks

**Build:** `scripts/sync-content.ts` — parses `/content/stages/*.md`, writes `content_blocks`,
bumps version on change, idempotent. Stage reader UI. Stage map with real lock reasons.

**Content:** Stages 01–07, written from **Stallings 10th ed.**, sliced by its own outline into
`content/book/`. **Definitions and figures verbatim** — `sync-content.mjs --verify` checks all 25
quoted definitions against the extracted text and fails on a paraphrase.

**Chapters 08–18 ship as a declared future update.** They carry their verbatim syllabus
objectives and topic outline plus a `kind="planned"` callout that tells the student the teaching
text is coming. `pnpm check:objectives` gates all 110 objectives against the syllabus DOCX so the
scaffold cannot drift from the course while it waits. Hard rule 5 is why: prose nobody has checked
against the textbook is worse than an honest gap, because a student cannot tell the difference.

**Exit criteria**
- [ ] Fixing a typo in a stage requires no redeploy
- [ ] Running sync twice produces zero changes the second time
- [ ] A locked stage shows *why* it's locked and how far off the student is
- [ ] Every line of the Day 1 deck is accounted for — no invented lecture text

---

## P3 — The question engine · 2 weeks · **the important one** · ENGINE CORE DONE

> **Status: the engine and its tests are built and green. The HTTP layer is not.**
>
> | Deliverable | State |
> |---|---|
> | `seed.ts` — SplitMix64, `Math.random` banned | done, 16 tests |
> | `solvers.ts` — cycle-time, unit-convert, twos-complement, amat | done, 21 tests |
> | `resolve.ts` — params, options, dedupe, shuffle | done, 16 tests |
> | `blueprint.ts` — constraint fill + `BlueprintUnsatisfiable` | done, 14 tests |
> | `grade.ts` — relative tolerance, unit stripping, per-objective scoring | done |
> | `serialize/student.ts` — the ONE serializer, an allow-list | done, 25 tests with grade |
> | **Three attempt endpoints** | **not built** |
> | **DB wiring** (load pool, persist `attempt_items`, write `responses`) | **not built** |
>
> **130 tests green across the workspace; TypeScript strict clean.**
>
> Tests-first criteria from the original list, all passing: same seed produces an
> identical paper over 100 runs · median item overlap 0% and p95 under 25% across
> 4,950 student pairs · every constraint cell satisfied exactly over 200 papers ·
> an unsatisfiable blueprint throws naming the cell and the shortfall ·
> **cycle-time 133 MHz to 7.52 ns** · no student-facing payload contains an
> answer key, verified by searching the serialised body for the actual secret.
>
> Three real bugs were found by running these tests rather than reading the code:
> a distractor that collides with the correct answer at exactly 1000 MHz, two
> algebraically identical distractors in `unit-convert`, and an O(n^2) scarcity
> scorer that made a 70-item paper take minutes. See the commit body.

### What P3 originally specified

**Build:** `seed.ts` (splitmix64 or xoshiro, never `Math.random`), `solvers.ts`, `resolve.ts`,
`blueprint.ts`, `grade.ts`. Three attempt endpoints. A single serializer that strips
`correct_value`, used by every student-facing route — not ad hoc per endpoint.

First four solvers: `cycle-time`, `unit-convert`, `twos-complement`, `amat`. Every distractor
must come from a real student misconception (wrong unit scale, inverted ratio, off-by-one bit
width) — never a random number near the answer.

**Tests, written first**
- [ ] Same seed → identical paper, 100 runs
- [ ] Different `student_id` → <15% item overlap across 1000 simulated pairs
- [ ] Every generated paper satisfies its blueprint's constraint cells exactly
- [ ] An unsatisfiable blueprint throws, naming the cell and the shortfall — never silently
      under-fills
- [ ] `cycle-time`: 133 MHz → 7.52 ns (the worked example from the source deck)
- [ ] No student-facing API response anywhere contains a correct answer

**Exit criteria:** generate papers for two real students, diff them, and show me both.

---

## P4 — Console v1 · **DONE**

> | Exit criterion | Result |
> |---|---|
> | Teacher can lock/unlock any student × stage, reason in `audit_log` | pass — mandatory client and server; INV-22 checks it in the database |
> | Drill-down regenerates the exact variant from the stored seed | pass — `/attempts/:id`, asserted byte-identical in `console.spec.ts` |
> | Route guard reads role from the JWT, not `profiles` | pass — 18 tests, including 12 malformed claims and a `user_metadata.role` that must never be believed |
> | Zero upstream palette classes remain | pass — Tailwind's palette is DELETED, not extended; `scan-console-palette.mjs` fails the build on any upstream utility, literal hex, or `dark:` variant |
>
> Three findings came out of building it — V-51, V-52, V-53. None was catchable
> before the console existed: one was masked because the API bypasses RLS, one
> needed a table that did not exist yet, and one needed a second bundle before
> the ambiguity was even meaningful.
>
> **Built the shadcn *approach*** — Radix primitives with the component source
> owned in-repo under `src/components/ui/` — rather than cloning the template.
> Cloning imports a demo app to delete, and its palette is the thing the last
> exit criterion forbids.

### What P4 originally specified

**Build:** clone `satnaing/shadcn-admin` into `apps/console`, strip demo pages, keep shell +
command palette + data table + theme provider. **Replace its palette with our three themes** —
do not ship its slate/blue.

Pages: `/console/roster`, `/console/students/:id`, `/console/locks`, `/console/gradebook`.

**Exit criteria**
- [ ] Teacher can lock/unlock any student × stage, and the reason is in `audit_log`
- [ ] Student drill-down regenerates the exact variant a student saw, from their seed
- [ ] Route guard reads role from the JWT, not from `profiles`
- [ ] Zero `slate-` or `blue-` Tailwind color classes remain in the console

---

## P5 — Stages 06–11 · 2 weeks

Ch1 content, number systems, digital logic. Interactive diagrams. Matching / ordering item types
with **tap-to-select fallbacks**.

**Exit criteria**
- [ ] Stages 07 and 09 each have ≥4 live parameterized templates
- [ ] Every drag interaction is completable with taps only, and with a keyboard only

---

## P6 — Simulators · 2 weeks

FDE stepper → **8086 subset interpreter** → cache simulator. **One at a time, reviewed before the
next starts.**

**Read `docs/TOOLCHAIN-CORRECTION.md` first.** This is TASM x86-16, not MARIE. The interpreter
covers ~35 instructions plus `INT 21h` services, and it must be deterministic and inspectable
because Stage 15 questions are graded by running it server-side.

**Exit criteria**
- [ ] A student can write, assemble, and run an x86-16 program that loops
- [ ] Assembly errors name the line and say what's wrong in plain language
- [ ] All three work at 380px wide and keyboard-only

---

## P7 — Item analytics · **DONE**

> | Exit criterion | Result |
> |---|---|
> | A deliberately-broken item gets flagged automatically within one night | pass — `recompute_item_stats()` auto-flags after 30 exposures, on `pg_cron`, verified against real submitted attempts |
> | Editing a live item creates v+1, retires v, and the UI says so before you confirm | pass — and the API returns the words "Statistics do not carry over" too, so a script author cannot miss it |
>
> Two refusals were added beyond the original criteria, because a bank UI
> without them will eventually ship a wrong key to a real exam: **nobody
> approves their own item**, and **a static item with no correct answer cannot
> go live**. Both are tested by watching them refuse.

### What P7 originally specified

Nightly **Supabase Cron** (`pg_cron`) recomputing `item_stats`: p-value, point-biserial
discrimination, distractor histogram, variant drift (p-value bucketed by param quintile). Auto-flag
after ≥30 exposures. `/console/items` with stats inline and a review queue.

**Not a Render Cron — Render's free tier has none.** Write the recompute as a Postgres function and
schedule it with `pg_cron`; it runs where the data is, with no service to keep awake. Same for the
nightly `run_invariants()` → `audit_runs` job. See `DELIVERY.md` §2.2.

**Exit criteria**
- [ ] A deliberately-broken item (wrong key) gets flagged automatically within one night
- [ ] Editing a live item creates v+1, retires v, and the UI says so before you confirm

---

## P8 — Feedback system · **API + TRIAGE UI DONE**

> | Exit criterion | Result |
> |---|---|
> | A content report reaches the queue with the exact resolved variant | pass — replayed from the seed server-side; a report against another student's attempt attaches nothing, and that denial is tested |
> | The SUS prompt waits for 3 sessions + 1 completed workflow | pass — gated server-side, so clearing the browser does not reset it; stops after two dismissals |
> | SUS scoring verified against a hand-computed example | pass — all four reference points. **All 5s scores 50, not 100**: the scale alternates polarity, so the true maximum is `5,1,5,1,…`. Getting that backwards is the classic SUS bug, and the test pins it deliberately |
> | A teacher can see the status of their own submitted feedback | **not built** — triage is staff-wide; there is no per-reporter view |
>
> **Also not built:** the student-side flag and report widgets in `apps/web`.
> The routes they post to exist and are tested.

### What P8 originally specified

Contextual flag, inline content report, SUS survey with its trigger gate, `/console/feedback`
with both tabs. See `PAGE-SPECS.md` §4.

**Exit criteria**
- [ ] A content report from the student app lands in the item review queue with the exact
      resolved variant attached
- [ ] The SUS prompt does not appear before 3 sessions + 1 completed workflow
- [ ] SUS scoring verified against a hand-computed example (all 5s → 100, all 1s → 0)
- [ ] A teacher can see the status of their own submitted feedback

---

## P9 — Themes, audio, accessibility · 1 week

Three themes as CSS custom properties. Howler audio, ambient default 0, neutral incorrect sound.
Register Bar on every stage. Full a11y pass.

**Exit criteria**
- [ ] All three themes pass WCAG AA, verified in CI
- [ ] `/public/audio/CREDITS.md` lists every file's source and license, even where CC0 doesn't
      require it
- [ ] One full stage completed keyboard-only, start to finish
- [ ] `prefers-reduced-motion` disables all motion

---

## P10 — Pilot, hardening, launch · 2 weeks

**Pilot (week 1):** one section, Stages 00–05 only, real students, teacher present. Watch. Don't
fix live unless it's blocking.

**Hardening (week 2)**
- Load test: 40 concurrent students starting the same assessment within 30 seconds — **run it
  against the free Render instance, not a laptop.** One 512 MB instance, no scaling, and a ~60s
  cold start for whoever arrives first. Write this test in P3, not here.
- Render: **keep-alive confirmed working during class hours via `pg_cron` + `pg_net`** (free tier
  has no cron of its own). Watch the 750 instance-hours/month ceiling — keeping one service awake
  24/7 consumes ~730 of them.
- Vercel: `vercel.json` SPA rewrites, correct env per environment. **Preview deploys cannot be
  password-protected on Hobby** — use an app-level guard, or accept that preview URLs are unlisted
  rather than protected, and write down which.
- Supabase: run the **Security Advisor** one final time; SSL enforcement on; MFA on your account;
  OTP expiry ≤ 1 hour; storage buckets private except `/public/audio`
- Backups: **the free tier provides none.** Scheduled `pg_dump` to Storage that you own, plus **one
  rehearsed restore into local Postgres** before launch. A backup you haven't restored is a guess,
  and that does not stop being true because the vendor stopped supplying the backup.
- Record on the incident page, in words: *this deployment has no vendor backups, and production
  pauses after 7 days of inactivity.*
- `/maintenance` page wired and tested
- Error tracking (Sentry free tier) on both web and api
- Rollback plan written down: how to revert a bad deploy mid-class, in under two minutes

**Launch exit criteria**
- [ ] Restore-from-backup rehearsed successfully
- [ ] Rollback rehearsed successfully
- [ ] Item bank has ≥40 live items per stage for Stages 00–05
- [ ] Instructor has completed the console walkthrough unaided
- [ ] Incident contact and escalation path written on one page

---

## Ongoing, all semester

**Item authoring is the real project.** The code is ~12 weeks; the bank is continuous. Target
~40 static + 4 parameterized + 2 generated per stage ≈ 780 items. Author 8–10 per stage by hand
to set the style, draft the rest with LLM assistance in the console, and **approve every one by
hand before it goes live.** A wrong answer key in a live bank is a grading incident.

Start authoring in P2. Not P7.
