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

## 1. Start here — the next session: the assistant, B0 online if keys, then B3's second half

```
Read docs/NEXT-SESSION.md section 0zg first: B1's upload is done (381
figures on the deployment), B3's first half is built (the one draft(),
four adapters, the chain, the key seal, the tick and its addendum, the
TWELFTH SQL file, on the deployment), B0 online still waits on keys, one
thing parked. Then docs/AI-ASSISTANT-PLAN.md v5 (section 4-now, and section
9: the B1 upload and B3 records, and "B3's second session owes") and
.claude/rules/assistant.md, which binds every line of assistant code. Then
root CLAUDE.md hard rules 2, 8 and 10, and db/CLAUDE.md's last two "Never"
entries. Do not re-derive what those carry.

Run pnpm phase. Show the table, say the percentage, name the live phase. On
8 Oct it was 238/245, 97%: R3 87/88, R4 46/48, R5 20/24, every open box a
person's. Then say plainly whether Prelim-worth of data is okay to run on
students, checking the five conditions in CLAUDE.md. On 8 Oct it was NOT:
on the deployment stage 01 has 13 live, 2 at review, 2 retired, and 02-04
have none live; deployment invariants 0 failures (3 warnings).

Confirm everything is green before touching anything, AGAINST BUILDS. After a
reboot, start Docker Desktop first. Kill orphaned API trees and previews
(8 Oct found three dev-api trees and both previews still running). Run pnpm
db:reset, THEN node scripts/db-demo.mjs (TWELVE SQL files now:
addendum-assistant-tick.sql is the last). Start ONE pnpm dev:api and prove
it with a real GET (readyz); curl again after every db:reset. Build and
preview apps/web on 5185 and apps/console on 5186, and export OCTA_WEB_URL
and OCTA_CONSOLE_URL. Every API test run empties the seeded database, so
reset and reseed before any Playwright run. pnpm test:assistant runs the
Python tests (25, about 45 s, the book PDF at the repo root).

Do NOT start Ollama. It is installed and paused on purpose (round five).
No assistant code may run a model on a laptop; the database refuses a step
on ollama_local.

The deployment: API https://octa-api-noq2.onrender.com, student site
https://octa-web-dusky.vercel.app, console https://octa-console.vercel.app,
Supabase ddvxkbcelpqydnjkffdr (the root .env's SUPABASE_DB_SESSION; never
print it; SUPABASE_DB_DIRECT and _POOLED name ANOTHER project, parked).
Untracked scratch helpers in scripts/: .deploy-q.tmp.mjs (runs SQL on the
deployment after checking the ref), .vault-tick.tmp.mjs (set the tick's two
Vault secrets), .b0-crop.tmp.py, .b0-cloud.tmp.py, .b0-local.tmp.py, and
the older ones 0zc lists.

First, check what the instructor has done (names only, never a value):
the four engine keys in the root .env (ANTHROPIC_API_KEY, OLLAMA_API_KEY,
GROQ_API_KEY, CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN), and on Render
CRON_SECRET (equal to the root .env's) and ASSISTANT_KEY_SECRET. Render's
values cannot be read from here: POST /internal/assistant/tick with the
root .env's CRON_SECRET as x-cron-secret answers 202 once Render has it,
401 until then.

The work, in order:

1. B0 ONLINE, if any key is there: pip install anthropic; python
   scripts/.b0-crop.tmp.py <scratch dir>, open the contact sheet, then
   scripts/.b0-cloud.tmp.py over each engine with a CURRENT vision model
   (Claude: claude-opus-5-5). It has never run; expect to fix it. Record
   recall, invented labels, valid JSON, seconds, tokens and the quota each
   reply reports in plan section 9, say which engine suits which step, and
   update services/api/src/assistant/engines/catalogue.ts (provisional for
   the free engines until then). RECORD one real reply per engine (key
   scrubbed) and move the adapter tests in
   services/api/test/assistant-engines.spec.ts onto them.
2. The tick end to end on the deployment, once Render has CRON_SECRET: a
   throwaway running job under the instructor's book with one step; within
   two minutes cron -> pg_net -> Render should claim it and settle it
   no_handler, and close the job failed. Check net._http_response for the
   202. Then delete the job.
3. B3's second half (plan section 9, "B3's second session owes"): a
   not_before column on a waiting step, in its own idempotent addendum
   (the thirteenth), pushed to Supabase BEFORE the code, so an
   out-of-quota step is not re-claimed every minute (claimNext must skip
   it); and the chain wired into a step: open the owner's keys (openKeys),
   run the chain (runChain), and settle the step with what ran (engine,
   model, key_id, tokens, ms, cost) or put it back waiting with not_before
   from the shortest retry-after. Tests red first; one denial at least
   (a step never runs on another teacher's key: as_own_key in the DB, and
   openKeys only ever reads the step's owner).

Still owed by the instructor (do not build around them): the four engine
keys; CRON_SECRET and ASSISTANT_KEY_SECRET on Render; approving the 83
act-1 items at review (the Prelim needs 96 live), the 131 questions for
09-12, the chapter drafts 08-13 and 17 figures on /content, and the planet
summaries (R3's last box); the screen-reader pass; accepting the moon
work's lock-layer changes (REDESIGN-SIGNOFF.md section 5).

Hard rule 10 binds. Never stage apps/console/.env.example (the instructor put
a key in it). Any visual change goes through its page gate.

End: pnpm phase with the percentage, the Prelim sentence checked,
docs/NEXT-SESSION.md and PROGRESS.md updated, REVAMP-PROMPTS.md section 1
rewritten for the session after, committed and pushed, and the next prompt
given in one plain fenced block.
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
