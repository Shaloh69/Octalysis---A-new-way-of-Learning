-- OCTA -- T2: a teacher holds their own classes (docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5,
-- ruled 9 Oct 2026).
--
-- Applied TWENTIETH, after addendum-tour.sql. Idempotent; on a live Supabase project on its own:
--     pnpm db:push --file db/addendum-class-scope.sql
--
-- The rule, in one sentence: a teacher owns what they create or are given -- their sections, the
-- class on each, the locks for those classes and the students in them -- and sees nothing of another
-- teacher's. The admin is a teacher with their own classes and sees everyone else's READ-ONLY.
--
--   READ   a section's students: the actor holds a class on the section (ended or not), or is the admin
--   WRITE  a section's students: the actor holds a class on the section and it has NOT ended; the
--          admin has no write on a class they do not hold
--   A GLOBAL stage lock is written by no staff token (the admin removes a legacy one through the API)
--   A GLOBAL assessment (no section) is written by the admin alone; a section's own by its holder
--
-- Two doors. The API connects as the table owner and bypasses RLS, so it asks the same question in
-- TypeScript (`services/api/src/scope.ts`); the policies below are the backstop for a staff token used
-- against the database directly, and the denial tests (`class-scope-rls.spec.ts`) run against both.
--
-- The helpers read auth.uid() inside: a function that took the actor as an argument, callable by a
-- client, would let a teacher map who teaches whom. Security definer (db/CLAUDE.md V-30: a policy's
-- subqueries are subject to RLS, and `classes` is not readable by every role).
--
-- Not class-shaped, and unchanged: stages, objectives, content, items, blueprints, drafts, figures,
-- the invariants, `feedback` (every teacher reads it; the author's name is the API's to withhold),
-- and `sections` READ (a section is a code and a term, no secret, and the web reads its own).

-- ---------- the questions ----------
create or replace function staff_reads_section(p_section uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select is_admin() or (
    is_staff() and p_section is not null and exists (
      select 1 from classes c where c.section_id = p_section and c.teacher_id = auth.uid()))
$$;

create or replace function staff_writes_section(p_section uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select is_staff() and p_section is not null and exists (
    select 1 from classes c
     where c.section_id = p_section and c.teacher_id = auth.uid() and c.ended_at is null)
$$;

create or replace function staff_reads_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles p where p.id = p_user and staff_reads_section(p.section_id))
$$;

create or replace function staff_writes_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles p where p.id = p_user and staff_writes_section(p.section_id))
$$;

create or replace function staff_reads_attempt(p_attempt uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from attempts a where a.id = p_attempt and staff_reads_user(a.user_id))
$$;

