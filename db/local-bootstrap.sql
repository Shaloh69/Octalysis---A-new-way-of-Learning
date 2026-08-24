-- ============================================================
-- OCTA — local bootstrap
-- Applied FIRST, and ONLY against the local Docker Postgres.
-- Never run this against a Supabase project: Supabase already provides the
-- auth schema, the three roles, and auth.uid(). Running it there would shadow
-- the real ones and every RLS test would become a lie.
--
-- Purpose: make `db/schema.sql` apply unchanged to plain Postgres, so the RLS
-- denial tests exercise the SAME policies that ship to production.
-- ============================================================

-- ---------- the three Supabase roles ------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- BYPASSRLS is what makes service_role the grading service's identity.
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants table privileges by default; reproduce that so the tests are
-- exercising RLS rather than a missing GRANT. schema.sql then revokes what it
-- must -- including attempts.seed and everything from anon.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- ---------- the auth schema shim ----------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Minimal stand-in for auth.users. Only the columns our FKs reference.
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  raw_app_meta_data jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- auth.uid() -- the identity every RLS policy is written against.
-- PostgREST sets request.jwt.claims per request; our test harness sets the same
-- GUC with `set local`, which is why the tests are meaningful.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  )
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt()
  to anon, authenticated, service_role;

-- ---------- test convenience --------------------------------
-- Mints a local auth user with the given role in app_metadata, the way the
-- registration API would. Service-role path only; never exposed to a client.
create or replace function auth.test_create_user(p_email text, p_role text default 'student')
returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into auth.users (email, raw_app_meta_data)
  values (p_email, jsonb_build_object('role', p_role))
  returning id into v_id;
  return v_id;
end $$;
