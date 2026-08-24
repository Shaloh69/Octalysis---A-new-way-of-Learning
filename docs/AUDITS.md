# AUDITS.md
### Verifying OCTA actually works — invariants, test matrices, and cadence

A test suite proves the code you wrote does what you meant. An **audit** proves the *running
system* is still in the state you believe it's in. This project needs both, because the
consequences of being wrong are a student getting the wrong grade or seeing another student's
data.

Three layers:

| Layer | Runs | Answers |
|---|---|---|
| **Tests** | Every commit, in CI | "Does this function behave?" |
| **Invariants** | Nightly + on demand + before every deploy | "Is the database still in a legal state?" |
| **Audits** | Per phase, pre-launch, per semester | "Is the whole system doing what we claim?" |

---

## 0. First — a gap in what I gave you earlier

`attempts` stores a `seed`, and the whole regrade/dispute story depends on regenerating a paper
from it. **But if you ever change a solver or the shuffle order, old seeds stop reproducing.**
The stored seed becomes a lie.

Fix, before P3 ships:

```sql
alter table attempts add column engine_version text not null default '1.0.0';
alter table items    add column solver_version text;   -- pinned per item
```

The generator reads `engine_version` off the attempt and dispatches to that version of the
solver registry. Old versions are kept forever, never deleted. This is the difference between
"we can regenerate any paper" and "we can regenerate papers made since the last time we touched
the code."

**Audit that enforces it:** INV-13 and the nightly reproducibility sample, below.

---

## 1. Invariants — things that must always be true

Each is a SQL check returning offending rows. Zero rows = pass. All of them live in
`db/addendum-audit.sql` and run as one function, `run_invariants()`.

### Security

| ID | Invariant |
|---|---|
| **INV-01** | Every table in `public` has RLS enabled |
| **INV-02** | Every RLS-enabled table has at least one policy (RLS on + no policy = silently blocked, which hides bugs) |
| **INV-03** | No `security definer` function without an explicit `set search_path` |
| **INV-04** | No storage bucket is public except `audio` |

### Identity

| ID | Invariant |
|---|---|
| **INV-05** | Every `profiles.student_id` exists in `student_directory` and is `claimed` |
| **INV-06** | No `student_directory` row is `claimed` without a matching `profiles` row (no orphaned claims from a failed registration) |
| **INV-07** | `student_id` is unique across `profiles` |
| **INV-08** | Every `profiles.role` change has a corresponding `audit_log` entry |

### Assessment integrity

| ID | Invariant |
|---|---|
| **INV-09** | Every `responses` row has a matching `attempt_items` row at the same ordinal |
| **INV-10** | No `responses.answered_at` later than its attempt's `submitted_at` |
| **INV-11** | Every `submitted` attempt has a non-null `score` |
| **INV-12** | Every attempt's item count equals its blueprint's `total_items` |
| **INV-13** | Every `attempt_items` row references an `(item_id, item_version)` pair that exists |
| **INV-14** | No live attempt references an item version retired *before* the attempt started |

### Item bank health

| ID | Invariant |
|---|---|
| **INV-15** | No `status='live'` item has a null `reviewed_by` |
| **INV-16** | Every live type-S item has ≥ 4 entries in its distractor pool (we sample 3) |
| **INV-17** | Every live type-P item has a `solver_ref` that resolves in the registry, and a `tolerance` |
| **INV-18** | **Bank starvation check** — for every assessment, the live item count satisfies every cell of its blueprint. Warns *before* a student hits `BlueprintUnsatisfiable` at 9pm. |

### Curriculum & gating

| ID | Invariant |
|---|---|
| **INV-19** | Every `stages.prereq` entry references an existing stage |
| **INV-20** | The prerequisite graph is acyclic |
| **INV-21** | `stage_locks` is unique per `(scope, scope_id, stage_id)` |
| **INV-22** | Every `stage_locks` row with `state <> 'auto'` has a `reason` and an `audit_log` entry |
| **INV-23** | No `content_blocks` row references a non-existent stage |

### Feedback

| ID | Invariant |
|---|---|
| **INV-24** | `channel='sus'` rows have exactly 10 answers, each 1–5, and `sus_score` matches `sus_score(sus_answers)` |
| **INV-25** | `channel='content_report'` rows have a non-null `item_id` and `resolved_variant` |

**Where they run:** nightly **Supabase Cron** (`pg_cron` calling `run_invariants()` and writing
`audit_runs`), on demand from `/console/audit/system`, and as a blocking step in the deploy
pipeline against staging. **Not a Render Cron** — Render's free tier has none. See `DELIVERY.md`
§2.2.

