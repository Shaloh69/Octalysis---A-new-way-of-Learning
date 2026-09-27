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

## 1. Start here — the next session: `/audit`

*Rewritten 28 Sep 2026 by the `/content` session, which rebuilt `/content`,
built the block editor and summary review it had been planned to carry, and
added `/content/:stageId`. Phase at handover: **R3 live at 52 / 73 (71%)**;
all tracks **139 done · 72 to-do (211 items, 66%)**. `pnpm phase` is the
count, not this line.*

> Read `docs/redesign/CONSOLE-REVAMP.md` and `docs/redesign/WEB-REVAMP.md` in
> full, then root `CLAUDE.md`'s revamp rules, then **`docs/NEXT-SESSION.md`
> §0a to §0j** (what the `/items`, `/signin`, `/locks`, `/students`,
> `/students/:userId`, `/assessments`, `/submissions`, `/gradebook`, shell and
> `/content` sessions parked). Do not re-derive what those carry.
>
> Run `pnpm phase`. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in `CLAUDE.md` rather than remembering them.
> (On 28 Sep it was NOT. Locally: stages 00-04 had 112 content blocks, but all
> 96 act-1 items sat at `review`, 0 live, so no paper can be filled and every
> Start answers 500 (§0e.1); stage 01 was open for 0 of 24 demo students (§3a
> decided, not built); `run_invariants()` had 0 failing (4 warn-level with
> offenders); 0 of 19 planet summaries approved. The DEPLOYMENT was last
> measured on 28 Sep: **0 content blocks for 00-04 and 0 items at all**
> (§0h.1), and its `/content` now answers 500 until the schema is pushed
> (§0j.1).)
>
> **Confirm the finished routes are still green before touching anything,
> AGAINST A BUILD, not the dev server** (§0j.2: at 4 workers the Vite dev
> server drops module requests and a different 3-4 pages come up blank on
> every full run). `pnpm --filter @octa/console build`, then
> `npx vite preview --port 5185 --strictPort` from `apps/console` in the
> background (5185 is in the API's CORS list; a running preview indexes
> `dist/` at start, so rebuild AND restart it after a change), then
> `OCTA_WEB_URL` and `OCTA_CONSOLE_URL` = `http://localhost:5185` and
> `npx playwright test design/specs/console-*.spec.ts`. On 28 Sep that gave
> **508 passed, 52 skipped, 0 failed** (560 tests). **Read the skips**: most are width-specific by
> design (including `console-student-detail.spec.ts`' real-attempt test,
> which skips because no paper can be filled, §0e.2); `console-content.spec.ts`
> has one (its 1440-only split test). If anything is red, that is this
> session's work, and a red is real until proven otherwise: this session's
> reds were a fixture race, a spec race and the dev server, each proven with a
> trace or a repeat, never waved through.
>
> **THIS SESSION IS ONLY FOR `/audit`** (`apps/console/src/pages/AuditPage.tsx`,
> 222 lines, reading `GET /api/v1/console/audit` in
> `services/api/src/routes/console.ts`, which returns the newest 100 rows,
> 500 at most, and nothing older). NOTHING ELSE. Not `/system`, `/feedback` or
> `/live` (next, one per session), not `/attempts/:attemptId` (last; §0e.3),
> not the shell (done: the template's frame, a full-height 16rem sidebar, and
> `<main>` the ONLY scroller at 1440), not `/content` (done), not the student
> app, not §0e.1, §0f.1, §0g.1, §0h.2 or §0j.3-7. If you find a defect on
> another page, write it down in `docs/NEXT-SESSION.md` and leave it. The last
> thing this session does is rewrite this prompt for the next one.
>
> 1. Bring the local stack up: **`docker ps` first**, `pnpm db:up`, then
>    **`pnpm db:reset && node scripts/db-demo.mjs`**, `pnpm dev:api` on 8090,
>    `pnpm dev:token` for a session; the dev console on 5184 is for LOOKING.
>    5173 and 5174 belong to other projects. If 8090, 5184 or 5185 already
>    answer, confirm they are OURS (the process command line, and the page
>    title "OCTA Console"). A reset can kill the dev API (§0c.1): **prove it
>    with a staff GET, not `/healthz`** (§0e.7). **After ANY API test run,
>    reset and re-demo** (the suite empties the demo).
> 2. **Audit against the plan FIRST.** `PAGE-SPECS.md` `/console/audit`:
>    *"Every lock override, grade adjustment, item edit, roster change.
>    Immutable, filterable, exportable. If a grade is ever challenged, this is
>    the evidence."* Today it has a text filter and **no export**, and it can
>    never show a row older than the newest 500, so "the evidence" for an
>    October grade dispute is gone by December. Say what is missing and name
>    the document. Also: **this session's `/content` added three actions the
>    page has never seen** (`content.edit` with stage, ordinal, version and
>    reason; `summary.approve` with the approved text; `summary.send_back`
>    with the reason and `wasLive`); check how each renders. **Plan what is
>    missing and ask before building it**, with a recommended option and what
>    each costs (export shape and scope, paging or a date range, filters by
>    action / actor / target). Read-only and no delete control stay binding.
> 3. **Capture the reference** into `design/templates/console/audit/` (exists,
>    empty). `TEMPLATE-LINKS.md` says "Standard filterable log table,
>    shadcn-admin data table", the same dense reference `/items` and
>    `/submissions` used (`https://shadcn-admin.netlify.app/tasks`). Look for a
>    purpose-built activity or audit log as well; capture at 1440 and 380,
>    **open every PNG** (a 200 and a PNG prove nothing: Decap's demo answered
>    200 with only a Login gate, twice), and write `SOURCE.md` and `SPEC.md`;
>    update the `TEMPLATE-LINKS.md` row.
> 4. **Specs.** `console-audit.spec.ts` already exists (165 lines: dense
>    table, the reason never truncated, two views one log): **extend, never
>    overwrite**. Add the six from `_gate.ts` at 1440 and 380, assertion 6's
>    positive control through `motionStarted()`, and what the approved plan
>    owes. If anything new reaches the API, a **denial test first** (a student
>    token refused), watched failing. Watch the spec fail before the rebuild.
> 5. **Rebuild the page.** Not improve: rebuild. Toasts, loading (nothing
>    under 400ms, a skeleton after, words after 3s), transitions per
>    `.claude/rules/design.md`. `<main>` is **70rem** at 1440; choose the
>    table/list breakpoint on the page's own width.
> 6. Capture `current.png`, `current-380.png` and state shots against seeded
>    data. At 1440 `<main>` scrolls, not the document (§0i.8): size the
>    viewport to main's CONTENT for a full-page shot. **Open every one and
>    look.** Write `motion.md`. Run EVERY console spec against the build.
>    Then `git checkout -- design/item-review/`.
> 7. Tick `/audit` under the R3 "Console revamp" box in the same commit as the
>    work. Commit with explicit paths. Commit and push.
> 8. **Rewrite §1 of `docs/redesign/REVAMP-PROMPTS.md` for the next session**
>    (`/system`), carrying forward what this session learned. Update the phase
>    figures. Commit and push that too.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and **end your last message with the rewritten §1 prompt in
> one fenced code block, plain text with no `> ` markers, ready to copy and
> paste**. Then **stop**. Do not start the next route.

