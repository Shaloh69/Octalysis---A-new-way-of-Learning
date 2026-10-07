# Teachers, subjects and classes — plan v1, APPROVED 7 Oct 2026 (night); **T1 BUILT the same night**

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
