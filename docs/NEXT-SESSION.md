# NEXT-SESSION.md — start here after a `/clear`

**Written 9 September 2026, at the end of the session that built the item bank.**
Everything below was **measured, not remembered**, and the measurement command is
given beside each figure so you can re-run one rather than re-derive all of them.

> **Do not re-audit this file's contents.** It exists so a fresh session does not
> spend its first hour rediscovering what the last one already established.
> Check a number only when you are about to depend on it, and then check that
> one. `REDESIGN-CLAUDE.md` §2c rule 3 cuts both ways: verify before repeating,
> but do not re-derive what carries its own evidence.

---

## 1. Say this out loud, first

**Redesign phase: R3 — page templates and redesign, 41 of 49.**
Counted from `docs/redesign/phases/R3-page-templates-and-redesign.md`, not copied.

R0 28/28 · R1 36/36 · R2 21/21 · **R3 41/49** · R4 0/13 · R5 0/24

**But the last two sessions of work were NOT R3.** The item bank, the solvers,
the assessments and the deployment fixes are P3/P4/P5 work on `PHASES.md`'s
track. No R-phase box moved, and that is correct rather than an oversight — do
not "reconcile" the phase files to account for it.

R3's 8 open boxes are **one real task** (both loading screens captured as frame
sequences, not stills) plus **seven sign-off boxes**, of which only
`design/templates/` being populated is genuinely unmet.

---

## 2. The state of the world, measured

### Local — works, and is the only place anything works

```
pnpm db:up                                  Postgres 16 on :54329
pnpm db:reset && node scripts/db-demo.mjs   -> 183 items, 2 assessments, 115 objectives
pnpm dev:api                                :8090   NOT the raw dev script
pnpm dev:token                              a signed-in console session
pnpm verify                                 371 API · 53 web · 27 console, all green
```

`pnpm verify` also runs `check:items`, which validates the bank without writing.

### Live Supabase — exists, answers, and is empty and stale

Measured 9 Sep with `node scripts/db-push-supabase.mjs --check`, which applies
nothing. Project `lqvkqdaqtkhxmnvodmyr`, PostgreSQL 17.6.

| | Live | Should be |
|---|---|---|
| public tables | **21** | 22 |
| stages | **18** | 19 |
| profiles · objectives · content_blocks | 0 · 0 · 0 | 25 · 115 · 217 |
| items · assessments | 0 · 0 | 183 · 2 |

The missing table is **`submissions`** — 40% of the grade. `db-push-supabase.mjs`
omitted `addendum-submissions.sql`; **that is fixed** (`d98ed0d`), but the fix
has not been applied to the live project. 18 stages means the live schema
predates the 18-chapter rebuild.

**Nothing has been lost, because nothing was there** — 0 profiles, 0 attempts,
0 responses.

### Vercel / Render

`origin/main` is current as of this session. Whether the hosts are connected and
building is **unverified** — no dashboard access from the agent. Ask the
instructor rather than assuming either way.

---

## 3. The one decision waiting

**Re-pushing the schema to Supabase requires `--reset`, which runs
`drop schema public cascade`.** It is irreversible and outward-facing.

Today's reading says it is safe — there is no data to lose. That reading is a
**snapshot**, and it is not consent. **Ask the instructor explicitly before
running it**, and re-run `--check` immediately beforehand so the decision rests
on a current reading rather than this file.

If it is approved, the go-live sequence is:

```bash
node scripts/db-push-supabase.mjs --reset      # schema, all five files
# then, with DATABASE_URL pointing at Supabase:
node scripts/sync-content.mjs                  # 19 stages, 115 objectives, content
node scripts/sync-items.mjs                    # 183 items, all `review`
node scripts/sync-assessments.mjs              # Prelim + Midterm, 5 attempts
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
  node scripts/bootstrap-admin.mjs "instructor@email" 
```

The last one prints a temporary password and stamps
`app_metadata.must_change_credentials`, so the console blocks on a change screen
at first sign-in. That is deliberate.

---

## 4. What is built, and what is deliberately not

### Built and verified this session

- **60 solvers** in `engine/` (4 original + 56 new across four act banks), each
  tested against hand-computed values or published figures — Hamming check bits
  reproduce Stallings Table 5.2, PCIe gives 250 MB/s and 8 GB/s, 7200 RPM gives
  4.17 ms, IEEE 754 uses biases 127 and 1023.
- **183 items** covering all 59 gradeable objectives in stages 01–08, every one
  citing its book section, checked against `content/book-map.json`.
- **`engine/scope.ts`** — the examinable-scope flag. Stage 08 / Midterm.
- **`bank-feasibility.spec.ts`** — fills a real Prelim and Midterm from the real
  files, asserts every constraint cell exactly, across 60 student seeds.
