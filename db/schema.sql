-- ============================================================
-- OCTALYSIS / OCTA — Supabase / Postgres schema
-- Run in Supabase SQL Editor, via `supabase db push`, or against the
-- local Docker Postgres: `pnpm db:reset`.
-- Order matters: types -> tables -> functions -> RLS -> grants -> seed.
--
-- THIRD-PASS HARDENING APPLIED (see docs/VERIFICATION.md):
--   V-15 exam_salt moved out of a readable table; attempts.seed revoked at
--        column level; every policy carries an explicit TO clause.
--   V-16 is_stage_unlocked() now honours lock_at.
--   V-17 stage_locks uses typed scope columns + matching partial indexes.
--   V-19 profiles.accent_hue exists.
--   V-20 soft delete: profiles.deleted_at. Auth users are never hard-deleted.
--   V-23 range checks on every stored proportion.
--   V-24 items.slug is unique per version.
--   V-25 jwt_role() maps unknown claims to least privilege, never raises.
-- DECISIONS APPLIED:
--   D1 SUPERSEDED. Stage 08 was wired into Stage 17 to remove a dead-end
--      node, back when the graph branched. The instructor teaches straight
--      down the syllabus, so the graph is now ONE LINEAR CHAIN and there is
--      no dead end to fix: every stage has exactly one dependent but the last.
--   D4 teacher and admin are intentionally equivalent in this deployment.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums -------------------------------------------
create type user_role      as enum ('student','teacher','admin');
create type claim_status   as enum ('unclaimed','claimed','disabled');
create type item_type      as enum ('S','P','G');          -- static / parameterized / generated
create type item_status    as enum ('draft','review','live','retired');
create type lock_scope     as enum ('global','section','user');
create type lock_state     as enum ('locked','unlocked','auto');
create type attempt_status as enum ('in_progress','submitted','abandoned','voided');

