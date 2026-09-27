-- ---------------------------------------------------------------
-- A SEMESTER'S WORTH OF AUDIT HISTORY. Local demo fixture only.
--
-- The demo seed wrote no audit rows at all, so `/audit` opened on "Nothing
-- recorded yet" and none of its filters, its sentences or its Load older could
-- be seen or screenshotted against real rows. Found 28 Sep 2026 in the /audit
-- revamp.
--
-- ONLY events the seeded state agrees with. Each row is something that could
-- have produced the database as db-demo leaves it: the roster was imported,
-- 21 students claimed their accounts, items were moved to review, a stage was
-- opened for one student and handed back, labs were marked with the marks they
-- carry, the Prelim's window is what it now is. Nothing here claims a content
-- edit or a summary decision, because the seed has neither (the /audit spec
-- adds those through its fixture), and nothing is `assessment.salt_rotate`,
-- which /assessments reads back as "rotated".
--
-- Every row has a `dddddddd-` actor, so `demo-seed.sql`'s scoped delete takes
-- them all on the next run: no row here has a null actor, since audit_log is
-- append-only and a null-actor row could never be tidied away.
--
-- Runs AFTER sync-items and sync-assessments (it refers to both by slug and
-- title), from db-demo.mjs.
-- ---------------------------------------------------------------
begin;

-- 1. The roster, imported in the first week.
insert into audit_log (actor_id, action, target_type, target_id, payload, at)
select 'dddddddd-0000-4000-8000-000000000001', 'roster.import', 'section', 'BSCPE - 4',
       jsonb_build_object(
         'summary', jsonb_build_object('insert', count(*), 'update', 0, 'unchanged', 0, 'conflict', 0),
         'inserted', jsonb_agg(student_id order by student_id),
         'updated', '[]'::jsonb),
       date_trunc('day', now()) - interval '40 days' + interval '1 hour'
  from student_directory where student_id like '232129%';

-- 2. Each student who claimed an account, by their own hand.
insert into audit_log (actor_id, action, target_type, target_id, payload, at)
select d.claimed_by, 'auth.register', 'student_directory', d.student_id,
       jsonb_build_object('email', 'student' || right(d.student_id, 2) || '@example.com'),
       date_trunc('day', now()) - interval '39 days' + (row_number() over (order by d.student_id)) * interval '37 minutes'
  from student_directory d
 where d.student_id like '232129%' and d.claimed_by is not null;

-- 3. Act 1's items moved to review in one bulk step, as /items does it.
insert into audit_log (actor_id, action, target_type, target_id, payload, at)
select 'dddddddd-0000-4000-8000-000000000001', 'item.status', 'item', i.id::text,
       '{"from": "draft", "to": "review", "reason": null, "bulk": true}'::jsonb,
       date_trunc('day', now()) - interval '30 days' + interval '2 hours'
  from items i join stages s on s.id = i.stage_id
 where s.act = 1 and i.status = 'review';

-- 4. Stage 02 opened for one student for a makeup, then handed back to the chain.
insert into audit_log (actor_id, action, target_type, target_id, payload, at) values
  ('dddddddd-0000-4000-8000-000000000001', 'lock.set', 'stage', '02',
   '{"scope": "user", "userId": "dddddddd-1111-4000-8000-000000000005", "stageId": "02", "state": "unlocked",
     "reason": "Makeup for the missed quiz on 2 September; medical certificate on file"}'::jsonb,
   date_trunc('day', now()) - interval '20 days' + interval '1 hour 12 minutes'),
  ('dddddddd-0000-4000-8000-000000000001', 'lock.set', 'stage', '02',
   '{"scope": "user", "userId": "dddddddd-1111-4000-8000-000000000005", "stageId": "02", "state": "auto",
     "reason": "Makeup sat; back to the normal prerequisite chain"}'::jsonb,
   date_trunc('day', now()) - interval '18 days' + interval '6 hours 40 minutes');

-- 5. The graded labs, marked with the marks they carry.
insert into audit_log (actor_id, action, target_type, target_id, payload, at)
select 'dddddddd-0000-4000-8000-000000000001', 'submission.grade', 'submission', s.id::text,
       jsonb_build_object('score', s.score::float8, 'maxScore', s.max_score::float8),
       coalesce(s.graded_at, now() - interval '9 days')
  from submissions s
 where s.status = 'graded' and s.user_id::text like 'dddddddd-%';

-- 6. The Prelim's window, lifted: it had been set for 22 Sep, and the seed has
--    no window on it now, so the only honest change is one that removed it.
insert into audit_log (actor_id, action, target_type, target_id, payload, at)
select 'dddddddd-0000-4000-8000-000000000001', 'assessment.window', 'assessment', a.id::text,
       jsonb_build_object(
         'title', a.title,
         'reason', 'Classes suspended for the typhoon; the window is lifted until the Prelim is rescheduled',
         'from', jsonb_build_object(
           'opensAt', date_trunc('day', now()) - interval '6 days' + interval '08 hours',
           'closesAt', date_trunc('day', now()) - interval '6 days' + interval '10 hours',
           'attemptsAllowed', a.attempts_allowed),
         'to', jsonb_build_object('opensAt', a.opens_at, 'closesAt', a.closes_at, 'attemptsAllowed', a.attempts_allowed)),
       date_trunc('day', now()) - interval '5 days' + interval '3 hours'
  from assessments a
 where a.title = 'Prelim Examination';

-- Loud if a lookup ever matches nothing, instead of silently seeding less.
do $$
begin
  if (select count(distinct action) from audit_log
       where actor_id::text like 'dddddddd-%'
         and action in ('roster.import', 'submission.grade', 'assessment.window', 'item.status')) < 4 then
    raise exception 'demo-audit.sql: a lookup matched nothing (roster, graded labs, the Prelim or act-1 items)';
  end if;
end $$;

commit;
