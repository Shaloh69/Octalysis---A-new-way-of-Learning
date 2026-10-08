# `/profile` (teacher and admin) — template source

PROFILES, `docs/PROFILES-PLAN.md` (approved 7 Oct 2026, night): "add that to the
admin and teachers too." **The page is not built yet** (8 Oct 2026: the student's
`/app/profile`, the picture API and the database came first). This folder holds
the reference, captured and opened, so the build starts from an artifact and not
from a link.

`template.png` (1440) and `template-380.png` (380): **shadcn-admin's Settings >
Profile**, https://shadcn-admin.netlify.app/settings, captured 8 Oct 2026 with
Playwright, HTTP 200, title "Shadcn Admin", headings "Settings" and "Profile"
confirmed rendered. Opened before use. What rendered: a page title and subtitle
over a rule; at 1440 a left list of settings sections (Profile selected) beside
a single form column with labelled fields and helper text under each; at 380 the
section list folds to a dropdown over the same column.

**Two captures were rejected on the way, and the second one matters:** the first
380 capture and then a re-capture of 1440 both saved **a blank white page** (HTTP
200, the app had not rendered), and the re-capture overwrote the good 1440 file.
The script now keeps a capture only when the headings actually rendered. A 200
and a saved PNG prove a file exists, not that it shows the thing.

What is taken: the page title over a rule; one column of labelled fields with a
helper line under each; the section list that folds at 380. What is not: it has
no picture control, so the console's picture editor is the web's (`design/templates/web/profile/SPEC.md`:
`AvatarCropper.tsx` and `avatar-image.ts` are already in `apps/console`, pinned
identical to the web's by `apps/web/test/avatar-image.spec.ts`). Colours are the
console's three themes, never shadcn-admin's.

## Still to do for this page (the plan's order)

SPEC.md (every control, the four tests) and motion.md, then the page at `/profile`
(the shell's account menu links to it), the picture in the shell's avatar, the
roster, `/students/:userId` (with **Remove picture**, a reason, audited), the
class chat, `/teachers` and `/teachers/:key`; each through its own page gate at
1440 and 380. The API and the database are done: `GET /profile`, the upload and
record routes, `DELETE /profiles/:userId/avatar`, and `avatar` (with `removable`)
on the roster, a student's record and the teachers' rows.