-- ---------- identity ----------------------------------------
create table sections (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- 'BSCPE-2A'
  term        text not null,                   -- '2026-1'
  teacher_id  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- The roster. Teacher imports this BEFORE students can sign up.
create table student_directory (
  student_id  text primary key,                -- university ID number
  full_name   text not null,
  section_id  uuid references sections(id),
  status      claim_status not null default 'unclaimed',
  claimed_by  uuid references auth.users(id),
  claimed_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  student_id  text unique references student_directory(student_id),
  full_name   text not null,
  section_id  uuid references sections(id),
  role        user_role not null default 'student',   -- mirror of JWT app_metadata; JWT is authoritative
  theme       text not null default 'bare-metal'
              check (theme in ('bare-metal','blueprint','phosphor')),
  -- V-19: the per-student accent is a HUE, never a hex. Contrast is held constant
  -- by fixing lightness/chroma per theme in OKLCH. See packages/tokens/accents.ts.
  accent_hue  int  not null default 250 check (accent_hue between 0 and 359),
  audio_prefs jsonb not null default '{"ui":0.4,"ambient":0.0,"muted":false}',
  -- V-20: auth users are NEVER hard-deleted (the append-only trigger on `responses`
  -- blocks the cascade). Deactivation is a soft delete, and it is the supported path.
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on profiles (section_id) where deleted_at is null;

-- ---------- curriculum --------------------------------------
create table stages (
  id           text primary key,               -- '07'
  act          int  not null check (act between 1 and 4),
  ordinal      int  not null unique,
  title        text not null,
  summary      text,
  est_minutes  int  not null default 45,
  prereq       text[] not null default '{}',   -- stage ids
  published    boolean not null default false,
  gradeable    boolean not null default true,   -- V-1: stage 00 is orientation, never sampled
  archetype    char(1) not null default 'A'
               check (archetype in ('A','B','C','D')),  -- concept/computation/artifact/simulator
  levels       int[]   not null default '{}'    -- Computer Level Hierarchy levels touched, 0-6
);

create table objectives (
  id           text primary key,               -- '07.3'
  stage_id     text not null references stages(id) on delete cascade,
  code         text not null,
  bloom_level  text not null
               check (bloom_level in ('remember','understand','apply','analyze')),
  level        int  check (level between 0 and 6),        -- Computer Level Hierarchy
  competency   text check (competency in ('read','trace','build')),
  description  text not null
);
create index on objectives (stage_id);

-- Content lives here, NOT in a bundled lessonData.js.
-- Teacher fixes a typo -> no redeploy.
create table content_blocks (
  id         uuid primary key default gen_random_uuid(),
  stage_id   text not null references stages(id) on delete cascade,
  ordinal    int  not null,
  kind       text not null,                    -- prose|figure|code|diagram|sim|callout
  body_md    text,
  media_ref  text,                             -- Supabase Storage path
  meta       jsonb not null default '{}',
  version    int  not null default 1,
  updated_at timestamptz not null default now(),
  unique (stage_id, ordinal)
);

-- ---------- item bank ---------------------------------------
create table items (
  -- V-3: `id` identifies ONE VERSION. `family_id` is the stable identity across versions.
  -- A new version is a new row sharing family_id. attempt_items points at a version row.
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null default gen_random_uuid(),
  slug               text not null,                    -- 'P-07-cycle-time'
  stage_id           text not null references stages(id),
  objective_id       text references objectives(id),
  type               item_type   not null,
  status             item_status not null default 'draft',
  version            int  not null default 1,
  bloom              text not null default 'understand'
                     check (bloom in ('remember','understand','apply','analyze')),
  target_difficulty  numeric(3,2) default 0.60
                     check (target_difficulty between 0 and 1),   -- V-23

  stem_template      text not null,                    -- may contain {var} slots
  params_schema      jsonb,                            -- P only: {"f":{"range":[66,4200],"step":1,"unit":"MHz"}}
  solver_ref         text,                             -- P only: registry key of the solve fn
  solver_version     text,                             -- P only: pins the solver behind engine_version
  tolerance          numeric,                          -- P only: numeric answer tolerance
  correct_spec       jsonb not null,                   -- S: {"value":"An assembler"} | G: {"order":[...]}
  distractor_pool    jsonb not null default '[]',      -- S: array | P: registry key of generator
  rationale_template text,

  author_id          uuid references auth.users(id),
  reviewed_by        uuid references auth.users(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (family_id, version)
);
create index on items (stage_id, status);
create index on items (family_id);
create index on items (objective_id, status);
-- V-24: a slug is the human identity of an item. It must actually identify one.
create unique index items_slug_version_key on items (slug, version);

create table item_stats (
  item_id         uuid primary key references items(id) on delete cascade,
  n_exposures     int   not null default 0 check (n_exposures >= 0),
  n_correct       int   not null default 0 check (n_correct >= 0),
  p_value         numeric(4,3) check (p_value between 0 and 1),          -- V-23
  discrimination  numeric(4,3) check (discrimination between -1 and 1),  -- V-23
  distractor_hist jsonb not null default '{}',
  variant_drift   jsonb not null default '{}',   -- P only: p-value bucketed by param range
  flagged         boolean not null default false,
  flag_reason     text,
  updated_at      timestamptz not null default now()
);

-- ---------- assessments -------------------------------------
create table blueprints (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  scope        text not null check (scope in ('stage','final')),
  stage_id     text references stages(id),
  total_items  int  not null check (total_items > 0),
  constraints  jsonb not null,                   -- by_act / by_bloom / by_type / max_per_objective
  created_at   timestamptz not null default now()
);

create table assessments (
  id               uuid primary key default gen_random_uuid(),
  blueprint_id     uuid not null references blueprints(id),
  section_id       uuid references sections(id),
  title            text not null,
  opens_at         timestamptz,
  closes_at        timestamptz,
  attempts_allowed int not null default 1 check (attempts_allowed > 0),
  created_at       timestamptz not null default now()
);

-- V-15: the exam salt is the seed material for every paper. It does NOT live in a
-- table students can read. This table has RLS enabled and NO POLICY, which means
-- service_role only -- that is the entire point. Do not add a policy here.
create table assessment_secrets (
  assessment_id uuid primary key references assessments(id) on delete cascade,
  exam_salt     text not null default encode(gen_random_bytes(32),'hex'),
  rotated_at    timestamptz not null default now()
);

create table attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null references assessments(id),
  attempt_no    int  not null default 1 check (attempt_no > 0),
  seed          text not null,                   -- sha256(student_id||stage||attempt_no||exam_salt)
  engine_version text not null default '1.0.0',  -- pins the solver registry; never regenerate without it
  status        attempt_status not null default 'in_progress',
  score         numeric(6,2),
  max_score     numeric(6,2),
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  unique (user_id, assessment_id, attempt_no)
);
create index on attempts (user_id, status);

-- The resolved paper. correct_value is the answer key: RLS-denied until submit.
create table attempt_items (
  attempt_id       uuid not null references attempts(id) on delete cascade,
  ordinal          int  not null,
  item_id          uuid not null references items(id),   -- V-3: points at the exact version row
  resolved_params  jsonb not null default '{}',  -- P: the student's actual numbers
  resolved_options jsonb not null default '[]',  -- shuffled options as shown
  correct_value    jsonb not null,
  points           numeric(5,2) not null default 1,
  primary key (attempt_id, ordinal)
);

create table responses (
  attempt_id  uuid not null references attempts(id) on delete cascade,
  ordinal     int  not null,
  raw_answer  jsonb not null,
  is_correct  boolean not null,
  points      numeric(5,2) not null default 0,
  time_ms     int,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, ordinal)
);
-- append-only: see trigger below.
-- NOTE: there is deliberately NO client INSERT policy. `responses` and `attempt_items` are
-- written only by the grading service under service_role. A student-side insert succeeding
-- is a CRITICAL finding, not a missing feature. (V-4)

-- ---------- progress & gating -------------------------------
create table stage_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  stage_id     text not null references stages(id),
  mastery      numeric(4,3) not null default 0 check (mastery between 0 and 1),  -- V-23
  best_score   numeric(6,2),
  attempts     int not null default 0 check (attempts >= 0),
  last_seen_at timestamptz,
  primary key (user_id, stage_id)
);