**What the `/content` session learned that every later route needs:**

- **"Mostly unbuilt" means the instructor rules first, in two rounds.** The
  first round settled WHAT (approval in the database; build the editor). The
  second settled the three things that change what students see (the sync
  rule, quotes read-only, where review lives). Both rounds came back at once
  because each option said what it costs.
- **Look for a column-level leak before adding a column.** RLS is per ROW.
  `stages` is readable by every student for a published stage, so a draft
  summary on `stages` would have been readable through supabase-js. It lives
  in a staff-only table, and a trigger guards the one column students read.
- **`wasDenied()` counts ANY error as a denial**, "relation does not exist"
  included. A denial on a new table must assert the outcome (zero rows and no
  error, or the named trigger message) with a positive control, and be
  watched failing twice: once before the table exists, once with the
  protection deliberately broken (a leaking policy, a disabled trigger).
- **Make history database-deep with a trigger**, not API-deep: sync, the API
  and a direct staff write are all archived. The API names the edit with
  `set_config(..., true)` GUCs, V-21's pattern.
- **A fixture's `route.fetch()` can fail the NEXT test** in its worker when a
  page reload outlives the test ("Test ended"): wait for the reload, or drop
  a read that outlives its test (§0j.5).
- **A preview must show what students see, including what is wrong.** The
  `/content` preview mirrors the student reader rule for rule, so its literal
  `##` headings and run-on lists are now visible to the instructor (§0j.3).
- **Git Bash rewrites a leading `/` in an argument into a Windows path**
  (`/content` became `C:/Program Files/Git/content`); pass routes without it.
- Still true from every earlier route: show the picture early; at 1440
  `<main>` is the scroller; read the API behind a page; a fixture uses the
  seed's real states; a red only a full run shows is still red; a test that
  cannot fail is not a test; the gate counts a sideways-scrolling element as
  clipping (so code wraps); preflight strips list markers; the console's
  spacing scale is the token scale; only the checked radio is in the Tab
  order; look at the picture, even when green.

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
