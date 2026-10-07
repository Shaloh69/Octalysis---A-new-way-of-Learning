-- OCTA -- the drafting assistant's tables (B2; docs/AI-ASSISTANT-PLAN.md v5:
-- §4-now, §4a memory, §4b frozen approved work, §9; .claude/rules/assistant.md).
--
-- Applied ELEVENTH, after addendum-sitting.sql. Every statement is idempotent,
-- so this file goes to a LIVE Supabase project on its own, with nothing else
-- re-run:   pnpm db:push --file db/addendum-assistant.sql
--
-- The shape, and the rules the database holds rather than the API:
--
--   assistant_books        a teacher's book: one PDF, by its hash (never the PDF)
--   assistant_figures      what the figure reader (B1) read: caption, labels,
--                          chart data, where its crop is in the private bucket
--   assistant_jobs         "draft chapter 15": a run of steps
--   assistant_steps        one model call each, saved before and after it, so a
--                          restart resumes at the next unfinished step (§4a)
--   assistant_briefs       a chapter's memory: outline, terms, figures chosen,
--                          the teacher's decisions, accepted summaries (§4a)
--   assistant_units        what a step made: one section, one figure summary,
--                          one question. Versioned; ACCEPTED IS FROZEN (§4b)
--
-- Every table carries an owning teacher and a course from day one (ruling,
-- 7 Oct 2026: OCTA will one day serve several courses and teachers). A child
-- row's owner and course are its parent's, held by composite foreign keys, so
-- nothing can be filed under another teacher's book or job.
--
-- Who reads and writes:
--   * A teacher reads THEIR OWN rows, never another teacher's (owner-only),
--     and a student reads nothing (staff-only).
--   * No client writes anything. Every write is the API's (service_role), as
--     for chat_messages and figures: a staff token behind the API's back
--     matches no write policy.
--   * Engine keys are NOT here (round six, 7 Oct 2026): each teacher's keys
--     live in their own app, in Windows Credential Manager, and never reach
--     OCTA. B2's sealed-keys table was retired by addendum-assistant-v6.sql.
--   * Local Ollama is PAUSED (round five, 7 Oct 2026): no step may name it.
--     The future update that turns it on drops `as_local_ollama_paused`.

create or replace function assistant_course_ok(c text) returns boolean
language sql immutable as $$ select c ~ '^[A-Z]{2,6} [0-9]{2,4}[A-Z]?$' $$;

-- ---------- books ----------
create table if not exists assistant_books (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  course      text not null check (assistant_course_ok(course)),
  title       text not null check (length(trim(title)) > 0),
  edition     text,
  pdf_sha256  text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pages       int check (pages > 0),
  created_at  timestamptz not null default now(),
  constraint ab_one_book_per_pdf unique (owner_id, pdf_sha256),
  constraint ab_owner_course unique (id, owner_id, course)
);

-- ---------- what the figure reader read (B1) ----------
create table if not exists assistant_figures (
  id             uuid primary key default gen_random_uuid(),
  book_id        uuid not null,
  owner_id       uuid not null,
  course         text not null,
  figure_key     text not null check (figure_key ~ '^[0-9]{1,2}\.[0-9]{1,3}(-[0-9])?$'),  -- '15.4', '6.6-2'
  chapter        int  not null check (chapter between 1 and 99),
  number         int  not null check (number >= 1),
  part           int  not null default 1 check (part >= 1),
  page           int  not null check (page >= 1),
  caption        text not null check (length(trim(caption)) > 0),
  crop_path      text,   -- an object in the private bucket, under the owner's folder
  crop_sha256    text check (crop_sha256 ~ '^[0-9a-f]{64}$'),
  labels         jsonb not null default '[]' check (jsonb_typeof(labels) = 'array'),
  chart          jsonb,
  flags          text[] not null default '{}',
  reader_version text not null,
  created_at     timestamptz not null default now(),
  constraint af_one_per_figure unique (book_id, figure_key),
  constraint af_book foreign key (book_id, owner_id, course)
    references assistant_books (id, owner_id, course) on delete cascade,
  constraint af_crop_in_owners_folder
    check (crop_path is null or crop_path like owner_id::text || '/%')
);