-- Derived, never written directly: recompute from stage_progress + objectives(level,competency).
create table level_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  level       int  not null check (level between 0 and 6),
  competency  text not null check (competency in ('read','trace','build')),
  mastery     numeric(4,3) not null default 0 check (mastery between 0 and 1),  -- V-23
  attained_at timestamptz,
  primary key (user_id, level, competency)
);

-- V-17: scope targets are typed and foreign-keyed. `scope_id text` could hold a
-- section uuid, a user uuid, or a typo, and nothing could tell the difference.
create table stage_locks (
  id               uuid primary key default gen_random_uuid(),
  scope            lock_scope not null,
  scope_user_id    uuid references auth.users(id) on delete cascade,
  scope_section_id uuid references sections(id)   on delete cascade,
  stage_id         text not null references stages(id),
  state            lock_state not null default 'auto',
  unlock_at        timestamptz,
  lock_at          timestamptz,
  reason           text,
  actor_id         uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  constraint scope_target_valid check (
    (scope = 'global'  and scope_user_id is null     and scope_section_id is null) or
    (scope = 'section' and scope_user_id is null     and scope_section_id is not null) or
    (scope = 'user'    and scope_user_id is not null and scope_section_id is null)
  ),
  constraint lock_window_ordered check (
    unlock_at is null or lock_at is null or lock_at > unlock_at
  )
);
-- V-17: three partial indexes, each matching exactly one branch of is_stage_unlocked().
-- The old expression index on coalesce(scope_id,'') could not serve any of them.
create unique index stage_locks_user_key    on stage_locks (stage_id, scope_user_id)    where scope = 'user';
create unique index stage_locks_section_key on stage_locks (stage_id, scope_section_id) where scope = 'section';
create unique index stage_locks_global_key  on stage_locks (stage_id)                   where scope = 'global';

