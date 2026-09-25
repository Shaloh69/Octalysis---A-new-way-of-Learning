-- ---------------------------------------------------------------
-- ONE ITEM WITH REAL PSYCHOMETRICS. Local demo fixture only.
--
-- Every item in a fresh bank has zero exposures, so `/items` showed nothing
-- but blank statistics on every row -- which meant the branch that actually
-- matters, and the one a teacher opens the page FOR, could not be seen,
-- screenshotted or reviewed by anybody.
--
-- These numbers describe the loud failure on purpose: a p-value of 0.18 is at
-- guessing, and a NEGATIVE point-biserial means the students who did best on
-- the paper did worst on this item, which almost always means the key is wrong.
--
-- WHY THIS IS ITS OWN FILE, run by `db-demo.mjs` AFTER `sync-items.mjs`.
-- It used to sit at the bottom of `demo-seed.sql`, which runs BEFORE the item
-- bank is synced, and it named slug `G-07-order-1`, which no longer exists.
-- `insert ... select from items where slug = ...` matched nothing, silently,
-- and `console-items.spec.ts`'s flagged-item test had no flagged item to find
-- for as long as that was true. Found 25 Sep 2026 in the /items revamp.
--
-- `07-channel-evolution` is a type-G ordering item, like the one it replaces,
-- and it is OUTSIDE act 1, so this fixture never touches the Prelim bank.
-- Deliberately ONE item: a fixture for reviewing a rare state, not a claim
-- that the bank is in trouble.
-- ---------------------------------------------------------------
begin;

insert into item_stats (item_id, n_exposures, n_correct, p_value, discrimination, flagged, flag_reason)
select id, 120, 22, 0.18, -0.12, true, 'Negative discrimination on the last two papers'
  from items
 where slug = '07-channel-evolution'
on conflict (item_id) do update set
  n_exposures    = excluded.n_exposures,
  n_correct      = excluded.n_correct,
  p_value        = excluded.p_value,
  discrimination = excluded.discrimination,
  flagged        = excluded.flagged,
  flag_reason    = excluded.flag_reason;

-- Loud if the slug ever moves again, instead of silently seeding nothing.
do $$
begin
  if not exists (select 1 from item_stats where flagged) then
    raise exception 'demo-item-stats.sql: slug 07-channel-evolution not found; the flagged fixture seeded nothing';
  end if;
end $$;

commit;
