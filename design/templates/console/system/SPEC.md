# `/system` — SPEC

**Every rule a database constraint cannot express, checked now, each one named,
with what it found.**

There is no `/console/system` section in `PAGE-SPECS.md`. The plan is
`TEMPLATE-LINKS.md` row 77: *"a list of named checks, each pass/fail, with a
timestamp and a way to see the detail of a failure ... never an aggregate 'all
good' badge that hides one failing invariant. `INV-*` failures are correctness
failures, not metrics."* `db/CLAUDE.md`: `run_invariants()` is for rules a
constraint cannot express.

References: `SOURCE.md` (shadcn.io's Health Checks for the frame and the row,
its Status Page for naming what needs attention first, Shadcn UI Blocks'
Component Status List for the description line and the absolute time).
Colours and type are ours.

## What was missing — 28 Sep 2026, before the rebuild

| Planned | Found |
|---|---|
| Never an aggregate badge | The headline was **"The database is in a legal state."** in success colour |
| A list of named checks, each pass/fail | Only non-passing checks were listed. The 21 passing ones sat in a closed `<details>`, as bare function names (`inv_01_rls_enabled`) |
| The detail of a failure | `JSON.stringify(sample)` in a `<pre>`: `{"bucket":"1","needed":40,...}` |
| (implied) what a check is for | Nothing. No check said what it protects or what to do |
| Notices honest | `EXPECTED_EMPTY` relabelled INV-18/27/28/29 as notices **whenever they had offenders**, captioned *"there is nothing yet for these to check"*. Measured on the seeded demo: INV-18 was reporting that the Prelim and Midterm have **0 of 40 live items**, the Prelim blocker itself, filed as expected |
| A timestamp | `shortDate(ranAt)`: a date, no time |
| History | None. `audit_runs` is written nightly by pg_cron's `run_invariants_nightly()` on Supabase, and nothing read it |

## Instructor decisions, 28 Sep 2026

| Question | Ruling |
|---|---|
| When is a check a notice? | **Only when the table it reads is truly empty**: INV-18 when the bank has no items at all, INV-27 when there are no content blocks, INV-28 and INV-29 when there are no objectives. Otherwise it keeps `run_invariants()`' own severity. The API decides and **says why** in `noticeReason` |
| What a check protects, what to do | **A catalogue in the API**: one entry per `INV-*` id with a title, what it checks, what it protects, and what to do (naming the console page that fixes it). An API test fails if `run_invariants()` returns an id with no entry |
| History | **Read the nightly runs**, read-only: the last 14 rows of `audit_runs`. The page never writes. Empty, it says why (pg_cron runs on the Supabase deployment, not on a local database) |
| API health | **Stays on `/console/settings`** (not built), recorded as deferred in `apps/console/CLAUDE.md`. This page says how long the run took |

**Read-only is binding.** This page runs checks; it never fixes data.

## Structure, top to bottom

