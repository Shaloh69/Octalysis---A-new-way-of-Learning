# Teachers, subjects and classes — plan v1, APPROVED 7 Oct 2026 (night); **T1 BUILT the same night**; **T2 planned 9 Oct 2026 (§5), awaiting approval**

**T1 status (7 Oct 2026, night):** built and on the deployment.
`db/addendum-teachers.sql` (thirteenth; on Supabase first), the admin's API
(`services/api/src/routes/teachers.ts`, `requireAdmin()`) and the teacher
claim (`POST /api/v1/auth/claim-teacher`), and three console pages through
the gate: `/claim`, `/teachers`, `/teachers/:key`. 20 RLS tests + 22 API
tests, each watched red; page specs 22 + 30 + 24 green at 1440 and 380,
captures opened. **Not built, recorded:** linking a staff account that has
no employee ID (the bootstrapped admin) to a roster row; the AI-use chart
(a table until real totals exist). **Not yet done on the deployment, by
choice:** a real claim (it creates a live account; the instructor imports
the first teacher roster and a teacher claims).

Instructor, 7 Oct 2026 (night):

> "A new Teacher Account, with Admin the only one that can see how many
> teachers, what subjects they are holding, and adding a new roster of
> teachers. ADMIN IS ALSO A TEACHER."
>
> "CPE 412 is not a section, it's the name of the subject. A Teacher/Admin can
> hold different books in different sections or classes, such as BSCPE-2A
> CPE 412, BSCPE-3A CPE 413."