-- ---------- jobs ----------
create table if not exists assistant_jobs (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null,
  owner_id    uuid not null,
  course      text not null,
  chapter     int  not null check (chapter between 1 and 99),
  kind        text not null check (kind in ('chapter','figures','questions','review','coverage')),
  status      text not null default 'waiting'
                check (status in ('waiting','running','paused','done','failed','cancelled')),
  engines     text[] not null default '{}',   -- the chain, in order (§3a)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint aj_book foreign key (book_id, owner_id, course)
    references assistant_books (id, owner_id, course) on delete cascade,
  constraint aj_owner_course unique (id, owner_id, course),
  constraint aj_known_engines check (engines <@ array['claude_api','ollama_cloud','groq','cloudflare','claude_code']::text[])
);

-- ---------- steps ----------
create table if not exists assistant_steps (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null,
  owner_id        uuid not null,
  course          text not null,
  seq             int  not null check (seq >= 0),
  kind            text not null check (kind in
                    ('figure_summary','figure_redraw','section','questions','check','catalogue','coverage','review')),
  status          text not null default 'waiting'
                    check (status in ('waiting','running','done','failed','skipped')),
  engine          text check (engine in ('claude_api','ollama_cloud','groq','cloudflare','claude_code','ollama_local')),
  model           text,
  prompt_version  text,
  input_hash      text,
  idempotency_key text not null,
  output          jsonb,
  error           jsonb,
  tokens_in       int check (tokens_in >= 0),
  tokens_out      int check (tokens_out >= 0),
  ms              int check (ms >= 0),
  cost_usd        numeric(12,6) check (cost_usd >= 0),
  attempts        int not null default 0 check (attempts >= 0),
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint as_order unique (job_id, seq),
  constraint as_idempotent unique (idempotency_key),
  constraint as_job foreign key (job_id, owner_id, course)
    references assistant_jobs (id, owner_id, course) on delete cascade,
  constraint as_local_ollama_paused check (engine is distinct from 'ollama_local'),
  constraint as_ran_on_something check (status not in ('running','done') or (engine is not null and model is not null)),
  constraint as_done_records_cost check (status <> 'done' or (tokens_in is not null and tokens_out is not null and ms is not null))
);

-- ---------- chapter briefs: the memory every engine receives ----------
create table if not exists assistant_briefs (
  id                 uuid primary key default gen_random_uuid(),
  book_id            uuid not null,
  owner_id           uuid not null,
  course             text not null,
  chapter            int  not null check (chapter between 1 and 99),
  outline            jsonb not null default '[]' check (jsonb_typeof(outline) = 'array'),
  terms              jsonb not null default '[]' check (jsonb_typeof(terms) = 'array'),
  figures            jsonb not null default '[]' check (jsonb_typeof(figures) = 'array'),
  decisions          jsonb not null default '[]' check (jsonb_typeof(decisions) = 'array'),
  accepted_summaries jsonb not null default '[]' check (jsonb_typeof(accepted_summaries) = 'array'),
  version            int  not null default 1 check (version >= 1),
  updated_at         timestamptz not null default now(),
  constraint ab_one_brief unique (book_id, chapter),
  constraint ab_book foreign key (book_id, owner_id, course)
    references assistant_books (id, owner_id, course) on delete cascade
);

-- ---------- units: versioned, and accepted is frozen ----------
create table if not exists assistant_units (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null,
  owner_id       uuid not null,
  course         text not null,
  step_id        uuid references assistant_steps(id) on delete set null,
  unit_key       text not null check (length(trim(unit_key)) > 0),   -- 'ch15/section/2'
  kind           text not null check (kind in
                   ('section','figure_summary','figure_redraw','question','catalogue','summary','glossary')),
  version        int  not null check (version >= 1),
  body           text not null check (length(body) between 1 and 200000),
  body_sha256    text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  status         text not null default 'draft'
                   check (status in ('draft','accepted','rejected','superseded')),
  engine         text,
  model          text,
  prompt_version text,
  verification   jsonb not null default '{}' check (jsonb_typeof(verification) = 'object'),
  note           text,
  accepted_by    uuid references auth.users(id),
  accepted_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint au_version unique (owner_id, course, unit_key, version),
  constraint au_job foreign key (job_id, owner_id, course)
    references assistant_jobs (id, owner_id, course) on delete cascade,
  constraint au_accepted_says_who
    check (status not in ('accepted','superseded') or (accepted_by is not null and accepted_at is not null))
);
-- One accepted version of a unit at a time; v1 stays accepted until v2 is.
create unique index if not exists au_one_accepted
  on assistant_units (owner_id, course, unit_key) where status = 'accepted';