-- An audit row is a teacher's to read when it is theirs, or names a student (or a student's
-- submission) in a class they read. The target id is text; a malformed one is simply not in scope.
create or replace function audit_target_in_scope(p_type text, p_id text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_id is null then false
    -- A roster action names the student by their student ID (21-0001), not their account.
    when p_type = 'student' and p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then exists (
      select 1 from student_directory d where d.student_id = p_id and staff_reads_section(d.section_id))
    when p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    when p_type in ('student', 'profile') then staff_reads_user(p_id::uuid)
    when p_type = 'submission' then exists (
      select 1 from submissions s where s.id = p_id::uuid and staff_reads_user(s.user_id))
    else false
  end
$$;

revoke execute on function staff_reads_section(uuid), staff_writes_section(uuid), staff_reads_user(uuid),
  staff_writes_user(uuid), staff_reads_attempt(uuid), audit_target_in_scope(text, text) from public, anon;
grant execute on function staff_reads_section(uuid), staff_writes_section(uuid), staff_reads_user(uuid),
  staff_writes_user(uuid), staff_reads_attempt(uuid), audit_target_in_scope(text, text)
  to authenticated, service_role;

-- ---------- profiles and the roster ----------
drop policy if exists p_self on profiles;
create policy p_self on profiles for select to authenticated
  using (id = auth.uid() and deleted_at is null);

-- Staff read every colleague (names in the chat) and the students of the classes they read.
drop policy if exists p_staff on profiles;
drop policy if exists p_staff_read on profiles;
create policy p_staff_read on profiles for select to authenticated
  using (is_staff() and (role <> 'student' or staff_reads_section(section_id)));
drop policy if exists p_staff_write on profiles;
create policy p_staff_write on profiles for all to authenticated
  using (role = 'student' and staff_writes_section(section_id))
  with check (role = 'student' and staff_writes_section(section_id));

drop policy if exists sd_staff on student_directory;
drop policy if exists sd_staff_read on student_directory;
create policy sd_staff_read on student_directory for select to authenticated
  using (staff_reads_section(section_id));
drop policy if exists sd_staff_write on student_directory;
create policy sd_staff_write on student_directory for all to authenticated
  using (staff_writes_section(section_id)) with check (staff_writes_section(section_id));

-- A section: anyone staff may create one (the API gives its creator the class at once); only its
-- holder changes or removes it.
drop policy if exists sec_staff on sections;
drop policy if exists sec_staff_insert on sections;
create policy sec_staff_insert on sections for insert to authenticated with check (is_staff());
drop policy if exists sec_staff_update on sections;
create policy sec_staff_update on sections for update to authenticated
  using (staff_writes_section(id)) with check (staff_writes_section(id));
drop policy if exists sec_staff_delete on sections;
create policy sec_staff_delete on sections for delete to authenticated
  using (staff_writes_section(id));

-- ---------- attempts and everything a student did on them ----------
drop policy if exists at_own on attempts;
create policy at_own on attempts for select to authenticated
  using (user_id = auth.uid() or staff_reads_user(user_id));
drop policy if exists at_staff on attempts;
create policy at_staff on attempts for all to authenticated
  using (staff_writes_user(user_id)) with check (staff_writes_user(user_id));

drop policy if exists ai_after_submit on attempt_items;
create policy ai_after_submit on attempt_items for select to authenticated using (
  staff_reads_attempt(attempt_id) or exists (
    select 1 from attempts a
     where a.id = attempt_items.attempt_id and a.user_id = auth.uid() and a.status = 'submitted'));

drop policy if exists rs_own on responses;
create policy rs_own on responses for select to authenticated using (
  staff_reads_attempt(attempt_id) or (
    exists (select 1 from attempts a where a.id = responses.attempt_id and a.user_id = auth.uid())
    and not attempt_withholds_verdict(responses.attempt_id)));

drop policy if exists ae_staff on attempt_events;
create policy ae_staff on attempt_events for select to authenticated
  using (staff_reads_attempt(attempt_id));

-- ---------- progress ----------
drop policy if exists sp_own on stage_progress;
create policy sp_own on stage_progress for select to authenticated
  using (user_id = auth.uid() or staff_reads_user(user_id));
drop policy if exists sp_staff on stage_progress;
create policy sp_staff on stage_progress for all to authenticated
  using (staff_writes_user(user_id)) with check (staff_writes_user(user_id));

drop policy if exists lp_own on level_progress;
create policy lp_own on level_progress for select to authenticated
  using (user_id = auth.uid() or staff_reads_user(user_id));
drop policy if exists lp_staff on level_progress;
create policy lp_staff on level_progress for all to authenticated
  using (staff_writes_user(user_id)) with check (staff_writes_user(user_id));

-- A moon's mastery: staff READ (their students'), and nobody writes through a client.
drop policy if exists op_read on objective_progress;
create policy op_read on objective_progress for select to authenticated
  using (user_id = auth.uid() or staff_reads_user(user_id));

