# Class chat — plan, APPROVED (instructor, 6 Oct 2026)

Requested by the instructor, 6 Oct 2026: "a complete new page for both the
console teacher and students: a personalized group chat where they can mention,
ask, send screenshots or videos. Realtime: when a student or instructor sends a
message, all instances update immediately."

Not built yet. **Approved 6 Oct 2026, with these rulings (asked once):**

1. **Rooms: (c)** one room per section, plus a private thread between each
   student and the instructor.
2. **Attachments: (a)** screenshots and short videos, videos capped at **25 MB**,
   with an instructor view to delete old attachments (storage is 1 GB in all).
3. **During a paper: (a)** a student with a paper in progress cannot open or post
   in chat, enforced by the database.
4. **Order: next, before everything else** (before the questions for 09-12).

The template is still owed before any code (root CLAUDE.md).

## What it does

- **Pages:** `/app/chat` in the student app (star-system realm, a fourth nav item)
  and `/chat` in the console (under *In class* or *Students*). Same rooms, same
  messages, two looks.
- **Messages:** text, an @mention of anyone in the room (autocomplete from the
  room's members), and attachments: screenshots (images) and, if approved, short
  videos. A message can be deleted by its author; the instructor can remove any
  message (moderation), and that removal is recorded in `audit_log`.
- **Realtime:** every open chat updates the moment a message is sent, on every
  device, through **Supabase Realtime** (`postgres_changes` on the messages table,
  which applies the same row-level security as a read). No refresh, no polling.
- **Mentions:** a mention shows a count on the Chat nav item for the person
  mentioned until they open it.

## Rooms — **Q1**

- **(a) One room per section** (BSCPE-2A, BSCPE-2B, ...), each with that section's
  students and all staff. The instructor sees every room.
- **(b) One room for the whole course.**
- **(c) (a) plus private threads** between one student and the instructor, for
  questions a student will not ask in front of the class.

## Attachments — **Q2**

Supabase Free gives **1 GB of storage in total** and a **50 MB upload limit per
file**. A class of 40 sending a 20 MB phone video each fills most of it in a week.

- **(a) Screenshots and short videos**, videos capped (for example 25 MB) and kept
  for a term.
- **(b) Screenshots only** now; video when storage is paid for.

Files go to a private storage bucket; a viewer gets a short-lived signed link, so
an attachment is never a public URL.

## During a paper — **Q3**

Hard rule 9 says a paper is sat with no way off it. A chat is the easiest way to
pass answers.

- **(a) Recommended:** a student with a paper in progress cannot open or post in
  chat (the page says why); enforced by the database, not just hidden.
- **(b)** Chat closes for the whole class while any exam window is open.

## Data and security (for the record)

- New addendum `db/addendum-chat.sql`: `chat_rooms`, `chat_members`,
  `chat_messages` (append-only except a soft delete), RLS on all three, a storage
  bucket with its own policies. Pushed to the deployment before any code that uses
  it (hard rule 10).
- Denial tests first: a student cannot read another section's room, post as
  someone else, read a deleted message's text, or post during a paper.
- **The local stack has no Realtime or Storage** (it is plain Postgres). Locally the
  chat would fall back to refreshing every few seconds and attachments would be
  stubbed; the real thing is tested against a Supabase project.

## Template

A reference must be captured before building (`design/templates/web/chat/`,
`design/templates/console/chat/`): a public chat UI that renders without signing
in, chosen and captured at the start of the build.

## Where it goes in the order — **Q4**

Current order: questions for 09-12, the audiobook, the "Octalysis AI" decision,
then R5. The chat could go before the questions, after the audiobook, or last.
