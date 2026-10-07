-- OCTA -- the Studio as an editor, E1.1: a chapter's working copy and Publish
-- (docs/STUDIO-EDITOR-PLAN.md; instructor rulings, 8 Oct 2026).
--
-- Applied FIFTEENTH, after addendum-studio.sql. Idempotent; on a live Supabase
-- project on its own, BEFORE the code that reads it (hard rule 10):
--     pnpm db:push --file db/addendum-studio-editor.sql
--
-- Ruling: typing makes a DRAFT students never see; Publish puts it live; the
-- editing teacher may publish their own typed edit. `chapter_drafts` already is
-- a chapter's working copy (one row per chapter, the whole ordered block list,
-- a hash, approval bound to that hash), so it grows rather than a second table
-- appearing:
--   origin       who made the working copy: 'file' (sync-content, from
--                NN.draft.md), 'console' (typed in the Studio), 'ai' (a proposal
--                a teacher accepted; CS3). sync-content never touches 'console'
--   version      a counter: two teachers on one chapter cannot overwrite each
--                other (the save names the version it loaded)
--   base_hash    the live chapter's hash when the console draft began: Publish
--                refuses if live text changed since
--   edited_by/at the last teacher to type in it
--
-- `stages.content_owner` says who owns a chapter's text: 'files' (sync-content
-- writes it from content/stages/NN.md) or 'console' (once a Studio publish has
-- happened, the database does, and sync leaves it alone).
--
-- And the rule is held below the API: staff no longer write `content_blocks`
-- through a client. The API (the service role) is the only writer, so Publish
-- cannot be bypassed with a staff token. History is unchanged: the archive
-- trigger still records every replaced version.

alter table chapter_drafts add column if not exists origin text not null default 'file';
alter table chapter_drafts add column if not exists version int not null default 1;
alter table chapter_drafts add column if not exists base_hash text;
alter table chapter_drafts add column if not exists edited_by uuid references auth.users(id) on delete set null;
alter table chapter_drafts add column if not exists edited_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cd_origin_known') then
    alter table chapter_drafts add constraint cd_origin_known check (origin in ('file','console','ai'));
  end if;
end $$;

alter table stages add column if not exists content_owner text not null default 'files';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'stages_content_owner_known') then
    alter table stages add constraint stages_content_owner_known check (content_owner in ('files','console'));
  end if;
end $$;

-- Staff READ content_blocks (cb_read already lets them); they no longer WRITE.
drop policy if exists cb_staff on content_blocks;

-- The approver rule (addendum-studio.sql), taught about typed drafts: a teacher's
-- own console draft is published by that teacher, and the row says so
-- (`self_approved`), forever. A teacher of the subject or the admin is still
-- required. Every other table is unchanged.
create or replace function enforce_content_approver() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  approving boolean;
  author    uuid;
  approver  uuid;
  verdict   text;
  typed     boolean := false;
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
    if tg_table_name = 'chapter_drafts' then
      -- A nested IF, not `and`: `new.origin` must not be parsed for stage_summaries.
      if new.origin = 'console' then
        author := null;
        typed := true;
      end if;
    end if;
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

  new.self_approved := (author is not null and author = approver);
  if typed then
    new.self_approved := new.edited_by is not null and new.edited_by = approver;
  end if;
  return new;
end $$;
