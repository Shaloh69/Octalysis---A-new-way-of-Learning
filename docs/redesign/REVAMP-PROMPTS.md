# REVAMP-PROMPTS.md
### The prompts for the revamp sessions — paste one, get one route

The revamp is deliberately many small sessions, not one large one. Each session
takes **one route**, rebuilds it, proves it, and stops. That is the whole
method, and it exists because the alternative already happened: R3 reached 41
boxes with `design/templates/` empty, and a clipped action column and unstyled
purple links both reached production unseen.

**Order:** every console route (`CONSOLE-REVAMP.md` §3) → every student route
(`WEB-REVAMP.md` §6) → moons (R4).

**Milestone:** ship the Prelim with the student app rebuilt and subtopic moons
live. §4 says what that actually requires, and most of it is not design work.

---

## 1. Start here — the first revamp session

> Read `docs/redesign/CONSOLE-REVAMP.md` and `docs/redesign/WEB-REVAMP.md` in
> full, then root `CLAUDE.md`'s revamp rules. Do not re-derive what those carry.
>
> Run `pnpm phase`. Show the table, say the percentage, name the live phase.
> Then state plainly whether Prelim-worth of data is okay to run on students,
> checking the five conditions in `CLAUDE.md` rather than remembering them.
>
> **This session is `apps/console` `/items`, and nothing else.**
>
> 1. Bring the local stack up: `pnpm db:up` — check `docker ps`, Docker Desktop
>    stops silently — then `pnpm db:reset && node scripts/db-demo.mjs`,
>    `pnpm dev:api` on 8090, console on **5184**, `pnpm dev:token` for a session.
>    5173 and 5174 belong to other projects and both answer 200.
> 2. `design/templates/console/items/template.png` is already captured and
>    verified. Read it and `SOURCE.md`. Write `SPEC.md` beside them: the
>    structural decisions you are taking, and what you are deliberately not
>    copying. Colours and fonts are always ours.
> 3. **`design/specs/console-items.spec.ts` ALREADY EXISTS** — 174 lines, four
>    passing tests covering row density, the 30-exposure rule appearing once,
>    flagged items explaining themselves in words, and every column surviving.
>    **EXTEND it. Do not overwrite it.** Those four are regression cover someone
>    earned — the density one exists because that page was once a card list — and
>    they must still pass at the end.
>
>    Add the six assertions from `CONSOLE-REVAMP.md` §2, at 1440 and 380. **Watch
>    the new ones fail first.** The action column is clipped in production, so the
>    clipping assertion must go red before you touch the page.
>
>    Check `design/specs/` before writing a spec for any route — 18 exist, nine
>    of them console.
> 4. **Rebuild the page.** Not improve — rebuild. You may replace it entirely.
>    It must carry toasts, loading states and transitions per
>    `.claude/rules/design.md`; none of the three exists today.
> 5. Green on all six, both widths. Capture `current.png` and `current-380.png`
>    with Playwright, then **open both and look at them** — a green spec is not
>    seeing. Write `motion.md`.
> 6. Tick the R3 box in the same commit as the work. Commit and push.
>
> Show me the screenshots and the spec output, say which assertions you ran
> versus assumed, and **stop**. Do not start the next route.

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
> One route. Screenshots, spec output, assertions run versus assumed. Tick the
> box in the same commit. Commit and push. Stop.
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

## 4. The milestone — ship the Prelim, with moons

The revamp is not the blocker for shipping. Say this plainly every session,
because it is easy to spend a month on design and ship nothing.

**Design work required before the Prelim ships:**

- `/items` — 183 items must be reviewed through this page and its action column
  is clipped. **This is the one route the Prelim genuinely depends on.**
- `/app/stage/:id/check` — it grades.
- `/app/stage/:id` — no control exists to leave a stage.

**Not required for the Prelim, and must not be allowed to hold it up:** the 3D
map's camera zoom, Keplerian orbits, moons, `/gradebook`, `/live`, and every
console route past `/items`. They are the right work and they are not on the
critical path.

**Not design work at all, and both still blocking:**

1. **0 of 183 items are `live`.** The engine samples `where status = 'live'`, so
   every attempt fails to fill at Start. Act 1's 96 items must be approved.
2. **Stage 00 gates stage 01 and cannot be completed.** It is
   `gradeable = false`, gets no stage check, and `is_stage_unlocked()` wants
   every prerequisite at 70%. A real student is told *"Unlocks when Stage 00
   reaches 70%. You're at 0%."* Three options in `NEXT-SESSION.md` §3a; the
   instructor's call.

**Moons are R4 and land with the map's zoom** (`WEB-REVAMP.md` §3), never
before it — moons on a map nobody can zoom into are decoration. R4 is 0/13 and
its checklist already exists.

So the honest ordering is: `/items` → approve act 1 → decide stage 00 → the two
student routes that carry an attempt → **ship the Prelim** → then the map, the
orbits and the moons.
