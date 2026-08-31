# R3 — Page Template Pass, All Routes

**Goal:** every route in `PAGE-SPECS.md` gets its named template from
`TEMPLATE-LINKS.md` applied, screenshotted, and checked. This is the largest
phase by page count — expect to split it across several sessions, tracked
through `docs/PROGRESS.md`, not rushed into one.

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

## R3.1 — Public site (13 routes)
- [ ] `/` (custom hero — see `TEMPLATE-LINKS.md`, don't template this one)
- [ ] `/course` · `/how-it-works` · `/for-teachers` · `/accessibility` ·
      `/about`
- [ ] `/login` · `/register` · `/forgot-password` · `/reset-password`
      (per `DESIGN-REFERENCES.md` §7 in full — the boot-sequence spec, not a
      generic auth template)
- [ ] `/404` · `/500` · `/maintenance`

## R3.2 — Student app (16 routes)
- [ ] `/app` — done in R1/R2, confirm it also clears the full per-page gate,
      not just the technical checks those phases covered
- [ ] `/app/map`
- [ ] `/app/stage/:id` · `/app/stage/:id/check` ·
      `/app/stage/:id/results/:attemptId`
- [ ] `/app/final`
- [ ] `/app/lab` · `/app/lab/fde` · `/app/lab/asm` · `/app/lab/cache`
- [ ] `/app/notebook` · `/app/mistakes` · `/app/progress`
- [ ] `/app/live` · `/app/settings` · `/app/help`

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
- [ ] `GAME-DESIGN.md` §11's mini-game table still maps to the **superseded**
      curriculum and now needs five new rows too. Rewrite it for the
      18-chapter syllabus and add all five in one pass —
      `MINIGAME-PROPOSALS.md` §"What happens next" already asks for exactly this
- [ ] Add the five to `GAME-DESIGN.md` §12's Track D
- [ ] `MINIGAME-PROPOSALS.md`'s header still says PROPOSED. Change it to record
      the ruling and its date, so the file stops contradicting this one

## R3.3 — Teacher console (15 routes)
Use `CONSOLE-DATA-AND-TEMPLATES.md` for these, not just `TEMPLATE-LINKS.md`'s
baseline row — that file has the actual per-page template merges and the
additional data each page should surface.
- [ ] `/console` (overview)
- [ ] `/console/roster` · `/console/students/:id` · `/console/locks`
- [ ] `/console/content` · `/console/items` · `/console/items/:id/edit`
- [ ] `/console/assessments` · `/console/analytics` · `/console/gradebook`
- [ ] `/console/live` · `/console/live/present`
- [ ] `/console/feedback` · `/console/audit` · `/console/settings`

## R3.4 — Loading screens (cross-cutting, not one route)
Per `BIOME-AND-LOADING-SPEC.md` §4 — build once, verify it shows up correctly
wherever it's triggered, not as a per-route task:
- [ ] Hub loading (warp-speed) — triggers at `/app` first arrival and hub-level
      navigation
- [ ] Stage/moon loading (biome preview) — triggers entering any specific
      planet or moon
- [ ] Both captured as short frame sequences per `REDESIGN-CLAUDE.md` §2, not
      single stills
- [ ] Both verified frozen-to-static under `prefers-reduced-motion`

## R3.5 — Cross-cutting, same rule as `DESIGN-MANDATE.md`'s shared states table
- [ ] Every route gets its six states (loading, empty, locked, error,
      offline, saving) — this is not new, it's the existing universal gate,
      restated as a phase checklist item so it's not silently skipped under
      the volume of routes in this phase

## Definition of done
- [ ] All 44 routes checked, each with a template screenshot and an
      implementation screenshot on file
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
