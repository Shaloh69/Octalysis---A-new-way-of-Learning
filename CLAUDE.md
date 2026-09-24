# OCTA — project context

Semester-long interactive learning platform for **CPE 412 — Computer Architecture and
Organization** (BS Computer Engineering, University of Cebu). Stage 00 orientation plus the
syllabus's **18 chapters**, one stage each, across four grading periods. Every student receives a
structurally unique but psychometrically equivalent question paper.

**Textbook:** Stallings, *Computer Organization and Architecture: Designing for Performance*, 9th
ed. **Prerequisite:** Microprocessors. Syllabus archived at `docs/source/CPE 412.docx.pdf`;
full analysis in `docs/CPE412-CURRICULUM.md`.

Read `START-HERE.md` before your first task. Read `VERIFICATION.md` before touching the schema.
**`docs/IMPLEMENTED.md` says what actually exists**, audited from the code rather than from
other documents — check it before believing any claim that something is built.

## Repos

- `apps/web` — Vite + React 18 + TS, hand-written CSS over `packages/tokens` → **Vercel**
  (public + student). No Tailwind, no shadcn: its surfaces are bespoke.
- `apps/console` — Vite + React 18 + TS + shadcn/ui → **Vercel** (teacher/admin). Data tables and
  forms, where a component library genuinely pays.
- `services/api` — Node 20 + Fastify + TS → **Render** (generation, grading, admin ops)
- `packages/contracts` — Zod schemas shared across all three
- `packages/tokens` — three themes + accent derivation, as CSS custom properties
- `db` — Supabase Postgres. Apply in order: `schema.sql` → `addendum-feedback.sql` →
  **`addendum-submissions.sql`** → `addendum-audit.sql` → `addendum-cron.sql` (local
  prepends `local-bootstrap.sql`). `addendum-submissions.sql` carries labs, project and
  participation — **40% of the grade** — and was missing from this list while
  `scripts/db-reset.mjs` had been applying it all along.

## Hard rules

1. **The answer key never reaches the browser.** Keys live in `attempt_items.correct_value`,
   RLS-denied until `attempts.status='submitted'`. All grading runs in `services/api`.
2. **`SUPABASE_SERVICE_ROLE_KEY` never appears in a `VITE_*` variable.** Vite inlines those into
   the client bundle at build time.
3. **RLS is ON for every table in `public`,** and every RLS-enabled table has at least one policy.
4. **Never decide a stage lock client-side.** Call `is_stage_unlocked()`. The client renders a
   lock; it does not compute one.
5. **Never invent course content.** Stage prose, figures, and definitions come from
   `docs/source/*.md` or the database. If content is missing, stop and say so.
   **One narrow exception, instructor ruling 25 Sep 2026:** the one- or
   two-sentence **planet summaries** may be drafted from a stage's own authored
   brief and its syllabus objectives, because each is reviewed before students
   see it. `sync-content.mjs` publishes a summary only at `summary_status:
   approved`. The exception covers those summaries and nothing else.
6. **Items are versioned, never edited in place.** New version = new row sharing `family_id`.
   Old version is retired, not deleted.
7. **`responses` and `attempt_items` are written only by the grading service, and `responses` is
   append-only.** No client INSERT path exists; DB triggers block UPDATE and DELETE, for
   `service_role` too. A student-side insert succeeding is a critical finding. Corrections void an
   attempt; they never edit history.
8. **Test authorization by testing denial.** For every policy, write the test that proves the
   wrong user is blocked — and watch it fail before you make it pass.

## Conventions

- TypeScript strict. No `any` without a `// why:` comment.
- Zod at every API boundary, shared via `packages/contracts`.
- Server errors: `{ error: { code, message } }`. Never a stack trace, never raw SQL.
- Vitest. Every question-engine function needs a test. UI does not.
- Conventional commits, small and frequent. The commit history is project evidence.
- Do not add: `htm`, an ORM over Supabase, a second UI component library, `localStorage` for
  anything gradeable, client-side scoring.
