-- ============================================================
-- OCTALYSIS — audit addendum
-- Append to schema.sql AFTER the main schema and the feedback addendum.
-- Contains: engine versioning, audit_runs, and the invariant suite.
-- ============================================================

-- ---------- engine version pinning --------------------------
-- Without this, changing a solver silently breaks every stored seed's
-- ability to regenerate its paper. See AUDITS.md §0.
-- engine_version is now declared inline in schema.sql; kept here for older databases.
alter table attempts add column if not exists engine_version text not null default '1.0.0';
alter table items    add column if not exists solver_version text;

create table if not exists audit_runs (
  id           bigserial primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  triggered_by text not null,                    -- 'cron' | 'deploy' | uuid of admin
  results      jsonb not null default '[]',      -- [{id,name,severity,offending_count,sample}]
  passed       boolean,
  notes        text
);
alter table audit_runs enable row level security;
-- V-51: is_staff(), not admin-only. See the note in addendum-feedback.sql.
create policy ar_admin on audit_runs for select using (is_staff());

-- ============================================================
-- INVARIANTS
-- Each returns offending rows. Zero rows = pass.
-- ============================================================

-- ---------- security ----------------------------------------
create or replace function inv_01_rls_enabled()
returns table(tablename text) language sql stable as $$
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
$$;

create or replace function inv_02_rls_has_policy()
returns table(tablename text) language sql stable as $$
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
$$;

create or replace function inv_03_definer_search_path()
returns table(funcname text) language sql stable as $$
  select p.proname::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig,'{}')) cfg
      where cfg like 'search_path=%'
    )
$$;

-- ---------- identity ----------------------------------------
create or replace function inv_05_profile_claim_valid()
returns table(profile_id uuid, student_id text) language sql stable as $$
  select p.id, p.student_id
  from profiles p
  left join student_directory d on d.student_id = p.student_id
  where p.student_id is not null
    and (d.student_id is null or d.status <> 'claimed')
$$;

create or replace function inv_06_no_orphan_claims()
returns table(student_id text) language sql stable as $$
  select d.student_id
  from student_directory d
  where d.status = 'claimed'
    and not exists (select 1 from profiles p where p.student_id = d.student_id)
$$;

create or replace function inv_07_student_id_unique()
returns table(student_id text, n bigint) language sql stable as $$
  select p.student_id, count(*)
  from profiles p where p.student_id is not null
  group by 1 having count(*) > 1
$$;

-- ---------- assessment integrity ----------------------------
create or replace function inv_09_response_has_item()
returns table(attempt_id uuid, ordinal int) language sql stable as $$
  select r.attempt_id, r.ordinal
  from responses r
  left join attempt_items ai
    on ai.attempt_id = r.attempt_id and ai.ordinal = r.ordinal
  where ai.attempt_id is null
$$;

create or replace function inv_10_no_late_responses()
returns table(attempt_id uuid, ordinal int) language sql stable as $$
  select r.attempt_id, r.ordinal
  from responses r join attempts a on a.id = r.attempt_id
  where a.submitted_at is not null and r.answered_at > a.submitted_at
$$;

create or replace function inv_11_submitted_has_score()
returns table(attempt_id uuid) language sql stable as $$
  select id from attempts where status = 'submitted' and score is null
$$;

create or replace function inv_12_item_count_matches_blueprint()
returns table(attempt_id uuid, expected int, actual bigint) language sql stable as $$
  select a.id, b.total_items, count(ai.ordinal)
  from attempts a
  join assessments s on s.id = a.assessment_id
  join blueprints  b on b.id = s.blueprint_id
  left join attempt_items ai on ai.attempt_id = a.id
  group by a.id, b.total_items
  having count(ai.ordinal) <> b.total_items
$$;

-- V-3: attempt_items points at a specific version row, so this is a plain existence check.
create or replace function inv_13_item_version_exists()
returns table(attempt_id uuid, ordinal int, item_id uuid)
language sql stable as $$
  select ai.attempt_id, ai.ordinal, ai.item_id
  from attempt_items ai
  where not exists (select 1 from items i where i.id = ai.item_id)
$$;

-- ---------- item bank health --------------------------------
create or replace function inv_15_live_items_reviewed()
returns table(item_id uuid, slug text) language sql stable as $$
  select id, slug from items where status = 'live' and reviewed_by is null
$$;

