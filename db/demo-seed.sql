-- ============================================================
-- OCTA — demo cohort. LOCAL ONLY. NEVER run this against Supabase.
--
-- WHY THIS FILE EXISTS
--
-- Every console page is a view over data, so with an empty database all
-- fourteen of them render their empty state. A design review against fourteen
-- empty states reviews the empty states — which are real work, but they are not
-- what a teacher looks at on a Tuesday. This fills the tables enough that
-- Students is a list, Gradebook is a distribution, and Submissions has a queue
-- with something overdue in it.
--
-- EVERY NAME HERE IS INVENTED, and that is a feature rather than laziness.
--
-- Console screenshots carry whatever is on screen, and /students, /gradebook
-- and /attempts are rosters. Captures taken against this cohort can be pasted
-- into a design document, a commit, or a chat with no thought at all, because
-- there is no one to expose. Captures taken against a real class cannot. The
-- surnames follow the convention `apps/console/CLAUDE.md` calls out — `Dela
-- Cruz, Juan Miguel` is the normal case in a Cebu section, not an edge case,
-- and a layout that only fits `Smith, J.` will break here.
--
-- The distribution is deliberately UNEVEN. A cohort where everyone scores 75%
-- makes every chart look correct and hides the two things a teacher opens the
-- gradebook to find: who is drowning, and which item everybody missed.
--
-- Run:  docker exec -i octa-db psql -U postgres -d octa < db/demo-seed.sql
--
-- RUNNING THE TEST SUITE DESTROYS THIS. `pnpm verify` calls `resetAll()`, which
-- truncates the tables and re-seeds its own fixtures -- two students called
-- Student A and Student B. If the console suddenly shows a class of two, that
-- is what happened. Re-run this file.
-- ============================================================

begin;

-- ---------------------------------------------------------------
-- Clean out any previous demo run.
--
-- Order is FK order, and `responses`/`attempt_items` come first because the
-- append-only triggers on them reject UPDATE and DELETE for service_role too.
-- The demo user ids are all prefixed `dddddddd-` so this can never touch a row
-- someone created by hand.
-- ---------------------------------------------------------------
set local octa.allow_regrade = 'on';

delete from feedback        where user_id::text like 'dddddddd-%';
delete from submissions     where user_id::text like 'dddddddd-%';
delete from stage_progress  where user_id::text like 'dddddddd-%';
delete from level_progress  where user_id::text like 'dddddddd-%';
delete from attempts        where user_id::text like 'dddddddd-%';
delete from audit_log       where actor_id::text like 'dddddddd-%';
delete from stage_locks     where scope_user_id::text like 'dddddddd-%';
delete from profiles        where id::text like 'dddddddd-%';
delete from student_directory where student_id like '232129%';
delete from assessments     where title like '[demo]%';
-- Sections BEFORE auth.users (sections.teacher_id references the teacher), and
-- assessments must let go of the section first. Both FKs were found by running
-- this file twice, which is the only way a teardown block ever gets tested.
update assessments set section_id = null;
delete from sections        where code = 'BSCPE - 4';
delete from auth.users      where id::text like 'dddddddd-%';

-- ---------------------------------------------------------------
-- The section and its teacher.
-- ---------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data) values
  ('dddddddd-0000-4000-8000-000000000001', 'teacher@octa.local',
   '{"role":"teacher"}'::jsonb);

insert into sections (id, code, term, teacher_id) values
  ('dddddddd-5EC0-4000-8000-000000000001', 'BSCPE - 4', '2026-2027 First Semester',
   'dddddddd-0000-4000-8000-000000000001');

insert into profiles (id, student_id, full_name, section_id, role, theme, accent_hue) values
  ('dddddddd-0000-4000-8000-000000000001', null, 'Prof. Amalia R. Bontuyan',
   'dddddddd-5EC0-4000-8000-000000000001', 'teacher', 'blueprint', 210);

