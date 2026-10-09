# `/chat` (console) — SPEC

The instructor's side of the class chat (approved 6 Oct 2026;
`docs/CHAT-PLAN.md`). Gate: `design/specs/console-chat.spec.ts`. The database
half is `services/api/test/chat-rls.spec.ts`, the routes `chat.spec.ts`.

## Place

Under **In class** in the nav (Locks, Live, Chat): it is opened during a
lecture. No new group (a new group is the instructor's call).

## Controls against the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Conversations / Attachments** (tabs) | Which job the page does | `aria-selected`, an underline and weight | Switch back | — |
| **Room** (every section; private threads with a message) | That conversation, its "N new" goes | Name (section code mono), who is in it, counts in words | Pick another | — |
| **Message a student** + Open | Opens (or finds) the private thread with that student | Name and student ID | — | Reach the student who will not ask in front of the class |
| **Message**, **@ mention**, **Attach** | As `/app/chat` | As `/app/chat` | Delete one's own | — |
| **Remove** (anyone else's message) | The text disappears for everyone; kept in `audit_log` with the author and **a reason** | A dialog quoting the message; Remove disabled until a reason is given | No (the dialog is the guard); Keep it | Moderation is recorded, never silent |
| **Remove** (one attachment) / **Remove N older than D days** | Files deleted from storage; the messages stay, marked | Size of each file, used of 1 GB, a count on the button; a reason | No | Storage is 1 GB in all (ruling 2) |

Every one of those staff writes needs a reason and writes `audit_log`
(`apps/console/CLAUDE.md`: "every write that changes student-visible state").

## States

loading (nothing for 400 ms, then a skeleton of the rail and the room; past 3 s
words), error (with Try again), an empty room, no private threads yet (says
when one appears), no attachments (says what will appear), saving (Send reads
Uploading… / Sending…; the dialog's button Removing…). Attachments unavailable
locally: no Attach, and the hint says so.

## Toasts

One per action, what happened to what: "Message from Jocelyn Mae Sy Tan
removed", "board.png removed, 0.4 MB freed", "3 attachments removed". The
dialog is CLOSED before the toast is raised, because a toast under an open
Radix dialog is hidden from a screen reader (NEXT-SESSION §0zb.4, still parked
for the other dialogs).

## Captures (opened, 6 Oct 2026, build at 5186, demo staff)

`current.png` / `current-380.png` (the section's room) and
`current-attachments.png` / `-380` (storage). The first captures showed the
days field stretched across the card (the shared Input is w-full), the student
picker clipped to "Choose a studer", and the open room still counting "1 new"
after it was read; all three fixed, the last now asserted. The room holds the
spec runs' own test messages ("Clip check", "Kept, run ..."): a local artifact,
gone at the next `pnpm db:reset`.

---

## As remade, 9 Oct 2026 (Messenger's two screens)

The controls and the four tests above are unchanged; what moved is the shape. Gate:
`design/specs/console-chat.spec.ts` (the six assertions at both widths, plus five
claims for the new shape).

**Below 52rem of the page's own width it is two screens** (not a window width: the
sidebar takes 16rem at lg, so a 1024 window is already one pane).
- **Screen one, the rooms:** each row is a face (a generated planet seeded from the
  room's id), the room's name (a section code in mono), a line, the time of its last
  message, and "n new · m for you". **Message a student** is here. Opening the screen
  **reads nothing**: only opening a room marks it read (a test proves it against the
  API: a thread's unread count does not move until it is opened).
- **Screen two, one room:** the URL becomes `/chat?room=<id>` (a history entry, so
  the browser's Back and the header's arrow both return to the rooms). The page's own
  title, sentence and Conversations / Attachments tabs make way (`display: none`, so
  nothing invisible can take focus; the tabs are one Back away), leaving a slim header
  (arrow, face, name, who is in it), the log, and the composer.
- **At 52rem and up** both panes stay side by side (17rem rail), the first room open,
  now with faces and the same slim room header (no arrow).

**Messages are bubbles.** Others': left, with a face at the end of a run and the
author's name once at its start, in `--surface-2`. Yours: right, no face, in
`--accent-muted`, "You" in the text for a screen reader. A mention is `--info-bg` plus
the words "Mentions you". A **run** (same author, under five minutes, nothing deleted
between: `lib/chat-view.ts` `continues()`, tested) is drawn as one speaker.
**The staff's tools** (Remove; Remove picture where the server says `removable`; Delete
on your own, with its Keep) sit in the bubble's foot beside the time, one row, not two.

**The composer:** Attach, the field and Send are one row; the field grows with what is
typed, up to 12rem, then scrolls. The long placeholder is now the hint beneath ("Type @
to mention someone. Enter sends, Shift+Enter starts a new line."), because a one-row
field cut it off.

**Not built, said so:** a last-message preview on a row (the API gives the time, not
the text); a face for a private thread that is the student's own picture (a room has no
avatar in the API yet: the planet is the room's).

**Captures (opened, 9 Oct 2026):** `current.png` (1440, a room beside the rooms),
`current-380.png` (a room, screen two), `current-rooms-380.png` (screen one).
**Found by looking:** the rail at 15rem squeezed "BSCPE - 4" onto two lines beside a
face and a time (17rem, a medium face); a "Remove" row under every bubble doubled the
log's height (the tools moved into the bubble's foot); the long placeholder was cut off
at one row (it is the hint now); hiding the page's header with a 1px clip left its tabs
focusable and invisible (`display: none`).