- **Explicitly allowed, and only these:** `three` + `@react-three/fiber` (the star map),
  `react-force-graph-3d` (picking and camera easing, nodes pinned), `phaser` (five canvas
  encounters only — stages 03, 12, 14, 18 and the 04→06 span; re-derived from the
  real curriculum, `GAME-DESIGN.md` §10.3), `codemirror` (stages 10-11, the x86 listings). Each is **lazy-loaded per
  route** and none may enter the initial bundle. See `GAME-DESIGN.md` §10.
## Local stack — production runs here until cloud projects exist

```bash
pnpm db:up      # Postgres 16 in Docker on :15432
pnpm db:reset   # drop, recreate, apply all SIX SQL files, run invariants
pnpm dev:api    # the API on :8090, configured for LOCAL auth  <- not `pnpm dev`
pnpm test:rls   # the 38-test denial suite
pnpm verify     # typecheck + tests + invariants
```

**`docs/LOCAL-STACK.md` has the detail, and you will need it.** Three things
that cost hours each and are not guessable: the raw API dev script boots from
`.env` and fails three ways that all look like app bugs (use `pnpm dev:api`);
**ports 8080 and 5173 belong to other projects on this machine** and both answer
200, so "the port is up" proves nothing; and the SQL apply order is **six files**
— omitting `addendum-submissions.sql` silently drops 40% of the grade.

**`local-bootstrap.sql` is LOCAL ONLY** — it supplies the `auth` schema and the
three roles Supabase provides. Against a real project it would shadow them and
every RLS test would become a lie.

## Delivery — read `docs/DELIVERY.md` before deploying or committing

- **Ships to** `github.com/Shaloh69/Octalysis---A-new-way-of-Learning`, branch **`main`**.
  Work on `main` and push to `main`. `shaloh-build` is gone — it existed for eighteen commits
  while `main` sat on the P0 skeleton, and every host defaults to `main`: Vercel and Render each
  built the skeleton, failed differently, and cost an hour between them.
  The repo OCTA *replaces* is `CodenameTempest14/Computer-Systems-Interactive-Lecture-Companion-`,
  whose `src/data/lessonData.js` shipped every answer to the browser. That is the bug this project
  exists to fix; it is not a dependency and nothing is merged from it.
- **Everything is on a free tier:** Vercel Hobby ×2, Render Free ×1, Supabase Free ×1.
- **Render Free has no cron jobs.** Every scheduled job — unlocks, nightly `item_stats`, invariant
  runs, keep-alive — runs on **Supabase Cron (`pg_cron` + `pg_net`)**. Never write a Render Cron.
- **Supabase Free has no backups and pauses after 7 days idle.** Backup is a scheduled `pg_dump`
  you own, and it is not real until you have restored it once.
- **Alpha = complete skill tree, partial content.** Definition and exit criteria in `DELIVERY.md` §3.

## The skill tree

