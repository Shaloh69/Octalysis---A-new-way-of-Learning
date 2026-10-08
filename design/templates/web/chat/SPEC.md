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

---

## As remade, 8 Oct 2026 (Messenger's two screens)

The controls and the four tests above are unchanged; what moved is the shape.
Gate: `web-chat.spec.ts` (now 36 per width-pair, incl. three on the two screens).

**A phone (899 and under) is two screens.**
- **Screen one, the rooms:** a list of rows (a generated planet as the room's
  face, the room's name, a line, the time of its last message, "n new · m for
  you"). No mission panel (it is for the map and the stages), no caption bar.
  The tabs stay: this is a hub screen. Opening it reads nothing: only opening a
  room marks it read (`roomId` is null until one is picked; a test proves the
  mentions count does not move).
- **Screen two, one room:** the URL becomes `/app/chat?room=<id>` (a history
  entry, so the browser's Back and the header's arrow both return to the list).
  The top strip, the tabs, the mission panel and the key hints are **gone**
  (`.star-shell.is-chat-thread`), and the room is the viewport tall: a slim
  header (arrow, face, name, who is in it), the log, and the composer docked at
  the bottom with Send (and Attach) **beside** the field, not under it.
- **A desktop (900 and up)** keeps both side by side in the HUD's panels, the first
  room open, now with faces and the same slim header (no back arrow).

**Messages are bubbles.** Others': left, with a face at the end of a run, the
author's name once at the start of a run, in `--surface-2`. Yours: right, no
face, in `--accent-muted` (the accent still marks only the student's own place),
and the author is in the text for a screen reader ("You"). A mention is
`--info-bg` plus the words "Mentions you". A **run** (same author, under five
minutes, nothing deleted between) is drawn as one speaker.

**Faces** are `Avatar`s: a person's picture where the viewer may see it (PROFILES,
`docs/PROFILES-PLAN.md`), else their generated planet; a room's face is a planet
seeded from its id.

**Not built, said so:** a last-message preview on a row (the API gives the time of
the last message, not its text); the console's `/chat` is unchanged (it has no
phone problem: it is a staff desktop page); a face for the private thread that is
the instructor's own picture (a room has no avatar in the API yet).

**Captures (opened, 8 Oct 2026):** `current-380-list.png` (screen one),
`current-380.png` (screen two, the section's room), `current.png` (1440).
**Found by looking:** Send sat alone on a row under the field (moved beside it);
the list kept its two-line heading and subtitle (the subtitle is hidden on the
list); and a spec had assumed `/app/chat` always opens a room, which is now false on a phone.
