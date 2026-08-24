-- ============================================================
-- OCTA — scheduled work
-- Apply FIFTH, after addendum-audit.sql.
--
-- Render's free tier has NO cron jobs (web services, static sites, Postgres and
-- key-value only), so every scheduled job in the original plan moves here.
-- pg_cron is available on every Supabase plan including free.
--
-- Three of the four jobs are BETTER here than they were on Render: they run
-- where the data is, with no network hop and no service to keep awake.
--
--   scheduled unlocks      pure SQL
--   nightly item_stats     pure SQL
--   nightly invariants     pure SQL
--   keep-alive ping        pg_net, outbound HTTP to /healthz
--
-- See docs/VERIFICATION.md V-26 and docs/DELIVERY.md §2.2.
--
-- LOCAL NOTE: pg_cron is a shared-library extension and is not installed in the
-- plain postgres:16-alpine image, so `create extension` is guarded. The
-- FUNCTIONS below are created either way and are unit-testable locally; only
-- the SCHEDULING needs Supabase.
-- ============================================================

do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (expected on local Docker); functions still created';
end $$;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net unavailable (expected on local Docker); keep-alive not scheduled';
end $$;

-- ============================================================
-- 1. Item statistics
--
-- p-value, discrimination and the distractor histogram, recomputed from
-- `responses`. This is P7's nightly job, written as SQL so it can be scheduled
-- in the database rather than in a service that has to be awake.
-- ============================================================
create or replace function recompute_item_stats()
returns table(items_updated int, items_flagged int)
language plpgsql security definer set search_path = public as $$
declare
  v_updated int := 0;
  v_flagged int := 0;
begin
  -- Per-attempt totals, used for the point-biserial correlation below.
  create temp table _attempt_totals on commit drop as
    select r.attempt_id,
           sum(case when r.is_correct then 1 else 0 end)::numeric as correct,
           count(*)::numeric as answered
      from responses r
      join attempts a on a.id = r.attempt_id
     where a.status = 'submitted'
     group by r.attempt_id;

  with per_item as (
    select ai.item_id,
           count(*)::int                                          as n_exposures,
           sum(case when r.is_correct then 1 else 0 end)::int      as n_correct,
           avg(case when r.is_correct then 1.0 else 0.0 end)       as p_value,
           -- Point-biserial: correlation between getting THIS item right and
           -- total score. A negative value means the item is backwards.
           corr(
             case when r.is_correct then 1.0 else 0.0 end,
             t.correct / nullif(t.answered, 0)
           )                                                       as discrimination
      from attempt_items ai
      join responses r on r.attempt_id = ai.attempt_id and r.ordinal = ai.ordinal
      join attempts a  on a.id = ai.attempt_id
      join _attempt_totals t on t.attempt_id = ai.attempt_id
     where a.status = 'submitted'
     group by ai.item_id
  ),
  upserted as (
    insert into item_stats (item_id, n_exposures, n_correct, p_value, discrimination, updated_at)
    select item_id,
           n_exposures,
           n_correct,
           round(p_value::numeric, 3),
           -- corr() returns DOUBLE PRECISION, and Postgres has no
           -- round(double precision, int) -- only the numeric overload. Without
           -- this cast the whole job raises at runtime, which is exactly what
           -- happened the first time it ran.
           -- corr() is also null when there is no variance; treat that as unknown.
           round(coalesce(discrimination, 0)::numeric, 3),
           now()
      from per_item
    on conflict (item_id) do update
      set n_exposures    = excluded.n_exposures,
          n_correct      = excluded.n_correct,
          p_value        = excluded.p_value,
          discrimination = excluded.discrimination,
          updated_at     = now()
    returning item_id
  )
  select count(*)::int into v_updated from upserted;

  -- Auto-flag after enough exposures to mean anything. AUDITS.md §1: flag
  -- p < 0.20 or p > 0.95, and discrimination < 0.20.
  with flagged as (
    update item_stats s
       set flagged = true,
           flag_reason = case
             when s.p_value < 0.20 then 'too hard: p-value below 0.20'
             when s.p_value > 0.95 then 'too easy: p-value above 0.95'
             when s.discrimination < 0.20 then 'poor discrimination: below 0.20'
           end
     where s.n_exposures >= 30
       and (s.p_value < 0.20 or s.p_value > 0.95 or s.discrimination < 0.20)
       and not s.flagged
    returning s.item_id
  )
  select count(*)::int into v_flagged from flagged;

  items_updated := v_updated;
  items_flagged := v_flagged;
  return next;
