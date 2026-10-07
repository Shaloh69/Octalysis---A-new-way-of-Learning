# Source of `/teachers`' template

Plan: `docs/TEACHERS-AND-SUBJECTS-PLAN.md` §2 (approved 7 Oct 2026, night).
The admin's page of every teacher: a count, each teacher with their classes,
the teacher roster import, assign a class, disable.

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/users (the same reference `/students` took on 25 Sep 2026, re-captured for this route) |
| Captured | 7 Oct 2026 (night), Playwright (Chromium), `networkidle` + 1.5 s |
| HTTP | 200, no redirect, title "Shadcn Admin" |
| `template.png` (1440) | Opened and looked at. "User List" with a one-line description; **Invite User** (outline) and **Add User** (primary) at the right; a filter input, faceted **Status** and **Role** filters, a **View** menu; a table of Username, Name, Email, Phone, Status (a small badge in words: Active, Invited, Suspended), Role (with an icon), a `⋯` row menu; pagination |
| `template-380.png` | Opened. The actions and filters stack; **the table is cut off at the card's edge after the second column**: a horizontal scroller, the same defect `/students` recorded. Our 380 is a list of cards, as `/students`' is |

**Why this one:** it is a page of people with ROLES and a STATUS, which a
teacher list is exactly (teacher or admin; not yet claimed, active,
disabled), and it keeps the console's own pages one family with `/students`.

**Taken:** title + counts line + actions at the right; a filter input and
faceted filters (ours: status and subject as pressed buttons, as `/students`);
status and role in words; a `⋯` row menu holding the destructive action
apart. **Not taken:** pagination (a department is a few dozen teachers),
the View menu, "Invite" (nothing is sent; a teacher claims their employee
ID at `/claim`), colours and type (ours, three themes).
