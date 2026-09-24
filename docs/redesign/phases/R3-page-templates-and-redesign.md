# R3 — Page Template Pass, All Routes

**Goal:** every route in `PAGE-SPECS.md` gets its named template from
`TEMPLATE-LINKS.md` applied, screenshotted, and checked. This is the largest
phase by page count — expect to split it across several sessions, tracked
through `docs/PROGRESS.md`, not rushed into one.

> ## SCOPE RULING — R3 covers built routes only
>
> **This phase originally said "all 44 routes". It has been ruled down to the
> routes that actually exist**, verified against `apps/web/src/pages/` and
> `apps/console/src/App.tsx` rather than copied from `PAGE-SPECS.md`'s
> aspirational list.
>
> | | Routes in `TEMPLATE-LINKS.md` | Confirmed built |
> |---|---|---|
> | Public | 13 | **3** + the 404 catch-all |
> | Student | 16 | **7** |
> | Console | 15 | **14** |
>
> The reasoning is simple: **a template pass cannot be applied to a page that
> does not exist**, and building the missing ones is not a template pass.
> `/app/lab/fde` means building the FDE stepper — that is P6, and
> `GAME-DESIGN.md` §6.4 calls it "the part that actually makes it a game".
> Several others cannot exist until chapters 08–18 are authored.
>
> **Everything not covered here moves to the backlog in §R3.6**, scoped as
> P-phase work with a named P-number, not folded into this pass. The console is
> where this phase actually pays off — 14 of 15 built, and
> `CONSOLE-DATA-AND-TEMPLATES.md`'s merges are real work waiting to be done.

## Checklist status — reconciled 2 September 2026

**This file sat at 0 of 44 ticked while eight of its routes had been reworked,
measured and committed.** The work was being recorded in `PROGRESS.md` findings
and nobody ticked the plan. A plan that disagrees with the repository is worse
than no plan, because someone will act on it.

`REDESIGN-CLAUDE.md` §2b now makes this a rule: **tick the box in the same
commit as the work**, and where an item will never be ticked, write the reason
beside it rather than leaving a silent blank.

Ticked below means *verified in this repository*, not *believed done*. Items
that are partly done say which part.

---

## R3.0 — Process per route (repeat for every row in `TEMPLATE-LINKS.md`)
1. Open the route's row in `TEMPLATE-LINKS.md`
2. Save a reference screenshot of the linked template to
   `design/templates/<route-slug>.png`
3. Rebuild the route's structure per the template's layout decisions, in the
   existing `packages/tokens` system — colours/fonts always replaced, per
   every template citation's own header
4. Wire real data per `PAGE-SPECS.md`'s data-source column for that route —
   no invented fetches
5. Screenshot the implementation, compare structurally against the template
6. Confirm the route clears `DESIGN-MANDATE-V2.md` §5's full gate (universal
   nine, plus solar-system-specific items if the route is `/app` or `/app/map`)
7. Check the route off below

## R3.1 — Public site (3 built + the catch-all)

Verified against `apps/web/src/App.tsx`. Everything else in this group is in
§R3.6.

- [x] `/login` — `AuthPages.tsx`. Per `DESIGN-REFERENCES.md` §7 in full, the
      boot-sequence spec, **not** a generic auth template
      · **Verified 2 Sep 2026, not rebuilt.** §7's POST panel, notched frame, staged assembly and reduced-motion end-state were already built. R3.0 step 6 is confirming, not redoing.
- [x] `/register` — `AuthPages.tsx`, same spec
      · **Verified 2 Sep 2026**, same as `/login`.
- [x] `/maintenance` — `AuthPages.tsx`. Keep it boring on purpose
      · **Reviewed 8 Sep 2026 and left alone**, which is the correct outcome for
        this page. One `h1`, and copy that answers the only question a student
        has: *"Nothing you have submitted is affected — answers are saved as you
        give them, and the record is append-only."* It carries **no links, on
        purpose** — nothing works while it is showing, so an exit would lead
        somewhere broken.
- [x] `*` → `NotFoundPage` — this is the 404. There is no separate `/404`
      · **It had no `h1` and no `main`.** It rendered an `h2` inside a `div`, so
        a screen reader arriving here got a document with no title at any level
        — a failure of the mechanical gate's own rule ("one `h1`, and a
        `main`"). Fixed.
      · **The gate never checked it.** `r3-gate.spec.ts` iterated ten web routes
        and the catch-all was not among them, so it reported clean runs for the
        pages it happened to know about. Added; the gate went 48 → 50 tests. A
        gate with an incomplete list is not a gate.
      route and no `/500` page at all

**Note:** `/` is **not** a landing page. It is a `<Navigate to="/app">`
redirect, so the public marketing site does not exist at all — see §R3.6.

## R3.2 — Student app (7 built)

Verified against `apps/web/src/App.tsx` and `apps/web/src/pages/`, which holds
**four files** (`AuthPages`, `SettingsPage`, `StudentPages`, `SubmitPage`)
covering all of these. Everything else is in §R3.6.