end $$;

-- ============================================================
-- 2. Scheduled unlocks
--
-- V-16 gave is_stage_unlocked() a lock_at predicate, so a window closes on its
-- own without anything running. This job exists for the OTHER half: recording
-- that a window opened or closed, so the audit log tells the story.
-- ============================================================
create or replace function apply_scheduled_locks()
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0;
begin
  with due as (
    select id, stage_id, scope, state, unlock_at, lock_at
      from stage_locks
     where (unlock_at is not null and unlock_at <= now() and unlock_at > now() - interval '10 minutes')
        or (lock_at   is not null and lock_at   <= now() and lock_at   > now() - interval '10 minutes')
  ),
  logged as (
    insert into audit_log (actor_id, action, target_type, target_id, payload)
    select null, 'lock.window', 'stage', d.stage_id,
           jsonb_build_object('lock_id', d.id, 'scope', d.scope, 'state', d.state,
                              'unlock_at', d.unlock_at, 'lock_at', d.lock_at)
      from due d
    returning id
  )
  select count(*)::int into v_count from logged;
  return v_count;
end $$;

-- ============================================================
-- 3. Nightly invariants -> audit_runs
-- ============================================================
create or replace function run_invariants_nightly()
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_results jsonb;
  v_passed  boolean;
  v_id      bigint;
begin
  select jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'severity', severity,
           'offending_count', offending_count, 'sample', sample))
    into v_results
    from run_invariants();

  -- On an unseeded database the bank-health checks legitimately have nothing to
  -- check; they must not page anyone.
  select not exists (
    select 1 from run_invariants()
     where severity = 'fail' and offending_count > 0
       and id not in ('INV-18','INV-27','INV-28','INV-29')
  ) into v_passed;

  insert into audit_runs (finished_at, triggered_by, results, passed)
  values (now(), 'cron', coalesce(v_results, '[]'::jsonb), v_passed)
  returning id into v_id;

  return v_id;
end $$;

-- ============================================================
-- 4. Schedule them
--
-- Guarded so this file applies cleanly to a database without pg_cron -- which
-- is every local Docker instance.
-- ============================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname)
       from cron.job
      where jobname in ('octa-item-stats','octa-scheduled-locks','octa-invariants','octa-keepalive');

    -- Nightly, 18:00 UTC = 02:00 Manila. After class, before morning.
    perform cron.schedule('octa-item-stats', '0 18 * * *',
      $job$ select recompute_item_stats() $job$);

    perform cron.schedule('octa-invariants', '30 18 * * *',
      $job$ select run_invariants_nightly() $job$);

    -- Every five minutes, matching the original plan's cadence.
    perform cron.schedule('octa-scheduled-locks', '*/5 * * * *',
      $job$ select apply_scheduled_locks() $job$);

    raise notice 'OCTA cron jobs scheduled';
  else
    raise notice 'pg_cron not installed; jobs not scheduled (expected on local Docker)';
  end if;
end $$;

-- ============================================================
-- 5. The keep-alive
--
-- Render Free spins down after 15 minutes and cold-starts in about a minute. A
-- cold start in front of a lecture hall is the worst failure mode in this
-- system, so Supabase pings /healthz on a schedule.
--
-- Deliberately NOT scheduled automatically: it needs the deployed API URL, and
-- pinging a URL that does not exist yet fills the logs with noise. Run this by
-- hand once Render is live, substituting the host:
--
--   select cron.schedule(
--     'octa-keepalive',
--     '*/10 6-20 * * 1-5',            -- every 10 min, 6am-8pm, weekdays
--     $$ select net.http_get('https://octa-api.onrender.com/healthz') $$
--   );
--
-- Note the window: 750 free instance-hours per month is about 730 hours of
-- always-on, so keeping the service awake around the clock consumes nearly the
-- entire monthly allowance. Class hours only leaves real headroom.
--
-- ALSO UNVERIFIED, and it matters: whether internal pg_cron activity counts as
-- "activity" for Supabase's 7-day inactivity pause. Confirm with a deliberately
-- quiet week in a scratch project before relying on it (VERIFICATION.md V-26.2).
-- ============================================================
