# NEXT-SESSION.md — start here after a `/clear`

**Last updated 14 September 2026.** Every figure here was **measured, not
remembered**, with the command beside it so you can re-run one rather than
re-derive all of them.

> **Do not re-audit this file.** It exists so a fresh session does not spend its
> first hour rediscovering what the last one established. Check a number when
> you are about to depend on it — then check that one.
> `REDESIGN-CLAUDE.md` §2c rule 3 cuts both ways: verify before repeating, but
> do not re-derive what carries its own evidence.

---

## 0a. Parked by the `/items` revamp — 25 Sep 2026

Found while rebuilding `/items` and deliberately **not** fixed there (one
session, one route). Each names where it lives and what it breaks.

1. **The console's dialog scrim renders nothing.** `components/ui/dialog.tsx`
   draws its overlay with `bg-surface-0/80`, and Tailwind 3 emits no CSS for an
   opacity modifier on a `var()` colour, so every console dialog opens over an
   undimmed page. Seen on `/items`' review and import dialogs. A shared
   primitive: fix it as its own change (a token-based `color-mix()`), and run
   every console spec with a dialog, because every one of them changes.
2. **Spec skips that fire on a race are tests that have stopped existing.**
   `console-items.spec.ts` counted table rows the instant `<main>` appeared,
   while the page still said "Loading", so all four of its tests SKIPPED on
   every run for weeks while being reported as "four passing tests". Fixed in
   that file. `console-teaching.spec.ts`'s count-then-skip was checked and is
   not affected. **Any new count-then-skip must wait for the page to decide.**
3. **`db-demo` alone does not clean up after the API suite.** `pnpm test` /
   `pnpm verify` leaves the API test world behind (22 live stage-07 fixture
   items), and `db-demo` only adds, so `/items` then reads "205 in the bank ·
   22 live". **After any API test run: `pnpm db:reset && node scripts/db-demo.mjs`**,
   not `db-demo` on its own.
4. **The flagged-item fixture had never seeded anything.** It lived at the
   bottom of `demo-seed.sql`, which runs before the item bank exists, and named
   a slug (`G-07-order-1`) that no longer exists. Moved to
   `db/demo-item-stats.sql`, run after `sync-items`, and it now raises if its
   slug disappears again.
