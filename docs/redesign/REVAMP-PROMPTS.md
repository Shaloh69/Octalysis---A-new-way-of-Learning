# REVAMP-PROMPTS.md
### The prompts for the revamp sessions — paste one, get one route

The revamp is deliberately many small sessions, not one large one. Each session
takes **one route**, rebuilds it, proves it, **rewrites §1 of this file for the
next session**, and stops. §1 is therefore always the prompt to paste next — it
is updated by the session before yours, not by hand. That is the whole
method, and it exists because the alternative already happened: R3 reached 41
boxes with `design/templates/` empty, and a clipped action column and unstyled
purple links both reached production unseen.

**Order:** every console route (`CONSOLE-REVAMP.md` §3) → **the student app
REMADE as a game, in `WEB-REMAKE.md` §8's order** (the look system, the shell,
then every route; ruled 30 Sep 2026, superseding `WEB-REVAMP.md` §6's order) →
moons for planets 00–04 (R4) → the act-1 minigames. Each minigame is a page like
any other: one session, one gate.

**Milestone: the first release is act 1 — stages 00–04 and the Prelim — as the
full experience.** Rebuilt pages, planet zoom, real orbits, moons and the act-1
minigames, so students use the finished product while 05–18 are built. §4 has
the scope, what exists today (very little), and the two blockers that are not
design work at all.

---

## 1. Start here — the next session: after T2 (the instructor's anti-cheat and T2 answers, parked defects, then CS2's plan)

```
Read docs/NEXT-SESSION.md sections 0zq and 0zp first (0zq: 9-15 Oct, T2 was built and pushed: a teacher
holds their own classes, through RLS and the API; teachers chat with each other with an active-now dot;
papers record lost focus, system keys, blocked copy/print, split screen and a second tab; eleven solvers
fixed so every calculation question builds three distinct choices). SQL files 20-23
(addendum-class-scope, -class-avatars, -staff-chat, -sitting-guards) are on the deployment. Then
docs/TEACHERS-AND-SUBJECTS-PLAN.md section 5 (5.9 holds every ruling, including ruling 4: exams are global,
stage checks and moons follow the class's BOOK, which is T3), docs/ANTI-CHEAT.md section 6 (four questions
for the instructor), db/CLAUDE.md "T2, staff chat and the sitting guards", and root CLAUDE.md: hard rules 3,
8, 9 and 10, "THE HARDEST RULE", "NEVER PROCEED TO ANOTHER PAGE". Do not re-derive what those carry.

Run pnpm phase. Show the table, say the percentage (239/245, 98% on 15 Oct; R3 87/88, R4 46/48,
R5 21/24, every open box a person's; T2 and the anti-cheat have no box). Say plainly whether Prelim-worth
of data is okay to run on students, checking the five conditions: on 15 Oct it was NOT (39 of the act-1
bank's 96 live; stages 03 and 04 still at review; deployment invariants 0 failures, 3 warnings).

FIRST, look at the deployment: the 15 Oct push built on Render and both Vercel apps (bundle contains
"staff-threads" and "sitting-guards"' event kinds; the API answers 401 to GET /api/v1/chat/staff). No
teacher credential is on this machine, so a signed-in look at the deployed console is the instructor's;
ask them to open /students, /locks and /chat as the admin (Engr. MJ Butaya holds BSCPE-4A, BSECE-4A and
TEST-SITTING since the rollout; Mr. Engi Shem holds BSCPE-2A) and report what they see.

Confirm everything is green AGAINST BUILDS: start Docker Desktop after a reboot; kill orphaned API trees and
previews by PID; pnpm db:reset (TWENTY-THREE SQL files), THEN node scripts/db-demo.mjs (it now seeds
two T2 accounts: eeeeeeee-...0001 a teacher with no class, eeeeeeee-...0002 an admin holding none); ONE
pnpm dev:api, proven with GET /readyz after every reset; build each app in the foreground, previews with
run_in_background (pnpm --filter @octa/web exec vite preview --port 5185; @octa/console on 5186); export
OCTA_WEB_URL and OCTA_CONSOLE_URL. Every API test run and pnpm verify empties the seeded database: reset
then reseed before Playwright. Read pnpm verify's exit code with $?.

The work, in this order, asking first where the instructor has not ruled:
1. The instructor's answers to docs/ANTI-CHEAT.md section 6 (Guided Access / App pinning sentence on the
   start prompt; Safe Exam Browser for exams; whether any new signal should hand a paper in) and to the
   open T2 question in 5.9 (stage-check windows per class before T3: recommendation wait). Write each into
   its doc. Build only what is ruled in, each through its page gate.
2. Parked defects (each its own page gate): the web tour's Escape works only with focus inside the popover
   (port the console's document-level listener to apps/web/src/shell/Tour.tsx); the console's /teachers page
   should show "n sections have no class" (T2 plan 5.1) — none exist on the deployment now, but the import
   path can still be reached by an admin who does not hold the section.
3. Then CS2 (a subject as its own star system; docs/COURSE-STUDIO-PLAN.md section 5): plan first, stop for
   approval. Ruling 4 makes stage checks and moons per BOOK; CS2/T3 owns that.

Still owed by the instructor (do not build around them): the first teacher roster import and a real claim;
whether /teachers leaves Records; which STUDY-AND-BOT-PLAN section 4 features to build; the four engine
keys; approving the 57 act-1 items at review (03 and 04; the Prelim needs 96 live), the 131 questions for
09-12, chapter drafts 08-13, 17 figures, 8 summaries; the screen-reader pass; removing the two TEST-PROFILES
sections and two banned throwaway accounts (append-only guards).

Hard rule 10 binds. Never stage apps/console/.env.example or any scripts/.*.tmp.* file (git add a whole
folder has swept them in twice: add files by name). Before the last commit run pnpm changelog and add the
day's entry to content/changelog/highlights.json and the roadmap.

End: pnpm phase with the percentage, the Prelim sentence checked, docs/NEXT-SESSION.md and PROGRESS.md
updated, REVAMP-PROMPTS.md section 1 rewritten for the session after, committed and pushed, and the next
prompt given in one plain fenced block.
```

## 1b. Parked — the session after: CS2 (a subject as its own star system)

No prompt is written yet: it is written by the T2 session, from
`docs/COURSE-STUDIO-PLAN.md` §5. The order after it is the student bot and Study
Session, then the app with CS3 (`docs/COURSE-STUDIO-PLAN.md` §4).

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
2. ~~**Stage 00 gates stage 01.**~~ **BUILT 30 Sep 2026.** The instructor ruled
   on 25 Sep 2026 that **a non-gradeable prerequisite never blocks**;
   `is_stage_unlocked()` now counts only gradeable prerequisites and the API's
   `lockReason` names only those, so stage 01 is open from the start. Locally
   only until the schema is pushed to the deployment.

### Order

`/items` → approve act 1 → decide stage 00 → the rest of the console →
attempt runner → stage reader → flat map → **the remake (`WEB-REMAKE.md` §8:
the look system → the shell → 3D map with zoom and orbits → every route again)** →
**moons for 00–04** → **act-1 encounters, one per session like any page** →
`/app/work`, login → **ship act 1** → then 05–18.

Moons land with the zoom, never before it — moons on a map nobody can zoom into
are decoration.
