-- OCTA -- leaving a paper submits it (instructor ruling 4, 6 Oct 2026).
--
-- Applied TENTH, after addendum-chat.sql. Idempotent, so it goes to a LIVE
-- project on its own:   pnpm db:push --file db/addendum-sitting.sql
--
-- Ruling 3 (30 Sep) covered the questions on a leave, recorded it, and left
-- the decision to the instructor: "never auto-submit". Ruling 4 replaces that:
-- leaving full screen, closing or reloading the page, or being away from it
-- for more than 15 seconds SUBMITS the paper with the answers recorded so
-- far, and that uses the attempt. A moon's journey is practice and is exempt.
--
-- Two new facts about a sitting, in the same append-only record:
--   closed          the page was closed, reloaded or navigated away from
--   auto_submitted  the paper was submitted because the student left it;
--                   written by the API, beside the submit
alter table attempt_events drop constraint if exists attempt_events_kind_check;
alter table attempt_events add constraint attempt_events_kind_check check (kind in (
  'left_fullscreen',        -- full screen exited mid-paper
  'left_page',              -- the tab or app went to the background
  'returned',               -- back in full screen / on the page
  'fullscreen_unavailable', -- the device cannot enter full screen (an iPhone)
  'closed',                 -- the page was closed, reloaded or left (ruling 4)
  'auto_submitted'          -- submitted because the student left (ruling 4)
));
