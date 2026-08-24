# apps/console — teacher + admin

## Provenance
The app shell is adapted from github.com/satnaing/shadcn-admin (Vite + React + TS + shadcn).
Some components are modified from upstream shadcn for RTL support — do NOT assume they match the
shadcn docs. The palette has been replaced with `packages/tokens`. Never reintroduce slate/blue;
a lint rule fails the build on `slate-` or `blue-` utility classes.

## Auth
Route guards read role from JWT `app_metadata`, never from `profiles.role`. A student who edits
their profiles row must still be blocked.

## Pages, in order of how much they'll actually be used
1. `/console/students/:id` — regenerate the exact variant a student saw from their stored seed
2. `/console/locks` — students x stages matrix, reason prompt on every toggle
3. `/console/items` — bank, stats inline, preview-instance with re-roll
4. `/console/roster`, `/gradebook`, `/analytics`, `/live`, `/feedback`, `/audit`, `/content`,
   `/assessments`, `/audit/system`

## Rules
- Every write that changes student-visible state writes to `audit_log` with actor and reason.
- Projector view (`/console/live/present`) shows NO names, ever. Aggregates only.
- Editing a live item creates a new row sharing `family_id` with `version + 1`, and retires the
  old row. The confirm dialog must say that stats do not carry over, in those words.
- Tables: TanStack Table. Charts: Recharts. Do not add another table or chart library.