-- INV-16: a live static item can actually be rendered as a question.
--
-- The engine builds a 4-option paper: `resolveItem()` defaults `optionCount` to
-- 4 and no call site overrides it, and `resolveStatic()` asks `pickDistinct()`
-- for `optionCount - 1` = THREE distractors. Fewer than three and the item
-- throws at the moment a student presses Start; three is exactly enough.
--
-- The threshold used to be 4, which is one more than the engine has ever asked
-- for, and every authored item disagreed with it: measured on the seeded bank,
-- all 141 type-S items carry exactly 3 distractors. That is not an oversight in
-- the bank, it is the standard shape of a 4-option MCQ — one key and three
-- distractors. The old threshold reads like "an MCQ needs 4 options" written as
-- if options and distractors were the same thing.
--
-- Like INV-17, it never fired because the predicate only looks at `live` rows
-- and no item had ever been approved. Approving act 1 turned all 74 of its
-- static items into failures at once.
--
-- WHAT THIS DOES NOT CHECK, on purpose. Three distractors for three slots means
-- every student sees the same four options in a different order; a deeper pool
-- would vary the options too. That is a desirable property and NOT a
-- correctness one — per-student uniqueness already comes from which items are
-- sampled. If the bank is ever deepened, raise this threshold then. Pool depth
-- is a content decision; this invariant is about whether the engine can render
-- the item at all.
--
-- `pickDistinct()` dedupes candidates against the CORRECT answer, so a pool of
-- exactly 3 has no margin: one distractor equal to the key leaves two and the
-- item throws. Measured across the whole bank, zero items collide that way and
-- zero have duplicate pool entries.
create or replace function inv_16_static_distractor_pool()
returns table(item_id uuid, slug text, pool_size int) language sql stable as $$
  select id, slug, jsonb_array_length(distractor_pool)
  from items
  where status = 'live' and type = 'S'
    and coalesce(jsonb_array_length(distractor_pool), 0) < 3
$$;

-- INV-17: a live type-P item carries what the ENGINE needs to resolve it, which
-- is `solver_ref` and nothing else.
--
-- This used to demand `tolerance` and `params_schema` as well, and that was a
-- stale reading of a design the engine had already left behind.
-- `resolveParameterized()` (engine/resolve.ts) takes the solver from
-- `item.solver_ref`, then draws params from `solver.draw()` and reads tolerance,
-- sig figs, unit, stem and rationale off the registered solver. Neither column
-- is read anywhere in the resolve or grade path.
--
-- It survived because `test/helpers/bank.ts` seeds its P fixtures WITH both
-- columns filled, while no authored item has ever carried either: measured on
-- the seeded bank, 30 P items, 30 with a solver_ref, 0 with a tolerance or a
-- params_schema. The fixture matched the invariant and the real bank did not,
-- and nothing caught it because no item has ever been `live` — the predicate
-- only looks at live rows. The first approval at `/items` would have put the
-- database into a state its own suite calls illegal, at `fail` severity, and
-- `run_invariants_nightly()` would have alerted on all 30 at once.
--
-- The rule this keeps is the one that matters: a live P item with no solver_ref
-- makes `resolveParameterized()` throw "is type P but has no solver_ref" at the
-- moment a student presses Start. That must never sit in a live bank.
-- `test/invariants.spec.ts` holds all three cases.
create or replace function inv_17_param_items_complete()
returns table(item_id uuid, slug text, missing text) language sql stable as $$
  select id, slug, 'solver_ref'
  from items
  where status = 'live' and type = 'P'
    and solver_ref is null
$$;

-- INV-18 bank starvation: does the live bank satisfy every blueprint cell?
-- Checks the by_act dimension; extend per dimension you enforce.
create or replace function inv_18_bank_starvation()
returns table(assessment_id uuid, dimension text, bucket text, needed int, available bigint)
language sql stable as $$
  with need as (
    select s.id as assessment_id, 'act' as dimension,
           k as bucket, v::int as needed
    from assessments s
    join blueprints b on b.id = s.blueprint_id,
    lateral jsonb_each_text(b.constraints -> 'by_act') as e(k, v)
  ),
  have as (
    select st.act::text as bucket, count(*) as available
    from items i join stages st on st.id = i.stage_id
    where i.status = 'live'
    group by 1
  )
  select n.assessment_id, n.dimension, n.bucket, n.needed, coalesce(h.available, 0)
  from need n left join have h on h.bucket = n.bucket
  where coalesce(h.available, 0) < n.needed * 3      -- want 3x headroom, not bare minimum
$$;

-- ---------- curriculum & gating -----------------------------
create or replace function inv_19_prereq_exists()
returns table(stage_id text, missing_prereq text) language sql stable as $$
  select s.id, p
  from stages s, lateral unnest(s.prereq) p
  where not exists (select 1 from stages x where x.id = p)
$$;

create or replace function inv_20_prereq_acyclic()
returns table(stage_id text) language sql stable as $$
  with recursive walk(root, node, depth) as (
    select s.id, p, 1 from stages s, lateral unnest(s.prereq) p
    union all
    select w.root, p, w.depth + 1
    from walk w join stages s on s.id = w.node, lateral unnest(s.prereq) p
    where w.depth < 25
  )
  select distinct root from walk where node = root
