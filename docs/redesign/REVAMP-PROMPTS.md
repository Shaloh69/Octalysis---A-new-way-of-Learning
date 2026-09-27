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

## 1. Start here — the next session: `/gradebook`

*Rewritten 27 Sep 2026 by the `/submissions` session, the seventh console
route through the gate, which also closed a hole in the API it found on the
way: a GRADED submission could be re-marked in place by any staff token, with
no return and no reason. Phase at handover: **R3 live at 48 / 72 (67%)**; all
tracks **135 done · 75 to-do (210 items, 64%)**. `pnpm phase` is the count,
not this line.*

> Read `docs/redesign/CONSOLE-REVAMP.md` and `docs/redesign/WEB-REVAMP.md` in
> full, then root `CLAUDE.md`'s revamp rules, then **`docs/NEXT-SESSION.md`
> §0a to §0g** (what the `/items`, `/signin`, `/locks`, `/students`,
> `/students/:userId`, `/assessments` and `/submissions` sessions parked). Do
> not re-derive what those carry.
>
> Run `pnpm phase`. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in `CLAUDE.md` rather than remembering them.
> (On 27 Sep it was NOT: locally stages 00-04 had 112 content blocks but all
> 96 act-1 items sat at `review`, 0 live, so no paper can be filled and every
> Start answers 500 (§0e.1). Stage 01 was open for 0 of 24 demo students,
> because §3a is decided but not built. The DEPLOYMENT was not re-measured;
> on 25 Sep it had 0 items and 0 content blocks for stages 00-04 (§0d.1), and
> a read-only connection hung on 27 Sep (§0e.6).)
>
> **Confirm the finished routes are still green before touching anything**,
> with `OCTA_WEB_URL` and `OCTA_CONSOLE_URL` set to `http://localhost:5184`:
> `npx playwright test design/specs/console-*.spec.ts` gave **374
> passed, 44 skipped, 0 failed** on 27 Sep. **Read the skips**: 42
> are the same as before, width-specific by design (including
> `console-student-detail.spec.ts`' real-attempt test, which skips because no
> paper can be filled, §0e.2), and 2 are `/submissions`' own (its density
> bound and its empty pane are 1440-only). `console-submissions.spec.ts`
> alone is 56 tests at two widths. If anything is red, that is this
> session's work. One full run went red on 27 Sep with a positive control
> that passed alone: that race is fixed (`motionStarted()`, §0g.7), so a red
> is real until proven otherwise.
>
> **THIS SESSION IS ONLY FOR `apps/console` `/gradebook`. NOTHING ELSE.**
> Not `/content`, `/audit`, `/system`, `/feedback` or `/live` (next, #8), not
> `/attempts/:attemptId` (last; §0e.3), not the student app, not §0e.1's 500
> on Start, not §0f.1's feasibility cap, not §0g.1's database-deep freeze. If
> you find a defect on another page, write it down in `docs/NEXT-SESSION.md`
> and leave it. The last thing this session does is rewrite this prompt for
> the next one.
>
> 1. Bring the local stack up: **`docker ps` first** (Docker Desktop has
>    stopped three times), `pnpm db:up`, then
>    **`pnpm db:reset && node scripts/db-demo.mjs`**, `pnpm dev:api` on 8090,
>    console on **5184** (`pnpm --filter @octa/console dev --port 5184
>    --strictPort`), `pnpm dev:token` for a session. 5173 and 5174 belong to
>    other projects. If 8090 or 5184 already answer, confirm they are OURS (the
>    process command line, and the page title "OCTA Console"). **`db:reset`
>    kills the dev API** (§0c.1): stop it first, restart it after. **Prove the
>    API with a staff GET, not `/healthz`** (§0e.7). **After ANY API test run,
>    reset and re-demo**: the API suite wipes the seed.
> 2. **Capture the reference.** The sources disagree, so read all three:
>    `CONSOLE-REVAMP.md` §3 says *"KPI cards + chart"*; `TEMPLATE-LINKS.md`'s
>    `/console/gradebook` row says *"Standard data table + export —
>    shadcn-admin data table"*; `PAGE-SPECS.md` §`/console/gradebook` says
>    *"Per-stage mastery + final score. Weighting configuration. CSV / XLSX
>    export shaped for the university's format."* Capture what each names into
>    `design/templates/console/gradebook/` (the folder exists and is EMPTY) at
>    1440 and 380, choose, and record every rejected link and why. **Dismiss
>    any floating site control** before capture. A centred template can clip
>    itself at 380x900: capture taller and say so. `/submissions` found its
>    detail-pane reference by walking shadcn.io's `crud-*` family from a block
>    page's sibling links, and by trying shadcn-admin's own other pages (its
>    Inbox won): do the same. Open the PNGs and look; write `SOURCE.md` and
>    `SPEC.md`; put the URLs in `TEMPLATE-LINKS.md`. Colours and fonts are ours.
> 3. **Audit before building.** Read `GradebookPage.tsx` (177 lines: it
>    parses `GET /console/gradebook.csv` and `api.stages()`, and it imports
>    Recharts), the CSV route in `routes/console.ts`, its tests, and the lazy
>    import in `App.tsx`. Say which parts exist. Leads, NOT verified: nothing
>    in the gradebook reads `submissions`, so **the 40% (labs, project,
>    participation) is absent from it**; weighting configuration and XLSX
>    look absent; and when submissions are read, count `status = 'graded'`
>    only (a returned row keeps its old score, §0g.2) and normalise by
>    `max_score` (the seed's labs are out of 100, the console marks them out
>    of 4, §0g.3). Weighting is the syllabus's and may be an instructor's
>    call. Name each missing part, plan it, **and ask before building it**.
>    Specs: `console-teaching.spec.ts` already asserts gradebook things
>    ("exports, and names every gradeable chapter", "says what a low column
>    MEANS"). **Extend, never overwrite**; you are the session that writes
>    `design/specs/console-gradebook.spec.ts`.
> 4. **Recharts stays lazy-loaded.** It is about 105 KB gz and the gradebook is
>    the only route that imports it (`App.tsx`: "the gradebook is lazy, and it
>    is the only page that is"). A spec or a bundle check proves the initial
>    bundle does not carry it after the rebuild. A chart is not a table: every
>    number a chart shows must also be readable as text (mono), and follow
>    the `dataviz` skill if a chart is kept.
> 5. **Specs.** The six from `design/specs/_gate.ts`, with assertion 6's
>    **positive control read through `motionStarted()`**, never a one-shot
>    `recordedMotion`. Patch the real response for states the seed lacks
>    (`_submissions-fixture.ts` is the newest pattern: real rows keyed by
>    student ID + slug because row ids change on every reset, every write
>    intercepted AND replayed into the next list, a `fail` option). Watch the
>    specs fail first, and check the API is alive when they do. Any API change
>    leads with its denial test, watched failing.
> 6. **Rebuild the page.** Not improve: rebuild. Toasts, loading states and
>    transitions per `.claude/rules/design.md`. A dialog opened from state
>    returns focus through `onCloseAutoFocus` and a remembered opener. A menu
>    is `components/ui/dropdown-menu.tsx`, `modal={false}`. Numbers, counts and
>    dates in mono, and never inside a native `<option>` (§0f.5). A toast must
>    not cover the control that raised it, **including at 380, where the page
>    may already be scrolled to its end** (§0g.6).
> 7. Green on all six, both widths, plus the route's own structure tests.
>    Capture `current.png` and `current-380.png` against seeded fixture data
>    only, full page on a viewport tall enough not to resize, and state shots
>    on a normal-height window. **Open every one and look**: `/submissions`'
>    screenshots found a badge breaking "returne / d", a slug split "lab- /
>    03", a pane counting 22 waiting beside a header saying 21, a toast over
>    Save at 380, and "move this up a band" on a project with no bands, **all
>    under a green gate**. Write `motion.md`. Run every console spec before
>    committing, then `git checkout -- design/item-review/` unless that PNG is
>    the route.
> 8. Tick **`/gradebook`** under the R3 "Console revamp" box in the same
>    commit as the work. Commit with explicit paths. Commit and push.
> 9. **Rewrite §1 of `docs/redesign/REVAMP-PROMPTS.md` for the next session**
>    (#8 in `CONSOLE-REVAMP.md` §3: `/content`, `/audit`, `/system`,
>    `/feedback`, `/live`, one route per session, in that order unless §3
>    says otherwise), carrying forward what this session learned. Update the
>    phase figures. Commit and push that too.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and **end your last message with the rewritten §1 prompt in
> one fenced code block, plain text with no `> ` markers, ready to copy and
> paste**. Then **stop**. Do not start the next route.

**What the `/submissions` session learned that every later route needs:**

- **Read the API behind a page, not just the page.** The old page's own
  comment said "there is no edit path, here or in the API". The API re-marked
  a graded row in place, returned drafts, and erased the grader's feedback on
  every return. Three denial tests, each watched failing at 200, before a
  line of JSX.
- **A fixture must use the seed's real states.** The first run timed out on
  every graded test because the fixture keyed a row that was still *to mark*.
  Query the database for the rows you key before you key them.
- **A red that only a full run shows is still red.** The gate's positive
  control read its log one frame too early under load. Fixed in `_gate.ts`
  for every spec, not skipped.
- **The seed's words are not the teacher's.** "Waiting" had to mean *waiting
  on the teacher*: a returned submission waits on the student, and counting
  it made the pane disagree with the header.
- **Make a test for what you saw, then break the page to see it fail.** The
  slug check passed with the fix reverted until it was pointed at the row the
  defect was actually seen on.
- **Hide what must stay private in the payload, not the render.** A draft's
  body never leaves the API now; the page could not show it if it tried.
- Still true from `/assessments`, `/students/:userId`, `/students`, `/locks`,
  `/signin` and `/items`: a test that cannot fail is not a test; put the
  honest answer on every row; an API enforcing half a rule is a hole; ask
  with the plan; modal dialogs hide toasts from assistive technology; a skip
  can hide a test that never runs; preflight strips list markers; ICU writes
  "Sept"; the console's spacing scale is the token scale (`pl-6` is 2rem);
  only the checked radio is in the Tab order; look at the picture, even when
  green.

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