5. **`/console/items/:id/edit` is still not built.** Import refuses a live item
   for exactly that reason (versioning a live item retires it at once, and that
   page's confirm dialog is where "statistics do not carry over" is said).
6. **Two definitions of a valid item.** `services/api/src/items/import-plan.ts`
   mirrors `scripts/sync-items.mjs`' `validateShape()` rule for rule, because
   that script cannot import TypeScript. Change one, change the other;
   `import-plan.spec.ts` names each rule in the same order.
7. **Running the console specs rewrites committed PNGs.**
   `design/item-review/assessment-window.png` changes on every run of
   `console-assessment-window.spec.ts`. Restore it before committing unless
   that route is the session's work.

**Available to every route from now on:** `toast` (`components/ui/toast.tsx`,
mounted once in `AppShell`), `useDelayed` for the 400ms skeleton rule, and
`design/specs/_gate.ts` — the six assertions as functions. Import them; do not
re-derive them.

---

## 0. Run the phase report — this is a rule

```
pnpm phase          # counted from the files, never from memory
pnpm phase --open   # every open R-phase box, with its section
```

**Show it at the start and again before you finish.** Root `CLAUDE.md` requires
it, because a remembered figure is how this project lost track twice.

Current: `R0 28/28 · R1 36/36 · R2 21/21 · R3 41/49 · R4 0/13 · R5 0/24`
— **126 done · 45 to-do (171 items, 74%)**, live phase **R3**.

**The last three sessions were NOT R3 work.** The item bank, the solvers, the
assessments, the stage checks and the deployment fixes are P3/P4/P5 on
`PHASES.md`'s track. No R-phase box moved, and that is correct — do not
"reconcile" the phase files to account for it.

---

## 1. THE GOAL IS TO SHIP, SOON — read `docs/SHIP-EARLY.md`

**Ship 1 — stages 00–04 plus the Prelim.** Authored prose, 96 banked items, five
attempts, submissions, console, feedback, the map. Everything it needs exists.

**Ship 2 — stages 05–08 plus the Midterm.** One authored chapter away: 05, 06
and 07 are written, **chapter 08 is still a scaffold** with 15 items against it.

**Later update — Semi-final and Finals (09–18).** Solvers are written, tested and
registered; items are not, and the prose is eleven scaffolds. `engine/scope.ts`
withholds both exams and `scope.spec.ts` fails if the flag widens without the
bank moving with it. **Nothing must change for the first two ships to be
correct.**

---

## 2. State of the world, measured

### Local — works, and is the only place anything works

```
pnpm db:up                                  Postgres 16 on :15432
pnpm db:reset && node scripts/db-demo.mjs   183 items · 22 blueprints · 10 assessments
                                            115 objectives · 19 stages
pnpm dev:api                                :8090   NOT the raw dev script
pnpm dev:token                              a signed-in console session
pnpm dev:token staff --must-change          the bootstrap-credentials screen
pnpm verify                                 396 API · 53 web · 27 console, green
pnpm phase                                  the report above
```

The 10 assessments are **2 exams** (Prelim, Midterm) **+ 8 stage checks**
(stages 01–08). 22 blueprints = 4 exams + 18 stage checks, one per gradeable
stage.

### Live Supabase — exists, answers, and is empty and stale

Measured 9 Sep with `node scripts/db-push-supabase.mjs --check`, which applies
nothing. Project `lqvkqdaqtkhxmnvodmyr`, PostgreSQL 17.6.

| | Live | Should be |
|---|---|---|
| public tables | **21** | 22 |
| stages | **18** | 19 |
| objectives · content_blocks | 0 · 0 | 115 · 217 |
| items · assessments · profiles | 0 · 0 · 0 | 183 · 10 · 25 |

The missing table is **`submissions`** — 40% of the grade.
`db-push-supabase.mjs` omitted `addendum-submissions.sql`; **fixed** (`d98ed0d`),
**not yet applied to the project**. 18 stages means the live schema predates the
18-chapter rebuild.

**Nothing was lost, because nothing was there** — 0 profiles, 0 attempts,
0 responses.

### Vercel / Render

The instructor says they are live. `origin/main` is current. Whether they are
connected and building is **unverified from here** — ask rather than assume.

---

## 3. Two decisions waiting — both are the instructor's

### 3a. Stage 00 cannot be completed, so stage 01 never unlocks — RESOLVED 25 Sep 2026

> **Decided by the instructor.** Orientation has no moons (cosmetic asteroids
> instead), and **a non-gradeable prerequisite never blocks**, so stage 01 is
> open from the start. Recorded in `WEB-REVAMP.md` §3.7 and R4.6. **Not yet
> built:** `is_stage_unlocked()` still applies the old rule, so the symptom below
> is still live until that server-side change lands. The analysis is kept for
> the reasoning.

Stage 00 is `gradeable = false` with no items, so it gets no stage check — and
stage 01's prerequisite is stage 00. `is_stage_unlocked()` needs every
prerequisite at ≥70% mastery, and orientation can reach it by no path that
exists. Three options, none of which an engineer should pick alone:

1. Orientation completes on **reading** rather than testing — no code path today
2. **Stage 01's prereq changes** to `{}`
3. A **global unlock** on stage 01 in `/locks` covers it operationally

**What a real student sees today** (14 Sep, `GET /api/v1/stages` as the seeded
student, local stack):

```
01 | locked | "Unlocks when Stage 00 (Orientation) reaches 70%. You're at 0%."
```

The app instructs the student to do something that has no path.

**Measured against the code, 14 Sep — option 3 is not what it reads like.**
`LocksPage.tsx:85` hard-codes `scope: "user"`. The API supports `global`
(`console.ts:161`) but **no console control reaches it**, and the matrix is
empty until a student registers. So option 3 means the instructor toggling a
cell per student, after each registers, with a reason each time, for every new
enrollee — a standing chore, not a policy, and it leaves the broken edge in the
data.

**Option 1 is the most expensive.** `routes/stages.ts` has no POST at all. It
needs an endpoint, a contract, a client control, a denial test, and a ruling on
what number "I read it" writes — which then lands in `avg(sp.mastery)`
unfiltered at `console.ts:34` and `live.ts:50`, inflating every student's roster
average with a figure nobody earned, and making `mastery` mean two things.

**The engineer's recommendation is option 2**, on the grounds that the current
edge asserts something the schema contradicts: `gradeable = false` says the
stage yields no mastery, `prereq = {00}` says you need mastery from it. Option 2
deletes a false claim; 1 and 3 build machinery to satisfy it. Orientation
becomes skippable, but it is already skippable-by-impossibility. Option 1 stays
available later and composes: build the completion path, then restore the edge.

**Worth doing alongside whichever is chosen:** an invariant that a non-gradeable
stage never appears in any `prereq`. INV-19 checks prereqs exist and INV-20 that
they are acyclic; nothing checks one is *satisfiable*, which is this bug's
shape. INV-30 already forbids non-gradeable stages from supplying items — this
is the symmetric rule.

### 3b. Re-pushing the schema needs `--reset`, which drops the public schema

Irreversible and outward-facing. Today's reading says it is safe — nothing to
lose — but that reading is a **snapshot, not consent**. Ask explicitly, and
re-run `--check` immediately beforehand.

If approved, the go-live sequence:

```bash
node scripts/db-push-supabase.mjs --reset      # schema, all five files
# then with DATABASE_URL pointing at Supabase:
node scripts/sync-content.mjs                  # 19 stages, 115 objectives, content
node scripts/sync-items.mjs                    # 183 items, all `review`
node scripts/sync-assessments.mjs              # 2 exams + 8 stage checks
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
  node scripts/bootstrap-admin.mjs "instructor@email"
```

The last prints a temporary password and stamps
`app_metadata.must_change_credentials`, so the console blocks on a change screen
at first sign-in. That is deliberate.

---

## 4. Built, and deliberately not

**Built and verified across the last three sessions**

- **60 solvers** (4 original + 56 new), each tested against hand-computed values
  or published figures — Hamming check bits reproduce Stallings Table 5.2, PCIe
  gives 250 MB/s and 8 GB/s, 7200 RPM gives 4.17 ms, IEEE 754 biases 127/1023.
- **183 items** across stages 01–08, covering all 59 gradeable objectives, each
  citing its book section and checked against `content/book-map.json`.
- **Stage checks** — 18 blueprints, 8 offered. Without these nothing unlocked
  (F-44).
- **`engine/scope.ts`** — the examinable-scope flag, stage 08 / Midterm.
- **`bank-feasibility.spec.ts`** — fills real exams AND every in-scope stage
  check from the real files, asserting constraint cells, provenance and spread.
- **Console** — item review queue (send back with a reason, advance to next),
  the exam window control, the bootstrap-credentials block.
- **Scripts** — `bootstrap-admin`, `dev-token`, `sync-items`,
  `sync-assessments`, `phase-report`.

**Deferred, with the reason recorded**

- Acts 3–4 (stages 09–18) — out of examinable scope by the instructor's ruling.
- Five minigames — R3.2b, their chapters are scaffolds, and hard rule 5 forbids
  inventing the lesson to have something to practise.
- The public marketing site — five routes, owned by no phase.

**Honest gaps**

- **Nothing is `live`.** All 183 items are `review` until approved at `/items`.
  No student can sit anything until that happens. `/items` passed the revamp gate
  on 25 Sep 2026, so the page is ready; the 96 act-1 approvals are the
  instructor's to make.
- `design/templates/` — every console route has `template.png`; only `/items`
  has passed the gate (25 Sep 2026). An R3 sign-off item.
- The reverse travel transition (leaving a stage back to the map).
- R4 and R5 have not started.

---

## 5. Process documents — applied, and not

**Applied:** hard rules 1–8 (denial tests led every data-touching change), the
engine rules, the content rules (book-map checked, sources cited),
`REDESIGN-CLAUDE.md` §2 (screenshot before believing — it caught three defects),
§2b, §2c, §2d (stopped for the instructor's calls on scope, P-item solvers, and
the stage-00 gate).

**Not applied, and worth deciding on:**

- **`CLAUDE-CODE-PRACTICES.md` §4, Writer/Reviewer** — the doc says use it *for
  the engine*. 56 solvers were written and self-reviewed. Tests are strong; a
  second reviewer pass never ran.
- **`PROMPT-LIBRARY.md`'s four templates** — work went conversationally.
- **§6, "write a skill for anything you'll do twice"** — eight item files were
  hand-authored. The obvious candidate before acts 3–4.

---

## 6. Context degradation — what actually happened

Three claims went stale **inside the session that wrote them** (`0ef2856`): an
items/assessments count written an hour before assessments existed, and two
"no assessments row exists" lines that were true for about an hour. The lesson
is not that the docs were wrong — it is that **a doc edited early in a long
session describes a repository that no longer exists by the end of it.** If you
write a count, write the command beside it.

Guards that fired and worked, which is the system doing its job:

- `design/global-setup.ts` refused specs against a truncated database.
- `sync-assessments.mjs` took the whole seed down on missing blueprints — now a
  warning.
- `bank-feasibility.spec.ts` went green on length and **red on provenance**, and
  the product was right while the test was wrong.

---

## 7. The session-closing question

`CLAUDE-CODE-PRACTICES.md` §10 and `START-HERE.md` §7 both require it:

> **"Which parts of this did you actually run, and what are you unsure about?"**

**Last session ran:** `pnpm verify` end to end; every solver test; the 38 RLS
denial tests; the feasibility spec including a mutation that made it fail;
Playwright for the review queue, exam window and credentials block, each opened
and looked at; `--check` against live Supabase.

**Unsure about:** anything against live Supabase beyond the read-only check;
whether Vercel and Render are connected and building; whether
`bootstrap-admin.mjs`'s *success* path works against a real project (guards are
exercised, the happy path is not); and the pedagogical quality of the 183 items,
which is the instructor's review, not a test.

