# NEXT-SESSION.md — start here after a `/clear`

**Last updated 14 September 2026.** Every figure here was **measured, not
remembered**, with the command beside it so you can re-run one rather than
re-derive all of them.

> **Do not re-audit this file.** It exists so a fresh session does not spend its
> first hour rediscovering what the last one established. Check a number when
> you are about to depend on it — then check that one.
> `REDESIGN-CLAUDE.md` §2c rule 3 cuts both ways: verify before repeating, but
> do not re-derive what carries its own evidence.

---

## 0a. Parked by the `/items` revamp — 25 Sep 2026

Found while rebuilding `/items` and deliberately **not** fixed there (one
session, one route). Each names where it lives and what it breaks.

1. **FIXED by the `/locks` session, 25 Sep 2026** (`.dialog-scrim` in
   `index.css`, a `color-mix()` of `--surface-0`; every console spec re-run,
   190 passed). Kept for the record: **The console's dialog scrim renders nothing.** `components/ui/dialog.tsx`
   draws its overlay with `bg-surface-0/80`, and Tailwind 3 emits no CSS for an
   opacity modifier on a `var()` colour, so every console dialog opens over an
   undimmed page. Seen on `/items`' review and import dialogs. A shared
   primitive: fix it as its own change (a token-based `color-mix()`), and run
   every console spec with a dialog, because every one of them changes.
2. **Spec skips that fire on a race are tests that have stopped existing.**
   `console-items.spec.ts` counted table rows the instant `<main>` appeared,
   while the page still said "Loading", so all four of its tests SKIPPED on
   every run for weeks while being reported as "four passing tests". Fixed in
   that file. `console-teaching.spec.ts`'s count-then-skip was checked and is
   not affected. **Any new count-then-skip must wait for the page to decide.**
3. **`db-demo` alone does not clean up after the API suite.** `pnpm test` /
   `pnpm verify` leaves the API test world behind (22 live stage-07 fixture
   items), and `db-demo` only adds, so `/items` then reads "205 in the bank ·
   22 live". **After any API test run: `pnpm db:reset && node scripts/db-demo.mjs`**,
   not `db-demo` on its own.
4. **The flagged-item fixture had never seeded anything.** It lived at the
   bottom of `demo-seed.sql`, which runs before the item bank exists, and named
   a slug (`G-07-order-1`) that no longer exists. Moved to
   `db/demo-item-stats.sql`, run after `sync-items`, and it now raises if its
   slug disappears again.
5. **`/console/items/:id/edit` is still not built.** Import refuses a live item
   for exactly that reason (versioning a live item retires it at once, and that
   page's confirm dialog is where "statistics do not carry over" is said).
6. **Two definitions of a valid item.** `services/api/src/items/import-plan.ts`
   mirrors `scripts/sync-items.mjs`' `validateShape()` rule for rule, because
   that script cannot import TypeScript. Change one, change the other;
   `import-plan.spec.ts` names each rule in the same order.
7. **Running the console specs rewrites committed PNGs.**
   `design/item-review/assessment-window.png` changes on every run of
   `console-assessment-window.spec.ts`. Restore it before committing unless
   that route is the session's work.

**Available to every route from now on:** `toast` (`components/ui/toast.tsx`,
mounted once **in `App.tsx` at the app root** since the `/signin` session),
`useDelayed` for the 400ms skeleton rule, and `design/specs/_gate.ts` — the six
assertions as functions. Import them; do not re-derive them.

---

## 0b. Parked by the `/signin` revamp — 25 Sep 2026

Found while rebuilding `/signin` and deliberately **not** fixed there. §0a's
seven still stand; none of them was touched.

1. **Running the console specs rewrites TWO committed PNGs, not one.**
   `design/item-review/send-back-panel.png` changes on a full console run as
   well as `assessment-window.png` (§0a.7). Restore both before committing:
   `git checkout -- design/item-review/`.
2. **FIXED by the shell session, 28 Sep 2026** (one handler, `toast.success("Signed out", …)`,
   asserted in `console-shell.spec.ts`). Kept for the record: **Signing out confirms nothing.** The three sign-out handlers live in
   `AppShell` (the nav, the student screen's "Sign in as someone else", the
   credential screen's "Sign out") and land on `/signin` with no toast and no
   line saying it happened. The toaster now reaches `/signin`, so the fix is a
   `toast.success("Signed out")` in the shell's handlers. A shell change, so
   not made from the `/signin` session.
3. **FIXED by the shell session, 28 Sep 2026** (nothing under 400ms, the shell's skeleton
   after, a sentence after 3s; the no-flash half is asserted, the skeleton half was not seen,
   §0i.1). Kept for the record: **"Checking your access…" flashes on every console route.** `AppShell`
   renders that bare text while `getIdentity()` resolves, with no 400ms delay
   rule (`useDelayed`), so it blinks on a fast load. Shell, not `/signin`.
4. **A real sign-in has never been seen succeed on the rebuilt page.** Locally
   there is no Supabase Auth and the console is built without
   `VITE_SUPABASE_URL`, so every submit takes the "built without its Supabase
   settings" branch. The three credential-failure sentences are unit-tested;
   the success path, and the "Signed in as …" toast on `/locks`, need a look
   **on the deployment** before anyone calls them verified.
5. ~~Two things for the instructor to decide~~ **Both approved and built, 25 Sep
   2026:** a self-service password reset (`/forgot-password`,
   `/reset-password`), and waking the API from `/signin` while the teacher
   types. **Neither success path has been seen**: locally there is no Supabase
   Auth and no email. **Before the reset works on the deployment:**
   - add `https://<console-domain>/reset-password` to Supabase → Auth → URL
     Configuration → **Redirect URLs** (without it the link goes to the Site
     URL, the student app)
   - check the project's **auth email delivery**. The built-in sender is
     heavily rate-limited and may deliver only to the project's team members.
     A teacher who is not on the Supabase team may need custom SMTP
   - then request a reset for a real staff address, open the email, set a
     password, and look at the "Password changed" toast on `/locks`
6. **The local stack went down twice in this session**: Docker Desktop stopped
   and took the dev servers with it. `design/global-setup.ts` caught it ("nothing
   is listening at :5184") before a single assertion ran against nothing. If a
   run dies in global setup, check `docker ps` before anything else.

---

## 0c. Parked by the `/locks` revamp — 25 Sep 2026

Found while rebuilding `/locks` and deliberately **not** fixed there. §0a and
§0b still stand, apart from §0a.1 (the scrim), which this session fixed.

1. **`pnpm db:reset` KILLS THE DEV API, and the same bug would kill Render.**
   `services/api/src/db.ts` creates a `pg` Pool with **no `'error'`
   listener**. A reset terminates the pool's idle connections ("terminating
   connection due to administrator command"), the pool emits `error`, nothing
   handles it, and Node exits. Seen twice in one session: every run after a
   reset died with "Failed to fetch" until `pnpm dev:api` was restarted. **In
   production the trigger is a Supabase restart, pause or dropped connection**,
   and the API goes down instead of reconnecting. The fix is one listener that
   logs and carries on, plus a test; it is API infrastructure, not `/locks`.
   **Until it lands: after any `db:reset`, `curl localhost:8090/healthz`
   before believing a red run.**
2. **FIXED here, because `/locks` broke it: `console-audit.spec.ts` wrote to a
   student who did not exist.** `ISOLATED_STUDENT = 7091eff0-…` is in no
   seed. Its "open" writes failed on a foreign key; its "auto" writes deleted
   nothing and **still wrote an audit row about a nonexistent student**, and
   those junk rows were what "the reason is never truncated" found. The API
   now refuses a lock for anyone not on the roster, the junk stopped, and the
   spec went red. It now uses `232129021` (seeded, read by no other spec) and
   **asserts every write**. Lesson for every spec that seeds through an API:
   check the response, or the fixture can be empty and the spec still green.
3. ~~**Stage 01 is closed for all 21 demo students.**~~ **Fixed 30 Sep 2026:**
   `is_stage_unlocked()` excuses a non-gradeable prerequisite (§3a), so stage
   01 is open from the start and `/locks`' column 01 no longer reads 0.
4. **A controlled Radix dialog with no `Trigger` does not return focus.** Radix
   has nowhere to send it and focus lands on `<body>`. `/locks`' reason
   dialog fixes it with `onCloseAutoFocus` and a remembered opener. Any other
   console page opening a dialog from state (not a `DialogTrigger`) has the
   same bug; `/items` proved its own, the rest are unchecked.
5. **A radio group is a keyboard-gate failure waiting to happen.** Only the
   checked radio of a group is in the Tab order, so `unreachableByKeyboard`
   counts the others. `/locks`' sections form uses two `aria-pressed` buttons
   instead. The reason dialog's three radios passed, because Radix's focus
   trap cycles through every candidate. Prefer pressed buttons for a two-way
   or three-way choice on a new page.
6. **The GET the matrix reads changed shape.** `globalLocks` is gone;
   `scopeLocks` (global AND section, with `setBy`/`setAt`) and `sections`
   replace it, and every cell carries `setBy`/`setAt`. Nothing else read
   `globalLocks` (grepped), but a script that did would now get `undefined`.

**Available to every route from now on:** `.dialog-scrim` (every dialog dims
the page), and `design/specs/_locks-fixture.ts` as the pattern for a spec
that patches a REAL response rather than inventing one: the layout is tested on
real rows, and only the states the seed lacks are added.

---

## 0d. Parked by the `/students` revamp — 25-27 Sep 2026

Found while rebuilding `/students` and deliberately **not** fixed there. §0a,
§0b and §0c still stand.

1. **Live Supabase is emptier than 25 Sep's note said.** Measured 25 Sep with
   a read-only query over `SUPABASE_DB_SESSION`: 21 public tables (the missing
   one is `submissions`, i.e. `addendum-submissions.sql` never ran there), **0
   items and 0 `content_blocks` for stages 00-04**. The Prelim sentence is
   false on the deployment for more reasons than "96 at review". Nothing in a
   route session can fix it; it is a deploy session (`DELIVERY.md`, and §3b
   here on `--reset`).
2. **The student app has no screen for "you have been deactivated".** Since
   this session, `identityFrom()` answers every request from a deactivated
   student with 403 *"This account has been deactivated. Ask your
   instructor."* The student app shows whatever its generic error path shows.
   It should say that sentence once, plainly, and sign out. `apps/web` work.
3. **Deactivation is not a Supabase ban.** A deactivated student can still
   complete a Supabase sign-in with their email; every API call after it is
   refused, and the app reads nothing except through the API, so they see
   nothing. If a hard stop at sign-in is ever wanted, it is the Supabase admin
   API's `ban_duration`, set and cleared by the same route. Not built; say so
   if asked.
4. **`identityFrom()` now costs one primary-key lookup per STUDENT request**
   (`profiles.deleted_at`). Cheap, but it is a query on every call on Render's
   free tier. Staff requests skip it.
5. **The console's Tailwind spacing scale is the token scale, not Tailwind's.**
   `pl-8` rendered as 64px, not 32px, and floated `/students`' search
   placeholder away from its icon. A green spec did not see it; the screenshot
   did. Any page reaching for a Tailwind spacing number from memory will be
   wrong the same way.
6. **A Radix menu item that opens a dialog:** `components/ui/dropdown-menu.tsx`
   defaults `modal={false}`, because a modal menu locks `<body>` pointer events
   and the dialog it opens can inherit the lock. Focus return goes through the
   remembered menu button, as §0c.4 describes. Reuse it; do not add another
   menu.
7. **Docker Desktop stopped again between sessions** (§0b.6). The first sign
   was the dev API and console both gone. `docker ps` first, always.
8. **Deploy skew.** The import's response changed (`summary.skipped` became
   `unchanged` and `conflict`). The API and the console were pushed in the same
   push, but Render and Vercel finish at different times; for a few minutes
   the deployed console can show the new API an old dialog. Harmless (a dry run
   writes nothing), and gone once both deploys finish.

---

## 0e. Parked by the `/students/:userId` revamp — 27 Sep 2026

Found while rebuilding the student record and deliberately **not** fixed there.
§0a to §0d still stand.

1. **Starting an attempt that cannot be filled answers 500.**
   `POST /api/v1/attempts` lets `BlueprintUnsatisfiable` (engine/blueprint.ts)
   escape unmapped, so a student pressing Start on a paper the bank cannot
   fill sees "Something went wrong on our side", not a sentence. Locally that
   is **every** Start: all 96 act-1 items sit at `review`, 0 live. It should be
   a 4xx naming the shortfall, as `/assessments`' feasibility panel already
   does for staff. `services/api/src/routes/attempts.ts`, plus a test.
2. **A spec that drives a real attempt has been skipping, not passing.**
   `console-student-detail.spec.ts`' original test ("expanding an attempt
   shows the regenerated variant in place") skipped at 1440 on EVERY local run,
   inside the "42 skipped, width-specific by design". It was not by design;
   it was item 1. Its message now says so, and 40 fixture-backed tests cover the
   route meanwhile. **`design/specs/attempt-runner.spec.ts` (apps/web) also
   starts real attempts**: check it before believing a green run of it while
   no item is live.
3. **"/attempts/:attemptId is the only place a key is shown" was never true.**
   `/students/:userId` has shown keys since P4, and still does for handed-in
   papers. `CONSOLE-REVAMP.md` §3, the R3 box and `apps/console/CLAUDE.md`'s
   `/attempts` row all say "only". When `/attempts/:attemptId` is rebuilt
   (last), decide whether it withholds the key on an in-progress paper the way
   this page now does (instructor, 27 Sep 2026: render-side here; the
   API-side option was offered and not chosen).
4. **Tailwind's preflight strips every list marker.** `<ol type="A">` drew no
   letters until `.record-options` set `list-style-type` itself. A green spec
   did not see it; the screenshot did, and a test now asserts it. Any page
   relying on `type=` or on a browser-default marker is unlettered the same way.
5. **`toLocaleDateString("en-GB")` is not one format**: ICU writes "Sept".
   `lib/record-view.ts` `dayDate()` builds the date by hand, and a unit test
   caught the difference.
6. **The deployment was NOT measured on 27 Sep.** A read-only connection over
   `SUPABASE_DB_SESSION` hung for ten minutes without a single row, so the
   Prelim sentence's deployment half rests on 25 Sep's figures (§0d.1). A
   Supabase Free project pauses after 7 days idle, which would explain it. Look
   at the dashboard before the next deploy session.
7. **Docker Desktop stopped a THIRD time mid-session** (§0b.6, §0d.7), and
   took the console dev server with it; the dev API outlived it but had no
   database. `curl localhost:8090/healthz` still answered 200, because
   `/healthz` does not touch the database. **After any outage, prove the API
   with a real query**, not `/healthz`.

---

## 0f. Parked by the `/assessments` revamp — 27 Sep 2026

Found while rebuilding `/assessments` and deliberately **not** fixed there.
§0a to §0e still stand; §0e.1 (the 500 on an unfillable Start) is untouched.

1. **Feasibility ignores `max_per_objective`, so "fills" can be a false
   positive.** `feasibilityOf()` in `routes/assessments.ts` counts by act,
   bloom and type; `engine/blueprint.ts` also caps items per objective (a
   stage check draws at most 2 per objective). Once items go live, a row can
   say `fills` and Start can still throw. Locally invisible (0 live, every
   blueprint short). The fix is the check calling the engine's own filler, or
   mirroring the cap, plus a test. API work.
2. **A toast raised while a Radix modal is open is hidden from assistive
   technology.** Radix marks everything outside the dialog `aria-hidden`, and
   the toaster is outside it, so a screen reader hears only the dialog's own
   `role=alert`. Every console dialog that stays open on a failed write works
   this way, and each has its own in-dialog alert, so nothing is lost; but a
   spec cannot find that toast with `getByRole` (`[data-toaster]` does).
3. **A tall dialog's footer can sit under a toast.** The toaster is anchored
   bottom-right at 1440; `/assessments`' create dialog (13 shortfall rows on
   a final) put its Create button under the error toast until its height was
   capped (`max-h-[calc(100vh-12rem)]`, with a spec that measures the overlap
   and was watched failing). Other tall dialogs (`/items`' import preview,
   `/students`' import) are unchecked.
4. **The gate cannot see inside a native input.** A mono `datetime-local`
   in a `max-w-md` dialog cut "PM" off its value under a green assertion 1.
   `/assessments` now measures each date field against its value's rendered
   width. Also learned: `getComputedStyle(input).font` is `""` in Chromium;
   read `fontFamily` and `fontSize`.
5. **A native `<option>` cannot set a number in mono.** The blueprint and
   section pickers name blueprints and sections only; counts live in the
   preview beside them, in mono. Any page putting numbers in an `<option>`
   breaks the type rule where nothing can fix it.
6. **Section scope is now enforced at Start** (instructor-approved, built
   here, denial watched failing at 200): `startAttempt` answers 404 to a
   student outside an assessment's section, matching RLS. Recorded because it
   touches `engine-repo.ts`, which `/attempts` work reads.

---

## 0g. Parked by the `/submissions` revamp — 27 Sep 2026

Found while rebuilding `/submissions` and deliberately **not** fixed there.
§0a to §0f still stand; §0e.1 (the 500 on an unfillable Start) and §0f.1 (the
feasibility cap) are untouched.

1. **The freeze on a MARK is API-deep, not database-deep.** Since this
   session `POST /grade` answers 409 on a graded row. But the trigger
   `submissions_freeze_when_graded` freezes only `body_md`, `payload` and
   `attachments`, and `sub_staff_all` lets any staff JWT update any column
   straight through Supabase. A staff client that bypasses the API can still
   change a graded row's score with no return and no audit row. The fix is the
   trigger also refusing `score`, `max_score` and `rubric` on a graded row
   unless the row is being returned: schema work, `VERIFICATION.md` first,
   denial test first.
2. **A returned row keeps its old score.** `POST /return` sets the status and
   the reason and leaves `score`, `max_score` and `graded_by` in place, and
   INV-31 only looks at graded rows. Nothing reads submissions into the
   gradebook yet, but when `/gradebook` does (the 40%), it must count
   `status = 'graded'` only, or a returned lab still scores.
3. **The seed's graded labs are out of 100 with an empty rubric**, while the
   console marks a lab 0-4 against the manual's bands. When the gradebook
   reads submissions it meets both scales; normalise by `max_score`, never
   assume 4. Seeding lab grades out of 4 with a band would make the demo
   honest; `scripts/demo-seed.sql` is where they come from.
4. **The student app says nothing about a return.** `/app/work`
   (`SubmitPage.tsx`) shows `feedbackMd`, which after a return IS the return
   reason, under the same heading as feedback. It should say "Returned for
   revision" and invite a resubmission. `apps/web` work (`WEB-REVAMP.md` #5).
5. **Attachments are names only.** `attachments[].path` is a storage path and
   no storage bucket exists, so the pane lists file names with no download.
   Nothing seeds an attachment; the spec patches one in.
6. **A toast over a form at the foot of a 380 page (§0f.3) had a second
   cause:** the page was already scrolled to its end, so the refused Save
   could not be lifted clear. `/submissions` reserves room under its pane at
   380 and scrolls the action row up with a `scroll-margin-bottom`. Any other
   page whose last control is a submit at 380 is unchecked.
7. **The gate's positive control raced** (`console-students.spec.ts` went red
   in a full run, 6 of 6 alone). `_gate.ts` now has `motionStarted()`, which
   waits for the entrance to be recorded; the five specs with the same read
   use it. **New specs: use `motionStarted`, not a one-shot
   `recordedMotion`.**

---

## 0h. Parked by the `/gradebook` revamp — 28 Sep 2026

Found while rebuilding `/gradebook` and deliberately **not** fixed there.
§0a to §0g still stand; §0e.1 (the 500 on Start), §0f.1 (the feasibility
cap) and §0g.1 (the database-deep freeze) are untouched.

1. **The deployment answered this time, and it is empty.** A read-only
   query over `SUPABASE_DB_SESSION` (15s connect timeout) returned **0
   `content_blocks` for stages 00-04 and 0 items in total** on 28 Sep. §0e.6's
   hang did not recur. The Prelim sentence is false there on conditions 1-4,
   not only on "96 at review".
2. **Class participation has no teacher-side entry.** Participation is a
   `submissions` row with `kind = 'participation'`, and only a STUDENT can
   create one (`sub_own_insert`); staff can only mark what a student hands in.
   The syllabus's 10% is "seatwork, assignment", which a teacher usually
   records rather than a student submits. Until something writes these rows,
   the gradebook's Participation column stays "no marks yet". Instructor's
   call: a staff write (reason, audit row), or a student deliverable.
3. **Only two of the four major exams exist.** `sync-assessments` creates the
   Prelim and Midterm (final-scope blueprints by act); there is no Semi-finals
   or Finals blueprint. The gradebook orders exams by the blueprint's
   `by_act` key and counts whichever have been sat, so it will work, but the
   Major exams component cannot reach its four periods until those two exist.
4. **Quizzes are best-of.** A stage check's score is `stage_progress.mastery`,
   which the grading service writes as `greatest()` across attempts (up to
   `attempts_allowed`, 5). The syllabus does not say best, latest or mean.
   Recorded as the rule the gradebook inherits, not a decision anyone made.
5. **The seed says every demo student SAT stages 01-07 while stage 01 is
   closed for all of them** (§0c.3). `stage_progress` is seeded directly. The
   gradebook reads it faithfully; the demo is inconsistent, not the page.
6. **XLSX and "the university's format" wait for a sample grade sheet.**
   `PAGE-SPECS.md` and `MASTER-PLAN.md` §6.7 name it and nothing defines it.
   When one arrives, it is an export shape over the same `computeGradebook()`,
   and an XLSX writer is a new dependency to approve first.
7. **The console's main chunk is 560 KB (167 KB gz)** and Vite warns past
   500 KB. The gradebook chunk fell to 4.3 KB gz this session (no Recharts);
   the main chunk was not touched and its size was not measured before, so no
   claim is made about when it grew. The shell session (next) is the natural
   place to look, since the shell is in it.
8. **`getClientRects().length > 1` is not "broken across lines".** JSX writes
   `{weight}%` as two text nodes, which is two rects on ONE line. The
   gradebook's check counts distinct line tops instead. Any spec counting
   rects to find a wrap will fire on every `{n}%`.
9. **Recharts is now imported by no console page.** It stays in
   `apps/console/package.json` (`apps/console/CLAUDE.md` still names it as
   the chart library), tree-shaken out of every chunk. Remove the dependency,
   or keep it for `/console/analytics`: a decision, not a defect.

**Available to every route from now on:** `_gradebook-fixture.ts` shows how
to patch a computed response and **recompute** what the patch touches, so a
fixture screenshot never shows a total that disagrees with its own row; and
`node --experimental-strip-types` runs a capture script that imports a spec
fixture directly, so `current*.png` show exactly the data the spec tested.

---

## 0i. Parked by the shell revamp — 28 Sep 2026

Found while rebuilding `AppShell` and deliberately **not** fixed there. §0a to
§0h still stand, except §0b.2 and §0b.3, which this session fixed; §0e.1 (the
500 on Start), §0f.1 (the feasibility cap), §0g.1 (the database-deep freeze)
and §0h.2 (participation entry) are untouched.

1. **The access skeleton has never been seen.** Locally `getIdentity()` reads
   the dev token from `localStorage` and resolves at once, so the 400ms
   skeleton and the 3s sentence cannot appear; the spec asserts only the
   no-flash half. On the deployment `getIdentity()` waits on Supabase's
   `getSession()`, which can refresh a token over the network. Look there,
   on a cold load, before calling the skeleton verified.
2. **Sign-out has been seen with the dev token only.** The toast, the landing
   on `/signin` and the token removal are asserted locally, where `signOut()`
   never calls Supabase. The deployed path (`auth.signOut()`, and its failure
   toast) is unseen, like §0b.4's sign-in.
3. **The console's main chunk: 566.38 KB (167.92 KB gz)** after this session,
   560.28 KB (166.87 KB gz) before it, measured by building both trees. The
   shell costs 1.05 KB gz. What makes up the other 560 KB was not measured;
   `supabase-js`, Radix and TanStack are the likely weight. §0h.7 stands.
4. **`_gate.ts`' motion recorder now names two more surfaces**, `menu`
   (anything inside `[role=menu]`) and `shell` (`[data-shell]`), checked
   after `main`. A route's reduced-motion test that filters ALL recorded
   motion (not by surface) now also sees a row menu's fade; under reduced
   motion that is ≤1ms, so no spec changed colour (455 passed). A new
   positive control can read `motionStarted(page, "menu")`.
5. **Nav hints are hover-only.** Each link keeps its hint in `title`
   ("Projector view: no names, ever" on Live), which a keyboard or touch user
   never sees. Nothing depends on them; if one ever carries something a
   teacher must know, it belongs on the page, not in a tooltip.
6. **`/submissions`' `current.png` changed state, not only shell.** The old
   one (3418px) was a different state from the seeded default queue this
   session captured (1335px). Only `/gradebook`'s and `/submissions`'
   `current.png` / `current-380.png` were re-captured; every other console
   route's `current*.png`, and every state shot, still shows the OLD shell.
   Each route session re-captures its own; do not read a stale one as the
   shell regressing.
7. **`apps/console/test-results/`** sits untracked at the repo root of the
   console (it was there before this session). Playwright writes it when a
   spec runs from that directory. Add it to `.gitignore` or stop producing it.
8. **At lg and up the DOCUMENT no longer scrolls; `<main>` does** (instructor
   ruling, the template's frame). Every console spec passed unchanged (no spec
   or page scrolled `window`), but from now on: scroll `main`, not `window`;
   `position: sticky` inside a page sticks to `main`; and a full-page capture
   at 1440 needs a viewport as tall as main's CONTENT (measure its children,
   not `main`). Two traps met on the way, both in the SPEC: `.shell` must
   not clip (the gate then read everything below main's fold as "cut off",
   seven routes red at once, a false alarm), and `main` must be
   `position: relative` (absolute sr-only text escaped it and grew the
   document to 2223px).
