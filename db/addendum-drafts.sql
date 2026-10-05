-- OCTA -- drafted lesson text (instructor ruling, 5 Oct 2026).
--
-- Applied SEVENTH, after addendum-cron.sql. Every statement is idempotent, so
-- this file goes to a LIVE Supabase project on its own, with nothing else
-- re-run:   pnpm db:push --file db/addendum-drafts.sql
-- (addendum-audit.sql cannot be re-applied that way: its first policy exists.)

-- ---------- drafted lesson text, approved before students see it ----------
-- Instructor ruling, 5 Oct 2026: the lesson text of the chapters the syllabus
-- outline alone covered (08-18) may be DRAFTED from the textbook chapters in
-- docs/source/book, because the instructor approves each chapter on /content
-- before any student reads it. A chapter's draft is its whole set of blocks
-- (content/stages/NN.draft.md, written here by sync), staff-only. An approval
-- is of ONE text, by hash: approving copies the blocks into content_blocks
-- (archived as every edit is), and a changed draft withdraws the approval.
-- `ever_approved` tells sync that content_blocks now hold reviewed text it
-- must not overwrite with the file's stub.
create table if not exists chapter_drafts (
  stage_id      text primary key references stages(id) on delete cascade,
  blocks        jsonb not null check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) > 0),
  draft_hash    text not null,
  status        text not null default 'draft'
                  check (status in ('draft','approved','sent_back')),
  approved_hash text,
  ever_approved boolean not null default false,
  note          text,
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  updated_at    timestamptz not null default now(),
  constraint cd_approved_is_this_text
    check (status <> 'approved' or approved_hash = draft_hash),
  constraint cd_sent_back_says_why
    check (status <> 'sent_back' or length(trim(coalesce(note, ''))) >= 3)
);
alter table chapter_drafts enable row level security;
drop policy if exists cd_staff_read on chapter_drafts;
create policy cd_staff_read on chapter_drafts for select to authenticated
  using (is_staff());
