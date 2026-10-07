-- OCTA -- the Studio's moons, E2: edit a moon's wording, add one as a draft,
-- retire one (docs/STUDIO-EDITOR-PLAN.md "E2 -- the moons plan"; instructor
-- approval and sign-off of the moon work's lock layer, 8 Oct 2026).
--
-- Applied SIXTEENTH, after addendum-studio-editor.sql. Idempotent; on a live
-- Supabase project on its own, BEFORE the code that reads it (hard rule 10):
--     pnpm db:push --file db/addendum-studio-moons.sql
--
-- A moon is an `objectives` row. It gains a STATUS:
--   live      what every row has been until now; students see it, the lock counts it
--   draft     a moon a teacher is writing: invisible to students, not counted by the
--             lock, absent from every draw, until it is published with enough
--             live questions to fill its journey (`moon_publishable`)
--   retired   gone for students and for the lock's count; the row, its items, its
--             blueprint and every `objective_progress` row stay (rules 6 and 7)
-- and an OWNER ('file' | 'console'): sync-content writes a moon from the chapter's
-- front matter only while the file owns it; the first Studio publish that touches a
-- moon, or the moon's creation there, hands it to the console.
--
-- `objective_edits` holds ONE pending change per moon (a new wording, ring or
-- competency, or "retire") until a teacher of the subject publishes it. Staff read
-- it; nobody writes it from a client -- the API is the only writer.
--
-- And the rule is held below the API: `ob_staff` is DROPPED, as `cb_staff` was in
-- E1. A staff client can no longer write `objectives` at all, so Publish cannot be
-- bypassed with a token.

/* ---- the status and the owner ------------------------------------------ */

alter table objectives add column if not exists status text not null default 'live';
alter table objectives add column if not exists owner  text not null default 'file';
alter table objectives add column if not exists retired_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'objectives_status_known') then
    alter table objectives add constraint objectives_status_known check (status in ('draft','live','retired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'objectives_owner_known') then
    alter table objectives add constraint objectives_owner_known check (owner in ('file','console'));
  end if;
  -- A retired moon says when; nothing else carries a date.
  if not exists (select 1 from pg_constraint where conname = 'objectives_retired_dated') then
    alter table objectives add constraint objectives_retired_dated check ((status = 'retired') = (retired_at is not null));
  end if;
end $$;

create index if not exists objectives_stage_status on objectives (stage_id, status);

/* ---- the pending change ------------------------------------------------- */

create table if not exists objective_edits (
  objective_id text primary key references objectives(id) on delete cascade,
  action       text not null check (action in ('edit','retire')),
  description  text,
  bloom_level  text check (bloom_level in ('remember','understand','apply','analyze')),
  level        int  check (level between 0 and 6),
  competency   text check (competency in ('read','trace','build')),
  -- The live moon's fields when the change began: Publish refuses if they moved since.
  base_hash    text not null,
  version      int  not null default 1,
  edited_by    uuid references auth.users(id) on delete set null,
  edited_at    timestamptz not null default now(),
  -- A retirement carries no new wording; an edit carries a wording.
  constraint oe_shape check (
    (action = 'retire' and description is null)
    or (action = 'edit' and description is not null and length(trim(description)) >= 8)
  )
);

alter table objective_edits enable row level security;
drop policy if exists oe_staff_read on objective_edits;
create policy oe_staff_read on objective_edits for select to authenticated using (is_staff());
-- Deliberately no write policy: the API (the service role) is the only writer.
revoke all on objective_edits from anon, authenticated;
grant select on objective_edits to authenticated;

/* ---- who reads a moon --------------------------------------------------- */

-- A student reads only a LIVE moon of a published stage; staff read them all.
drop policy if exists ob_read on objectives;
create policy ob_read on objectives for select to authenticated using (
  is_staff() or (
    status = 'live' and exists (
      select 1 from stages s where s.id = objectives.stage_id and s.published
    )
  )
);

-- The Studio may no longer write moons from a client (see the header).
drop policy if exists ob_staff on objectives;

-- The one name every student-facing reader uses. `security_invoker`, so a client
-- reading the view is held to `ob_read` exactly as if it read the table.
create or replace view live_objectives with (security_invoker = true) as
  select id, stage_id, code, bloom_level, level, competency, description
    from objectives
   where status = 'live';
revoke all on live_objectives from anon, authenticated;
grant select on live_objectives to authenticated;

/* ---- when a draft moon may go live ---------------------------------------- */

-- At least THREE distinct live questions (families, V-3): two right masters a
-- moon, and a third leaves room for one miss. A moon with one live question could
-- never be mastered and would hold its planet shut for good. ONE definition, read
-- by Publish and by the console.
create or replace function moon_publishable(p_objective text) returns boolean
language sql stable security definer set search_path = public as $$
  select count(distinct i.family_id) >= 3
    from items i
   where i.objective_id = p_objective and i.status = 'live'
$$;
revoke all on function moon_publishable(text) from public, anon, authenticated;

/* ---- the lock, counting live moons only ----------------------------------- */

-- is_stage_unlocked(), step 4 changed (everything else is schema.sql's, as it was):
-- the prerequisite's moons are its LIVE moons. A draft moon does not hold a planet
-- shut, and a retired one is not counted. A gradeable prerequisite with NO live
-- moon still blocks (fail-closed), and so does a live moon with no live question.
create or replace function is_stage_unlocked(p_user uuid, p_stage text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_section  uuid;
  v_state    lock_state;
  v_unlock   timestamptz;
  v_lock     timestamptz;
  v_prereq   text[];
  v_ok       boolean;
begin
  if is_staff() then return true; end if;
  if p_user is null then return false; end if;   -- anon resolves to locked, always

  select section_id into v_section from profiles where id = p_user and deleted_at is null;
  if not found then return false; end if;        -- V-20: a soft-deleted user is locked out

  -- 1. per-student override
  select state, unlock_at, lock_at into v_state, v_unlock, v_lock
  from stage_locks
  where scope = 'user' and scope_user_id = p_user and stage_id = p_stage;
  if found and v_state <> 'auto' then
    return v_state = 'unlocked'
       and (v_unlock is null or now() >= v_unlock)
       and (v_lock   is null or now() <  v_lock);
  end if;

  -- 2. per-section override
  if v_section is not null then
    select state, unlock_at, lock_at into v_state, v_unlock, v_lock
    from stage_locks
    where scope = 'section' and scope_section_id = v_section and stage_id = p_stage;
    if found and v_state <> 'auto' then
      return v_state = 'unlocked'
         and (v_unlock is null or now() >= v_unlock)
         and (v_lock   is null or now() <  v_lock);
    end if;
  end if;

  -- 3. global override  (also how "exam mode" locks all practice content)
  select state, unlock_at, lock_at into v_state, v_unlock, v_lock
  from stage_locks
  where scope = 'global' and stage_id = p_stage;
  if found and v_state <> 'auto' then
    return v_state = 'unlocked'
       and (v_unlock is null or now() >= v_unlock)
       and (v_lock   is null or now() <  v_lock);
  end if;

  -- 4. curriculum policy: MOONS OPEN THE NEXT PLANET (WEB-REVAMP 3.7, 3.7a), the
  -- LIVE ones only (Studio E2, 8 Oct 2026).
  --   * A non-gradeable prerequisite never blocks (3.7).
  --   * A gradeable prerequisite with NO live moon blocks, and so does a live moon
  --     with no live question (fail-closed, decision 3).
  --   * A draft moon is not counted; a retired moon is not counted.
  --   * A prereq id with no stages row stays blocking; INV-19 forbids one anyway.
  select prereq into v_prereq from stages where id = p_stage;
  if v_prereq is null or array_length(v_prereq,1) is null then return true; end if;

  if exists (select 1 from unnest(v_prereq) req(stage_id)
              where not exists (select 1 from stages s where s.id = req.stage_id)) then
    return false;
  end if;

  select coalesce(bool_and(
           exists (select 1 from objectives o where o.stage_id = s.id and o.status = 'live')
           and not exists (select 1 from objectives o
                            where o.stage_id = s.id and o.status = 'live'
                              and not moon_mastered(p_user, o.id))
         ), true) into v_ok
  from unnest(v_prereq) req(stage_id)
  join stages s on s.id = req.stage_id and s.gradeable;

  return v_ok;
end $$;

/* ---- the invariants read live moons --------------------------------------- */

create or replace function inv_28_objectives_tagged()
returns table(stage_id text, objective_id text, problem text) language sql stable as $$
  select s.id, o.id,
         case when o.id is null then 'stage has no objectives'
              when o.level is null then 'missing level'
              when o.competency is null then 'missing competency' end
  from stages s
  left join objectives o on o.stage_id = s.id and o.status = 'live'
  where s.published and s.gradeable
    and (o.id is null or o.level is null or o.competency is null)
$$;

create or replace function inv_29_grid_reachable()
returns table(level int, competency text) language sql stable as $$
  select l, c
  from generate_series(0,6) l
  cross join unnest(array['read','trace','build']) c
  where not exists (
    select 1 from objectives o join stages s on s.id = o.stage_id
    where o.level = l and o.competency = c and o.status = 'live' and s.published and s.gradeable
  )
$$;