---

## 7b. Three ship blockers found by going live, 14 September

All three were invisible until items were approved, because every predicate
involved looks only at `live` rows and **nothing had ever been live**. Found by
approving act 1 on the local stack and walking a real student through. Fixed,
tested, committed — `808d28e`, `efd50a0`.

1. **A stage check sampled the whole bank.** A "Stage 01 Check" returned items
   from stages 01–04. Worse, `routes/attempts.ts:145` writes mastery for
   `items[0].stageId`, so submitting it would have written stage 01's mastery
   onto **stage 04** and unlocked stage 05. `loadBlueprintFor()` never selected
   `b.stage_id`, so the caller had no stage to narrow the pool to.
   `test/stage-check-scope.spec.ts` now holds it with 40 decoy items.

2. **INV-17 demanded columns the engine does not read.** `tolerance` and
   `params_schema` on live P items; the engine reads only `solver_ref`. All 30
   authored P items would have failed a `fail`-severity invariant on approval.

3. **INV-16 demanded 4 distractors** where the engine asks for 3
   (`optionCount` defaults to 4). All 141 authored S items carry 3.

Plus: `run_invariants()` counted inside its own `limit 5`, so **74 illegal rows
reported as "5"** to the nightly job and the console alike.

**The lesson, and it generalises:** a guard that only inspects `live` rows is
untested until something is live. `helpers/bank.ts` seeds ONE stage and fills
`tolerance`/`params_schema` that no authored item has — so the fixtures were
shaped to a contract the bank had left behind, and every suite was green.