-- ---------- locks ----------
-- Every teacher sees a GLOBAL lock (it reaches their students); a section's or a student's only if
-- they read that class. Nobody writes a global one through a client.
drop policy if exists sl_read on stage_locks;
create policy sl_read on stage_locks for select to authenticated using (
  is_staff() and (
    scope = 'global'
    or (scope = 'section' and staff_reads_section(scope_section_id))
    or (scope = 'user' and staff_reads_user(scope_user_id))));
drop policy if exists sl_staff on stage_locks;
create policy sl_staff on stage_locks for all to authenticated
  using ((scope = 'section' and staff_writes_section(scope_section_id))
      or (scope = 'user' and staff_writes_user(scope_user_id)))
  with check ((scope = 'section' and staff_writes_section(scope_section_id))
           or (scope = 'user' and staff_writes_user(scope_user_id)));

-- ---------- submissions ----------
drop policy if exists sub_own_read on submissions;
create policy sub_own_read on submissions for select to authenticated
  using (user_id = auth.uid() or staff_reads_user(user_id));
drop policy if exists sub_staff_all on submissions;
create policy sub_staff_all on submissions for all to authenticated
  using (staff_writes_user(user_id)) with check (staff_writes_user(user_id));

-- ---------- the live sessions ----------
drop policy if exists ls_staff_read on live_sessions;
create policy ls_staff_read on live_sessions for select to authenticated
  using (staff_reads_section(section_id) or (is_staff() and started_by = auth.uid()));
drop policy if exists lr_staff_read on live_responses;
create policy lr_staff_read on live_responses for select to authenticated
  using (staff_reads_user(user_id));

-- ---------- the audit log ----------
-- The admin reads everything; a teacher their own actions and those on their students.
drop policy if exists al_staff on audit_log;
create policy al_staff on audit_log for select to authenticated using (
  is_admin() or (is_staff() and (actor_id = auth.uid() or audit_target_in_scope(target_type, target_id))));

-- ---------- assessments ----------
-- A shared paper (no section) is the course's: every teacher reads it, the admin alone writes it.
-- A section's own is its holder's.
drop policy if exists as_read on assessments;
create policy as_read on assessments for select to authenticated using (
  (is_staff() and (section_id is null or staff_reads_section(section_id)))
  or section_id is null
  or section_id = (select section_id from profiles where id = auth.uid()));
drop policy if exists as_staff on assessments;
create policy as_staff on assessments for all to authenticated
  using ((section_id is null and is_admin()) or (section_id is not null and staff_writes_section(section_id)))
  with check ((section_id is null and is_admin()) or (section_id is not null and staff_writes_section(section_id)));

-- ---------- the chat ----------
-- Belonging (to READ): a student -- their section's room and their own thread; a teacher -- the
-- section rooms and the threads of the classes they hold, ended or not; the admin -- every room.
create or replace function chat_belongs(p_user uuid, p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from chat_rooms r
      join profiles p on p.id = p_user and p.deleted_at is null
     where r.id = p_room
       and (p.role = 'admin'
            or (p.role = 'teacher' and (
                  (r.kind = 'section' and exists (
                     select 1 from classes c where c.section_id = r.section_id and c.teacher_id = p_user))
               or (r.kind = 'direct' and exists (
                     select 1 from profiles s join classes c on c.section_id = s.section_id and c.teacher_id = p_user
                      where s.id = r.student_id))))
            or (r.kind = 'section' and r.section_id = p.section_id)
            or (r.kind = 'direct' and r.student_id = p_user)))
$$;

