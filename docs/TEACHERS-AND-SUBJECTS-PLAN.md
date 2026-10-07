# Teachers, subjects and classes — plan v1, APPROVED 7 Oct 2026 (night)

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

- `subjects (code pk, title, book_title, book_edition)` — `'CPE 412'` seeded;
  the code matches the assistant's `assistant_course_ok()` pattern.
- `classes (id, section_id, subject_code, teacher_id, term)` — one section,
  one subject, one teacher; unique per (section, subject, term). A teacher
  holds many; the admin can hold classes too.
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

**The admin as a teacher:** every teacher page works for the admin exactly
as for a teacher, with the classes the admin holds. `/teachers` is the only
addition. `requireAdmin()` beside `requireStaff()`, server-side; the console
hides the nav item, it never decides access.

## 3. Phases

| Phase | What | Size |
|---|---|---|
| **T1** | Subjects, classes, the teacher roster, `/claim`, `/teachers` (admin-only), `requireAdmin`, denial tests. Only CPE 412 has content: a class on another subject shows "no content for CPE 413 yet". Existing sections are assigned to CPE 412 and their current teacher | 2 sessions |
| **T2** | **Scoping teachers to their classes** (see question B below): a teacher's `/students`, gradebook, locks, submissions and chat show their classes only; RLS by class, with denial tests | 2 sessions |
| **T3** | **A second subject's curriculum** (CPE 413): stages, items, objectives, blueprints and the star map keyed by subject. Touches nearly every table and the student app; its own plan, written when a second subject's syllabus and book exist | many |

## 4. Decided, and still open

- **A. Order: T1 FIRST**, before the assistant's app (instructor, 7 Oct).
- **B. A teacher sees ONLY their own classes**; the admin sees all
  (instructor, 7 Oct). That is T2, with class-scoped RLS and denial tests.
- **C. Still open: "different books".** Is a class's book its subject's
  textbook (one per subject), or can two sections of one subject use
  different books? Until it is answered, T1 keeps the book on the subject
  and a nullable override on the class, which serves either answer.

Each new page is born with a captured template, a `SPEC.md` and a spec at
1440 and 380 before it is built (CLAUDE.md). Templates for `/teachers`,
`/claim` and the locked `/assistant` are captured at the start of the build
session, after approval.
