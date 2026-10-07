# The assistant chat bot in the console — template source (same as the student app's)

Instructor, 7 Oct 2026 (night): outside the AI Assistant page the assistant
is also a chat bot; "find templates online for that too". The same bot in
both apps: `design/templates/console/assistant-bot/` holds the same files.
Plan: `docs/STUDY-AND-BOT-PLAN.md`.

**https://www.assistant-ui.com/examples/modal** ("Floating Modal Chat ·
assistant-ui"), captured 7 Oct 2026 with Playwright, HTTP 200, signed out.
Opened and looked at, each file:

- `template-closed.png` (1440): the page with the bot closed: one round
  launcher fixed bottom right, nothing else of the bot on screen.
- `template.png` (1440): opened by clicking the launcher (it has NO
  accessible name: the capture had to click by position, `xy:1402,862`).
  A panel anchored above the launcher, about 400 × 500: a header ("New
  Chat", history, new chat), an empty state ("How can I help you
  today?"), a composer (attach, voice, send) and three suggested prompts;
  the launcher turns into a close chevron.
- `template-380.png`: the same opened at 380 (`xy:342,762`): the panel
  becomes a near-full-width sheet, the composer and suggestions stay; the
  suggestions truncate with an ellipsis.

**Taken:** the STRUCTURE: a launcher in a fixed corner; a panel with a
header (new chat, past chats), the conversation, a docked composer and
suggested prompts on an empty conversation; a sheet at 380.

**Not taken:** its colours and type (ours come from `packages/tokens`: the
star HUD in the student app, the console's three themes; inside a planet the
biome dresses the bot's chrome, never a paper). Its **unlabelled launcher**
(ours is a real button with an accessible name and a keyboard shortcut).
Its voice button. Its truncated suggestions at 380 (ours wrap).

**Never on a paper:** the bot and its launcher do not exist on a stage check,
an exam or Lecture Mode (hard rule 9), not merely hidden.

Rejected: none for this one.
