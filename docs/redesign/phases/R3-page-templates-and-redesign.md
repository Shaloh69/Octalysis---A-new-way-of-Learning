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
- [ ] `/maintenance` — `AuthPages.tsx`. Keep it boring on purpose. **Passes the mechanical gate; not design-reviewed yet.**
- [ ] `*` → `NotFoundPage` — this is the 404. There is no separate `/404`
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
- [ ] `/app/stage/:id` — the reader, now carrying the landing biome. **Blocked on the biomes, which are licence-verified and manifested but still unrendered.**
- [ ] `/app/stage/:id/check` — the attempt runner
- [ ] `/app/progress` — the 7×3 competency grid
- [ ] `/app/settings` — now also showing the seeded callsign
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
- [ ] **The Amdahl 500** — Stage 17 bonus, prediction race. `motion.dev` only;
      `MINIGAME-PROPOSALS.md` §4 says the honest answer is probably "no Phaser
      at all". Decide that explicitly before writing a scene. Race pace must be
      driven by the *actual computed speedup ratio*, not an arbitrary tween —
      that is the entire reason it passes the verb test
- [ ] **Mnemonic Sprint** — Stage 15 bonus, mnemonic-syntax fluency drill.
      Text input plus timer, DOM. No leaderboard (§1B's ban on competitive
      rankings). **Note the toolchain:** the proposal's example says TASM
      syntax; root `CLAUDE.md` says listings are **Intel x86**, matching the
      textbook, and TASM belongs to the superseded course. Use x86, and check
      `TOOLCHAIN-CORRECTION.md` before authoring a single prompt

### The three Phaser scenes
- [ ] **Hazard Interceptor** — Stage 14, ILP. Classify each instruction's
      hazard type before it leaves the pipeline. A wrong tag stalls that one
      instruction visibly, which is the real consequence, and shows the correct
      classification. No buzzer
- [ ] **The Descent** — unlocked *after* Stage 11, paid off at Stage 16.
      Never at Stage 11 itself: `GAME-DESIGN.md` §11 marks that stage
      "nothing may distract". Does **not** replace Stage 16's DOM Cache Tuner,
      which stays required and primary
- [ ] **Fault Line** — Stage 18, distributed systems. Network/traffic
      language throughout, never combat language — reframing the tower-defense
      template's verbs is the thing that keeps it content rather than costume

### Applies to all five
- [ ] Confirm the primary DOM/accessible encounter for that stage still works
      completely without the minigame — test it directly, don't assume it
      because the minigame is "just an addition"
- [ ] Screenshot the opt-in entry point *and* the minigame itself, same
      discipline as every other page
- [ ] **Initial bundle must not move.** `GAME-DESIGN.md` §10.2's method: grep
      `dist/index.html` for `modulepreload`, confirm the 51.9 KB gz baseline is
      unchanged. Three new lazy scenes are three more chances to accidentally
      preload Phaser
- [ ] **Each one waits on its own chapter being authored** — see the note at
      the top of this section. Confirm the chapter has real teaching text, not
      a `kind="planned"` callout, before building its game

### Housekeeping this ruling creates
- [x] `GAME-DESIGN.md` §11's mini-game table still maps to the **superseded**
      curriculum and now needs five new rows too. Rewrite it for the
      18-chapter syllabus and add all five in one pass —
      `MINIGAME-PROPOSALS.md` §"What happens next" already asks for exactly this
      · **Rewritten 2 Sep 2026** against the real 19-stage curriculum, along with §10.3's Phaser assignment, which was derived from the same wrong table (F-23).
- [ ] Add the five to `GAME-DESIGN.md` §12's Track D
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
- [ ] `/signin` — the gate. Nothing past it renders without a staff account
- [x] `/locks` — students × stages, reason prompt on every toggle
      · **Gate-cleared.** Matrix cells raised 28px → 32px, the design system's own floor (F-24).
- [x] `/students` · `/students/:userId` — "the page you'll use most"
      · **Both reworked.** Sort headers 18px → 32px with real `aria-sort` (F-24); attempt history now expands in place to the regenerated variant (F-25).
- [x] `/attempts/:attemptId` — **not in `TEMPLATE-LINKS.md`.** Give it a
      template row or record why not
      · **Recorded as a deliberate NO-TEMPLATE, 2 Sep 2026.** It is a document, not a dashboard; the reference is a printed exam paper. Reason written into `TEMPLATE-LINKS.md`.
- [x] `/items` — bank, stats inline, re-roll preview
      · **Reworked.** Card list → table, 122px → 72px per item, both psychometric warnings kept in words (F-28).
- [ ] `/assessments` · `/content` · `/gradebook`
- [x] `/submissions` — **not in `TEMPLATE-LINKS.md`.** `DESIGN-REVIEW-01` D-4
      records it as too sparse to mark from; the density pass belongs here
      · **Template row added** (same dense reference as `/items` and `/audit`), and **D-4 itself is FIXED** — 3,436px → 1,219px.
- [ ] `/audit` · `/feedback` · `/live` — **`/audit` DONE** (card list → table, 109px → 41px per entry, timeline kept as the alternate view, F-26). `/feedback` and `/live` untouched.
- [x] `/system` — **not in `TEMPLATE-LINKS.md`.** The invariant results page
      · **Template row added 2 Sep 2026** — the status/health-page pattern from DevOps shadcn templates. The page itself is not yet reworked to it.

**Missing from the console:** `/console` overview (`/` is a redirect),
`/console/roster`, `/console/items/:id/edit`, `/console/live/present`,
`/console/settings`, `/console/analytics`. All in §R3.6.

## R3.4 — Loading screens (cross-cutting, not one route)
Per `BIOME-AND-LOADING-SPEC.md` §4 — build once, verify it shows up correctly
wherever it's triggered, not as a per-route task:
- [ ] Hub loading (warp-speed) — triggers at `/app` first arrival and hub-level
      navigation
- [ ] Stage/moon loading (biome preview) — triggers entering any specific
      planet or moon
- [ ] **The biome is the PAGE background, not a banner strip** (§1b, ruled
      2 Sep 2026). Full page on `/app/stage/:id` and moon detail; never on hub
      routes, **never behind an assessment**
- [ ] **Composition variety** (§2c) — each biome declares its own structure, no
      two the same. **The greyscale test:** desaturate all seven; if two are
      hard to tell apart, the palette is doing work the composition should
- [ ] **One ambient motif per biome** (§4.2b) — leaves, sand, snow, bubbles,
      dust, embers. One each, never several, frozen under reduced motion
- [ ] **The travel transition reads as arrival** — backdrop recedes → warp →
      biome resolves → content mounts. Captured as a frame sequence, not a still
- [ ] Both captured as short frame sequences per `REDESIGN-CLAUDE.md` §2, not
      single stills
- [ ] Both verified frozen-to-static under `prefers-reduced-motion`

## R3.5 — Cross-cutting, same rule as `DESIGN-MANDATE.md`'s shared states table
- [ ] Every route gets its six states (loading, empty, locked, error,
      offline, saving) — this is not new, it's the existing universal gate,
      restated as a phase checklist item so it's not silently skipped under
      the volume of routes in this phase

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
- [ ] `docs/PROGRESS.md` reflects real progress through this phase — given
      the size, update it after every batch of routes, not just at the end