1. **Header**: *System health*, one line: "28 checks for the rules a database
   constraint cannot express, run against the live database." On the right,
   **Run again** (Health Checks' *Check all*)
2. **Run line**: "Checked 28 Sep 2026, 16:40:12 · 84 ms", mono numbers. Then
   the **counts in words, every state named, including zero**:
   *0 failing · 2 warnings · 0 notices · 26 passing*. This is a count, never a
   verdict: no "all good", no success colour on the line
3. **Needs attention** (Status Page's incidents first), only while a check is
   not passing: one link per such check, "INV-18 Every paper can be filled:
   warning, 2 rows". Pressing one scrolls to that check, opens its detail and
   focuses its disclosure
4. **The checks, all 28, every one visible**, grouped under the areas of
   `addendum-audit.sql`: Security, Accounts, Papers and grading, Item bank,
   Curriculum and map, Content and locks, Feedback. One row each:
   - the **state in a word with a shape** (*Failing* ✕, *Warning* !, *Notice* i,
     *Passing* ✓): never colour alone
   - the **id** in mono and the **title**
   - under it, **what it protects**
   - on the right, **what it found**: "2 rows" in mono, or "none"
   - a **Details** disclosure (`aria-expanded`), naming its check
   A failing check's detail is **open on arrival**; every other is closed
5. **Details** (Health Checks' panel under the row): *Checks* (the rule, one
   sentence), *When it fails* (what to do, naming the page), *Why this is a
   notice* when it is one, then **the offending rows as a small table**,
   every column the function returns, values in mono, "showing 5 of 12" when
   the sample is cut; last, the database's own terms in mono:
   `inv_18_bank_starvation()` and the severity `run_invariants()` gave it
6. **Nightly runs**: the last 14 rows of `audit_runs`, newest first: when (mono
   date and time), what ran it (*nightly* for `cron`), and **what it found in
   words**: "Nothing failing", or "1 failing: INV-18 · 2 warnings: INV-25,
   INV-27". Counted from each run's stored results with their own severities,
   never from its `passed` column (see *Parked*). Empty: says that none is
   recorded here and why

At 1440 a row is one line of three columns (state, name and protects, found
and Details). **Below 40rem of the page's own width** it stacks: state and id,
then title, then protects, then found and Details. Nothing is truncated at
either width; an identifier or a sample value wraps.

## Loading, failure, feedback (`.claude/rules/design.md`)

- First load: nothing for 400ms, then a **skeleton of rows** shaped like the
  list (a header bar, seven group heads, rows); past 3s a sentence **at the top
  of the skeleton**: the server may be waking up
- A failed first load: a `role=alert` sentence and **Try again**
- **Run again** keeps the results on screen, says *Running…* on the button
  (`aria-busy`), then replaces them. One toast: "Checked again at 16:41:03: 0
  failing, 2 warnings". A failed re-run keeps the previous results, says under
  the run line that they are from the earlier time, and raises an error toast
  that stays until dismissed

## Controls, and the mandate's four tests

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Run again | the teacher sees the database's state now, not at page load | says what it does, *Running…* while it runs, the new time after | nothing to reverse: it only reads | shows the checks are live, not a cached report |
| A "Needs attention" link | takes the teacher to the one check that needs them, detail open | names the check, its state and count | Details closes it | puts the failure before the 26 that passed |
| Details | shows which rows break the rule, and what to do | `aria-expanded`, names its check | press again | says what the rule protects and which page fixes it |

**No control changes data, and there must never be one.** A check names the
page that fixes what it finds (`/items`, `/locks`, `/content`, `/submissions`,
`/feedback`); it does not fix it here.

## API

`GET /api/v1/console/audit/system`: staff only (a student 403, no token 401;
`services/api/test/console.spec.ts`).

Returns `SystemAudit` (`packages/contracts`):

| Field | |
|---|---|
| `results[]` | `id`, `name` (the function), `severity` as presented (`fail`, `warn`, `notice`), `dbSeverity` (as `run_invariants()` gave it), `offendingCount`, `sample` (up to 5 rows), `area`, `title`, `checks`, `protects`, `action`, and `noticeReason` when relabelled |
| `failing` | count of failing checks with offenders (kept: `console.spec.ts` reads it) |
| `ranAt`, `tookMs` | when the run started, and how long it took |
| `runs[]` | the last 14 `audit_runs`, newest first: `id`, `startedAt`, `finishedAt`, `triggeredBy`, `failing[]`, `warning[]` (ids), `checks` (how many ran) |

`audit_runs` is RLS'd `select using (is_staff())`; a student reading it
directly gets no rows (`rls.spec.ts`, with a teacher positive control).

## What is deliberately not built

- **No fix buttons.** A check names the page that fixes it
- **No aggregate verdict, score or percentage.** Counts per state only
- **No recording of "Run again"** into `audit_runs` (offered, not chosen): the
  history stays the nightly record
- **API health**: `/console/settings`, not built, recorded as deferred
- **Relative times**: a run is evidence and carries its date and time

## Parked (schema work, not this page)

- `run_invariants_nightly()` still excludes INV-18/27/28/29 from `passed`
  **unconditionally** (`addendum-cron.sql`). The page does not read `passed`
  for that reason; aligning the nightly with the API's "only when empty" rule
  is a schema change
- `NEXT-SESSION.md` §0k.3: no invariant checks that the append-only triggers
  exist

## Motion (`motion.md`)

Details eases open (`--dur-fast`); a Needs-attention jump scrolls smoothly to
its check. Under `prefers-reduced-motion` both cut.
