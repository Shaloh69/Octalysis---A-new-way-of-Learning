-- OCTA -- the drafting assistant's tick (B3; docs/AI-ASSISTANT-PLAN.md v5
-- §4-now; .claude/rules/assistant.md "The API calls the engines").
--
-- Applied TWELFTH, after addendum-assistant.sql. Idempotent, so it goes to a
-- LIVE Supabase project on its own:
--     pnpm db:push --file db/addendum-assistant-tick.sql
--
-- Render Free has no cron (CLAUDE.md). So Supabase Cron checks once a minute
-- whether any assistant job is RUNNING and, only then, POSTs
--     <octa_api_url>/internal/assistant/tick
-- through pg_net with the shared secret in an `x-cron-secret` header. With no
-- job running nothing calls the API, and Render sleeps as it does today.
--
-- Two Vault secrets, set once per project by hand, never in this file:
--     select vault.create_secret('https://<the API>', 'octa_api_url');
--     select vault.create_secret('<the CRON_SECRET Render has>', 'octa_cron_secret');
-- Without either the tick does nothing and says so (a NOTICE), which is the
-- state of every local Docker database: no pg_cron, no pg_net, no Vault.

-- Is there work? One indexed probe; the cron job runs it every minute.
create index if not exists aj_running on assistant_jobs (updated_at) where status = 'running';

create or replace function assistant_tick_due() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from assistant_jobs where status = 'running')
$$;

-- Returns pg_net's request id, or null when it did not call (nothing running,
-- or the project is not set up for it). Dynamic SQL, so the function is
-- created on a database that has no `net` or `vault` schema.
create or replace function assistant_tick() returns bigint
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_url    text;
  v_secret text;
  v_id     bigint;
begin
  if not assistant_tick_due() then
    return null;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net')
     or not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise notice 'assistant tick: pg_net or Vault is not installed; a running job is not being ticked';
    return null;
  end if;
  execute $q$ select decrypted_secret from vault.decrypted_secrets where name = 'octa_api_url' $q$ into v_url;
  execute $q$ select decrypted_secret from vault.decrypted_secrets where name = 'octa_cron_secret' $q$ into v_secret;
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise notice 'assistant tick: Vault secrets octa_api_url / octa_cron_secret are not set; a running job is not being ticked';
    return null;
  end if;
  -- The API answers 202 at once and runs the step after replying, so the
  -- timeout covers only a warm reply. A cold start may miss it; the next
  -- minute's tick finds the API awake.
  execute $q$ select net.http_post(
                url := $1, body := '{}'::jsonb,
                headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', $2),
                timeout_milliseconds := 10000) $q$
    into v_id using rtrim(v_url, '/') || '/internal/assistant/tick', v_secret;
  return v_id;
end $$;

-- Nobody but the owner (and cron, which runs as the owner) calls either.
revoke all on function assistant_tick_due() from public, anon, authenticated;
revoke all on function assistant_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname = 'octa-assistant-tick';
    perform cron.schedule('octa-assistant-tick', '* * * * *', $job$ select assistant_tick() $job$);
    raise notice 'octa-assistant-tick scheduled (calls the API only while a job is running)';
  else
    raise notice 'pg_cron not installed; octa-assistant-tick not scheduled (expected on local Docker)';
  end if;
end $$;