- **Console**: item review queue (send back with a reason, advance to next),
  the exam window control, and the bootstrap-credentials block.
- **`bootstrap-admin.mjs`**, **`dev-token.mjs`**, **`sync-items.mjs`**,
  **`sync-assessments.mjs`**.

### Deliberately deferred, with the reason recorded

- **Acts 3 and 4 (stages 09–18)** — solvers are written, tested and registered
  but **out of examinable scope**. Instructor's ruling: stop at the Midterm.
  Widening means authoring items, raising `EXAMINABLE_THROUGH_STAGE`, adding the
  two blueprints to `EXAMINABLE_BLUEPRINTS`, then `pnpm verify` — the
  feasibility spec proves the exams fill before a student sees them.
- **Five minigames** — R3.2b, deferred because their chapters are scaffolds.
  Hard rule 5 forbids inventing the lesson to have something to practise.
- **The public marketing site** — five routes, still owned by no phase.

### The honest gaps

- **Nothing is `live`.** All 183 items are `review` until the instructor
  approves them at `/items`. That is the ruling, not a gap — but no student can
  sit anything until it happens.
- **`design/templates/`** is empty. R3 sign-off item.
- **The reverse travel transition** (leaving a stage back to the map).
- **R4 and R5** have not started.

---

## 5. Context degradation — what happened, so it is not repeated

Three claims went stale **inside the session that wrote them**, all corrected in
`0ef2856`:

- `IMPLEMENTED.md` said "183 items, **0** assessments" — written an hour before
  assessments existed.
- The same file said "nothing seeds items or assessments" in the present tense,
  describing a problem that session had already fixed.
- `PROGRESS.md` and the findings log both said "no assessments row exists".

**The lesson is not "the docs were wrong".** It is that a doc edited early in a
long session describes a repository that no longer exists by the end of it. If
you write a count, write the command beside it.

Two environment traps fired and were caught by their own guards, which is the
system working:

- `design/global-setup.ts` refused to run specs against a truncated database
  after a vitest run had truncated the fixtures.
- `sync-assessments.mjs` failed hard on missing blueprints and took the whole
  `db-demo` seed down with it. Now a warning (`62a67f7`).

---

## 6. Process documents — applied, and not

**Applied:** hard rules 1–8 (denial tests led every data-touching change), the
engine rules (`Math.random` banned, distractors name a misconception,
never mutate a live solver), the content rules (book-map checked, sources cited),
`REDESIGN-CLAUDE.md` §2 (screenshot before believing), §2b (phase named),
§2c (verify before repeating), §2d (stopped for the instructor's calls on scope
and on P-item solvers).

**Not applied, and worth deciding on:**

- **`CLAUDE-CODE-PRACTICES.md` §4, the Writer/Reviewer pattern** — "use it for
  the engine". 56 solvers were written and self-reviewed. The tests are strong,
  but a second pass by a reviewer agent was never run.
- **`PROMPT-LIBRARY.md`'s four templates** — work proceeded conversationally
  rather than through Template A/B/C/D.
- **`CLAUDE-CODE-PRACTICES.md` §6, skills** — "write one for anything you'll do
  twice". Item authoring was done eight times by hand and is the obvious
  candidate for act 3–4.

---

## 7. The session-closing question

`CLAUDE-CODE-PRACTICES.md` §10 and `START-HERE.md` §7 both require it:

> **"Which parts of this did you actually run, and what are you unsure about?"**

**Ran:** `pnpm verify` end to end repeatedly; every solver test; the RLS denial
suite (38); the feasibility spec including a mutation that made it fail; the
Playwright specs for the review queue, the exam window and the credentials block,
each opened and looked at; `--check` against live Supabase.

**Did not run, and am unsure about:** anything against live Supabase beyond the
read-only check; whether Vercel or Render are connected and building; whether the
`bootstrap-admin.mjs` happy path works against a real project — its guards are
exercised, its success path is not; and the 183 items' *pedagogical* quality,
which is the instructor's review and not a test.

---

## 8. Suggested opening for the next session

> Read `docs/NEXT-SESSION.md` first — it carries the measured state and you
> should not re-derive it.
>
> Name the phase. Then pick ONE of:
>
> **(a) Go live.** Confirm with me before `--reset`. Re-run `--check` first,
> then the sequence in §3, then verify a student can reach a stage.
>
> **(b) Approve the bank.** Walk `/items` with `pnpm dev:token`, using the review
> queue's send-back to reject what is wrong. Nothing is examinable until this is
> done.
>
> **(c) Close R3.** One real task and `design/templates/`; then R4.
>
> **(d) Author acts 3–4.** Solvers exist. Write items for stages 09–18, widen
> `scope.ts`, and let `bank-feasibility.spec.ts` prove the exams fill.
>
> End by answering: which parts did you actually run, and what are you unsure
> about?
