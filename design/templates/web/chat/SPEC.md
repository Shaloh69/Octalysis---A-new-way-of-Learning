# `/app/chat` — SPEC

The class chat (instructor, approved 6 Oct 2026; `docs/CHAT-PLAN.md`, four
rulings). Gate: `design/specs/web-chat.spec.ts`; the database's half is
`services/api/test/chat-rls.spec.ts`, the routes' `chat.spec.ts`.

## Realm

The star system: `html[data-realm="star"]`, the star shell. Chat is the sixth
tab (between Your work and Settings), carrying the count of unread @mentions
(mono, and in the tab's accessible name: "Chat, 2 unread mentions").

## Controls against the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Room** (section's room, private thread) | Shows that conversation; its unread count goes | Name, who is in it, "N new · M for you" in words | Pick the other | Where to ask what |
| **Message** + Send (Enter; Shift+Enter a new line) | The room reads it at once, on every open instance (Realtime) | "You" and the accent edge on your own | Delete | Asking is the course |
| **@ mention** (a listbox of the room's people, arrows + Enter/Tab, Esc) | That person sees "Mentions you" and a count on their Chat tab | The name in bold, "Mentions you" in words | Delete the message | — |
| **Attach** (deployment only) | A screenshot or a video of 25 MB or less, in the message | Name and size (mono) before sending; Remove | Remove before sending; delete after | — |
| **Delete** (own messages) | The text is gone for everyone; a tombstone says "Message deleted." | Asks "Delete it for everyone?" first | No: the confirm is the guard | — |
| **Show earlier messages** | The 100 before | — | — | — |

## States

- **loading**: nothing for 400 ms, then a skeleton of the two panels; past 3 s
  words ("The server is waking up").
- **closed** (a paper open, ruling 3, `423 paper_open`): one panel saying why,
  no rooms, no composer, "Check again". The DATABASE enforces it; the page only
  explains.
- **error**: what happened and "Try again".
- **empty room**: an invitation, different for the section and the thread.
- **no room** (not on a roster): says to ask the instructor.
- **saving**: Send reads "Uploading…" then "Sending…" and is disabled; a failed
  send keeps the text and raises an error toast that stays.
- **attachments unavailable** (the local stack: no Storage): no Attach control,
  and the hint says so.

## Colour

The accent marks only the student's own messages (their place). A mention of
them is `--info-bg` plus the words "Mentions you", never colour alone. Section
codes, times and sizes are mono.

## Realtime

`lib/chat-live.ts`: `postgres_changes` on `chat_messages`, which RLS filters to
the rooms the reader may open; the event only says WHEN, the page reads through
the API. No Realtime (local, or a channel that fails to join in 10 s): a 5 s
poll while the tab is visible.

## Captures (opened, 6 Oct 2026, build at 5185, student 232129006)

`current.png` / `current-380.png` (the section's room, a mention of her),
`current-thread.png` / `current-thread-380.png` (the private thread). The first
capture showed the instructor's reply twice (two workers seeded at once: the
fixture now takes a lock) and the composer under the fold at 1440 by 900 (the
log is now sized from the viewport). 380 captures are full page: the fixed
bottom bar lands mid-image, an artifact of the capture.
