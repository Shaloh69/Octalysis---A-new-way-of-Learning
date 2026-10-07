-- OCTA -- teachers, subjects and classes (T1; docs/TEACHERS-AND-SUBJECTS-PLAN.md,
-- approved 7 Oct 2026, night).
--
-- Applied THIRTEENTH, after addendum-assistant-v6.sql. Idempotent; on a live
-- Supabase project on its own:
--     pnpm db:push --file db/addendum-teachers.sql
--
--   subjects            a course: 'CPE 412' (the name of a subject, not a section)
--   subject_books       two or more books per subject; one is its default
--   classes             one section taking one subject with one teacher in a
--                       term; many sections may take one subject; a class may
--                       read any of its subject's books (null: the default)
--   teacher_directory   the teacher roster, by employee ID, claimed as students
--                       claim theirs (the role comes from the roster, never a form)
--
-- Who reads and writes:
--   * The roster: the ADMIN reads it; nobody writes it but the API
--     (`requireAdmin()`), the admin included. Supersedes D4 for these powers.
--   * Subjects and books: any signed-in user reads them; the API writes.
--   * Classes: the admin reads all; a teacher reads the classes they hold; a
--     student reads their own section's. The API writes. (T2 scopes the rest of
--     a teacher's console to their classes.)
--   * The database itself holds: a class's teacher is a staff account; a
--     class's book is one of ITS subject's books; one class per section,
--     subject and term; one default book per subject.

create or replace function is_admin() returns boolean
language sql stable as $$ select jwt_role() = 'admin' $$;

-- A student's section, for the class policy. Security definer: a policy's
-- subquery is subject to RLS (db/CLAUDE.md, V-30).
create or replace function my_section_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select section_id from profiles where id = auth.uid()
$$;

-- ---------- subjects and their books ----------
create table if not exists subjects (
  code        text primary key check (code ~ '^[A-Z]{2,6} [0-9]{2,4}[A-Z]?$'),
  title       text not null check (length(trim(title)) > 0),
  created_at  timestamptz not null default now()
);

create table if not exists subject_books (
  id            uuid primary key default gen_random_uuid(),
  subject_code  text not null references subjects(code) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  author        text,
  edition       text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint sb_id_subject unique (id, subject_code)
);
create unique index if not exists sb_one_default on subject_books (subject_code) where is_default;
create unique index if not exists sb_no_twin on subject_books (subject_code, lower(title), coalesce(edition, ''));

-- ---------- classes ----------
create table if not exists classes (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references sections(id) on delete cascade,
  subject_code  text not null references subjects(code),
  teacher_id    uuid references auth.users(id) on delete set null,   -- null: not yet assigned
  term          text not null check (length(trim(term)) > 0),
  book_id       uuid,                                                -- null: the subject's default
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  constraint classes_one unique (section_id, subject_code, term),
  -- The book is one of THIS subject's books.
  constraint classes_book_of_subject foreign key (book_id, subject_code)
    references subject_books (id, subject_code)
);

create or replace function classes_teacher_is_staff() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.teacher_id is not null and not exists (
    select 1 from profiles p
     where p.id = new.teacher_id and p.role in ('teacher','admin') and p.deleted_at is null
  ) then
    raise exception 'a class is held by a staff account; % is not one', new.teacher_id
      using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists classes_teacher_staff on classes;
create trigger classes_teacher_staff before insert or update of teacher_id on classes
  for each row execute function classes_teacher_is_staff();

-- ---------- the teacher roster ----------
create table if not exists teacher_directory (
  employee_id  text primary key check (employee_id ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,31}$'),
  full_name    text not null check (length(trim(full_name)) > 0),
  email        text,
  role         user_role not null default 'teacher' check (role in ('teacher','admin')),
  status       claim_status not null default 'unclaimed',
  claimed_by   uuid unique references auth.users(id) on delete set null,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- RLS ----------
alter table subjects          enable row level security;
alter table subject_books     enable row level security;
alter table classes           enable row level security;
alter table teacher_directory enable row level security;

drop policy if exists subj_read on subjects;
create policy subj_read on subjects for select to authenticated using (true);
drop policy if exists sbook_read on subject_books;
create policy sbook_read on subject_books for select to authenticated using (true);

drop policy if exists cls_read on classes;
create policy cls_read on classes for select to authenticated
  using (is_admin() or teacher_id = auth.uid() or section_id = my_section_id());

drop policy if exists tdir_admin_read on teacher_directory;
create policy tdir_admin_read on teacher_directory for select to authenticated
  using (is_admin());

-- ---------- seeds: CPE 412 and its books (CLAUDE.md "Textbook") ----------
insert into subjects (code, title)
values ('CPE 412', 'Computer Architecture and Organization')
on conflict (code) do nothing;

insert into subject_books (subject_code, title, author, edition, is_default)
select 'CPE 412', 'Computer Organization and Architecture: Designing for Performance',
       'William Stallings', v.edition, v.is_default
  from (values ('9th', true), ('10th', false)) as v(edition, is_default)
 where not exists (
   select 1 from subject_books b
    where b.subject_code = 'CPE 412' and coalesce(b.edition, '') = v.edition
 );

-- Every existing section becomes a CPE 412 class of its current teacher (or
-- unassigned), in its own term. Re-applying adds nothing.
insert into classes (section_id, subject_code, teacher_id, term)
select s.id, 'CPE 412',
       case when exists (select 1 from profiles p where p.id = s.teacher_id and p.role in ('teacher','admin'))
            then s.teacher_id end,
       s.term
  from sections s
on conflict (section_id, subject_code, term) do nothing;