$$;

-- ---------------------------------------------------------------
-- INV-32 / INV-33 -- the map is the curriculum, checked as a graph.
--
-- `DELIVERY.md` 3.1 has listed these as ALPHA EXIT CRITERIA since the plan was
-- written: "INV-32 and INV-33 pass -- no invented nodes, no invented or missing
-- edges". They did not exist. The invariant set stopped at INV-31, so the gate
-- could be neither passed nor failed, and PROGRESS.md carried it as an open
-- finding for days.
--
-- They matter more than most: root CLAUDE.md's central rule is that the skill
-- tree IS the curriculum, `stages.prereq` is the ONLY edge list, and nothing
-- about the map may be authored twice. These are that rule, enforced.
--
-- INV-19 already checks a prereq points at a row that exists, and INV-20 that
-- the graph is acyclic. Neither catches the two failures that would actually
-- corrupt a student's map.
-- ---------------------------------------------------------------

-- INV-32: no invented and no orphaned NODES.
--
-- Every published, gradeable stage must be reachable by walking prereq edges
-- from a root (a stage with no prereqs). A stage that is published but
-- unreachable is a node the map will draw and no student can ever arrive at --
-- it appears as a planet floating outside the system.
create or replace function inv_32_no_orphan_nodes()
returns table(stage_id text, reason text) language sql stable as $$
  with recursive roots as (
    select id from stages
    where published and (prereq is null or cardinality(prereq) = 0)
  ),
  reachable(id) as (
    select id from roots
    union
    select s.id
    from stages s
    join reachable r on r.id = any(s.prereq)
    where s.published
  )
  select s.id, 'published but unreachable from any root'
  from stages s
  where s.published and s.id not in (select id from reachable)
$$;

-- INV-33: no invented and no missing EDGES.
--
-- An edge is legal only if it points at a stage that is itself published, and a
-- stage may not depend on itself. INV-19 checks the target row exists; it does
-- NOT check the target is published, so a prereq pointing at an unpublished
-- stage passes INV-19 and produces a map edge to a node that is never drawn --
-- an arrow into empty space, and a lock no student can ever satisfy.
--
-- The self-edge case is separate from INV-20's cycle walk, which starts at
-- depth 1 and so reports a self-reference as a cycle without saying that is
-- what it is.
create or replace function inv_33_edges_resolve()
returns table(stage_id text, prereq_id text, reason text) language sql stable as $$
  select s.id, p, 'prereq points at an unpublished stage'
  from stages s, lateral unnest(s.prereq) p
  join stages t on t.id = p
  where s.published and not t.published
  union all
  select s.id, p, 'stage lists itself as its own prereq'
  from stages s, lateral unnest(s.prereq) p
  where p = s.id
$$;

create or replace function inv_22_overrides_have_reason()
returns table(lock_id uuid, stage_id text) language sql stable as $$
  select id, stage_id from stage_locks
  where state <> 'auto' and (reason is null or btrim(reason) = '')
$$;

create or replace function inv_23_content_stage_exists()
returns table(block_id uuid, stage_id text) language sql stable as $$
  select cb.id, cb.stage_id from content_blocks cb
  where not exists (select 1 from stages s where s.id = cb.stage_id)
$$;

-- ---------- feedback ----------------------------------------
create or replace function inv_24_sus_wellformed()
returns table(feedback_id uuid, problem text) language sql stable as $$
  select id,
    case when array_length(sus_answers,1) is distinct from 10 then 'not 10 answers'
         when exists (select 1 from unnest(sus_answers) x where x < 1 or x > 5) then 'out of range'
         when sus_score is distinct from sus_score(sus_answers) then 'score mismatch'
    end
  from feedback
  where channel = 'sus'
    and (array_length(sus_answers,1) is distinct from 10
         or exists (select 1 from unnest(sus_answers) x where x < 1 or x > 5)
         or sus_score is distinct from sus_score(sus_answers))
$$;

create or replace function inv_25_content_reports_complete()
returns table(feedback_id uuid) language sql stable as $$
  select id from feedback
  where channel = 'content_report'
    and (item_id is null or resolved_variant is null)
$$;


-- ---------- added after the verification pass ------------------
-- INV-27: every stage's archetype has the content blocks its beat sequence requires.
create or replace function inv_27_archetype_beats()
returns table(stage_id text, archetype char(1), missing text) language sql stable as $$
  select s.id, s.archetype,
         case s.archetype
           when 'D' then 'sim'
           when 'C' then 'code'
           else 'prose'
         end
  from stages s
  where s.published and not exists (
    select 1 from content_blocks cb
    where cb.stage_id = s.id
      and cb.kind = case s.archetype when 'D' then 'sim' when 'C' then 'code' else 'prose' end
  )
$$;

