-- OCTA -- the class chat (instructor, approved 6 Oct 2026; docs/CHAT-PLAN.md).
--
-- Applied NINTH, after addendum-figures.sql. Every statement is idempotent, so
-- this file goes to a LIVE Supabase project on its own, with nothing else
-- re-run:   pnpm db:push --file db/addendum-chat.sql
--
-- The four rulings, and where each is held:
--   1. One room per section, plus one private thread between each student and
--      the instructor (`chat_rooms.kind`), created by the API on first use.
--   2. Screenshots and short videos, 25 MB at most, in a PRIVATE bucket
--      (`chat-attachments`, at the bottom). No client storage policy exists:
--      the API signs every upload and every download after checking the room,
--      so an attachment is never a public URL and never a guessable one.
--   3. A student with a paper open can neither read nor post, ENFORCED HERE:
--      `chat_paper_open()` is part of the read predicate (so RLS and Realtime
--      both go dark) and a trigger refuses the insert for every role,
--      service_role included. "Open" means in progress AND its window has not
--      closed: nothing abandons an attempt, so a paper whose window shut must
--      not lock a student out of the chat for the rest of the term.
--   4. Ordered first.
--
-- Writes are the API's alone: no INSERT, UPDATE or DELETE policy exists, and
-- the client roles lose those privileges outright. Reads go through RLS
-- because Supabase Realtime delivers a row only to a subscriber whose policy
-- lets them SELECT it -- the same predicate guards the page and the push.
--
-- A message is append-only except for two narrowing changes: it may be
-- DELETED (its text, mentions and attachment are wiped, the row stays as a
-- tombstone) and its attachment may be REMOVED (storage housekeeping). The
-- text of a deleted message is therefore gone for everyone; when the
-- instructor removes someone else's message, the text is kept in audit_log,
-- which only staff read.

-- ---------- rooms ----------
create table if not exists chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('section','direct')),
  section_id  uuid references sections(id) on delete cascade,
  -- direct: the one student in the thread; the other side is the instructor
  -- (every staff account, as everywhere else: is_staff()).
  student_id  uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint chat_room_shape check (
    (kind = 'section' and section_id is not null and student_id is null)
    or (kind = 'direct' and student_id is not null and section_id is null))
);
create unique index if not exists chat_rooms_one_per_section
  on chat_rooms (section_id) where kind = 'section';
create unique index if not exists chat_rooms_one_per_student
  on chat_rooms (student_id) where kind = 'direct';

-- ---------- messages ----------
create table if not exists chat_messages (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references chat_rooms(id) on delete cascade,
  author_id         uuid not null references auth.users(id),
  body              text check (body is null or length(body) between 1 and 4000),
  -- Who the message @mentions; each must be able to read the room (trigger).
  mentions          uuid[] not null default '{}',
  -- <room_id>/<author_id>/<uuid>.<ext> in the chat-attachments bucket.
  attachment_path   text,
  attachment_mime   text check (attachment_mime is null or attachment_mime in
                      ('image/png','image/jpeg','image/gif','image/webp',
                       'video/mp4','video/webm','video/quicktime')),
  attachment_bytes  int check (attachment_bytes is null or attachment_bytes between 1 and 26214400),
  attachment_name   text check (attachment_name is null or length(attachment_name) between 1 and 200),
  attachment_removed_at timestamptz,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  deleted_by        uuid references auth.users(id),
  constraint chat_msg_tombstone_is_empty
    check (deleted_at is null or (body is null and attachment_path is null and mentions = '{}')),
  constraint chat_msg_attachment_whole
    check ((attachment_path is null) = (attachment_mime is null)
       and (attachment_path is null) = (attachment_bytes is null))
);
-- A message says something: text, a file, or a file since removed to free
-- storage (an attachment-only message keeps its place in the conversation).
-- Dropped and re-added so a re-apply changes a live table (6 Oct 2026: the
-- first version forgot the removed file, and pruning an attachment-only
-- message broke on it).
alter table chat_messages drop constraint if exists chat_msg_says_something;
alter table chat_messages add constraint chat_msg_says_something
  check (deleted_at is not null or body is not null or attachment_path is not null
         or attachment_removed_at is not null);