| # | Asked | The instructor's answer |
|---|---|---|
| 1 | What a subject is | **Both a subject and a section.** A subject is a course (CPE 412, CPE 413) with its book; a section is a group of students (BSCPE-2A). A **class** is one section taking one subject with one teacher |
| 2 | How a new teacher gets an account | **Claim by employee ID**, as students claim by student ID |
| 3 | Who sees what | **Only the admin** sees how many teachers there are, the subjects and classes each holds, and imports the teacher roster. **The admin is also a teacher**: everything a teacher can do, plus that |
| 4 | AI token logs (the assistant plan, round six) | Each teacher sees their own; the admin sees every teacher's totals, never their drafts |
| 5 | "A section can have the same subject too" | **Many sections, one subject**: BSCPE-2A and BSCPE-2B can both take CPE 412, each its own class, possibly with different teachers |
| 6 | "Expound the current admin to handle individual teachers" | **The roster import AND a page per teacher**, `/teachers/:id`: their classes, token totals and controls |
| 7 | Profile pictures, for teachers and the admin too | A separate plan: `docs/PROFILES-PLAN.md` |
| 9 | Who adds subjects and books (7 Oct, night, Course Studio) | **Every teacher, in Course Studio** (`docs/COURSE-STUDIO-PLAN.md`), with a reason, audited. T3 (a subject's own star system) is that plan's CS2 |
| 8 | Books (question C) | **A subject may have two or more books** ("some subjects have different books"), **and a class may still choose its own: support both** |

This supersedes decision **D4** ("teacher and admin are one role in this
deployment", `VERIFICATION.md`, `PAGE-SPECS.md` §4.4) for the admin-only
powers below. Everything else D4 governs stays.

## 1. What exists today (read from the code, 7 Oct 2026)

- Roles: `user_role` = `student | teacher | admin`; `isStaff()` treats teacher
  and admin alike. No route or page is admin-only.
- `sections (code, term, teacher_id)`: one teacher per section; no subject.
- `student_directory`: the student roster, imported on `/students`
  (`POST /api/v1/console/roster/import`, dry run by default), claimed by
  student ID. **No teacher roster exists**; teachers are created by hand.
- **OCTA's content is one subject.** `stages` (`'00'`-`'18'`), items,
  objectives, blueprints, assessments and the gradebook are CPE 412's and
  carry no subject column. A second subject is a second curriculum.
- The deployment has **one** staff account, the admin.

## 2. Proposed shape

**Tables** (an idempotent addendum, on Supabase before the code, hard rule 10):

- `subjects (code pk, title)` — `'CPE 412'` seeded; the code matches the
  assistant's `assistant_course_ok()` pattern.
- `subject_books (subject_code, title, edition, is_default)` — **two or more
  books per subject** (question C, answered); CPE 412's Stallings seeded as
  its default.
- `classes (id, section_id, subject_code, teacher_id, term, book_id)` — one
  section, one subject, one teacher; unique per (section, subject, term).
  Many sections may take one subject. `book_id` is one of the subject's books
  (null: the subject's default), so both "per subject" and "per class" hold.
  A teacher holds many; the admin can hold classes too.
- `teacher_directory (employee_id pk, full_name, email, role teacher|admin,
  status unclaimed|claimed|disabled, claimed_by, claimed_at)` — the teacher
  roster, mirroring `student_directory`. Admin-only (RLS: `is_admin()`;
  denial tests red first: a teacher reads no row, a student reads no row).

**Claiming:** a console page `/claim` (beside `/signin`): employee ID, name
check, email, password. The API creates the account with the role the
roster names; one generic error for unknown and already-claimed IDs (no
enumeration, as for students). Role from the roster only; never from the
form (`profiles_no_self_promote` already blocks self-promotion).

**The admin page `/teachers`** (admin-only in the nav, the route and the API;
a teacher who types the URL gets the console's forbidden screen):

- the count of teachers (claimed / not yet claimed / disabled);
- each teacher: their classes (section × subject × term), claim status,
  last sign-in, and their AI token totals by engine (round six);
- import a teacher roster (CSV: employee ID, name, email, role), dry run by
  default, new / existing / conflicting, as the student import;
- assign a class (section, subject, term, teacher); disable a teacher.

**The admin's page per teacher `/teachers/:id`** (admin-only, as `/teachers`):
one teacher's employee ID, name, email, role, claim status and last sign-in;
their classes (assign, end); their AI token totals by engine and by month
(round six; totals, never drafts); disable or re-enable the account. A
teacher who types the URL gets the console's forbidden screen.

**The admin as a teacher:** every teacher page works for the admin exactly
as for a teacher, with the classes the admin holds. `/teachers` is the only
addition. `requireAdmin()` beside `requireStaff()`, server-side; the console
hides the nav item, it never decides access.

## 3. Phases

| Phase | What | Size |
|---|---|---|
| **T1** | Subjects, classes, the teacher roster, `/claim`, `/teachers` and `/teachers/:id` (admin-only), `requireAdmin`, denial tests. Only CPE 412 has content: a class on another subject shows "no content for CPE 413 yet". Existing sections are assigned to CPE 412 and their current teacher | 2 sessions |
| **T2** | **Scoping teachers to their classes** (see question B below): a teacher's `/students`, gradebook, locks, submissions and chat show their classes only; RLS by class, with denial tests | 2 sessions |
| **T3** | **A second subject's curriculum** (CPE 413): stages, items, objectives, blueprints and the star map keyed by subject. Touches nearly every table and the student app; its own plan, written when a second subject's syllabus and book exist | many |

## 4. Decided, and still open

- **A. Order: T1 FIRST**, before the assistant's app (instructor, 7 Oct).
- **B. A teacher sees ONLY their own classes**; the admin sees all
  (instructor, 7 Oct). That is T2, with class-scoped RLS and denial tests.
- **C. Books: ANSWERED (7 Oct, night):** a subject may have two or more
  books, and a class may choose one of them; both are supported
  (`subject_books`, `classes.book_id`).

Each new page is born with a captured template, a `SPEC.md` and a spec at
1440 and 380 before it is built (CLAUDE.md). Templates for `/teachers`,
`/teachers/:id`, `/claim` and the locked `/assistant` are captured at the
start of the session that builds each.

---

# 5. T2 — a teacher holds their own classes — plan v1, 9 Oct 2026 — **AWAITING APPROVAL; nothing below is built**

## 5.0 What the instructor ruled, 9 Oct 2026 (asked with the question tool)

| # | Asked | Answer, in the instructor's words | Status |
|---|---|---|---|
| T2-1 | A class has ended: what does its teacher keep? | **Read-only** | Ruled |
| T2-2 | Feedback and the audit log (not class-shaped) | **Feedback: every teacher reads it, names only for their own classes. Audit: a teacher's own actions + actions on their own students; the admin all** | Ruled |
| T2-3 | Global locks and global assessments: who may change them? | *"explain, I thought each teacher has their own set of locks, assessments, books, sections, classes etc"* | **Open: §5.3 explains and asks** |
| T2-4 | Roster import and moving students | *"An admin can create a section but automatically set for himself, same as a teacher. Admin can only see the sections created etc and their books and classes as read-only."* | Ruled; **three points need confirming, §5.4** |
| T2-5 | (volunteered) Chat | *"also add to the chat that teachers can communicate with one another and see who is active as of the moment in the chat page"* | New scope, **§5.7; confirm** |

## 5.1 The model, in one sentence

> **A teacher owns what they create or are given: their sections, the class on each, the locks and
> assessment windows for those classes, and the students in them. They see nothing of another
> teacher's. The admin is a teacher with their own classes, and sees everyone else's read-only.**

"Holds a class" is the one test, in one SQL function, asked of RLS and of the API:

| Question | Answer |
|---|---|
| **reads** a section's students | the actor holds a class (`classes.teacher_id`) on that section, **ended or not**; or the actor is the admin |
| **writes** to a section's students (a lock, a grade, a section move, a picture removal, a chat post) | the actor holds a class on that section **and it has not ended** (`ended_at is null`). **The admin gets no write on a class they do not hold**, except the exceptions in §5.4 |
| a student with **no section** | no teacher reads them; the admin reads them |
| a section with **no class** | no teacher sees it; the admin sees it read-only and can give it a class on `/teachers` (T1's *Assign a class*). `/teachers` shows "n sections have no class" |
| a student **moved** to another section | scope follows `profiles.section_id` now: the old teacher loses sight at once, including history; the new teacher reads all of it. The move is already audited. *(My default; say if you want the old teacher to keep what they graded.)* |
| two teachers, one section | allowed only for different subjects (`classes_one` is unique on section × subject × term). Any held class on the section grants it today, because only CPE 412 has content; **T3 adds the subject as a parameter** |

## 5.2 Where it is enforced (the API bypasses RLS, so both doors)

The API connects as the table owner (`services/api/src/db.ts`): **RLS does not guard the console.** The
console never calls supabase-js directly, so today RLS is the backstop for a stolen staff token used
against the database, and the API's own filter is the real door. T2 therefore changes both, and the
denial tests run against both.

- **SQL (the twentieth file, `addendum-class-scope.sql`, idempotent):** `staff_reads_section(section)`,
  `staff_writes_section(section)` and `staff_reads_user(user)` / `staff_writes_user(user)`, all
  `security definer` (a policy's subqueries are subject to RLS, V-30), reading `auth.uid()` inside
  (no actor argument: a client-callable function that took one would let a teacher map who teaches whom).
  A second pair with an actor argument, **executable by `service_role` only**, is what the API asks.
  `is_staff()` stays for what is not class-shaped.
- **Policies rewritten** (`is_staff()` → the class test, read and write separately): `profiles` (`p_self`,
  `p_staff`), `student_directory`, `attempts`, `attempt_items`, `responses`, `stage_progress`,
  `level_progress`, `stage_locks`, `submissions`, `attempt_events`, `live_sessions`, `live_responses`,
  `audit_log` (own actions + actions on own students), `feedback` (rows read by all staff; the author's
  identity is the API's to hide), the chat tables, and `assessments` (§5.3). Where the API is the only
  writer (rule 7), the staff **write** policy is dropped rather than narrowed. Decided per table by its
  red test.
- **Unchanged, not class-shaped:** `stages`, `objectives`, `content_blocks`, `items`, `item_stats`,
  `blueprints`, the drafts and figures, `objective_edits`, `audit_runs`, `invariants`, the Studio, `/items`,
  `/content`, `/system`, `/changelog`: every teacher, as ruling 9 says.
- **API:** one module, `services/api/src/scope.ts`: `staffScope(db, identity)` returns
  `{ all, readSections[], writeSections[] }`, and one SQL fragment helper adds the `section_id = any(...)`
  predicate. Every `/console/*` query that returns a student, an attempt, a grade, a lock, a submission,
  a chat thread or a picture takes it. A request for a record outside the scope answers **404, not 403**
  (a teacher cannot learn that another section's student exists). The list below is the audit trail.
- **Hard rule 4 is untouched:** `is_stage_unlocked()` is still the one authority on whether a student may
  open a stage; T2 changes who may *write the locks*, not how a lock resolves.

## 5.3 OPEN, and the explanation you asked for: locks and assessments

*"Each teacher has their own set of locks, assessments, …"*: **that is how it already is for locks, and
mostly not for assessments. Here is what the deployment holds.**

**Locks.** A lock has a scope: `user` (one student), `section` (one section) or `global` (every student of
every teacher). A teacher's user and section locks are already their own once T2 narrows them to the
classes they hold. Only `global` reaches other teachers' students. **The deployment has zero global
locks** (two `user` locks only), so nothing depends on it. *Recommendation:* the teacher's "Everyone"
button becomes **"All my classes"**, which writes a `section` lock for each class they hold (no change to
how a lock resolves). The `global` scope is removed from the console for teachers **and for the admin**
(the admin's "all" is the admin's own classes), and the database refuses a new `global` lock from a
staff token. A global lock already in place keeps working; only the admin may remove it.

**Assessments.** Here the instructor's picture and the data differ. **All 13 assessments on the deployment
are global** (section empty): the 8 stage checks, the Prelim and Midterm, and 3 moon journeys. They are one
shared set of papers that every student of every teacher sits, and they must stay one set: the whole
promise is "structurally unique but psychometrically equivalent", and a paper per teacher would make two
sections' scores incomparable. What a teacher can honestly own is **when their class sits a paper**: the
window (opens, closes), the attempt limit and Shown/hidden, **for their class**. Two ways:

- **(A) Recommended: a per-class window over the shared paper.** A new small table
  `class_assessment_windows (class_id, assessment_id, opens_at, closes_at, …)`; the shared assessment's own
  window is the default. The paper (blueprint, items) is the course's, edited by the admin as course owner
  (and by every teacher through `/items` and the Studio, as today). Each teacher sets their windows on
  `/assessments` for the classes they hold and sees no other class's. `is_assessment_open()` reads the
  class window first. *(Touches the sitting path, so it is the largest piece; its denial and boundary-second
  tests come first.)*
- **(B) A copy of the assessment per section** (`assessments.section_id`, which exists today). No new
  table, but the gradebook gets an Exam column per section's copy, and any change to a paper is made N
  times.

*My question for you:* **(A) or (B)?** And the shared global assessments themselves (the 13): editable by
**the admin only** (the course owner, D4), read-only to every teacher: yes?

## 5.4 The admin, and the roster: my reading of ruling T2-4, three points to confirm

Read as: *"Any staff member who creates a section (the roster import's 'new section') is automatically
given that section's class (CPE 412, the import's term). Teachers and the admin alike. The admin sees every
other teacher's sections, classes, books and students read-only."* So:

1. **Roster import** into a section you hold, or a new one (which makes you its teacher); **moving students**
   needs both sections held and not ended. A teacher or the admin cannot import into, or move students
   from, a section someone else holds. *(This also fixes a gap T1 left: BSECE-4A, 15 students, was
   imported without a class and no teacher can see it; the import now creates the class.)*
2. **The admin's read-only has four exceptions, because each is moderation or recovery, not teaching.
   Confirm or strike each:** (a) **remove a student's picture** (audited, as now); (b) **reset a student's
   password and set their roster status** (account recovery: a student locked out of a section whose
   teacher is away); (c) **Assign a class / end a class** on `/teachers` (T1's page: it is how a section
   with no class gets one); (d) **remove a legacy global lock, and edit the 13 shared assessments** (§5.3).
3. **A teacher keeps picture removal for their own students only** (`can_remove_avatar()` narrowed in its
   own addendum, the twenty-first, with its denial test: another section's teacher is refused, a student is
   refused, the admin is allowed under exception (a)).

## 5.5 Page by page (what a teacher sees; "none" = a clear empty state, never a blank page)

Every page gets one new element: when the teacher holds **no class**, a panel in the page's own voice:
*"You don't hold a class yet. An admin gives you one on Teachers, or import a roster to create your own."*
with the two real links. An **ended** class's rows show an "Ended" tag and their write controls are
disabled with `aria-disabled`, as the Graded switch is (so focus is kept). The admin's view of another
teacher's class carries a "Read-only: held by *name*" tag and no write controls.

| Page | A teacher holding classes sees | Holding none | The admin | Enforced at |
|---|---|---|---|---|
| `/students` | their sections' students; section picker lists their sections only; import into own sections or a new one | empty state; Import still offered (it creates their section) | all sections; read-only on others'; import creates the admin's own | `GET /console/roster`, `roster/import`, `roster/status`, `roster/section` + `student_directory`, `profiles` |
| `/students/:userId` | their student's record, attempts, picture, **Remove picture** | 404 → the console's not-found | any student; Remove picture (exception a) | `GET /console/students/:userId`, `DELETE /profiles/:userId/avatar` |
| `/attempts/:id` | attempts of their students | 404 | any | `GET /console/attempts/:attemptId` |
| `/locks` | the matrix of their students × stages; section and student overrides for classes they hold; "All my classes" | empty matrix + the panel | all rows, read-only on others'; own writes | `GET/POST /console/locks`, `locks/bulk` + `stage_locks` |
| `/submissions` | submissions of their students; grade and return | empty | all, read-only on others' | `GET/POST /console/submissions*` + `submissions` |
| `/gradebook` | their students, **only the Exam/Moon columns that apply to them**; CSV the same | empty | all students, read-only | `loadGradebookInput` takes the scope; `gradebook.csv` |
| `/assessments` | the shared papers (read-only) and **their classes' windows** (§5.3); feasibility is course-level | shared papers read-only | all; edits the shared papers (exception d) | `console/assessments*`, `class_assessment_windows` |
| `/live` | start a session for a section they hold; the live board shows their section's answers | cannot start; the panel | any section read-only | `console/live*`, `live_sessions`, `live_responses` |
| `/chat` | their sections' rooms; threads with **their** students; **staff room and teacher-to-teacher threads (§5.7)** | the staff room only | all section rooms read-only (no posting into a class they do not hold); the staff room | `chat/*` routes, `chat_member()` |
| `/feedback` | all feedback; author named only if in their class (**ruled**) | all feedback, nobody named | all, named | `console/feedback*` |
| `/audit` | their own actions, and actions on their students (**ruled**) | their own actions | everything | `console/audit*` + `audit_log` |
| Studio / Course pages | subject pages show **classes**: their own, with "n students"; others by teacher name only | the subject, no class | all classes, read-only | `routes/subjects.ts` |
| `/teachers`, `/teachers/:key`, `/claim` | admin-only, unchanged (exceptions c) | n/a | all | `requireAdmin()` |
| `/items`, `/content`, `/system`, `/changelog`, `/profile`, `/progress` | unchanged, course-level | same | same | unchanged |

## 5.6 Rollout on the deployment (hard rule 10; measured read-only on 9 Oct)

The deployment has **6 sections, 3 classes, 1 class held** (BSCPE-4A by the admin; 3 students). **BSECE-4A
(15 students) has no class.** BSCPE-2A and TEST-SITTING have classes with no teacher. One live teacher
account holds nothing. Order: (1) the addendum(s) go to `ddvxkbcelpqydnjkffdr` with `pnpm db:push --file`,
after `db:push:check`; (2) **before the code is pushed, the admin gives BSECE-4A its class on `/teachers`**
(or this plan's import fix lets them re-import it); otherwise its 15 students are invisible to every
teacher until someone does. The admin's reach is unchanged by T2, so nothing the admin does today breaks.

## 5.7 Chat: teachers talk to one another, and see who is active (new, 9 Oct; confirm)

- **Rooms:** one **Staff room** (every teacher and the admin) and **teacher-to-teacher threads** (two
  members, unique per pair). `chat_rooms.kind` gains `staff` and `staff_direct`. A staff thread is
  readable by **its two members only, not even the admin** (a private conversation; today's rule that
  staff read every thread is about students). *(Confirm: should the admin be able to read teacher threads?)*
- **Active now:** a green dot on the face and "Active now" / "Active 12 min ago", the way Messenger shows
  it. `profiles.last_seen_at`, set by a throttled heartbeat the chat page sends while it is open (once a
  minute, API-written, not the client's own column); "active" is seen within 2 minutes. It needs no
  Realtime Presence (the local stack has none, and the tests must run there). **Shown to staff, about
  staff, only**: a student never sees whether a teacher is online, and a teacher never sees whether a
  student is. *(Confirm; students' presence is a privacy matter I will not add unasked.)*
- Template: Messenger's active-status dot and Chatscope's `Avatar status="available"`, captured as
  artifacts first (`design/templates/console/chat/`), per the templates rule.
- Needs a third small addendum (the twenty-second, `addendum-staff-chat.sql`): the two room kinds, their
  membership rules, `last_seen_at`. Denial tests first: a student cannot read the staff room or a staff
  thread, cannot see `last_seen_at`; a teacher cannot read another pair's thread; anon nothing.

## 5.8 Tests and order of work, once approved

**Fixtures already hold:** `helpers/fixtures.ts:182` and `helpers/bank.ts:164` give the fixture teacher a
class on the fixture section, and `demo-seed.sql:102` gives the demo teacher (`dddddddd-…0001`) the class on
`BSCPE - 4` (all 24 demo students), so the specs that sign in as the demo teacher keep working. **At risk,
and found by running, not guessed:** tests that mint a teacher token for an id with no profile or class, and
Playwright fixtures that create students in a *new* section (`_chat-fixture`, `_stage-check-fixture`,
`_audit-fixture`): each needs a class for the teacher. I will list each failure and fix its fixture, never
loosen a policy.

1. **Denial tests first, watched red** (`class-scope-rls.spec.ts`, `class-scope-api.spec.ts`): a teacher of
   section B cannot read, through RLS **and** through the API, a student's profile, attempts, attempt items,
   responses, progress, locks, submissions, events, chat thread, picture or live answers in section A, and
   gets 404; cannot write a lock, grade, return, move or remove a picture; a student reads none of it; anon
   nothing. The admin reads all and **cannot write** on a class they do not hold (and can for exceptions
   a–d). An **ended** class: reads yes, every write refused. A teacher with no class: empty, not an error.
   A moved student: the old teacher 404 on the next request. Boundary-second tests for a class window.
2. The twentieth SQL file, then **mutation checks** (drop the class test from each policy in turn: its
   denials go red).
3. `db:push` of each addendum to the deployment (ref checked), then the API scope module and routes.
4. The console, page by page, each through its own gate (the six assertions at 1440 and 380, captures
   opened): `/students`, `/students/:userId`, `/attempts/:id`, `/locks`, `/submissions`, `/gradebook`,
   `/assessments`, `/live`, `/feedback`, `/audit`, the Studio's class lists, then `/chat` last.
5. `can_remove_avatar()` narrowed (twenty-first file).
6. Chat (§5.7), if confirmed, as its own piece with its own gate.

**Sizing:** the scope, the denials and the twenty-first file: one session. The console pages: one. The
assessment windows (A) and the chat additions: one each. The count of SQL files in `CLAUDE.md`,
`scripts/db-reset.mjs` and `docs/LOCAL-STACK.md` moves from nineteen as each lands.