create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id),
  action      text not null,
  target_type text,
  target_id   text,
  payload     jsonb not null default '{}',
  at          timestamptz not null default now()
);
create index on audit_log (at desc);
create index on audit_log (target_type, target_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- V-25: an unknown or malformed role claim maps to LEAST PRIVILEGE and never raises.
-- The previous version cast the claim straight to the enum; a typo in app_metadata
-- therefore raised inside every policy that calls is_staff(), locking that user out
-- of every table in the database with an error naming an enum rather than a token.
-- NOTE the nullif(): a custom GUC that was `set local` and then rolled back
-- reverts to the EMPTY STRING, not NULL. Casting '' to jsonb raises
-- "invalid input syntax for type json" -- inside every policy that calls
-- is_staff(), on any pooled connection that previously served a request.
-- Found by running the suite, not by reading the code.
create or replace function jwt_role() returns user_role
language sql stable as $$
  select case nullif(current_setting('request.jwt.claims', true), '')::jsonb
              -> 'app_metadata' ->> 'role'
    when 'admin'   then 'admin'::user_role
    when 'teacher' then 'teacher'::user_role
    else 'student'::user_role
  end
$$;

-- D4: in this deployment the instructor IS the administrator. `teacher` and `admin`
-- are intentionally equivalent, and is_staff() is the authorisation predicate
-- everywhere. `teacher` is retained in the enum for a future teaching assistant who
-- would get a genuinely narrower tier; until that exists, do not add is_admin()
-- checks that the instructor's own account would fail.
create or replace function is_staff() returns boolean
language sql stable as $$ select jwt_role() in ('teacher','admin') $$;

-- The single authority on stage access.
-- Resolution order: user override -> section override -> global override -> curriculum prereq.
-- V-16: every branch honours BOTH unlock_at (when it opens) and lock_at (when it shuts).
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

  -- 4. curriculum policy: all prerequisites at >= 70% mastery
  select prereq into v_prereq from stages where id = p_stage;
  if v_prereq is null or array_length(v_prereq,1) is null then return true; end if;

  select bool_and(coalesce(sp.mastery,0) >= 0.70) into v_ok
  from unnest(v_prereq) req(stage_id)
  left join stage_progress sp on sp.user_id = p_user and sp.stage_id = req.stage_id;

  return coalesce(v_ok, false);
end $$;

-- Is this attempt one whose verdict must be withheld until submit?
-- SECURITY DEFINER on purpose: RLS applies inside a policy's own subqueries, and
-- `blueprints` is staff-only. A student's policy joining to it would match zero
-- rows and deny everything, including the practice verdicts that are supposed to
-- be immediate. Found by running the suite.
create or replace function attempt_withholds_verdict(p_attempt uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(bool_or(b.scope = 'final' and a.status <> 'submitted'), false)
  from attempts a
  join assessments s on s.id = a.assessment_id
  join blueprints  b on b.id = s.blueprint_id
  where a.id = p_attempt
$$;

-- V-2 / V-21: role escalation is blocked mechanically. The guard is an explicit
-- application signal, not the connection's identity -- `current_setting('role')` is
-- 'service_role' under PostgREST but 'none' over a direct pg connection, which made
-- the old guard depend on which client library the admin API happened to use.
create or replace function block_role_change() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('app.allow_role_change', true), 'off') <> 'on' then
    raise exception 'role changes must go through the admin API'
      using hint = 'set local app.allow_role_change = ''on'' inside the admin transaction';
  end if;
  return new;
end $$;

create trigger profiles_no_self_promote
  before update on profiles for each row
  execute function block_role_change();

-- responses are append-only.
-- V-20: this also blocks the ON DELETE CASCADE from auth.users, which is why
-- profiles.deleted_at exists and why auth users are never hard-deleted.
create or replace function deny_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'responses are append-only'
    using hint = 'void the attempt instead; auth users are soft-deleted via profiles.deleted_at';
end $$;

create trigger responses_no_update before update on responses
  for each row execute function deny_mutation();
create trigger responses_no_delete before delete on responses
  for each row execute function deny_mutation();

-- ============================================================
-- ROW LEVEL SECURITY
-- Every policy below carries an explicit TO clause. A policy with no TO clause
-- defaults to TO public, which includes `anon` -- that is an unreviewed decision,
-- and V-15 found it granting anonymous reads of exam_salt.
-- ============================================================
alter table profiles           enable row level security;
alter table student_directory  enable row level security;
alter table sections           enable row level security;
alter table stages             enable row level security;
alter table objectives         enable row level security;
alter table content_blocks     enable row level security;
alter table items              enable row level security;
alter table item_stats         enable row level security;
alter table blueprints         enable row level security;
alter table assessments        enable row level security;
alter table assessment_secrets enable row level security;   -- no policy: service_role only
alter table attempts           enable row level security;
alter table attempt_items      enable row level security;
alter table responses          enable row level security;
alter table stage_progress     enable row level security;
alter table level_progress     enable row level security;
alter table stage_locks        enable row level security;
alter table audit_log          enable row level security;

-- profiles: read own, staff read all, nobody self-promotes (trigger), soft-deleted are out
create policy p_self   on profiles for select to authenticated
  using ((id = auth.uid() and deleted_at is null) or is_staff());
create policy p_update on profiles for update to authenticated
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid());
create policy p_staff  on profiles for all to authenticated
  using (is_staff()) with check (is_staff());

-- roster & sections: staff only (registration goes through the service role API)
create policy sd_staff on student_directory for all to authenticated
  using (is_staff()) with check (is_staff());
