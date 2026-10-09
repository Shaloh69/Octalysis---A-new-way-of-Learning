-- OCTA -- graded moons (docs/GRADED-MOONS-PLAN.md, ruled by the instructor,
-- 8 Oct 2026, night).
--
-- Applied EIGHTEENTH, after addendum-profiles.sql. Idempotent; on a live
-- Supabase project on its own:
--     pnpm db:push --file db/addendum-graded-moons.sql
--
-- The rulings: a moon can be GRADED. A graded moon is sat as a paper (a "moon
-- check", under hard rule 9, like a stage check), its best score counts as one
-- more quiz inside Quizzes' 30%, all live moons start graded, and a teacher
-- flips each in the Studio through Draft then Publish.
--
-- What this file holds:
--   * `objectives.graded` (default true) and the pending change's `graded`
--     (null = unchanged). Nothing writes either from a client: `ob_staff` was
--     dropped (addendum-studio-moons.sql), so the API is the only writer, and
--     the Studio's Publish is the only path.
--   * a new blueprint scope, 'moon': one per moon, created by the API the first
--     time a student asks, exactly as a journey's ('objective') is. It is a
--     PAPER: every `scope <> 'objective'` test in the system (the sitting sweep,
--     the chat closing, the console's graded-work list, INV-12's cousins)
--     already treats it as one. A moon check's correct answers count toward the
--     moon like a stage check's do (`objective_progress_must_be_earned` refuses
--     only a final's).
--   * `live_objectives` carries `graded`.
--   * INV-12 treats a moon check like a journey: a moon check takes EVERY live
--     question its moon has at Start, so its length follows the bank by design
--     and its blueprint's total_items is only the count when it was made.

alter table objectives      add column if not exists graded boolean not null default true;
alter table objective_edits add column if not exists graded boolean;

-- ---------- the 'moon' scope ----------
alter table blueprints drop constraint if exists blueprints_scope_check;
alter table blueprints drop constraint if exists blueprints_scope_known;
alter table blueprints add constraint blueprints_scope_known
  check (scope in ('stage', 'final', 'objective', 'moon'));

-- A journey and a moon check both name their moon; nothing else does.
alter table blueprints drop constraint if exists bp_objective_is_a_journey;
alter table blueprints drop constraint if exists bp_objective_scoped;
alter table blueprints add constraint bp_objective_scoped
  check ((scope in ('objective', 'moon')) = (objective_id is not null));

-- One moon check per moon (the journey's own index is blueprints_one_journey_per_moon).
create unique index if not exists blueprints_one_check_per_moon
  on blueprints (objective_id) where scope = 'moon';

-- ---------- what a student reads of a moon ----------
create or replace view live_objectives with (security_invoker = true) as
  select id, stage_id, code, bloom_level, level, competency, description, graded
    from objectives
   where status = 'live';
revoke all on live_objectives from anon, authenticated;
grant select on live_objectives to authenticated;

-- ---------- INV-12: papers are their blueprint's length, a moon's are not ----------
-- PAPERS only (checks and exams): a paper quietly short measures something other
-- than it claims. A moon's journey (scope 'objective') and a moon's check (scope
-- 'moon') take every live question their moon has at Start, so their length
-- follows the bank by design.
create or replace function inv_12_item_count_matches_blueprint()
returns table(attempt_id uuid, expected int, actual bigint) language sql stable as $$
  select a.id, b.total_items, count(ai.ordinal)
  from attempts a
  join assessments s on s.id = a.assessment_id
  join blueprints  b on b.id = s.blueprint_id
  left join attempt_items ai on ai.attempt_id = a.id
  where b.scope not in ('objective', 'moon')
  group by a.id, b.total_items
  having count(ai.ordinal) <> b.total_items
$$;
