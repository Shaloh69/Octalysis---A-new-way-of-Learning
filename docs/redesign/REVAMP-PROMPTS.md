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

## 1. Start here — the next session: `/app`, the 3D map

*Rewritten 30 Sep 2026 by the `/app/map` session, which rebuilt the THIRD
student route (the flat map, with the planet panel). The 3D map is next. Phase
at handover: **R3 live at 61 / 80 (76%)**, R4 2 / 29; all tracks **148 done ·
70 to-do (218 items, 68%)**. `pnpm phase` is the count, not this line.*

> Read docs/redesign/WEB-REVAMP.md in full (§2's /app rows, all of §3 on
> selection, zoom, the sidebar, moons, asteroids and ENTER JOURNEY, §4 on
> orbital motion, §6 the order), SOLAR-SYSTEM-SPEC.md, VISUAL-SYSTEM-3D.md §5
> (the degradation ladder: degrade IN PLACE, never redirect), and
> CONSOLE-REVAMP.md §2 and §5 for the method, then root CLAUDE.md's revamp
> rules, then docs/NEXT-SESSION.md §0a to §0r (§0p.1-5 and §0q.1 are SHELL
> defects every student route stands on; §0r.3 and §0r.4 are THIS route's
> inheritance). Then read design/templates/web/map/SPEC.md: /app/map's panel is
> the sidebar /app must open. Do not re-derive what those carry.
>
> Run pnpm phase. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in CLAUDE.md rather than remembering them.
> (On 29-30 Sep it was NOT. Locally: stages 00-04 had 112 content blocks, all
> 96 act-1 items at review, 0 live, so no paper fills and every Start answers
> 500 (§0e.1); stage 01 open for 0 of the 24 seeded student profiles (§3a
> decided, not built); run_invariants() 0 failing, 4 warnings (INV-18, 25, 27,
> 29); 0 of 19 planet summaries approved. The DEPLOYMENT, last measured 28 Sep:
> 0 content blocks for 00-04 and 0 items at all (§0h.1); its console /content,
> /audit and /live answer 500 until the schema is pushed (§0j.1, §0k.1, §0n.1).)
>
> Confirm the last route is still green before touching anything, AGAINST
> BUILDS (§0j.2, §0p.9). The student app: pnpm --filter @octa/web build, then
> npx vite preview --port 5185 --strictPort from apps/web in the background
> (rebuild AND restart it after any change: preview indexes dist/ when it
> starts), OCTA_WEB_URL and OCTA_CONSOLE_URL = http://localhost:5185, and npx
> playwright test design/specs/web-map.spec.ts design/specs/solar-system.spec.ts.
> On 30 Sep web-map.spec.ts gave 60 passed, 4 skipped (width), 0 failed, and
> solar-system.spec.ts 43 passed, 21 width skips. The whole web suite (every
> design/specs/*.spec.ts but console-*) gave 336 passed, 100 skipped, 0 failed,
> without the stage 07 slice (attempt-runner.spec.ts SKIPS its real-API tests
> with the reason "POST /attempts answered 500"; §0p.8 has the slice). The
> console: build it, preview it on 5184 (OCTA_CONSOLE_URL=http://localhost:5184),
> run console-*.spec.ts: 756 passed, 58 skipped, 0 failed. The API suite: 629
> passed, 1 skipped on 29 Sep (the API did not change on 30 Sep). Read the skips
> with a JSON reporter and read their REASONS, not only the count (§0q.3). A
> full run writes to the database: reset and re-demo before the next one. If
> anything is red, that is this session's work.
>
> THIS SESSION IS ONLY FOR /app, the 3D map in apps/web (MapPage in
> apps/web/src/pages/StudentPages.tsx, which now renders GalaxyPage ->
> components/StageMap.tsx; the scene is SolarBackdrop / SolarSystemCanvas in
> apps/web/src/solar-system/, its layout layout.ts, its old panel
> PlanetHud.tsx). CAREFUL: when /app's ladder drops the canvas (reduced motion,
> a small screen, no WebGL) it mounts components/FlatMap.tsx IN PLACE, the SAME
> component /app/map is (instructor ruling, 29 Sep), so web-map.spec.ts must
> stay green: change FlatMap only to share it, never to fork it. NOTHING ELSE:
> not /app/map's page, the reader, the runner, the shell's defects in §0p.1-5,
> §0q.1 and §0r.2 unless one blocks this route (then say so and ask before
> touching the shell). Write a defect on another page into docs/NEXT-SESSION.md
> and leave it. The last thing this session does is rewrite this prompt for the
> next one (/app/work, WEB-REVAMP §6 #5), or for /app's second half if the
> instructor splits it.
>
> 1. Bring the local stack up: docker ps first (Docker Desktop has stopped four
>    times; start it from its .exe), pnpm db:up, then pnpm db:reset && node
>    scripts/db-demo.mjs, pnpm dev:api on 8090, pnpm dev:token student (seeded
>    student 232129006). Look at the dev server on 5183; gate against the build
>    on 5185 (5173 and 5174 belong to other projects; the API's CORS allows
>    5173, 5174, 5183, 5184 and 5185 only). Confirm every port is OURS (the
>    process command line and the page title). A reset KILLED the dev API again
>    on 30 Sep (§0c.1, §0r.8): prove it with a real GET, not /healthz (§0e.7),
>    and check 8090 is free before starting another. After ANY API test run,
>    reset and re-demo.
> 2. Audit against the plan FIRST. PAGE-SPECS.md §/app ("clicking a planet
>    opens a dialog naming the stage, its state, its lock reason and distance
>    ... then offers Enter stage"; fall back in place), WEB-REVAMP.md §2's /app
>    rows (select -> zoom -> sidebar with ENTER JOURNEY; moons; orbital motion
>    WRONG; "what do I do next" still missing on /app; lock reason not legible
>    on the 3D map), §3.1-§3.3 (camera eases ~700ms, nodes pinned; sidebar at
>    1440, sheet at 380; Escape/Back step out one level, focus returns to the
>    body left), §3.2 and §3.7 (a moon's journey is PRACTICE on its objective's
>    own questions: no such route or API exists, and moon mastery has no table),
>    §3.10 (stage 00's asteroids: seeded, grey, aria-hidden, never focusable),
>    §4 (Kepler's third law, omega proportional to a^-1.5, circular orbits kept,
>    phase only, QA_MODE freezes, reduced motion stops it, a unit test over
>    layout.ts), §1 and §9 of CONSOLE-REVAMP (purple links, "0 of 19 subsystems
>    online" over an empty starfield and a lone ?, the PLACEHOLDER first-run
>    card), and §0r.3-4 (StageMap's old header, ? replay, rotate prompt and two
>    purple links around the shared FlatMap; PlanetHud is a SECOND panel; the
>    accent painted states on the flat map and may on the 3D one). Then compare
>    with what StageMap.tsx, PlanetHud.tsx, SolarBackdrop.tsx,
>    SolarSystemCanvas.tsx and layout.ts do. The gap is the finding. Plan what
>    is missing, with a recommended option and its cost, and ASK before
>    building it. The instructor's calls, at least: whether the 3D selection
>    opens FlatMap's panel (one sidebar, recommended) and PlanetHud goes;
>    whether moons land this session (WEB-REVAMP §6 says moons land with route
>    4, but a moon's ENTER JOURNEY has nowhere to go yet) or /app is split into
>    selection+zoom+Kepler now and moons as the R4 session after; what the
>    first-run card becomes (it says it is placeholder text). What a student
>    sees and anything that touches a lock is the instructor's call.
> 3. The reference. TEMPLATE-LINKS.md's /app row is a lead, not a template: of
>    the last three leads, one answered 403, one 404 and one had shut down
>    (design/templates/web/*/SOURCE.md), so check it holds a screen of the right
>    shape (a solar system or star map whose selected body opens a side panel
>    and whose camera moves to it) before trusting it. Capture a real screen
>    into design/templates/web/app/ with template.png and SOURCE.md (URL, date,
>    HTTP status, what rendered). A WebGL page may render blank headless: look
>    at the PNG, and if it is blank find another or record why. Capture at
>    1440x1500 and 380x1900 (§0k.7); dismiss cookie banners first ("Reject
>    All"). Open every PNG. Write SPEC.md: the controls and which of the four
>    tests each passes (DESIGN-MANDATE.md §1).
> 4. Specs. Six gate assertions at 1440 and 380 (design/specs/_gate.ts;
>    assertion 6's positive control recorded before load; a canvas is not DOM,
>    so prove motion with the recorder AND with the scene's own frozen/moving
>    state) plus what the approved plan owes, in design/specs/web-app.spec.ts.
>    Scope the surface checks to the route's own root (a data- attribute, as
>    [data-flatmap] and [data-reader] are; §0p.2). Wait for the student's
>    seeded look (the /api/v1/cosmetics response) and for DATA, never the <h1>
>    (§0m.5). Extend, never overwrite, solar-system.spec.ts (it drives /app in
>    dozens of places: ladder, HUD, warp, first-run), cosmetics.spec.ts,
>    r3-gate.spec.ts, r3-inventory.spec.ts and before-baseline.spec.ts; move
>    selectors to new hooks if you must, keep every assertion. Reuse
>    _map-fixture.ts (openMap with path "/app", realMap). getByText/hasText/
>    getByRole names match by SUBSTRING (§0k.6): "Not started" matched /start/i
>    on 30 Sep, so anchor every regex. Measure in DOCUMENT coordinates when a
>    click can scroll (§0r.9), and measure a clipped box on the element that
>    clips. Record timestamps with a MutationObserver installed before load,
>    never race a retrying toHaveCount(0). elementFromPoint skips
>    pointer-events: none (§0q.4) and the 3D backdrop is exactly that. Watch it
>    fail before the rebuild, against the old page, and do not edit the page
>    while that red run is going; an assertion added later is watched red on
>    the current build before its fix.
> 5. Rebuild the page. REDO, not improve: hand-written CSS over packages/tokens,
>    no Tailwind, no shadcn; three, @react-three/fiber and react-force-graph-3d
>    are the allowed libraries and stay lazy-loaded per route, never in the
>    initial bundle. Use what exists: FlatMap.tsx's useMapSelection() (a
>    selection in ?stage=NN: push to open, replace to switch, Back closes,
>    focus to the heading and back), lib/next-stage.ts (the card /app/map
>    shows), lib/toast.ts, lib/useDelayed.ts (400ms / 3s), lib/markdown.ts'
>    parseInline, and a route root on its own token ground (§0p.1). The
>    accessibility contract MUST NOT REGRESS: every stage a real focusable
>    button in curriculum order with its state and lock reason, and the flat
>    presentation in place under the ladder. Style this route's own links (the
>    shell has no base a rule). Prefer inline-block for a label with a number
>    in it (inline-flex trims the space). The shell's nav is z-index 2 inside
>    <main>: anything that must open over it needs its root at 2. Loading, a
>    failed read with Try again, transitions per .claude/rules/design.md with
>    their reduced-motion cut; the camera's ~700ms ease and the warp are the
>    route's motion, and reduced motion CUTS both. Mono for every number and
>    only those. The seeded accent can be RED (232129006's is pink-red): accent
>    marks the student's own place, never a state or a lock; web-map.spec.ts'
>    accent test is the pattern. Positions stay deterministic (phase only,
>    seeded, never Math.random). 380 with no sideways scroll.
> 6. Capture current.png, current-380.png and state shots (a planet selected
>    and zoomed, a locked one with its reason, the ladder's flat fallback,
>    loading, a failed read, all three themes) with a script under node
>    --experimental-strip-types that imports the spec's fixture by file:///
>    URL (and @playwright/test from the repo's node_modules by file:/// URL),
>    with QA_MODE frozen so the orbits hold still. Size the viewport to the
>    content until scrollHeight stops changing; never trust fullPage (§0n.4).
>    Open every one and look. Write motion.md. Run the whole web suite and
>    every console spec against builds, and the whole API suite if the API
>    changed. Then git checkout -- design/item-review/.
> 7. pnpm typecheck, pnpm lint and pnpm --filter @octa/web test must be clean.
>    pnpm scan:bundle is RED on the CONSOLE bundle for env-var NAMES from
>    packages/contracts (§0p.16, not values, not this route's); the student
>    bundle must stay clean; say what the scan printed.
> 8. Tick /app under "Student app revamp" in R3 in the same commit as the
>    work (and "Map sidebar and ENTER JOURNEY" only if everything it names
>    landed), move R3's count in docs/PROGRESS.md, and R4's boxes if moons
>    land. Commit with explicit paths and check `git status` for anything
>    already staged before each commit (a staged deletion landed in the wrong
>    commit on 30 Sep, §0r), messages from a file (git commit -F; write long
>    text with the Write tool; there is no Python; the repo mixes CRLF and LF,
>    so a Node string replace must normalise line endings first and write them
>    back). Commit and push.
> 9. Rewrite §1 of docs/redesign/REVAMP-PROMPTS.md for the next session, carry
>    forward what this session learned, update the phase figures, commit and
>    push.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and end your last message with the rewritten §1 prompt in one
> fenced code block, plain text with no > markers, ready to copy and paste.
> Then stop. Do not start the next route.

**What the `/app/map` session learned that every later route needs:**

- **Measure where targets can go before designing them.** The planets are
  15.3px apart at 380 (from `computeSolarLayout` on the real map, a one-minute
  script), so no styling could have made 19 targets fit there. A container
  query moving the SAME buttons from the picture into rows kept one DOM and one
  Tab order.
- **Opacity over a long box-shadow list bands in 256px tiles.** The flat map's
  dark rectangles were its star layers, found by hiding one layer at a time.
  Dim with a quieter token instead.
- **A test that is red on a correct page is a test to read, not a page to
  change.** Two were: a clipped box measured on the text inside it, and "the
  map did not move" compared across a click that scrolled. Say what the
  assertion claims, then measure exactly that.
- **The API's order is not always the syllabus's.** `order by id` puts 06.10
  second; seen only in a screenshot (§0r.1).
- **A selection belongs in the URL** when Back must close it and a link must
  reopen it: `useMapSelection()` does both, and the reader's Back returns to
  the panel it left.
- **Stage what you mean, and look before committing.** An earlier `git rm`
  put a deletion in the wrong commit.
- Still true from the reader: read skip REASONS; `elementFromPoint` ignores
  `pointer-events: none`; a retrying assertion is a timer you did not set;
  `inline-flex` eats spaces; a green gate can still hide a covered control.

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
