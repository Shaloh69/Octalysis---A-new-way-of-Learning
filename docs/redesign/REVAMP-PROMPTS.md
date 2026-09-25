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

## 1. Start here — the next session: `/locks`

*Rewritten 25 Sep 2026 by the `/signin` session, the second console route
through the gate. Phase at handover: **R3 live at 43 / 72 (60%)**; all tracks
**130 done · 80 to-do (210 items, 62%)**. `pnpm phase` is the count, not this
line.*

> Read `docs/redesign/CONSOLE-REVAMP.md` and `docs/redesign/WEB-REVAMP.md` in
> full, then root `CLAUDE.md`'s revamp rules, then **`docs/NEXT-SESSION.md` §0a
> and §0b** (seven things the `/items` session parked, five the `/signin` session
> parked). Do not re-derive what those carry.
>
> Run `pnpm phase`. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in `CLAUDE.md` rather than remembering them.
> (On 25 Sep it was NOT: all 96 act-1 items sat at `review`, 0 live, and live
> Supabase was last measured empty and stale.)
>
> **Confirm the two finished routes are still green before touching anything**,
> with `OCTA_WEB_URL` and `OCTA_CONSOLE_URL` set to `http://localhost:5184`:
> `npx playwright test design/specs/console-items.spec.ts` (29 passed, 5 skipped)
> and `npx playwright test design/specs/console-gate.spec.ts
> design/specs/console-bootstrap-credentials.spec.ts` (53 passed, 5 skipped). The
> skips are 1440-only tests by design. If either is red, that is this session's
> work.
>
> **THIS SESSION IS ONLY FOR `apps/console` `/locks`. NOTHING ELSE.** Not a
> second route, not a quick fix elsewhere, not the student app. If you find a
> defect on another page, write it down in `docs/NEXT-SESSION.md` and leave it.
> The last thing this session does is rewrite this prompt for the next one.
>
> 1. Bring the local stack up: `pnpm db:up` (check `docker ps`; Docker Desktop
>    stops silently), then **`pnpm db:reset && node scripts/db-demo.mjs`**,
>    `pnpm dev:api` on 8090, console on **5184**
>    (`pnpm --filter @octa/console dev --port 5184 --strictPort`), and
>    `pnpm dev:token` for a session. 5173 and 5174 belong to other projects. If
>    8090 or 5184 already answer, confirm they are OURS (the process command
>    line, and the page title "OCTA Console") before trusting them. **After ANY
>    API test run, reset, do not just re-demo:** the API suite leaves 22 live
>    stage-07 fixture items behind and `db-demo` only adds.
> 2. **`/locks` has NO URL to capture.** `TEMPLATE-LINKS.md`'s row says "build
>    from `PAGE-SPECS.md` directly; closest structural reference is a permissions
>    matrix — any admin-panel roles × resources grid". That is a lead, not a
>    template. Find a real, capturable page with a dense two-axis grid of toggles
>    (a roles × permissions matrix), capture it with Playwright into
>    `design/templates/console/locks/template.png` at 1440 and 380, **open the
>    PNGs and look**, and write `SOURCE.md` with the URL, date, HTTP status, what
>    rendered, and why it beat the alternatives you tried. Put the URL in the
>    `TEMPLATE-LINKS.md` row. Then `SPEC.md`: structure taken, what is not
>    copied. Colours and fonts are ours.
> 3. **Audit against `PAGE-SPECS.md` §`/console/locks`** before building. It
>    plans: students × stages grid, click to toggle, **shift-click for bulk**,
>    three visual states (auto / manually unlocked / manually locked), a reason
>    prompt on every toggle writing `audit_log`, **hover shows who overrode it,
>    when and why**, and **section-level and scheduled (`unlock_at`) overrides on
>    their own tab**. Read `LocksPage.tsx` (286 lines) and say which exist. On a
>    first read, shift-click bulk and the section/scheduled tab do not. Name each
>    missing one, plan it, **and ask before building it**. Hover-only
>    information fails at 380 and for keyboard users; say how the page carries it
>    instead. **Hard rule 4: the page renders `is_stage_unlocked()`'s answer and
>    never computes a lock.**
> 4. **Specs.** There is no `console-locks.spec.ts`; `CONSOLE-REVAMP.md` §1
>    names that file, so the six go there, importing `design/specs/_gate.ts`
>    (see the `/items` and `/signin` specs for the pattern, including assertion
>    6's **positive control**). `/locks` is already covered in part by
>    `console-teaching.spec.ts` (its "SAVING state" describe) and
>    `console-audit.spec.ts`: **extend, never delete them; both must still
>    pass.** **Intercept every lock write** in your spec: `console-audit.spec.ts`
>    once wrote GLOBAL locks to shared state, and a spec that toggles real locks
>    to prove a layout is changing what a student can open. **Watch them fail
>    first.**
> 5. **Rebuild the page.** Not improve: rebuild. Toasts, loading states and
>    transitions per `.claude/rules/design.md`. `<Toaster />` is at the app root
>    now (`App.tsx`), so `toast` works everywhere. Specific to this route:
>    - It is **the densest grid in the app**: 19 stages × every student. At 380
>      it cannot be 19 columns. Decide the reflow and write it in `SPEC.md`.
>    - **The reason prompt is the shared `Dialog`, whose scrim renders nothing**
>      (`NEXT-SESSION.md` §0a.1: `bg-surface-0/80` emits no CSS on a `var()`
>      colour). It is a shared primitive: fixing it changes every console dialog
>      and every spec that opens one. Decide whether this route owns that fix
>      and say which you chose; if you fix it, run every console spec after.
> 6. Green on all six, both widths, plus the route's own structure tests.
>    Capture `current.png` and `current-380.png` with Playwright against seeded
>    fixture data only (never a real name), then **open both and look at them**.
>    Write `motion.md`. **A full console spec run rewrites TWO committed PNGs:**
>    `git checkout -- design/item-review/` before committing.
> 7. Tick **`/locks`** under the R3 "Console revamp" box in the same commit as
>    the work. Commit with explicit paths (a staged `git rm` rides along with the
>    next commit otherwise). Commit and push.
> 8. **Rewrite §1 of `docs/redesign/REVAMP-PROMPTS.md` for the next session**
>    (`/students` and `/students/:userId`, #4 in `CONSOLE-REVAMP.md` §3), carrying
>    forward what this session learned. Update the phase figures. Commit and push
>    that too.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and **end your last message with the rewritten §1 prompt in
> one fenced code block, plain text with no `> ` markers, ready to copy and
> paste**. Then **stop**. Do not start the next route.

**What the `/signin` session learned that every later route needs:**

- **A green gate is not a finished page.** `/signin`'s six assertions were
  already green on the OLD page. Everything that went red came from the route's
  own tests: the template's structure, the failure state, the missing controls.
  Write those too. The six are the floor, not the spec.
- **Look, every time: the gate cannot see sibling layers.** The first rebuild
  had a bus trace running through a caption like a strikethrough, with every
  spec green. `contrastFailures` finds a background by walking *ancestors*, and
  the backdrop is a sibling. Found in a screenshot, then held by "no text sits
  on a bus trace" in `console-gate.spec.ts`. Any route with a layer painted
  beside its text rather than behind it needs the same kind of test.
- **`clip-path` on a bordered box cuts the border off the diagonals.** A notched
  frame is two real boxes: the outer one the border colour, the inner one the
  surface. Real elements, not a `::before`, or the contrast gate measures text
  against the border colour.
- **A failure message is part of the page, not a toast.** It belongs next to the
  control that caused it, stays until the next attempt, and is `role="alert"`.
  Toasts confirm changes that happened; `toast.success` on the page you land on
  works because the toaster is at the app root.
- **Distinguish "wrong" from "not checked".** The console used to tell a
  teacher their password was wrong when the service had not answered. Any
  route whose write can fail for a network reason must not word it as the
  user's mistake.
- Still true from `/items`: a skip that fires on a race is a test that stopped
  existing (read the *skipped* count); measure colours on a settled frame
  (`settle()`); any new exemption goes in `_gate.ts` with its reason.

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
