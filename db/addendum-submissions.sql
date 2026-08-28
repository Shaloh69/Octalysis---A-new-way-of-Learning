-- ============================================================
-- OCTALYSIS — submissions addendum
-- Apply AFTER addendum-audit.sql and BEFORE addendum-cron.sql.
--
-- WHY THIS EXISTS. The syllabus weights Laboratory Exercises at 10%, the
-- Project at 20%, and Class Participation at 10%. That is FORTY PER CENT of the
-- final grade, and until this file there was nowhere in the database to put any
-- of it -- the gradebook knew only about quizzes and examinations.
--
-- WHAT IT IS NOT. This is not an attempts table. An attempt is generated,
-- graded by machine, and its answer key is withheld by RLS. A submission is
-- authored by a student, graded by a person against a rubric, and there is no
-- secret in it. Reusing `attempts` for both would have meant one table with two
-- unrelated authorization stories, which is how a leak gets written.
-- ============================================================

create type submission_kind   as enum ('lab','project','participation');
create type submission_status as enum ('draft','submitted','returned','graded','voided');

create table submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         submission_kind not null,

  -- Which lab, or which project milestone. `stage_id` is null for the project
  -- and for participation, because neither belongs to one chapter.
  stage_id     text references stages(id),
  slug         text not null,                       -- 'LAB-04' | 'PROJECT-MIDTERM'
  title        text not null,

  -- What the student handed in. `body_md` is the written part -- the decision
  -- memo, the justification, the reasoning that carries a full rubric point.
  body_md      text,
  -- Storage paths, never file bytes. Postgres is not a file server and a 20 MB
  -- screenshot in a row makes every query that touches this table slow.
  attachments  jsonb not null default '[]',
  -- For a lab whose answer is a number or a table, checked by the grader.
  payload      jsonb not null default '{}',

  status       submission_status not null default 'draft',
  submitted_at timestamptz,

  -- V-23 style range check: a score cannot exceed its own maximum.
  score        numeric(5,2) check (score >= 0),
  max_score    numeric(5,2) check (max_score > 0),
  constraint submissions_score_within_max check (score is null or max_score is null or score <= max_score),

  -- The rubric result, one entry per criterion. Kept as jsonb rather than a
  -- child table because a rubric is read whole, written whole, and never
  -- queried by criterion.
  rubric       jsonb not null default '{}',
  feedback_md  text,

  graded_by    uuid references auth.users(id),
  graded_at    timestamptz,

  -- Late is a FACT, not a penalty. Whether it costs marks is the instructor's
  -- decision at grading time; recording it here keeps that decision visible.
  due_at       timestamptz,
  is_late      boolean generated always as (
                 submitted_at is not null and due_at is not null and submitted_at > due_at
               ) stored,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- One submission per student per deliverable. A resubmission UPDATES the
  -- draft; it does not create a second row that a grader might miss.
  unique (user_id, slug)
);

create index on submissions (status, kind);
create index on submissions (user_id, kind);
create index on submissions (stage_id) where stage_id is not null;

-- ------------------------------------------------------------
-- A GRADED SUBMISSION IS FROZEN.
--
-- Same principle as `responses` being append-only: once a person has marked
-- something, the student cannot quietly alter what was marked. A correction is
-- a REGRADE -- staff move it back to 'returned', which is recorded in
-- audit_log -- never an edit to a graded row.
--
-- Enforced by trigger rather than by policy because a policy cannot see the OLD
-- row's status and the NEW row's columns together in a way that expresses
-- "these particular fields may not change".
-- ------------------------------------------------------------
create or replace function submissions_freeze_when_graded()
returns trigger language plpgsql as $$
begin
  if old.status = 'graded' and current_setting('octa.allow_regrade', true) is distinct from 'on' then
    if new.body_md   is distinct from old.body_md
       or new.payload     is distinct from old.payload
       or new.attachments is distinct from old.attachments then
      raise exception
        'submission % is graded; its content cannot be changed. Return it for revision first.',
        old.id
        using errcode = 'check_violation';
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;

create trigger submissions_frozen
  before update on submissions
  for each row execute function submissions_freeze_when_graded();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table submissions enable row level security;

-- A student sees only their own, always -- including after grading, because the
-- feedback is the point of the exercise.
create policy sub_own_read on submissions for select to authenticated
  using (user_id = auth.uid() or is_staff());

-- A student may create their own, and only in a non-graded state. `status` is
-- checked here rather than trusted: a client that could insert 'graded' could
-- award itself marks.
create policy sub_own_insert on submissions for insert to authenticated
  with check (user_id = auth.uid() and status in ('draft','submitted'));

-- A student may edit their own while it is still theirs to edit. The trigger
-- above is the second half of this: it stops a graded row being altered even
-- when the status column itself is untouched.
create policy sub_own_update on submissions for update to authenticated
  using (user_id = auth.uid() and status in ('draft','submitted','returned'))
  with check (user_id = auth.uid() and status in ('draft','submitted'));

create policy sub_staff_all on submissions for all to authenticated
  using (is_staff()) with check (is_staff());

-- Nobody deletes a submission. It is evidence, and 'voided' is the state for
-- one that should not count. There is deliberately no DELETE policy.

-- ------------------------------------------------------------
-- Column privileges
--
-- V-29: column grants are ADDITIVE to table grants, so the table grant must be
-- revoked first and the readable columns granted back by name. A student may
-- READ their score and feedback; they may not WRITE either.
-- ------------------------------------------------------------
revoke all on submissions from authenticated;
grant select (id, user_id, kind, stage_id, slug, title, body_md, attachments,
              payload, status, submitted_at, score, max_score, rubric,
              feedback_md, graded_at, due_at, is_late, created_at, updated_at)
  on submissions to authenticated;
grant insert (user_id, kind, stage_id, slug, title, body_md, attachments,
              payload, status, submitted_at, due_at)
  on submissions to authenticated;
grant update (body_md, attachments, payload, status, submitted_at)
  on submissions to authenticated;

-- ------------------------------------------------------------
-- INV-31: a graded submission has a score, a maximum, and a grader.
--
-- A row marked graded with no score is worse than an ungraded one: it looks
-- finished in every list and contributes nothing to the total.
-- ------------------------------------------------------------
create or replace function inv_31_graded_submissions_complete()
returns table(id uuid, slug text, problem text) language sql stable as $$
  select s.id, s.slug,
         case when s.score is null     then 'graded with no score'
              when s.max_score is null then 'graded with no maximum'
              when s.graded_by is null then 'graded with no grader recorded'
         end
  from submissions s
  where s.status = 'graded'
    and (s.score is null or s.max_score is null or s.graded_by is null)
$$;

comment on table submissions is
  'Labs, the project, and participation. 40% of the final grade. A graded row is '
  'frozen by trigger; corrections go through status = returned, never an edit.';
