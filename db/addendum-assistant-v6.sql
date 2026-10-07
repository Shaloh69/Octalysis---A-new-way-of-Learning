-- OCTA -- the drafting assistant, round six (docs/AI-ASSISTANT-PLAN.md v6,
-- §4-six; instructor, 7 Oct 2026, night).
--
-- Applied TWELFTH, after addendum-assistant.sql. Idempotent; on a live
-- Supabase project on its own:
--     pnpm db:push --file db/addendum-assistant-v6.sql
--
-- Round six moved engine keys and engine calls OUT of OCTA: each teacher's
-- app holds that teacher's keys (Windows Credential Manager) and calls the
-- online engines from the laptop. So this RETIRES what B3's first session
-- put on the server the same night, on a database that has it:
--   - the cron job `octa-assistant-tick` and its two functions (the API no
--     longer runs steps, so nothing ticks it);
--   - the Vault secrets that tick read (octa_api_url, octa_cron_secret);
--   - `assistant_engine_keys` (B2's sealed keys) and a step's `key_id`.
-- A fresh database never gets them: addendum-assistant.sql no longer creates
-- them, and addendum-assistant-tick.sql is deleted. Nothing is lost: on the
-- deployment there were 0 keys, 0 jobs and 0 steps when this was written.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname = 'octa-assistant-tick';
  end if;
end $$;

drop function if exists assistant_tick();
drop function if exists assistant_tick_due();
drop index if exists aj_running;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'supabase_vault') then
    begin
      execute $q$ delete from vault.secrets where name in ('octa_api_url', 'octa_cron_secret') $q$;
    exception when insufficient_privilege then
      raise notice 'assistant v6: could not delete the tick''s Vault secrets; remove octa_api_url and octa_cron_secret in the dashboard';
    end;
  end if;
end $$;

alter table if exists assistant_steps drop constraint if exists as_own_key;
alter table if exists assistant_steps drop column if exists key_id;
drop table if exists assistant_engine_keys;
