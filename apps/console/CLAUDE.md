# apps/console — teacher + admin

Vite + React 18 + TS + Tailwind + Radix. `pnpm --filter @octa/console dev` on :5174.

## Provenance
Built as **shadcn's approach, not shadcn's template**: Radix primitives with the component source
owned in-repo under `src/components/ui/`. Cloning `satnaing/shadcn-admin` would have imported a
demo app to delete, and its slate/blue palette is the thing the P4 exit criteria forbid.

Do NOT assume these components match the shadcn docs — they are ours, and they are smaller.

## The palette is `packages/tokens`, and the config enforces it
`tailwind.config.ts` **deletes** Tailwind's default palette rather than extending it. An upstream
colour utility is therefore not a rule violation that renders fine; it produces no CSS at all, and
`scripts/scan-console-palette.mjs` (`pnpm lint`) turns that into a build failure. The scanner also
rejects a literal hex and any `dark:` variant — themes are driven by `[data-theme]`, never by a
Tailwind variant, so there must be exactly one palette mechanism.

It flags a banned utility **even inside a comment**, on purpose. A rule you can document your way
around is not a rule.

## Auth
Route guards read role from JWT `app_metadata`, never from `profiles.role`. A student who edits
their profiles row must still be blocked.

`roleFromClaims()` mirrors `jwt_role()` including its failure mode: anything unknown, missing or
malformed maps to **least privilege**. Never read `user_metadata` — it is client-writable through
the Supabase auth API, and reading it instead of `app_metadata` is a privilege escalation that
looks like a one-word typo in review. There is a test for that exact substitution.

The guard decides what to RENDER and nothing more. Every console route calls `requireStaff()` on
the server and RLS denies beneath it, so deleting this file would make the app ruder, not less
secure.

## The shell
`components/AppShell.tsx`, **rebuilt 28 Sep 2026** (`design/templates/console/shell/SPEC.md`).
The nav is **four groups by job**, an instructor ruling: *In class* (Locks, Live), *Students*
(Students, Submissions, Gradebook), *Course* (Assessments, Items, Content), *Records* (Audit log,
System health, Feedback). A route added to the console goes into one of those groups, and a new
group is the instructor's call. **No collapse control, by decision** (same day): at 1440 it would
change nothing a teacher can see.

The sidebar is sticky and **16rem, and must stay 16rem**: `<main>` is 70rem at 1440 with it, and
`/gradebook` (66rem), `/assessments` (64), `/locks` and `/submissions` (62) choose their table
layout on their own width. A wider sidebar pushes all four to their lists. The theme and Sign out
live in the account menu at the foot; every sign-out goes through one handler and says so in a
toast. At 380 the same `<aside>` is a sheet: a disclosure, never a modal, closed by Escape, the
scrim, any route change or Tab into the page, with focus back on its button.

