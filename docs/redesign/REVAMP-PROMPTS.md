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

## 1. Start here — the next session: `/signin`

*Rewritten 25 Sep 2026 by the `/items` session, which put the first console
route through the gate. Phase at handover: **R3 live at 42 / 72 (58%)**; all
tracks **129 done · 81 to-do (210 items, 61%)**. R3 gained 14 per-route console
boxes this session, which is why its denominator moved. `pnpm phase` is the
count, not this line.*

> Read `docs/redesign/CONSOLE-REVAMP.md` and `docs/redesign/WEB-REVAMP.md` in
> full, then root `CLAUDE.md`'s revamp rules, then **`docs/NEXT-SESSION.md` §0a**
> (seven things the `/items` session parked). Do not re-derive what those carry.
>
> Run `pnpm phase`. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in `CLAUDE.md` rather than remembering them.
>
> **Confirm `/items` is still green before touching anything:**
> `npx playwright test design/specs/console-items.spec.ts` with
> `OCTA_WEB_URL` and `OCTA_CONSOLE_URL` set to `http://localhost:5184`: 29 passed,
> 5 skipped (1440-only by design). If it is red, that is this session's work.
>
> **THIS SESSION IS ONLY FOR `apps/console` `/signin`. NOTHING ELSE.** Not a
> second route, not a quick fix elsewhere, not the student app. If you find a
> defect on another page, write it down in `docs/NEXT-SESSION.md` and leave it.
> The last thing this session does is rewrite this prompt for the next one.
>
> 1. Bring the local stack up: `pnpm db:up` (check `docker ps`; Docker Desktop
>    stops silently), then **`pnpm db:reset && node scripts/db-demo.mjs`**,
>    `pnpm dev:api` on 8090, console on **5184**
>    (`pnpm --filter @octa/console dev --port 5184 --strictPort`), and
>    `pnpm dev:token` for a session. 5173 and 5174 belong to other projects.
>    **After ANY API test run, reset, do not just re-demo:** the API suite leaves
>    22 live stage-07 fixture items behind and `db-demo` only adds.
> 2. **`design/templates/console/signin/` is EMPTY.** No `template.png`, no
>    `SOURCE.md`. And **`TEMPLATE-LINKS.md` has no row for console `/signin`**:
>    `CONSOLE-REVAMP.md` §3 names only "shadcn-admin auth block". Leads:
>    `https://shadcn-admin.netlify.app/sign-in` and `/sign-in-2`. Both answered
>    200 on 25 Sep, which proves nothing about a single-page app. Capture with
>    Playwright, **open the PNG and look**, write `SOURCE.md`, and add the row to
>    `TEMPLATE-LINKS.md`. (The student app's `/login` row says *do not* use a
>    generic auth block; that row is `apps/web`'s, not this route's.) Then
>    write `SPEC.md`: structure taken, what is not copied. Colours and fonts are ours.
> 3. **`/signin` already has TWO specs. EXTEND them; do not write a third.**
>    `console-gate.spec.ts` (208 lines: the server-side denials for student and
>    anonymous callers, the redirect to `/signin`, the student told why) and
>    `console-bootstrap-credentials.spec.ts` (112 lines: the forced
>    credential-change screen that blocks the whole console). Both must still pass
>    at the end. Add the six assertions by **importing
>    `design/specs/_gate.ts`**: `clippedElements`, `horizontalOverflow`,
>    `unreachableByKeyboard`, `contrastFailures` with `setTheme` and `THEMES`,
>    `offTokenStyles`, and `recordMotion` / `recordedMotion` for assertion 6, whose
>    **positive control** (something must animate with motion allowed) is what
>    stops it passing on a page with no motion. **Watch them fail first.**
> 4. **Rebuild the page.** Not improve: rebuild. It must carry toasts, loading
>    states and transitions per `.claude/rules/design.md`. Three things specific
>    to this route:
>    - **`/signin` renders OUTSIDE `AppShell`**, so the `<Toaster />` the `/items`
>      session mounted in the shell is **not on this page**. Moving it to the app
>      root touches every route; decide, and say which you chose.
>    - **Locally the API logs "auth routes not mounted"** (no `SUPABASE_URL`), so
>      a real sign-in cannot succeed on 5184. The spec can drive the failure
>      state, and needs to: a wrong password must say so and must not vanish.
>    - `PAGE-SPECS.md` has **no row for `/signin`**. The contract is those two
>      specs plus `CONSOLE-REVAMP.md` §3: first thing anyone sees, with the
>      forced credential change behind it. Say so in `SPEC.md` rather than
>      inventing features. Anything planned but missing gets named and brought to
>      the instructor, never built unasked.
> 5. Green on all six, both widths. Capture `current.png` and `current-380.png`
>    with Playwright, then **open both and look at them**. Write `motion.md`.
>    Running the console specs rewrites `design/item-review/assessment-window.png`;
>    restore it before committing.
> 6. Tick **`/signin`** under the R3 "Console revamp" box: one box per route now
>    exists, and `/items` is the one ticked. Tick it in the same commit as the
>    work. Commit and push.
> 7. **Rewrite §1 of `docs/redesign/REVAMP-PROMPTS.md` for the next session**
>    (`/locks`, #3 in `CONSOLE-REVAMP.md` §3), carrying forward what this
>    session learned. Update the phase figures. Commit and push that too.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, show me the rewritten §1, and **stop**. Do not start the next
> route.

**What the `/items` session learned that every later route needs:**

- **A skip that fires on a race is a test that has stopped existing.**
  `console-items.spec.ts`' four tests skipped on every run for weeks while being
  reported as passing: they counted rows while the page still said "Loading".
  Read a spec's *skipped* count, not just its failures.
- **Measure colours on a settled frame.** A click leaves the hovered control
  mid-transition, and a colour caught halfway is an interpolated `oklab()`, not
  an off-palette colour. `_gate.ts`' `settle()` waits for transitions.
- **A screen-reader-only header is not clipping.** `_gate.ts` skips anything
  inside a 1px clipped box. Any other exemption goes in `_gate.ts` with its
  reason, never in a route's spec.
- **The shared `Dialog` has no visible scrim** (`bg-surface-0/80` produces no CSS
  on a `var()` colour). Parked, not this route's fix.
- **Toasts exist now**: `toast.success(title, body)` and `toast.error(title,
  body)` from `components/ui/toast.tsx`. Successes leave after 4s; errors stay
  until dismissed. Radix hides everything outside an open modal from screen
  readers, the toast region included, so a decision made inside a dialog also
  needs a `role="status"` line inside the dialog.

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