-- May p_user POST in p_room? A student: as they read it. Staff: only in a class they hold that has
-- not ended -- the admin reads every room and posts only in their own.
create or replace function chat_may_post(p_user uuid, p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select chat_member(p_user, p_room) and (
    not exists (select 1 from profiles where id = p_user and role in ('teacher', 'admin'))
    or exists (
      select 1 from chat_rooms r
       where r.id = p_room
         and ((r.kind = 'section' and exists (
                 select 1 from classes c
                  where c.section_id = r.section_id and c.teacher_id = p_user and c.ended_at is null))
           or (r.kind = 'direct' and exists (
                 select 1 from profiles s join classes c on c.section_id = s.section_id
                  where s.id = r.student_id and c.teacher_id = p_user and c.ended_at is null)))))
$$;

drop policy if exists chat_rooms_read on chat_rooms;
create policy chat_rooms_read on chat_rooms for select to authenticated
  using (chat_member(auth.uid(), id));
drop policy if exists chat_messages_read on chat_messages;
create policy chat_messages_read on chat_messages for select to authenticated
  using (chat_member(auth.uid(), room_id));
-- A read marker is its owner's alone.
drop policy if exists chat_members_read_own on chat_members;
create policy chat_members_read_own on chat_members for select to authenticated
  using (user_id = auth.uid());

-- The message's rules, for every role: as addendum-chat.sql, except that the author must be able to
-- POST (chat_may_post), not merely read.
create or replace function chat_message_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'chat_messages is append-only'
      using hint = 'delete a message by tombstoning it: deleted_at set, its text wiped';
  end if;

  if tg_op = 'INSERT' then
    if chat_paper_open(new.author_id)
       and not exists (select 1 from profiles where id = new.author_id and role in ('teacher','admin')) then
      raise exception 'chat is closed while a paper is open'
        using errcode = 'P0423', hint = 'submit the paper first (instructor ruling, 6 Oct 2026)';
    end if;
    if not chat_may_post(new.author_id, new.room_id) then
      raise exception 'the author cannot post in this room' using errcode = '42501';
    end if;
    if exists (select 1 from unnest(new.mentions) m where not chat_belongs(m, new.room_id)) then
      raise exception 'a mention names someone outside the room' using errcode = '22023';
    end if;
    if new.attachment_path is not null
       and new.attachment_path not like new.room_id::text || '/' || new.author_id::text || '/%' then
      raise exception 'an attachment must be filed under its room and its author' using errcode = '22023';
    end if;
    new.created_at := now();
    new.deleted_at := null;
    new.deleted_by := null;
    new.attachment_removed_at := null;
    return new;
  end if;

  -- UPDATE: only a tombstone, or an attachment's removal. Nothing is restored.
  if new.id <> old.id or new.room_id <> old.room_id or new.author_id <> old.author_id
     or new.created_at <> old.created_at then
    raise exception 'a chat message''s room, author and time never change';
  end if;
  if old.deleted_at is not null then
    raise exception 'a deleted message stays deleted';
  end if;
  if new.deleted_at is not null then
    if new.body is not null or new.attachment_path is not null or new.mentions <> '{}' then
      raise exception 'a deleted message keeps no text, mention or attachment';
    end if;
    return new;
  end if;
  -- Not deleted: the only permitted change is removing the attachment.
  if new.body is distinct from old.body or new.mentions <> old.mentions then
    raise exception 'a chat message is never edited';
  end if;
  if new.attachment_path is not null
     and (new.attachment_path is distinct from old.attachment_path
          or new.attachment_mime is distinct from old.attachment_mime
          or new.attachment_bytes is distinct from old.attachment_bytes
          or new.attachment_name is distinct from old.attachment_name) then
    raise exception 'an attachment is removed, never replaced';
  end if;
  if new.attachment_path is null and old.attachment_path is not null
     and new.attachment_removed_at is null then
    new.attachment_removed_at := now();
  end if;
  return new;
end $$;

-- ---------- one question per class ----------
-- Lecture Mode ran ONE question at a time across the whole system. Each teacher now runs their own,
-- in a class they hold, so the unique index is per section (instructor, 9 Oct 2026). A question
-- put to "everyone" (no section) is no longer started by the API.
drop index if exists live_sessions_one_open;
create unique index if not exists live_sessions_one_open_per_section
  on live_sessions (section_id) where ended_at is null and section_id is not null;