## Pages
| Route | What it is for |
|---|---|
| `/signin` | the gate. **Rebuilt 25 Sep 2026** (`design/templates/console/signin/SPEC.md`): split layout, the task left and the POST readout right. Its two sibling screens, the student-account screen and the forced credential change, are rendered by `AppShell` from `pages/GateScreens.tsx` in the same `GateFrame`. One failure sentence for every credential cause; a network failure or rate limit says so instead (`signInFailureMessage`). `<Toaster />` is mounted at the app root in `App.tsx`, not in the shell, so these screens can raise one. **Wakes the API** on arrival (`wakeApi`, one `GET /healthz` per page load) because signing in goes to Supabase, and a sleeping Render instance would otherwise make `/locks` wait ~50s |
| `/forgot-password`, `/reset-password` | **the self-service password reset**, approved 25 Sep 2026 (`design/templates/console/forgot-password/SPEC.md`). Outside the shell, in the gate's frame. Never reveals whether an account exists. No password form without a recovery link in the address. The recovery token is taken off the address bar once read. Needs the console's `/reset-password` URL in Supabase's Redirect URLs, and working auth email; neither is verifiable locally |
| `/locks` | students × stages. Reason mandatory on every toggle. **Never computes a lock** — `is_stage_unlocked()` decides, the same authority the student app reads; where a person's override and the database disagree, the cell shows the database. **Rebuilt 25 Sep 2026** (`design/templates/console/locks/SPEC.md`): three states told apart by shape (a padlock = a person decided); who, when and why on every override, in a readout that follows focus as well as hover; **shift-click bulk** (`POST /locks/bulk`, one transaction, one audit row per cell); a **Sections & schedules** tab for course-wide and section overrides with `unlock_at`/`lock_at`. Below 62rem of its own width it shows one stage at a time |
| `/students` | the roster. **Rebuilt 25-27 Sep 2026** (`design/templates/console/students/SPEC.md`): claim status in words, pressed filters with counts, a list below 56rem of its own width. **Import is dry-run first** and the plan is row by row (new / unchanged / will change with old beside new / not imported and why); a registered row is never overwritten; an optional `section_code` column is read only when it names a real section. **Deactivate** is one student at a time from the row menu, with a reason and the student ID typed back, and it is a real lock-out: `identityFrom()` refuses a deactivated student on every API route, so signing in by email does not get round it. **Reactivate** undoes it. **Bulk section move** needs a reason and moves the profile too. **Resend invite is not built, by decision (instructor, 25 Sep 2026):** registration is self-service at `/claim` with the student ID, and the system never sends anything to resend |
| `/students/:id` | one student's record. **Rebuilt 27 Sep 2026** (`design/templates/console/students-detail/SPEC.md`): a record header (back, name, Registered/Deactivated in a word, ID · section · registration date, one **Actions** menu holding the roster's own `MoveDialog` and `StatusDialog`, reused); every attempt; opening one regenerates the exact paper in place (options in the order they saw, their answer, the key, the verdict in words, the rationale they were shown, time on item). **The key, verdict and rationale are withheld on an in-progress or abandoned paper** (instructor, 27 Sep 2026): the database grants staff the key for every status, but a console is projected, and this is a render decision, not a payload one. A table at 40rem of its own width and up, a list below |
| `/attempts/:id` | the exact paper, replayed from the stored seed. The only place the key is shown |
| `/gradebook` | every student's score so far, weighted by the syllabus. **Rebuilt 28 Sep 2026** (`design/templates/console/gradebook/SPEC.md`): KPI row, class average per stage check as an HTML bar list with every value printed, the five weights in words, and a grid with two views (**Final grade**: the five components, *Final so far*, *Unmarked*; **Stage checks**: 01-18, "not sat" never 0) and a class-average row. The arithmetic is the API's (`services/api/src/gradebook/compute.ts`, one function behind both `GET /console/gradebook` and the CSV): **weights fixed** to the syllabus (`GRADE_WEIGHTS`), **a final SO FAR** rescaled over the components the class has marks in, with the coverage stated; graded submissions only, normalised by `max_score`; handed-in-unmarked left out, not-handed-in 0. **Not built, by decision (instructor, 28 Sep 2026):** weighting configuration (weights are policy), and XLSX / "the university's format" (no document defines it; waits for a sample grade sheet). Lazy-loaded; imports no Recharts |
| `/content` | per-chapter authoring status: authored / scaffold / empty |
| `/audit` | who changed what and why. Read-only, and there is no delete control by design |
| `/system` | `run_invariants()`, live |
| `/feedback` | reports with the resolved variant attached, and the SUS score |
| `/items` | the bank and its review queue. Approve, **send back with a required reason**, retire, version. A decision advances to the next item rather than closing — a seeded bank is a few hundred decisions and closing each time pushes a reviewer toward rubber-stamping. The self-approval tick is gated on AUTHORSHIP, not just status: offering it on an item the reviewer did not write records a false statement in `audit_log`. p-value and discrimination per item once `item_stats` has them. **Rebuilt 25 Sep 2026** (`design/templates/console/items/SPEC.md`): filters by status, stage, type and objective; **bulk approve drafts moves drafts into REVIEW only**, never live; **import JSON is dry-run first**, lands everything as a draft and refuses to touch a live item; **export JSON** carries the answer keys. An ordering item's preview shows its keyed ORDER; before the rebuild it showed no key at all |
| `/assessments` | **the route that made the engine reachable.** Creating one mints the exam salt. The feasibility check answers *"can this blueprint be filled?"* naming the shortfall cell, before a student presses Start rather than at Start. **Rebuilt 27 Sep 2026** (`design/templates/console/assessments/SPEC.md`): the create form beside a preview of what a student is offered and the bank's verdict; **every row** carries its bank (the list's GET runs the same `feasibilityOf()`), and a banner counts reachable assessments the bank cannot fill. **Section scope** on create, enforced at Start (`startAttempt` answers 404 to another section, as RLS already does). **Rotate exam salt** from the row's `⋯` menu: reason required, audited without the salt; each row says when its salt was set or rotated and **never shows a salt** (`scan-bundle.mjs` forbids it in both bundles). A table at 64rem of its own width and up, a list below |
| `/submissions` | the lab and project marking queue. A graded submission's content freezes; regrade is an explicit, audited unlock. **Rebuilt 27 Sep 2026** (`design/templates/console/submissions/SPEC.md`): the queue beside a reading pane (one at a time below 62rem of its own width, `?open=` in the address). **Late is a column**, in words, on every row. Labs are marked by the manual's four bands (pressed buttons); a project or participation entry by a score out of a maximum the grader states. **A graded row is frozen in the API too**: `POST /grade` answers 409 on one, and the only unlock is `POST /return` (graded rows only, reason required), whose audit row keeps the score, rubric and feedback it replaces. **Drafts are listed and never read**: the list withholds their body, attachments and payload. Save and advance moves to the next *to mark* in the view; a returned one waits on the student and is skipped. **Void is not built, by decision (27 Sep 2026):** `voided` exists in the schema with no route to set it; when one is wanted it is a new staff write with a reason and an audit row |
| `/live`, `/live/present` | Lecture Mode and the projector view |