-- ---------------------------------------------------------------
-- Twenty-four students.
--
-- Names are generated from two lists so the file stays short, but the SURNAMES
-- are the point: two-word family names, compound given names, and one that is
-- long enough to test truncation rather than merely fit.
-- ---------------------------------------------------------------
with names(n, sur, given) as (values
  (1,'Dela Cruz','Juan Miguel'),        (2,'Bacaltos','Maria Angelica'),
  (3,'Villanueva','Kim Patrick'),       (4,'Sy Tan','Jocelyn Mae'),
  (5,'Abellana','Rafael Antonio'),      (6,'Montebon','Kristine Joy'),
  (7,'Diaz','Emmanuel'),                (8,'Pahayahay','Reymart'),
  (9,'Go','Angelo'),                    (10,'Enriquez','Bea Katrina'),
  (11,'Alcantara','Josue'),             (12,'Ompad','Shaira Nicole'),
  (13,'Baguio','Christian Dave'),       (14,'Rosales','Trisha Anne'),
  (15,'Nuñez','Lorenzo'),               (16,'Cabahug','Danica'),
  (17,'Tumulak','Jerome'),              (18,'Sarmiento','Ma. Cristina'),
  (19,'Lauron','Gabriel Luis'),         (20,'Ybañez','Katherine'),
  (21,'Paglinawan-Reyes','Jose Mari'),  (22,'Osmeña','Andrea Nicole'),
  (23,'Canete','Mark Joseph'),          (24,'Fuentes','Hannah Grace')
),
mk as (
  select n,
         ('dddddddd-1111-4000-8000-' || lpad(n::text, 12, '0'))::uuid as uid,
         '2321290' || lpad(n::text, 2, '0')                           as sid,
         given || ' ' || sur                                          as full_name
  from names
)
, u as (
  insert into auth.users (id, email, raw_app_meta_data)
  select uid, lower(replace(sid,' ','')) || '@student.uc.edu.ph', '{"role":"student"}'::jsonb
  from mk
  returning id
)
, d as (
  insert into student_directory (student_id, full_name, section_id, status, claimed_by, claimed_at)
  select sid, full_name, 'dddddddd-5EC0-4000-8000-000000000001',
         -- Three students have not claimed their account yet. A roster where
         -- everyone has signed in never shows the state a teacher chases.
         case when n > 21 then 'unclaimed'::claim_status else 'claimed'::claim_status end,
         case when n > 21 then null else uid end,
         case when n > 21 then null else now() - (n || ' days')::interval end
  from mk
  returning student_id
)
insert into profiles (id, student_id, full_name, section_id, role, theme, accent_hue)
select uid, case when n > 21 then null else sid end, full_name,
       'dddddddd-5EC0-4000-8000-000000000001', 'student',
       (array['bare-metal','blueprint','phosphor'])[1 + (n % 3)],
       (n * 37) % 360
from mk;

-- ---------------------------------------------------------------
-- Progress. Uneven on purpose — see the header.
--
-- Four students are clearly struggling, four are well ahead, the rest sit in a
-- band. Stage 06 is where the cohort falls off, which is the shape a gradebook
-- exists to make visible.
-- ---------------------------------------------------------------
insert into stage_progress (user_id, stage_id, mastery, best_score, attempts, last_seen_at)
select p.id,
       s.stage_id,
       greatest(0, least(1.0, round((
         case
           when (('x'||substr(md5(p.id::text),1,4))::bit(16)::int % 24) < 4 then 0.34
           when (('x'||substr(md5(p.id::text),1,4))::bit(16)::int % 24) > 19 then 0.93
           else 0.68
         end
         + (((('x'||substr(md5(p.id::text||s.stage_id),1,4))::bit(16)::int % 21) - 10) / 100.0)
         -- The cliff: chapter 06 is measurably harder for everyone.
         - case when s.stage_id = '06' then 0.18 else 0 end
       )::numeric, 2))),
       null, 1 + (('x'||substr(md5(p.id::text||s.stage_id),5,3))::bit(12)::int % 3),
       now() - ((('x'||substr(md5(p.id::text),9,2))::bit(8)::int % 14) || ' days')::interval
from profiles p
cross join (select unnest(array['01','02','03','04','05','06','07']) as stage_id) s
where p.role = 'student' and p.student_id is not null;

-- ---------------------------------------------------------------
-- Submissions — the marking queue, with every status a teacher must handle.
-- ---------------------------------------------------------------
insert into submissions
  (user_id, kind, stage_id, slug, title, body_md, status, submitted_at,
   score, max_score, feedback_md, graded_by, graded_at, due_at)
select p.id,
       'lab'::submission_kind,
       lab.stage_id,
       'lab-' || lab.stage_id,
       'Laboratory ' || lab.stage_id || ' — ' || lab.title,
       'Attached is my trace table and the observed cycle count.' || E'\n\n' ||
       'The stall on the third instruction was not what I expected.',
       st.status,
       case when st.status = 'draft' then null else now() - (lab.n || ' days')::interval end,
       case when st.status = 'graded' then round((60 + (('x'||substr(md5(p.id::text||lab.stage_id),1,2))::bit(8)::int % 41))::numeric, 0) end,
       case when st.status = 'graded' then 100 end,
       case when st.status = 'graded' then 'Trace is correct. Say WHY the stall happens, not just where.' end,
       case when st.status = 'graded' then 'dddddddd-0000-4000-8000-000000000001'::uuid end,
       case when st.status = 'graded' then now() - ((lab.n - 1) || ' days')::interval end,
       -- A third of these are past due, so `is_late` has something to compute.
       now() - ((lab.n - 2) || ' days')::interval
from profiles p
cross join (values ('03', 3, 'Instruction cycle trace'),
                   ('05', 6, 'Cache mapping by hand'),
                   ('07', 9, 'I/O mechanism comparison')) as lab(stage_id, n, title)