---

## 2. The self-audit console page

`/console/audit/system` — admin only. This is worth building even though it's "just" internal,
because it's also the single best thing to show a thesis panel.

```
System audit                                   Last full run: 2 hours ago  [Run now]

  Security          ✓ 4/4          all clear
  Identity          ✓ 4/4          all clear
  Assessment        ✗ 5/6          INV-12 — 3 attempts with wrong item count  [view rows]
  Item bank         ⚠ 3/4          INV-18 — Stage 14 bank short 6 'apply' items
  Curriculum        ✓ 5/5          all clear
  Feedback          ✓ 2/2          all clear

  Reproducibility   ✓              40/40 sampled papers regenerated identically
  Key leakage       ✓              0 answer values found in student API responses
  Bundle scan       ✓              0 answer strings found in the client bundle
```

Failing checks link to the actual offending rows. Warnings (⚠) don't block; failures (✗) page
you. Every run writes to `audit_runs` so you have a history — a check that started failing three
weeks ago tells you which deploy did it.

---

## 3. Test matrices — the details that need exhausting

### 3.1 Authorization denial matrix

The one that matters most. For **every** table × **every** role × **every** operation, assert the
expected outcome. Generate it as a table-driven test, not 200 hand-written cases.

| Table | anon | student (own) | student (other's) | teacher | admin |
|---|---|---|---|---|---|
| `profiles` | ✗ | R, U (not role) | ✗ | R all | RW all |
| `student_directory` | ✗ | ✗ | ✗ | RW | RW |
| `items` | ✗ | **✗ all ops** | ✗ | RW | RW |
| `item_stats` | ✗ | ✗ | ✗ | R | RW |
| `content_blocks` (unlocked) | ✗ | R | — | R | RW |
| `content_blocks` (locked) | ✗ | **✗** | — | R | RW |
| `attempts` | ✗ | R own | ✗ | R all | RW |
| `attempt_items` (in progress) | ✗ | **✗** | ✗ | R | R |
| `attempt_items` (submitted) | ✗ | R own | ✗ | R | R |
| `responses` | ✗ | R own, **✗ insert** | ✗ | R all | R |
| `responses` UPDATE/DELETE | ✗ | **✗ (trigger)** | ✗ | **✗** | **✗** |
| `stage_locks` | ✗ | ✗ | ✗ | RW | RW |
| `audit_log` | ✗ | ✗ | ✗ | R | R |
| `feedback` | ✗ | insert, R own | ✗ | insert, R own | RW all |

**Every bold cell needs a test that watches it fail before it passes.** Write the policy
deliberately wrong once, confirm the test catches it, then fix it. A denial test you've never
seen fail is a test you don't know works.

**V-4, now applied:** `responses` is written **only** by the grading service under `service_role`.
There is deliberately no client INSERT policy. A student-side INSERT succeeding is a **critical
finding**, not a missing feature — it would let a student write their own `is_correct = true`.

**The `anon` column is not yet true.** `VERIFICATION.md` V-15 found that no policy in the schema
carries a `TO` clause, so every policy is `TO public`, which includes `anon` — and `sec_read`,
`ob_read`, and the `section_id is null` branch of `as_read` currently grant anonymous reads,
including `assessments.exam_salt`. Until V-15 is applied, read the `anon` column above as the
*intended* state, not the implemented one, and add a denial test per row.

### 3.2 Stage lock resolution truth table

Three scopes × three states × three time conditions. Parameterize it.

| user override | section override | global override | prereq met | `unlock_at` | expected |
|---|---|---|---|---|---|
| unlocked | — | — | no | past | **unlocked** (user wins) |
| locked | unlocked | — | yes | — | **locked** (user wins) |
| auto | unlocked | locked | no | — | **unlocked** (section beats global) |
| auto | auto | unlocked | no | future | **locked** (not yet) |
| auto | auto | auto | yes | — | **unlocked** (policy) |
| auto | auto | auto | partial | — | **locked** (all prereqs, not some) |
| — | — | — | — | — | **unlocked** for any staff role |

Plus: `lock_at` in the past must re-lock. Test at the boundary second, not a minute either side.

### 3.3 Question engine

| What | Assertion |
|---|---|
| Determinism | Same seed + same `engine_version` → byte-identical paper, 1000 runs |
| Cross-student uniqueness | 1000 simulated pairs, median item overlap < 15% |
| Blueprint conformance | Every constraint cell satisfied exactly, 500 generated papers |
| Unsatisfiable blueprint | Throws, names the cell and the shortfall — never silently under-fills |
| Key stripping | No student-facing response body contains any value present in `attempt_items.correct_value`, across every endpoint |
| Option shuffle | Correct answer's position is uniformly distributed across 10,000 papers (χ² test) — a generator that puts the answer at position B 40% of the time is exploitable |
| Distractor uniqueness | No resolved item has duplicate options, and no distractor equals the correct value (a float collision in a P item will do this) |
| Param bounds | 100,000 draws, every value inside its schema range, no NaN, no Infinity |
| Numeric grading | Tolerance is relative, not absolute; `0.1 + 0.2` cases handled; scientific notation accepted; unit suffixes stripped |
| Solver math | Each solver checked against a hand-computed table, including the worked examples from the source decks (133 MHz → 7.52 ns) |
| Reproducibility across versions | An attempt at `engine_version=1.0.0` still regenerates identically after the registry moves to 1.1.0 |

### 3.4 Answer-key leakage — three independent checks

1. **API response scan** (runtime): for a live in-progress attempt, request every student-facing
   endpoint with that student's token, and assert no correct value appears in any response body.
2. **Bundle scan** (build time): after `vite build`, grep the output for a set of known seeded
   answer strings. **This is the exact bug in the app you're replacing** — its `lessonData.js`
   shipped every answer to devtools. Make the check permanent so it can never come back.
3. **Network capture** (manual, pre-launch): open devtools, take a real Concept Check, and read
   every response by hand. Automated checks miss things a human notices in 90 seconds.

### 3.5 Grading & regrade

- Submitting the same attempt twice is idempotent — no double-scoring.
- Autosave + refresh mid-attempt resumes at the right ordinal with prior answers intact.
- Network drop between answer and grade: no lost response, no duplicate.
- **Key correction regrade:** when an item's key is fixed, the affected attempts are enumerable,
  the bulk regrade is transactional, every changed score writes to `audit_log`, and scores can
  only move in the direction the correction implies. Rehearse this once in staging — you will
  need it for real.

### 3.6 Content fidelity

- Every definition and figure in Stages 01–05 matches `docs/source/day1-deck.md` verbatim.
  Automate it: extract quoted spans, diff against source. **This catches the highest-risk failure
  mode of building with an LLM — plausible-sounding invented lecture text.**
- Running `sync-content` twice produces zero changes the second time.
- No `content_blocks` row references a missing media file in Storage.

### 3.7 Accessibility

Automated (CI, `axe-core` via Playwright): zero violations on every route, in all three themes.

Manual, per release, because axe catches roughly a third of real issues:
- [ ] One full stage completed keyboard-only, start to finish, including a matching item
- [ ] Every drag interaction completed by tap only
- [ ] Screen reader pass on the attempt runner — verdict announced via `aria-live`
- [ ] All three themes at WCAG AA, verified by computation not by eye
- [ ] `prefers-reduced-motion` disables all motion
- [ ] 380px width, no horizontal scroll, no clipped controls
- [ ] Focus visible on every interactive element, including inside dialogs
- [ ] 200% browser zoom without loss of function

### 3.8 Performance & load

| Target | Threshold |
|---|---|
| Paper generation (70 items) | p95 < 800 ms |
| Single answer grade | p95 < 300 ms |
| Stage content load | p95 < 500 ms |
| Lecture Mode realtime fanout | < 1.5 s to 40 clients |
| **40 students starting the same assessment within 30 s** | 0 errors, p95 < 2 s |
| Render cold start | measured and documented; mitigation confirmed working |

Tool: `k6`. Write the 40-concurrent scenario in P3, not P10 — if the generator is slow you want
to know while you can still change its design.

Also load-test the **pathological case**: 40 students, all on the *same* stage, all re-rolling
practice items. That's what actually happens in a lab session.

### 3.9 Data integrity & recovery

- [ ] Append-only trigger on `responses` blocks UPDATE and DELETE, verified as `service_role` too
- [ ] Daily Postgres backup exists
- [ ] **Restore rehearsed into a scratch project, and invariants run green against the restore.**
      A backup you haven't restored is a guess.
- [ ] Rollback of a bad deploy rehearsed, timed, and under two minutes
- [ ] `/maintenance` page tested with real traffic

### 3.10 Feedback system

- SUS scoring verified against hand-computed cases: all 5s → 100, all 1s → 0, all 3s → 50.
- Negatively-phrased items (2, 4, 6, 8) score inverted. Get this wrong and every number you
  report in the thesis is wrong.
- Trigger gate: prompt does not appear before 3 sessions **and** 1 completed workflow.
- Dismiss is honoured; no re-prompt within 6 weeks.
- A content report from the student app arrives in the item review queue with the exact resolved
  variant attached.

---

## 4. The fairness audit — run this every semester

This is the one a thesis panel will actually interrogate. "Unique papers" is worthless if the
papers aren't equivalent.

**Per-cohort equivalence report**

1. For every student's paper, compute expected difficulty = mean `p_value` of its items
   (using each item's historical stats).
2. Report the cohort mean and standard deviation.
3. **Flag any student whose paper is more than 1 SD from the cohort mean.** Investigate before
   grades are released, not after a complaint.
4. Report actual score distribution against expected difficulty. If the correlation is weak, the
   blueprint isn't doing its job.

**Variant drift, per parameterized item**

Bucket resolved parameters into quintiles and compute p-value per bucket. A spread above 0.25
means one number range is materially harder — narrow the range or split it into two items.
Example: if `f = 66 MHz` is answered correctly 80% of the time and `f = 3300 MHz` only 40%, the
item is measuring arithmetic confidence, not the concept.

**Exposure control**

No item should appear in more than ~30% of papers in a cohort — that's a leak risk and a sign
the bank is too thin for the blueprint. Report the top 20 most-exposed items each semester.

**Write the equivalence report into the thesis.** It converts "each student got different
questions" from a claim into a measured result, and it's the strongest chapter you'll have.

---

## 5. Audit cadence

| When | What |
|---|---|
| **Every commit** | typecheck, unit tests, denial matrix, axe, WCAG contrast, bundle answer-scan |
| **Every deploy to staging** | full invariant suite, blocking |
| **Nightly** | invariants, reproducibility sample (40 random attempts regenerated and diffed), item stats recompute, auto-flagging |
| **End of every phase** | that phase's exit criteria + Supabase Security Advisor + a manual devtools pass |
| **Before every assessment window** | INV-18 bank starvation, blueprint dry-run, lock matrix review, Render warm |
| **After every assessment** | fairness/equivalence report, flagged item review |
| **Pre-launch (P10)** | everything above + load test + restore rehearsal + rollback rehearsal |
| **Every semester** | full fairness audit, exposure report, `exam_salt` rotation, retire items with D < 0.20 |

---

## 6. Claude Code prompt — build the audit system

Run this as its own session, after P3 and before P10.

````
Read AUDITS.md completely, plus db/schema.sql. Build the audit system in three parts.
Do part 1 fully and show me the output before starting part 2.

PART 1 — Invariants
Create db/addendum-audit.sql. One SQL function per invariant INV-01 through INV-25,
each named inv_01_rls_enabled() etc., each returning a setof with the offending rows
and a text description. Then a run_invariants() function returning
(id, name, severity, offending_count, sample jsonb).

Seed the database with a deliberately broken state for each invariant, confirm every
check catches it, then clean up. Show me the failing output before the passing output.
I want to see them fail.

PART 2 — Test matrices
- test/authz.matrix.spec.ts — table-driven from the matrix in AUDITS.md §3.1.
  Do NOT hand-write 200 cases; drive it from a data structure.
- test/locks.truth.spec.ts — the truth table in §3.2, parameterized, including
  boundary-second tests on unlock_at and lock_at.
- test/engine.spec.ts — every row of §3.3, including the chi-square test on answer
  position distribution.
- test/leakage.spec.ts — the runtime API scan from §3.4.1.
- scripts/scan-bundle.ts — the build-time bundle grep from §3.4.2, wired into CI as a
  blocking step.

PART 3 — Self-audit page
/console/audit/system per §2. Admin only. On-demand run, history in an audit_runs
table, failing checks link to the offending rows.

Constraints:
- Every denial test must be demonstrated failing first. If you can't make it fail,
  the test is wrong.
- No test may use the service_role key except where it is explicitly testing that
  service_role bypasses RLS.
- Report at the end: which checks you actually executed, which you only wrote, and
  anything in AUDITS.md you could not implement and why.
````

---

## 7. What "verified" means here

At the end of every session and every phase, the honest answer to these three questions is worth
more than the code:

1. **What did you actually run?** Not "should work" — ran, saw the output.
2. **What did you only write?** Tests that exist but were never executed against a failing case
   are decoration.
3. **What are you unsure about?**

A system audit is only as good as the willingness to record a red result. If every audit run in
your history is green, the audits aren't checking anything real.