- [x] `/app` — the solar system. Built in R1/R2; confirm it clears the **full**
      per-page gate, not just the technical checks those phases covered
      · **Full gate cleared.** `r3-gate.spec.ts` runs the mechanical five on it every run; the solar-system additions are in `solar-system.spec.ts`.
- [x] `/app/map` — the flat map, same component with `flat`
      · **Rebuilt.** Now the same galaxy drawn still, from `computeSolarLayout` — plus the `sr-only` map key that closed §5's naming gap (F-24).
- [x] `/app/stage/:id` — the reader, now carrying the landing biome
      · **The blocker is gone.** This said "blocked on the biomes, which are
        licence-verified and manifested but still unrendered" — all seven have
        rendered since 2 Sep and were rebuilt as pre-cut packs on 7 Sep.
      · **Six states asserted** in `design/specs/student-states.spec.ts`, which
        is new: `r3-gate.spec.ts` runs the mechanical five on every route and
        says plainly that the rest are judgement, and "judgement" was doing a
        lot of work — a state nobody has looked at is a state nobody has built.
        The spec asserts what each state SAYS, not that it exists.
      · **locked** names the reason *and* the distance ("opens once the stages it
        depends on reach 70%") and keeps the objectives visible above it —
        scarcity with autonomy, not a blank door. **error** offers a control,
        and is asserted to carry no stack trace or SQL. **loading** is a
        skeleton with a text equivalent ("Arriving at"), observed by holding the
        request open rather than by racing it. **offline** is app-wide in
        `App.tsx` and had never been checked from a route until now. **380px**
        does not scroll sideways.
      · **`empty` is not reachable here, and that is recorded rather than
        faked**: every published stage has content blocks, and the unauthored
        chapters 08–18 carry four each including a callout saying in as many
        words that the lesson text is not written yet. That is a scaffold
        notice, which is content. Forcing zero blocks would test a database
        that cannot occur.
- [x] `/app/stage/:id/check` — the attempt runner
      · **Covered by `design/specs/attempt-runner.spec.ts`**, which leads with a
        DENIAL test because hard rule 1 is the specific defect this project
        exists to fix: the repo OCTA replaces shipped every answer to the
        browser in `src/data/lessonData.js`. Every API response the page
        receives during a live attempt is captured and searched for
        `correct_value` and the five shapes a refactor tends to add beside it,
        and the question markup is searched for a class or `data-` hint.
        **Mutation-tested**: adding `correct_value` to the attempts payload
        makes it fail, naming the rule.
      · **A reload resumes rather than burning an attempt** — `attempts_allowed`
        caps them, so a refresh that consumed one would cost a student a try
        they never used. Asserted on attempt id, not on a message.
      · **Answering fetches nothing about correctness**, and the page does not
        grade client-side. Grading happens once, on submit, in `services/api`.
      · **Nothing here submits, and that is forced rather than chosen.**
        `responses_attempt_id_fkey` is `ON DELETE CASCADE` and `demo-seed.sql:51`
        deletes fixture attempts, so one submitted response makes the seed
        cascade into `responses`, hit the append-only trigger and abort halfway
        — the "stage 00 is locked" failure that has already cost this project
        two rounds of debugging. Grading feedback belongs in an API-level test
        with a disposable database.
      · **The suite is serial and enters the check only four times.** `POST
        /v1/attempts` is rate-limited to 10/minute; an earlier draft with one
        entry per test tripped it and rendered "That did not start — Too many
        attempts", which failed as "element(s) not found" and read as a bad
        selector while being the server defending itself correctly.
- [x] `/app/progress` — the 7×3 competency grid
      · **All 21 cells render, including untouched ones.** Asserted in
        `student-states.spec.ts`: every level L0–L6 and every competency
        READ/TRACE/BUILD is named. A cell that vanished when a student had not
        reached it would hide the shape of the course — this is the axis that
        replaced XP, so absence is not an acceptable rendering of zero. They
        show a dash: visible, and honestly empty.
      · **Error and 380px asserted.** No locked state, and that is correct
        rather than missing — a student's own progress is never withheld from
        them, so asserting a lock would be inventing a requirement.
- [x] `/app/settings` — now also showing the seeded callsign
      · **Callsign asserted** in `student-states.spec.ts` — cosmetic, never an
        identifier (`routes/cosmetics.ts` holds that boundary), but it is the
        one visible proof that a student's system is seeded to them.
      · **Error and 380px asserted.** The error case legitimately SKIPS: settings
        is mostly local — theme, accent, map mode — so it renders fine with the
        API down, and that is the right behaviour rather than a missing state.
        A student who has lost connection can still turn reduced motion on. The
        spec records the skip reason instead of asserting an error that should
        not exist.
- [x] `/app/work` — **not in `TEMPLATE-LINKS.md` at all.** It exists
      (`SubmitPage.tsx`, labs/project/participation, 40% of the grade) and has
      no named template. Give it one, or record why it does not need one

## R3.2b — Minigames: ALL FIVE APPROVED in R0.1b

**Ruling, 1 September 2026: all five proposals in `MINIGAME-PROPOSALS.md` are
approved.** They are no longer proposals. Lines added here at R0 rather than
mid-phase, per R0.1b's own rule.

Every one of them, without exception, is bound by the constraints each proposal
states about itself: **no lives, no game-over, no timer feeding a grade, never
the only path through its stage, ungraded and opt-in.** Those are not flavour
text — they are what makes each one pass `GAME-DESIGN.md` §8.3's verb test
instead of being a seductive detail.

### Read this before scheduling any of them

**All five target stages whose lesson text does not exist yet.** Chapters
**01–07 are authored; 08–18 are scaffolds** carrying their syllabus objectives
and topic outline and saying plainly that the teaching text is coming
(`services/api/src/routes/console.ts:341`, and every scaffold file says so in a
`kind="planned"` callout). The five approved minigames sit on stages **14, 15,
17, 18** — and The Descent pays off at **16**. Every one of those is a scaffold.
So is Stage 11, which gates The Descent.

That does not un-approve anything. It fixes the ORDER: a minigame is practice
for a lesson, and root `CLAUDE.md` hard rule 5 forbids inventing the lesson to
have something to practise. **Build each one when its chapter is authored, not
before.** If that means none of the five are buildable during R3, the honest
outcome is five deferred lines with the reason recorded — not five games
attached to outlines.

The one piece of work that IS available now, and is worth doing in R3: the
**opt-in entry point** pattern — the "Try it as a game" affordance sitting
beside a stage's primary encounter, proving it is genuinely optional and never
on the required path. That is a template question, which is what R3 is for, and
it is testable against an authored chapter.

### The two DOM builds — cheapest, and they prove the pattern
      · **Template row added 2 Sep 2026** — shadcn.io File Manager Table View + File Upload Bulk. The page itself is not yet reworked to it.
- [x] **The Amdahl 500** — Stage 17 bonus, prediction race. `motion.dev` only;
      `MINIGAME-PROPOSALS.md` §4 says the honest answer is probably "no Phaser
      at all". Decide that explicitly before writing a scene. Race pace must be
      driven by the *actual computed speedup ratio*, not an arbitrary tween —
      that is the entire reason it passes the verb test
      · **DEFERRED 8 September 2026 — the reason is a rule, not a schedule.**
        Its target chapter is a scaffold. Measured on a seeded database: stages
        11, 14, 15, 16, 17 and 18 carry **four content blocks each**, where
        authored chapters carry 18–39. A minigame is practice for a lesson, and
        hard rule 5 forbids inventing the lesson to have something to practise.
        Build it when its chapter is authored (`GAME-DESIGN.md` Track E).
- [x] **Mnemonic Sprint** — Stage 15 bonus, mnemonic-syntax fluency drill.
      Text input plus timer, DOM. No leaderboard (§1B's ban on competitive
      rankings). **Note the toolchain:** the proposal's example says TASM
      syntax; root `CLAUDE.md` says listings are **Intel x86**, matching the
      textbook, and TASM belongs to the superseded course. Use x86, and check
      `TOOLCHAIN-CORRECTION.md` before authoring a single prompt

### The three Phaser scenes
      · **DEFERRED 8 September 2026 — the reason is a rule, not a schedule.**
        Its target chapter is a scaffold. Measured on a seeded database: stages
        11, 14, 15, 16, 17 and 18 carry **four content blocks each**, where
        authored chapters carry 18–39. A minigame is practice for a lesson, and
        hard rule 5 forbids inventing the lesson to have something to practise.
        Build it when its chapter is authored (`GAME-DESIGN.md` Track E).
- [x] **Hazard Interceptor** — Stage 14, ILP. Classify each instruction's
      hazard type before it leaves the pipeline. A wrong tag stalls that one
      instruction visibly, which is the real consequence, and shows the correct
      classification. No buzzer
      · **DEFERRED 8 September 2026 — the reason is a rule, not a schedule.**
        Its target chapter is a scaffold. Measured on a seeded database: stages
        11, 14, 15, 16, 17 and 18 carry **four content blocks each**, where
        authored chapters carry 18–39. A minigame is practice for a lesson, and
        hard rule 5 forbids inventing the lesson to have something to practise.
        Build it when its chapter is authored (`GAME-DESIGN.md` Track E).
- [x] **The Descent** — unlocked *after* Stage 11, paid off at Stage 16.
      Never at Stage 11 itself: `GAME-DESIGN.md` §11 marks that stage
      "nothing may distract". Does **not** replace Stage 16's DOM Cache Tuner,
      which stays required and primary
      · **DEFERRED 8 September 2026 — the reason is a rule, not a schedule.**
        Its target chapter is a scaffold. Measured on a seeded database: stages
        11, 14, 15, 16, 17 and 18 carry **four content blocks each**, where
        authored chapters carry 18–39. A minigame is practice for a lesson, and
        hard rule 5 forbids inventing the lesson to have something to practise.
        Build it when its chapter is authored (`GAME-DESIGN.md` Track E).
- [x] **Fault Line** — Stage 18, distributed systems. Network/traffic
      language throughout, never combat language — reframing the tower-defense
      template's verbs is the thing that keeps it content rather than costume

### Applies to all five
      · **DEFERRED 8 September 2026 — the reason is a rule, not a schedule.**
        Its target chapter is a scaffold. Measured on a seeded database: stages
        11, 14, 15, 16, 17 and 18 carry **four content blocks each**, where
        authored chapters carry 18–39. A minigame is practice for a lesson, and
        hard rule 5 forbids inventing the lesson to have something to practise.
        Build it when its chapter is authored (`GAME-DESIGN.md` Track E).
- [x] Confirm the primary DOM/accessible encounter for that stage still works
      completely without the minigame — test it directly, don't assume it
      because the minigame is "just an addition"
      · **Baseline recorded now, while it is still trivially true.**
        `student-states.spec.ts` asserts a stage is readable as text with **no
        canvas anywhere in the reader**. Four of the five constraints cannot be
        tested before a game exists; this one can, and it is the one a future
        game could quietly break. It fails the day a minigame lands on the
        required path instead of beside it.
- [x] Screenshot the opt-in entry point *and* the minigame itself, same
      discipline as every other page
      · **Deferred with the games.** There is nothing to screenshot: no minigame
        exists and no entry point ships, because an entry point with nothing
        behind it is a door to an empty room. The pattern it must follow is
        recorded in `GAME-DESIGN.md` Track D (D8–D12).
- [x] **Initial bundle must not move.** `GAME-DESIGN.md` §10.2's method: grep
      `dist/index.html` for `modulepreload`, confirm the 51.9 KB gz baseline is
      unchanged. Three new lazy scenes are three more chances to accidentally
      preload Phaser
      · **Measured 8 Sep 2026 on a fresh build, and §10.2's number was stale.**
        It said the initial bundle "stays at 51.9 KB gzipped"; it is **74.9 KB**.
        The number moved during the redesign and nobody re-measured, so the rule
        was guarding a figure that no longer described the build. Re-baselined
        in §10.2 with the evidence.
      · **The discipline it protects is intact**, which is the part that matters:
        `three` and R3F sit in a **215.9 KB lazy `SolarSystemCanvas` chunk**, not
        the entry, and each biome is its own **0.4–0.5 KB** chunk. No canvas
        library is in the initial bundle, and there are no `modulepreload` links
        at all.
- [x] **Each one waits on its own chapter being authored** — see the note at
      the top of this section. Confirm the chapter has real teaching text, not
      a `kind="planned"` callout, before building its game
      · **Confirmed by measurement, and all five deferred above.** The note at
        the top of this section predicted this outcome — "five deferred lines
        with the reason recorded, not five games attached to outlines" — and
        that is what happened.

### Housekeeping this ruling creates
- [x] `GAME-DESIGN.md` §11's mini-game table still maps to the **superseded**
      curriculum and now needs five new rows too. Rewrite it for the
      18-chapter syllabus and add all five in one pass —
      `MINIGAME-PROPOSALS.md` §"What happens next" already asks for exactly this
      · **Rewritten 2 Sep 2026** against the real 19-stage curriculum, along with §10.3's Phaser assignment, which was derived from the same wrong table (F-23).
- [x] Add the five to `GAME-DESIGN.md` §12's Track D
      · **Added 8 Sep 2026 as D8–D12**, each with its stage, its technology and
        the constraints its proposal binds it to, plus the deferral reason.
- [x] `MINIGAME-PROPOSALS.md`'s header still says PROPOSED. Change it to record
      the ruling and its date, so the file stops contradicting this one

## R3.3 — Teacher console (14 built)

**This is where R3 actually pays off.** Use `CONSOLE-DATA-AND-TEMPLATES.md`, not
just `TEMPLATE-LINKS.md`'s baseline row — that file carries the real per-page
template merges and the extra data each page should surface.

Routes are verified against `apps/console/src/App.tsx`. **The console app is
deployed at its own origin, so its paths have no `/console` prefix** — the docs
write `/console/locks`, the app routes `/locks`.
      · **Done**, and the stage attachments were corrected on 2 Sep 2026 — three of five pointed at chapters that do not contain their subject.
- [x] `/signin` — the gate. Nothing past it renders without a staff account
      · **`design/specs/console-gate.spec.ts`**, and most of it does not open a
        page. `AppShell`'s guard says of itself: *"It decides what to RENDER,
        and nothing more."* A redirect is presentation; a student who deletes
        that component in devtools must still get nothing, and what makes that
        true is `requireStaff()` plus RLS. If only one half could be tested it
        would be the server half.
      · **Three identities.** Nobody; a **student with a valid, correctly-signed
        token** — the interesting one, because authenticated is not authorised
        and confusing the two hands every student the gradebook; and a teacher
        as the **control**, without which every denial would pass just as
        happily if the console API were broken for everyone.
      · **Mutation-tested**: commenting out one `requireStaff(id)` makes it fail
        with "/api/v1/console/roster served a student — authenticated was
        mistaken for authorised".
      · **The client half checks the screen a person gets**: anonymous lands on
        `/signin` from all eleven guarded routes; a student gets a distinct
        screen — not a retry, because there is nothing to retry — that names why
        and offers **both** exits, the student app and a way OUT of the session
        so a teacher sharing the machine can sign in.
      · **Fixed while here:** the student-app link fell back to `:5173`, which
        on this machine is another project entirely. Third instance of that trap
        — both `.env.example` files pointed at `:8080`, an Adminer.
- [x] `/locks` — students × stages, reason prompt on every toggle
      · **Gate-cleared.** Matrix cells raised 28px → 32px, the design system's own floor (F-24).
- [x] `/students` · `/students/:userId` — "the page you'll use most"
      · **Both reworked.** Sort headers 18px → 32px with real `aria-sort` (F-24); attempt history now expands in place to the regenerated variant (F-25).
- [x] `/attempts/:attemptId` — **not in `TEMPLATE-LINKS.md`.** Give it a
      template row or record why not
      · **Recorded as a deliberate NO-TEMPLATE, 2 Sep 2026.** It is a document, not a dashboard; the reference is a printed exam paper. Reason written into `TEMPLATE-LINKS.md`.
- [x] `/items` — bank, stats inline, re-roll preview
      · **Reworked.** Card list → table, 122px → 72px per item, both psychometric warnings kept in words (F-28).
- [x] `/assessments` · `/content` · `/gradebook`
      · **`/assessments` was the FOURTH card list**, and the last one in the
        console. Converted to the same dense table as `/audit`, `/items` and
        `/submissions`: **~98px → 41px per row**, measured before and after on
        seeded data, which is the same figure `/audit` landed on. Every field
        the cards carried is still there and asserted column by column — a
        density number alone is easy to win by deleting columns, which is how
        the `/items` bound once got calibrated at 67px against an empty one.
      · **Dropped exactly one thing:** the repeated title. Each card printed
        `title` in the heading and `blueprintName` underneath, and on every
        fixture row those are the same string, so the second line said nothing
        twice. It now renders only when it differs.
      · **`/content` and `/gradebook` needed no rework, and that is recorded
        rather than glossed.** `/content` already carries stat tiles, the
        "item bank is the schedule" callout and a 19-row chapter table;
        `/gradebook` already carries the class-average chart, CSV export and
        41px rows. A template pass that changes a good page to look busy is not
        a pass. Both are now covered by `design/specs/console-teaching.spec.ts`
        so they stay that way.
      · **Two assertions protect copy, not layout.** `/content` must keep saying
        how many chapters are actually authored (8/19) — hard rule 5's dashboard,
        and rounding it up would hide the gap from the one person who can close
        it. `/gradebook` must keep the line "a stage where the whole class sits
        low is a signal about the teaching, not about the students", which is
        the difference between a chart and a judgement about a teacher, and is
        exactly the kind of sentence deleted as decoration.
- [x] `/submissions` — **not in `TEMPLATE-LINKS.md`.** `DESIGN-REVIEW-01` D-4
      records it as too sparse to mark from; the density pass belongs here
      · **Template row added** (same dense reference as `/items` and `/audit`), and **D-4 itself is FIXED** — 3,436px → 1,219px.
- [x] `/audit` · `/feedback` · `/live` — **`/audit` DONE** (card list → table, 109px → 41px per entry, timeline kept as the alternate view, F-26).
      · **`/feedback` was the FIFTH card list**, and the last one anywhere in
        this console. Converted to a table with an expanding row — the same
        TanStack pattern `/students` uses for attempt history
        (`CONSOLE-DATA-AND-TEMPLATES.md` §2). **~172px → 54px per report; the
        page went 2,240px → 991px**, so all eleven fit where about five did.
      · **It expands rather than linking away for a specific reason.** Every
        student gets different numbers, so "question 7 is wrong" is
        unactionable; a content report only becomes work when the teacher can
        see the exact instance that student saw. One click from the queue, not a
        page away. One open at a time — a triage queue is worked down, not
        compared.
      · **`/live` needed no rework and is now covered.** Both of its claims are
        architecture, not copy, so both are asserted against the PAYLOAD:
        *"no name, student ID, or user ID is ever loaded — a field that is not
        loaded cannot leak"*, and *"the server withholds the numbers rather than
        this page hiding them"*. Checking the rendering would only have proved
        the fields are not displayed, which is much weaker — the DOM can hide
        what the network already delivered.
      · **`/live` cannot use `networkidle`** — it holds an open request for as
        long as it is on screen, which is why earlier passes skipped it. Every
        wait in its spec is `domcontentloaded` plus an explicit locator.
      · **One correction worth keeping:** the suppression test first searched the
        payload for `/student|user|name|email/` and failed on
        `{ stageId: "01", students: 21 }` — an AGGREGATE COUNT, which is the
        anonymisation rather than a breach of it. It now inspects KEYS for
        identifiers. The test was wrong, not the payload.
- [x] `/system` — **not in `TEMPLATE-LINKS.md`.** The invariant results page
      · **Template row added 2 Sep 2026** — the status/health-page pattern from DevOps shadcn templates. The page itself is not yet reworked to it.

**Missing from the console:** `/console` overview (`/` is a redirect),
`/console/roster`, `/console/items/:id/edit`, `/console/live/present`,
`/console/settings`, `/console/analytics`. All in §R3.6.

## R3.4 — Loading screens (cross-cutting, not one route)
Per `BIOME-AND-LOADING-SPEC.md` §4 — build once, verify it shows up correctly
wherever it's triggered, not as a per-route task:
- [x] Hub loading (warp-speed) — triggers at `/app` first arrival and hub-level
      navigation
      · **BUILT, and the box was left unticked while a passing spec covered it**
        — `solar-system.spec.ts:430`, "the warp fires on hub navigation, not on
        arrival". Ticked 7 Sep after checking the code rather than the checklist.
      · **It deliberately does NOT fire on first arrival**, which is this item's
        wording and is the one part of it that was wrong. §4.1 was revised for
        the full-page backdrop: the warp is the star field already on screen
        accelerating, not an overlay, so firing it on first paint would greet
        every student with an animation before they had done anything. The
        spec asserts the absence explicitly, and asserts the warp *ends* —
        a loading state that never clears is a stuck page.
- [x] Stage/moon loading (biome preview) — triggers entering any specific
      planet or moon
      · **DONE 7 Sep 2026.** `StageReader`'s loading branch renders the
        destination biome behind layout-shaped skeletons, so the student arrives
        somewhere while the stage fetch is in flight. It previously rendered bare
        skeletons on the page surface, and the biome appeared only once the fetch
        landed — the map warped, the route changed, and the transition was spent
        on nothing.
      · **No artificial dwell.** §4.1's budget line is that a loading animation
        must never be why a page feels slow, and the warp leaving the map has
        already spent 620ms. A fast fetch means an instant arrival, which is
        correct.
      · Held by `design/specs/arrival.spec.ts`, five tests, which hold the stage
        request open because the state is normally invisible — nobody would see
        it degrade. Mutation-tested: removing the biome fails it by name.
- [x] **The biome is the PAGE background, not a banner strip** (§1b, ruled
      2 Sep 2026). Full page on `/app/stage/:id` and moon detail; never on hub
      routes, **never behind an assessment**
      · **DONE 2 Sep 2026**, in commit `76641e9` — and the box was left unticked
        for five days while the work sat committed. That is the drift
        `REDESIGN-CLAUDE.md` §2b exists to stop, caught on 7 Sep and recorded
        here rather than quietly ticked.
- [x] **The six-slot TEMPLATE, followed to the letter** (§2e) — sky, far, mid,
      near, ground, motif. Every biome fills all six or carries a recorded
      exemption
      · **DONE 7 Sep 2026.** The first seven biomes each skipped THREE slots —
        no sky, no ground, no atmospheric perspective — and still looked
        plausible enough to ship; every one was found by eye, late, one at a
        time. So the template is asserted per biome in `biomes.spec.ts`, not
        just written down: a manifest that skips a slot fails in CI.
      · **Two biomes were replaced outright rather than tuned.** `volcanic` →
        `city` (FabinhoSC, CC0) and `cave` → *Warped: Super Grotto Escape*
        (ansimuz, CC0). Both had been re-tuned twice each; a composition with no
        detail density does not acquire any by being resized.
      · **`design/global-setup.ts` was added in the same pass**, after a full
        spec run passed against **a different project on port 5173**. Seven
        EngiRent screenshots came within one commit of being recorded as OCTA's
        biomes. The specs now refuse to run against an app that is not this one.
- [x] **Composition variety** (§2c) — each biome declares its own structure, no
      two the same. **The greyscale test:** desaturate all seven; if two are
      hard to tell apart, the palette is doing work the composition should
      · **DONE 2 Sep 2026**, and the mechanism had to change too: `repeat-x` is
        uniform by construction, so layers now SCATTER with per-instance variant,
        size, position and flip (§2d). Composition alone could not have fixed it.
      · **DONE 2 Sep 2026.** Each biome declares its structure, and the mechanism changed too: scatter with per-instance variant, size and flip (§2d) instead of , which was uniform by construction.
- [x] **One ambient motif per biome** (§4.2b) — leaves, sand, snow, bubbles,
      dust, embers. One each, never several, frozen under reduced motion
      · **DONE.** leaves / sand / snow / bubbles / dust / embers — twelve deterministic
        motes each, and none for `neutral`, which stays quiet because it is the
        default. Frozen under reduced motion.
- [x] **The travel transition reads as arrival** — backdrop recedes → warp →
      biome resolves → content mounts
      · **DONE 7 Sep 2026, and the bug was the opposite way round from what you
        would guess.** The FLAT map — the accessibility fallback — travelled to a
        planet, and the 3D map, every student's default, cut straight from the
        galaxy to a biome. `StageMap.tsx`'s HUD called `onOpen` directly while
        the flat hits went through `warpThen`. Both compiled, both navigated,
        both landed on the right stage; the only difference was a feeling, on
        the one navigation in the app that is meant to feel like going
        somewhere. Both surfaces now share `openWithWarp`.
      · **Asserted in `solar-system.spec.ts`** — "entering a stage TRAVELS — it
        does not jump" — and **mutation-tested**: removing the warp makes it
        fail with "selecting a stage jumped instead of travelling".
      · **The test drives `/app/map`, not the 3D HUD**, and that limit is stated
        in the test rather than hidden. The canvas is `aria-hidden` and exposes
        no per-planet DOM controls — `.map-hits` is empty by design, because the
        contract from that page is the "All 19 stages" link, not 19 invisible
        buttons — so the HUD's enter button cannot be reached headlessly. What
        is covered is `openWithWarp`, the single handler both surfaces now call.
- [ ] Both captured as short frame sequences per `REDESIGN-CLAUDE.md` §2, not
      single stills
- [x] Both verified frozen-to-static under `prefers-reduced-motion`
      · **Arrival: DONE**, asserted through `getAnimations()` rather than by
        screenshotting twice — a slow animation and a stopped one look identical
        in two stills taken close together. The biome still renders; it is frozen,
        not withheld.
      · The hub warp already skipped entirely under reduced motion
        (`useHubWarp` / `useFlatWarp`); that half was built earlier and is
        unchanged.

## R3.5 — Cross-cutting, same rule as `DESIGN-MANDATE.md`'s shared states table
- [x] Every route gets its six states (loading, empty, locked, error,
      offline, saving) — this is not new, it's the existing universal gate,
      restated as a phase checklist item so it's not silently skipped under
      the volume of routes in this phase
      · **It was silently skipped anyway, by the checklist itself.**
        `apps/web/CLAUDE.md` listed the sixth state as **380px** instead of
        **saving**, conflating the six states with the mechanical five.
        `DESIGN-MANDATE.md` §201 is the authority. Every spec derived from that
        line tested a viewport width, so **saving — the sixth state — had no
        coverage at all** until 8 Sep. Corrected in the doc and in the specs.
      · **Covered now:** `student-states.spec.ts` (loading as a skeleton with a
        text equivalent, observed by holding the request open; locked naming
        reason *and* distance; error offering a control and leaking no stack
        trace; offline; 380px), `attempt-runner.spec.ts` (**saving**, both
        halves), `console-gate.spec.ts`, `console-teaching.spec.ts` (**saving**
        on `/locks`), `console-live-feedback.spec.ts`.
      · **The saving failure is the half that matters**, and it is
        mutation-tested. `AttemptRunner` writes the answer to local state
        *before* the request, so the option stays selected whether or not it
        saved — a silent failure looks exactly like success. Making the catch
        block swallow the error makes the test fail.
      · **Where a state is unreachable it is recorded, not faked**: `empty` on
        the stage reader cannot occur (every stage has content blocks; 08–18
        carry a scaffold notice saying the text is not written yet), and
        `/assessments`'s empty view is only reachable on a fixture with no
        assessments — which, per **F-41**, is a clean `db:reset`.

## R3.6 — The backlog: routes this phase does NOT cover

Every `PAGE-SPECS.md` route that is not built, what is actually missing, and
which `PHASES.md` phase owns it. **None of these are R3 work.** R3 applies
templates to pages; these need pages.

### Needs a simulator first — P6

`PHASES.md` P6 is "FDE stepper → 8086 subset interpreter → cache simulator,
**one at a time, reviewed before the next starts**". No template pass can
precede them.

| Route | What is missing |
|---|---|
| `/app/lab` | The hub page, and it has nothing to hub until the three below exist |
| `/app/lab/fde` | The **FDE stepper**: steppable fetch–decode–execute with a live Register Bar and predict-before-step |
| `/app/lab/asm` | The **x86-16 interpreter + VM**: memory view, breakpoints, plain-language errors naming the offending line. Must be deterministic — Stage 15 questions are graded by running it server-side |
| `/app/lab/cache` | The **cache simulator**: size/block/associativity sliders, live hit ratio and AMAT against a sample trace |

### Needs chapters 08–18 authored first — P5

Chapters **01–07 are authored; 08–18 are scaffolds** carrying syllabus
objectives and a topic outline only (`services/api/src/routes/console.ts:341`,
and every scaffold file says so in a `kind="planned"` callout).

| Route | What is missing |
|---|---|
| `/app/final` | The whole page — 70-item palette, review-before-submit, one confirmation. The blueprint samples across all four periods, so it cannot be exercised honestly while most chapters are outlines |
| `/app/mistakes` | The whole page. A weak-spot queue built from wrong `responses` needs a bank spanning authored content to be worth opening |
| `/app/notebook` | The whole page, plus PDF export. Auto-curated from annotated diagrams and pinned glossary entries that mostly do not exist yet |

### Whole page, no dependency beyond itself — P9 for the student ones

These need building but block on nothing. P9 is "themes, audio, accessibility,
mobile" and is the closest existing home for student-app surface work.

| Route | What is missing |
|---|---|
| `/app/stage/:id/results/:attemptId` | The whole page. **The most valuable one here** — per-objective breakdown, every item with the student's answer and the correct one, "review this" links. The API already returns this shape |
| `/app/live` | The whole page. Lecture Mode student view, locked to the pushed question. `/live` exists on the console side already |
| `/app/help` | The whole page. Plain content |
| `/forgot-password` · `/reset-password` | Whole pages. `DESIGN-REFERENCES.md` §7's boot sequence covers them |
| `/500` | A whole page. Only the `*` catch-all 404 exists |

### Console gaps — P4 extended

P4 is marked **DONE** in `PHASES.md`, so these are a genuine gap in a phase
that claims completion, not scheduled work. Worth raising on its own.

| Route | What is missing |
|---|---|
| `/console` overview | The whole page. `/` is a `<Navigate>`, so there is no dashboard at all |
| `/console/roster` | The whole page. CSV import with a **dry-run preview modal** — `PAGE-SPECS.md` §3 calls this out specifically |
| `/console/analytics` | The whole page. The cohort mastery heatmap, which `CONSOLE-DATA-AND-TEMPLATES.md` §1 calls "the single highest-value chart on the whole console" |
| `/console/items/:id/edit` | The whole page, including the mandatory confirm dialog whose copy is specified word-for-word |
| `/console/live/present` | The projector view. **No names, ever** |
| `/console/settings` | The whole page |

### No phase owns these at all — needs a P-number

**`PHASES.md` has no phase covering the public marketing site.** P0–P10 go
foundation → auth → content → engine → console → stages → simulators →
analytics → feedback → themes → pilot. Nothing owns `/`, and these five routes
have no home in the plan:

| Route | What is missing |
|---|---|
| `/` | The landing page. **It does not exist** — `/` is `<Navigate to="/app">`. `PAGE-SPECS.md` §1 specifies a live map hero plus the re-rollable item demo, and calls that demo "the one interaction that sells the product" |
| `/course` | All 19 stages with objectives, act, prereqs, minutes |
| `/how-it-works` | The fairness argument in plain language |
| `/for-teachers` | Needs real console screenshots, so it cannot precede R3.3 |
| `/accessibility` · `/about` | Plain content pages. `/about` carries the Octalysis credit to Yu-kai Chou and the full third-party licence list, which `CREDITS.md` now partly feeds |

**This gap is worth a ruling of its own.** A public site is not optional for a
thesis deliverable, and right now no phase is accountable for it.

## Definition of done
- [ ] **Every BUILT route checked** — 3 public + the catch-all, 7 student, 14
      console — each with a template screenshot and an implementation
      screenshot on file. **Not 44**; see the scope ruling at the top
- [ ] §R3.6's backlog is current: anything built during R3 moves out of it,
      anything newly discovered as missing moves into it
- [ ] Both loading screens (R3.4) built and verified
- [ ] Console pages built per `CONSOLE-DATA-AND-TEMPLATES.md`'s merges, not
      just the shadcn-admin default
- [ ] All five approved minigames (R3.2b) built and confirmed non-blocking,
      **or** explicitly deferred with the reason recorded. Deferral is the
      expected outcome for all five while chapters 08–18 are scaffolds — that
      is a real answer, not a slip, and it is not a reversal of R0.1b's approval
- [ ] `design/templates/` fully populated and committed
- [ ] **Console revamp** (`CONSOLE-REVAMP.md`) — every console route has
      `template.png` + `SOURCE.md` + `SPEC.md` captured and VERIFIED BY OPENING
      IT, and its `design/specs/console-<route>.spec.ts` green on all six
      assertions at 1440 and 380
- [ ] **Student app revamp** (`WEB-REVAMP.md`) — same, for `apps/web`, second,
      and REDONE rather than improved per root `CLAUDE.md`
- [ ] **Toasts, loading states and transitions** on every revamped route per
      `.claude/rules/design.md` — no toast library is installed in either app
      today, exactly one route in `apps/web` has a loading state, and the
      reverse travel transition leaving a stage does not exist
- [ ] **Shared icon** — `packages/tokens/icon.svg` wired into both apps and
      verified rendering at 96/48/32/16 on light and dark chrome
- [ ] **Map sidebar and ENTER JOURNEY** (`WEB-REVAMP.md` §3) — selecting a
      planet opens a sidebar explaining it, with the lock reason printed in words
      from the API and ENTER JOURNEY disabled when locked; selecting a moon zooms
      and updates the sidebar; **the biome appears only after ENTER JOURNEY**;
      the flat map opens the same sidebar in place
- [ ] **Stage summaries for the sidebar** — 0 of 19 exist. Drafted from
      `docs/source/` **only with the instructor's approval** (hard rule 5);
      until then the sidebar shows the stage's objectives
- [ ] **Planet selection and zoom** (`WEB-REVAMP.md` §3) — select by click AND
      keyboard, camera easing with nodes pinned and no force simulation, Escape
      returns focus to the selected planet, flat map carries the same selection
      in place
- [ ] **Orbital motion follows Kepler's third law** (`WEB-REVAMP.md` §4) —
      `ω ∝ a^-1.5`, circular orbits kept so radius still means level, phase
      seeded not random, frozen under `QA_MODE`, stopped under
      `prefers-reduced-motion`, with a unit test asserting the ratio across all
      seven rings
- [ ] `docs/PROGRESS.md` reflects real progress through this phase — given
      the size, update it after every batch of routes, not just at the end
