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

## 1. Start here — the next session: `/app/stage/:id/check`, the first student route

*Rewritten 29 Sep 2026 by the `/attempts/:attemptId` session, which rebuilt the
LAST console route: with it, every route in `CONSOLE-REVAMP.md` §3 is through
the gate and the parent "Console revamp" box under R3 is ticked. The student
app is next, `WEB-REVAMP.md` §6 in order, and its first route is the attempt
runner, because it grades. Phase at handover: **R3 live at 58 / 73 (79%)**;
all tracks **145 done · 66 to-do (211 items, 69%)**. `pnpm phase` is the
count, not this line.*

> Read `docs/redesign/WEB-REVAMP.md` and `docs/redesign/CONSOLE-REVAMP.md` in
> full (the console is DONE; read it for the method and §8, the student-app
> order), then root `CLAUDE.md`'s revamp rules, then **`docs/NEXT-SESSION.md`
> §0a to §0o** (what the fourteen console sessions parked; §0o is the last).
> Do not re-derive what those carry.
>
> Run `pnpm phase`. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in `CLAUDE.md` rather than remembering them.
> (On 29 Sep it was NOT. Locally: stages 00-04 had 112 content blocks, but all
> 96 act-1 items sat at `review`, 0 live, so no paper can be filled and every
> Start answers 500 (§0e.1); stage 01 was open for 0 of 21 demo students (§3a
> decided, not built); `run_invariants()` had 0 failing and 4 warnings
> (INV-18, 25, 27, 29); 0 of 19 planet summaries approved. The DEPLOYMENT was
> last measured on 28 Sep: **0 content blocks for 00-04 and 0 items at all**
> (§0h.1), and its console `/content`, `/audit` and `/live` answer 500 until
> the schema is pushed (§0j.1, §0k.1, §0n.1).)
>
> **Confirm the console is still green before touching anything, AGAINST A
> BUILD** (§0j.2): `pnpm --filter @octa/console build`, then
> `npx vite preview --port 5185 --strictPort` from `apps/console` in the
> background (rebuild AND restart it after a change), then `OCTA_WEB_URL` and
> `OCTA_CONSOLE_URL` = `http://localhost:5185` and
> `npx playwright test design/specs/console-*.spec.ts`. On 29 Sep that gave
> **756 passed, 58 skipped, 0 failed** (814 tests). Read the skips with a JSON
> reporter; they are width-specific by design, and a skip count that MOVES is
> a finding (§0l.6). **A full run writes to the database: reset and re-demo
> before running it again.** If anything is red, that is this session's work.
>
> **THIS SESSION IS ONLY FOR `/app/stage/:id/check`**, the attempt runner in
> `apps/web` (`CheckPage` in `apps/web/src/pages/StudentPages.tsx`, which
> mounts `components/AttemptRunner.tsx`, 601 lines; it reads the paper from
> `POST /api/v1/attempts` through the ONE student serializer,
> `services/api/src/serialize/student.ts`). It grades, and hard rule 1 governs
> it from the other side: **the key must reach neither the network nor the
> DOM** until the paper is submitted. NOTHING ELSE: not the console, not the
> reader or the maps, not §0e.1 (the 500 on an unfillable Start) or any other
> parked item unless it blocks this route. Write a defect on another page into
> `docs/NEXT-SESSION.md` and leave it. The last thing this session does is
> rewrite this prompt for the next one (`/app/stage/:id`, the reader).
>
> 1. Bring the local stack up: **`docker ps` first** (Docker Desktop has
>    stopped four times; start it from its `.exe`), `pnpm db:up`, then
>    **`pnpm db:reset && node scripts/db-demo.mjs`**, `pnpm dev:api` on 8090,
>    and **`pnpm dev:token student`** for a student session (seeded student
>    232129006). The student app's dev server is for LOOKING, on **5183**
>    (5173 and 5174 belong to other projects; the API's CORS allows 5173,
>    5174, 5183, 5184 and 5185 only, `scripts/dev-api.mjs` `WEB_PORTS`, so a
>    web BUILD preview needs one of those: stop the console preview and use
>    5185, or add a port there and say so). Confirm every port is OURS (the
>    process command line and the page title). A reset CAN kill the dev API
>    (§0c.1, §0n.8): **prove it with a real GET, not `/healthz`** (§0e.7).
>    **After ANY API test run, reset and re-demo.**
> 2. **Audit against the plan FIRST.** `PAGE-SPECS.md`
>    §`/app/stage/:id/check` (autosave, resume, one question at a time),
>    `WEB-REVAMP.md` §2's runner rows (**"the first answer is final" is said
>    nowhere**: `responses` is first-write-wins for every type; per-question
>    time, flag-for-review, resume are partial), `LESSON-PLAN-AND-LEVELS.md`
>    and `GAME-DESIGN.md` where they own the CHECK beat, and root `CLAUDE.md`'s
>    rules: an incorrect answer is never red, never a buzzer, never a shake;
>    `aria-live` on answer feedback; the Register Bar's PC is the question
>    index during an assessment (`.claude/rules/design.md`). Then compare with
>    what `AttemptRunner.tsx` does. The gap is the finding. **Plan what is
>    missing, with a recommended option and its cost, and ASK before
>    building it.** Anything that changes what a student sees or how a paper
>    is graded is the instructor's call.
> 3. **THE HARD PART: no paper can be filled locally** (0 live items, §0e.1),
>    so the runner cannot be reached through the real API on this stack.
>    `design/specs/attempt-runner.spec.ts` already starts real attempts and
>    SKIPS when it cannot (§0e.2): check what it actually runs today before
>    believing any green. Options to weigh and put to the instructor: approve
>    a slice of act 1 LOCALLY ONLY for the session (through `/items`, then
>    reset), or a fixture in the console's pattern (`_student-detail-fixture.ts`
>    resolves real bank items through the real engine; the runner's fixture
>    must carry NO key, or it tests a shape the API never sends). The key-leak
>    test must hit the REAL API, whichever is chosen.
> 4. **The reference.** `TEMPLATE-LINKS.md`'s runner row names **Game UI
>    Database, Dialogue/HUD** (`GAME-DESIGN.md` §4.3: one item per screen
>    under a persistent status strip, "game UI references, not SaaS quiz-app
>    patterns"). It is a lead, not a template: capture a real screen into
>    `design/templates/web/stage-check/` (`design/templates/web/` does not
>    exist yet; this route creates it) with `template.png` and `SOURCE.md`
>    (URL, date, HTTP status, what rendered). If the lead cannot be captured,
>    find a replacement BEFORE building and record why; the `/attempts`
>    session's `SOURCE.md` is a worked example of rejecting leads with reasons.
>    shadcn.io previews: click **Skip tour** (§0l.7), capture at
>    **1440×1500 and 380×1900** (§0k.7). **Open every PNG.** Write `SPEC.md`:
>    the controls and which of the four tests each passes
>    (`DESIGN-MANDATE.md` §1).
> 5. **Specs.** Six gate assertions at 1440 and 380 (`design/specs/_gate.ts`;
>    assertion 6's positive control through `motionStarted()`), plus what the
>    approved plan owes, in `design/specs/web-stage-check.spec.ts`. **Extend,
>    never overwrite** `attempt-runner.spec.ts` (its hard-rule-1 test is the
>    most valuable one in the student suite). Check `_gate.ts`' `SURFACES` and
>    motion recorder against `apps/web`'s markup before trusting them: they
>    were written for the console. Wait for data, never for the `<h1>`
>    (§0m.5). `getByLabel(…, { exact: true })` (§0k.6). **Watch it fail
>    before the rebuild.**
> 6. **Rebuild the page.** REDO, not improve: `apps/web` is hand-written CSS
>    over `packages/tokens`, no Tailwind, no shadcn, and **`styles.css` has no
>    base `a { }` rule** (links render browser-default purple outside
>    `.app-nav` and `.encounter`). Loading (nothing under 400ms, a skeleton
>    after, words after 3s at its TOP), a failed read with Try again, a toast
>    per action that changes server state (`apps/web` has no toast component:
>    say how this route gets one before building one), transitions per
>    `.claude/rules/design.md`. Every number, register value and computed
>    answer in mono. **An ordering item must stay answerable** (`da5831b`: it
>    once rendered as radio buttons and was graded wrong every time). 380 with
>    no sideways scroll; **a sideways scroller counts as clipping**.
> 7. Capture `current.png`, `current-380.png` and state shots (a question, an
>    answer saved, a save that failed, submitted, resumed after reload) with a
>    script under `node --experimental-strip-types` that imports the spec's
>    fixture by `file:///` URL. **Size the viewport to the content** and, at
>    380, to `scrollHeight` until it stops changing; never trust `fullPage`
>    (§0n.4). Read tall shots in slices. **Open every one and look.** Write
>    `motion.md`. Run the whole web suite and every console spec against
>    builds, and the whole API suite if the API changed. Then
>    `git checkout -- design/item-review/`.
> 8. Tick the route in R3 (the "Student app revamp" box has no per-route
>    children yet: add them, one per `WEB-REVAMP.md` §6 route, as the console
>    box did on 25 Sep, and tick this one) in the same commit as the work.
>    Commit with explicit paths, messages from a file (`git commit -F`; write
>    long text with the Write tool: a long heredoc in this shell can fail to
>    parse, and there is no Python, use Node for scripted edits). Commit and
>    push.
> 9. **Rewrite §1 of `docs/redesign/REVAMP-PROMPTS.md`** for the next session
>    (`/app/stage/:id`, the reader: §0j.3's raw `##` and broken lists, the
>    missing leave/finish control), carry forward what this session learned,
>    update the phase figures, commit and push.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and **end your last message with the rewritten §1 prompt in
> one fenced code block, plain text with no `> ` markers, ready to copy and
> paste**. Then **stop**. Do not start the next route.

**What the `/attempts/:attemptId` session learned that every later route needs:**

- **"No template, deliberately" was findable in ten minutes.** A vendor's own
  help guide carries real screenshots of the real product and answers 200
  without a login; the figure's `src` is fetchable directly. Capture the page
  AND the figure, and say which leads were rejected and why.
- **A link between two pages can undo a ruling made on one of them.** The
  record withheld the key on a live paper; its "Open paper on its own page"
  led to a page that showed it. When a rule lives on one page, grep for every
  route that renders the same data, and make both call ONE function
  (`showsKey()`).
- **A route that can be opened from a link must say what it is without the
  page that linked to it.** `/attempts` said "Paper" over a UUID; the API
  owed the owner and the context, not the page.
- **A malformed id is a 404, not a 500.** A 500 says "try again" about
  something that can never work. Validate the shape before the query.
- **A new check can catch the harness's own furniture.** The sideways-scroller
  check first flagged the shell's 1px `.sr-only` boxes; `_gate.ts` exempts
  them for a reason, and so must any new check.
- **The shell's nav is in the page at 1440.** `getByRole("link", { name:
  /audit log/i })` matched the nav's "Audit log" at 1440 and not at 380, where
  the nav is a closed sheet. Use the exact name.
- **A fixture's derived number must be recomputed from what it shows** (§0h's
  rule, again): the record's fixture says 5/8 over a paper with 4 correct
  (§0o.2).

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