-- V-15: was `using (true)` with no TO clause, so anon could enumerate sections.
create policy sec_read  on sections for select to authenticated using (true);
create policy sec_staff on sections for all to authenticated
  using (is_staff()) with check (is_staff());

-- curriculum: readable when published; content gated by the lock function
create policy st_read  on stages for select to authenticated
  using (published or is_staff());
create policy st_staff on stages for all to authenticated
  using (is_staff()) with check (is_staff());
-- V-15: was `using (true)` with no TO clause -- anon could read the objectives of
-- unpublished stages, which is a table of contents for unreleased material.
create policy ob_read  on objectives for select to authenticated using (
  is_staff() or exists (
    select 1 from stages s where s.id = objectives.stage_id and s.published
  )
);
create policy ob_staff on objectives for all to authenticated
  using (is_staff()) with check (is_staff());
-- V-7: unlocked is not the same as published. Both are required.
create policy cb_read  on content_blocks for select to authenticated using (
  is_staff() or (
    exists (select 1 from stages s where s.id = content_blocks.stage_id and s.published)
    and is_stage_unlocked(auth.uid(), stage_id)
  )
);
create policy cb_staff on content_blocks for all to authenticated
  using (is_staff()) with check (is_staff());

-- ITEM BANK: staff only. Students never read `items` directly -- the API
-- serves them a stripped paper. This is the fix for shipping the answer key.
create policy it_staff  on items      for all to authenticated
  using (is_staff()) with check (is_staff());
create policy ist_read  on item_stats for all to authenticated
  using (is_staff()) with check (is_staff());
create policy bp_staff  on blueprints for all to authenticated
  using (is_staff()) with check (is_staff());

-- V-15: `section_id is null` used to match every user including anon. A global
-- assessment is still readable by any authenticated student -- but exam_salt is no
-- longer in this table, so the row carries nothing secret.
create policy as_read  on assessments for select to authenticated using (
  is_staff() or section_id is null
  or section_id = (select section_id from profiles where id = auth.uid())
);
create policy as_staff on assessments for all to authenticated
  using (is_staff()) with check (is_staff());

