# `/students` — what was taken from the template, and what was not

Reference: `template.png` (shadcn-admin *Users*), with `template-states.png`
for selection and the row menu, and `template-preview.png`
(`react-spreadsheet-import`'s *Validation Step*) for the import preview.
Captured 25 Sep 2026, see `SOURCE.md`. Rebuilt 25 Sep 2026. Implementation:
`current.png` (1440), `current-380.png` (380). Gate:
`design/specs/console-students.spec.ts`.

Colours and fonts are ours, always: `packages/tokens`, three themes. Nothing
below is about colour.

## Why the page was rebuilt, not fixed

Audited against `PAGE-SPECS.md` §`/console/roster` before any change:

| Planned | Before | Now |
|---|---|---|
| TanStack table | yes | yes |
| Claim status per row | yes ("Registration") | yes, in words, plus **Deactivated** |
| CSV import, **dry-run preview of new / existing / conflicting** | the preview was **three counts**, no rows; "conflicting" did not exist (a registered row that differed was silently "skipped"); the section was a free-text box defaulting to `BSCPE-2A`, a section the seed does not have. **And locally the button hit a 404**: the route mounted only with a Supabase admin client | every row with its outcome in words, old value beside new, a filter to the rows that need a look; sections picked from the real list; an optional `section_code` column |
| **Resend invite** | absent | **not built, by decision** (instructor, 25 Sep 2026): nothing is ever sent. Registration is self-service at `/claim` with the student ID, and no email exists until then. Recorded in `apps/console/CLAUDE.md` |
| **Deactivate** | absent (the badge existed; nothing could set it) | row menu → dialog → reason → **type the student ID** → deactivated; **Reactivate** undoes it |
| **Bulk section move** | absent | tick rows → "Move to section…" → reason → moved |
| Every write → `audit_log` | import only, a summary | import (with the IDs it touched), deactivate, reactivate, one row per student moved |

All three built features were approved by the instructor on 25 Sep 2026.

## Deactivate is hard to do by accident

It is a soft delete a student feels at once (V-20). What stands in the way:

1. **Never on the row.** It lives in the row menu (`⋯`), like the template's
   Delete: two presses to reach, set apart at the bottom of the menu.
2. **Never in bulk.** The selection bar offers a section move and nothing
   else. Deactivating a class is not a thing one press should do.
3. **The dialog says what happens, for this student**, before anything
   changes: a registered student is refused on every request from then on, by
   ID or by email; their attempts, answers and grades are kept; it can be
   undone here. An unregistered row: the ID can no longer be used to register.
4. **A reason is required** (the server refuses under 3 characters).
5. **The student ID is typed to confirm.** The button stays disabled until it
   matches. It names the student: "Deactivate Juan Miguel Dela Cruz".
6. **It is reversible**, in the same menu, with its own reason. The design
   mandate's reversibility test.

## Structure taken from the template

| Template | Here | Why |
|---|---|---|
| Title, one-line description, actions at the right | `Students`, a line of counts (on the roster · registered · not yet · deactivated), **Import roster** at the right | The counts answer "who still has to register", the question a teacher opens this page with in week 1 |
| Filter input + faceted filters (Status, Role) | Filter input + **registration** as four pressed buttons with counts (All, Registered, Not registered, Deactivated) + a **Section** select | Pressed buttons, not a popover of checkboxes: every one is in the Tab order (NEXT-SESSION §0c.5) and its count is visible without opening anything |
| Checkbox column, header selects all visible | Same | The bulk section move needs a selection |
| Floating bar "N users selected" at the bottom | A **bar above the table**, `role=region` "Bulk change": N selected · Move to section… · Clear selection | At 380 the toasts own the bottom edge (`toast.tsx`); a bottom bar would sit under them |
| `⋯` row menu, destructive item last and apart | Same: Open record (registered only) · Move to section… · — · Deactivate… / Reactivate… | Keeps the destructive action two presses away |
| Status as a small badge in words | Same | Never colour alone |
| Pagination, rows per page | **Not copied** | A section is 20 to 50 students. One scroll beats paging, and a filter finds anyone faster than page 3 |
| View menu (column visibility) | **Not copied** | Seven columns, all of which fit at 1440; nothing to hide |
| Invite User / Add User | **Not copied** | No invites exist; students are added by import |

### The preview (from `template-preview.png`)

| Reference | Here |
|---|---|
| Every row in a table before commit | Same, inside the import dialog, step 2 of 2 |
| Problem cells coloured, reason in a tooltip | **An outcome column in words**: New · Unchanged · Will change (name: *old* → *new*; section: *old* → *new*) · Not imported (registered, and different: move them with *Move to section*; the ID appears twice in this file; no section called *X*) |
| "Show only rows with errors" toggle | "Only rows that need a look" (will change + not imported), a pressed button |
| Confirm | "Import N rows", N = new + will change. Disabled at 0. **Back** keeps the pasted text |

## At 1440

Eight columns in one card, `table-layout: fixed`, no horizontal scroller: a
checkbox, Student ID (mono), Name (a link to `/students/:userId` when
registered), Section, Registration, Attempts (mono), Avg mastery (mono), and
the `⋯` menu. Sort on ID, Name,
Section, Attempts and Avg mastery, `aria-sort` on the column head.

## At 380 (below 56rem of available width): a list

The template's table is cut off after two columns at 380. So the page pivots to
a list, one item per student: checkbox and name on the first line, menu at the
right; ID, section and registration on the second; attempts and mastery on the
third. Same data, same controls, no hover needed for anything. Sorting is a
table affordance and stays with the table; the list keeps roster (ID) order,
and search and the filters work the same in both.

The width is the page's OWN, measured with a ResizeObserver as on `/locks`,
not the viewport's: the sidebar takes a quarter of a laptop screen.

## States

- **Loading**: nothing for 400ms, then a skeleton of the table (same row
  height, eight columns), then "Still loading…" in words past 3s.
- **Failed fetch**: an alert with **Try again**, never a blank.
- **Empty roster**: says students cannot register until their ID is on it, and
  offers the import.
- **No match for the filter**: says so, with the filter's text.
- **Every write** confirms with one toast saying what happened to whom; a
  failure keeps its dialog open with the error in it, and its toast stays
  until dismissed.

## What must not regress

- `console-gate.spec.ts` visits `/students`; it must still pass.
- A roster row's name links to `/students/:userId` only when registered.
- The import route is mounted with the other console routes. It lived in
  `routes/auth.ts`, which mounts only with a Supabase admin client, and was a
  404 on the local stack for as long as it lived there.
