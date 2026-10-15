-- OCTA -- more facts about a sitting (docs/ANTI-CHEAT.md, 15 Oct 2026; instructor: "detect keys or switching to a
-- new desktop also, like the Windows key, Ctrl and arrow keys, and switching").
--
-- Applied TWENTY-THIRD, after addendum-staff-chat.sql. Idempotent; on a live Supabase project on its own:
--     pnpm db:push --file db/addendum-sitting-guards.sql
--
-- attempt_events is append-only and API-written (hard rule 9). Five new kinds join the list, all REPORTED BY THE
-- PAGE during a paper (a stage check, a moon check, an exam); each is a fact the instructor reads, never a verdict:
--   lost_focus      the window lost focus while still visible: Alt+Tab, the Start menu, a switch to another
--                   virtual desktop, a click on another monitor. The paper is covered; away over 15 s hands it in
--   system_key      a key the browser should never see in a paper: the Windows/Command key, Alt+Tab, Ctrl+Alt or
--                   Ctrl+Win with an arrow (virtual desktops), PrintScreen. The paper is covered at once
--   blocked_action  copy, cut, paste, the context menu, print, view-source or the developer tools, refused
--   screen_changed  the window narrowed a lot (split screen, a floating window) or a second screen is connected
--   second_tab      the same paper is open in another tab or window of this browser
alter table attempt_events drop constraint if exists attempt_events_kind_check;
alter table attempt_events add constraint attempt_events_kind_check check (kind in (
  'left_fullscreen',        -- full screen exited mid-paper
  'left_page',              -- the tab or app went to the background
  'returned',               -- back in full screen / on the page
  'fullscreen_unavailable', -- the device cannot enter full screen (an iPhone)
  'closed',                 -- the page was closed, reloaded or left (ruling 4)
  'auto_submitted',         -- submitted because the student left (ruling 4)
  'lost_focus',             -- the window lost focus while visible
  'system_key',             -- Windows/Command key, Alt+Tab, a desktop-switching chord, PrintScreen
  'blocked_action',         -- copy, paste, context menu, print, view source, developer tools
  'screen_changed',         -- split screen, a narrowed window, a second screen
  'second_tab'              -- the same paper open in another tab
));