-- assessment_secrets: service_role only. The policy below grants NOTHING to any
-- client role -- `using (false)` never matches a row. It exists so the intent is
-- written down rather than inferred from an absence, and so INV-02 ("every
-- RLS-enabled table has at least one policy") stays strict instead of growing an
-- allowlist. service_role bypasses RLS entirely and is unaffected.
create policy asec_deny_all on assessment_secrets for all to authenticated
  using (false) with check (false);

-- attempts: own rows only. `seed` is additionally revoked at COLUMN level below --
-- RLS controls rows, GRANT controls columns, and the seed is a column problem.
create policy at_own   on attempts for select to authenticated
  using (user_id = auth.uid() or is_staff());
create policy at_staff on attempts for all to authenticated
  using (is_staff()) with check (is_staff());

-- ANSWER KEY GATE: students see attempt_items only after submitting.
create policy ai_after_submit on attempt_items for select to authenticated using (
  is_staff() or exists (
    select 1 from attempts a
    where a.id = attempt_items.attempt_id
      and a.user_id = auth.uid()
      and a.status = 'submitted'
  )
);

-- V-22: immediate per-item verdicts are intentional for practice and drilling.
-- For a `final`-scope assessment the verdict is withheld until submit, so the
-- running score of a Power-On Self Test is not queryable mid-exam.
create policy rs_own on responses for select to authenticated using (
  is_staff() or (
    exists (
      select 1 from attempts a
      where a.id = responses.attempt_id and a.user_id = auth.uid()
    )
    and not attempt_withholds_verdict(responses.attempt_id)
  )
);

create policy sp_own   on stage_progress for select to authenticated
  using (user_id = auth.uid() or is_staff());
create policy sp_staff on stage_progress for all to authenticated
  using (is_staff()) with check (is_staff());

create policy lp_own   on level_progress for select to authenticated
  using (user_id = auth.uid() or is_staff());
create policy lp_staff on level_progress for all to authenticated
  using (is_staff()) with check (is_staff());

create policy sl_read  on stage_locks for select to authenticated using (is_staff());
create policy sl_staff on stage_locks for all to authenticated
  using (is_staff()) with check (is_staff());

create policy al_staff on audit_log for select to authenticated using (is_staff());

-- ============================================================
-- COLUMN PRIVILEGES
-- V-15: RLS cannot express "this row, but not this column". GRANT can.
-- The seed regenerates a student's entire paper. They may read their attempt row;
-- they may not read the seed that produced it.
-- ============================================================
-- Column privileges in Postgres are ADDITIVE to table privileges: revoking
-- SELECT on a column while table-level SELECT is still granted has NO EFFECT.
-- The table grant has to go, and the readable columns are then granted back by
-- name. Adding a column to `attempts` later therefore makes it unreadable to
-- students by default, which is the right direction for that mistake to fall.
revoke select on attempts from authenticated;
grant select (
  id, user_id, assessment_id, attempt_no, status, score, max_score,
  started_at, submitted_at
) on attempts to authenticated;
revoke all on assessment_secrets from authenticated, anon;

-- Nothing in the public schema is readable by an unauthenticated visitor.
-- Every policy above is TO authenticated; this makes the intent explicit and
-- survives someone adding a policy without a TO clause later.
revoke all on all tables in schema public from anon;

-- ============================================================
-- SEED — CPE 412: Computer Architecture and Organization
--
-- Stage 00 (orientation) plus the SEVENTEEN CHAPTERS of the syllabus, in order.
-- Source: `docs/source/CPE 412.docx.pdf`, section VII Teaching and Learning Plan.
-- Textbook: Stallings, Computer Organization and Architecture, 9th ed.
--
-- ACT == GRADING PERIOD. The syllabus has four major examinations, so the four
-- acts are Prelim / Midterm / Semi-finals / Finals rather than a narrative arc:
--   act 1 Prelim      chapters 1-4
--   act 2 Midterm     chapters 5-8
--   act 3 Semi-finals chapters 9-12
--   act 4 Finals      chapters 13-17
--
-- PREREQ is the curriculum, and it is LINEAR.
--
-- Confirmed by the instructor: "I teach based on the order of the syllabus
-- topics and go down the line." An earlier draft branched the graph on the
-- intellectual dependencies between chapters (arithmetic is self-contained, I/O
-- needs interconnection but not the memory chain, and so on). That was a
-- defensible reading of the MATERIAL and the wrong reading of the COURSE.
--
-- `stages.prereq` gates real students. It must model how the course is actually
-- delivered, not how the subject could be decomposed. A student who is at
-- chapter 6 in class must not find chapter 6 locked because the graph decided
-- they needed chapter 9 first.
--
-- So: each chapter requires the one before it. One edge per stage, 18 edges,
-- one chain, no forks and no joins. The teacher still opens any node early from
-- the lock matrix, which is where flexibility belongs -- in a human decision
-- with a reason and an audit entry, not in a graph nobody can see.
--
-- est_minutes is PLATFORM time, not the syllabus's contact hours. The syllabus
-- allots 3 hrs of lecture+lab per chapter; these are estimates of time spent in
-- OCTA itself, which is a companion to that, not a replacement for it.
-- ============================================================
-- ACT == GRADING PERIOD, and the ranges are the instructor's (2 Sep 2026):
--   Act 1 Prelim      chapters 1-4    stages 00-04  (00 is orientation, not graded)
--   Act 2 Midterm     chapters 5-8    stages 05-08
--   Act 3 Semi-finals chapters 9-12   stages 09-12
--   Act 4 Finals      chapters 13-17  stages 13-18
--
-- This CORRECTS a one-stage drift. The seed previously grouped 00-05 / 06-09 /
-- 10-13 / 14-18, which put chapter 5 in the Prelim, chapter 9 in the Midterm
-- and chapter 13 in the Semi-finals. Because the blueprints below scope by
-- `by_act`, that drift was not cosmetic: every one of the four examinations
-- sampled one chapter beyond its own grading period. `DESIGN-REVIEW-01` D-3.
--
-- CHAPTER 18 IS IN THE FINALS. Confirmed by the instructor 2 Sep 2026, closing
-- the one edge the ranges left open: "Finals 13-17" reads as 13-18 in practice,
-- because chapter 18 is published, gradeable, and has no other period to sit in.
-- The Final Examination is cumulative, so it is examined there either way.
insert into stages (id, act, ordinal, title, est_minutes, prereq, published, gradeable, archetype, levels) values
 ('00',1, 0,'Orientation',                                         20, '{}',      true, false, 'A', '{6}'),
 ('01',1, 1,'Introduction',                                40, '{00}',    true, true,  'A', '{0,1,2,3,4,5,6}'),
 ('02',1, 2,'Computer Evolution and Performance',          75, '{01}',    true, true,  'B', '{6,2}'),
 ('03',1, 3,'Top Level View and Interconnection',          70, '{02}',    true, true,  'D', '{2,1}'),
 ('04',1, 4,'Cache Memory',                                80, '{03}',    true, true,  'B', '{3,2}'),
 ('05',2, 5,'Internal Memory',                             60, '{04}',    true, true,  'C', '{1,0}'),
 ('06',2, 6,'External Memory',                             55, '{05}',    true, true,  'C', '{3}'),
 ('07',2, 7,'Input/Output',                                70, '{06}',    true, true,  'D', '{3,1}'),
 ('08',2, 8,'Operating System Support',                    70, '{07}',    true, true,  'D', '{3}'),
 ('09',3, 9,'Computer Arithmetic',                         90, '{08}',    true, true,  'B', '{2,0}'),
 ('10',3,10,'Instruction Sets: Characteristics',           60, '{09}',    true, true,  'C', '{2}'),
 ('11',3,11,'Instruction Sets: Addressing and Formats',    65, '{10}',    true, true,  'D', '{2}'),
 ('12',3,12,'Processor Structure and Function',            80, '{11}',    true, true,  'D', '{1}'),
 ('13',4,13,'Reduced Instruction Set Computers',           60, '{12}',    true, true,  'A', '{2,1}'),
 ('14',4,14,'Instruction Level Parallelism',               70, '{13}',    true, true,  'D', '{1}'),
 ('15',4,15,'Control Unit Operation',                      75, '{14}',    true, true,  'D', '{1}'),
 ('16',4,16,'Microprogrammed Control',                     65, '{15}',    true, true,  'D', '{1}'),
 ('17',4,17,'Multicore Computers',                         60, '{16}',    true, true,  'B', '{1,0}'),
 ('18',4,18,'Distributed Systems Architecture',            60, '{17}',    true, true,  'A', '{6,3}');

insert into blueprints (name, scope, total_items, constraints) values
 -- The syllabus has FOUR major examinations at 30% combined, not one final.
 -- by_act doubles as by_period because act == grading period in this seed.
 -- Prelim, Midterm and Semi-final each cover their own period. The FINALS is
 -- cumulative -- see the note on it below.
 ('Prelim Examination',      'final', 40, '{
    "by_act":   {"1":40},
    "by_bloom": {"remember":8,"understand":12,"apply":14,"analyze":6},
    "by_type":  {"S":22,"P":13,"G":5},
    "max_per_objective": 3,
    "exclude_non_gradeable_stages": true,
    "difficulty_target": 0.62
  }'::jsonb),
 ('Midterm Examination',     'final', 40, '{
    "by_act":   {"2":40},
    "by_bloom": {"remember":8,"understand":12,"apply":14,"analyze":6},
    "by_type":  {"S":22,"P":13,"G":5},
    "max_per_objective": 3,
    "exclude_non_gradeable_stages": true,
    "difficulty_target": 0.62
  }'::jsonb),
 ('Semi-final Examination',  'final', 40, '{
    "by_act":   {"3":40},
    "by_bloom": {"remember":8,"understand":12,"apply":14,"analyze":6},
    "by_type":  {"S":22,"P":13,"G":5},
    "max_per_objective": 3,
    "exclude_non_gradeable_stages": true,
    "difficulty_target": 0.62
  }'::jsonb),
 -- THE FINALS IS CUMULATIVE. Confirmed by the instructor: it covers the whole
 -- course, not only the Finals period. The other three examinations remain
 -- scoped to their own grading period.
 --
 -- The weighting is NOT even. 8/8/10/24 across the four acts puts almost half
 -- the paper on Act 4, which is the material examined nowhere else -- chapters
 -- 14-18 have no later exam to appear in. Sampling all eighteen chapters evenly
 -- would mean the Finals tested the Prelim material a third time and the
 -- control unit once.
 ('Final Examination',       'final', 50, '{
    "by_act":   {"1":8,"2":8,"3":10,"4":24},
    "by_bloom": {"remember":10,"understand":15,"apply":18,"analyze":7},
    "by_type":  {"S":27,"P":16,"G":7},
    "max_per_objective": 3,
    "exclude_non_gradeable_stages": true,
    "difficulty_target": 0.62
  }'::jsonb);
