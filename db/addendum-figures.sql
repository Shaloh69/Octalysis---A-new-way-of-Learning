-- OCTA -- figures, recreated as our own SVG (instructor rulings, 6 Oct 2026).
--
-- Applied EIGHTH, after addendum-drafts.sql. Every statement is idempotent, so
-- this file goes to a LIVE Supabase project on its own, with nothing else
-- re-run:   pnpm db:push --file db/addendum-figures.sql
--
-- docs/FIGURES-AND-AUDIO.md is the design. In short: a figure is an SVG drawn
-- for this course (never a screenshot of the book), written here by
-- sync-content from content/figures/<id>.svg as a DRAFT, staff-only. An
-- instructor approves it on /content or /items, bound to its hash; only then
-- is `approved_svg` set, and `approved_svg` is the only thing a student is ever
-- served. A changed file withdraws the approval and students keep the last
-- approved drawing, exactly as chapter_drafts and stage_summaries behave.

create table if not exists figures (
  id            text primary key check (id ~ '^[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$'),
  stage_id      text not null references stages(id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  svg           text not null check (length(svg) between 40 and 200000),
  svg_hash      text not null,
  status        text not null default 'draft'
                  check (status in ('draft','approved','sent_back')),
  approved_hash text,
  approved_svg  text,
  ever_approved boolean not null default false,
  note          text,
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  updated_at    timestamptz not null default now(),
  constraint fig_approved_is_this_drawing
    check (status <> 'approved' or approved_hash = svg_hash),
  constraint fig_sent_back_says_why
    check (status <> 'sent_back' or length(trim(coalesce(note, ''))) >= 3)
);
alter table figures enable row level security;
-- Staff may READ figures and their drafts; nobody writes them through a
-- client. A draft is written by sync and an approval by the API with an audit
-- row. No write policy, so a staff token approving behind the API's back
-- matches nothing. Students never read this table: the API serves them the
-- approved drawing inside the stage or the paper.
drop policy if exists fig_staff_read on figures;
create policy fig_staff_read on figures for select to authenticated
  using (is_staff());

-- ---------- what a student sees is what was approved ----------
-- `approved_svg` may only ever be set to the drawing that was approved, by its
-- hash. The hash is sync's: the first 16 hex digits of SHA-256. Clearing it is
-- always allowed, so withdrawing a figure can never be blocked.
create or replace function figure_must_be_approved() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if new.approved_svg is not null
     and new.approved_svg is distinct from coalesce(old.approved_svg, '') then
    if new.status <> 'approved'
       or new.approved_svg is distinct from new.svg
       or left(encode(digest(new.approved_svg, 'sha256'), 'hex'), 16) is distinct from new.approved_hash then
      raise exception 'figure % drawing has not been approved', new.id
        using hint = 'approve it on /content; the approved drawing is what reaches students';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists figures_approved_only on figures;
create trigger figures_approved_only before insert or update on figures
  for each row execute function figure_must_be_approved();

-- ---------- a question that needs a figure ----------
alter table items add column if not exists figure_id text references figures(id);

-- A question cannot go live while its figure has no approved drawing: the
-- student would be asked about a picture that is not there. The approve route
-- refuses this too; the trigger is for every other path, service_role included.
create or replace function item_figure_must_be_approved() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'live' and new.figure_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'live' or old.figure_id is distinct from new.figure_id)
     and not exists (select 1 from figures f where f.id = new.figure_id and f.approved_svg is not null) then
    raise exception 'item % cannot go live: figure % is not approved', new.slug, new.figure_id
      using hint = 'approve the figure on /items or /content first';
  end if;
  return new;
end $$;

drop trigger if exists items_figure_approved on items;
create trigger items_figure_approved before insert or update of status, figure_id on items
  for each row execute function item_figure_must_be_approved();