cross join lateral (
  select (case (('x'||substr(md5(p.id::text||lab.stage_id),3,2))::bit(8)::int % 5)
            when 0 then 'draft' when 1 then 'submitted' else 'graded' end)::submission_status as status
) st
where p.role = 'student' and p.student_id is not null
  -- Not everyone hands in everything. An empty cell is information.
  and (('x'||substr(md5(p.id::text||lab.stage_id),7,2))::bit(8)::int % 7) <> 0;

insert into submissions
  (user_id, kind, slug, title, body_md, status, submitted_at, score, max_score, due_at)
select p.id, 'project'::submission_kind, 'final-project',
       'Final Project — Single-cycle datapath',
       'Repository link and the design document are attached.',
       'submitted'::submission_status,
       now() - interval '2 days', null, null, now() + interval '12 days'
from profiles p
where p.role = 'student' and p.student_id is not null
  and (('x'||substr(md5(p.id::text),11,2))::bit(8)::int % 3) = 0;

-- ---------------------------------------------------------------
-- Feedback, so /feedback is not an empty page either.
-- ---------------------------------------------------------------
insert into feedback (user_id, role, channel, status, body, created_at)
select p.id, 'student'::user_role, ch.channel::feedback_channel, ch.status::feedback_status, ch.body,
       now() - ((('x'||substr(md5(p.id::text),13,2))::bit(8)::int % 10) || ' days')::interval
from profiles p
cross join (values
  ('content_report','new','The hit-rate question says 4 KB but the table below it says 8 KB.'),
  ('flag','triaged','Two of the choices here look like the same answer written differently.'),
  ('csat','shipped','The trace animation on stage 3 finally made the fetch-decode-execute click.')
) as ch(channel, status, body)
where p.role = 'student' and p.student_id is not null
  and (('x'||substr(md5(p.id::text||ch.channel),1,2))::bit(8)::int % 4) = 0;

-- ---------------------------------------------------------------
-- Evict the test suite's own fixtures.
--
-- `pnpm verify` leaves `Student A` / `Student B` in `BSCPE-2A` behind. They are
-- harmless to the tests and ruinous to a screenshot: a roster that is 24 real
-- names and two placeholders reads as a bug in the product rather than as
-- residue from a test run.
--
-- Assessments are REPOINTED rather than deleted -- an assessment with attempts
-- against it is evidence, and the console has a page for them.
-- ---------------------------------------------------------------
delete from feedback       where user_id in (select id from profiles where id::text not like 'dddddddd-%');
delete from submissions    where user_id in (select id from profiles where id::text not like 'dddddddd-%');
delete from stage_progress where user_id in (select id from profiles where id::text not like 'dddddddd-%');
delete from level_progress where user_id in (select id from profiles where id::text not like 'dddddddd-%');
delete from attempt_items  where attempt_id in (select a.id from attempts a join profiles p on p.id = a.user_id
                                                 where p.id::text not like 'dddddddd-%');
delete from responses      where attempt_id in (select a.id from attempts a join profiles p on p.id = a.user_id
                                                 where p.id::text not like 'dddddddd-%');
delete from attempts       where user_id in (select id from profiles where id::text not like 'dddddddd-%');
update student_directory set claimed_by = null, status = 'unclaimed'
  where claimed_by in (select id from profiles where id::text not like 'dddddddd-%');
delete from profiles       where id::text not like 'dddddddd-%';
delete from student_directory where student_id not like '232129%';
update assessments set section_id = 'dddddddd-5EC0-4000-8000-000000000001' where section_id is not null;
delete from sections where code <> 'BSCPE - 4';

-- ---------------------------------------------------------------
-- ONE ITEM WITH REAL PSYCHOMETRICS.
--
-- Every item in a fresh bank has zero exposures, so `/console/items` showed
-- nothing but "not enough exposures" on every row -- which meant the branch
-- that actually matters, and the one a teacher opens the page FOR, could not be
-- seen, screenshotted or reviewed by anybody.
--
-- These numbers describe the loud failure on purpose: a p-value of 0.18 is at
-- guessing, and a NEGATIVE point-biserial means the students who did best on
-- the paper did worst on this item, which almost always means the key is wrong.
-- The page says exactly that, and now there is data to make it say it.
--
-- Deliberately ONE item. This is a fixture for reviewing a rare state, not a
-- claim that the bank is in trouble.
-- ---------------------------------------------------------------
insert into item_stats (item_id, n_exposures, n_correct, p_value, discrimination, flagged, flag_reason)
select id, 120, 22, 0.18, -0.12, true, 'Negative discrimination on the last two papers'
  from items
 where slug = 'G-07-order-1'
on conflict (item_id) do update set
  n_exposures    = excluded.n_exposures,
  n_correct      = excluded.n_correct,
  p_value        = excluded.p_value,
  discrimination = excluded.discrimination,
  flagged        = excluded.flagged,
  flag_reason    = excluded.flag_reason;

commit;
