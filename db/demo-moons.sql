-- ============================================================
-- Demo moons (WEB-REVAMP 3.7a; moons open planets since 30 Sep 2026)
--
-- Run by scripts/db-demo.mjs AFTER sync-items and sync-assessments: it needs
-- the bank. LOCAL DEMO ONLY, and only for the demo students (`dddddddd-`).
--
-- WHY. is_stage_unlocked() opens a planet when every moon of its prerequisite
-- is mastered, and a moon is mastered by answers (objective_progress, keyed to
-- responses). The demo cohort's progress was written straight into
-- stage_progress, with no answers behind it, so without this every demo
-- student's map would shut at stage 02, and every spec that reads an open
-- planet off a demo student would be reading a lie.
--
-- WHAT. Each demo student's moons are EARNED the way a student earns them: a
-- moon's journey (a real 'objective' blueprint and assessment), an attempt,
-- the resolved questions, a correct response each, and objective_progress
-- through its own trigger, which refuses anything that is not a correct,
-- counting answer. Nothing is inserted around the rule.
--
-- HOW MUCH, mirroring the seeded stage_progress so the lock picture does not
-- move: a stage at 70% or more has every moon mastered; below that, the share
-- of its moons its mastery would cover (strictly fewer than all), plus one moon
-- with a single right answer, so the map shows all three states.
--
-- The bank is at `review` locally, so these answers count while no student can
-- start a journey (fail-closed: a journey takes only `live` questions).
-- ============================================================

begin;

-- 1. A journey per moon with at least two questions: the same shape the API's
--    ensureJourney() creates on first entry, which will then find these.
insert into blueprints (name, scope, stage_id, objective_id, total_items, constraints)
select 'Moon ' || o.id || ' journey', 'objective', o.stage_id, o.id, q.n, '{}'::jsonb
  from objectives o
  cross join lateral (select count(distinct i.family_id)::int as n from items i where i.objective_id = o.id) q
 where q.n >= 2
on conflict (objective_id) where scope = 'objective' do nothing;

insert into assessments (blueprint_id, section_id, title)
select b.id, null, b.name
  from blueprints b
 where b.scope = 'objective'
   and not exists (select 1 from assessments a where a.blueprint_id = b.id);

-- exam_salt defaults to gen_random_bytes(32), as sync-assessments relies on.
insert into assessment_secrets (assessment_id)
select a.id
  from assessments a join blueprints b on b.id = a.blueprint_id
 where b.scope = 'objective'
   and not exists (select 1 from assessment_secrets s where s.assessment_id = a.id);

-- 2. The plan: how many right answers each demo student has on each moon.
create temp table demo_moon_plan on commit drop as
with st as (
  select sp.user_id, sp.stage_id, sp.mastery,
         (select count(*) from objectives o where o.stage_id = sp.stage_id)::int as n
    from stage_progress sp
    join profiles p on p.id = sp.user_id
    join stages s on s.id = sp.stage_id and s.gradeable
   where p.id::text like 'dddddddd-%' and p.student_id is not null
),
ranked as (
  select st.user_id, st.stage_id, st.mastery, o.id as objective_id,
         row_number() over (partition by st.user_id, st.stage_id
                            order by split_part(o.id, '.', 2)::int) as k,
         case when st.mastery >= 0.70 then st.n
              else floor(st.mastery * st.n)::int end as full_count
    from st join objectives o on o.stage_id = st.stage_id
)
select user_id, objective_id,
       case when k <= full_count then 2
            when k = full_count + 1 and mastery > 0 and mastery < 0.70 then 1
            else 0 end as right_answers
  from ranked;

-- 3. One journey attempt per moon with anything right, handed in.
create temp table demo_moon_attempts on commit drop as
select gen_random_uuid() as attempt_id, pl.user_id, pl.objective_id, pl.right_answers, a.id as assessment_id
  from demo_moon_plan pl
  join blueprints b on b.scope = 'objective' and b.objective_id = pl.objective_id
  join assessments a on a.blueprint_id = b.id
 where pl.right_answers > 0;

insert into attempts (id, user_id, assessment_id, attempt_no, seed, engine_version, status,
                      score, max_score, started_at, submitted_at)
select attempt_id, user_id, assessment_id, 1, 'demo-moon-' || objective_id, '1.0.0', 'submitted',
       right_answers, right_answers, now() - interval '3 days', now() - interval '3 days'
  from demo_moon_attempts;

-- 4. The questions: distinct families, choices and orderings before computed
--    ones (a computed key is the solver's, not the row's).
create temp table demo_moon_items on commit drop as
select m.attempt_id, m.user_id, m.objective_id, q.item_id, q.family_id, q.value,
       row_number() over (partition by m.attempt_id order by q.rank)::int as ordinal
  from demo_moon_attempts m
  cross join lateral (
    select i.id as item_id, i.family_id,
           coalesce(i.correct_spec->>'value',
                    (select string_agg(x, ' | ') from jsonb_array_elements_text(i.correct_spec->'order') x),
                    'demo') as value,
           row_number() over (order by (i.type = 'P'), i.slug) as rank
      from (select distinct on (family_id) * from items
             where objective_id = m.objective_id
             order by family_id, version desc) i
     order by (i.type = 'P'), i.slug
     limit m.right_answers
  ) q;

insert into attempt_items (attempt_id, ordinal, item_id, resolved_options, correct_value, points)
select attempt_id, ordinal, item_id, jsonb_build_array(value),
       jsonb_build_object('value', value, 'index', 0), 1
  from demo_moon_items;

insert into responses (attempt_id, ordinal, raw_answer, is_correct, points, answered_at)
select attempt_id, ordinal, '{"index":0}'::jsonb, true, 1, now() - interval '3 days'
  from demo_moon_items;

-- 5. The moon's record, through objective_progress_earned: the trigger checks
--    each row against the response, the attempt and the item it cites.
insert into objective_progress (attempt_id, ordinal, user_id, objective_id, family_id, recorded_at)
select attempt_id, ordinal, user_id, objective_id, family_id, now() - interval '3 days'
  from demo_moon_items;

commit;