-- An accepted unit is never regenerated, rewritten or tidied, by any role,
-- service_role included (§4b). A change is a new version beside it. The only
-- move out of `accepted` is to `superseded`, once a later version of the same
-- unit exists, with every other column untouched. Accepted and superseded
-- units are never deleted. A body is always the text its hash names.
create or replace function assistant_unit_guard() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('accepted','superseded') then
      raise exception 'assistant unit % v% is %: accepted work is never deleted', old.unit_key, old.version, old.status;
    end if;
    return old;
  end if;
  if new.body_sha256 is distinct from encode(digest(new.body, 'sha256'), 'hex') then
    raise exception 'assistant unit % v%: body_sha256 is not the hash of its body', new.unit_key, new.version;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'assistant unit % v%: a unit is born a draft, and accepted only by review', new.unit_key, new.version;
    end if;
    return new;
  end if;
  if old.status = 'accepted' then
    if new.status = 'superseded'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status')
       and exists (select 1 from assistant_units u
                    where u.owner_id = old.owner_id and u.course = old.course
                      and u.unit_key = old.unit_key and u.version > old.version) then
      return new;
    end if;
    raise exception 'assistant unit % v% is accepted and frozen', old.unit_key, old.version
      using hint = 'make a new version beside it; accepting that one supersedes this';
  end if;
  if old.status in ('superseded','rejected') then
    raise exception 'assistant unit % v% is % and frozen', old.unit_key, old.version, old.status
      using hint = 'make a new version';
  end if;
  return new;
end $$;

drop trigger if exists assistant_units_guard on assistant_units;
create trigger assistant_units_guard before insert or update or delete on assistant_units
  for each row execute function assistant_unit_guard();

-- ---------- RLS: owner-only for staff, nothing for anyone else ----------
alter table assistant_books       enable row level security;
alter table assistant_figures     enable row level security;
alter table assistant_jobs        enable row level security;
alter table assistant_steps       enable row level security;
alter table assistant_briefs      enable row level security;
alter table assistant_units       enable row level security;

drop policy if exists abk_owner_read on assistant_books;
create policy abk_owner_read on assistant_books for select to authenticated
  using (is_staff() and owner_id = auth.uid());
drop policy if exists afg_owner_read on assistant_figures;
create policy afg_owner_read on assistant_figures for select to authenticated
  using (is_staff() and owner_id = auth.uid());
drop policy if exists ajb_owner_read on assistant_jobs;
create policy ajb_owner_read on assistant_jobs for select to authenticated
  using (is_staff() and owner_id = auth.uid());
drop policy if exists ast_owner_read on assistant_steps;
create policy ast_owner_read on assistant_steps for select to authenticated
  using (is_staff() and owner_id = auth.uid());
drop policy if exists abr_owner_read on assistant_briefs;
create policy abr_owner_read on assistant_briefs for select to authenticated
  using (is_staff() and owner_id = auth.uid());
drop policy if exists aun_owner_read on assistant_units;
create policy aun_owner_read on assistant_units for select to authenticated
  using (is_staff() and owner_id = auth.uid());

-- ---------- the private bucket for the figure reader's crops ----------
-- Supabase's storage schema; absent on the local stack. The book's own pages
-- go here, for the side-by-side review only: private, PNG, 10 MB, every
-- object under '<owner_id>/'. No policy on storage.objects for this bucket:
-- only service_role (the API, and the B1 upload) reaches it, and the API
-- serves a teacher only their own folder.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('assistant-figures', 'assistant-figures', false, 10485760, array['image/png'])
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
