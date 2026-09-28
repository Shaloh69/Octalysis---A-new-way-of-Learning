# REVAMP-PROMPTS.md
### The prompts for the revamp sessions — paste one, get one route

The revamp is deliberately many small sessions, not one large one. Each session
takes **one route**, rebuilds it, proves it, **rewrites §1 of this file for the
next session**, and stops. §1 is therefore always the prompt to paste next — it
is updated by the session before yours, not by hand. That is the whole
method, and it exists because the alternative already happened: R3 reached 41
boxes with `design/templates/` empty, and a clipped action column and unstyled
purple links both reached production unseen.

**Order:** every console route (`CONSOLE-REVAMP.md` §3) → every student route
(`WEB-REVAMP.md` §6) → moons for planets 00–04 (R4) → the act-1 minigames. Each
minigame is a page like any other: one session, one gate.

**Milestone: the first release is act 1 — stages 00–04 and the Prelim — as the
full experience.** Rebuilt pages, planet zoom, real orbits, moons and the act-1
minigames, so students use the finished product while 05–18 are built. §4 has
the scope, what exists today (very little), and the two blockers that are not
design work at all.

---

## 1. Start here — the next session: `/feedback`

*Rewritten 28 Sep 2026 by the `/system` session, which rebuilt `/system` as
every invariant named with what it protects, counts and never a verdict, a
notice only when the table a check reads is empty, and the nightly runs read
back, on the instructor's rulings of that day. Phase at handover: **R3 live at
54 / 73 (74%)**; all tracks **141 done · 70 to-do (211 items, 67%)**.
`pnpm phase` is the count, not this line.*

