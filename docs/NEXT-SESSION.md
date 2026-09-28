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
3. **Stage 01 is closed for all 21 demo students.** `/locks` shows it plainly
   now: column 01 reads 0. This is §3a's decided-but-unbuilt rule
   (`is_stage_unlocked()` still requires stage 00 at 70%). The page renders it
   correctly; the function is what changes, server side, denial tests first.
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
> open from the start. Recorded in `WEB-REVAMP.md` §3.7 and R4.6. **Not yet
> built:** `is_stage_unlocked()` still applies the old rule, so the symptom below
> is still live until that server-side change lands. The analysis is kept for
> the reasoning.

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