**Proven end to end on the local stack after the fixes:** stage 01 check → 8
stage-01 items across 5 objectives → 8/8 → mastery 1.0 on stage 01 → stage 02
unlocked, stage 03 still correctly locked. With all 96 act-1 items live,
`pnpm db:invariants` reports 25 clean, 0 failures.

### 7c. The browser pass, and the blocker only it could find

The MCP Playwright server was down, so this used the project's own
`@playwright/test` against the student app on **5183** (5173/5174 belong to
another project on this machine). Captures in
`design/screenshots/session-2026-09-14/`.

**A fourth blocker, invisible to every test: ordering items were unanswerable.**
`AttemptRunner` had no branch on `item.type`, so a type-G item rendered as a
radio group — a sequence question with a single-choice control. It sent
`{index}`, and `grade.ts:85` returns `miss(item, "no ordering submitted")` for
anything that is not `{order}`. **Every ordering item was wrong, always.** Six
are live in act 1; a Stage 01 check drew two of eight, capping an honest student
at 6/8 against a 70% threshold. Fixed in `da5831b` with a keyboard-first
move-up/move-down control.

The second bug inside the fix is worth remembering: committing on every move
recorded the arrangement after the FIRST click, because `recordAnswer()` inserts
`on conflict do nothing` and the first answer wins. The UI ended visibly correct
and the database stored a half-sorted list. **Reordering does not submit; an
explicit button does.**

**Verified in the browser:** the 3D map, the flat map, the stage reader (9,857
characters and a "Start the check" control once unlocked), and the runner — at
1440 and 380, no horizontal scroll on any route, no page errors, 44px touch
targets, contrast AA across 1,181 checks.

**`/app/map` is genuinely keyboard-operable** — 0 canvases, 1 SVG, every stage a
focusable `<button>` carrying its state and lock reason, behind a skip link.
CLAUDE.md's degrade-in-place rule holds; it looks orbital but it is real DOM.

**Two things to look at, neither a blocker.** The first thing a student meets on
`/app` is an onboarding card reading "PLACEHOLDER TEXT — NOT REAL COURSE CONTENT
YET". And the runner never tells a student that the first answer for a question
is final, which is how `responses` actually behaves for every item type.

**Still unproven: the deployed apps.** Vercel and Render are reported live, but
the repo records no URLs — `CORS_ALLOWED_ORIGINS` is `sync: false` in
`render.yaml`, which that file itself calls the likeliest cause of "works
locally, not deployed". `octa-api.onrender.com/healthz` answers **404 with an
HTML body**, not OCTA's `{"error":{"code":...}}` envelope, so that is not this
API. Get the real URLs before believing anything about production.

---

## 8. Pick one, and say the phase first

**(a) SHIP — the critical path.** Decide 3a, then approve enough of the act-1
bank at `/items`, then 3b and go live. Verify a real student can read a stage,
sit its check, and see the next stage unlock.

**(b) Approve the bank.** `pnpm dev:token`, walk `/items`, use send-back to
reject what is wrong. Nothing is examinable until this is done.

**(c) Author chapter 08.** The one thing between Ship 1 and Ship 2.

**(d) Close R3.** One real task plus `design/templates/`; then R4.

**(e) Author acts 3–4.** Solvers exist. Items for 09–18, widen `scope.ts`, and
let `bank-feasibility.spec.ts` prove the exams fill.
