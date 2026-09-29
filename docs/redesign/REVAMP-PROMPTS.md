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

## 1. Start here — the next session: `/app/map`, the flat map

*Rewritten 29 Sep 2026 by the `/app/stage/:id` session, which rebuilt the
SECOND student route (the stage reader). The flat map is next. Phase at
handover: **R3 live at 60 / 80 (75%)**, R4 2 / 29; all tracks **147 done · 71
to-do (218 items, 67%)**. `pnpm phase` is the count, not this line.*

> Read docs/redesign/WEB-REVAMP.md in full (§2's /app rows, §3.1-§3.3 and
> §3.9 on the planet sidebar and what /app/map owes it, §6 the order) and
> CONSOLE-REVAMP.md §2 and §5 for the method, then root CLAUDE.md's revamp
> rules, then docs/NEXT-SESSION.md §0a to §0q (§0p.1-5 and §0q.1 are SHELL
> defects every student route stands on). Do not re-derive what those carry.
>
> Run pnpm phase. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in CLAUDE.md rather than remembering them.
> (On 29 Sep it was NOT. Locally: stages 00-04 had 112 content blocks, all 96
> act-1 items at review, 0 live, so no paper fills and every Start answers 500
> (§0e.1); stage 01 open for 0 of the 24 seeded student profiles (§3a decided,
> not built); run_invariants() 0 failing, 4 warnings (INV-18, 25, 27, 29); 0 of
> 19 planet summaries approved. The DEPLOYMENT, last measured 28 Sep: 0 content
> blocks for 00-04 and 0 items at all (§0h.1); its console /content, /audit and
> /live answer 500 until the schema is pushed (§0j.1, §0k.1, §0n.1).)
>
> Confirm the last route is still green before touching anything, AGAINST
> BUILDS (§0j.2, §0p.9). The student app: pnpm --filter @octa/web build, then
> npx vite preview --port 5185 --strictPort from apps/web in the background
> (rebuild AND restart it after any change), OCTA_WEB_URL and OCTA_CONSOLE_URL
> = http://localhost:5185, and npx playwright test design/specs/web-stage.spec.ts
> design/specs/web-stage-check.spec.ts design/specs/attempt-runner.spec.ts. On
> 29 Sep web-stage.spec.ts gave 50 passed, 8 skipped (width), 0 failed. Without
> the stage 07 slice attempt-runner.spec.ts SKIPS its real-API tests, with the
> reason "POST /attempts answered 500" (§0q.3); with the slice (§0p.8) they run
> and pass (5 passed, 5 width skips); say which you ran, and WAIT A MINUTE
> between two slice runs (POST /attempts allows 10 a minute; back-to-back runs
> tripped it on 29 Sep). The whole web suite (every design/specs/*.spec.ts but
> console-*) gave 276 passed, 96 skipped, 0 failed, without the slice. The
> console: build it, preview it on 5184 (OCTA_CONSOLE_URL=http://localhost:5184),
> run console-*.spec.ts: 756 passed, 58 skipped, 0 failed (§0p.7's audit race did
> not recur). The API suite: 629 passed, 1 skipped. Read the skips with a JSON
> reporter and read their REASONS, not only the count: a rename turned the
> runner's tests into skips with a false reason on 29 Sep (§0q.3). A full run
> writes to the database: reset and re-demo before the next one. If anything is
> red, that is this session's work.
>
> THIS SESSION IS ONLY FOR /app/map, the flat map in apps/web (MapPage in
> apps/web/src/pages/StudentPages.tsx with flat=true, which mounts
> components/StageMap.tsx and components/FlatGalaxy.tsx; it reads GET
> /api/v1/stages, whose every node carries state, lockReason and objectives,
> decided by is_stage_unlocked(), hard rule 4). CAREFUL: /app and /app/map are
> the SAME MapPage and StageMap with a flat prop, and /app is the NEXT route.
> Rebuild the flat presentation without breaking /app; if the two must be
> split, say so and ask before splitting. NOTHING ELSE: not the reader, not the
> runner, not the 3D map, not the shell's defects in §0p.1-5 and §0q.1 unless
> one blocks this route, and then say so and ask before touching the shell.
> Write a defect on another page into docs/NEXT-SESSION.md and leave it. The
> last thing this session does is rewrite this prompt for the next one (/app,
> the 3D map).
>
> 1. Bring the local stack up: docker ps first (Docker Desktop has stopped four
>    times; start it from its .exe), pnpm db:up, then pnpm db:reset && node
>    scripts/db-demo.mjs, pnpm dev:api on 8090, pnpm dev:token student (seeded
>    student 232129006). Look at the dev server on 5183; gate against the build
>    on 5185 (5173 and 5174 belong to other projects; the API's CORS allows
>    5173, 5174, 5183, 5184 and 5185 only). Confirm every port is OURS (the
>    process command line and the page title). A reset KILLED the dev API twice
>    more on 29 Sep (§0c.1): prove it with a real GET, not /healthz (§0e.7).
>    After ANY API test run, reset and re-demo.
> 2. Audit against the plan FIRST. PAGE-SPECS.md §/app/map ("a first-class
>    route, not a fallback": the same 19 nodes and 18 edges as SVG plus real
>    focusable buttons, bookmarkable, focus order in curriculum order; the
>    accessibility floor is measured here) and §/app's original rows (a locked
>    node shows WHY and HOW FAR; a read-only preview of the next locked stage's
>    objectives; a resume card "Pick up where you left off"), WEB-REVAMP.md §2's
>    /app rows ("what do I do next" missing; lock reason legible on the map) and
>    §3.9 (/app/map opens THE SAME planet sidebar as §3.1, in place, never by
>    redirect: title, summary only once approved, objectives in words, levels
>    and minutes, state and lockReason verbatim, ENTER JOURNEY; moons and "N of
>    M subtopics mastered" have no data yet, §3.7), §1's evidence (every Link
>    renders browser-default purple: styles.css has no base a rule), and
>    BIOME-AND-LOADING-SPEC.md §1b (NO biome on /app/map: the solar system is
>    its background). Then compare with what StageMap.tsx and FlatGalaxy.tsx do.
>    The gap is the finding. Plan what is missing, with a recommended option
>    and its cost, and ASK before building it. Whether the planet sidebar lands
>    here or with /app, and whether a "pick up where you left off" card reads
>    the reader's per-device position (localStorage octa:reader:<stageId>,
>    {index, label}, §0q), are the instructor's calls. What a student sees and
>    anything that touches a lock is the instructor's call.
> 3. The reference. TEMPLATE-LINKS.md's /app/map row names "beautiful-skill-tree
>    + React Flow a11y patterns" (GAME-DESIGN.md §4.2). It is a lead, not a
>    template: ui.shadcn.com/blocks held no reader and no form block (§0f,
>    design/templates/web/stage/SOURCE.md), so check the lead holds a screen of
>    the right shape before trusting it. Capture a real screen into
>    design/templates/web/map/ with template.png and SOURCE.md (URL, date, HTTP
>    status, what rendered). If the lead cannot be captured, find a replacement
>    BEFORE building and record why. Capture at 1440x1500 and 380x1900 (§0k.7);
>    shadcn.io previews need Skip tour (§0l.7). Open every PNG. Write SPEC.md:
>    the controls and which of the four tests each passes (DESIGN-MANDATE.md §1).
> 4. Specs. Six gate assertions at 1440 and 380 (design/specs/_gate.ts;
>    assertion 6's positive control recorded before load) plus what the
>    approved plan owes, in design/specs/web-map.spec.ts. Scope the surface
>    checks to the route's own root (a data- attribute, as [data-reader] and
>    [data-runner] are; §0p.2: the shell's nav is inside <main>). Wait for the
>    student's seeded look (the /api/v1/cosmetics response) before measuring
>    colour. Extend, never overwrite, solar-system.spec.ts (it drives /app/map
>    in several places), r3-gate.spec.ts, before-baseline.spec.ts,
>    cosmetics.spec.ts and r3-inventory.spec.ts where they cover this route;
>    move their selectors to new hooks if you must, keep every assertion. Wait
>    for data, never for the <h1> (§0m.5). getByLabel/hasText match by
>    SUBSTRING (§0k.6, and hasText "Temporal locality" matched two items on 29
>    Sep): use exact names or anchored regexes. Never race a retrying
>    toHaveCount(0) against a timer: record timestamps with a MutationObserver
>    installed before load and assert the gaps (web-stage.spec.ts' loading
>    test). To prove "nothing covers this", remember elementFromPoint skips
>    pointer-events: none (§0q.4; web-stage.spec.ts' onTop()). Watch it fail
>    before the rebuild, against the old page, and do not edit the page while
>    that red run is going; an assertion added later is watched red on the
>    current build before its fix.
> 5. Rebuild the page. REDO, not improve: hand-written CSS over packages/tokens,
>    no Tailwind, no shadcn. Use what exists: lib/toast.ts with
>    components/Toaster.tsx, lib/useDelayed.ts (400ms / 3s), lib/registers.ts,
>    lib/markdown.ts' parseInline for numbers in mono inside a sentence
>    (§0q), and a route root on its own token ground because var(--bg) is
>    defined nowhere (§0p.1). The real-DOM, keyboard-correct flat map (every
>    stage a focusable button carrying its state and lock reason, behind a skip
>    link, focus in curriculum order) MUST NOT REGRESS: it is the accessibility
>    contract. Style this route's own links (the shell has no base a rule).
>    display: inline-flex trims the space at a text item's edge ("Go to
>    Stage00" on 29 Sep): prefer inline-block for a label with a number in it.
>    The shell's nav is z-index 2 inside <main>: anything of this route that must
>    open over it needs its root at 2 (§0q; the reader's sheet). Loading
>    (nothing under 400ms, a skeleton after, words after 3s at its top), a
>    failed read with Try again, transitions per .claude/rules/design.md with
>    their reduced-motion cut. Mono for every number and only those; a sentence
>    in mono is a bug. The seeded accent can be RED (232129006's is pink-red):
>    accent marks the student's own place, never a state or a lock. 380 with no
>    sideways scroll; a sideways scroller counts as clipping.
> 6. Capture current.png, current-380.png and state shots (locked nodes with
>    their reasons, a stage selected or focused, loading, a failed read, all
>    three themes) with a script under node --experimental-strip-types that
>    imports the spec's fixture by file:/// URL (and @playwright/test from the
>    repo's node_modules by file:/// URL). Size the viewport to the content until
>    scrollHeight stops changing; never trust fullPage (§0n.4). Read tall shots
>    in slices (load the PNG into a page and clip). Open every one and look.
>    Write motion.md. Run the whole web suite and every console spec against
>    builds, and the whole API suite if the API changed. Then
>    git checkout -- design/item-review/.
> 7. pnpm typecheck and pnpm lint must be clean. pnpm scan:bundle is RED on
>    the CONSOLE bundle for env-var NAMES from packages/contracts (§0p.16, not
>    values, not this route's); the student bundle must stay clean; say what
>    the scan printed.
> 8. Tick /app/map under "Student app revamp" in R3 in the same commit as the
>    work, and move R3's count in docs/PROGRESS.md. Commit with explicit paths,
>    messages from a file (git commit -F; write long text with the Write tool:
>    a long heredoc in this shell fails to parse, and there is no Python; the
>    repo mixes CRLF and LF, so a Node string replace must normalise line
>    endings first and write them back). Commit and push.
> 9. Rewrite §1 of docs/redesign/REVAMP-PROMPTS.md for the next session (/app,
>    the 3D map: §3 selection and zoom, §4 orbital motion; moons land with it,
>    R4), carry forward what this session learned, update the phase figures,
>    commit and push.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and end your last message with the rewritten §1 prompt in one
> fenced code block, plain text with no > markers, ready to copy and paste.
> Then stop. Do not start the next route.

**What the `/app/stage/:id` session learned that every later route needs:**

- **Read skip REASONS, not only the count.** Renaming the reader's check
  control turned `attempt-runner.spec.ts`' real-API tests into skips saying
  "no assessment in the fixture". The count moved by an explicable-looking
  number; only the reasons showed the lie.
- **`elementFromPoint` ignores `pointer-events: none`.** The biome is exactly
  that, so a probe said the old reader's back link and lock card were on top
  while both were painted under the scene. Lift it for the question.
- **A retrying assertion is a timer you did not set.** `toHaveCount(0)` waited
  out a 5s load and made a loading test fail for no reason. Record when each
  state appears, from inside the page, and assert the gaps.
- **`inline-flex` eats spaces** at the edge of a text item: "Go to Stage00",
  "Stage07" in the rail. `allInnerTexts()` against the expected labels catches
  it; a screenshot did first.
- **A green gate can still hide a covered control.** The 380 sheet opened
  UNDER the shell's nav (z-index 2 inside `<main>`) with every gate assertion
  green; the screenshot showed it, and an `onTop()` assertion now holds it.
- **The content decides the renderer.** Inventory what `content_blocks`
  actually uses before writing one (a query over every block took a minute and
  found tables and `>` quotes nobody had listed); then prove zero leftover
  markers over every real block.
- **A figure that must stay verbatim and never scroll** can size itself: a
  container-query `font-size` from its own longest line, no script.
- **The "clipped strip" was a tile seam.** Measure what paints there
  (`elementsFromPoint`) before fixing it; the first fix changed nothing and was
  reverted.

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
