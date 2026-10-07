# `/teachers` — the admin's page of every teacher (T1)

Reference: `template.png` (shadcn-admin *Users*), see `SOURCE.md`. Plan:
`docs/TEACHERS-AND-SUBJECTS-PLAN.md` §2. Not built yet; this is the spec it
is built to. Gate: `design/specs/console-teachers.spec.ts` (six assertions at
1440 and 380), screenshots opened and looked at.

**Admin only.** The nav item appears for `admin`; the route renders the
console's forbidden screen for `teacher`; every API call it makes is
`requireAdmin()` server-side (the nav and the route are courtesy, the API is
the lock). **The admin is also a teacher**: the admin's own row is in the
list, with their classes.

## What it shows

- Title **Teachers**, a counts line: N teachers · active · not yet claimed ·
  disabled; **Import roster** at the right.
- Filters: a text filter (name, employee ID, email); **status** as pressed
  buttons with counts (All, Active, Not yet claimed, Disabled); **subject**
  as a select (All subjects, CPE 412, …).
- The table: Employee ID (mono) · Name · Email · Role (Teacher / Admin, in
  words) · Status (in words, never colour alone) · Classes (each "BSCPE-2A ·
  CPE 412", the term on hover and in the detail page) · AI tokens this month
  (mono; "No AI use yet" until the assistant's app exists) · `⋯`.
- A staff account with no roster row (the bootstrapped admin) is listed
  with "No employee ID" and can be linked to one from its detail page.
- At 380: one card per teacher (name, role, status, classes), the `⋯` on the
  card; no horizontal scroll (the template's defect, not copied).

## The controls, and the four tests (DESIGN-MANDATE §1)

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Text filter | the list narrows to who matches | the count of matches shown | clear it | shows who teaches what |
| Status buttons (with counts) | the list shows that group | count on each button, pressed state | press All | who still has to claim |
| Subject select | the list shows that subject's teachers | the select names it | All subjects | who covers a subject |
| A row (name) → `/teachers/:id` | opens that teacher | the name is the link | Back | their classes and use |
| **Import roster** → dialog | adds or updates rows on the teacher roster | **dry run first**: every row new / existing / conflicting, old beside new | nothing is written until Apply; a claimed row is never overwritten | the plan before the change |
| `⋯` → Assign class… | the teacher holds a class (section × subject × term, a book) | the dialog names all four; the subject's books listed, its default marked | End class on the detail page | who teaches which class |
| `⋯` → Disable… / Re-enable… | the teacher is refused on every request; their Supabase login is banned | the dialog says what happens, for this teacher; **reason required; employee ID typed to confirm** | Re-enable, same menu, with its own reason | |

**Never:** disable an admin (refused server-side; there is one admin), disable
in bulk, delete a teacher. Every write is audited (`audit_log`, actor, reason).

## States

Loading (skeleton rows), empty ("No teachers on the roster yet. Import
one."), error (the console's one error banner with Retry), a dry-run preview,
an apply in progress, a success toast.
