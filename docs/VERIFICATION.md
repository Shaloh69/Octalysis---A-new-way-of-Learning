# VERIFICATION.md
### Cross-check of every document produced so far

Read this before you build. Nine findings, four of them blocking. Fix the blockers in the source
documents before Claude Code reads them, or it will faithfully implement the bugs.

**Status:** all schema-level findings below are **already applied** in `db/schema.sql` and
`db/addendum-audit.sql` as shipped in this bundle. This file is the record of what was found and
why the schema looks the way it does — read it before changing anything it explains, or you will
reintroduce a bug that was already caught.

**Severity:** 🔴 blocking · 🟠 fix before the phase that touches it · 🟡 wording / consistency

---

## 🔴 V-1 · Stage count is wrong in every document

`schema.sql` seeds stages `'00'` through `'17'` — that's **18 rows**. Every document says
"17 stages."

The seed is right; the prose is wrong. Stage 00 is orientation and ungraded, so the correct
phrasing is **"Stage 00 plus 17 graded stages."**

Consequence if unfixed: the blueprint's `by_act` allocates 18 items to Act 1, and Act 1 contains
Stage 00, which has no items. The generator will try to sample from an empty stage.

**Fix, in `schema.sql`:**
```sql
alter table stages add column gradeable boolean not null default true;
update stages set gradeable = false where id = '00';
```
and the blueprint filler must exclude `gradeable = false` from every sample. Add **INV-30**:
no `attempt_items` row references an item from a non-gradeable stage.

---

## 🔴 V-2 · The `profiles` UPDATE policy will cause infinite recursion

Current policy:
```sql
create policy p_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
```

The `WITH CHECK` clause selects from `profiles` — the same table the policy guards. Postgres
re-evaluates the policy on that inner select and recurses. This is a well-known Supabase footgun
and it will fail at runtime, not at migration time, so your P0 tests would pass and P1 would
break.

**Fix — enforce it with a trigger instead:**
```sql
create or replace function block_role_change() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role changes must go through the admin API';
  end if;
  return new;
end $$;

create trigger profiles_no_self_promote
  before update on profiles for each row
  when (current_setting('role', true) <> 'service_role')
  execute function block_role_change();

-- and simplify the policy
drop policy p_update on profiles;
create policy p_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
```

