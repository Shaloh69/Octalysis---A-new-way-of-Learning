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

## 1. Start here — the next session: the shell

*Rewritten 30 Sep 2026 by the look-system session (`WEB-REMAKE.md` §8 #1),
which built the tokens, faces, frames, per-planet biomes and the realm, and
no page. The shell is next (§8 #2). Phase at handover: **R3 live at 59 / 84
(70%)**, R4 2 / 29; all tracks **146 done · 76 to-do (222 items, 66%)**.
`pnpm phase` is the count, not this line. The prompt is in a plain block so
it pastes exactly as written.*

```text
Read docs/redesign/WEB-REMAKE.md in full: it owns this remake (the two realms,
the HUD, the biome inside a planet, the assessment ruling, the transitions,
type, the order). Then design/templates/web/_direction/LOOK.md (what the look
system built on 30 Sep, and section 6 on how to use it), SOURCE.md beside it,
and OPEN the four images this session starts from: star/starfield-skill-tree-2,
star/no-mans-sky-discoveries, star/starfield-hud and biome/stardew-valley-skill-level
(and star/starfield-map for its key-hint bar). Then OPEN design/look/captures/
(the twenty look-sheet captures, the face and frame comparisons, reader-*.png).
Then WEB-REVAMP.md §2-§4, BIOME-AND-LOADING-SPEC.md §1b and §4 (the warp and
the biome arrival, both still unbuilt), .claude/rules/design.md (toasts,
loading, transitions), root CLAUDE.md's revamp rules, and docs/NEXT-SESSION.md
§0a to §0t (§0p.1-5, §0q.1 and §0r.2 are THIS session's; §0t is what the look
system left). Do not re-derive what those carry.

Run pnpm phase. Show the table, say the percentage, name the live phase. Then
state plainly whether Prelim-worth of data is okay to run on students, checking
the five conditions in CLAUDE.md rather than remembering them. (On 30 Sep it
was NOT. Locally: stages 00-04 had 112 content blocks; all 96 act-1 items at
review, 0 live, so no paper fills and every Start answers 500 (§0e.1); stage 01
open for 0 of 24 seeded students (§3a decided, not built); run_invariants() 0
failing, 4 warnings (INV-18, 25, 27, 29); 0 of 19 planet summaries approved.
The DEPLOYMENT, last measured 28 Sep: no content for 00-04 and no items at all,
§0h.1.)

Confirm everything is still green before touching anything, AGAINST BUILDS
(§0j.2, §0p.9): pnpm --filter @octa/web build, then npx vite preview --port 5185
--strictPort from apps/web in the background (rebuild AND restart it after any
change), OCTA_WEB_URL and OCTA_CONSOLE_URL = http://localhost:5185, and the
whole web suite (every design/specs/*.spec.ts except console-*). On 30 Sep:
338 passed, 102 skipped, 0 failed (337 and 103 when solar-system.spec.ts's
frame-rate guard fires on a loaded machine, §0t.12). The console, built and previewed on 5184:
756 passed, 58 skipped, 0 failed. The API suite: 646 passed, 1 skipped. pnpm --filter @octa/tokens
test: 38 passed. pnpm --filter @octa/web test: 118 passed. pnpm scan:bundle:
CLEAN on both bundles (since 30 Sep: the env schemas moved to
@octa/contracts/env, §0t.10). Read the skips with a JSON reporter and read
their REASONS (§0q.3). A full run writes to the database: reset and re-demo
between suites, and PROVE the dev API after every reset with a real GET (a
reset killed it again on 30 Sep, §0c.1, and a burst of 152 console failures was
that and nothing else). If anything is red, that is this session's work.

THIS SESSION BUILDS THE SHELL (WEB-REMAKE.md §8 #2) and no page:
  a. Import @octa/tokens/looks.css into apps/web after tokens.css. Every page
     recolours at once, so in the SAME session the runner's paper takes
     data-theme="<the student's variant>" (the paper follows the variant,
     instructor 30 Sep, LOOK.md §6), and a spec renders one paper as two
     students with different biomes and asserts identical computed styles.
  b. The nav, in both dresses. The star system: a tab strip (Map, Stages,
     Progress, Your work, Settings) in Oxanium with ← and → either side,
     real links with aria-current, every one reachable by Tab. At 380 the
     labels wrap (§0t.5): choose a bottom bar of the same five or shorter
     labels, and record it. Inside a planet: Kenney tabs
     (.frame-pixel-button) attached to the frame's top edge, the current one
     raised. ASK the instructor to confirm the in-planet items before building
     them: proposed Reading, Moons, Check (Labs when they exist) and Leave
     planet, which returns to the star system with this planet selected.
  c. The mission tracker, top-left on every star route (Starfield's MISSION
     STATUS): the stage lib/next-stage.ts chooses and its next step, in words,
     with one control to go there.
  d. The key-hint bar, bottom-right at 1440: each hint a real keyboard
     shortcut AND a real button that does the same (Esc Back, M Map, and the
     route's own). A hint that does nothing is deleted. Hidden at 380.
  e. The Register Bar as the ship's readout strip, and its defects: §0p.3
     (the idle dashes wrap one per line at 380), §0p.4 (the empty band above
     it), §0p.5 (it and Report a problem sit above a modal's scrim).
  f. The realm switch and both transitions: star to biome is §4.1's warp with
     the token swap at the warp's peak (under full cover, no frame mixes two
     looks), then the biome resolves and the frame and nav settle; biome to
     star is the reverse, landing on the map with the planet selected; planet
     to moon changes no realm; a deep link or reload has no warp;
     prefers-reduced-motion is a cut; QA_MODE=1 freezes the loops. motion.md
     records each and its reduced-motion path. Motion is never the only
     signal: the nav's words change with the realm.
  g. The other shell defects: §0p.1 (--bg is defined nowhere), §0p.2 (the nav
     is inside <main>; move it out, a landmark fix too), §0q.1 (Report a
     problem is a full-width bar, not a pill), §0r.2 (on /app/map no nav item
     is current).
  h. Its own template and gate: capture design/templates/web/shell/template.png
     (from the four references, or a better real screen, recorded why) with
     SOURCE.md; SPEC.md listing every control against the mandate's four tests
     and its realm; design/specs/web-shell.spec.ts with the six assertions at
     1440 and 380, AA computed on every colour set the shell can show (three
     HUD variants on a star route, all seven biomes on a planet route, via
     _realm-fixture.ts forcePlanetBiome), and the realm's own assertions:
     data-realm and data-biome right on the first frame, a star route never
     shows a biome, a planet route's nav and frame wear its planet's biome,
     the transitions in and out, a cut under reduced motion.
Extend every existing spec rather than overwrite it; keep every assertion and
move selectors to the new hooks. Write a defect on another page into
docs/NEXT-SESSION.md and leave it.

Learned the hard way, carried forward: the Bash tool's heredocs strip
backslashes and a double-quoted node -e runs backticks (write scripts with the
Write tool); editing services/api/src while a suite runs restarts the dev API
and fails everything in flight; a hand-written data-biome now races the realm
(use forcePlanetBiome); an app must never import @octa/contracts/env; a token
turned into a var() alias must still be seen by check-contrast.mjs (it now
resolves :root aliases and throws on one it cannot); the Kenney frames are
paint, so use .frame-pixel and its token ring, never a bare border-image; the
first-ever deep link into a planet paints neutral until cosmetics land (§0t.3,
decide whether the shell holds that first paint).

Stack: docker ps first (Docker Desktop has stopped four times; start it from
its .exe), pnpm db:up, pnpm db:reset && node scripts/db-demo.mjs, pnpm dev:api
on 8090, pnpm dev:token student (seeded student 232129006: act 1 is 00 city,
01 cave, 02 jungle, 03 desert, 04 ocean). 5173 and 5174 belong to other
projects; use 5183 (dev), 5184 (console) and 5185 (the web build), and confirm
each port is OURS by process command line and page title.

Finish: run pnpm typecheck, pnpm lint, the tokens and web unit tests, the API
suite if the API changed, the whole web suite and every console spec, against
builds; pnpm scan:bundle must stay clean on both bundles; git checkout --
design/item-review/. Capture every shell state at 1440 and 380 in every
variant and biome it can show, and OPEN every PNG. Tick "The shell" under
"Student app REMAKE" in R3 in the same commit as the work and move R3's count in
docs/PROGRESS.md. Commit with explicit paths, checking git status for anything
already staged first, messages from a file. Rewrite §1 of
docs/redesign/REVAMP-PROMPTS.md for the next session (/app, the 3D map,
WEB-REMAKE.md §8 #3: selection, the ~700ms zoom, the sidebar as the planet's
window in its biome, Kepler, and the planet tint per planet, §0t.4), commit and
push. Show me the captures and the test output, say what you ran versus
assumed, and end with the rewritten §1 prompt in one fenced code block, plain
text with no > markers. Then stop.
```

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
attempt runner → stage reader → flat map → **the remake (`WEB-REMAKE.md` §8:
the look system → the shell → 3D map with zoom and orbits → every route again)** →
**moons for 00–04** → **act-1 encounters, one per session like any page** →
`/app/work`, login → **ship act 1** → then 05–18.

Moons land with the zoom, never before it — moons on a map nobody can zoom into
are decoration.
