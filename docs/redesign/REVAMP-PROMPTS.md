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

## 1. Start here — the next session: `/app/stage/:id`, the reader

*Rewritten 29 Sep 2026 by the `/app/stage/:id/check` session, which rebuilt
the FIRST student route (the attempt runner) and gave R3's "Student app
revamp" box one child per `WEB-REVAMP.md` §6 route. The reader is next.
Phase at handover: **R3 live at 59 / 80 (74%)**, R4 2 / 29; all tracks
**146 done · 72 to-do (218 items, 67%)**. `pnpm phase` is the count, not
this line.*

> Read docs/redesign/WEB-REVAMP.md in full (§2's reader rows, §3.4-§3.5 on
> where a biome belongs, §6 the order) and CONSOLE-REVAMP.md §2 and §5 for the
> method, then root CLAUDE.md's revamp rules, then docs/NEXT-SESSION.md §0a to
> §0p (§0p is the first student route's; its items 1-5 are SHELL defects every
> student route stands on). Do not re-derive what those carry.
>
> Run pnpm phase. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in CLAUDE.md rather than remembering them.
> (On 29 Sep it was NOT. Locally: stages 00-04 had 112 content blocks, all 96
> act-1 items at review, 0 live, so no paper fills and every Start answers 500
> (§0e.1); stage 01 open for 0 of 21 demo students (§3a decided, not built);
> run_invariants() 0 failing, 4 warnings (INV-18, 25, 27, 29); 0 of 19 planet
> summaries approved. The DEPLOYMENT, last measured 28 Sep: 0 content blocks for
> 00-04 and 0 items at all (§0h.1); its console /content, /audit and /live
> answer 500 until the schema is pushed (§0j.1, §0k.1, §0n.1).)
>
> Confirm the last route is still green before touching anything, AGAINST
> BUILDS (§0j.2, §0p.9). The student app: pnpm --filter @octa/web build, then
> npx vite preview --port 5185 --strictPort from apps/web in the background
> (rebuild AND restart it after any change), OCTA_WEB_URL and OCTA_CONSOLE_URL
> = http://localhost:5185, and npx playwright test
> design/specs/web-stage-check.spec.ts design/specs/attempt-runner.spec.ts. On
> 29 Sep, with stage 07 approved locally (§0p.8), that gave 45 passed, 13
> skipped, 0 failed; without the slice attempt-runner.spec.ts SKIPS its
> real-API tests (§0e.2), so say which you ran. The whole web suite (every
> design/specs/*.spec.ts but console-*) gave 231 passed, 83 skipped, 0 failed.
> The console: build it, preview it on 5184, and run console-*.spec.ts: 755
> passed, 58 skipped, 1 failed, a load race in console-audit's export toast that
> passed 48 of 48 alone three times (§0p.7). Read the skips with a JSON
> reporter; a skip count that MOVES is a finding (§0l.6). A full run writes to
> the database: reset and re-demo before the next one. If anything is red, that
> is this session's work.
>
> THIS SESSION IS ONLY FOR /app/stage/:id, the stage reader in apps/web
> (StagePage in apps/web/src/pages/StudentPages.tsx, which mounts
> components/StageReader.tsx, 391 lines; it reads GET /api/v1/stages/:id,
> content_blocks RLS-denied for a locked or unpublished stage, hard rule 5: the
> prose comes from the database and is never invented). NOTHING ELSE: not the
> runner, not the maps, not the shell's defects in §0p.1-5 unless one blocks
> this route, and then say so and ask before touching the shell. Write a defect
> on another page into docs/NEXT-SESSION.md and leave it. The last thing this
> session does is rewrite this prompt for the next one (/app/map, the flat map).
>
> 1. Bring the local stack up: docker ps first (Docker Desktop has stopped four
>    times; start it from its .exe), pnpm db:up, then pnpm db:reset && node
>    scripts/db-demo.mjs, pnpm dev:api on 8090, pnpm dev:token student (seeded
>    student 232129006). Look at the dev server on 5183; gate against the build
>    on 5185 (5173 and 5174 belong to other projects; the API's CORS allows
>    5173, 5174, 5183, 5184 and 5185 only). Confirm every port is OURS (the
>    process command line and the page title). A reset CAN kill the dev API
>    (§0c.1, §0n.8, and again on 29 Sep): prove it with a real GET, not
>    /healthz (§0e.7). After ANY API test run, reset and re-demo.
> 2. Audit against the plan FIRST. PAGE-SPECS.md §/app/stage/:id (content left;
>    a right rail at 1440 and a bottom sheet at 380 with the objectives
>    checklist, glossary terms, add to notebook and section progress; a
>    full-page lock card naming the prerequisite and the current mastery; figures
>    as mono code blocks, verbatim), WEB-REVAMP.md §2's reader rows (no control
>    to LEAVE or FINISH a stage; no reverse travel transition; mark a block read
>    and resume; the Bring-Up moment not visible), §1's evidence (stages 00 and
>    01 disagree about the theme, a pixelated biome that fights the text, a
>    clipped strip on the right edge), §0j.3 (every "## heading" in stages 01-07
>    reads to students with its hashes; a list whose items wrap is one run-on
>    paragraph with literal dashes; quote blocks drawn as prose; a brief nests p
>    in p; /content's preview mirrors the reader exactly, so it shows the same
>    defects), LESSON-PLAN-AND-LEVELS.md for the beat sequence per archetype
>    (apps/web/CLAUDE.md: never add a beat an archetype does not declare), and
>    BIOME-AND-LOADING-SPEC.md, which owns the biome page background and AA over
>    it. Then compare with what StageReader.tsx does. The gap is the finding.
>    Plan what is missing, with a recommended option and its cost, and ASK
>    before building it. What a student sees, what marks a stage finished, and
>    anything that touches stage_progress or a lock is the instructor's call
>    (hard rule 4: a lock is is_stage_unlocked()'s, never the client's).
> 3. The reference. TEMPLATE-LINKS.md's reader row names "shadcn Blocks,
>    article/reader layout" at https://ui.shadcn.com/blocks (a content rail
>    plus a right objectives sidebar, a docs-reader pattern). It is a lead, not
>    a template: ui.shadcn.com/blocks had NO form block for /assessments
>    (§0f), so check it holds a reader before trusting it. Capture a real screen
>    into design/templates/web/stage/ with template.png and SOURCE.md (URL,
>    date, HTTP status, what rendered). If the lead cannot be captured, find a
>    replacement BEFORE building and record why (design/templates/web/stage-check/SOURCE.md
>    rejected three leads with reasons: two 403s behind Cloudflare, one library
>    with no screen of the right shape). shadcn.io previews: click Skip tour
>    (§0l.7), capture at 1440x1500 and 380x1900 (§0k.7). Open every PNG. Write
>    SPEC.md: the controls and which of the four tests each passes
>    (DESIGN-MANDATE.md §1; "A Start button on a stage page" is on its list of
>    things the rule kills: "arriving IS starting").
> 4. Specs. Six gate assertions at 1440 and 380 (design/specs/_gate.ts;
>    assertion 6's positive control through motionStarted()) plus what the
>    approved plan owes, in design/specs/web-stage.spec.ts. Scope the surface
>    checks to the route's own content, as web-stage-check.spec.ts' ROUTE does
>    (§0p.2: the shell's nav is inside <main>). Wait for the student's seeded
>    look (the /api/v1/cosmetics response) before measuring colour, or every
>    colour reads mid-transition. Extend, never overwrite, arrival.spec.ts,
>    student-states.spec.ts, r3-gate.spec.ts and biomes.spec.ts where they cover
>    this route. Wait for data, never for the <h1> (§0m.5).
>    getByLabel(..., { exact: true }) (§0k.6). Watch it fail before the rebuild,
>    against the old page, and do not edit the page while that red run is going:
>    the dev server hot-reloads and the run is then half old, half new.
> 5. Rebuild the page. REDO, not improve: hand-written CSS over packages/tokens,
>    no Tailwind, no shadcn. Available since 29 Sep, use them rather than
>    building again: lib/toast.ts with components/Toaster.tsx (mounted once in
>    App.tsx), lib/useDelayed.ts (400ms / 3s), lib/registers.ts (the Register
>    Bar), and the rule that a route stands on its own token ground because
>    var(--bg) is defined nowhere (§0p.1). Loading (nothing under 400ms, a
>    skeleton after, words after 3s at its TOP), a failed read with Try again, a
>    toast per action that changes server state, transitions per
>    .claude/rules/design.md (the reverse travel transition, with its
>    reduced-motion cut). Mono for every number, register value and listing,
>    and only for those: a sentence in mono is a bug (the runner's result
>    rendered prose keys in bold mono until its screenshot was read). The
>    student's seeded accent can be RED (232129006's is pink-red), so never let
>    accent carry a meaning that red would change. 380 with no sideways scroll;
>    a sideways scroller counts as clipping.
> 6. Capture current.png, current-380.png and state shots (a long stage read to
>    its end, locked, loading, a failed read, the leave or finish control, and
>    the markdown fixes on a real ## and a real wrapped list) with a script under
>    node --experimental-strip-types that imports the spec's fixture by file:///
>    URL (and @playwright/test from the repo's node_modules by file:/// URL:
>    a script in the scratchpad cannot resolve the bare name). Size the viewport
>    to the content, at 380 to scrollHeight until it stops changing; never trust
>    fullPage (§0n.4). Read tall shots in slices. Open every one and look.
>    Write motion.md. Run the whole web suite and every console spec against
>    builds, and the whole API suite if the API changed. Then
>    git checkout -- design/item-review/.
> 7. pnpm typecheck and pnpm lint must be clean. pnpm scan:bundle is RED today
>    on the CONSOLE bundle for env-var NAMES from packages/contracts (§0p.16,
>    not values, not this route's); the student bundle must stay clean, and say
>    what the scan printed.
> 8. Tick /app/stage/:id under "Student app revamp" in R3 (its per-route
>    children exist since 29 Sep) in the same commit as the work. Commit with
>    explicit paths, messages from a file (git commit -F; write long text with
>    the Write tool: a long heredoc in this shell fails to parse, and there is
>    no Python; the repo mixes CRLF and LF, so a Node string replace that
>    assumes \n silently finds nothing; use the Edit tool for CRLF files).
>    Commit and push.
> 9. Rewrite §1 of docs/redesign/REVAMP-PROMPTS.md for the next session
>    (/app/map, the flat map: it is real DOM and keyboard-correct, and that must
>    not regress), carry forward what this session learned, update the phase
>    figures, commit and push.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and end your last message with the rewritten §1 prompt in one
> fenced code block, plain text with no > markers, ready to copy and paste.
> Then stop. Do not start the next route.

**What the `/app/stage/:id/check` session learned that every later route needs:**

- **Build a fixture from the API's own functions.** `_stage-check-fixture.ts`
  imports `gradeResponse`, `toStudentPaper`, `toStudentVerdict` and
  `toStudentRecorded` by their `.ts` paths (they import types only), so the
  page is served exactly the shape the API sends, and grading in the fixture
  is the real grader. A hand-written fixture can drift into a shape the API
  never sends.
- **Read the API behind a control before trusting the control.** The old
  runner's bug was half in the API: a repeated answer was graded on the new
  click while the first one was kept, so the page could say "Correct." over a
  wrong mark. No UI test could have seen it; reading `recordAnswer()` did.
- **An arrow key changes a radio.** Anything that commits on a radio's change
  event commits whatever a keyboard user browses to. Select, then commit.
- **apps/web is not the console.** Its shell's nav is inside `<main>`, its page
  background is an undefined `var(--bg)`, and the student's seeded theme and
  accent land from `/api/v1/cosmetics` AFTER first paint and ease every
  colour: measured before that, the token gate reads mid-transition `oklab()`
  values. Scope the gate to the route; wait for the cosmetics response.
- **The student's accent is seeded and can be red.** A recorded wrong answer
  wore the accent (pink-red for `232129006`) until the screenshot showed it.
- **Mono is for machine values.** A prose answer key rendered in bold mono
  across a whole paragraph; only the tall screenshot, read in slices, showed it.
- **A red run against the dev server while you edit is half old page, half
  new.** The first "watched failing" run overlapped the rewrite by a few
  seconds; the timestamps in the JSON report said which tests were clean.
- **The real API can be reached locally**: approve one stage's items as the
  demo teacher, run, reset (§0p.8). Against the dev server, StrictMode doubles
  every start and the 10-a-minute limit trips (§0p.9).

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
| **Console** | every route the instructor needs to run act 1, `/items` first | **every route through the gate**, 29 Sep 2026 (`/items` first on 25 Sep, `/attempts/:attemptId` last) |
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
