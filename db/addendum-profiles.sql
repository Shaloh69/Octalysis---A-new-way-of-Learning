-- OCTA -- profile pictures (PROFILES; docs/PROFILES-PLAN.md, approved 7 Oct 2026,
-- night).
--
-- Applied SEVENTEENTH, after addendum-studio-moons.sql. Idempotent; on a live
-- Supabase project on its own:
--     pnpm db:push --file db/addendum-profiles.sql
--
-- The rulings (instructor, 7 Oct 2026, night; this REVERSES DESIGN-MANDATE.md
-- section 4, which said never to ask for a profile picture):
--   1. Students (apps/web), teachers and the admin (apps/console) have a
--      profile page with a picture.
--   2. Classmates and teachers see an uploaded picture.
--   3. It is shown at once and is removable: any teacher of that student, or
--      the admin, can remove one, and every removal is audited.
--
-- What this file holds:
--   * Three columns on `profiles`: the picture's path in the private
--     `profile-images` bucket, when it was set, and when a teacher or the admin
--     removed it (so the student is told: "Your picture was removed by your
--     teacher").
--   * A trigger that refuses a change to any of the three unless the API's
--     transaction says it is the API's change (`app.allow_avatar_change`), for
--     EVERY role, service_role included. `profiles` lets a student update their
--     own row (accent, theme) and lets staff write all of it, so a policy alone
--     could not say "not these columns"; the guard, like `block_role_change`
--     (V-2, V-21), keys on an application signal and not on the connection's
--     identity.
--   * `can_see_avatar(viewer, subject)` and `can_remove_avatar(actor, subject)`,
--     the two questions the API asks. Callable by the API's connection only: a
--     function that takes the viewer as an argument would let a student map who
--     shares a section with whom.
--   * The private bucket. No client policy on storage.objects: the API signs
--     every upload (to a path it chooses) and every short-lived download, so a
--     picture is never a public URL.
--
-- Column privileges (V-29, decided on purpose): `authenticated` keeps its
-- table-level grants on `profiles`. A student reads only their own row (p_self),
-- staff read all (p_staff), so the path is no secret between those who can read
-- it, and a classmate's path is unreachable through RLS. What a client may NOT
-- do is write the three columns, and the trigger below is what says so.

alter table profiles add column if not exists avatar_path       text;
alter table profiles add column if not exists avatar_updated_at timestamptz;
alter table profiles add column if not exists avatar_removed_at timestamptz;

-- The path names its owner and its type, so a row can never point at another
-- user's folder (or at "../"), and a picture and its time go together.
alter table profiles drop constraint if exists profiles_avatar_shape;
alter table profiles add constraint profiles_avatar_shape check (
  (avatar_path is null) = (avatar_updated_at is null)
  and (avatar_path is null
       or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.webp$'))
);

-- ---------- the guard, for every role ----------
create or replace function profiles_avatar_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(nullif(current_setting('app.allow_avatar_change', true), ''), 'off') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.avatar_path is null and new.avatar_updated_at is null and new.avatar_removed_at is null then
      return new;
    end if;
  elsif (new.avatar_path, new.avatar_updated_at, new.avatar_removed_at)
        is not distinct from (old.avatar_path, old.avatar_updated_at, old.avatar_removed_at) then
    return new;
  end if;
  raise exception 'profile pictures are written by the API only'
    using errcode = '42501',
          hint = 'set local app.allow_avatar_change = ''on'' inside the API transaction that signs and records a picture';
end $$;

drop trigger if exists profiles_avatar_guard on profiles;
create trigger profiles_avatar_guard
  before insert or update on profiles
  for each row execute function profiles_avatar_guard();

-- ---------- who may see a picture, who may remove one ----------
-- Security definer: a policy's subquery is subject to RLS and a student cannot
-- read a classmate's profile row (db/CLAUDE.md, V-30).
--
-- A picture is seen by its owner; by a classmate (the same section, as the class
-- chat counts one); by any teacher or the admin; and a teacher's or the admin's
-- by any signed-in student (they are in the chat with them, and a student who
-- cannot tell who is speaking is no safer). A deleted account sees nothing and is
-- seen by nobody.
create or replace function can_see_avatar(p_viewer uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from profiles v
      join profiles s on s.id = p_subject and s.deleted_at is null
     where v.id = p_viewer and v.deleted_at is null
       and (v.id = s.id
            or v.role in ('teacher', 'admin')
            or s.role in ('teacher', 'admin')
            or (v.section_id is not null and v.section_id = s.section_id)))
$$;

-- May p_actor REMOVE p_subject's picture as a moderator? The admin, anyone's;
-- a teacher, a student's. Not one's own (a person removes their own through
-- their profile page, which is not a moderation and is not audited as one).
-- UNTIL T2 (a teacher's console scoped to their classes, TEACHERS-AND-SUBJECTS-
-- PLAN.md) "a teacher of that student" is any teacher; T2 narrows it here, in
-- this one function, and adds the matching denial test.
create or replace function can_remove_avatar(p_actor uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from profiles a
      join profiles s on s.id = p_subject and s.deleted_at is null
     where a.id = p_actor and a.deleted_at is null and a.id <> s.id
       and (a.role = 'admin' or (a.role = 'teacher' and s.role = 'student')))
$$;

revoke execute on function can_see_avatar(uuid, uuid)    from public, anon, authenticated;
revoke execute on function can_remove_avatar(uuid, uuid) from public, anon, authenticated;
grant  execute on function can_see_avatar(uuid, uuid)    to service_role;
grant  execute on function can_remove_avatar(uuid, uuid) to service_role;

-- ---------- the private bucket ----------
-- Supabase's storage schema; absent on the local stack, where pictures are
-- switched off and the page says so. 300 KB and WebP only (the browser crops to
-- a square and re-encodes to 512 x 512 WebP, which drops EXIF, GPS included);
-- the bucket refuses anything bigger or of another type, whoever signed the
-- upload. No policy on storage.objects for this bucket: with RLS on and no
-- policy, only service_role (the API) reaches it.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('profile-images', 'profile-images', false, 307200, array['image/webp'])
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