> Read `docs/redesign/CONSOLE-REVAMP.md` and `docs/redesign/WEB-REVAMP.md` in
> full, then root `CLAUDE.md`'s revamp rules, then **`docs/NEXT-SESSION.md`
> §0a to §0l** (what the `/items`, `/signin`, `/locks`, `/students`,
> `/students/:userId`, `/assessments`, `/submissions`, `/gradebook`, shell,
> `/content`, `/audit` and `/system` sessions parked). Do not re-derive what
> those carry.
>
> Run `pnpm phase`. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in `CLAUDE.md` rather than remembering them.
> (On 28 Sep it was NOT. Locally: stages 00-04 had 112 content blocks, but all
> 96 act-1 items sat at `review`, 0 live, so no paper can be filled and every
> Start answers 500 (§0e.1); `/system` now says so itself: INV-18 is a
> WARNING, 0 of 40 live items for the Prelim and the Midterm. Stage 01 was open
> for 0 of 24 demo students (§3a decided, not built); `run_invariants()` had 0
> failing and 4 warnings (INV-18, 25, 27, 29); 0 of 19 planet summaries
> approved. The DEPLOYMENT was last measured on 28 Sep: **0 content blocks for
> 00-04 and 0 items at all** (§0h.1), and its `/content` AND `/audit` answer
> 500 until the schema is pushed (§0j.1, §0k.1); `/system` should not (§0l.5).)
>
> **Confirm the finished routes are still green before touching anything,
> AGAINST A BUILD, not the dev server** (§0j.2). `pnpm --filter @octa/console
> build`, then `npx vite preview --port 5185 --strictPort` from `apps/console`
> in the background (a running preview indexes `dist/` at start, so rebuild
> AND restart it after a change), then `OCTA_WEB_URL` and `OCTA_CONSOLE_URL` =
> `http://localhost:5185` and `npx playwright test design/specs/console-*.spec.ts`.
> On 28 Sep that gave **611 passed, 55 skipped, 0 failed** (666 tests). **Read
> the skips** with a JSON reporter: they are width-specific by design
> (including `console-student-detail.spec.ts`' real-attempt test, which skips
> because no paper can be filled, §0e.2), and a skip count that MOVES is a
> finding (§0l.6). **A full run writes to the database: reset and re-demo
> before running it again** (§0l.6). If anything is red, that is this
> session's work, and a red is real until proven otherwise.
>
> **THIS SESSION IS ONLY FOR `/feedback`** (`apps/console/src/pages/FeedbackPage.tsx`,
> 299 lines, reading `GET /api/v1/console/feedback` and triaging through
> `PATCH /api/v1/console/feedback/:id`, both in `services/api/src/routes/feedback.ts`;
> the GET takes `status` and `channel`, is capped at **300 rows**, and returns
> only a SUS mean). NOTHING ELSE. Not `/live` (next), not `/attempts/:attemptId`
> (last; §0e.3), not the shell or any finished route, not the student app
> (its `FeedbackWidget.tsx` included), not §0e.1, §0f.1, §0g.1, §0h.2,
> §0j.3-7, §0k.3-4 or §0l.1-4. If you find a defect on another page, write it
> down in `docs/NEXT-SESSION.md` and leave it. The last thing this session
> does is rewrite this prompt for the next one.
>
> 1. Bring the local stack up: **`docker ps` first**, `pnpm db:up`, then
>    **`pnpm db:reset && node scripts/db-demo.mjs`**, `pnpm dev:api` on 8090,
>    `pnpm dev:token` for a session; the dev console on 5184 is for LOOKING.
>    5173 and 5174 belong to other projects. If 8090, 5184 or 5185 already
>    answer, confirm they are OURS (the process command line, and the page
>    title "OCTA Console"). A reset KILLS the dev API (§0c.1, seen three times
>    on 28 Sep): **prove it with a staff GET, not `/healthz`** (§0e.7), and
>    restart it. **After ANY API test run, reset and re-demo.**
> 2. **Audit against the plan FIRST.** `PAGE-SPECS.md` **§4.4** is the plan:
>    two tabs, **"My feedback"** (what this teacher submitted, with a status and
>    a "Released in" badge) and **"All feedback"** (admin only: triage `new →
>    triaged → in progress → shipped | won't fix`, auto-dedupe by route and
>    text, severity, filters by channel, route, role and version, a **SUS
>    trend**, **Export CSV**). §4.1 (the console's contextual flag, "present on
>    every page") and §4.2 (the inline content report, which "routes straight
>    into the `/console/items` review queue") say where rows come from; check
>    whether the console flag exists at all (on 28 Sep `"flag"` appeared in
>    `apps/console/src/lib/api.ts` and in the STUDENT app's `FeedbackWidget.tsx`,
>    and nowhere in the console's shell). `TEMPLATE-LINKS.md`'s row says only
>    "Two-tab layout, standard; shadcn-admin's tabs pattern". The seed has **11
>    rows: 4 flags (triaged), 5 content reports (new), 2 CSAT (shipped), 0 SUS**,
>    and **all 5 content reports lack their item or variant: they are INV-25's
>    offenders**, so the page's promise, "the exact instance the student saw",
>    has never been seen on real seeded data. Things to decide rather than
>    assume: the 300-row cap (the `/audit` session replaced the same cap with
>    server filters and Load older); what "admin only" means when the console
>    has teachers; whether dedupe, severity and "Released in" are wanted now;
>    SUS with 0 responses (§4.3: aim for 20, and say n plainly). **Plan what is
>    missing and ask before building it**, with a recommended option and what
>    each costs. Triage is a write: every status change writes `audit_log`
>    with an actor (check that the PATCH does).
> 3. **Capture the reference** into `design/templates/console/feedback/`
>    (exists, empty). Look for a purpose-built feedback inbox or triage block
>    as well as shadcn-admin's tabs. shadcn.io's `/view/...` previews open a
>    **guided tour whose scrim greys the block under a 200: click "Skip tour"**
>    (§0l.7), and they centre tall blocks, so capture at **1440×1500 and
>    380×1900** (§0k.7). **Open every PNG.** Write `SOURCE.md` and `SPEC.md`;
>    update the `TEMPLATE-LINKS.md` row.
> 4. **Specs.** `design/specs/console-live-feedback.spec.ts` already covers
>    `/feedback` AND `/live` (258 lines): **extend, never overwrite**, and
>    leave its `/live` tests alone. Put `/feedback`'s six gate assertions at
>    1440 and 380 (assertion 6's positive control through `motionStarted()`)
>    and what the approved plan owes in a new `console-feedback.spec.ts`. A
>    fixture that patches the REAL response for the states the seed lacks (a
>    content report WITH its resolved variant, a SUS response); build a patched
>    state with the API's own function where one exists, as
>    `_system-fixture.ts` does (§0l). If anything new reaches the API, a
>    **denial test first** (a student token refused), watched failing; an RLS
>    denial watched failing by breaking the policy, as `rls.spec.ts`' header
>    says. Use `getByLabel(…, { exact: true })` (§0k.6). Watch the spec fail
>    before the rebuild.
> 5. **Rebuild the page.** Not improve: rebuild. Toasts (a triage change is a
>    server write: one toast, what happened to what), loading (nothing under
>    400ms, a skeleton after, words after 3s at the TOP of the skeleton),
>    transitions per `.claude/rules/design.md`. `<main>` is **70rem** at 1440;
>    choose any table/list breakpoint on the page's own width. **A sideways
>    scroller counts as clipping** (`_gate.ts`): a wide table becomes a list,
>    it does not scroll.
> 6. Capture `current.png`, `current-380.png` and state shots against seeded
>    data (a capture script under `node --experimental-strip-types` can
>    import the spec's fixture by `file:///` URL; import `.ts` files with
>    their extension so it loads). At 1440 `<main>` scrolls, not the document
>    (§0i.8): size the viewport to main's CONTENT. A 380 page thousands of
>    pixels tall cannot be read in one view: **crop it into slices and read
>    them**. **Open every one and look.** Write `motion.md`. Run EVERY console
>    spec against the build, and the whole API suite if the API changed. Then
>    `git checkout -- design/item-review/`.
> 7. Tick `/feedback` under the R3 "Console revamp" box in the same commit as
>    the work. Commit with explicit paths, messages from a file (`git commit
>    -F`). Commit and push.
> 8. **Rewrite §1 of `docs/redesign/REVAMP-PROMPTS.md` for the next session**
>    (`/live`), carrying forward what this session learned. Update the phase
>    figures. Commit and push that too.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and **end your last message with the rewritten §1 prompt in
> one fenced code block, plain text with no `> ` markers, ready to copy and
> paste**. Then **stop**. Do not start the next route.

**What the `/system` session learned that every later route needs:**

- **A page can hide the most important fact it has.** `/system` filed "the
  Prelim has 0 of 40 live items" under *notices, expected while the bank is
  authored*, because the API relabelled four checks whenever they had
  offenders. Measure what the page says on the seeded data, not what its
  comment says it does. The same unconditional rule lives on in the nightly
  cron and `db-invariants.mjs` (§0l.1).
- **Words about the data belong in ONE place the API owns, kept complete by a
  test.** The 28 check descriptions are a catalogue in
  `services/api/src/audit/invariants.ts`; `console.spec.ts` fails if
  `run_invariants()` returns an id it does not describe.
- **A test that pinned the old lie goes red when the lie is removed.** "Zero
  structural failures" had passed only because INV-28 was relabelled; the fix
  was to state the fixture's truth, not to restore the relabel (§0l.2).
- **Watch a denial fail even when the guard already exists**: remove
  `requireStaff` for one run, or break the policy and reset, then restore.
  A stub of the OLD behaviour makes new tests fail on their assertions, not
  on a missing module.
- **jsonb reorders keys** (by length): a sample's columns are not in the
  function's order (§0l.3). Assert sets, not orders, of anything through jsonb.
- **A verdict word can be a legitimate word.** The "no aggregate verdict"
  check first banned "score", and INV-24 protects the usability score. Ban
  the verdict's phrasing, not the noun.
- Still true from every earlier route: show the picture early; at 1440
  `<main>` is the scroller; read the API behind a page; a fixture uses the
  seed's real states; never slice a patched page back to its limit; a red
  only a full run shows is still red; a test that cannot fail is not a test;
  `wasDenied()` counts any error, so assert the outcome; the console's
  spacing scale is the token scale; look at the picture, even when green.

---

## 2. Continue — every session after the first

> Continue the revamp per `docs/redesign/CONSOLE-REVAMP.md` (then
> `WEB-REVAMP.md` once the console is finished).
>
> Start with `pnpm phase` — table, percentage, live phase — and the
> Prelim-readiness sentence.
>
> **Confirm the previous route's spec is still green before touching anything.**
> If it is red, that is this session's work and the next route waits.
>
> Then take the next route in order and do the same six steps: capture and
> **verify** the reference first (open the file and look at it — a 200 and a
> saved PNG prove a file exists, not that it shows what you needed), write
> `SPEC.md`, write the spec and watch it fail, rebuild — replacing entirely if
> that is the right answer — then capture `current.png` and `current-380.png`
> and **open both and look at them**, then write `motion.md`.
>
> **Check `design/specs/` before writing a spec.** 18 already exist. If the route
> has one, EXTEND it — the REDO rule licenses replacing the *page*, never the
> proof that it works.
>
> Toasts, loading states and transitions are required, not optional.
>
> **THIS SESSION IS ONLY FOR THAT ONE ROUTE.** Defects found elsewhere go into
> `docs/NEXT-SESSION.md`, not into this session's diff.
>
> One route. Screenshots, spec output, assertions run versus assumed. Tick the
> box in the same commit. Commit and push.
>
> **Then rewrite §1 of this file for the session after you** — the next route,
> what you learned, updated phase figures — and commit and push that. Stop.
>
> If a route needs a decision that is the instructor's — a lock policy, what a
> control should do, anything that changes what a student sees — stop and ask
> rather than choosing.

---

## 3. The rules that bind every one of these sessions

**And not only these sessions.** Root `CLAUDE.md` says it plainly: the revamp is
the first application of these rules, not their scope. A **new page** is born
with a template, a `SPEC.md` and a spec, and does not merge until that spec is
green. **Changing an existing page** carries the same gate on the page you
touched. If the page has no spec yet, you are the session that gives it one.

The only exemption is a change that alters no structure, layout, control or
state — copy, a typo, a comment, data. Even then the route's existing spec must
be **green** and you must say you ran it.

Every one of these applies to **all pages already built**, not only to routes
in a revamp list — a new page, a page being changed, and a page being rebuilt
are all governed the same way.

None of the following is negotiable, and the first outranks the rest:

- **SCREENSHOT IT WITH PLAYWRIGHT, THEN OPEN IT AND LOOK.** Every page, every
  iteration, 1440 and 380. A green spec is not seeing — a passing assertion and
  an exit code of 0 are claims about a process, not evidence about a picture.
  Read the image back. It is the rule that caught the clipped action column, the
  ordering items rendered as radio buttons, the purple links, and an icon that
  wrote successfully and rendered as a broken-image glyph.

- **ONE SESSION, ONE ROUTE — AND IT HANDS OVER.** A session does exactly the
  route its prompt names. It ends by rewriting §1 of this file for the next
  session, committed and pushed. The prompt is the handoff; a chat transcript
  is not.
- **END WITH THE PROMPT, READY TO PASTE.** The session's closing message ends
  with the new §1 prompt in one fenced code block, as plain text with no `> `
  quote markers, so the user can copy it in one go. The full text, not a link
  and not a summary. Instructor ruling, 25 Sep 2026; root `CLAUDE.md` makes it
  a rule for every session, not only these.
- **NEVER PROCEED TO ANOTHER PAGE IF THIS ONE HAS NOT PASSED.** Green on all six
  assertions at both widths. Not "mostly". If a route cannot pass, that route is
  the work — say what is blocking it and stop.
- **REDO THE PAGE, DO NOT IMPROVE IT.** The old page is a requirements document.
- **YOU MAY REPLACE A PAGE ENTIRELY.** Different layout, different structure,
  different interaction. Bound only by `packages/tokens`, the three themes at
  AA, keyboard-only operation, 380px without horizontal scroll, the eight hard
  rules, and the data and controls the route owes its user. No permission needed
  to throw a page away.
- **Templates are artifacts, never links.** Capture, then open it and look.
- **Commit and push when context management kicks in.** Not commit — push. Both
  hosts build from `main`.
- **Audit the page against its spec before touching it.** Read its
  `PAGE-SPECS.md` row. A planned feature that is missing, or a planned page that
  does not exist, gets named, planned, given a captured template, and **brought
  to the instructor for approval** — never built unasked, never skipped
  silently. 42 routes are specified, 27 are built, and the console ones are
  written with a `/console/` prefix the app does not use — reconcile names
  before calling anything missing.
- **Every phase report is a table and carries the percentage.**
- **Toasts, loading states, transitions** — `.claude/rules/design.md`, on every
  page you create or change, not only revamped ones.

And the standing ones: screenshot before believing a page works; denial test
first for anything touching data; check the stack is alive and is the right app
before believing a red run; `pnpm verify` empties the seeded database, so reseed
before measuring.

---

## 4. The first release — the Prelim, as the full experience

**Decision, 25 Sep 2026 (instructor):** the first release is not a bare exam
with a map attached. It is **act 1, stages 00–04, playable as the finished
product** — so students get the real OCTA while stages 05–18 are still being
built. Everything a student can touch in act 1 works the way the whole course
eventually will.

### In the first release

| | Scope | State, measured 25 Sep |
|---|---|---|
| **Console** | every route the instructor needs to run act 1, `/items` first | **1/14** routes through the gate: `/items`, 25 Sep 2026 |
| **Student routes** | the attempt runner, the stage reader, both maps, `/app/work`, login | rebuild pending (`WEB-REVAMP.md` §6) |
| **Planet selection, sidebar, ENTER JOURNEY** | select a planet → zoom → sidebar with a tiny summary and the objectives, over the planet's biome → ENTER JOURNEY → content over the same biome. The map canvas never carries a biome | not built (`WEB-REVAMP.md` §3) |
| **Planet summaries** | a tiny summary and the objectives, in the sidebar | **19 drafted, 0 approved**: live only once the instructor approves each |
| **Keplerian orbits** | the whole map, `ω ∝ a^-1.5` | not built (`WEB-REVAMP.md` §4) |
| **Moons** | **planets 01–04**: one per objective; each moon's journey is its own practice plus its minigame; **moons unlock the next planet** | R4; two decisions open (`WEB-REVAMP.md` §3.7) |
| **Minigames** | **the act-1 encounters, each living in the moon it teaches** (`WEB-REVAMP.md` §3.6) | **none exist** |
| **Toasts, loading, transitions** | every route above | on `/items` only; the toast component is shared from `apps/console` |
| **Icon** | both apps | done |

**The act-1 encounters** — `GAME-DESIGN.md` §10.3's table, keyed to the real
curriculum:

| Stage | Encounter | Built with |
|---|---|---|
| 01 · Introduction | Sort — classification | DOM |
| 02 · Computer Evolution and Performance | Drill — computed answer | DOM |
| 03 · Top Level View and Interconnection | Bus wiring — the shared bus visibly constricting is the lesson | **Phaser** |
| 04 · Cache Memory | Cache drill — `<input type=range>`, keyboard-accessible for free | DOM |
| after 04 | **The Descent** — memory-hierarchy platformer, unlocked on completing 04, paid off at 06 | **Phaser** |

**Measured: zero of these exist.** `apps/web/src/lib/encounters.ts` maps panel
*themes* to stages — skins, not games. Phaser is not installed. The "existing
Cache Tuner" `MINIGAME-PROPOSALS.md` refers to is not in the source. Every row is
new work.

Rules that bind them, from `GAME-DESIGN.md` §10 and root `CLAUDE.md`: Phaser is
**lazy-loaded per route and never in the initial bundle** (it is ~1 MB, four
times the entire 3D budget); a canvas encounter has no accessibility semantics,
so every Phaser game carries a keyboard path and a non-canvas fallback;
encounters dress the LAB beat and **never an assessment**; and they are pages
like any other — template, `SPEC.md`, spec, screenshot, gate.

**The Descent spans 04→06**, so its payoff lands in Midterm content. Stages 05
and 06 are authored, so it can be built — but whether it ships in the first
release or waits for the Midterm is **the instructor's call**. Ask before
building it.

### Not in the first release

Stages 05–18 as playable content, the Semi-final and Finals exams, the
remaining four approved minigames (Hazard Interceptor 14, Fault Line 18, Amdahl
500 17, Mnemonic Sprint 10→11), `/console/analytics`. Their planets still render
on the map — in orbit, correctly placed, honestly locked — so the map is whole
even where the course is not yet.

### Not design work, and still blocking — say this every session

1. **0 of 183 items are `live`.** The engine samples `where status = 'live'`, so
   every attempt fails to fill at Start. Act 1's 96 items must be approved,
   through `/items` — which is why `/items` goes first.
2. **Stage 00 gates stage 01 — DECIDED, not yet built.** The instructor ruled
   on 25 Sep 2026 that Orientation has no moons and that **a non-gradeable
   prerequisite never blocks**, so stage 01 is open from the start. Until
   `is_stage_unlocked()` is changed a real student is still told *"Unlocks when
   Stage 00 reaches 70%. You're at 0%."* The change is small, server-side,
   denial test first, and independent of the rest of moon gating (R4.6).

### Order

`/items` → approve act 1 → decide stage 00 → the rest of the console →
attempt runner → stage reader → flat map → 3D map with zoom and orbits →
**moons for 00–04** → **act-1 encounters, one per session like any page** →
`/app/work`, login → **ship act 1** → then 05–18.

Moons land with the zoom, never before it — moons on a map nobody can zoom into
are decoration.