9. **Two reds seen once, in one full run, not since.** In the run where the
   clipping false alarm fired: `console-assessment-window.spec.ts` "status
   is a word decided by the window" (1440) and `console-submissions.spec.ts`
   "a project takes a score out of a maximum" (380, "Response has been
   disposed" while the context closed). Both passed in the next two runs
   (targeted and full). Probably load under that run's seven failures; a red
   that returns is real.

---

## 0j. Parked by the `/content` revamp — 28 Sep 2026

Found while rebuilding `/content` (and building its summary review and block
editor, instructor rulings of 28 Sep) and deliberately **not** fixed there.
§0a to §0i still stand; §0e.1, §0f.1, §0g.1 and §0h.2 are untouched.

1. **THE DEPLOYED `/content` WILL ANSWER 500 until the schema is pushed.**
   Render builds the API from `main`, and `GET /console/content` now joins
   `stage_summaries`, which the deployed Supabase does not have (it predates
   even `submissions`, §0d.1, and was empty on 28 Sep, §0h.1). The fix is §3b's
   `db-push-supabase.mjs --reset` then the sync scripts: the instructor's call,
   and it was already needed for every other reason. `schema.sql` carries the
   new tables, so no seventh file joins the apply order.
2. **The full console suite is unreliable against the DEV server; run it
   against a build.** Three full runs at 4 workers against `:5184` (Vite dev)
   failed a *different* 3-4 tests each time, every one passing alone. The
   traces show why: 12 of 85 module requests never completed (`-1`), then one
   pre-bundled dep (`tailwind-merge.js`) on a 2-worker run, and the app never
   boots, so the page is blank. Against `vite build` + `vite preview --port
   5185 --strictPort` (5185 is already in the API's CORS list) the blank pages
   stopped. **Gate runs from now on:** build, preview on 5185, and
   `OCTA_CONSOLE_URL=http://localhost:5185`. The dev server is for looking,
   not for a 560-test run. `CONSOLE-REVAMP.md` §5 now says so (updated this session).
3. **The student reader shows raw markdown students were never meant to see.**
   `StageReader.tsx`'s `Paragraphs` has no heading branch, so every `## The
   problem, stated as a trade` in stages 01-07 reads to students with its two
   hashes. And a list whose items wrap onto a second line is not a list (every
   line must start with `-`), so stage 04's "Temporal locality … Spatial
   locality" is one run-on paragraph with literal dashes. `/content`'s preview
   mirrors the reader exactly, so both are visible there now. `quote` blocks
   have no branch either (drawn as prose), and a `brief` nests `<p>` inside
   `<p>`. `apps/web` work: `WEB-REVAMP.md` route #2, the reader.
4. **`console-teaching.spec.ts`' `/assessments` empty-state test failed once**
   in a combined run (content + teaching, 70 tests) and not in 12 repeats
   alone. It is a count-then-skip that counts "no assessments yet" the moment
   the page opens: §0a.2's race, which that section said this file did not
   have. Not `/content`'s spec. Make it wait for the page to decide, in the
   `/assessments` or a spec-hygiene session.
5. **Any fixture that `route.fetch()`es can fail the NEXT test in its worker.**
   `_content-fixture.ts` did, twice, on `/signin` (fixed: a read that outlives
   its test is dropped). `/submissions`' two tests were fixed by waiting for the
   reload (this session's first commit). `_assessments-fixture.ts` (126, 134)
   and `_gradebook-fixture.ts` (125) have the same shape and are unchanged; not
   seen red. If one goes red with "Test ended" at a `route.fetch`, that is it.
6. **A direct staff write to `content_blocks` is archived but not flagged.**
   The trigger keeps the text it replaced (`replaced_via = 'direct'`), but only
   the API sets `console_edited`, so sync treats a direct write as "file
   unchanged, database differs" and **the file wins** on the next sync. Nothing
   is lost (history has it) and no client does this today; `cb_staff` still
   grants it. Tightening it (a trigger setting `console_edited` on any
   non-sync write, or dropping `cb_staff`'s write) is schema work.
7. **`st_staff` still lets any staff token write every other column of
   `stages`** (published, prereq, title). Only `summary` is now guarded. Same
   shape as §0g.1: API-deep elsewhere, database-deep only where a trigger says.
8. **Reviewing a summary is not the same as approving 19 of them.** All 19 are
   `draft`, 0 approved, so students see no summaries; `WEB-REVAMP.md` §3.1
   already says the sidebar line is simply absent until then. The R3 box
   "Planet summaries approved" stays open and is the instructor's.

**Available to every route from now on:** `runAsSteps()` in
`services/api/test/helpers/rls.ts` (several statements as one actor in one
rolled-back transaction; one multi-statement string returns an ARRAY from `pg`
and `runAs` reads `rows` off it), and the note that **`wasDenied()` counts any
error as a denial**, "relation does not exist" included: a denial test on a new
table must assert the outcome, with a positive control, or it passes before
the table exists.

---

## 0k. Parked by the `/audit` revamp — 28 Sep 2026

Found while rebuilding `/audit` (and building its server filters, Load older,
CSV export and the append-only trigger, instructor rulings of 28 Sep) and
deliberately **not** fixed there. §0a to §0j still stand; §0e.1, §0f.1,
§0g.1, §0h.2 and §0j.3-7 are untouched.

1. **THE DEPLOYED `/audit` WILL ANSWER 500 until the schema is pushed**, like
   `/content` (§0j.1). `GET /console/audit` now joins `submissions` to name
   the student a mark was for, and the deployed Supabase has no `submissions`
   table (§0d.1). The same `db-push-supabase.mjs --reset` fixes both and also
   brings the new append-only trigger; `schema.sql` carries it, so no seventh
   file joins the apply order.
2. **`audit_log` is append-only now, for every role, TRUNCATE included**
   (`audit_log_no_update` / `_no_delete` / `_no_truncate`, `deny_audit_mutation()`).
   Two fixtures delete from it and suspend the delete trigger by name as the
   table owner: `resetAll()` (`services/api/test/helpers/reset.ts`) and
   `db/demo-seed.sql` (demo actors only). **A new fixture that deletes audit
   rows must do the same**, or it fails with "audit_log is append-only".
   `auth.users` rows that appear in the log as an actor could never be
   hard-deleted anyway (the FK has no `on delete`), which is V-20's stance.
3. **No invariant checks that the three triggers exist.** `rls.spec.ts`
   proves they refuse (watched failing first), but a deployment where the
   schema was pushed without them would pass `run_invariants()`. A small
   `inv_` over `pg_trigger` for `responses`, `content_block_versions` and
   `audit_log` would make it structural. Schema work.
4. **An entry names the student as they are NOW, not as they were.** The API
   resolves `subject` through `profiles` / `student_directory` at read time,
   so a renamed student reads under the new name in every old entry (the
   API test meets exactly this: a roster test renames Student A first). The
   ids never change and are in Details and the CSV. If the name at the time
   is wanted as evidence, the writing routes must put it in the payload
   (only `roster.deactivate` does, as `fullName`). Instructor's call.
5. **`db/demo-audit.sql` is new and seeds only what the demo state agrees
   with** (roster import, 21 account claims, 96 items to review, a lock
   opened and handed back, 30 lab marks, a lifted Prelim window). It must
   never seed `assessment.salt_rotate` (`/assessments` reads it back as
   "rotated") or a null-actor row (append-only: nothing could remove it).
   The spec adds content edits, summary decisions and a scheduled window
   through `_audit-fixture.ts` instead.
6. **`getByLabel()` matches by substring, and aria-labels count.** "To"
   matched 53 Details buttons (their labels carry the entry's sentence) and
   "Who" matched "About whom or what". Use `{ exact: true }` for a short
   label; a green run elsewhere does not mean another spec is safe from it.
7. **shadcn.io block previews are centred in a `min-h-screen` box, so at a
   900px viewport a tall block overflows UPWARD** and a full-page capture
   silently starts mid-block (the Audit Trail lost its heading and filters
   under a 200). Capture those at 1440×1500 and 380×1900.

**Available to every route from now on:** `requestText()` in
`apps/console/src/lib/api.ts` now passes the server's refusal sentence
through (an export over its cap says how many matched), and
`_audit-fixture.ts`'s rule, **never slice a patched page back to its limit**:
the dropped real rows are ones Load older, starting from the API's own
cursor, would never fetch.

---

## 0l. Parked by the `/system` revamp — 28 Sep 2026

Found while rebuilding `/system` (and building its catalogue, the "notice only
when empty" rule and the nightly-run history, instructor rulings of 28 Sep) and
deliberately **not** fixed there. §0a to §0k still stand; §0e.1, §0f.1, §0g.1,
§0h.2, §0j.3-7 and §0k.3-4 are untouched.

1. **Two other places still relabel INV-18/27/28/29 unconditionally.**
   `run_invariants_nightly()` (`db/addendum-cron.sql`) leaves all four out of
   `audit_runs.passed` whatever the database holds, and `scripts/db-invariants.mjs`
   (`EXPECTED_EMPTY_DB`, what `db:reset` and `pnpm verify` print) calls them
   "expected on an unseeded database" on a seeded one too. So the nightly would
   record a run as passed while the Prelim cannot be filled. The API now relabels
   only when the table a check reads is empty (`services/api/src/audit/invariants.ts`),
   and `/system` counts a run from its stored results, never from `passed`. Aligning
   the cron is schema work; the script is a small change. Both should call one rule.
2. **The API test world makes INV-28 true.** `seedItemBank()` publishes graded
   stages it gives no objectives, so with the relabel gone INV-28 fails there, and
   `console.spec.ts`' "zero structural failures" now pins exactly that (INV-28 only,
   every row "stage has no objectives"). If the fixture gains objectives, that test
   must change with it; that is the test working, not breaking.
3. **A failing check's sample columns are in jsonb's order, not the function's.**
   `run_invariants()` builds `sample` with `jsonb_agg`, and jsonb stores keys by
   length then bytes, so INV-18 reads `bucket, needed, available, dimension,
   assessment_id`. Harmless; `json_agg` would keep the function's order, and it is
   a schema change.
4. **No console control releases a claimed roster row.** INV-06 (a claimed row
   with no account) can only say "the claim has to be corrected by staff", because
   `/students` offers no way to do it. If INV-06 ever fires, a teacher has nowhere
   to go. `/students` work, or a decision that it is SQL-only.
5. **The deployed `/system` should work without the schema push**, unlike `/content`
   and `/audit` (§0j.1, §0k.1): its GET reads `run_invariants()`, `items`,
   `content_blocks`, `objectives` and `audit_runs`, all in the old schema. Not
   verified on the deployment. Whether the deployment's `octa-invariants` pg_cron
   job exists, and so whether any nightly run will ever appear, is also unverified.
6. **A full console run is not re-runnable on the same database.** This session's
   second full run, straight after the first, went 3 red (two `/items` tables
   that never loaded, one `net::ERR_NETWORK_CHANGED`, a Windows network event);
   `console-items.spec.ts` passed 29 of 29 alone after a reset. The first run was
   552 passed and 54 skipped, one more skip than 28 Sep's 53, and the second 53:
   a count-then-skip somewhere moved once (§0a.2, §0j.4). **Reset and re-demo
   between full runs**, and a skip count that moves is a finding.
7. **shadcn.io's `/view/...` previews open a guided tour** ("Switch views, Step 1
   of 4") whose scrim greys the whole block; every first capture answered 200 under
   it. Click **Skip tour** before capturing (`design/templates/console/system/SOURCE.md`).
8. **The catalogue's 28 descriptions were drafted from the SQL**, not taken from a
   course document: they describe the database, not course content, so rule 5 does
   not bind them. They are for the instructor to read in the screenshots, and to
   correct in `services/api/src/audit/invariants.ts` if any says too much.

**Available to every route from now on:** `_system-fixture.ts` imports a pure API
function (`presentInvariant`) so a patched state is worded by the API, not copied
(import it with its `.ts` extension, so a `node --experimental-strip-types`
capture script can load the fixture too).

---

## 0m. Parked by the `/feedback` revamp — 29 Sep 2026

Found while working `/feedback` and deliberately **not** fixed there, except
item 1, which was the session's baseline red and so its work. §0a to §0l still
stand.

1. **FIXED here, because the baseline gate went red on it: `/assessments`'
   create dialog lost Create after a refusal.** `console-assessment-window.spec.ts`
   "a refused create … raises an error that stays" failed at 1440 on the first
   full run of 29 Sep, and 5 of 5 alone, after passing on 28 Sep. Nothing had
   changed but timing: the default blueprint is the Final Examination, whose
   13 shortfall rows overflow the dialog, and the WHOLE dialog was the
   scroller. When a teacher pressed Create before the bank's verdict landed,
   the refusal came first and the rows arrived after it, pushing Create under
   the error toast (1440) or off the dialog entirely (380, where the old
   box-overlap check could not see it, because the hidden button's box never
   met the toast). `CreateDialog.tsx` is now a column whose BODY scrolls, with
   the refusal and the footer pinned; the test runs both orders at both widths
   and asserts Create is in the viewport (`bankDelayMs` in
   `_assessments-fixture.ts`). Watched failing: 1440 in the full run and 5
   repeats, 380 in 4 of 4. **Any other dialog whose content can arrive after a
   refusal has the same shape** (`/items`' import preview, `/students`' import;
   §0f.3 already named both as unchecked).
2. **The console cannot send feedback.** `PAGE-SPECS.md` §4.1's flag ("present on
   every page") exists only in the student app (`FeedbackWidget.tsx`), so a
   teacher has never been able to report anything, and §4.4's "My feedback"
   tab could only ever be empty. Deferred by the instructor (29 Sep 2026) until
   the flag exists; it is **shell work**, touching every route, for its own
   session. When it lands, "My feedback" is `?reporter=me` over the same queue.
3. **`/items` has no address for one item.** A question report shows its item's
   slug in mono and cannot link to it: `/items` reads no item from the URL, so a
   link would drop the teacher at the top of 183 items. §4.2's "routes straight
   into the `/console/items` review queue" is not built either: `/items` shows
   no reports. Both are `/items` work.
4. **The demo cannot show a variant.** All 5 seeded question reports lack an
   item and a variant (INV-25), and the seed cannot honestly hold one: a variant
   is rebuilt from an attempt, and no paper can be filled while 0 items are live
   (§0e.1). `console-feedback.spec.ts` patches one in (`_feedback-fixture.ts`).
   Once items go live, seed a real content report through `POST /feedback` with
   an attempt, and the fixture's patch can go.
5. **A spec that waits for `<h1>` is not waiting for data on a rebuilt page.**
   `console-live-feedback.spec.ts`' `open()` waited for the heading, which the
   OLD `/feedback` rendered only with its rows; the rebuilt page shows its
   heading at once, above a skeleton, so two old tests counted rows before any
   existed. They now wait for `[data-group]` (§0a.2's rule). `/live`'s tests in
   the same file use the same `open()`: check them when `/live` is rebuilt.
6. **Bulk triage writes one audit row per report.** Moving a group of 40
   identical reports is 40 `feedback.triage` entries in `/audit`, each worded
   "Marked a feedback report as …". Correct as evidence, noisy to read; if it
   matters, `/audit` could say "one of N in a group" from `payload.groupSize`.
7. **The single-report `PATCH /console/feedback/:id` still exists**, and the
   console no longer calls it (every triage is the bulk PATCH, even for a group
   of one). Kept because `feedback.spec.ts` tests it and nothing is gained by
   removing a working, staff-only route; delete it deliberately or keep it.
8. **SUS rows carry no release** (`POST /feedback/sus` writes no `app_version`),
   so §4.4's SUS trend has nothing to plot. The trend waits for that, and for
   responses: 0 on the seed.
9. **Docker Desktop stopped a fourth time** between sessions (§0b.6, §0d.7,
   §0e.7). `docker ps` first; Docker Desktop can be started from its `.exe`.

---

## 0n. Parked by the `/live` revamp — 29 Sep 2026

Found while rebuilding `/live` (and building the server and console half of
"push an item", the projector as `/live/present`, and the small-cell rule,
instructor rulings of 29 Sep) and deliberately **not** fixed there. §0a to §0m
still stand; §0e.1, §0f.1, §0g.1, §0h.2, §0j.3-7, §0k.3-4, §0l.1-4 and
§0m.2-8 are untouched.

1. **THE DEPLOYED `/live` WILL ANSWER 500 until the schema is pushed**, like
   `/content` and `/audit` (§0j.1, §0k.1). `GET /console/live` now reads
   `live_sessions` and `live_responses`, which `schema.sql` carries and the
   deployed Supabase does not have. The same `db-push-supabase.mjs --reset`
   fixes all three; no seventh file joins the apply order.
2. **Students cannot answer a question yet, and the page says so.** The
   student half is `/app/live` (`WEB-REVAMP.md` work, and PAGE-SPECS' "Lecture
   Mode, student view"). What it owes, decided or open:
   - read the open session through **the one student serializer**
     (`services/api/src/serialize/student.ts`), never a new strip-the-key path;
     scoped by `section_id` (null: everyone)
   - **one variant for the room, or one per student?** Options are shuffled
     per student today, so a shared discussion ("who chose B?") needs a
     session seed; per-student variants keep copying hard. Instructor's call
   - answer through the grading service into `live_responses` (the trigger
     refuses an answer once the session has ended; first write wins, PK
     `(session_id, user_id)`); **never a grade**, `GAME-LAYER.md` Petal 6
   - the split shown to a student only **after** they answer, and only at
     five answers or more (the console already withholds below five)
   - a per-option distribution needs a canonical answer key per option, which
     the shuffle hides; the console shows correct / not correct until then
   - `AUDITS.md`'s "< 1.5 s fanout to 40 clients" is this half's target, and
     the reason Realtime may come back. The local stack has no Realtime, so
     polling is what can be tested here
   - the timer (deferred with this half, instructor 29 Sep 2026)
3. **The cadence test was never seen red on its COUNT.** Against the old page
   it failed at its `[data-ready]` wait, before counting. The loop itself was
   measured by a probe with the same counting method (2,467 reads of
   `/console/live` in 10 s). If `useLiveRoom` is ever touched, break it on
   purpose once (an effect depending on the snapshot) and watch
   `console-live.spec.ts` "one read, then one per five seconds" go red.
4. **A full-page Playwright shot at 380 can re-lay the page out mid-capture
   and cut the last line off.** `/live`'s first `current-380.png` ended at
   "…cannot" while the page itself measured whole (1847px, the line at 1831):
   during `fullPage` the page re-wrapped (the Windows scrollbar leaves) and the
   PNG kept the pre-capture height. Captured instead by sizing the viewport to
   `scrollHeight` until it stops changing, then a plain shot. `/feedback`'s
   380 shot was checked and is whole; the other routes' were not. A 380
   capture whose last line looks cut is this, until the page measures cut.
5. **`/audit`'s family filter gained "Lecture Mode".** `AuditFamily` in
   `packages/contracts` now has `live` (`live.start`, `live.end`, each worded
   by `audit/log.ts`). A finished route's options changed through data;
   `console-audit.spec.ts` stayed green (in the 716).
6. **A stage under five students still shows its COUNT** ("08 · 3 students ·
   fewer than 5, not sent"): the average is withheld, the presence is not. If
   the instructor wants the count withheld too, it is one line in
   `routes/live.ts` and one assertion in `live.spec.ts`.
7. **`live_sessions.section_id` references `sections`.** Any fixture that
   deletes sections, users or items must clear both live tables first, with
   their delete triggers suspended by name (`resetAll()` and
   `db/demo-seed.sql` do; §0k.2's rule).
8. **§0c.1 is intermittent.** This session's first `db:reset` killed the dev
   API ("Failed to fetch" on a probe); two later resets did not, and `tsx`
   reloaded new code into the survivor, so a second `pnpm dev:api` hit
   EADDRINUSE. Prove the API with a staff GET after every reset, and check
   which process owns 8090 before starting another.
9. **Root `CLAUDE.md` still says 16 console routes** (a dated measurement of
   25 Sep). `docs/IMPLEMENTED.md` now says 17, with `/live/present`.

**Available to every route from now on:** `<AppShell bare />` (the staff
guard with no frame, for any full-screen console view); `lib/useLiveRoom.ts`'s
rule for any poll, **schedule the next read only after the last one settles**;
and `_live-fixture.ts`' way of standing in for data the seed cannot hold
honestly: real review items from `GET /console/items` offered as live ones,
real stage titles, nothing invented.

---

## 0o. Parked by the `/attempts/:attemptId` revamp — 29 Sep 2026

Found while rebuilding the last console route and deliberately **not** fixed
there. §0a to §0n still stand; §0e.1, §0f.1, §0g.1, §0h.2, §0j.3-7, §0k.3-4,
§0l.1-4, §0m.2-8 and §0n.2-9 are untouched. **§0e.3 is resolved**: every doc
that called `/attempts` "the only place a key is shown" now says otherwise, and
both pages withhold the key the same way, through one `showsKey()`.

1. **A real paper has never been seen on this page.** No paper can be filled
   locally (0 live items, §0e.1), so every capture and every assertion is the
   record's fixture: real bank items resolved by the real engine, the real
   seeded student, an invented attempt around them. The API half IS real
   (`console.spec.ts` starts a real attempt and reads it back, header fields
   included). Once items go live, open one real submitted paper and one in
   progress, at 1440 and 380, and look.
2. **The fixture's attempt list and its papers disagree on the score.**
   `_student-detail-fixture.ts`' `ATTEMPTS` says the submitted attempt scored
   5/8 (and `console-student-detail.spec.ts` asserts that "5/8"), while the
   paper it builds has 4 correct. This session made the PAPER's header score
   recomputed from its questions (§0h's rule), so `/attempts`' captures agree
   with themselves; the record's list still shows 5/8 over a paper with 4.
   Fixture-only, the record's spec: make `ATTEMPTS` derive from `papersFrom`,
   and change that one assertion.
3. **The console's main chunk: 711.11 KB** after this session (built 29 Sep),
   **705.23 KB (203.13 KB gz)** at the start of it, against §0i.3's 566.38 KB
   on 28 Sep. `/attempts` costs about 6 KB (it was in the main chunk before
   and still is). What added ~139 KB between the shell session and this one
   was not measured; `/content`, `/audit`, `/system`, `/feedback` and `/live`
   all landed in between. §0h.7 stands, and is now worth a session.
4. **No nav item is current on `/attempts/:id`**, and the 380 top bar reads
   "Attempt" (`AppShell.tsx` `pageName()` names it on purpose). A paper
   belongs to Students: `/students/:userId` marks Students current, because
   `NavLink` matches by prefix, and `/attempts/` does not start with
   `/students`. Marking it current here is a shell change.
5. **No Zod contract for `GET /console/attempts/:id`.** The shape is still a
   TypeScript interface in `apps/console/src/lib/api.ts`, with the new header
   fields. Root `CLAUDE.md` wants Zod at every API boundary; the console's
   older reads were moved to `packages/contracts` one route at a time.
6. **The deployed page will work without the schema push**, unlike `/content`,
   `/audit` and `/live` (§0j.1, §0k.1, §0n.1): the GET now joins `attempts`,
   `assessments` and `profiles`, all in the old schema. Not verified there,
   and the deployment has no attempts to open anyway (§0h.1).
7. **MoodleDocs could not be captured.** Both `docs.moodle.org` pages timed
   out at `networkidle`, twice (a bot challenge, by the look of it). Moodle's
   staff-side *Review attempt* page is the closest analogue there is; if a
   capture of it is ever wanted, a Moodle sandbox with its published demo
   login is the route, not the docs.

**Available to every route from now on:** `realStudent()` and the widened
`Paper` in `_student-detail-fixture.ts` (a paper's header, recomputed from its
own questions), and `lib/paper-view.ts` (`dayTime`, `paramsLine`,
`statusNote`, the index's marks), tested in `apps/console/test/paper-view.spec.ts`.

---

## 0p. Parked by the `/app/stage/:id/check` revamp — 29 Sep 2026

The first student route (`design/templates/web/stage-check/SPEC.md`). Found
while rebuilding the runner and deliberately **not** fixed there. §0a to §0o
still stand; §0e.1 (the 500 on an unfillable Start) is untouched: the runner now
shows the API's sentence under "Your paper did not open" with Try again, which
cannot help while the bank cannot fill. Items 1-5 are **shell** (`App.tsx`,
`styles.css`), one session, every route.

1. **`--bg` is defined nowhere.** `styles.css` sets `html, body { background:
   var(--bg) }` and no file declares `--bg`, so every apps/web page stands on
   the browser's own canvas, not a token. The gate's contrast check measured
   the old runner at **1.28:1** on blueprint because of it. The runner now
   paints its own `--surface-0` ground; every other route still does not.
   Declare it (probably `var(--surface-0)`) in a shell session and re-run
   every web spec.
2. **The shell's nav is INSIDE `<main>`** (`App.tsx`), and on `/app/stage/*`
   its background is a translucent `color-mix` the token gate rejects. The
   console's gate scopes to `main` because its shell sits outside; this route's
   spec scopes its surface checks to `[data-runner]` for that reason
   (`web-stage-check.spec.ts`, `ROUTE`). Keyboard reachability still walks all
   of `main`. Moving the nav out of `<main>` is a landmark fix as well.
3. **The Register Bar at 380:** each idle `----` wraps one dash per line (IR,
   MAR, MBR, ACC; see any `current*-380.png` here). `nowrap` alone would push
   the bar past 380 into a sideways scroll, so it needs a decision: fewer
   registers at 380, or a second row. PC, when live, fits.
4. **An empty ~45px band above the Register Bar** at every width, on every
   route (visible in every capture here). Source not traced.
5. **The Register Bar and "Report a problem" stay above a modal's scrim**: the
   runner's Submit confirmation dims the page but not those two, and the
   feedback button stays clickable behind a modal. z-index in the shell.
6. **The offline banner promises a queue** ("saved locally and will send when
   you reconnect"). Only the runner keeps it now (a failed Record retries once
   on `online`); nothing else queues.
7. **`console-audit.spec.ts` "export … and a toast" failed once at 380** in the
   full console run after this session (755 passed, 58 skipped, 1 failed): the
   CSV arrived, the 4s success toast had already left. 48 of 48 alone, three
   times. A load race, like §0i.9; a red that returns is real.
8. **The local live slice, for the next session that needs a real paper.**
   Stage 07, not act 1: stage 01 is closed for every demo student (§0c.3) and
   `232129004` is the one student with a check they can open. As the demo
   teacher, `PATCH /api/v1/console/items/:id/status` `{"status":"live","reason":"LOCAL ONLY …"}`
   for each of stage 07's 20 items (the author may not review their own; the
   demo teacher is not the author), then `pnpm db:reset && node scripts/db-demo.mjs`
   after. A Stage 07 check fills (8 items) and `attempt-runner.spec.ts` stops
   skipping. **Never against the deployment.**
9. **Run the real-API specs against a BUILD.** The dev server's React
   StrictMode starts every paper twice, and `POST /attempts` allows 10 a
   minute: five entries in `attempt-runner.spec.ts` tripped it on the dev
   server ("Too many attempts"). The file now enters four times.
10. **`_gate.ts` now counts a native radio group as one Tab stop** (arrow keys
    move within it). §0c.5's advice stands for two- or three-way toggles; a
    question's options are a radio group by meaning.
11. **No Zod contract for the attempt routes.** `apps/web/src/lib/api.ts`
    mirrors `serialize/student.ts` by hand (`PaperItem`, `Verdict`,
    `RecordedAnswer`, `AnswerOutcome`); `answered` and `answer` are new. Same
    shape of debt as §0o.5.
12. **Two documents disagree on a correct answer's flash.** `.claude/rules/design.md`
    says "a 120ms accent flash"; `apps/web/CLAUDE.md` says accent may never
    mark correct/incorrect. The runner follows the second (words only;
    `motion.md`). Reconcile the rule text; the instructor's call if it matters.
13. **A selected, not yet recorded, option wears the student's accent**, and a
    seeded hue can be red: `232129006`'s is a pink-red, so a plain selection
    reads warm. Allowed (the accent may mark the student's own place); once
    recorded the choice goes neutral, which the spec asserts. If the
    instructor wants selection neutral too, it is one CSS rule.
14. **Not built, by deferral:** hint tokens and the "try a similar one" re-roll
    (practice; they belong to a moon's journey, `WEB-REVAMP.md` §3.2); the
    two-tone sounds (P9); `/app/stage/:id/results/:attemptId` (the result shows
    in place and has no address); matching and diagram-label items (the
    engine has S, P and G only).
15. **A real paper was seen through the rebuilt runner only locally, on the
    stage 07 slice.** On the deployment there are no items at all (§0h.1).
16. **`pnpm scan:bundle` FAILS, on the CONSOLE bundle, and not from this
    session.** Two findings in `apps/console/dist/assets/index-*.js`:
    `SERVICE_ROLE` and `EXAM_SALT_SECRET`. They are **names, not values**: the
    API's environment schema (`EXAM_SALT_SECRET: z.string().min(32, …)`,
    `SUPABASE_SERVICE_ROLE_KEY: …optional()`) from `packages/contracts/src/index.ts`,
    where it has lived since P0 (`bbc78d7`), compiled into the console because
    the console imports that package and the schema is not tree-shaken. The
    console build of this morning (unchanged since `d80f3cf`) has the same
    hash and the same findings. **The student bundle scans clean** against
    141 answer values. No secret ships, but the scan is a gate and it is red:
    move the env schema out of the shared entry (an `@octa/contracts/env`
    subpath the API alone imports), rebuild, re-scan. Its own session.

**Available to every route from now on (apps/web):** `lib/toast.ts` +
`components/Toaster.tsx` (mounted once in `App.tsx`; `toast.success` leaves
after 4s, `toast.error` stays), `lib/useDelayed.ts` (the 400ms / 3s rule),
`lib/registers.ts` (`useRegister("PC", …)` for anything the Register Bar
should show), and `_stage-check-fixture.ts`' rule: **build the fixture from
the API's own functions** (`gradeResponse`, `toStudentPaper`,
`toStudentVerdict`), imported with their `.ts` extension, so a fixture cannot
send a shape the API never would.

---

## 0q. Parked by the `/app/stage/:id` revamp — 29 Sep 2026

The second student route (`design/templates/web/stage/SPEC.md`). Found while
rebuilding the reader and deliberately **not** fixed there. §0a to §0p still
stand; §0p.1-5 (the shell) are untouched, and item 1 here is one more of them.

1. **"Report a problem" is not a floating pill; it is a full-width bar in the
   page flow at the very end** (every capture here, 1440 and 380). `.fb-tab`
   says `position: fixed; right; bottom`, and `.app-has-backdrop > *`
   (`position: relative; z-index: 1`, same specificity, later in `styles.css`)
   overrides it. Measured on the build: computed `position: relative`,
   `z-index: 1`, spanning x −16..1424 at 1440 (its `right`/`bottom` offsets now
   shift it instead of pinning it). `WEB-REVAMP.md` §9 already named the bar;
   this is its cause.
   Shell. The reader's 380 Contents pill is **sticky** rather than fixed
   because of it (a fixed pill sat under the bar at the page's end); if the
   shell fixes the tab back to a bottom-right pill, check the reader's pill
   still clears it (`web-stage.spec.ts` "Contents pill" measures the overlap)
2. **The "clipped strip on the right edge" (`WEB-REVAMP.md` §1) is a tile seam
   in the biome art, not clipping.** Measured: every `.biome-layer` spans past
   the right edge (`[-30..1468]` and wider at 1440), so nothing is uncovered;
   the strip at x≈1410-1422 is where the desert pack's tile repeats.
   `BIOME-AND-LOADING-SPEC.md` §2b already records the tiling problem. Biome
   work, not a reader defect; a `right: -4%` on the layers was tried, changed
   nothing, and was reverted
3. **A renamed control turned the runner's real-API tests into SKIPS, with a
   false reason.** `attempt-runner.spec.ts` found Start by `/^(start|…)/`; the
   reader's control became "Go to Stage 07 Check", so every test there skipped
   as "no assessment in the fixture (F-41)". Found by reading the skip
   reasons, fixed here, and the file now also skips LOUDLY (not red) on §0e.1's
   500 without the live slice (the 29 Sep handoff said it skipped; measured,
   two went red). **Read skip REASONS after every rebuild, not only the count**
4. **`elementFromPoint` skips `pointer-events: none`.** The biome is exactly
   that, so a naive "is it on top?" probe reported the old reader's back link
   and lock card on top while both were painted under the scene. The spec's
   `onTop()` lifts the biome's pointer-events for the question. Any other
   route proving "nothing covers this" over a biome or backdrop needs the same
5. **Figures at 380 shrink to their own longest line.** The 73-column figure
   in stage 07 renders near 7px mono at 380; 55-column ones near 9-10px. That
   is the honest cost of "verbatim, never sideways" (`SPEC.md`), and pinch zoom
   works. If it is too small, the fix is authoring (figures of 50 columns or
   fewer, `content/stages/*.md`) or a "full width" view of one figure: the
   instructor's call, not a CSS tweak
6. **The console's `/content` preview still renders the OLD way** (§0j.3):
   `apps/console/src/lib/content-view.ts` mirrors the old reader, so its
   preview still shows `## ` and broken lists. `apps/web/src/lib/markdown.ts`
   is the parser the reader now uses (12 tests); the console could import the
   same one (a shared package, or a copy with the same tests). Console work
7. **`GET /api/v1/stages/:id` gained `state`, `gradeable`, `masteryThreshold`
   and `lockReason`**, the last from the SAME function as the map
   (`lockReasonFor()` in `routes/stages.ts`). No schema change. A teacher's
   private override reason is never sent (asserted). Old web builds ignore the
   new fields, so deploy skew is harmless
8. **Staff reading a locked stage** get the content with a state line *Closed
   to students; open to you as staff*. Never seen: apps/web has no staff
   session locally
9. **Glossary and add-to-notebook are deferred by ruling** (29 Sep): no
   glossary data exists anywhere, and hard rule 5 forbids writing one in a
   page session; no notebook table or `/app/notebook`. PAGE-SPECS still lists
   both in the rail. When either gets data, the rail has room for it
10. **The Bring-Up is deferred by ruling**: completion is a grading event (the
    runner's result, or the map), not something the reader can see happen.
    `LESSON-PLAN-AND-LEVELS.md`'s BRING-UP and LOG beats have no home yet
11. **Beats the archetypes declare and the data lacks** (PROBE, SORT, DRILL,
    TRACE, REMIX, LAB, BUILD, BREAK) are not shown: no block carries them
    (INV-27 warns on 9 stages). The rail shows Brief, the `##` sections and
    Check, which every archetype declares and the data holds
12. **The rail at 1440 scrolls inside itself** when a stage has many
    objectives (stage 06 has 11): it is sticky with a viewport-high cap.
    Vertical scroll, allowed by the gate; noted so it is not "found" later

**Available to every route from now on (apps/web):** `lib/markdown.ts`
(`parseBlocks`, `parseInline`, `numberBlocks`, `sectionsOf`, `sourceLabel`,
`longestLine`; numbers in running text come back as their own token, for
mono) and `components/ReaderBlocks.tsx`; `_stage-fixture.ts`' `openStage()`
(real API, two seeded students, patches only for failed, slow or empty reads);
and the spec's timing pattern for loading: **record when each state first
appears with a MutationObserver installed before load, then assert the gaps**.
A retrying `toHaveCount(0)` waited out a whole 5s load on the first draft.

---

## 0r. Parked by the `/app/map` revamp — 29-30 Sep 2026

The third student route (`design/templates/web/map/SPEC.md`). Found while
rebuilding the flat map and deliberately **not** fixed there. §0a to §0q still
stand; §0p.1-5 and §0q.1 (the shell) are untouched, and item 2 here is one more.

1. **The API sends objectives in string order: 06.1, 06.10, 06.2 ….**
   `routes/stages.ts` orders them `order by id` (line ~119, the map's list,
   and ~216, `GET /stages/:id`), so every objective list with ten or more
   reads `.10` second. **The reader shows it this way today** (its rail and
   its lock preview; stages 03, 06 and others with 10+ objectives). The map
   sorts on the page (`byObjectiveId` in `FlatMap.tsx`, asserted in
   `web-map.spec.ts`). The fix is a natural order in the SQL (the two numeric
   parts of the id) and an API test; then the map's sort is harmless and the
   reader is right. API work, one session
2. **On `/app/map` the shell's nav marks no item current.** Its Map link is
   `NavLink to="/app" end`, which `/app/map` does not match. PAGE-SPECS wants
   the flat map "always in the header". Shell: either Map is current on both,
   or the nav names the flat map. `current*.png` here show it
3. **`/app`'s own chrome around the shared map is `/app`'s work (next session).**
   Under reduced motion, a small screen or no WebGL, `/app` now mounts
   `FlatMap` (panel and all, `current-app-fallback*.png`) inside `StageMap`'s
   OLD header, with its `?` first-run replay, the rotate prompt, and its two
   links still browser-default purple ("All 19 stages, with progress and lock
   reasons", "Show the flat map"). The 3D path still opens `PlanetHud`, a
   second panel: the next session should make the 3D selection open
   `FlatMap`'s panel (one sidebar, §3.1), read `?stage=NN` the way `FlatMap`
   does (`useMapSelection`), so Back and a bookmark work on `/app` too (§3.3)
4. **The accent painted STATES on the old flat map** (available, in-progress
   and mastered planets, and the sun) against `apps/web/CLAUDE.md`. Fixed on
   the flat map; `PlanetHud.tsx` (`.hud-glyph` uses `--enc-accent`/`--accent`)
   and the 3D scene were not checked. `/app` session: measure them the way
   `web-map.spec.ts` "the accent is on the next stage's ring and nowhere else"
   does
5. **The reader's "Back to the map" goes to `/app`**, so a student who
   entered from the flat map is returned to the 3D map (browser Back returns
   to `/app/map?stage=NN` with the panel open, as §3.3 asks). Reader's route;
   if it should return to where the student came from, it needs the referrer
   (history state), not a guess
6. **No biome on the panel and no moon mastery** (instructor ruling, 29 Sep):
   §3.5 needs a biome per planet (seeded from student and stage; today one per
   student) and §3.7 a mastery table. Both absent, nothing standing in. The
   R3 box "Map sidebar and ENTER JOURNEY" stays open for them and for moons
7. **The star field's dark rectangles were opacity, not art.** An `opacity`
   on a `::after` carrying a long box-shadow list rasterised in 256px tiles
   that disagreed, drawing dark bands across the picture. Dimming the stars
   with quiet tokens (`--line-strong`, `--line`) and no opacity removed them.
   Anything else drawing many box-shadows under an opacity layer will band
   the same way
8. **`pnpm db:reset` killed the dev API once more** (§0c.1), before the
   console run. Proven with a real GET (000), restarted, proven again (200)
9. **A test that measures a clipped box must measure the box that clips.**
   The first draft read the title inside the 1px sr-only span (119px, its own
   words) and went red on a correct page; and "the map did not move" compared
   viewport boxes across a click that scrolled the page. Both corrected to
   what they claim (the clipping box; document coordinates) before green

**Available to every route from now on (apps/web):** `components/FlatMap.tsx`
(the flat presentation, and `useMapSelection()`: a selection in `?stage=NN`,
push to open, replace to switch, Back closes, focus to the heading and back),
`lib/next-stage.ts` (`nextStage()`, 5 unit tests), `readPosition()` exported
from `StageReader.tsx` (the reader's per-device spot, the one key), and
`design/specs/_map-fixture.ts` (`openMap()`, `realMap()`: the real API as
`232129006`, patches only for failed, slow or approved-summary reads).

---

## 0s. The direction changed — 30 Sep 2026: the student app is REMADE

**Instructor ruling:** the student app looks too bland. It is remade as a game,
not improved: `docs/redesign/WEB-REMAKE.md` owns it, with the references in
`design/templates/web/_direction/` (Starfield and No Man's Sky for a sci-fi
HUD in the star system; Stardew Valley and Kenney's CC0 pixel packs for the
biome inside a planet). Every `apps/web` route is rebuilt, the three finished
on 29-30 Sep included; a new nav; **opening a planet or moon changes the theme,
nav and all, to that planet's biome, and leaving returns to the HUD, always
through a transition** (a cut under reduced motion). Four rulings the same day:
a check's chrome wears the biome and its paper stays neutral; the default is
one HUD with the three existing variants; sci-fi HUD outside, pixel frames
inside; one new HUD label face.

What this changes in the sections above:

1. **§0p, §0q and §0r still stand as facts** about the code as it is. The shell
   defects (§0p.1-5, §0q.1, §0r.2) are now the remake's shell session's work
   (`WEB-REMAKE.md` §8 #2), not a separate shell pass
2. **The behaviour built on 29-30 Sep carries over** into each remake: the
   runner's Record, resume, flag and confirm; the reader's parser, resume and
   lock card; the flat map's buttons, panel, card and `?stage=NN`. So do their
   specs: extend them, keep every assertion, move selectors to new hooks
3. **R3 was recounted:** 61 / 80 became 58 / 84. The three finished routes
   became history lines; eleven remake boxes were added
4. **Two rules were amended in writing:** `DESIGN-MANDATE.md` §1B rule 1 and
   `BIOME-AND-LOADING-SPEC.md` §1b (the chrome may wear the biome, the paper
   never). Root `CLAUDE.md`, `apps/web/CLAUDE.md`, `.claude/rules/design.md`,
   `WEB-REVAMP.md` and `TEMPLATE-LINKS.md` now point at `WEB-REMAKE.md`
5. **Not yet decided; each session asks when it reaches it:** the in-planet
   nav's items (proposed in `WEB-REMAKE.md` §3: the planet's own tabs plus
   Leave planet); whether moons land with `/app` or after it; the HUD face
   (three candidates); whether the pixel frames are vendored art or CSS drawn
   from the biome's tokens

---

## 0t. Parked by the look-system session — 30 Sep 2026

`WEB-REMAKE.md` §8 #1, the first remake session (no route rebuilt).
`design/templates/web/_direction/LOOK.md` is what it built; this is what it
found and left. §0a to §0s still stand; §0p.1-5, §0q.1 and §0r.2 are the
shell's, untouched.

1. **`looks.css` is built and NOT imported by apps/web.** Importing it recolours
   every page at once, and the current runner's question card would take the
   biome's parchment, against the neutral-paper ruling (`WEB-REMAKE.md` §4). The
   shell imports it, after `tokens.css`, in the session that builds the frames.
   The paper then follows the student's variant (instructor, 30 Sep): put
   `data-theme="<variant>"` on the paper's root and tokens.css re-declares the
   base theme there, over the biome (`LOOK.md` §6)
2. **What DID change for a student today:** the reader's scene is now the
   PLANET's biome, not the student's one biome (232129006: 00 city, 01 cave,
   02 jungle, 03 desert, 04 ocean; seen in `design/look/captures/reader-*.png`),
   and apps/web now loads its faces (Inter, JetBrains Mono, Oxanium) instead of
   borrowing the machine's. `<html>` carries `data-realm` on every route and
   `data-biome` only inside a planet
3. **The first-ever deep link paints `neutral`** until the cosmetics response
   lands, because nothing is cached yet. Every later deep link and reload is
   right on the first frame (the cache `octa:planet-biomes`, cleared on
   sign-out; asserted in `cosmetics.spec.ts`). If the instructor minds the one
   swap, the fix is a held first paint on planet routes, the shell's call
4. **The 3D map still tints every planet from the student's ONE biome**
   (`biomeIndex`, now read from `--biome-planet-<name>` on `:root`, since a star
   route has no `data-biome`). Per planet, the tint should be each planet's own
   biome: `/app`'s session, one line in `SolarSystemCanvas`
5. **At 380 the nav wraps.** The look sheet's HUD tab strip wraps "YOUR WORK" to
   two lines, and the biome tabs push "Leave planet" to a second row
   (`captures/*-380.png`). `WEB-REMAKE.md` §2 already gives the shell the choice
   of a bottom bar at 380: take it, or shorten the labels
6. **Kenney's frames are paint, not tokens.** Jungle's lime band against its own
   paper is about 1.6:1; the `--frame-inner` token ring is what carries the edge,
   so a frame without `.frame-pixel` (a hand-rolled `border-image`) loses it.
   Use the classes. Arctic uses `Outline/blue`, not `space`, because `space` has
   no pressed sprite (its `space_inlay` is 44 by 44)
7. **`check-contrast.mjs` skipped aliased tokens silently.** Making
   `--biome-planet` an alias of `--biome-planet-<name>` dropped seven checks and
   it still printed "Clean"; it now resolves `var()` against `:root` and throws on
   an alias it cannot resolve (1181 checks, the same as before the alias). Any
   token turned into an alias elsewhere needs the same look
8. **`planetBiomes` arrives with keys 10-18 before 00-09** (JavaScript orders
   integer-like keys first, and "00" is not one). Harmless; do not iterate it
   for display order, read `stages` for that
9. **The Bash tool's heredocs strip backslashes** (`\\d` arrived as `\d`, `\/`
   as `/`), and a double-quoted `node -e` expands backticks as commands (it ate
   two words of a comment here). Write scripts with the Write tool and run them
10. **§0p.16 is FIXED, because this session made it worse first.** apps/web had
    only ever imported erased types from `@octa/contracts`; `realm.ts` imports
    `Biome` and `planetOf` at runtime, which compiled the whole entry, env
    schema included, and put `SERVICE_ROLE` and `EXAM_SALT_SECRET` (names) into
    the STUDENT bundle too. The env schemas moved to `@octa/contracts/env`
    (`packages/contracts/src/env.ts`), which only `services/api/src/env.ts`
    imports; `pnpm scan:bundle` is clean on both bundles again. An app must
    never import `@octa/contracts/env`. `services/api/vitest.config.ts` aliased
    the bare name as a PREFIX, which turned the subpath into `index.ts/env` and
    failed 13 API suites until the aliases became exact matches (the apps keep
    their bare alias on purpose: an app importing `/env` should fail to build)
11. **`pnpm db:reset` killed the dev API FOUR times this session (§0c.1).** A
    burst of 152 console failures (ECONNREFUSED 8090, 03:12-03:14) was a reset
    in the middle of a chained run, and it ended only because an edit under
    `services/api/src` made `tsx watch` restart the dead process. Editing there
    during a run restarts it too. The only safe pattern: a real GET after every
    reset, restart on 000, then run (`final-chain.sh` in this session did, and
    caught two more)
12. **The final web run was 337 passed, 103 skipped** (338 / 102 the run
    before): the extra skip is `solar-system.spec.ts`'s own frame-rate guard,
    "this run only sustained 29.4fps — the guard is right to fire", on a machine
    under load. Not a regression; a quiet machine runs it

**Available to every route from now on (apps/web):** `lib/realm.ts`
(`realmFor`, `applyRealm`, `useRealm`, the planet-biome cache),
`design/specs/_realm-fixture.ts` (`forcePlanetBiome(page, stage, biome)`: put a
planet in a biome through the realm's own input; writing `data-biome` by hand
now races the realm), and in `packages/tokens`: `looks.css`, `fonts.css`,
`pixel/`, `contrast.ts`, and `pnpm --filter @octa/tokens test`.

---

## 0u. Parked by the remake (ruling 2) and ruling 3 — 30 Sep 2026

The whole of `WEB-REMAKE.md` §8 landed in one session (the instructor amended
one-route-per-session for this rework): shell `862a60e`, map `0d6828a`, reader
`c50376e`, runner `886007a`, stages `2fd1157`, progress `545f2a1`, work
`943c615`, settings `061464c`, title screen `04f8ffe`, cleanup `264bc91`, then
**ruling 3** (sitting a paper, root hard rule 9). Each piece's `SPEC.md` is in
`design/templates/web/<piece>/`. Found and left, or needing a decision:

1. **`/app/progress` is missing three planned things, recorded as deferred:**
   per-objective mastery, attempt history as a growth curve, competency-named
   badges (`PAGE-SPECS.md` §/app/progress). `GET /api/v1/progress` serves the
   21 cells and depth only; no endpoint returns a student's attempt history.
   Plan it as an API first, then ask.
2. **`PAGE-SPECS.md` §/app/settings is superseded** (theme picker, audio
   sliders, profile, larger text): ruling 2 removed the variants, there is no
   audio, and `design/templates/web/settings/SPEC.md` says what exists. Rewrite
   the row; ask before building profile or text size.
3. **`attempt_events` must reach the deployment.** It is appended to
   `addendum-audit.sql` idempotently (`create table if not exists`, `drop
   policy/trigger if exists`); `pnpm db:push` has not been run. Until it is, a
   deployed runner's event POSTs answer 500 (best effort: the cover still
   works, nothing is recorded).
4. **`scripts/backup.mjs` checks only `responses`' append-only triggers** on
   restore. `audit_log`, `live_*`, `content_block_versions` and now
   `attempt_events` are append-only too and unchecked.
5. **`apps/web` has no `lint` script**: `pnpm lint` covers the console's
   palette scan only. The web app's guard is the hex hook and the gate specs.
6. **Local ports:** the console build is previewed on **5186** beside the web
   one on 5185; `scripts/dev-api.mjs` now allows 5186 (before this, every
   console spec against a 5186 preview failed on CORS as "Failed to fetch").
   Start it with `npx vite preview --port 5186 --strictPort` in apps/console;
   a PowerShell `Start-Process` starter for it hung.
7. **The local stack's two traps, again:** `pnpm db:reset` kills the dev API
   (restart `pnpm dev:api` and prove it with a real GET), and the API test
   suite truncates the demo fixtures (`design/global-setup.ts` refuses to run
   and says so). **After the API suite, `db-demo` alone is NOT enough**
   (found 30 Sep 2026): the suite also truncates `blueprints`, which only
   `schema.sql` seeds, so `sync-assessments` makes no assessments and
   `demo-audit` fails. Run `pnpm db:reset` **then** `node scripts/db-demo.mjs`,
   and read its whole output, not its last line. Never reset while a
   Playwright suite is running.
8. **Hard rule 9 binds Lecture Mode:** `/app/live` (not built) must sit behind
   the same start prompt and full screen, and record leaves the same way. The
   route and table are per attempt; a live session will need its own key.
9. **A reload mid-paper now asks first** (`beforeunload`) and lands on the
   prompt again: full screen needs a click. The resume is the same attempt
   (`attempt-runner.spec.ts` asserts one attempt id across the reload).

---

## 0v. Moons open planets, step 1 and the design — 30 Sep 2026 (night)

1. **Built: a non-gradeable prerequisite never blocks** (WEB-REVAMP §3.7, R4.6).
   `is_stage_unlocked()` step 4 counts only gradeable prerequisites; a prereq
   id with no `stages` row still blocks. The API's `lockReasonFor()` is given
   only gradeable prerequisites, on the map and the reader, so an override on
   stage 01 reads as the instructor's and never as "reach 70% of Orientation".
   Tests: `rls.spec.ts` §3.7 (nine: open 01; 02 still shut; a non-gradeable
   prereq beside a gradeable one excuses nothing; a global override still
   closes 01; a student cannot mark 01 non-gradeable, clear 02's prereqs, write
   `stage_progress` or write an unlock), `stages.spec.ts` (01 open for a fresh
   student and no reason names 00; the override reason). Three watched failing
   against the old function, the fourth against the old route.
2. **Two specs moved with it:** `web-stage.spec.ts`' locked example is now
   stage 02 (the seeded student's 01 is open), and `web-stages.spec.ts`' "next
   stage" is 01, not 06: 01 at 65% is open and unfinished and comes first.
3. **Not pushed to the deployment.** `schema.sql` changed; the deployment
   needs the same `db:push` (with §3b's `--reset` question) as `attempt_events`.
4. **Piece 2 is a PROPOSAL awaiting the instructor:** `WEB-REVAMP.md` §3.7a
   (`objective_progress`, keyed to `responses`, append-only, grading-service
   written, no staff write; a moon mastered at 2 distinct correct questions;
   fail-closed for an unauthored moon). Three decisions are asked there.
   **Do not migrate before they are answered.**
5. **Ordering hazard for piece 3:** the moment `is_stage_unlocked()` reads
   moons, stage 02 is shut for every student until a moon journey exists that
   can write `objective_progress` and act 1's items are `live`. Build the
   journey before, or in the same commit as, the unlock change.
6. **`/locks` still writes only per-student locks** (`LocksPage.tsx` sets
   `scope: "user"`), so an instructor cannot open a stage for everyone from the
   console. That matters more once fail-closed moons can hold a planet shut.

---

## 0w. Moons open planets, built — 30 Sep 2026 (late night)

The instructor answered §3.7a's three questions (journeys AND checks count, a
final never; a journey is practice; fail-closed). All four pieces landed, each
pushed: `981e1c4` decisions, `5cbd823` `objective_progress`, `5259c50` journey
API, `dc523f6` journey page, `16512f0` per-moon mastery, `e521fdc` moons on the
map, `403ec5b` the flip. Found and left, or needing a decision:

1. **The instructor's student record now lists graded work only.** Journeys
   are practice and a demo student has ~40 of them, so `GET
   /console/students/:id` leaves scope `objective` out. **Asked 30 Sep 2026:
   YES, built the same session** (a moons section on `/students/:userId`,
   through the page gate); see 0x.
2. **A stage check on a locked stage is now refused at Start** (`startAttempt`,
   403 "This stage is locked."), a journey too. It was open through the API
   before; with checks counting toward moons it would have been a way round
   the prerequisite. Fixtures that sat checks on 07 now open it per student.
3. **INV-12 binds papers only** (`addendum-audit.sql`): a journey's length
   follows its moon's live bank by design.
4. **`db-demo` now refuses over ANY recorded response**, the demo cohort's own
   included: `db/demo-moons.sql` earns 702 moons through real journeys and
   correct answers (0 of 399 student-stage lock states moved, measured). The
   documented order is unchanged: `pnpm db:reset` THEN `node scripts/db-demo.mjs`.
5. **Orphaned API processes.** 23 `dev-api.mjs` / `tsx watch` trees from
   earlier sessions were holding 8090 and fighting over it (a 1.3 MB log of
   EADDRINUSE; six web tests failed as "could not reach the server"). Before
   `pnpm dev:api`, kill every `node scripts/dev-api.mjs` tree (PowerShell:
   `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine
   -match 'scripts/dev-api\.mjs'`, then `taskkill /T /F` each) and confirm
   nothing listens on 8090. A `db:reset` killed the API twice more tonight.
6. **The deployment needs all of this pushed**, and `schema.sql` changed
   (`blueprints.objective_id`, `is_stage_unlocked()`), so it is §3b's
   `--reset` question again, with `attempt_events` from 0u.3. Until then the
   deployment runs the 70% rule and has no journeys.
7. **A lock reason can be long.** Locally no question is live, so stage 04's
   reason lists five moons still to master and the same five as having no
   questions yet. True, and it will shorten once items are approved; if the
   instructor finds it heavy, say only the count of unwritten moons.
8. **R4's open boxes that need a person, not a build:** R4.4's screen-reader
   pass (moon data is in the DOM: the panel's moon buttons and states, and
   `/app/stages`' rows); R4.3's "focus-trap" check is moot (the panel is a
   labelled region, not a modal, §3.9) but Escape and reduced motion are
   asserted; "zero new client-side gating" should be reviewed: the moon panel
   disables Enter from the server's facts (planet locked, no live question),
   and the server refuses both anyway. R4.6's last box (biome as the sidebar's
   background) predates ruling 2's one star HUD and needs the instructor to
   say it is superseded.
9. **`scripts/backup.mjs`** should also check `objective_progress`'s
   append-only triggers on restore (extends 0u.4).
10. **Lecture Mode's "active" count** (`live.ts`, `ACTIVE_ATTEMPT`) counts any
    in-progress attempt, a journey included. Check what it is meant to mean
    before Lecture Mode ships.

---

## 0x. Three encounters, the record's moons, the deployment reset, a textured map — 1 Oct 2026

Instructor answers (30 Sep): all four 3.6 placements approved; The Descent is
the **Midterm**; moon mastery on the console record **built this session**; the
R4.6 biome-sidebar box is **superseded** by ruling 2; the schema was **not** to
be pushed, and then (1 Oct, after the deployment broke) **reset and reload**.
Pushed: `11dc66d` record moons, `513988d` Two Columns (01.2 Sort), `4410670`
Clock Bench (02.8 Drill), `f5b293d` Cache Tuner (04.5), `95c482f` textures,
`3ac7b78` star-map panel. Found and left, or needing a decision:

1. **The deployment was reset and reloaded, 1 Oct.** The live console's
   `/live`, `/content` and the map all said "Something went wrong on our
   side" (schema older than the pushed API). Backup first:
   `db/dumps/live-ddvx-2026-10-01-pre-reset.dump` (gitignored), restore
   rehearsed (it needs an `extensions` schema and pgcrypto, or
   `assessment_secrets` fails). Then the SQL files in order, content, items
   and assessments synced; the admin profile, the section, the roster row,
   the test student and a stage lock restored from the backup. API routes
   `/console/content*`, `/console/live*`, `/stages`, `/stages/01`,
   `/progress` all 200 against it; invariants 25 clean, 0 failures. **Act 1
   is 96 items at `review` there, 0 live.**
2. **The root `.env` points at the OLD Supabase project**
   (`lqvkqdaqtkhxmnvodmyr`, zero users). The live one is
   `ddvxkbcelpqydnjkffdr`, and its credentials are in
   `deploy/local-admin.env` (load with `set -a; . deploy/local-admin.env;
   set +a`). **That file holds the service-role key and says to delete it
   when the migration is done.** Decide, then delete it. Never echo its
   connection string: a listing did once, this session.
3. **The instructor asked to delete student `23212905` ("shemshem",
   BSCPE-2A, deactivated, 0 attempts) from the deployment, 1 Oct.** Not
   done: the session's permission mode refused a read of the production
   database. V-20 says a student is never deleted (the record is evidence;
   `responses` is append-only and blocks the cascade). With 0 attempts
   nothing is lost, but check attempts and responses first. Either the
   instructor grants the access for that one action (then: roster row,
   profile, auth user, and an `audit_log` row saying why), or deletes it in
   the Supabase dashboard (Authentication → Users; `student_directory`).
4. **Bus wiring, moon 03.9, is not built.** The only act-1 encounter left,
   and the only Phaser one: lazy, a keyboard path, a DOM fallback, and
   `dist/index.html` grepped for a preload.
5. **The Cache Tuner has no hit-rate meter.** The book gives no address trace
   to run one over; a meter on an invented trace would break hard rule 5.
   The address fields and sizes are the book's Example 4.2.
6. **The map wears real textures now** (Solar System Scope, CC BY 4.0,
   `public/CREDITS.md`; `solar-system/bodies.ts`, `bodies.spec.ts`). Cosmetic
   only; seeded by biome, student and stage. 1.5 MB in `public/textures/`,
   fetched only by the map's lazy chunk. The sun's first corona (two
   translucent spheres) read as a flat brown disk in a capture; it is now a
   radial sprite.
7. **The star map shows only while no planet is chosen** (instructor, 1 Oct),
   at every width, and the chosen body's name sits at the bottom. Left and
   Right step between planets while one is open (the row's arrow keys,
   carried over). `/app`'s SPEC and motion record it.
8. **Suites at this close:** web unit 165, console unit 217, API 718 (1
   skipped), `web-app.spec` 50 passed / 8 skipped; `db:reset` then
   `db-demo` after the API suite, API answering on 8090. **The full
   Playwright design suite was NOT run at the close** (the instructor stopped
   it twice this session). Run it first next session.
9. **`test-results/` and `.claude/worktrees/` are gitignored now**, after a
   Playwright artifact was committed by accident (`72497bf`).

---

## 0y. Bus Contention, R4's build boxes, a student deleted from production — 1 Oct 2026

Instructor answers (1 Oct): **0x.3 — grant database access for that one
action** (done, below); **0x.2 — keep `deploy/local-admin.env` until 0x.3 is
done, then delete it** (done). Pushed: `b041de8` Bus Contention (moon 03.9),
`be2052c` R4.3 / R4.4 / client-gating checks. Found and left, or needing a
decision:

1. **Student `23212905` is deleted from the deployment**, in one transaction:
   inspected first, read-only (0 attempts, so 0 responses; references were its
   auth identity, profile, roster claim and one per-student `stage_locks` row),
   then profile, roster row and auth user deleted (identity and the lock
   cascaded), with an `audit_log` row `student.delete` naming the instructor's
   request and V-20's waiver for this one account, and what was removed.
   Nothing references it now. The deployment has **0 students**.
2. **`deploy/local-admin.env` is deleted.** Production credentials are no
   longer on this machine in that file. **`deploy/render-api.env` still
   exists** (gitignored, not read this session); it very likely carries the
   same service-role key for Render. Instructor's call: keep or delete.
   **The root `.env` still points at the OLD project** (`lqvkq…`, 0x.2);
   unchanged, because repointing it needs the live credentials this session
   just deleted.
3. **Bus Contention is built on moon 03.9** (`design/templates/web/
   encounter-bus/`, `web-encounter-bus.spec.ts` 38/38 at 1440 and 380).
   Phaser 3.90 is in `bus-scene` only (341.8 KB gz), reached only through
   `BusContention`; `dist/index.html` names neither. **All four act-1
   encounters now exist.** The extract's §3.4 has no "Elements of Bus Design"
   table (it is the edition that defers it to Appendix C), so bus TIMING
   (synchronous/asynchronous) and arbitration METHODS are not taught by the
   bench; it says so on the page.
4. **Phaser's own pointer input kept a stale canvas position** once the page
   above settled after boot (clicks missed at 380). The scene now takes no
   Phaser input; a DOM listener measures at click time. Any future Phaser
   scene (the Descent, stages 12, 14, 18) will hit the same thing.
5. **A gate hole, closed for this spec only:** "nothing clipped" cannot see a
   child wider than its own panel while it stays on screen (the wiring table
   at 1440, found by opening the capture). `web-encounter-bus.spec.ts` has an
   `outOfPanel` check; `_gate.ts` does not. Worth moving there.
6. **The full design suite, 1 Oct, against builds:** 1297 passed, 171
   skipped, 2 failed: `web-stage.spec.ts` "tables, quotes and the brief" and
   "every figure", both at 380, both a 20 s timeout waiting for
   `[data-reader="reading"]` under full load; both pass alone in 5 s. Load,
   not a defect, but the reader's wait is the one that times out.
   `pnpm test`: API 718 passed (1 skipped), web unit 197, console 217,
   tokens 38.
7. **`/app/stages`, for the screen-reader pass:** each planet radio's label
   also appears in the accessibility tree as a separate text node, so a
   virtual cursor may read every planet twice. Not fixed (not this session's
   page).
8. **The entry chunk is 106.0 KB gz**, not GAME-DESIGN §10.2's 74.9 KB
   (re-baselined there; the growth is the remake, not a canvas library).
9. **R4 now owes only a person:** R4.4's screen-reader pass and the DoD's
   (moon data is asserted in the accessibility tree; someone must listen).
10. **Prelim, still NOT runnable:** act 1 is 96 items at `review`, 0 `live`,
   measured on the deployment today and locally. That is the instructor's
   approval on the console (`/content`), not a build.

---

## 0z. R3 closed against the code, the arrival screen, a realistic system — 2 Oct 2026

Instructor answers (1-2 Oct): delete `deploy/render-api.env` (done); leave the
root `.env` on the old project for now; act 1's 96 items will be reviewed on
`/content` by the instructor; the `QA_MODE` clause is superseded (reduced
motion is the one freeze). New requests, built: **R4.7, a realistic solar
system** (ellipses, a level as a band, the frost line, Hill/Roche, belts and
comets; the brief kept in `docs/source/solar-system-brief.md`), **a longer
warp**, and **an arrival screen after it** for every planet and moon (revised
the same day: the biome is the background, no globe, seamless). Pushed:
`466578c` R3 audit, `d4b9f32` warp and arrival, `f1c14ca` R4.7. Found and
left, or needing a decision:

1. **R3 at 87/88**: eleven boxes closed against code and specs (several were
   built and never ticked), R3.4's four, and PROGRESS's own. Open: only the
   planet summaries (0 of 19 approved, the instructor's, on `/content`).
2. **R4 at 34/36**: only the screen-reader pass is left (R4.4 and the DoD),
   a person's job. For it: `/app/stages` may read each planet twice (0y.7).
3. **R5.3 will likely fail its draw-call budget (≤50).** R4.7 added 19
   ellipses, 7 bands, the frost line, 4 point clouds, 7 centaurs, 3 comets
   (3 meshes each) and the wind. Measure it (`renderer.info.render.calls`)
   before believing it; merging the ellipses into one `LineSegments` and the
   centaurs into one `InstancedMesh` are the cheap fixes.
4. **The first frame of a deep link paints the FALLBACK biome** when the
   browser has no cached biome (a first visit), and the planet's own replaces
   it about half a second later, once `/cosmetics` answers. Seen only in
   R3.4's frames (`design/templates/web/loading/arrival-0100*.png` vs
   `-0700`). `lib/realm.ts` promises "one frame of the fallback"; locally it
   is ~500ms. Not fixed (not this session's page).
5. **The map is not to scale, on purpose**: moon systems are drawn 200x larger
   than their orbits allow, so the Hill/Roche rule holds in that frame
   (`satellites.ts`); real Hill spheres at this scale are ~0.06 units. Said in
   `design/templates/web/app/SPEC.md`. If the instructor wants it otherwise,
   the band widths or the moon systems must change.
6. **The arrival's facts are fixed per planet** (kind, frost line, moons,
   levels, grading period); the instructor asked for "unique fun facts".
   Every fact must come from the brief or the planet's data (hard rule 5);
   more would need more instructor text in the brief.
7. **Harness notices are not process state.** The dev API and both previews
   were reported "stopped after the background time limit" mid-suite and all
   kept serving; a relaunch made two APIs fight for 8090. Probe the ports.
   After a reboot, start Docker Desktop before `db:up`.
8. **The entry chunk is 109.6 KB gz** (+3.6 KB: the arrival and its facts ship
   with the biome shell); the map chunk 224.8 KB (+1.3). GAME-DESIGN §10.2.
9. **Suites at this close:** the full design suite on the final build, 2 Oct:
   **1375 passed, 179 skipped, 0 failed** (13.6 min). Web unit 241. API, console and tokens
   unchanged this session (1 Oct: 718 / 217 / 38).
10. **Prelim still NOT runnable:** 96 act-1 items at `review`, 0 `live`
   (measured locally today; the deployment was measured 1 Oct, its admin
   credentials are now deleted from this machine).
11. **A hand-edited package.json broke the Vercel build (2 Oct, fixed in the
   same session).** Phaser's range was narrowed to `^3.90.0` by hand after
   `pnpm add`, leaving `pnpm-lock.yaml` at `^3`; Vercel installs with
   `--frozen-lockfile` and refused. No local check runs a frozen install.
   After touching any `package.json`, run `pnpm install --frozen-lockfile`
   before pushing.
12. **The instructor re-sent the solar-system brief (2 Oct) for the next
   session.** Most of it is R4.7, built. The five things it names that are
   not are now **R4.8** (R4 phase file): Trojan swarms at L4/L5 of the giants
   (not companion planets: every planet is a stage), irregular captured
   moons, rings on the other giants, the star's magnetic field as Parker
   spirals, and periods from the star's mass. Build R4.8 BEFORE R5.3, so the
   draw-call measurement includes it.
13. **R4.9, the instructor's changes after seeing R4.7 (2 Oct, for the next
   session):** comets stay out at the edges and move much slower (no 40x
   clock, start near aphelion); smaller planets; wider orbits so that no two
   planets ever overlap (tested on their moving positions); the map a tad
   bigger on screen; a bigger sun. Specified box by box in the R4 phase file.

---

## 0zd. The drafting assistant re-planned (v2) — 7 Oct 2026

A planning session only: no code, no schema, nothing deployed. The instructor
answered plan v1: "I want this AI to properly do what you were doing with all
of the books. Summarising the Figures charts and graphs. And think about more
features also. Planning first, come back to me first."

1. **docs/AI-ASSISTANT-PLAN.md rewritten as v2, FOR APPROVAL.** It covers the
   figure reader (crops, exact labels and chart data, no model), figure summaries
   with a grounding check, redraw by spec through per-kind renderers, lesson
   text whose quotes are pasted by reference, questions whose keys come from
   code plus a blind-answer critic, and a local review page. It also lists
   twelve more features, an engine choice (A local Ollama / B Claude API,
   recommended / C Claude Code as now), build steps A0-A6, and five decisions
   (§9).
2. **Measured 7 Oct:** the book's figures are VECTOR drawings (0 embedded
   images on the trial pages, 30-65 paths each). Their labels and chart points
   are exact coordinates, so a chart's data can be read, not estimated by eye.
   About 355 figure captions and 150 tables across 21 book chapters (1.8 M
   characters). A throwaway PyMuPDF crop (scratchpad, not in the repo) found
   2 of 4 figures, and both crops were opened and are clean (Fig 14.10, the
   pipeline grid; Fig 2.2, processor trends). The two misses were caused by
   captions set with non-breaking spaces ("Figure 14.10"); A0 must handle
   them.
3. **This laptop:** RTX 3050 Laptop GPU with 4 GB VRAM, 16 GB RAM, Python 3.13,
   no Ollama. A 3-4 B vision model fits; a 7-8 B text model spills into RAM.
4. **Cost estimate for engine B** (Opus 5.5 at $4/$20 per M tokens): about $3
   per chapter, about $50 for 01-17, roughly half on the Batch API. An
   estimate; A1 measures it on syllabus 12 (book 14).
5. **Prelim still NOT runnable** (deployment, 7 Oct, measured): stage 01 has
   13 live, 2 at review, 2 retired; 02 24, 03 33, 04 24, all at review.
6. **The instructor answered v2 the same day; the plan is now v3.** (1) The
   engine must be FREE ("will Ollama suffice?"). (2) Hosted on Render Free,
   with Railway as the fallback. (3) "This AI is for future books"; the rest
   of this book (syllabus 13-17) is its TEST. (4) **The MP3s are SCRAPPED**:
   the browser voice is the audiobook (recorded in FIGURES-AND-AUDIO.md);
   no TTS key is needed. (5) "Tell me the features and explain them" (v3 §6).
7. **Measured for v3:** Render Free is 512 MB / 0.1 CPU / no GPU, with 750 h
   a month shared across the workspace. The deployment has NO keep-alive job
   (cron.job: item-stats, invariants, scheduled-locks), so the API sleeps
   when idle and there is room for a second free service. Railway Free is
   0.5 GB, 1 vCPU, $1 of credit a month. Ollama therefore CANNOT run on either
   free host. Gemini's free tier trains on what it is sent, and its limits
   are volatile. v3's design puts the website on Render and the model on
   this laptop as a worker that PULLS jobs from Supabase (no tunnel, no
   open port). The test plan uses syllabus 13 (book 15) as the benchmark
   against the session's draft, 14-17 (books 16, 20, 21, 18+17) as the real
   test, and 18 must stop with "no source".
8. **Then the instructor's own idea, the same evening:** each teacher runs
   their own AI on their own laptop, as an EXECUTABLE that the website checks
   and connects to. v3 §4 now designs it: an "OCTA Assistant" app (Python,
   PyInstaller, Windows first, unsigned) that pairs with a code, CALLS OUT
   (a heartbeat every 30 s, and it pulls that teacher's jobs from Supabase
   under owner-only RLS), manages Ollama and picks a model by the machine's
   GPU and RAM. The website shows five states (not installed, offline,
   online, busy, out of date) and runs every CHECK itself with OCTA's
   existing JS, so the checks never fork. The browser-to-localhost route
   was rejected: Safari blocks it, Chrome prompts for it, it only works
   while the page is open, and other sites could probe the port.
   Signing is not free: SmartScreen warns on an unsigned exe, and macOS
   needs $99/year to notarise.
9. **Models (Ollama library, checked 7 Oct):** no local model matches Claude;
   the nearest open ones need 80+ GB. For this laptop: qwen3.5:4b for
   figures (vision, 3.3-4.0 GB) and qwen3.5:9b for text (6.6-7.6 GB, split),
   with gemma4:12b as the comparison. Tier table in v3 §3.
10. **Waiting on the instructor:** v3 §10's six decisions (the design; may the
   next session install Ollama here; Windows-only unsigned first; whether
   OCTA becomes multi-course and who gets teacher accounts; which extras;
   the order). ANSWERED in 11.
11. **Second round, the same evening: every decision made; the plan is now v4,
   APPROVED, and built LAST.** (1) "We already have the websites": there's no
   new host. The assistant is a CONSOLE page `/assistant` (Vercel) plus API
   routes (Render), and the API runs the checks. Heartbeats go to Supabase,
   not the API, so the app never keeps Render Free awake (750 h/month).
   Jobs reach the app through Supabase Realtime. (2) Installing Ollama on
   this laptop for B0: yes. (3) "You decide": Windows only, unsigned, with
   the Run-anyway step in the setup guide. (4) OCTA WILL serve several
   courses and teachers one day ("a future dev plan"), so every assistant
   table carries a course and an owning teacher. OCTA's own move to many
   courses is a SEPARATE plan, not written, and not part of this one.
   (5) Extras: ALL. 10-12 are built with the core, 13-16 after (the
   instructor asked whether "10-16" meant chapters; they are the features
   in v4 §6, and once that was clear, all were chosen). (6) "This will be last on the implementation plan": the
   assistant waits until ruling 4 is verified live, R5 is done, and anything
   else ahead of it. B0-B10, about 15 sessions.

## 0zc. The class chat, ruling 4, questions 09-12, Listen, passwords — 6 Oct 2026 (evening)

Pushed, in order: `46ac563` chat schema, `4c47c74` chat API, `221c0c8`
/app/chat, `2d3b0b5` console /chat, `c1e4e85` chat audit sentences, `26ca1eb`
storage empty-body fix, `4487ec1` journeys no longer close the chat + the
closed chat names its paper + INV-33 text, `52d959e` late media scroll,
`0e441cf` docs, `a34a59d` ruling 4 (leaving submits), `ddf5eb4` questions
09-12, `5f820fe` Listen, `1043318` AI assistant plan, `5491a61` password
reset (console tool + forced change), `4a6b69f` toaster under dialogs,
`7deeb47` belt dots, `c518682` student self-service reset, `c7afc04`
captures. Range: `46ac563`..`c7afc04` (18 commits).

1. **The class chat is built and on the deployment** (docs/CHAT-PLAN.md has
   the verification record). Schema `db/addendum-chat.sql` (9th SQL file) was
   pushed before any code, three times as it changed. Verified ON THE
   DEPLOYMENT with two throwaway accounts in a TEST-CHAT section (instructor
   approved; all removed afterwards, bucket empty): Realtime INSERT reached the
   other student in 279-418 ms; a private thread never reached them; an open
   page updated 0.9 s after Enter with no reload; a screenshot travelled the
   private bucket on a signed link and the unsigned URL is refused. Locally:
   31 DB denials (watched red), 32 route tests, both page gates green.
2. **Found on the deployment, fixed the same day:** every upload failed
   (Storage refuses a JSON content type with no body; the fake storage hid
   it, `chat-storage.spec` now pins the requests); a moon's journey closed the
   chat for good (`chat_paper_open()` now ignores scope 'objective'); the
   closed chat never said which paper, and its link lacked `?a=`; a picture
   loading late pushed the newest message out of view.
3. **Ruling 4 (instructor, 6 Oct), replacing ruling 3's "never auto-submit":**
   leaving full screen submits AT ONCE; hidden more than 15 s submits; closing
   or reloading submits; it uses the attempt; journeys exempt. Page:
   AttemptRunner (pagehide keepalive, a sessionStorage reload marker).
   Backstop: `services/api/src/sitting.ts` sweeps a LEFT paper (full-screen
   exit, reported close, leave past the grace, 2 h idle) on Start, the map
   and the chat. `db/addendum-sitting.sql` (10th SQL file) adds the events
   `closed` and `auto_submitted`; pushed first. The one stale paper on the
   deployment (23212905, Stage 01 Check, 0 answered) was submitted by script
   as ruled ("submit them now"): 0/8, its attempt used. Hard rule 9 amended.
   **NOT verified on the deployment in a real browser**: the sweep ran there
   once (the script), and Vercel serves the new runner; a real sitting with a
   full-screen exit has not been tried on the live site.
4. **Questions 09-12: 131 at review**, local and deployment (09: 32, 10: 36,
   11: 29, 12: 34). Every act-3 solver used once; every objective at least
   three; every unquoted claim checked against ch-10/12/13/14.md, which caught
   three of my own errors. All 131 previewed through the API. Exams still stop
   at 08.
5. **Listen (the audiobook)** on the stage reader: the browser's voice,
   Pause/Resume/Stop, four speeds, the block being read marked; never code.
   Verified with a recording stand-in for speechSynthesis; a real voice has
   only been heard if the instructor tries it.
6. **Passwords (instructor: "both, the console tool first"):** /students/:id
   Actions > Reset password… (reason, audited, temporary password shown once)
   and, in the student app, a forced "Choose a new password" screen; plus
   /forgot-password and /reset-password by email. **The email path needs two
   dashboard settings the instructor makes:** add
   `https://octa-web-dusky.vercel.app/reset-password` under Authentication >
   URL Configuration > Redirect URLs, and set up auth email (the built-in
   sender allows only a few emails an hour; a custom SMTP is the fix). Until
   then the email path is unverified. The console tool and forced change were
   verified locally only (fake admin in the API tests; the real Admin API
   call is the one the console's own credential change already uses).
7. **Rulings asked once this session:** Realtime check with two test accounts
   (done); AI: plan the local assistant (`docs/AI-ASSISTANT-PLAN.md`, awaiting
   approval, two questions in it); INV-33: change the text (done, R5 box
   ticked); passwords: both (done); belt squares: fix (done, map/dots.ts);
   toasts under dialogs: fix in the toaster (done).
8. **Local stack traps seen again:** every API test run empties the seeded DB
   (reset + demo after); `db:reset` killed the dev API three times; Python on
   Windows writes CRLF (harmless, Git normalises); heredocs with apostrophes
   break (use the Write tool).
9. **Suites at close:** API 881+ (sitting 13, passwords 12, chat 63, storage
   3 added), web unit 302+15, console 222; specs green: web-chat, console-chat,
   web-stage-check (70), web-listen, web-stage, console-student-password,
   web-change-password, web-recovery, console item-review/students/
   assessments; /app map specs pass alone (load-sensitive at 2+ workers).
11. **Email reset VERIFIED on the deployment (6 Oct, after the instructor set
   the Redirect URL):** a throwaway auth user (no roster, no profile, deleted
   after) got a recovery link from the Admin API (`generate_link`, the link the
   email carries); a real browser opened it on the live site, landed on
   /reset-password with the form, the token left the address bar, the new
   password saved and went to /app, the new password signs in and the old one
   is refused (`scripts/.reset-verify.tmp.mjs`, untracked). **Email delivery
   confirmed by the instructor, 6 Oct 2026: "Email reset works."** The whole
   self-service path is verified on the deployment. Supabase's built-in sender
   allows only a few emails an hour; a custom SMTP is the fix if a class needs
   more.
12. **Listen's voice (instructor: "horrible"), fixed the same evening**
   (`bbe05f6`): the most natural English voice chosen, a Voice choice, whole
   paragraphs per utterance, symbols as words, and the reading mark redrawn as
   a soft panel (instructor: "too close to the paragraph"). **MP3s from Google
   Cloud TTS ruled next**; the plan is in docs/FIGURES-AND-AUDIO.md and waits
   for the instructor's API key (server-side only).
13. **Listen now FOLLOWS the voice** (`1c74d72`; instructor: "change the way
   it follows or highlights the sentences while it reads, with animation like
   a line or progress bar along the bottom"). The sentence being said is
   tinted (CSS Custom Highlight API), the word lit where the voice reports
   words, a line under the sentence fills as it is read, and a strip just
   above the biome's bottom bar carries Pause/Resume/Stop, "Sentence N of M"
   and the lesson's progress line. Template `template-listen.png` captured
   mid-playback (SOURCE.md). web-listen 29 passed at 1440 and 380, web-stage
   76 passed, captures opened. **Not yet heard with a real voice on the
   deployment:** the specs use a recording stand-in; Chrome's Google voices
   send no word events, so on them only the sentence moves (by design).
10. **Prelim still NOT runnable:** deployment stage 01 has 13 live, 2 at
   review, 2 retired; 02-04 have none live (81 at review).

## 0zb. Figures, the authoring to chapter 12, the plan changes — 5-6 Oct 2026

Pushed, in order: `e458812` ch 10, `ac48f38` ch 11, `c141a30` ch 12 (lesson
text drafts), `b2b3a5f` the figures/audiobook plan, `c17c3a5` the figure
pipeline (schema, sync, API, tests), `2e78512` figures in the reader and on
/content and /items, `c4f736a` the emphasis fix and the paper and /items gates,
`197090a` ch 13 with two figures, then the 01-12 figures (`f9519af`..`c169dfc`),
`cf1b7a9` the bank/exam scope split, `d38bda3` and `b8720e1` the figure-mention
audit and guards, `0734568` the claim handout. Range pushed: `e458812`..HEAD.

1. **New instructor request (6 Oct): figures and an audiobook.** Three rulings,
   asked once (`docs/FIGURES-AND-AUDIO.md` holds them and the design): figures
   are RECREATED as our own SVG, never screenshots; the audiobook is the
   browser's voice now, MP3s later; the figure pipeline comes before more text,
   then 13-18 with figures, then a reread of 01-12 for theirs, then questions,
   then the audiobook, then R5.
2. **The figure pipeline is built and on the deployment.** `db/addendum-figures.sql`
   (the 8th SQL file) was pushed to ddvxkbcelpqydnjkffdr BEFORE the code (hard
   rule 10): table `figures`, `items.figure_id`, two triggers. A figure is
   `content/figures/<id>.svg` checked by `scripts/lib/figure-svg.mjs` (an
   allowlist; eight `fig-*` classes, no colour; viewBox <= 440 and text >= 14
   units, MEASURED: 9.5px at 380). Approve on /content's Figures card or under a
   question on /items; a question cannot go live with an unapproved figure.
3. **Found and fixed:** the figure emphasis first used the accent, which is each
   student's hue; on a paper it differed per student. Now the fixed info pair.
4. **Found and parked (console, all dialogs):** a Radix modal sets aria-hidden
   on everything outside it, the toaster included, so a toast raised while a
   dialog is open is on screen but NOT announced to a screen reader (/items
   decisions, a figure approved on /items). Fix in the toaster (portal it into
   the open dialog, or an aria-live region inside DialogContent), on its own gate.
5. **Not yet on the deployment:** the chapter drafts 10-13 and the three figures. DONE 6 Oct: synced (dry run first), 08-13 drafts and 3 figures wait on /content. NOT seen on the deployed console by me: no deployed URL is recorded in the repo; the hosts build from main (Render, Vercel), so the figure code should be live there.
   `sync-content` against the deployment, dry run first, is still owed.
7. **Plan changed (instructor, 6 Oct): authoring stops at chapter 12.** 13's
   draft predates the ruling and waits unapproved (withdraw it only if asked);
   14-18 stay planned stubs. Order now: reread 01-12 for figures, questions
   09-12, audiobook, then the "Octalysis AI" proposal (analysed in
   `docs/AI-ASSISTANT-PROPOSAL.md`: not buildable as written; a local,
   staff-only drafting assistant feeding the existing gates is the alternative),
   then R5. `docs/FIGURES-AND-AUDIO.md` ruling 4 holds the order.
8. **Figures reread done for 01-12** (6 Oct), 17 figures in all, each drawn,
   previewed at 380 and 1440 with `scripts/.figure-preview.tmp.mjs` (scratch,
   untracked) and opened: 01 top-level structure, 02 Amdahl chart, 03 instruction
   cycle states, 04 address fields, 05 Hamming circles, 06 disk layouts, 07 I/O
   timelines, 08 process states + paging, 09 IEEE formats + -6.25, 10
   instruction format, 11 x86 format, 12 pipeline timing + branch penalty, 13
   register windows + graph colouring. **All synced to the deployment** (dry run
   first): 17 figures at draft, 0 served; 01-07's figure blocks are live but
   hidden until each figure is approved. The deployed API is
   https://octa-api-noq2.onrender.com (instructor, 6 Oct); it runs the figure
   code (its figure route answers 401, an unknown route 404).
   Stage 05 keeps its ASCII Venn sketch until 05-hamming-venn is approved; then
   delete the sketch (a data-only change).
9. **Instructor found (6 Oct): 01-structure-hierarchy-order says "Figure 1.1
   nests..." with no figure.** It is the only item whose stem names a book
   figure. Attaching 01-top-level-structure would show the answer (its panels
   ARE the nesting), so the stem was reworded to stand alone in
   content/items/01.json: "A computer's top-level structure is a set of levels,
   each one a component of the level above it. Put these in order from the
   outermost level to the innermost." On the deployment the item is LIVE, so
   sync leaves it alone (rule 6): the instructor makes a New version on /items
   with that stem and approves it. A figure on a question must never draw its
   answer; question figures are drawn per question.
10. **Figure-mention audit (instructor, 6 Oct): nothing names a figure it does
   not show.** Ten mentions found: nine reworded, one kept and marked
   about="book-figures" (01's note on the 9th edition). sync-content --verify
   now refuses a figure number outside a figure's own caption, and sync-items
   one in a question with no figure; both watched catching a planted mention.
   Two live items were versioned on the deployment (01-structure-hierarchy-order
   and 01-keyboard-path-order): v2 at review, v1 retired. The instructor said
   resets are fine ("I only approved little of it"); only changed items were
   touched.
11. **The bank's reach and the exams' reach are split** (scope.ts):
   BANK_THROUGH_STAGE = "12" (sync-items, console import), while
   EXAMINABLE_THROUGH_STAGE = "08" still governs every exam and stage check.
   No questions for 09-12 written yet: that is item 2 of the next prompt.
12. **Claim handout for students**: docs/handouts/claim-your-account.pdf (two
   A4 pages, real screenshots at phone size, QR verified to read
   https://octa-web-dusky.vercel.app/register). Source .html beside it; rebuild
   with scripts/.handout-pdf.tmp.mjs (untracked). Locally the claim route does
   not exist (dev auth), so its two responses were the server's own, quoted
   from auth.ts. A local-only fixture roster row 23290001 was added (wiped by
   the next db:reset).
13. **Found, for the instructor:** students have NO self-service password reset
   (/forgot-password is not built in apps/web) and the console has NO tool to
   reset a student's password; today it is the Supabase dashboard
   (Authentication, Users). The handout says "tell your instructor".
14. **New, approved: the class chat** (docs/CHAT-PLAN.md, four rulings), ordered
   FIRST. Not started: no template, schema or code yet.
15. **The deployment's addresses** (instructor, 6 Oct): API
   https://octa-api-noq2.onrender.com, students https://octa-web-dusky.vercel.app.
   The console's address is still not recorded.
16. **Prelim still NOT runnable** on 6 Oct: on the deployment stage 01 has 14 live
   and 1 at review (after the versioning above), 02-04 have none live (81 at
   review).

## 0za. R4.8, R4.9, R5 begun, the approval gate, the map's new tricks — 2-5 Oct 2026

Pushed, in order: `80a8233` R4.8 (Trojans, captured moons, faint rings,
Parker spirals, periods from the star's mass), `f578165` R4.9 (smaller
planets, wider orbits, no overlap tested on moving positions, bigger sun,
distant slow comets), `9c36f75` R5.1 (INV-32 restated, INV-34; INV-33
open), `444e063` R5.3 draw calls (89 to 43-44: merged ellipses, bands,
centaurs, single-pass rings), `2c0b929` Orientation finishes itself,
`943aef0` zoom and look around (home after 30 s), `9ac1058` the lesson-text
approval gate and chapter 08's draft, `b8ed4bd` the bodiless-POST fix, moons
on the planets' rules, quieter orbit lines, addendum-drafts.sql and hard rule
10, `204788a` the alien, `9a95834` chapter 09's draft. Found and left:

1. **Instructor requests this session, all built:** Orientation completes
   when read to the end and carries the student to 01; manual zoom, pinch,
   pan and tilt, home after 30 s; moons follow the planets' rules; orbit
   lines faint and breathing, the chosen one clear; an alien saucer on a
   comet's orbit, focused on click, saying "Pag tuon haa", "Oi tan aw man
   ka", "Alien nako BOII!", "Shem gwapo" (`?alien=now` brings it in).
2. **"Why we don't have moons yet":** a moon counts only LIVE questions.
   Stages 01-08 have 183 items, all at `review`; 09-18 have none. The
   instructor approves on /items; authoring 09-18 continues (item 6).
3. **A bodiless POST answered 400 everywhere** (Orientation's finish, moon
   journeys, the prompt's dismiss): the client said JSON on every request and
   Fastify refuses an empty JSON body. Fixed in both apps' request();
   `apps/web/test/api-request.spec.ts` pins it. Moon journeys were broken in
   browsers before this session; the specs stubbed them.
4. **The deployment broke and was fixed:** /content answered 500 because
   `chapter_drafts` was only local. Hard rule 10 now binds (instructor):
   idempotent addendum and `pnpm db:push --file`, before dependent code. The
   deployment is **ddvxkbcelpqydnjkffdr** (Singapore, ap-southeast-1), 29
   tables; the root .env now names it (the instructor set it; never read or
   print it). The old project lqvkqdaqtkhxmnvodmyr is dead weight. Chapters
   08 and 09's drafts are on the deployment for review.
5. **The lesson-text gate:** `content/stages/NN.draft.md` to the staff-only
   `chapter_drafts`, approved on /content (hash-bound, audited), then copied
   into content_blocks; sync never puts the stub back over approved text. The
   console's preview now uses a copy of the reader's parser, held to it by a
   test (its old mirror drew `##` literally).
6. **Authoring done: lesson text 08 and 09.** Left: lesson text 10-18 and
   questions 09-18. sync-items refuses items past stage 08 (scope.ts): the
   bank's reach and the exams' reach need separating first.
7. **INV-33 is open for the instructor:** the 30 Sep remake deleted the flight
   path; the map draws no prerequisite edge, and Orientation's own text says
   "Every connection on it is a real prerequisite."
8. **R4.3's pixel-still test is load-sensitive** (the frame-rate guard's
   quality switch); it now starts in low quality. WebGL specs are slow under
   load: run them at 2-3 workers.
9. **apps/console/.env.example now holds a key** (the instructor's): it is
   TRACKED. Never stage it; suggest moving it to apps/console/.env.local.
10. **Suites at close:** API 745 (+1 skip), web unit 294, console 215, tokens
   38; /app, look, perf and reader 128 passed; console content 80. Entry
   chunk 112.5 KB gz (was 109.6), map chunk 227.7 KB gz.
11. **Prelim still NOT runnable:** 96 act-1 items at review, 0 live, local and
   deployment.

The next session's prompt is REVAMP-PROMPTS.md section 1.

---

## 0. Run the phase report — this is a rule

```
pnpm phase          # counted from the files, never from memory
pnpm phase --open   # every open R-phase box, with its section
```

**Show it at the start and again before you finish.** Root `CLAUDE.md` requires
it, because a remembered figure is how this project lost track twice.

Current, counted 27 Sep 2026 after `/students/:userId`:
`R0 28/28 · R1 36/36 · R2 21/21 · R3 46/72 · R4 2/29 · R5 0/24`
— **133 done · 77 to-do (210 items, 63%)**, live phase **R3** (R4 also open).
The denominator grew from 171 when R3 gained one box per console route and R4
gained the moon and minigame scope; the percentage fell because work was
*found*, not lost.

**The last three sessions were NOT R3 work.** The item bank, the solvers, the
assessments, the stage checks and the deployment fixes are P3/P4/P5 on
`PHASES.md`'s track. No R-phase box moved, and that is correct — do not
"reconcile" the phase files to account for it.

---

## 1. THE GOAL IS TO SHIP, SOON — read `docs/SHIP-EARLY.md`

**Ship 1 — stages 00–04 plus the Prelim.** Authored prose, 96 banked items, five
attempts, submissions, console, feedback, the map. Everything it needs exists.

**Ship 2 — stages 05–08 plus the Midterm.** One authored chapter away: 05, 06
and 07 are written, **chapter 08 is still a scaffold** with 15 items against it.

**Later update — Semi-final and Finals (09–18).** Solvers are written, tested and
registered; items are not, and the prose is eleven scaffolds. `engine/scope.ts`
withholds both exams and `scope.spec.ts` fails if the flag widens without the
bank moving with it. **Nothing must change for the first two ships to be
correct.**

---

## 2. State of the world, measured

### Local — works, and is the only place anything works

```
pnpm db:up                                  Postgres 16 on :15432
pnpm db:reset && node scripts/db-demo.mjs   183 items · 22 blueprints · 10 assessments
                                            115 objectives · 19 stages
pnpm dev:api                                :8090   NOT the raw dev script
pnpm dev:token                              a signed-in console session
pnpm dev:token staff --must-change          the bootstrap-credentials screen
pnpm verify                                 396 API · 53 web · 27 console, green
pnpm phase                                  the report above
```

The 10 assessments are **2 exams** (Prelim, Midterm) **+ 8 stage checks**
(stages 01–08). 22 blueprints = 4 exams + 18 stage checks, one per gradeable
stage.

### Live Supabase — exists, answers, and is empty and stale

Measured 9 Sep with `node scripts/db-push-supabase.mjs --check`, which applies
nothing. Project `lqvkqdaqtkhxmnvodmyr`, PostgreSQL 17.6.

| | Live | Should be |
|---|---|---|
| public tables | **21** | 22 |
| stages | **18** | 19 |
| objectives · content_blocks | 0 · 0 | 115 · 217 |
| items · assessments · profiles | 0 · 0 · 0 | 183 · 10 · 25 |

The missing table is **`submissions`** — 40% of the grade.
`db-push-supabase.mjs` omitted `addendum-submissions.sql`; **fixed** (`d98ed0d`),
**not yet applied to the project**. 18 stages means the live schema predates the
18-chapter rebuild.

**Nothing was lost, because nothing was there** — 0 profiles, 0 attempts,
0 responses.

### Vercel / Render

The instructor says they are live. `origin/main` is current. Whether they are
connected and building is **unverified from here** — ask rather than assume.

---

## 3. Two decisions waiting — both are the instructor's

### 3a. Stage 00 cannot be completed, so stage 01 never unlocks — RESOLVED 25 Sep 2026

> **Decided by the instructor.** Orientation has no moons (cosmetic asteroids
> instead), and **a non-gradeable prerequisite never blocks**, so stage 01 is
> open from the start. Recorded in `WEB-REVAMP.md` §3.7 and R4.6. **BUILT 30 Sep
> 2026:** `is_stage_unlocked()` counts only gradeable prerequisites, and the
> API's `lockReason` names only those (`rls.spec.ts` §3.7, `stages.spec.ts`).
> The symptom below is gone. The suggested invariant ("a non-gradeable stage
> never appears in any prereq") is **superseded**: the ruling keeps 00 in 01's
> prereq, as the map's edge, and makes it harmless instead. The analysis is kept
> for the reasoning.

Stage 00 is `gradeable = false` with no items, so it gets no stage check — and
stage 01's prerequisite is stage 00. `is_stage_unlocked()` needs every
prerequisite at ≥70% mastery, and orientation can reach it by no path that
exists. Three options, none of which an engineer should pick alone:

1. Orientation completes on **reading** rather than testing — no code path today
2. **Stage 01's prereq changes** to `{}`
3. A **global unlock** on stage 01 in `/locks` covers it operationally

**What a real student sees today** (14 Sep, `GET /api/v1/stages` as the seeded
student, local stack):

```
01 | locked | "Unlocks when Stage 00 (Orientation) reaches 70%. You're at 0%."
```

The app instructs the student to do something that has no path.

**Measured against the code, 14 Sep — option 3 is not what it reads like.**
`LocksPage.tsx:85` hard-codes `scope: "user"`. The API supports `global`
(`console.ts:161`) but **no console control reaches it**, and the matrix is
empty until a student registers. So option 3 means the instructor toggling a
cell per student, after each registers, with a reason each time, for every new
enrollee — a standing chore, not a policy, and it leaves the broken edge in the
data.

**Option 1 is the most expensive.** `routes/stages.ts` has no POST at all. It
needs an endpoint, a contract, a client control, a denial test, and a ruling on
what number "I read it" writes — which then lands in `avg(sp.mastery)`
unfiltered at `console.ts:34` and `live.ts:50`, inflating every student's roster
average with a figure nobody earned, and making `mastery` mean two things.

**The engineer's recommendation is option 2**, on the grounds that the current
edge asserts something the schema contradicts: `gradeable = false` says the
stage yields no mastery, `prereq = {00}` says you need mastery from it. Option 2
deletes a false claim; 1 and 3 build machinery to satisfy it. Orientation
becomes skippable, but it is already skippable-by-impossibility. Option 1 stays
available later and composes: build the completion path, then restore the edge.

**Worth doing alongside whichever is chosen:** an invariant that a non-gradeable
stage never appears in any `prereq`. INV-19 checks prereqs exist and INV-20 that
they are acyclic; nothing checks one is *satisfiable*, which is this bug's
shape. INV-30 already forbids non-gradeable stages from supplying items — this
is the symmetric rule.

### 3b. Re-pushing the schema needs `--reset`, which drops the public schema

Irreversible and outward-facing. Today's reading says it is safe — nothing to
lose — but that reading is a **snapshot, not consent**. Ask explicitly, and
re-run `--check` immediately beforehand.

If approved, the go-live sequence:

```bash
node scripts/db-push-supabase.mjs --reset      # schema, all five files
# then with DATABASE_URL pointing at Supabase:
node scripts/sync-content.mjs                  # 19 stages, 115 objectives, content
node scripts/sync-items.mjs                    # 183 items, all `review`
node scripts/sync-assessments.mjs              # 2 exams + 8 stage checks
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
  node scripts/bootstrap-admin.mjs "instructor@email"
```

The last prints a temporary password and stamps
`app_metadata.must_change_credentials`, so the console blocks on a change screen
at first sign-in. That is deliberate.

---

## 4. Built, and deliberately not

**Built and verified across the last three sessions**

- **60 solvers** (4 original + 56 new), each tested against hand-computed values
  or published figures — Hamming check bits reproduce Stallings Table 5.2, PCIe
  gives 250 MB/s and 8 GB/s, 7200 RPM gives 4.17 ms, IEEE 754 biases 127/1023.
- **183 items** across stages 01–08, covering all 59 gradeable objectives, each
  citing its book section and checked against `content/book-map.json`.
- **Stage checks** — 18 blueprints, 8 offered. Without these nothing unlocked
  (F-44).
- **`engine/scope.ts`** — the examinable-scope flag, stage 08 / Midterm.
- **`bank-feasibility.spec.ts`** — fills real exams AND every in-scope stage
  check from the real files, asserting constraint cells, provenance and spread.
- **Console** — item review queue (send back with a reason, advance to next),
  the exam window control, the bootstrap-credentials block.
- **Scripts** — `bootstrap-admin`, `dev-token`, `sync-items`,
  `sync-assessments`, `phase-report`.

**Deferred, with the reason recorded**

- Acts 3–4 (stages 09–18) — out of examinable scope by the instructor's ruling.
- Five minigames — R3.2b, their chapters are scaffolds, and hard rule 5 forbids
  inventing the lesson to have something to practise.
- The public marketing site — five routes, owned by no phase.

**Honest gaps**

- **Nothing is `live`.** All 183 items are `review` until approved at `/items`.
  No student can sit anything until that happens. `/items` passed the revamp gate
  on 25 Sep 2026, so the page is ready; the 96 act-1 approvals are the
  instructor's to make.
- `design/templates/console/` — **only `/items` has a template**, and it passed the
  gate on 25 Sep 2026. The other 13 route folders are EMPTY: each session captures
  its own reference first. An R3 sign-off item.
- The reverse travel transition (leaving a stage back to the map).
- R4 and R5 have not started.

---

## 5. Process documents — applied, and not

**Applied:** hard rules 1–8 (denial tests led every data-touching change), the
engine rules, the content rules (book-map checked, sources cited),
`REDESIGN-CLAUDE.md` §2 (screenshot before believing — it caught three defects),
§2b, §2c, §2d (stopped for the instructor's calls on scope, P-item solvers, and
the stage-00 gate).

**Not applied, and worth deciding on:**

- **`CLAUDE-CODE-PRACTICES.md` §4, Writer/Reviewer** — the doc says use it *for
  the engine*. 56 solvers were written and self-reviewed. Tests are strong; a
  second reviewer pass never ran.
- **`PROMPT-LIBRARY.md`'s four templates** — work went conversationally.
- **§6, "write a skill for anything you'll do twice"** — eight item files were
  hand-authored. The obvious candidate before acts 3–4.

---

## 6. Context degradation — what actually happened

Three claims went stale **inside the session that wrote them** (`0ef2856`): an
items/assessments count written an hour before assessments existed, and two
"no assessments row exists" lines that were true for about an hour. The lesson
is not that the docs were wrong — it is that **a doc edited early in a long
session describes a repository that no longer exists by the end of it.** If you
write a count, write the command beside it.

Guards that fired and worked, which is the system doing its job:

- `design/global-setup.ts` refused specs against a truncated database.
- `sync-assessments.mjs` took the whole seed down on missing blueprints — now a
  warning.
- `bank-feasibility.spec.ts` went green on length and **red on provenance**, and
  the product was right while the test was wrong.

---

## 7. The session-closing question

`CLAUDE-CODE-PRACTICES.md` §10 and `START-HERE.md` §7 both require it:

> **"Which parts of this did you actually run, and what are you unsure about?"**

**Last session ran:** `pnpm verify` end to end; every solver test; the 38 RLS
denial tests; the feasibility spec including a mutation that made it fail;
Playwright for the review queue, exam window and credentials block, each opened
and looked at; `--check` against live Supabase.

**Unsure about:** anything against live Supabase beyond the read-only check;
whether Vercel and Render are connected and building; whether
`bootstrap-admin.mjs`'s *success* path works against a real project (guards are
exercised, the happy path is not); and the pedagogical quality of the 183 items,
which is the instructor's review, not a test.

---

## 7b. Three ship blockers found by going live, 14 September

All three were invisible until items were approved, because every predicate
involved looks only at `live` rows and **nothing had ever been live**. Found by
approving act 1 on the local stack and walking a real student through. Fixed,
tested, committed — `808d28e`, `efd50a0`.

1. **A stage check sampled the whole bank.** A "Stage 01 Check" returned items
   from stages 01–04. Worse, `routes/attempts.ts:145` writes mastery for
   `items[0].stageId`, so submitting it would have written stage 01's mastery
   onto **stage 04** and unlocked stage 05. `loadBlueprintFor()` never selected
   `b.stage_id`, so the caller had no stage to narrow the pool to.
   `test/stage-check-scope.spec.ts` now holds it with 40 decoy items.

2. **INV-17 demanded columns the engine does not read.** `tolerance` and
   `params_schema` on live P items; the engine reads only `solver_ref`. All 30
   authored P items would have failed a `fail`-severity invariant on approval.

3. **INV-16 demanded 4 distractors** where the engine asks for 3
   (`optionCount` defaults to 4). All 141 authored S items carry 3.

Plus: `run_invariants()` counted inside its own `limit 5`, so **74 illegal rows
reported as "5"** to the nightly job and the console alike.

**The lesson, and it generalises:** a guard that only inspects `live` rows is
untested until something is live. `helpers/bank.ts` seeds ONE stage and fills
`tolerance`/`params_schema` that no authored item has — so the fixtures were
shaped to a contract the bank had left behind, and every suite was green.

**Proven end to end on the local stack after the fixes:** stage 01 check → 8
stage-01 items across 5 objectives → 8/8 → mastery 1.0 on stage 01 → stage 02
unlocked, stage 03 still correctly locked. With all 96 act-1 items live,
`pnpm db:invariants` reports 25 clean, 0 failures.

### 7c. The browser pass, and the blocker only it could find

The MCP Playwright server was down, so this used the project's own
`@playwright/test` against the student app on **5183** (5173/5174 belong to
another project on this machine). Captures in
`design/screenshots/session-2026-09-14/`.

**A fourth blocker, invisible to every test: ordering items were unanswerable.**
`AttemptRunner` had no branch on `item.type`, so a type-G item rendered as a
radio group — a sequence question with a single-choice control. It sent
`{index}`, and `grade.ts:85` returns `miss(item, "no ordering submitted")` for
anything that is not `{order}`. **Every ordering item was wrong, always.** Six
are live in act 1; a Stage 01 check drew two of eight, capping an honest student
at 6/8 against a 70% threshold. Fixed in `da5831b` with a keyboard-first
move-up/move-down control.

The second bug inside the fix is worth remembering: committing on every move
recorded the arrangement after the FIRST click, because `recordAnswer()` inserts
`on conflict do nothing` and the first answer wins. The UI ended visibly correct
and the database stored a half-sorted list. **Reordering does not submit; an
explicit button does.**

**Verified in the browser:** the 3D map, the flat map, the stage reader (9,857
characters and a "Start the check" control once unlocked), and the runner — at
1440 and 380, no horizontal scroll on any route, no page errors, 44px touch
targets, contrast AA across 1,181 checks.

**`/app/map` is genuinely keyboard-operable** — 0 canvases, 1 SVG, every stage a
focusable `<button>` carrying its state and lock reason, behind a skip link.
CLAUDE.md's degrade-in-place rule holds; it looks orbital but it is real DOM.

**Two things to look at, neither a blocker.** The first thing a student meets on
`/app` is an onboarding card reading "PLACEHOLDER TEXT — NOT REAL COURSE CONTENT
YET". And the runner never tells a student that the first answer for a question
is final, which is how `responses` actually behaves for every item type.

**Still unproven: the deployed apps.** Vercel and Render are reported live, but
the repo records no URLs — `CORS_ALLOWED_ORIGINS` is `sync: false` in
`render.yaml`, which that file itself calls the likeliest cause of "works
locally, not deployed". `octa-api.onrender.com/healthz` answers **404 with an
HTML body**, not OCTA's `{"error":{"code":...}}` envelope, so that is not this
API. Get the real URLs before believing anything about production.

---

## 8. Pick one, and say the phase first

**(a) SHIP — the critical path.** Decide 3a, then approve enough of the act-1
bank at `/items`, then 3b and go live. Verify a real student can read a stage,
sit its check, and see the next stage unlock.

**(b) Approve the bank.** `pnpm dev:token`, walk `/items`, use send-back to
reject what is wrong. Nothing is examinable until this is done.

**(c) Author chapter 08.** The one thing between Ship 1 and Ship 2.

**(d) Close R3.** One real task plus `design/templates/`; then R4.

**(e) Author acts 3–4.** Solvers exist. Items for 09–18, widen `scope.ts`, and
let `bank-feasibility.spec.ts` prove the exams fill.