create index if not exists chat_messages_room_time on chat_messages (room_id, created_at);
create index if not exists chat_messages_mentions on chat_messages using gin (mentions);
create index if not exists chat_messages_attachments on chat_messages (created_at)
  where attachment_path is not null;

-- ---------- read markers ----------
-- One row per person per room they have opened: where they stopped reading.
-- It is NOT membership (that is derived, below, so a student who changes
-- section changes rooms with nothing to keep in step); it is what turns
-- "mentioned" into "mentioned since you last looked" for the nav's count.
create table if not exists chat_members (
  room_id      uuid not null references chat_rooms(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- ---------- who may be in a room ----------
-- A paper is open: in progress, and its window (if it has one) still open.
create or replace function chat_paper_open(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from attempts a
      join assessments s on s.id = a.assessment_id
     where a.user_id = p_user
       and a.status = 'in_progress'
       and (s.closes_at is null or s.closes_at > now()))
$$;

-- Does p_user belong to p_room? Staff: every room. A student: their section's
-- room and their own thread. A deactivated account belongs nowhere. Takes the
-- user explicitly so the insert trigger can ask it about the AUTHOR (and each
-- person mentioned), who is not the connection's identity when the API writes.
create or replace function chat_belongs(p_user uuid, p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from chat_rooms r
      join profiles p on p.id = p_user and p.deleted_at is null
     where r.id = p_room
       and (p.role in ('teacher','admin')
            or (r.kind = 'section' and r.section_id = p.section_id)
            or (r.kind = 'direct' and r.student_id = p_user)))
$$;

-- May p_user read p_room NOW? Belonging, and for a student no paper open.
-- A classmate sitting a paper still belongs (they can be @mentioned and will
-- see it after submitting); they just cannot open the room until then.
create or replace function chat_member(p_user uuid, p_room uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select chat_belongs(p_user, p_room)
     and (exists (select 1 from profiles where id = p_user and role in ('teacher','admin'))
          or not chat_paper_open(p_user))
$$;

-- ---------- RLS ----------
alter table chat_rooms    enable row level security;
alter table chat_messages enable row level security;
alter table chat_members  enable row level security;

drop policy if exists chat_rooms_read on chat_rooms;
create policy chat_rooms_read on chat_rooms for select to authenticated
  using (is_staff() or chat_member(auth.uid(), id));

drop policy if exists chat_messages_read on chat_messages;
create policy chat_messages_read on chat_messages for select to authenticated
  using (is_staff() or chat_member(auth.uid(), room_id));

drop policy if exists chat_members_read_own on chat_members;
create policy chat_members_read_own on chat_members for select to authenticated
  using (user_id = auth.uid() or is_staff());

-- Defence in depth: no policy permits a client write, and the privileges go too.
revoke insert, update, delete, truncate on chat_rooms, chat_messages, chat_members
  from anon, authenticated;
revoke select on chat_rooms, chat_messages, chat_members from anon;

-- ---------- the message's rules, for every role ----------
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
    if not chat_member(new.author_id, new.room_id) then
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

drop trigger if exists chat_messages_guard on chat_messages;
create trigger chat_messages_guard before insert or update or delete on chat_messages
  for each row execute function chat_message_guard();

-- ---------- Realtime ----------
-- Supabase's publication; absent on the local stack, where the pages poll.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime'
                        and schemaname = 'public' and tablename = 'chat_messages') then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;

-- ---------- the private bucket ----------
-- Supabase's storage schema; absent on the local stack, where attachments are
-- switched off and the page says so. 25 MB per file (ruling 2); the bucket
-- refuses anything bigger or of another type, whoever signed the upload.
-- No policy on storage.objects for this bucket: with RLS on and no policy,
-- only service_role (the API) reaches it.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('chat-attachments', 'chat-attachments', false, 26214400,
            array['image/png','image/jpeg','image/gif','image/webp',
                  'video/mp4','video/webm','video/quicktime'])
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