The tree is not a visualisation of the curriculum — it **is** the curriculum. `stages.prereq` is
the only edge list; nothing about the map may be authored twice. The 3D galaxy is a presentation
layer. `/app` is the 3D map and is the student's default; `/app/map` is a flat, fully
keyboard-operable route that is always available and is never a degraded mode. A `<canvas>` has no
accessibility semantics, so reduced motion, absent WebGL and small viewports fall back to the flat
presentation — **in place, on the same route, without redirecting.**
**`docs/VISUAL-SYSTEM-3D.md` §5's degradation ladder owns this rule; every other document points
at it.** (R0 ruling, 1 Sep 2026: four documents each restated a redirect the app has never done,
and the app's degrade-in-place answer is the better one. `docs/PROGRESS.md` F-5.) See `docs/SKILL-TREE-3D.md` and `docs/GAME-DESIGN.md` §2.

## Structure of the domain

- **Stage** — one chapter of the syllabus. Has an `archetype` (A concept / B computation / C artifact /
  D simulator) that determines its beat sequence. See `docs/LESSON-PLAN-AND-LEVELS.md`.
- **Level** — abstraction level 0–6 from the Computer Level Hierarchy. Progression is *depth*,
  not points.
- **Competency** — `read` | `trace` | `build` at a given level. 7 × 3 = 21 cells. This replaces XP.
- **Bring-Up** — a subsystem coming online on stage completion. One celebration per stage, no more.
- **Act == grading period.** Four of them: Prelim (ch 1-4), Midterm (5-8), Semi-finals (9-12),
  Finals (13-17). This is a change: acts used to be a narrative arc.

## Toolchain

CPE 412's prerequisite is **Microprocessors**, so 8086 assembly is assumed knowledge rather than
taught here. Where the course shows listings (chapters 10 and 11) they are **Intel x86**, matching
the textbook.

`docs/TOOLCHAIN-CORRECTION.md` documents the TASM decision for the SUPERSEDED course. Its rule
still stands if assembly tooling is ever bundled: never ship `TASM.EXE` or `TLINK.EXE`, they are
proprietary (Embarcadero).

## Design mandate

**A control exists only if pressing it changes what the student knows, can do, or can see. If it
only changes a number, delete it.** Four tests in `docs/DESIGN-MANDATE.md` §1 — consequence,
legibility, reversibility, teaching. Before writing JSX for any page, list its controls and state
which tests each passes.

## Design

Colors, type, spacing, and motion come from `packages/tokens`. **Never write a literal hex outside
that package** — a hook blocks it. Three base themes (`bare-metal`, `blueprint`, `phosphor`) plus a
per-student accent derived in OKLCH from a stored hue, not a stored hex.

On top of those sit **eight encounter themes** (`GAME-DESIGN.md` §9) — each is four tokens and a
nine-slice panel, never a redesign. They dress the LAB beat and never an assessment, and they are
held to the same computed AA contrast on all three base themes.

Type roles: display `Space Grotesk`, body `Inter`, mono `JetBrains Mono`. All numbers, register
values, hex, machine code, and assembly listings render in mono.

Motion: one orchestrated moment per stage. Respect `prefers-reduced-motion`. Incorrect answers get
a neutral response — never red, never a buzzer, never a shake.

## Where we are

**Say the phase out loud, every session.** The redesign runs R0–R5 in
`docs/redesign/phases/`; `docs/PROGRESS.md` records which one is live and what
has landed in it. Name the phase and the sub-item when you start, tick the phase
file's box **in the same commit as the work**, and name what the phase still owes
when you finish.

This is a rule because the project has drifted repeatedly: `PROGRESS.md` claimed
"R2 complete, R3 next" for sessions after R3 had started; R3's checklist sat at 0
of 44 while eight of its routes were reworked and committed; R0/R1/R2 sat at 0 of
85 while all three were called complete. Full rule: `REDESIGN-CLAUDE.md` §2b.

**Give a phase report, every session.** Run `pnpm phase` and show the output —
at the start, and again before you finish. It counts the R0–R5 checkboxes from
`docs/redesign/phases/*.md` and reads the P0–P10 statuses from `docs/PHASES.md`,
so the numbers cannot drift from the files the way a remembered figure does.
`pnpm phase --open` lists every open box when you need the detail.

This is a rule because a report you compose from memory is how the project lost
track twice. A report that is counted costs one command.

**Every phase report carries the percentage.** `pnpm phase` already prints
`126 done · 45 to-do (171 items, 74%)`. Say the percentage out loud in the
report, at the start and before you finish, alongside the live phase. A phase
name without a number is how "nearly done" survived three sessions of not being
nearly done.

**Say what is safe to put in front of students, every session.** The sentence is
literal and it is about the Prelim:

> *Prelim-worth of data is okay to run on students, to use and to grade against.*

That claim is true only when all of it holds, and you check it rather than
remember it:

- stages 00–04 authored and readable
- act 1's items **approved to `live`** — 96 of them; the engine samples
  `where status = 'live'` and an unapproved bank fails to fill at Start
- the Prelim and the four stage checks fill — `bank-feasibility.spec.ts`
- a real student can read a stage, sit its check, and see the next unlock
- `db-invariants` clean against the deployment students will use

If any part is untrue, say which part, and do not round it up. Everything past
the Prelim — the Midterm, acts 3 and 4 — is **not** covered by that sentence
and must not be implied by it.

**When context management is about to kick in, COMMIT AND PUSH FIRST.** Not
commit — commit *and push*. The moment you notice the context is being
summarised, or you are told it is, stop and get the work to `origin/main` before
anything else. A summary carries what you learned; it does not carry an
uncommitted working tree, and it does not carry a local commit to a host that
builds from GitHub.

This is not optional tidiness. Render and both Vercel projects build from
`main`, so an unpushed commit is work that exists on one laptop and nowhere the
deployment can see. This session found a Render deploy sitting on a commit from
ten commits back for exactly that reason.

Commit in logical pieces with real messages, push, and say the range you pushed.

**Templates are ARTIFACTS, never links.** A row in `TEMPLATE-LINKS.md` naming a
URL is a lead, not a template. Before a route is rebuilt, its reference must be
captured into `design/templates/<app>/<route>/template.png` with a `SOURCE.md`
recording the URL, the capture date, the HTTP status and what actually rendered.

A link rots, redirects, paywalls, or renders only with JavaScript that did not
run. "The link is in the doc" has never once been enough to compare a page
against. If a link cannot be captured, find a replacement **before** building,
and record why the original was rejected.

Verify the artifact by opening it. A 200 and a saved PNG prove a file exists,
not that it shows the thing you needed.

**Against context degradation** — §2c, with the rules that matter most here:
verify a claim before repeating it, check the stack is alive (and is the right
app) before believing a red run, measure on real data and say which state you
measured in, and trust the code over the docs when they disagree.

**On stopping** — §2d. Default is to keep going: name the phase, do the work,
record it, continue. Stop only for a genuinely ambiguous reading, an
instructor's call, something irreversible, or a rule that would have to be
broken.

## THE HARDEST RULE: SCREENSHOT IT WITH PLAYWRIGHT, THEN OPEN IT AND LOOK

**This outranks every other rule in this section.** No page, panel, dialog,
biome, minigame, console view or icon is implemented until it has been captured
with Playwright **and the image has actually been viewed** — every page, every
iteration, at **1440 and 380**.

**A green spec is not seeing.** A passing assertion, an exit code of 0, a
written file and a printed "ok" are all claims about a process, not evidence
about a picture. Read the image back. Every time.

This is the hardest rule because it is the one that keeps catching things
nothing else does. In this project, from real runs:

- `/items` shipped with its **action column clipped mid-word**. Every test was
  green. A screenshot showed it in one second.
- Type-G ordering items rendered as **radio buttons** and were graded wrong 100%
  of the time. 396 API tests passed throughout; the API accepts `{order}`
  perfectly well. Only the runner screenshot revealed it.
- `apps/web` renders **browser-default purple links** because `styles.css` has
  no base `a { }` rule. No test asserts link colour.
- The first `icon.svg` was written successfully, the script printed `ok`, and
  the file rendered as a **broken-image glyph** — a double hyphen is illegal
  inside an XML comment. The file existed. It was malformed.
- An icon preview came back **entirely blank** because the route interception
  was registered after `setContent`. The command still exited 0.

Corollaries, each learned the same way:

- **Capture, then read the file.** Writing a PNG proves a file exists, not that
  it shows what you needed. The same applies to a template captured from a URL.
- **Confirm you are looking at the right app.** 5173 and 5174 belong to other
  projects on this machine and both answer 200 with an `<h1>`.
  `design/global-setup.ts` checks the page title for exactly this reason.
- **Re-capture after a deploy.** A bundle fetched mid-redeploy is a stale
  artifact, and this session chased a fixed bug because of one.
- **Never report a page works on the strength of a passing spec alone.** Say
  which screenshots you looked at.

## AUDIT EVERY PAGE AGAINST ITS SPEC — THEN ASK, NEVER ASSUME

**This applies to every page already built, not only to ones being rebuilt.**

Before touching a route, read what it was supposed to be:
`docs/PAGE-SPECS.md` for its row, plus `GAME-DESIGN.md`,
`LESSON-PLAN-AND-LEVELS.md` or `SOLAR-SYSTEM-SPEC.md` where they own part of it.
Then compare against what exists. The gap is the finding.

Measured 25 Sep 2026: **`PAGE-SPECS.md` specifies 42 routes; 27 distinct routes
are built** — 13 in `apps/web`, 16 in `apps/console`.

**Reconcile names before declaring anything missing.** `PAGE-SPECS.md` writes
console routes with a `/console/` prefix; the console app is mounted at root, so
`/console/roster` IS `/students`, `/console/students/:id` IS
`/students/:userId`, and `/console` IS `/`. Those are naming drift, not gaps,
and building them again would produce a duplicate of a page that already works.

**Genuinely absent — zero references anywhere in the source:**

- student app: `/app/notebook`, `/app/mistakes`, `/app/final`, `/app/help`,
  `/app/live`, and `/app/lab` with its three simulators `asm`, `cache`, `fde`
- public and auth: `/404`, `/500`, `/about`, `/accessibility`, `/course`,
  `/for-teachers`, `/how-it-works`, `/forgot-password`, `/reset-password`
- console: `/console/analytics`, `/console/settings`, `/console/items/:id/edit`

Some are deliberate — the public marketing site is owned by no phase, and
`/console/analytics` is documented as blocked until items have 30+ exposures.
The rest are not recorded either way, and nobody can currently tell which is
which. That is the problem.

When a planned feature is missing from a page, or a planned page does not exist:

1. **Say so.** Name it, and name the document that planned it.
2. **Plan it** — what it does, the data it needs, the controls it owns.
3. **Find a template for it** and capture it as an artifact, per the
   templates-are-artifacts rule.
4. **Stop and ask for approval before building it.**

**Do not build it unasked, and do not skip it silently.** Both are failures, and
the second is worse: an unbuilt feature that nobody wrote down becomes a feature
nobody remembers was intended. A deliberate deferral is a fine answer — it just
has to be *recorded* as one, with its reason, rather than left as an absence.

This is how `/console/analytics` stayed honest: `apps/console/CLAUDE.md` names it
as not built and says why — `item_stats` cannot say anything true until items
have 30+ exposures. That is the standard. Match it.

## THESE RULES ARE NOT A REVAMP PROTOCOL — THEY GOVERN ALL PAGE WORK

**The revamp is the first application of these rules, not their scope.** They
apply, permanently and in full, to:

- **a new page** — it is born with a `template.png`, a `SPEC.md` and a spec, and
  it does not merge until that spec is green
- **a change to an existing page** — same gate, on the page you touched
- a revamp pass

The rules are the gate below, REDO/REPLACE, templates-as-artifacts, and the
toasts / loading / transitions in `.claude/rules/design.md`.

**The one narrow exemption**, and it is narrow on purpose: a change that alters
no structure, layout, control or state — a copy fix, a typo, a comment, a
data-only change — needs no new template capture. It still must leave that
route's existing spec **green**, and you must say you ran it. "It was only
copy" is how a layout regression ships.

If a page has no spec yet and you are touching it, **you are the session that
gives it one.** That is not scope creep; it is the price of changing a page
nobody can verify. Every defect this project has shipped — the clipped action
column, unstyled purple links, an ordering item that was unanswerable and graded
wrong every time — reached production through a page with no spec behind it.

## ONE SESSION, ONE ROUTE — AND EVERY SESSION WRITES THE NEXT ONE'S PROMPT

A page-work session does **only** the route its prompt names. A defect found on
another page is written into `docs/NEXT-SESSION.md` and left alone — fixing it
"while you're there" is how a session ends with two half-done routes.

**The session's last act is rewriting §1 of `docs/redesign/REVAMP-PROMPTS.md`**
for the session after it: the next route in order, what this session learned
that the next one needs, anything parked, current phase figures. Committed and
pushed. The prompt is the handoff. A chat transcript does not survive a `/clear`
and must never be the only place something was written down.

**The first release is act 1 as the full experience** — stages 00–04, rebuilt
pages, planet zoom, Keplerian orbits, moons on planets 00–04, and the act-1
minigames. `REVAMP-PROMPTS.md` §4 owns the scope; R4.5 tracks it.

## NEVER PROCEED TO ANOTHER PAGE IF THIS ONE HAS NOT PASSED

**One route at a time, and the gate is the spec, not your judgement.**

`design/specs/<app>-<route>.spec.ts` must be green on all six assertions, at
1440 **and** 380, before a single line is written for the next route. Not
"mostly green". Not "green except the one I know about". Green.

If a route cannot pass, that route is the work — say what is blocking it and
stop. Do not open another file to make progress feel better. A batch of
half-finished routes is exactly how R3 reached 41 boxes with an empty
`design/templates/`, and it is why a clipped action column and unstyled purple
links both reached production unseen.

Report per route: which of the six assertions you ran, which you assumed, and
the screenshots. Then stop and let the instructor look.

## REDO THE PAGE. DO NOT IMPROVE IT.

**This is the largest rule in the revamp and it overrides the instinct to be
conservative.** When a route is in the revamp, you are authorised to delete its
JSX and its styles and build the page again from `template.png` and `SPEC.md`.
You are not patching. You are not nudging spacing. You are rebuilding.

Improving a broken page preserves the decisions that broke it. `apps/web`'s
`styles.css` styles anchors inside `.app-nav` and `.encounter` and **nowhere
else**, so every `<Link>` on `/app` renders browser-default purple. No amount of
improvement finds that; rebuilding from a reference does, immediately, because
the reference has no purple links in it.

**Rebuild:** layout, markup structure, class names, styling, spacing, hierarchy,
motion, and which element is a heading versus a div.

**Carry over, deliberately and by reading the old code first:** the data it
fetches and from where, the route contract, every control the page legitimately
offers, and any accessibility property already proven good — `/app/map` being
real focusable DOM rather than a canvas is a hard-won property and must survive.

**The old page is a requirements document, not a starting point.** Read it to
learn what the page must do. Then close it and build.

**YOU MAY REPLACE A PAGE ENTIRELY.** Not a refactor — a replacement. Delete the
component, write a new one, pick a different layout, a different component
structure, a different interaction. The only things that bind are the ones that
were always binding: `packages/tokens` for every colour, type size, space and
duration; the three themes at AA; keyboard-only operation; 380px with no
horizontal scroll; the eight hard rules; and the data and controls the route
legitimately owes its user.

Inside those, you have a free hand. Do not ask permission to throw a page away.

A route is finished when its spec is green, not when it resembles what was
there before.

## The revamp — console first, then the student app

`docs/redesign/CONSOLE-REVAMP.md` runs first, `docs/redesign/WEB-REVAMP.md`
second. Both are tracked as R3 boxes, so the phase report counts them.

`WEB-REVAMP.md` also owns three things the map never had: **planet selection
with a camera zoom** (§3), **orbital motion that follows Kepler's third law**
(§4 — `ω ∝ a^-1.5`, circular orbits kept so radius still means level), and the
**shared icon** at `packages/tokens/icon.svg` (§5). Moons are R4 and land with
the zoom, never before it.


Both apps need it. `apps/web` is barely finished: intended features missing,
layouts wrong, theming wrong. It gets the **same treatment**, in the same shape,
and it goes **second** — `docs/redesign/CONSOLE-REVAMP.md` §8 carries its order.

Do not start the student app while a console route is unfinished. The whole
point of the gate is that one surface reaches a known state before attention
moves, and R3 reaching 41/49 with an empty `design/templates/` is what happens
otherwise.

## Console revamp — one page at a time

`docs/redesign/CONSOLE-REVAMP.md` owns this. Sits under R3; opens no new phase.

Each console route gets its own folder under `design/templates/console/<route>/`
holding `template.png`, `SPEC.md`, `current.png`, `current-380.png` and
`motion.md`, plus a spec at `design/specs/console-<route>.spec.ts`.

**The reference comes before the rebuild**, and **no route starts until the
previous route's spec is green.** The specs assert structure, never pixels — the
colours are ours by design, so a pixel diff against a third-party template can
only ever fail. Six assertions per route, at 1440 and 380: nothing clipped, no
horizontal page scroll, keyboard reachable, AA contrast computed on all three
themes, tokens actually used in the rendered output, and
`prefers-reduced-motion` honoured with the media feature emulated.

`design/templates/` sat empty through all of R3, which is why a clipped action
column shipped to production unseen.

## Definition of done

Compiles under strict TS · tests pass including at least one denial test if it touches data · RLS
implications stated out loud · works keyboard-only · works at 380px · and you have said which of
these you actually verified versus assumed.
