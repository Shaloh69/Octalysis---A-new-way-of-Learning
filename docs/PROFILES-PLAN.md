# Profile pages and profile pictures — plan v1, APPROVED 7 Oct 2026 (night), nothing built

Instructor, 7 Oct 2026 (night):

> "For the web students add a profile page where they can add profile
> images; add that to the admin and teachers too."

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | Who gets a profile page | **Students** (`apps/web`), **teachers and the admin** (`apps/console`) |
| 2 | Who sees an uploaded picture | **Classmates and teachers**: the class chat, the roster, the teacher's views |
| 3 | The safeguard | **Shown at once, removable**: any teacher of that student, or the admin, can remove a picture; every removal is audited |

**This reverses `DESIGN-MANDATE.md` §4** ("store a string instead of an image
and never ask users to upload a profile picture"). What survives of §4: the
**generated avatar, seeded from the student ID**, is what everyone shows
until they upload a picture, and again after one is removed. It is not
built yet either (`routes/cosmetics.ts` notes it); it is built here, as the
fallback, from the seed `/cosmetics` already derives.

## 1. The pages (new routes; each through the page gate)

- **`/app/profile`** (student, the star-system HUD realm, `WEB-REMAKE.md`):
  the picture (upload, replace, remove), name, student ID, section and
  classes, read-only. Linked from the nav and from `/app/settings`'s
  "profile" entry (`PAGE-SPECS.md` §`/app/settings` names one).
- **`/profile`** (console, teacher and admin): the same, with employee ID and
  the classes they hold.
- **Removing someone's picture** (console): on `/students/:userId`, and on a
  message in the class chat. A teacher removes only their own students'
  pictures (T2's class scoping; until T2, any teacher); the admin, anyone's.
  The student sees "Your picture was removed by your teacher".

Each page is born with a captured template, a `SPEC.md`, and a spec green at
1440 and 380 with its screenshots opened and looked at.

## 2. Storage and safety

- **A private bucket** `profile-images` (as `chat-attachments`): no client
  policy; the API signs one upload to a path it chooses
  (`<user_id>/<random>.webp`) and signs short-lived downloads only for a
  viewer allowed to see that person (same class, their teacher, the admin).
  Never a public URL.
- **Re-encoded before upload:** the browser crops to a square and re-encodes
  to a 512 × 512 WebP on a canvas, which drops EXIF (a phone photo's GPS
  position included). The API checks the bytes really are WebP and at most
  300 KB before it records the picture.
- **The record:** `profiles.avatar_path` and `avatar_updated_at`, written by
  the API only (no client write path; a column grant decided on purpose,
  `db/CLAUDE.md` V-29). A removal writes `audit_log` (who, whose, when) and
  deletes the object. An idempotent addendum, on Supabase before the code.
- **Denial tests, red first:** a student cannot set another student's
  picture, cannot read a picture outside their classes, cannot remove one; a
  teacher cannot remove a picture of a student outside their classes (from
  T2); anon reads nothing.

## 3. Where pictures appear

The web nav's own-avatar spot, the class chat (both apps), the console's
roster and `/students/:userId`, the console shell's avatar
(`AppShell.tsx`'s `shell-avatar`), and `/teachers` and `/teachers/:id` for
the admin. Never on a stage check or an exam paper: `[data-paper]` stays
identical for everyone (CLAUDE.md "Design").

## 4. Order

**APPROVED (7 Oct 2026, night):** after T1 (teacher accounts), before T2.
The whole order: T1 → profiles → T2 → the student bot and the Study Session
→ the assistant's app and the teacher's bot.