**Not built:** `/console/analytics` — the psychometrics view. `item_stats` is computed nightly and
`/items` shows p-value and discrimination per item; what is missing is the cohort-level chart, and
it cannot say anything true until items have ≥30 exposures. `/console/settings` is also absent;
every setting it would hold is currently an environment variable.

## Rules
- Every write that changes student-visible state writes to `audit_log` with actor and reason.
- Projector view (`/console/live/present`) shows NO names, ever. Aggregates only. This is
  enforced in the **payload**, not the render: `routes/live.ts` never selects `full_name`,
  `student_id` or `user_id`, so a future component cannot leak one by accident. Below
  `MIN_COHORT = 5` responses the answer spread is `[]` — with four students in a room, a
  distribution names people.
- Editing a live item creates a new row sharing `family_id` with `version + 1`, and retires the
  old row. The confirm dialog must say that stats do not carry over, in those words.
- Tables: TanStack Table. Charts: Recharts. Do not add another table or chart library.
- `danger` styling is for destructive STAFF actions only. It is never used to tell a student they
  were wrong — incorrect answers get a neutral response, and this view goes on a projector.
- Pure logic lives in `src/lib/` and is tested. UI is not tested. `parseRoster` is there because
  `Dela Cruz, Juan Miguel` is the normal case here, not an edge case.

## The bundle carries the answer key, and that is correct
`scripts/scan-bundle.mjs` runs **two profiles**. The student bundle must not contain
`correctValue` at all; this one may, because the drill-down exists to show it and
`ai_after_submit` grants staff the same read in the database.

What is forbidden in both: `service_role`, `exam_salt`, engine internals — and **any live answer
value from the database**. A bundle is a static file, and a static file has no idea who is asking.
