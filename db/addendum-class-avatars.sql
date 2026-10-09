-- OCTA -- T2: a picture follows the class (docs/PROFILES-PLAN.md section 5b; docs/TEACHERS-AND-
-- SUBJECTS-PLAN.md section 5.4, ruled 9 Oct 2026).
--
-- Applied TWENTY-FIRST, after addendum-class-scope.sql. Idempotent; on a live Supabase project on
-- its own:
--     pnpm db:push --file db/addendum-class-avatars.sql
--
-- PROFILES left two questions open "until T2", each in ONE function:
--   * can_remove_avatar(): "a teacher of that student" was any teacher.
--   * can_see_avatar():    any teacher or the admin saw any student's picture.
-- Both now ask the class, as everything else a teacher does (addendum-class-scope.sql).
--
--   REMOVE  a student's picture: the teacher of a class the student is in and that has NOT ended;
--           the admin, anyone's (the moderation exception, audited with a reason by the API);
--           never one's own (a person removes their own through their profile page).
--   SEE     a student's picture: its owner; a classmate (the same section, as the class chat counts
--           one); the teacher of a class they read, ended or not; the admin. A teacher's or the
--           admin's picture by every signed-in student (they are in the chat with them).
--
-- Both stay executable by the API's connection only: they take the viewer as an argument, and a
-- client able to call them could map who teaches whom (addendum-profiles.sql).

create or replace function can_see_avatar(p_viewer uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from profiles v
      join profiles s on s.id = p_subject and s.deleted_at is null
     where v.id = p_viewer and v.deleted_at is null
       and (v.id = s.id
            or s.role in ('teacher', 'admin')
            or v.role = 'admin'
            or (v.role = 'teacher' and exists (
                  select 1 from classes c where c.teacher_id = v.id and c.section_id = s.section_id))
            or (v.section_id is not null and v.section_id = s.section_id)))
$$;

create or replace function can_remove_avatar(p_actor uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from profiles a
      join profiles s on s.id = p_subject and s.deleted_at is null
     where a.id = p_actor and a.deleted_at is null and a.id <> s.id
       and (a.role = 'admin'
            or (a.role = 'teacher' and s.role = 'student' and exists (
                  select 1 from classes c
                   where c.teacher_id = a.id and c.section_id = s.section_id and c.ended_at is null))))
$$;

revoke execute on function can_see_avatar(uuid, uuid)    from public, anon, authenticated;
revoke execute on function can_remove_avatar(uuid, uuid) from public, anon, authenticated;
grant  execute on function can_see_avatar(uuid, uuid)    to service_role;
grant  execute on function can_remove_avatar(uuid, uuid) to service_role;
