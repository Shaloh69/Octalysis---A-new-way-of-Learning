-- ============================================================
-- OCTALYSIS — feedback addendum
-- Apply AFTER schema.sql and BEFORE addendum-audit.sql.
-- (addendum-audit's inv_24 calls sus_score(), defined here.)
-- See docs/PAGE-SPECS.md §4 for the product design.
-- ============================================================

create type feedback_channel as enum ('flag','content_report','sus','csat');
create type feedback_status  as enum ('new','triaged','in_progress','shipped','wont_fix');

create table feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  role         user_role not null,
  channel      feedback_channel not null,
  category     text,                      -- broken | confusing | slow | idea
  body         text,
  rating       int check (rating between 1 and 5),   -- CSAT
  sus_answers  int[],                     -- exactly 10 values, each 1-5
  sus_score    numeric(5,2),              -- 0-100
  route        text,
  app_version  text,
  context      jsonb not null default '{}',  -- viewport, ua, last UI events, last api error
  item_id      uuid references items(id),
  resolved_variant jsonb,                 -- the exact instance the reporter saw
  status       feedback_status not null default 'new',
  severity     text,
  released_in  text,
  triaged_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on feedback (status, created_at desc);
create index on feedback (channel, route);
create index on feedback (item_id) where item_id is not null;

-- Gates the SUS trigger so the survey never nags.
create table feedback_prompts (
  user_id         uuid not null references auth.users(id) on delete cascade,
  prompt_key      text not null,          -- 'sus'
  shown_at        timestamptz,
  answered        boolean not null default false,
  dismissed_count int not null default 0,
  primary key (user_id, prompt_key)
);

-- SUS scoring: odd items (x-1), even items (5-x), sum x 2.5.
-- Verified by hand: all 5s -> 100, all 1s -> 0, all 3s -> 50.
create or replace function sus_score(a int[]) returns numeric
language sql immutable as $$
  select round(2.5 * (
    select sum(case when i % 2 = 1 then a[i] - 1 else 5 - a[i] end)
    from generate_subscripts(a, 1) i
  ), 2)
$$;

alter table feedback         enable row level security;
alter table feedback_prompts enable row level security;

-- V-51: these three read `is_staff()`, not `jwt_role() = 'admin'`.
--
-- Decision D4 makes teacher and admin the SAME PERSON in this deployment, and
-- 31 of the 34 policies in this database say so by calling is_staff(). These
-- three said 'admin' only, so a teacher could lock a student out of a stage but
-- could not read the report the student filed about it -- a rule nobody wrote
-- down and nobody would have predicted from the other 31.
--
-- If teacher and admin are ever separated (VERIFICATION.md V-18 has the shape),
-- triage permissions are a deliberate decision to take THEN, in one place,
-- rather than a difference that survived by accident.
create policy fb_insert on feedback for insert
  with check (user_id = auth.uid());
create policy fb_read   on feedback for select
  using (user_id = auth.uid() or is_staff());
create policy fb_admin  on feedback for update
  using (is_staff()) with check (is_staff());
create policy fp_own    on feedback_prompts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