-- INV-28: every published stage has objectives, and every objective is fully tagged.
create or replace function inv_28_objectives_tagged()
returns table(stage_id text, objective_id text, problem text) language sql stable as $$
  select s.id, o.id,
         case when o.id is null then 'stage has no objectives'
              when o.level is null then 'missing level'
              when o.competency is null then 'missing competency' end
  from stages s
  left join objectives o on o.stage_id = s.id
  where s.published and s.gradeable
    and (o.id is null or o.level is null or o.competency is null)
$$;

-- INV-29: all 21 competency cells are reachable. An unreachable cell can never be completed.
create or replace function inv_29_grid_reachable()
returns table(level int, competency text) language sql stable as $$
  select l, c
  from generate_series(0,6) l
  cross join unnest(array['read','trace','build']) c
  where not exists (
    select 1 from objectives o join stages s on s.id = o.stage_id
    where o.level = l and o.competency = c and s.published and s.gradeable
  )
$$;

-- INV-30: no attempt ever samples an item from a non-gradeable stage.
create or replace function inv_30_no_ungradeable_items()
returns table(attempt_id uuid, ordinal int, stage_id text) language sql stable as $$
  select ai.attempt_id, ai.ordinal, i.stage_id
  from attempt_items ai
  join items  i on i.id = ai.item_id
  join stages s on s.id = i.stage_id
  where not s.gradeable
$$;

-- ============================================================
-- RUNNER
-- ============================================================
create or replace function run_invariants()
returns table(id text, name text, severity text, offending_count bigint, sample jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  checks text[][] := array[
    ['INV-01','inv_01_rls_enabled','fail'],
    ['INV-02','inv_02_rls_has_policy','fail'],
    ['INV-03','inv_03_definer_search_path','fail'],
    ['INV-05','inv_05_profile_claim_valid','fail'],
    ['INV-06','inv_06_no_orphan_claims','fail'],
    ['INV-07','inv_07_student_id_unique','fail'],
    ['INV-09','inv_09_response_has_item','fail'],
    ['INV-10','inv_10_no_late_responses','fail'],
    ['INV-11','inv_11_submitted_has_score','fail'],
    ['INV-12','inv_12_item_count_matches_blueprint','fail'],
    ['INV-13','inv_13_item_version_exists','fail'],
    ['INV-15','inv_15_live_items_reviewed','fail'],
    ['INV-16','inv_16_static_distractor_pool','fail'],
    ['INV-17','inv_17_param_items_complete','fail'],
    ['INV-18','inv_18_bank_starvation','warn'],
    ['INV-19','inv_19_prereq_exists','fail'],
    ['INV-20','inv_20_prereq_acyclic','fail'],
    ['INV-22','inv_22_overrides_have_reason','warn'],
    ['INV-23','inv_23_content_stage_exists','fail'],
    ['INV-24','inv_24_sus_wellformed','fail'],
    ['INV-25','inv_25_content_reports_complete','warn'],
    ['INV-27','inv_27_archetype_beats','warn'],
    ['INV-28','inv_28_objectives_tagged','fail'],
    ['INV-29','inv_29_grid_reachable','warn'],
    ['INV-30','inv_30_no_ungradeable_items','fail'],
    -- Defined in addendum-submissions.sql, which is why that file applies
    -- BEFORE this one. A graded row with no score looks finished in every
    -- list and contributes nothing to the total.
    ['INV-31','inv_31_graded_submissions_complete','fail'],
    -- The alpha exit gate in DELIVERY.md 3.1, which cited these two by name for
    -- days before either existed. 'fail' on purpose: a map with an orphan node
    -- or an edge into an unpublished stage is a broken curriculum, not a warning.
    ['INV-32','inv_32_no_orphan_nodes','fail'],
    ['INV-33','inv_33_edges_resolve','fail']
  ];
  c    text[];
  cnt  bigint;
  smp  jsonb;
begin
  foreach c slice 1 in array checks loop
    -- The COUNT is over the whole result and the SAMPLE is the first five.
    -- Counting inside the `limit 5` subquery capped `offending_count` at 5, so
    -- 74 illegal rows and 5 illegal rows were indistinguishable to
    -- `run_invariants_nightly()`, to the console's /audit/system, and to
    -- `db-invariants.mjs`, all of which print this number to say how bad it is.
    execute format('select count(*) from %I() t', c[2]) into cnt;
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb)
                    from (select * from %I() limit 5) t', c[2])
      into smp;
    id := c[1]; name := c[2]; severity := c[3];
    offending_count := cnt; sample := smp;
    return next;
  end loop;
end $$;

-- Usage:
--   select * from run_invariants() where offending_count > 0;
--
-- Nightly cron should insert the full result into audit_runs and alert on any
-- row with severity='fail' and offending_count > 0.