The denial test in `AUDITS.md` §3.1 ("a student cannot UPDATE their own `profiles.role`) still
applies unchanged — it just now passes for a different reason.

---

## 🔴 V-3 · Item versioning is incoherent

`items` has `id uuid primary key` **and** `version int` **and** `unique (slug, version)`.
`attempt_items` references `(item_id, item_version)`. INV-13 checks
`items where i.id = ai.item_id and i.version = ai.item_version`.

These can't all be true. If `id` is the primary key, a new version is a **new row with a new
`id`** — so `items.version` is always 1 for any given `id`, and `attempt_items.item_version` is
meaningless.

**Fix — introduce a stable family identity:**
```sql
alter table items add column family_id uuid not null default gen_random_uuid();
-- all versions of the same question share family_id; each version has its own id
create unique index on items (family_id, version);

-- attempt_items references the exact version row directly
alter table attempt_items drop column item_version;
-- item_id now points at one specific version row, which is what you actually want
```

Then INV-13 collapses to a plain foreign key, and "editing a live item creates version+1" means:
insert a new row with the same `family_id`, `version + 1`, and set the old row to `retired`.
Existing `attempt_items` keep pointing at the row the student actually saw, which is the whole
point.

**This must be fixed before P3.** Retrofitting it after real attempts exist is painful.

---

## 🔴 V-4 · `responses` contradiction between the schema and the audit matrix

`AUDITS.md` §3.1 says a student may `insert own` on `responses`. `schema.sql` has no INSERT
policy on `responses` at all.

**The schema is right.** Grading runs in the API under `service_role`; a student inserting their
own response row would let them write `is_correct = true`. The audit matrix is wrong.

**Fix:** change that cell to `✗` and add a note — *"`responses` is written only by the grading
service. A student-side INSERT succeeding is a critical finding."* Add a denial test for it.

---

## 🟠 V-5 · Four documented invariants are not implemented

`AUDITS.md` lists INV-01 through INV-25. The runner in
`db/addendum-audit.sql` implements 21. Missing:

| Missing | Why it wasn't written | What to do |
|---|---|---|
| INV-04 storage buckets public | Needs the Supabase management API, not SQL | Implement in the API's audit route |
| INV-08 role change has audit entry | Superseded by the V-2 trigger | Keep as a check on `audit_log` completeness |
| INV-14 no retired-version reference | Dissolves once V-3 is fixed | Drop it |
| INV-21 `stage_locks` uniqueness | Already enforced by a unique index | Drop it — a constraint doesn't need a checker |

Net after fixes: **22 implemented, 2 dropped, 1 moved to the API.** Update the count in
`AUDITS.md` so the doc and the code agree.

New invariants added by later documents and not yet in the runner: **INV-26** (accent presets
pass AA), **INV-27/28/29** (archetype and level coverage), **INV-30** (no items from
non-gradeable stages). Seven to write in P7.

---

## 🟠 V-6 · The content volume doesn't support the "3–4 months" claim on its own

Summing `est_minutes` across all 18 seeded stages: **985 minutes ≈ 16.5 hours.**

Spread over 14 weeks that's ~70 minutes of content per week. For a *companion* to lectures that's
correct and appropriate. As a claim that the app "has enough content for 3 to 4 months," it only
holds once you count drilling, labs, and the item bank.

**This is not a flaw in the plan — it's a flaw in how the plan describes itself.** Two
consequences:

1. Say it accurately: *"14 weeks of scaffolded practice around ~16 hours of core content, with an
   item bank sized for unlimited drilling."* That's both true and more impressive than the vague
   version.
2. **The item bank is the schedule.** 780 items is not a side task to do in P7 — it's the thing
   that makes weeks 5, 7, 13 and 14 (all archetype B, drill-heavy) work at all. Start authoring in
   P2 and treat the count as a weekly deliverable.

---

## 🟠 V-7 · `content_blocks` policy ignores `stages.published`

```sql
create policy cb_read on content_blocks for select
  using (is_stage_unlocked(auth.uid(), stage_id));
```

`is_stage_unlocked` checks locks and prerequisites but never checks whether the stage is
published. A half-written Stage 14 with `published = false` is readable by any student whose
prerequisites happen to be met.

**Fix:**
```sql
drop policy cb_read on content_blocks;
create policy cb_read on content_blocks for select using (
  is_staff() or (
    exists (select 1 from stages s where s.id = content_blocks.stage_id and s.published)
    and is_stage_unlocked(auth.uid(), stage_id)
  )
);
```

---

## 🟡 V-8 · Phase numbering disagrees across documents

`MASTER-PLAN.md` §12 lists **P0–P8**. `START-HERE.md` §6 and `PHASES.md` list **P0–P10**
(feedback and production launch were added later).

**`PHASES.md` is authoritative.** Replace the table in `MASTER-PLAN.md` §12 with a pointer to it
rather than maintaining two copies — a duplicated plan is a plan that will drift.

---

## 🟡 V-9 · Minor items

- Policy named `is_staff_` on `item_stats` shadows the function `is_staff()`. Rename to
  `ist_read`.
- `attempt_items` has no INSERT policy, which is correct (service-role only) but undocumented.
  State it explicitly in `db/CLAUDE.md` so nobody "fixes" it later.
- Addendum ordering is load-bearing: `schema.sql` → `addendum-feedback.sql` →
  `addendum-audit.sql`. `inv_24` calls `sus_score()`, which the feedback addendum defines. Put
  this order in `db/README.md`, not just in prose.
- The `GAME-LAYER.md` Bring-Up table covers stages 01–17. Stage 00's bring-up ("power rail") is
  described in `LESSON-PLAN-AND-LEVELS.md` §1 instead. Consolidate into one table.

---

## What I checked and found correct

Not everything is broken. Verified sound:

- **Blueprint arithmetic.** `by_act` 18+20+20+12 = 70 ✓ · `by_bloom` 14+21+25+10 = 70 ✓ ·
  `by_type` 38+22+10 = 70 ✓. All three dimensions sum to the stated total.
- **Prerequisite graph is acyclic.** Every `prereq` entry in the seed points to a stage with a
  lower ordinal. INV-20 will pass on the seed data.
- **Every prereq references a seeded stage.** INV-19 passes.
- **`is_stage_unlocked` precedence** (user → section → global → policy) matches the truth table in
  `AUDITS.md` §3.2, including the staff short-circuit and the `unlock_at` handling.
- **`sus_score()` scoring is correct.** Odd items `(x−1)`, even items `(5−x)`, sum × 2.5. All 5s →
  100, all 1s → 0, all 3s → 50. Verified by hand.
- **The append-only triggers on `responses`** block both UPDATE and DELETE, including for
  `service_role`, which is what you want — corrections happen by voiding an attempt, not by
  editing history.
- **The OKLCH accent derivation holds contrast** across hue by construction, because lightness is
  fixed per theme. The 12 presets still need the INV-26 check, but the approach is sound.
- **Deck coverage is complete.** Every slide in both source decks maps to a stage in
  `LESSON-PLAN-AND-LEVELS.md` §2. Nothing from the instructor's material is dropped.

---

## Status of each finding

| ID | Applied in this bundle? | Where |
|---|---|---|
| V-1 gradeable flag | ✅ | `stages.gradeable`, Stage 00 = false, blueprint `exclude_non_gradeable_stages`, INV-30 |
| V-2 profiles recursion | ✅ | `block_role_change()` trigger + simplified `p_update` policy |
| V-3 item versioning | ✅ | `items.family_id`, `unique (family_id, version)`, `attempt_items.item_version` removed, `inv_13` simplified |
| V-4 responses INSERT | ✅ | Comment in `schema.sql`; **still update the matrix cell in `AUDITS.md` §3.1 to ✗** |
| V-5 missing invariants | ⚠️ partial | INV-27/28/29/30 added. INV-04 still needs the Supabase management API; INV-08 pending; INV-14 and INV-21 dropped as intended. |
| V-6 content volume | 📋 planning | Not a code fix. Treat the item bank as a weekly deliverable from P2. |
| V-7 published check | ✅ | `cb_read` policy |
| V-8 duplicate phase table | ⚠️ | `PHASES.md` is authoritative; the table in `MASTER-PLAN.md` §12 is still there — delete it when you next touch that file |
| V-9 minor | ✅ mostly | Policy renamed to `ist_read`; addendum order documented in `db/CLAUDE.md` and `README.md` |

Also applied while fixing V-1: `stages.archetype` and `stages.levels`, `objectives.level` and
`objectives.competency`, and the `level_progress` table — all required by
`LESSON-PLAN-AND-LEVELS.md` and none of which existed in the original schema.

**Still open, and worth doing before P3:** V-4's matrix correction, V-8's duplicate table, and
INV-04/INV-08.

---

# Second verification pass

Re-run after the design mandate, stage encounters, prompt library, and the TASM correction were
added. Checks were run mechanically, not by eye: cross-document file references, toolchain
consistency, stage-count consistency, and invariant numbering.

## Fixed in this pass

| ID | Finding | Fix |
|---|---|---|
| **V-10** | **17 MARIE references survived the toolchain correction**, across `MASTER-PLAN`, `LESSON-PLAN-AND-LEVELS`, `PAGE-SPECS`, `GAME-LAYER`, `LESSON-HANDLING`, `CLAUDE-CODE-PROMPTS`, `START-HERE`. Claude Code would have read a contradiction and picked one at random. | All rewritten to x86-16. `MarieSim` kept in `GAME-LAYER` §6 but relabelled *reference only*. `/app/lab/marie` renamed `/app/lab/asm`. |
| **V-11** | **"17 stages" still in 6 documents** after V-1 established there are 18 rows (00–17). | All now say "Stage 00 plus 17 graded stages" or "18 stages". |
| **V-12** | `AUDITS.md` cited `db/audit/invariants.sql`, which does not exist. | Corrected to `db/addendum-audit.sql`. |
| **V-13** | `VERIFICATION.md` cited `db/README.md`, which did not exist. | Written, with the apply order and a fresh-database expectation note. |

## Verified clean

- **Every internal file reference across all docs and SQL now resolves** to a real file in the
  bundle. The only remaining unresolved token is `content/stages/NN.md`, which is a filename
  pattern, not a path.
- **25 invariants implemented** in `run_invariants()`, up from 21.
- SQL structure: `$$` blocks balanced, parens balanced, quotes balanced across all three files.
- All 17 tables have RLS enabled **and** at least one policy — INV-01 and INV-02 pass on a fresh
  database.
- `tokens.css`: braces balanced, 80 tokens, every `var()` resolves, three themes present.
- `elements.svg`: parses as XML, 19 symbols, all `<title>`-labelled.

## Open — not blocking, but know about them

| ID | Item | Why it's open |
|---|---|---|
| **V-14** | **INV-26** (12 accent presets pass AA on 3 themes) and **INV-31** (every interaction has a first-run before it appears graded) are documented but not in `run_invariants()`. | Neither is a database question. INV-26 is a CI contrast computation over `accents.ts` × `tokens.css`; INV-31 is a static check over the component registry. Build both in P9 as CI steps, not SQL. |
| V-5 | INV-04 (storage bucket visibility) and INV-08 (role-change audit completeness) | INV-04 needs the Supabase management API. INV-08 is a straightforward `audit_log` completeness query — write it in P7. |
| V-8 | Duplicate phase table in `MASTER-PLAN.md` §12 vs `PHASES.md` | `PHASES.md` is authoritative. Delete the table next time you touch the master plan. |
| V-6 | ~985 minutes of core content ≈ 16.5 hours | Not a code fix. The item bank carries the rest of the 14 weeks — treat it as a weekly deliverable from P2. |

## The pattern worth noticing

V-10 and V-11 are the same failure: **a correction was applied to the schema and to the documents
I was actively editing, but not swept across the whole set.** Both were invisible on a read-through
and obvious to a five-line script.

Before every phase, run the sweep: grep for the term you changed, across every file, including the
ones you think are unrelated. A contradiction between two documents is worse than an error in one,
because an agent reading both will silently pick a side.

---

# Third verification pass

Run before P0, against the bundle as shipped. The first two passes checked the documents against
each other; this one reads `db/schema.sql` line by line against the policies it claims to
implement, and checks the hosting plan against what the free tiers actually provide.

**Thirteen findings, three blocking.** Two of them (V-15, V-16) are in the same class as the bug
this project exists to fix: something the documents assert is protected, which the schema does not
protect.

> **Status: none of these are applied yet.** Unlike the first two passes, the SQL below is
> *proposed*, not shipped. `db/schema.sql` is unchanged. Apply as one migration after review — see
> "Applying this pass" at the end.

---

## V-15 (BLOCKING) · The answer-key story has a second door: `exam_salt` and `seed` are client-readable

Hard rule 1 protects `attempt_items.correct_value` with a row-level gate. The *inputs to the seed*
have no protection at all.

```sql
-- schema.sql:391 — every column comes back, including exam_salt
create policy as_read on assessments for select using (
  is_staff() or section_id is null
  or section_id = (select section_id from profiles where id = auth.uid())
);

-- schema.sql:398 — every column comes back, including seed
create policy at_own on attempts for select using (user_id = auth.uid() or is_staff());
```

Three compounding problems:

1. **RLS is row-level, not column-level.** A student reading their own `attempts` row reads
   `seed` and `engine_version`. Any user matching `as_read` reads `exam_salt`.
2. **`section_id is null` matches everyone.** A global assessment is readable by every user.
3. **No policy in any of the three SQL files has a `TO` clause** — verified, zero occurrences.
   Every policy is therefore `TO public`, which includes `anon`. Combined with `sec_read using
   (true)` and `ob_read using (true)`, an unauthenticated visitor can read `sections`,
   `objectives`, and **the `exam_salt` of any global assessment.**

`MASTER-PLAN.md` §3.2 describes `exam_salt` as the thing "rotated between semesters so last year's
leaked screenshots are worthless." A secret readable over anonymous HTTP is not doing that job.

**The blunt version:** the founding bug of this project was shipping the key to the browser. The
schema ships the key-*derivation* material to the browser, one table over.

**Fix:**

```sql
-- 1. the salt leaves the readable table entirely
create table assessment_secrets (
  assessment_id uuid primary key references assessments(id) on delete cascade,
  exam_salt     text not null default encode(gen_random_bytes(16),'hex')
);
alter table assessment_secrets enable row level security;
-- no policy at all: service_role only, which is the whole point
alter table assessments drop column exam_salt;

-- 2. the seed stops being student-readable
drop policy at_own on attempts;
create policy at_own on attempts for select to authenticated
  using (is_staff() or user_id = auth.uid());
-- expose attempts to students through a view that omits `seed`:
create view my_attempts with (security_invoker = true) as
  select id, assessment_id, attempt_no, status, score, max_score, started_at, submitted_at
  from attempts where user_id = auth.uid();

-- 3. close anon on the two open-read tables
drop policy sec_read on sections;
create policy sec_read on sections for select to authenticated using (true);
drop policy ob_read on objectives;
create policy ob_read on objectives for select to authenticated using (
  is_staff() or exists (select 1 from stages s where s.id = objectives.stage_id and s.published)
);
```

**And add `TO authenticated` to every remaining policy.** A policy with no `TO` clause is an
unreviewed decision to include `anon`.

**Denial tests:** *anon cannot read `assessments`* · *a student cannot read `attempts.seed`* ·
*anon cannot read `objectives` for an unpublished stage*. Expect all three to fail today.

---

## V-16 (BLOCKING) · `is_stage_unlocked()` never reads `lock_at`

`stage_locks.lock_at` is declared at `schema.sql:229` and appears **nowhere** in the function body.
All three scope branches select `state, unlock_at` only (`:278`, `:287`, `:296`).

What is therefore unimplemented:

- **Weekly release windows never close.** `unlock_at` opens a stage; nothing shuts it.
- **"Exam mode" does not exist.** `MASTER-PLAN.md` §5: *"a global 'exam mode' that locks all
  practice content during an assessment window."* There is no code path that can produce it.
- **A documented test cannot pass.** `AUDITS.md` §3.2: *"`lock_at` in the past must re-lock. Test
  at the boundary second, not a minute either side."*

Worse, the second pass's clean list asserts the function *"matches the truth table in `AUDITS.md`
§3.2, including the staff short-circuit and the `unlock_at` handling."* That review verified the
column it knew about and never asked whether the other one was used. **A column that exists and is
never read is more dangerous than a missing column**, because the console will happily offer the
teacher a control that does nothing.

**Fix** — one predicate, applied identically in all three branches:

```sql
  if found and v_state <> 'auto' then
    return v_state = 'unlocked'
       and (v_unlock is null or now() >= v_unlock)
       and (v_lock   is null or now() <  v_lock);
  end if;
```

with `v_lock timestamptz` declared and `lock_at` added to each `select ... into`.

**Test at the boundary second**, per AUDITS §3.2 — `now() = lock_at` must be locked.

---

## V-26 (BLOCKING) · The hosting plan assumes paid tiers that the project is not on

**The project runs entirely on free tiers: Vercel Hobby, Render Free, Supabase Free.** Three
documented mechanisms do not exist at that price.

### 26.1 Render's free tier has no cron jobs

Free instances support **web services, static sites, Postgres, and key-value only**; cron jobs,
background workers, and private services are paid-only. Free web services spin down after **15
minutes** without inbound traffic and take **~1 minute** to cold start, with **750 instance
hours/month per workspace**, an **ephemeral filesystem**, **no shell access**, and **no scaling
beyond a single instance**.

Everything in the plan that says "Render Cron" is therefore unbuildable as written:

| Planned job | Where it's specified | Status |
|---|---|---|
| Keep-alive ping every 10 min | `MASTER-PLAN.md` §0.2, §10 · `START-HERE.md` §9 | NO free cron |
| Scheduled unlocks `*/5` | `MASTER-PLAN.md` §10 | NO |
| Nightly `item_stats` recompute | `PHASES.md` P7 · `MASTER-PLAN.md` §10 | NO |
| Nightly invariant run | `AUDITS.md` §1 | NO |

**Fix: move all scheduling into Postgres.** `pg_cron` is available on every Supabase plan
including free, and `pg_net` lets a scheduled job make an outbound HTTP request. Supabase Cron
wraps both.

- **Scheduled unlocks** and the **nightly invariant run** are pure SQL. They belong in `pg_cron`
  anyway — they run where the data is, with no network hop and no service to keep awake.
- **`item_stats` recompute** is also SQL. Write it as a Postgres function; schedule it.
- **Keep-alive** becomes a `pg_net` GET to `/healthz` on a schedule.

This is not a workaround — it is better than the original design for three of the four jobs.

**Do not use GitHub Actions for the keep-alive.** Free accounts get 2,000 Actions minutes/month on
private repos; a 10-minute schedule bills ~4,300 minutes. Scheduled workflows are also auto-disabled
after ~60 days of repository inactivity and are known to fire unreliably on private repos.

### 26.2 Supabase free has no backups, and pauses after 7 days

Free-tier projects have **no automatic backups** (daily backups and PITR are Pro features) and are
**paused after 7 days with no API requests**. Free also caps you at **2 active projects**, 500 MB
database, 500 MB RAM, 1 GB file storage, 5 GB egress.

Consequences for `PHASES.md` P10, which currently reads *"Backups: daily Postgres backup verified
by an actual restore into a scratch project. A backup you haven't restored is a guess"*:

- **There is no backup to restore.** That exit criterion cannot be met on free.
- **There is no third project slot** for a scratch restore target — prod + staging uses both.
- **A semester break pauses production.** Seven quiet days over a long weekend plus a holiday is
  entirely achievable, and the project comes back only on a manual resume.

**Fix:**

1. **Roll your own backup.** A scheduled `pg_dump` to a Supabase Storage bucket or an off-platform
   destination, run on a schedule you control, with **one rehearsed restore before launch** — into
   a local Postgres if no project slot is free. Restoring into local Postgres still validates the
   dump, which is the part that matters.
2. **Keep the project warm** with the same `pg_cron` heartbeat, and **verify that internal cron
   activity actually counts as activity for the pause policy** — do not assume it. Confirm with a
   deliberately quiet week in a scratch project before relying on it.
3. **Choose:** 2 project slots for prod + staging, or prod only and treat a Vercel preview branch
   as staging.
4. **Record explicitly in P10** that this deployment has no vendor backups, and what the recovery
   story actually is. That sentence belongs in the incident page, not in someone's memory.

### 26.3 Free-tier facts that change the load story

- **40 concurrent students on one 512 MB single instance with a ~1 minute cold start.** The load
  target in `AUDITS.md` §3.8 is *"40 students starting the same assessment within 30 s, 0 errors,
  p95 < 2 s."* If the first of those 40 arrives at a spun-down service, that student waits a
  minute. Move the load test to **P3**, as AUDITS already advises, and measure on the free
  instance — not on a laptop.
- **Ephemeral filesystem, no shell.** The x86-16 interpreter (P6) must never touch disk, and
  anything you would normally debug by SSH-ing in must be reachable through logs or an endpoint.
- **In-memory rate limiting is per-instance and resets on every spin-down.** `/auth/resolve` at
  5/min/IP is a much softer guarantee than `services/api/CLAUDE.md` implies. State it honestly, or
  back the limiter with a Postgres table (a free, adequate option at this scale).
- **Vercel Hobby is non-commercial use only,** and its preview deployments cannot be
  password-protected (a Pro feature). P10's *"preview deploys locked down"* needs a different
  mechanism — an app-level guard, or accept that preview URLs are unlisted rather than protected.
  The non-commercial restriction is fine for a university course tool that sells nothing; note it
  so nobody is surprised later.

**None of this blocks the build.** It changes four exit criteria and moves the scheduler from
Render to Postgres. Better to change them now than to discover them in P10.

---

## V-17 · `stage_locks`: the unique index cannot serve the lookups, and `scope_id` is untyped

```sql
create unique index on stage_locks (scope, coalesce(scope_id,''), stage_id);   -- :234
...
where scope = 'user' and scope_id = p_user::text and stage_id = p_stage;       -- :280
where scope = 'global' and scope_id is null and stage_id = p_stage;            -- :298
```

Postgres will not use an index on the expression `coalesce(scope_id,'')` to satisfy a predicate on
the bare column `scope_id`. **Every lock lookup is a sequential scan** — up to three per call, in a
`security definer` function called *per row* by the `content_blocks` RLS policy, against a p95
budget of 500 ms with 40 students on one free instance.

Second problem: `scope_id` is `text` holding either a section uuid or a user uuid, with **no
foreign key and no constraint tying it to `scope`**. Nothing prevents `scope='global'` with a
non-null `scope_id` — which the global branch's `scope_id is null` predicate then silently skips —
and nothing catches a section uuid pasted into a user-scope row. It becomes a lock that matches
nobody and raises no error, which is the worst failure shape available to a gating table.

**Fix:**

```sql
alter table stage_locks
  add column scope_user_id    uuid references auth.users(id) on delete cascade,
  add column scope_section_id uuid references sections(id)   on delete cascade,
  add constraint scope_target_valid check (
    (scope = 'global'  and scope_user_id is null and scope_section_id is null) or
    (scope = 'section' and scope_user_id is null and scope_section_id is not null) or
    (scope = 'user'    and scope_user_id is not null and scope_section_id is null)
  );

create unique index on stage_locks (stage_id, scope_user_id)    where scope = 'user';
create unique index on stage_locks (stage_id, scope_section_id) where scope = 'section';
create unique index on stage_locks (stage_id)                   where scope = 'global';
```

Three partial indexes, each exactly matching one branch of the function. Then drop `scope_id`.

---

## V-18 · `teacher` and `admin` are the same role in 14 of 17 policies

`is_staff()` is `jwt_role() in ('teacher','admin')`, and it is the predicate for **fourteen**
policies. Only three places distinguish the two: `ar_admin` on `audit_runs`, and `fb_read` /
`fb_admin` on `feedback`.

What a `teacher` token can do today:

| Policy | Grants |
|---|---|
| `p_staff on profiles for all` | Write any profile row — including `student_id`, which `inv_05` and the gradebook depend on |
| `at_staff on attempts for all` | Direct `UPDATE` of `score` and `status`, bypassing grading and **writing no `audit_log` entry**, because nothing in SQL forces one |
| `it_staff on items for all` | Write and retire anything in the bank |
| `sl_staff`, `sp_staff`, `al_staff` | Locks, mastery values, and read of the entire audit log |

`AUDITS.md` §3.1 says teacher is `R all` on `attempts` and `R` on `item_stats`, with admin as the
only `RW`. **The schema and the matrix disagree, and the schema is more permissive.**

For one instructor this is survivable. The moment there is a teaching assistant it is not — and the
design already anticipates that by having three roles.

**Fix:** add `is_admin()`, and use it for the operations that are destructive or that move a grade:
`profiles` writes, `attempts` writes, item retirement, roster deletion. Or delete `admin` from
`user_role` and stop implying a tier that isn't implemented. Either is defensible; the current
state is not.

---

## V-19 · `profiles.accent_hue` is referenced in six places and does not exist

The column is specified in `apps/web/CLAUDE.md` §Accent, `docs/GAME-LAYER.md` §4,
`docs/PROMPT-LIBRARY.md`, `docs/CLAUDE-CODE-FILES.md`, `packages/tokens/accents.ts`, and
`packages/tokens/README.md`. `db/schema.sql` has `theme` and `audio_prefs` and nothing else.

The entire per-student accent system — Petal 4's highest-value mechanic, and the reason the OKLCH
derivation exists — has no storage.

This is V-10/V-11's pattern exactly: a decision propagated through the documents and not swept into
the schema.

**Fix:**

```sql
alter table profiles
  add column accent_hue int not null default 250 check (accent_hue between 0 and 359);
```

Add **INV-35**: every `profiles.accent_hue` matches one of the twelve presets in `accents.ts`.
A free hue is untested against AA on three themes; only the twelve are verified (INV-26).

---

## V-20 · Deleting a student is impossible, and the error will not explain itself

- `attempts.user_id references auth.users(id) on delete cascade`
- `responses.attempt_id references attempts(id) on delete cascade`
- `responses_no_delete` is a row-level `BEFORE DELETE` trigger that raises unconditionally

Cascading deletes fire row-level triggers. Therefore **deleting any auth user who has a single
graded response fails**, with `responses are append-only` — an error that names the wrong table and
does not mention the user being deleted.

Append-only history is a deliberate and correct stance. But right now it is also an accidental
policy that:

- blocks removal of test accounts created during P0–P2,
- blocks any data-deletion request a student might make,
- and will be discovered by someone clicking "Delete user" in the Supabase dashboard.

**Fix — make it a decision:** keep the trigger, add `attempt_status='voided'` and a
`profiles.deleted_at` soft-delete as the supported path, and **document in `db/CLAUDE.md` that
auth users are never hard-deleted.** If a hard delete must be possible, the trigger needs an
explicit escape for a maintenance path, used deliberately and logged.

---

## V-25 · A bad `role` claim locks a user out of the entire database

```sql
select coalesce(claims -> 'app_metadata' ->> 'role', 'student')::user_role   -- :250-256
```

`jwt_role()` casts a free-text JWT claim straight to the enum. A typo — `'Teacher'`, `'admin '`,
`'superadmin'` — raises `invalid input value for enum user_role`. Because `is_staff()` calls
`jwt_role()` and nearly every policy calls `is_staff()`, **that user's every query fails**, on
every table, with an error that points at an enum rather than at their token.

Roles are set through the admin API, so this requires a bug rather than an attack — but the failure
mode is total and the diagnosis is slow.

**Fix:**

```sql
create or replace function jwt_role() returns user_role
language sql stable as $$
  select case current_setting('request.jwt.claims', true)::jsonb
              -> 'app_metadata' ->> 'role'
    when 'admin'   then 'admin'::user_role
    when 'teacher' then 'teacher'::user_role
    else 'student'::user_role
  end
$$;
```

Unknown claim to least privilege, no exception. Pair it with a P1 test asserting that a malformed
role claim degrades to `student` rather than erroring.

---

## V-21 · `block_role_change`'s guard depends on how you connect

```sql
when (current_setting('role', true) is distinct from 'service_role')   -- :326
```

Under PostgREST with the service key, `role` is `service_role` and the trigger correctly stands
down. Over a **direct Postgres connection** — a `pg` client in `services/api`, a migration, `psql`
— `current_setting('role')` is `'none'`, so the trigger fires and blocks the legitimate admin path.

RLS is bypassed by `service_role`; **triggers are not**. So whether the "role changes must go
through the admin API" path works depends on which client library that API happens to use for that
one call.

**Fix:** guard on an explicit application signal rather than the connection's identity — e.g.
`current_setting('app.allow_role_change', true) = 'on'`, set with `set local` inside the admin
transaction. Then the escape is deliberate, greppable, and independent of transport.

---

## V-22 · `responses` is readable pre-submit while `attempt_items` is not

`ai_after_submit` gates the answer key on `status = 'submitted'`. `rs_own` (`:411`) has **no such
condition** — a student can read `is_correct` and `points` for every answered ordinal while the
attempt is still in progress.

For practice drilling that is correct and intended: immediate feedback is the design. For the
70-item Power-On Self Test it means a running score is queryable mid-exam, which contradicts the
spirit of the key gate two policies above it.

It is not exploitable for answer-changing — `responses` is append-only and one row per ordinal —
so this is a design inconsistency, not a hole. **Make it explicit rather than accidental:** gate on
the assessment's mode (`blueprints.scope = 'final'`), or state in `db/CLAUDE.md` that immediate
verdicts are intentional everywhere including the final.

---

## V-23 · The number the gate depends on has no range constraint

`stage_progress.mastery` and `level_progress.mastery` are `numeric(4,3) not null default 0` with
**no `check`**. `numeric(4,3)` permits up to `9.999`. `is_stage_unlocked()` compares against
`>= 0.70`, and `sp_staff` lets any staff account write the column directly.

Same for `item_stats.p_value` and `discrimination` — both proportions, both unconstrained.

**Fix:** `check (mastery between 0 and 1)` on both mastery columns; `check (p_value between 0 and
1)` on `item_stats`. Cheap, and it turns a class of silent gating bug into an insert error.

---

## V-24 · `items.slug` is unique in no combination

`slug` is `not null` and carries the human identity of an item (`'P-07-cycle-time'`), but the only
uniqueness constraint on `items` is `(family_id, version)`. Two unrelated families may share a
slug, so a slug cannot be used to look anything up — which is the only thing a slug is for.

**Fix:** `create unique index on items (slug, version);` — or, more correctly, recognise that slug
is a property of the *family* and enforce that all rows sharing a `family_id` share a `slug`, and
that a slug maps to exactly one `family_id`.

---

## V-27 · Two loose ends in the repo itself

- **`.claude/settings.json` references `scripts/scan-bundle.mjs`, which does not exist.** There is
  no `scripts/` directory in the bundle. The `PostToolUse` hook on `pnpm build*` will fail on first
  use. Either write the script — it is the answer-key bundle scan from `AUDITS.md` §3.4, which is
  worth having and is about fifteen lines — or remove the hook. Writing it is the right call; it is
  the permanent guard against the exact bug this project exists to fix.
- **`CLAUDE.md`'s rule 7 and `START-HERE.md`'s rule 7 are different rules.** `CLAUDE.md`:
  *"`responses` and `attempt_items` are written only by the grading service."* `START-HERE.md`:
  *"`responses` is append-only."* Both are true and both are enforced, but the always-loaded file
  dropped the append-only rule — which is the one backed by a trigger. Make CLAUDE.md's rule 7
  cover both clauses.

---

## Status of this pass

| ID | Severity | Finding | Applied? |
|---|---|---|---|
| V-15 | BLOCKING | `exam_salt` / `attempts.seed` client-readable; no `TO` clause on any policy | proposed |
| V-16 | BLOCKING | `is_stage_unlocked()` ignores `lock_at` | proposed |
| V-26 | BLOCKING | Free-tier reality: no Render cron, no Supabase backups, 7-day pause | plan change |
| V-17 | high | `stage_locks` index unusable; `scope_id` untyped | proposed |
| V-18 | high | `teacher` equals `admin` in 14 policies | proposed |
| V-19 | high | `profiles.accent_hue` missing | proposed |
| V-20 | high | Cascade delete deadlocked by the append-only trigger | decision needed |
| V-25 | high | Bad role claim to total lockout | proposed |
| V-21 | minor | Role-change trigger guard is transport-dependent | proposed |
| V-22 | minor | `responses` readable pre-submit, inconsistently with the key gate | decision needed |
| V-23 | minor | No range check on `mastery` / `p_value` | proposed |
| V-24 | minor | `items.slug` not unique | proposed |
| V-27 | minor | Missing `scripts/scan-bundle.mjs`; rule-7 drift | proposed |

## Applying this pass

**Do not apply these one at a time as you encounter them.** Write one migration,
`db/addendum-p0-hardening.sql`, applied fourth in the load order:

```
schema.sql -> addendum-feedback.sql -> addendum-audit.sql -> addendum-p0-hardening.sql
```

Order inside it matters: V-19 and V-23 are additive and safe first; V-15's table split and V-17's
column replacement rewrite structures that V-16 and V-18 then reference.

**Sequencing against the phases:**

- **Before P0's denial tests:** V-15, V-16, V-25, V-19. The tests in P0 should be written against
  the *fixed* schema, and three of the six existing denial tests are unaffected either way.
- **Before P1:** V-18, V-21 — both are auth-path findings and P1 is the auth phase.
- **Before P3:** V-17, V-23, V-24. V-17 in particular gets harder once `stage_locks` has real rows.
- **Before P4:** V-20 and V-22, both of which are product decisions the console surfaces.
- **P0 also:** V-26's scheduler move, because it changes what P0 records as its hosting decision.

## The pattern worth noticing, again

The first two passes found contradictions *between documents*. This one found a different and
worse shape: **four cases where a document describes a protection the schema does not implement,
and one case where the schema offers a control that does nothing** (V-16's `lock_at`).

A contradiction between two documents is caught by grep. A document that describes a behaviour the
code does not have is caught only by reading the code against the claim, line by line — or by a
denial test that someone bothered to watch fail first.

**That is the whole argument for hard rule 8**, and V-15 and V-16 are what it looks like when the
rule has not been applied yet.

---

# Third pass: APPLIED

Everything in the third pass above is now **applied in `db/schema.sql`** and verified against a
running Postgres. The status table in that section describes what was found; this note records
what shipped.

| ID | Applied as |
|---|---|
| V-15 | `assessment_secrets` (RLS on, `using(false)` deny-all policy, service-role only) · `exam_salt` dropped from `assessments` · table-level SELECT on `attempts` revoked and readable columns granted back by name · **every policy now carries `TO authenticated`** · `revoke all on all tables in schema public from anon` |
| V-16 | `is_stage_unlocked()` reads `lock_at` in all three scope branches; `lock_window_ordered` check constraint |
| V-17 | `stage_locks.scope_user_id` / `scope_section_id`, FK'd and typed, with `scope_target_valid`; three partial indexes matching the three branches |
| V-18 | **Resolved by decision, not by code.** Teacher and admin are intentionally equivalent in this deployment — the instructor is the administrator. `is_staff()` is the authorisation predicate; `teacher` stays in the enum for a future TA tier. Documented in `schema.sql` |
| V-19 | `profiles.accent_hue int check (0..359)` |
| V-20 | `profiles.deleted_at`; `is_stage_unlocked()` returns false for a soft-deleted user; `p_self`/`p_update` exclude them |
| V-21 | `block_role_change()` guards on `app.allow_role_change`, not on the connection's identity |
| V-22 | `rs_own` withholds a verdict only for `blueprints.scope = 'final'` before submit; practice verdicts stay immediate |
| V-23 | Range checks on `mastery` ×2, `p_value`, `discrimination`, `target_difficulty` |
| V-24 | `items_slug_version_key` unique on `(slug, version)` |
| V-25 | `jwt_role()` maps unknown claims to `student` via `CASE`, never casts and never raises |
| V-26 | Plan change, applied across the docs. Scheduling moves to `pg_cron` + `pg_net` |
| V-27 | `scripts/scan-bundle.mjs` written; `CLAUDE.md` rule 7 now covers both clauses |

**Decisions also applied:** Stage 08 wired into Stage 17's prerequisites (D1 — later
superseded by linearisation, see V-49); soft delete as the
supported deactivation path (D5).

---

# Fourth verification pass — found by execution

The first three passes were reading. This one is what happened when the schema was applied to a
real Postgres and the denial suite was run against it.

**Three defects, none of which any amount of reading would have caught.** All three are now fixed.
They are recorded because each is a Postgres semantic that is easy to get wrong the same way twice.

---

## V-28 (BLOCKING, fixed) · A rolled-back custom GUC reverts to `''`, not `NULL`

`jwt_role()` read the JWT claims like this:

```sql
select case current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role' ...
```

`current_setting(..., true)` returns `NULL` when the setting was never defined — which is what the
`true` is for, and it is what the code assumed. **But once a custom GUC has been `SET LOCAL` and
the transaction has ended, it does not go back to undefined. It goes to the empty string.**

`''::jsonb` raises `invalid input syntax for type json`.

Why this matters far beyond the tests: `jwt_role()` is called by `is_staff()`, and `is_staff()` is
called by essentially every policy in the database. PostgREST runs on a **connection pool**. The
first request on a connection sets `request.jwt.claims`; when that transaction ends, the GUC
becomes `''`; the next query on that pooled connection that reaches a policy **raises**, on every
table, for a user whose token is perfectly valid.

That is an intermittent, pool-dependent, total-authorisation-failure — the worst shape of bug this
system could have, and it would have appeared under concurrent load and not in any single-user test.

**Fix**, applied in `db/schema.sql` and `db/local-bootstrap.sql`:

```sql
select case nullif(current_setting('request.jwt.claims', true), '')::jsonb -> ...
```

`auth.uid()`, `auth.role()` and `auth.jwt()` in the local bootstrap take the same guard.

**Rule going forward:** any `current_setting()` of a custom GUC is wrapped in `nullif(..., '')`
before a cast. No exceptions.

---

## V-29 (fixed) · Column privileges are ADDITIVE to table privileges

V-15's fix revoked the seed at column level:

```sql
revoke select (seed, engine_version) on attempts from authenticated;   -- does nothing
```

This ran without error and had **no effect**. In Postgres a column-level `REVOKE` cannot subtract
from a table-level `GRANT`; the two are additive, and Supabase's default privileges grant
table-level `SELECT` to `authenticated`. A student could still `select * from attempts` and read
their own seed — the exact thing V-15 exists to prevent — and the schema *looked* like it was
handled.

The test that caught it was the deliberately redundant one: *"nor via `select *` — the column
revoke covers the wildcard."* Written because a wildcard is how the leak would actually happen,
and it turned out to be the only assertion that failed.

**Fix:**

```sql
revoke select on attempts from authenticated;
grant select (
  id, user_id, assessment_id, attempt_no, status, score, max_score,
  started_at, submitted_at
) on attempts to authenticated;
```

**And note the useful side effect:** a column added to `attempts` later is unreadable to students
until someone grants it by name. That is the correct direction for that mistake to fall.

---

## V-30 (fixed) · RLS applies inside a policy's own subqueries

V-22's fix wrote `rs_own` to withhold verdicts on final exams by joining through to `blueprints`:

```sql
exists (
  select 1 from attempts a
  join assessments s on s.id = a.assessment_id
  join blueprints  b on b.id = s.blueprint_id     -- blueprints is staff-only
  where ... and (b.scope <> 'final' or a.status = 'submitted')
)
```

A policy's subquery is evaluated **as the querying role**, so RLS on `blueprints` applies inside
it. `bp_staff` restricts `blueprints` to staff, so for a student that join matched nothing, the
`EXISTS` was false, and the policy denied **every** response — including the practice verdicts that
are supposed to be immediate.

The failure is silent and inverted: a policy that over-denies looks like a working security
control. It was caught only because the suite asserts the **positive** case too.

**Fix:** a `security definer` helper that is allowed to see `blueprints`:

```sql
create or replace function attempt_withholds_verdict(p_attempt uuid) returns boolean
language sql stable security definer set search_path = public as $$ ... $$;
```

**Rule going forward:** if a policy's `USING` clause references a table that has its own RLS,
either that table must be readable by the same role, or the check belongs in a `security definer`
function. `is_stage_unlocked()` was already built this way; `rs_own` was not, and the inconsistency
is what produced the bug.

---

## What the run actually verified

Against Postgres 16 in Docker, from a clean `pnpm db:reset`:

| Check | Result |
|---|---|
| All four SQL files apply from scratch | pass |
| `run_invariants()` | **22 clean, 0 warnings, 0 failures**, 3 notices expected on an unseeded database (INV-27/28/29 need content and objectives) |
| RLS denial suite | **38/38 pass** |
| TypeScript strict across the workspace | clean |

**And the denial tests were watched failing first,** per hard rule 8. Three policies were
deliberately sabotaged in the running database — the answer-key gate rewritten to `using (true)`,
the item bank opened to students, and table-level `SELECT` on `attempts` re-granted. Six tests went
red, each mapping to the break that caused it:

```
× P0 test 1  — a student cannot SELECT from items
× P0 test 2  — the answer key is hidden while in progress
× P0 test 2  — the secret string appears nowhere in the response
× P0 test 3  — which proves test 2 denied on status, not a broken query
× V-15b      — a student cannot read attempts.seed
× V-15b      — nor via select *
```

The third of those is the one worth noticing: it caught the literal answer string appearing in a
response body. That is the founding bug of this project, reproduced deliberately and detected
automatically in under a second.

## The pattern worth noticing, a third time

Pass one and two found **documents disagreeing with each other**. Pass three found **documents
describing protections the schema did not implement**. Pass four found **schema that was
syntactically valid, reviewed, and wrong at runtime** — three times, in three different Postgres
semantics.

Reading found V-15. Reading could never have found V-28, V-29, or V-30. The only thing that
distinguishes a security control from a comment is that something ran it and watched it deny.

---

# Fifth verification pass — after the game-design decisions

Run after `GAME-DESIGN.md` landed and four decisions changed (3D as default, flat
map as a separate route, star dialog, eight encounter themes). Checks were run
mechanically with grep, not by eye — which is how the first two passes found V-10
and V-11, and how this one found V-33.

**Fourteen findings. All fixed in this pass.** Every one is a contradiction
introduced by a correction that was applied in one place and not swept.

---

## 🔴 V-31 · `SKILL-TREE-3D.md` contradicted its own superseded banner

The file carries a banner at the top saying four decisions changed. **Its body
still argued the old position in seven places** — the §3 heading flatly rejecting
a force-directed library, the architecture diagram labelling the DOM layer
"ALWAYS RENDERED / OPTIONAL, enhancement", the ≤640px rule, the "the galaxy is
genuinely optional" paragraph, the settings toggle, the P9 row, and the open
question asking whether 3D is in scope at all.

**This is the worst shape of documentation drift**, because a reader who skims
the banner and then reads the body comes away with the *old* model, and the
banner makes them confident they are current.

**Fixed:** the body now argues the new position. The §3 heading is narrowed to
"Do not use a force-directed **LAYOUT**", which is the part of that argument that
survived — §3.2 already reconsidered the library for picking and camera easing.

## 🔴 V-33 · `GAME-DESIGN.md` contradicted itself: fourteen themes vs eight

§5.3 assigns a theme per stage and names **fourteen distinct themes**: Bench
instrument, Blueprint, Circuit sandbox, DOS/TASM, Hex editor, Instrument HUD,
Modern dashboard, Modern embedded, Modern product page, Phosphor terminal,
Pixel/Terraria, Retro home computer, Schematic, Switchboard.

§9, written after the "eight themes" decision, names **eight**.

Both tables are in the same file, roughly four hundred lines apart. §5.3 was
written before the decision and never revisited.

**Fixed** by folding the six extras into the eight: Hex editor → DOS/TASM ·
Instrument HUD → Bench instrument · Modern dashboard → Modern product · Modern
embedded → Modern product · Phosphor terminal → Base · Schematic → Circuit
sandbox. The stage assignments in §5.3 and §9 now agree row for row.

## 🟠 V-34 · Two stages had no theme at all

§9's stage lists cover 01, 02, 04–17 — **Stages 00 and 03 appear nowhere.** A
student would reach Stage 03 and the theme system would have no answer for it.

**Fixed:** both assigned to Base. Stage 00 is orientation with nothing to dress;
Stage 03 is the phosphor terminal, which is a base theme rather than a ninth one.

## 🟠 V-35 · "Four Phaser scenes" is three

§10.3's own table assigns Phaser to stages 10, 12 and 13, and stage 15 to
**CodeMirror 6 plus a custom VM** — which is not a game engine. The prose
directly under the table said four.

Off-by-one in a dependency count is not cosmetic: it is the difference between
"we need Phaser for the editor" and "we do not", and Phaser is roughly 1 MB.

**Fixed:** "Three Phaser scenes, not eighteen — stages 10, 12 and 13."

## 🟠 V-36 · `CLAUDE.md` forbade the libraries the new design requires

The conventions list says *"Do not add: … a second UI library"*. The game design
adds **three** runtime dependencies — `react-force-graph-3d`, `phaser`,
`codemirror` — on top of `three` and `@react-three/fiber`.

Read literally, the new design violates the project's own rule. Read charitably,
the rule meant *component* libraries. An agent reading both picks one silently,
which is exactly the failure mode these passes exist to prevent.

**Fixed:** the rule now says "a second UI **component** library", followed by an
explicit allow-list naming all five, what each is for, which stages may load it,
and the requirement that every one is lazy-loaded per route and none enters the
initial bundle.

## 🟠 V-37 · `/app/map` existed in three documents and no route spec

`GAME-DESIGN.md`, `SKILL-TREE-3D.md` and `CLAUDE.md` all reference `/app/map` as
a first-class route. **`PAGE-SPECS.md` — the file whose entire job is "every
route, its contents, its states" — had never heard of it**, and still described
`/app` as a single combined stage map.

**Fixed:** `/app` respecified as the galaxy with its redirect rules, `/app/map`
added as its own route with the must-haves, and the original combined entry
retained beneath both so nothing is lost.

## 🟠 V-38 · `apps/web` documented a stack it does not have

Both `CLAUDE.md` and `apps/web/CLAUDE.md` say **"Vite + React 18 + TS + Tailwind
v4 + shadcn/ui"**. Neither Tailwind nor shadcn is installed. The app is
hand-written CSS over `packages/tokens`.

This one predates the game work — it has been wrong since the app was built —
and it is the most actionable kind of wrong, because an agent would `import` from
a library that is not there.

**Fixed:** both corrected, with the reason stated. The student app's surfaces are
bespoke (star map, reader, competency grid, themed encounters), so a component
library would be carried for almost no reuse. **`apps/console` is the opposite
case and genuinely should use shadcn** — that distinction is now written down
rather than assumed.

## 🟠 V-42 · The apply order lost a file

`CLAUDE.md` lists three SQL files and says `pnpm db:reset` applies "all four".
There are now **five**: `local-bootstrap.sql` → `schema.sql` →
`addendum-feedback.sql` → `addendum-audit.sql` → `addendum-cron.sql`.

The order is load-bearing — `inv_24` calls `sus_score()` from the feedback
addendum — so a partial list is a working database that is quietly missing its
scheduled jobs.

**Fixed** in all three places it appears in that file.

## 🟠 V-43 · `CLAUDE.md` still shipped to the wrong repository

It named `CodenameTempest14/Computer-Systems-Interactive-Lecture-Companion-` as
the destination, branch cut from `master`. The actual destination has been
`Shaloh69/Octalysis---A-new-way-of-Learning` for six commits.

The old repo is the app OCTA **replaces**, not where it ships.

**Fixed:** destination corrected, and the old repo kept in the text with its role
made explicit — it is the source of the `lessonData.js` bug, it is not a
dependency, and nothing is merged from it.

## 🟡 V-32 · `VISUAL-SYSTEM-3D.md` still called 3D an enhancement

Two places: the build-order section, and the note about the chunk being fetched
"only on opt-in".

**Fixed.** The nuance worth keeping is that 3D is now the default *surface* while
still being built *after* the flat route — `/app/map` is what the accessibility
floor is measured against and what ships if the galaxy runs long.

## 🟡 V-39 · Tracks A–E floated free of P0–P10

`GAME-DESIGN.md` §12 introduces five tracks. `PHASES.md` has eleven phases. The
two numbering systems shared no stated relationship, which is V-8 repeating
itself with different letters.

**Fixed:** a mapping table, plus the statement that the tracks are a **re-cut of
the same work** and `PHASES.md` stays authoritative for exit criteria.

## 🟡 V-40 · `/public/CREDITS.md` was cited and did not exist

Referenced by `PHASES.md` P9 and by `GAME-DESIGN.md` §12's track C.

**Fixed:** written at `apps/web/public/CREDITS.md`, with the fonts and libraries
that are actually vendored today and explicit *"not yet vendored"* lines for the
Kenney packs — so it does not claim assets that are not there.

## 🟡 V-41 · The contrast check did not cover the new themes

`DESIGN-MANDATE.md` §5.1 requires "All three themes pass WCAG AA". There are now
three base themes **and eight encounter overlays**, and an overlay changes
surface, edge and ink — every token contrast depends on.

**Fixed:** the checklist item now covers both, with "a theme that fails contrast
does not ship" stated in the same line.

## 🟡 V-44 · `CLAUDE.md`'s skill-tree paragraph predated the route split

It described "a DOM layer that is always rendered and is the source of truth",
which was true of the toggle architecture and is not true of the route
architecture.

**Fixed:** it now describes `/app` and `/app/map` and the three redirect
conditions.

---

## 🔴 V-45 · The bundle scanner was both too loud and too quiet

Found by running the scan against a real build after the doc fixes, rather than
by reading it. Two independent defects, in opposite directions.

**Too loud — substring matching.** The scan used `text.includes(value)` on every
live answer value of four characters or more. The fixture bank contains SI
prefixes, so `tera` matched inside `iterate` in the three.js chunk and `peta`
matched a minified identifier. **Three false positives on a completely clean
build.**

That is not a cosmetic problem. This scanner is the permanent guard against the
one bug the whole project exists to fix, it is wired as a build hook, and **a
guard that cries wolf gets switched off.** A scanner nobody trusts is worse than
no scanner, because its presence implies a check that is not happening.

**Fixed** with whole-token matching — the value must be bounded by a
non-identifier character. A real leak looks like `"An assembler"` or `,"tera",`
in a string literal or JSON blob, and both still match. `iterate` does not.

**Too quiet — snake_case only.** The forbidden-token list named the *database*
columns: `correct_value`, `correct_spec`, `solver_ref`. But the thing that would
actually appear in a JavaScript bundle is the *API and TypeScript* spelling:
`correctValue`, `correctIndex`, `resolvedParams`.

A deliberately planted `const __leak = {"correctValue":"An assembler"}` **sailed
straight through and the scan reported clean.**

**Fixed** by adding the camelCase forms. Both paths were then re-verified by
planting each kind of leak and watching the scan catch it:

```
TEST 1  forbidden key name   {"correctValue":"x"}   -> 1 finding: correctValue
TEST 2  live answer value    ["giga"]               -> 1 finding: ANSWER KEY giga
restored                                            -> Clean
```

**The lesson, and it generalises:** every one of these guards — the bundle scan,
the env-name check, the denial suite — needs a test that plants the thing it is
looking for. `check-env-names.mjs` had one from the start and was correct.
`scan-bundle.mjs` did not, and was wrong in two directions simultaneously for its
entire existence.

## What this pass did not find

Worth recording, because a pass that only reports problems is not calibrated:

- **The 18 nodes / 21 edges figure is consistent** (superseded by V-49 — it is now
  19 nodes and 18 edges) across `SKILL-TREE-3D.md`,
  `STAGE-ENCOUNTERS.md`, the schema seed, the API, and the web layout tests.
- **Every internal file reference resolves.** The only unresolved token is
  `content/stages/NN.md`, which is a filename pattern and was already documented
  as such in the second pass.
- **The verb rule in `GAME-DESIGN.md` §8.3 and rule 5 in `DESIGN-MANDATE.md`
  §1B agree**, and neither contradicts the "vary the practice, keep the
  assessment steady" rule in `STAGE-ENCOUNTERS.md`.
- **No document claims a test count that the suite does not produce**, other than
  the one commit message already flagged in `STATUS.md`.
- **The eight themes in §9 now cover all 18 stages** with no stage unassigned and
  no theme named that is not on the list.

## The pattern, a fifth time

Pass 1–2: documents disagreeing with each other.
Pass 3: documents describing protections the schema did not implement.
Pass 4: schema that was valid, reviewed, and wrong at runtime.
**Pass 5: a single document disagreeing with itself** (V-33), and a correction
applied to a banner but not to the body it was warning about (V-31).

The new failure mode is **distance**. `GAME-DESIGN.md` is 618 lines; §5.3 and §9
are four hundred lines apart and were written days apart in reasoning-time. A
file long enough to hold two contradictory tables will hold them.

**Mitigation for next time:** when a decision changes a *quantity* — eight
themes, three Phaser scenes, five SQL files — grep for the old quantity as a
number and as a word, across every file, before considering the change applied.
Every finding in this pass except V-37 and V-40 would have been caught by that
one habit.

---

# Sixth verification pass — the syllabus

Triggered by `CPE 412.docx.pdf` arriving in the repository. One finding, and it
is the largest in the project's history.

## 🔴 V-46 · OCTA was built against the wrong course

The syllabus is **CPE 412 — Computer Architecture and Organization**, University
of Cebu, prepared by Engr. Roland B. Fernandez, MEP, effective August 2025. Its
textbook is **Stallings, *Computer Organization and Architecture: Designing for
Performance*, 9th ed.** Its prerequisite is **Microprocessors**.

OCTA's authored content is *"Computer Systems & Assembly Language"*, built from a
Day 1 languages deck and Null & Lobur chapter 1.

**Stages 01–05 as authored are not in this syllabus.** What programming is,
machine language, assembly language, high-level languages, why assembly matters
— that is prerequisite material, covered by Microprocessors before a student
reaches CPE 412. The content is correct; it is aimed at the wrong course.

Three further structural mismatches:

1. **Four assessment periods, not one.** Prelim, Midterm, Semi-finals, Finals at
   30% combined, with chapter quizzes a separate 30%. `blueprints.scope` is
   `'stage' | 'final'` and cannot express this.
2. **A 20% Project** — "a real life OS algorithm design and implementation case".
   There is no submission, rubric or document-feedback surface anywhere in the
   build.
3. **Laboratory Exercises are 10% of the grade** and "must be submitted on
   time". `GAME-LAYER.md` §2 explicitly designs the lab beat as *"optional but
   always available"*.

**What survives, and it is most of the engineering:** the syllabus is an
orientation block plus **seventeen chapters** (corrected to eighteen by V-47 — the
PDF extraction had lost one). OCTA is Stage 00 plus seventeen
graded stages. The seeded-paper engine, the RLS model, the blueprint filler, the
console API, the content pipeline and the map are all course-agnostic and need
no change at all.

**Full analysis, the 17-chapter outline, per-chapter references with author
credits, and the proposed rebuild: `docs/CPE412-CURRICULUM.md`.**

**Not fixed in this pass**, deliberately. Six questions in that file's §7 are the
instructor's to answer — starting with whether CPE 412 *replaces* the old course
or joins it, because if OCTA must serve both then `courses` becomes a table and
every stage, blueprint and item becomes course-scoped. That is a change worth
making before the item bank exists rather than after.

## The pattern, a sixth time

Passes 1–2: documents disagreeing with each other.
Pass 3: documents describing protections the schema did not implement.
Pass 4: schema valid, reviewed, and wrong at runtime.
Pass 5: a document disagreeing with itself.
**Pass 6: the whole corpus internally consistent, and aimed at the wrong target.**

Every previous pass checked OCTA against OCTA. None of them could have caught
this, because the thing that was wrong was the premise — and the premise was
never checked against a primary source. `docs/source/` held two lecture decks
and no syllabus.

**The habit to add:** the authoritative course document is the first artifact to
obtain and the first to verify against. It is now archived at
`docs/source/CPE 412.docx.pdf` with a text extraction beside it.

---

# Seventh pass — reading the syllabus from the DOCX, not the PDF

The sixth pass established that the syllabus was the authoritative artifact and
extracted it from the PDF. This pass re-extracted the same document from the
**DOCX** the instructor supplied, and compared the two.

## 🔴 V-47 · The PDF hid an entire chapter

`pdftotext -layout` on a landscape table interleaves columns. Pass 6 knew that
and worked around it, recovering seventeen chapters from 93 fragments.

**It recovered seventeen because there were only seventeen left to recover.**

Chapter 18, *Distributed Systems Architecture*, has an **empty topics cell** in
the syllabus. Every other chapter left recognisable debris in the interleaved
text — a title fragment, a stray sub-heading — and could be reconstructed.
Chapter 18 had no topic text to fragment, so it left nothing at all. It did not
come out garbled. It came out **absent**, and nothing in the extraction reported
a gap, because a gap is exactly what an empty cell looks like.

The DOCX keeps table cells as discrete XML. Re-extracting gave **18 chapters and
110 unit outcomes**, all clean.

**What was wrong, and is now fixed:**

| Artifact | Was | Now |
|---|---|---|
| `db/schema.sql` seed | 18 stages, 17 edges | **19 stages, 18 edges** |
| Grading periods | 4/4/4/5 | **5/4/4/5** (13/12/12/15 by contact hour) |
| `docs/LAB-MANUAL.md` | 17 labs | **18 labs**; LAB 18 authored |
| Chapter 18 references | — | van Steen & Tanenbaum · OMG CORBA 3.4 · Fielding (2000) |
| Content scaffolds | hand-written | generated by `scripts/gen-stages.mjs` from the DOCX |

**Chapter 18 is also the one chapter Stallings does not cover.** The syllabus's
own textbook ends at multicore. `CPE412-CURRICULUM.md` §4.1 records that
explicitly, because a chapter with no textbook and no topics cell is the single
likeliest thing to be silently dropped a second time.

## 🔴 V-48 · A test claimed to mirror the seed and did not

`apps/web/test/layout.spec.ts` held a hand-copied `SEED` array under this
comment:

> *This mirrors db/schema.sql's seed exactly. If the seed changes and this does
> not, these tests fail — which is the point.*

**It did not fail.** The seed went from 17 chapters to 18 and all sixteen
assertions kept passing, green, against the stale copy — because nothing in the
file ever compared the array to `db/schema.sql`. The comment described an
intention, and intentions do not execute.

CLAUDE.md says *"nothing about the map may be authored twice."* This was the
second authoring, wearing a comment that said it wasn't.

**Fixed:** the spec now parses the `insert into stages` block out of
`db/schema.sql` at test time. A `describe("the seed parser itself")` block
asserts the parse produced 19 rows starting at `00` and ending at `18`, so a
regex that stops matching fails loudly instead of making every downstream
assertion pass vacuously over an empty array.

## 🟠 V-49 · Three documents still described the branching graph

Linearisation removed every fork and join from `stages.prereq`. Three documents
did not follow:

- `SKILL-TREE-3D.md` §1.1–1.3 still drew a 21-edge ASCII graph with four forks,
  three joins, and a 15-node critical path — and still described stages from the
  *superseded* course (von Neumann, fetch–decode–execute, writing assembly).
- `DELIVERY.md` still asked the alpha checklist to verify "the long `03 → 15`
  edge", which no longer exists.
- `STAGE-ENCOUNTERS.md` and `PAGE-SPECS.md` still quoted "18 nodes, 21 edges".

All corrected to **19 nodes, 18 edges, one chain**. `SKILL-TREE-3D.md` §1.2 now
records *why* the branching came out, rather than deleting the argument: the
forks were a defensible reading of the subject and the wrong reading of the
delivery, and `prereq` gates real students so it must model the course as taught.

## 🟡 V-50 · The lab manual disagreed with its own table

The manual claimed "Eleven of seventeen are Tier A" above a table listing nine.
Pre-existing, unrelated to the chapter count, and found only because adding LAB
18 required recounting. Now **ten of eighteen**, matching the table.

## What this pass verified by running it

- `pnpm verify` — typecheck across 4 packages, **189 passed / 1 skipped**, 22
  invariants clean
- `pnpm test:rls` — **38/38** denial tests
- `apps/web` — **17 passed** (16 before; the new seed-parser guard is the 17th)
- `scan:bundle` — clean, and non-vacuous: 1 live answer value pulled from the
  database to scan for
- `check-env-names` — clean, 4 secret values searched for
- `sync-content` — 19 stage files, 75 blocks, **110 objectives** upserted

Five API tests failed first, and they were the right five: they pinned node
count, edge count, the single leaf, and the 4/4/4/5 split. That is what those
assertions are for.

## The pattern, a seventh time

Pass 6: the corpus was internally consistent and aimed at the wrong target.
**Pass 7: the corpus was aimed at the right target and had silently lost part of
it.**

Both failures share a shape. Pass 6's premise was never checked against a
primary source. Pass 7's extraction *was* checked against the primary source —
but only for the parts that survived extraction. **Nothing counted what should
have been there.** An empty cell and a missing chapter are indistinguishable
unless something independent knows the expected total.

**The habit to add:** when extracting structured data, assert the count against
something the extraction did not produce. `gen-stages.mjs` now refuses to run if
it does not see exactly 18 chapters, and `layout.spec.ts` refuses to pass if it
does not parse exactly 19 stage rows. Neither would have caught V-47 on its own
— but together with the syllabus's own contact-hour arithmetic (17 × 3 hrs + 2 ×
1 hr = 53 hours, which only balances at eighteen chapters) they would have.
