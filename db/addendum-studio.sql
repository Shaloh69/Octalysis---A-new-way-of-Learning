-- OCTA -- Course Studio, CS1: the approval rule (docs/COURSE-STUDIO-PLAN.md §3;
-- instructor rulings, 7 Oct 2026, night).
--
-- Applied FOURTEENTH, after addendum-teachers.sql. Idempotent; on a live
-- Supabase project on its own, BEFORE the code that reads it (hard rule 10):
--     pnpm db:push --file db/addendum-studio.sql
--
--   The approver of a summary, a drafted chapter, a figure or a question is a
--   teacher OF THE SUBJECT (a staff account holding an un-ended class of it)
--   and never the author of the version approved. The ADMIN may approve
--   their own edit, and every such approval is recorded as self-approved.
--
-- Held here, in the database, so no route, script or service-role statement
-- goes round it: the API checks first so a refusal says why, and this is what
-- stands if anything else writes. The database sets `self_approved` itself;
-- a client can never claim it.
--
-- `authored_by` is the teacher who wrote a version through the console. Text
-- written from the files by sync-content has none (no teacher wrote it), so
-- today it is null on summaries, drafts and figures and the author check
-- bites on items (`items.author_id`); it is ready for the proposals CS3 lets a
-- teacher accept. Everything is a column on a table that is already staff-read
-- only, so no policy changes.

alter table stage_summaries add column if not exists authored_by uuid references auth.users(id) on delete set null;
alter table stage_summaries add column if not exists self_approved boolean not null default false;
alter table chapter_drafts  add column if not exists authored_by uuid references auth.users(id) on delete set null;
alter table chapter_drafts  add column if not exists self_approved boolean not null default false;
alter table figures         add column if not exists authored_by uuid references auth.users(id) on delete set null;
alter table figures         add column if not exists self_approved boolean not null default false;
alter table items           add column if not exists self_approved boolean not null default false;

-- Which subject a chapter belongs to. Only CPE 412 has chapters until CS2
-- keys the stages by subject; CS2 changes this one function.
create or replace function content_subject_of(stage text) returns text
language sql immutable as $$ select 'CPE 412'::text $$;

-- The rule, as a verdict a caller can say in words:
--   ok                   may approve
--   not_staff            not an active staff account
--   not_subject_teacher  a teacher holding no un-ended class of the subject
--   author               the author of the version (not the admin)
create or replace function approval_verdict(approver uuid, author uuid, stage text) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare who profiles%rowtype;
begin
  select * into who from profiles where id = approver and deleted_at is null;
  if not found then return 'not_staff'; end if;
  if who.role = 'admin' then return 'ok'; end if;
  if who.role <> 'teacher' then return 'not_staff'; end if;
  if not exists (
    select 1 from classes c
     where c.teacher_id = approver and c.ended_at is null
       and c.subject_code = content_subject_of(stage)
  ) then return 'not_subject_teacher'; end if;
  if author is not null and author = approver then return 'author'; end if;
  return 'ok';
end $$;

create or replace function enforce_content_approver() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  approving boolean;
  author    uuid;
  approver  uuid;
  verdict   text;
begin
  if tg_table_name = 'items' then
    approving := new.status = 'live' and old.status is distinct from 'live';
    author := new.author_id;
  elsif tg_table_name = 'figures' then
    approving := new.status = 'approved'
      and (old.status is distinct from 'approved' or old.approved_hash is distinct from new.approved_hash);
    author := new.authored_by;
  else
    approving := new.status = 'approved'
      and (old.status is distinct from 'approved' or old.approved_hash is distinct from new.approved_hash);
    author := new.authored_by;
  end if;

  -- Never a client's to set: carried over unless this update IS an approval.
  if not approving then
    new.self_approved := old.self_approved;
    return new;
  end if;

  approver := new.reviewed_by;
  -- An approval with no named approver is not a review. (A live item with no
  -- reviewer is also what INV-14 reports, so it cannot hide.)
  if approver is null then
    new.self_approved := false;
    return new;
  end if;

  verdict := approval_verdict(approver, author, new.stage_id);
  if verdict = 'not_staff' then
    raise exception 'may not approve: % is not an active staff account', approver using errcode = '23514';
  elsif verdict = 'not_subject_teacher' then
    raise exception 'may not approve: % is not a teacher of %', approver, content_subject_of(new.stage_id) using errcode = '23514';
  elsif verdict = 'author' then
    raise exception 'may not approve: the author of a version cannot approve it' using errcode = '23514';
  end if;
  new.self_approved := author is not null and author = approver;
  return new;
end $$;

drop trigger if exists summaries_approver on stage_summaries;
create trigger summaries_approver before update on stage_summaries
  for each row execute function enforce_content_approver();
drop trigger if exists drafts_approver on chapter_drafts;
create trigger drafts_approver before update on chapter_drafts
  for each row execute function enforce_content_approver();
drop trigger if exists figures_approver on figures;
create trigger figures_approver before update on figures
  for each row execute function enforce_content_approver();
drop trigger if exists items_approver on items;
create trigger items_approver before update on items
  for each row execute function enforce_content_approver();
