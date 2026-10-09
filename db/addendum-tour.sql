-- OCTA -- the first-run tour is remembered per ACCOUNT (instructor, 9 Oct 2026:
-- "yes, in the database", not in the browser).
--
-- Applied NINETEENTH, after addendum-graded-moons.sql. Idempotent; on a live
-- Supabase project on its own:
--     pnpm db:push --file db/addendum-tour.sql
--
-- One column on `profiles`: when the person first had the tour started for them
-- (the student app's star map, or the console). Null = not yet. The API sets it
-- (`POST /api/v1/profile/tour`, set once, never moved); it is a convenience and
-- never a grade, so unlike the picture's columns it needs no write guard.
-- What stays denied, and `tour.spec.ts` tests: nobody can write ANOTHER person's
-- flag (p_update's `id = auth.uid()` leaves it at zero rows) and anon reads nothing.
--
-- No policy or grant changes: `profiles` already has p_self, p_update and
-- p_staff, and a new column inherits them.

alter table profiles add column if not exists tour_seen_at timestamptz;
