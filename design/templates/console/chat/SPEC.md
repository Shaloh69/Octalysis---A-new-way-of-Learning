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
