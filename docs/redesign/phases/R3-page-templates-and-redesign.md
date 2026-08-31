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

## R3.2b — Approved minigames only (check R0.1b's decisions before starting this)
Skip this section entirely if nothing was approved in R0.1b. For anything
that was:
- [ ] Build per `MINIGAME-PROPOSALS.md`'s spec for that proposal, including
      its explicit "what this is not" constraints (no lives, no graded
      timer, never the only path through the stage)
- [ ] Confirm the primary DOM/accessible encounter for that stage still
      works completely without the minigame — test this directly, don't
      assume it because the minigame is "just an addition"
- [ ] Screenshot the minigame's entry point (the opt-in button/link) and the
      minigame itself, same discipline as every other page

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
- [ ] Any approved minigame (R3.2b) built and confirmed non-blocking
- [ ] `design/templates/` fully populated and committed
- [ ] `docs/PROGRESS.md` reflects real progress through this phase — given
      the size, update it after every batch of routes, not just at the end
