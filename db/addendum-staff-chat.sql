-- OCTA -- T2: teachers talk to one another, and see who is active (docs/TEACHERS-AND-SUBJECTS-PLAN.md
-- section 5.7, ruled 9 Oct 2026: "teachers can communicate with one another and see who is active as of the
-- moment in the chat page").
--
-- Applied TWENTY-SECOND, after addendum-class-avatars.sql. Idempotent; on a live Supabase project on its own:
--     pnpm db:push --file db/addendum-staff-chat.sql
--
--   kind 'staff'         ONE room for every teacher and the admin: the staff room.
--   kind 'staff_direct'  a private thread between TWO staff accounts. Readable by those two and by NOBODY
--                        else, the admin included (the admin reads every STUDENT room, as before; a
--                        conversation between two teachers is theirs).
--   profiles.last_seen_at  when a staff account last had the chat open. "Active" is seen within two minutes.
--                          Staff about staff only: a student's profile row is unreadable to everyone but
--                          the student and their teachers, and the API never puts a time on a student, and
--                          never shows one to a student.
--
-- Who may read and post (chat_belongs / chat_may_post, redefined here):
--   staff room        every teacher and the admin, read and post
--   staff_direct      its two members, read and post
--   section, direct   as addendum-class-scope.sql
-- A student belongs to neither new kind, and the paper rule does not touch staff.

-- ---------- the room kinds ----------
alter table chat_rooms drop constraint if exists chat_rooms_kind_check;
alter table chat_rooms add constraint chat_rooms_kind_check
  check (kind in ('section', 'direct', 'staff', 'staff_direct'));

alter table chat_rooms add column if not exists member_a uuid references auth.users(id) on delete cascade;
alter table chat_rooms add column if not exists member_b uuid references auth.users(id) on delete cascade;

alter table chat_rooms drop constraint if exists chat_room_shape;
alter table chat_rooms add constraint chat_room_shape check (
     (kind = 'section'      and section_id is not null and student_id is null and member_a is null and member_b is null)
  or (kind = 'direct'       and student_id is not null and section_id is null and member_a is null and member_b is null)
  or (kind = 'staff'        and section_id is null and student_id is null and member_a is null and member_b is null)
  -- an ordered pair, so (a, b) and (b, a) are one room
  or (kind = 'staff_direct' and section_id is null and student_id is null
        and member_a is not null and member_b is not null and member_a < member_b));

create unique index if not exists chat_rooms_one_staff_room on chat_rooms ((true)) where kind = 'staff';
create unique index if not exists chat_rooms_one_staff_pair on chat_rooms (member_a, member_b) where kind = 'staff_direct';

-- ---------- presence ----------
alter table profiles add column if not exists last_seen_at timestamptz;

-- ---------- who belongs, who may post ----------
-- READ. The admin reads every student room; the staff room is every staff account's; a staff thread is its
-- two members' alone.
create or replace function chat_belongs(p_user uuid, p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from chat_rooms r
      join profiles p on p.id = p_user and p.deleted_at is null
     where r.id = p_room
       and (
            (r.kind = 'staff'        and p.role in ('teacher', 'admin'))
         or (r.kind = 'staff_direct' and p_user in (r.member_a, r.member_b) and p.role in ('teacher', 'admin'))
         or (r.kind in ('section', 'direct') and (
               p.role = 'admin'
            or (p.role = 'teacher' and (
                  (r.kind = 'section' and exists (
                     select 1 from classes c where c.section_id = r.section_id and c.teacher_id = p_user))
               or (r.kind = 'direct' and exists (
                     select 1 from profiles s join classes c on c.section_id = s.section_id and c.teacher_id = p_user
                      where s.id = r.student_id))))
            or (r.kind = 'section' and r.section_id = p.section_id)
            or (r.kind = 'direct' and r.student_id = p_user)))))
$$;

-- POST. A student as they read; in the staff rooms every member posts; in a class room only a teacher whose
-- class is running (the admin reads every class room and posts in their own).
create or replace function chat_may_post(p_user uuid, p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select chat_member(p_user, p_room) and (
    not exists (select 1 from profiles where id = p_user and role in ('teacher', 'admin'))
    or exists (
      select 1 from chat_rooms r
       where r.id = p_room
         and (r.kind in ('staff', 'staff_direct')
           or (r.kind = 'section' and exists (
                 select 1 from classes c
                  where c.section_id = r.section_id and c.teacher_id = p_user and c.ended_at is null))
           or (r.kind = 'direct' and exists (
                 select 1 from profiles s join classes c on c.section_id = s.section_id
                  where s.id = r.student_id and c.teacher_id = p_user and c.ended_at is null)))))
$$;
