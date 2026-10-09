# `/profile` (teacher and admin) — SPEC

PROFILES, `docs/PROFILES-PLAN.md` ("add that to the admin and teachers too").
Reference: `template.png` / `template-380.png` (shadcn-admin's Settings > Profile,
`SOURCE.md`). The student's page is `design/templates/web/profile/SPEC.md`; this
one follows its picture controls word for word and takes its layout from the
console. Gate: `design/specs/console-profile.spec.ts` (the six assertions at 1440
and 380 on all three themes, then the claims below; 46 tests, green 9 Oct 2026). The server's half is
`services/api/test/profile.spec.ts` and `profiles-rls.spec.ts` (71 tests).

## Where it is

`/profile`, behind the staff guard like every console route. Linked from the
shell's **account menu** ("Your profile", above Theme), never from the nav: it
is the person's, not a section of the console. The menu's avatar and the
page's are the same picture, and a change shows in both at once.

## What it shows

Three cards in one column on the template's rule (title and a sentence over a
rule, then cards), side by side from `lg` (the picture on the left, the facts
and classes on the right), stacked below.

1. **Picture** — the picture in a round frame (the generated planet when none),
   the actions, and one honest note about who sees it.
2. **Who you are** (read-only) — name; role (Teacher / Admin); **Employee ID**
   (mono, from `teacher_directory`; "Not on the roster" when none); email
   (from the session).
3. **Your classes** — the classes this person holds (`classes.teacher_id`, not
   ended): code (mono), title, section, term. Empty: "You hold no class yet.
   The admin assigns one on Teachers." (the admin's own is the same list).

## Controls, against the four tests (`DESIGN-MANDATE.md` §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| **Choose a picture** (a label wrapping the real file input) | Opens the picker; nothing is sent | The words; Enter or Space on the focused input | Cancel | |
| **Position** (drag, or the arrow keys on the stage) and **Zoom** (slider) | What the circle shows changes | The circle is exactly what is encoded (one crop rectangle, one canvas) | Move it back | |
| **Use this picture** | Encodes a 512 x 512 WebP under 300 KB in the browser, uploads it to a path the API chose, records it; students and staff see it at once | Toast "Your picture is set" | Choose another, or Remove | Says who sees it |
| **Choose another / Cancel** | Back to the picker / drops it; nothing was sent | Words | | |
| **Remove picture** | The generated planet comes back; the file is deleted | Toast "Your picture is removed" | Choose a new one | |
| **Your profile** in the account menu | Goes to this page | The words | Back | |

Read-only: name, role, Employee ID, email, classes. The roster and the admin own them.

## Honest about who sees it

"Your picture is seen by every student you teach in the class chat, and by the
other teachers and the admin. The admin can remove it." Said before choosing,
not discovered after. (The database's rule: a staff member's picture is seen by
every signed-in student, since they share the chat; only the admin can remove a
teacher's, `can_remove_avatar`.)

## States

- **loading:** nothing for 400 ms, then a skeleton in the shape of the cards;
  past 3 s a sentence ("The server is waking up").
- **error:** what happened and **Try again**; nothing changed.
- **no picture:** the generated planet (`packages/tokens/avatar.css`), never an empty box.
- **the admin removed it:** one note with the day, until a new one is chosen.
- **no file storage** (the local stack): no upload control, and the page says so.
- **saving:** "Saving…", disabled; **a failed save keeps the picture on the stage
  with its crop** and raises an error toast that stays.
- **not a picture, or over 20 MB:** a toast, and nothing opens.

## The picture around the console

| Where | What shows | Remove |
|---|---|---|
| Shell account block (`shell-avatar`) | the signed-in person's picture, or their initials when none and no storage | |
| `/students` roster (table and list) | each registered student's picture or planet beside the name | |
| `/students/:userId` header | the picture, and the note when a teacher removed it | **Actions > Remove picture…** only when `avatar.removable` (a dialog, a reason, audited, the student is told) |
| `/chat` | author faces on messages (a thread's header has none) | **Remove picture…** on a student's message, only when `removable` |
| `/teachers`, `/teachers/:key` | the teacher's face | **Remove picture…** on the detail's Actions, only when `removable` (the admin) |

A Remove control is shown only when the server says `removable`; the page never
decides who may. A student's face is never drawn on a paper (`[data-paper]` is
the student app's; the console has none).

## Colour and type

The console's three themes, tokens only. The generated planet is its own hue by
design and decorative (`aria-hidden`; the name is beside it). The Employee ID is mono.
