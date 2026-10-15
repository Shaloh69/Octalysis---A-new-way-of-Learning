-- OCTA -- a class's own window and attempt limit on a stage check (docs/TEACHERS-AND-SUBJECTS-PLAN.md 5.10;
-- instructor, 15 Oct 2026: "Build it now"; moon checks follow it; only the class's teacher sets it).
--
-- Applied TWENTY-FOURTH, after addendum-sitting-guards.sql. Idempotent; on a live Supabase project on its own:
--     pnpm db:push --file db/addendum-class-windows.sql
--
-- The stage check stays ONE shared paper (one blueprint, one exam salt). A row here moves, for one class only,
-- when that paper opens and closes and how many attempts it allows. A null field is the shared paper's.
-- A moon's CHECK on that stage follows the same row (one setting per stage, not one per moon). The exams
-- (scope 'final') are global (ruling 4) and a journey is practice: neither can have a row, from any path.
--
-- Written by the API only (the class's teacher, through services/api); staff read the rows of classes they read.

create table if not exists class_assessment_windows (
  class_id         uuid not null references classes(id) on delete cascade,
  assessment_id    uuid not null references assessments(id) on delete cascade,
  opens_at         timestamptz,
  closes_at        timestamptz,
  attempts_allowed int check (attempts_allowed is null or attempts_allowed > 0),
  set_by           uuid references auth.users(id) on delete set null,
  set_at           timestamptz not null default now(),
  primary key (class_id, assessment_id)
);

alter table class_assessment_windows enable row level security;

-- Only a stage check, and only a window that makes sense against the shared paper it falls back to.
create or replace function class_window_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_scope  text;
  v_open   timestamptz;
  v_close  timestamptz;
begin
  select b.scope, a.opens_at, a.closes_at into v_scope, v_open, v_close
    from assessments a join blueprints b on b.id = a.blueprint_id
   where a.id = new.assessment_id;
  if v_scope is distinct from 'stage' then
    raise exception 'A class window is set on a stage check only (this paper is %).', coalesce(v_scope, 'missing')
      using errcode = 'check_violation';
  end if;
  v_open  := coalesce(new.opens_at, v_open);
  v_close := coalesce(new.closes_at, v_close);
  if v_open is not null and v_close is not null and v_close <= v_open then
    raise exception 'A class window cannot close before it opens.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists class_window_guard on class_assessment_windows;
create trigger class_window_guard before insert or update on class_assessment_windows
  for each row execute function class_window_guard();

drop policy if exists caw_staff_read on class_assessment_windows;
create policy caw_staff_read on class_assessment_windows for select to authenticated
  using (exists (select 1 from classes c where c.id = class_id and staff_reads_section(c.section_id)));

-- The one rule every reader asks: what window and limit does THIS student have on THIS paper?
-- Their class is the un-ended class of their section for the paper's subject. A moon check reads its stage's
-- stage-check row. Executable by the API's connection only (it takes the student as an argument).
create or replace function effective_assessment_window(p_user uuid, p_assessment uuid)
returns table (opens_at timestamptz, closes_at timestamptz, attempts_allowed int, class_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  with paper as (
    select a.id, a.opens_at, a.closes_at, a.attempts_allowed, b.scope, b.stage_id
      from assessments a join blueprints b on b.id = a.blueprint_id
     where a.id = p_assessment
  ),
  governing as (
    -- the stage check whose class rows govern this paper
    select case when p.scope = 'stage' then p.id
                when p.scope = 'moon' then (
                  select a2.id from assessments a2 join blueprints b2 on b2.id = a2.blueprint_id
                   where b2.scope = 'stage' and b2.stage_id = p.stage_id and a2.section_id is null
                   order by a2.created_at desc limit 1)
           end as assessment_id
      from paper p
  ),
  klass as (
    select c.id from classes c, paper p
     where c.section_id = (select pr.section_id from profiles pr where pr.id = p_user)
       and c.subject_code = content_subject_of(p.stage_id)
       and c.ended_at is null
     order by c.created_at desc limit 1
  ),
  w as (
    select cw.* from class_assessment_windows cw
     where cw.class_id = (select id from klass)
       and cw.assessment_id = (select assessment_id from governing)
  )
  select coalesce(w.opens_at, p.opens_at),
         coalesce(w.closes_at, p.closes_at),
         coalesce(w.attempts_allowed, p.attempts_allowed),
         (select id from klass)
    from paper p left join w on true
$$;

revoke execute on function effective_assessment_window(uuid, uuid) from public, anon, authenticated;
grant execute on function effective_assessment_window(uuid, uuid) to service_role;
revoke all on class_assessment_windows from anon;
grant select on class_assessment_windows to authenticated;
grant select, insert, update, delete on class_assessment_windows to service_role;
