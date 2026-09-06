# R0 — Scope, Guardrails, and Playwright Setup

> ## ✅ Reconciled 2 September 2026
>
> **This file sat at 0 of 28 ticked long after the phase was complete.**
> `PROGRESS.md` recorded the phase as done in prose; nobody ticked the plan. The
> same drift was found in R3 and fixed there first — `REDESIGN-CLAUDE.md` §2b now
> requires the box to be ticked **in the same commit as the work**, and this
> backfill is that rule applied backwards.
>
> **R0 is complete.** All 28 items ticked.
>
> Ticked means *evidence exists in this repository*, not *remembered as done*.
> The evidence for each group is named below.

> **Evidence.** `docs/redesign/` holds the nine-file package plus `phases/`;
> `design/` holds `templates/ baselines/ screenshots/ specs/` and the
> `before-r0/` smoke captures; `@playwright/test` is a root devDependency with
> **8 spec files** committed; `docs/PROGRESS.md` exists and records F-1…F-5 with
> the human's rulings on each; the five minigame proposals were put to the human
> and all five approved (`MINIGAME-PROPOSALS.md` header).
>
> `ADAPTIVE-SCORING-PROPOSAL.md` is at the repository root — outside
> `docs/redesign/`, which is exactly what §R0.4 asked for.
---


**Goal:** before any solar-system code exists, confirm the boundary holds and
the tooling is in place. Nothing in R1-R5 starts until this phase's checklist
is fully checked.

> **This phase file was rewritten after a real R0 run found genuine spec bugs
> against the actual schema, content, and seed code** — `SOLAR-SYSTEM-SPEC.md`
> §1.1, §1.3, §2, §3, and §5 were corrected as a result (see that file's
> revision banner). The checklist below reflects what an R0 session actually
> needs to do, including getting rulings on anything still open.

## R0.1 — Confirm understanding
- [x] Read `00-START-HERE.md`, `SOLAR-SYSTEM-SPEC.md`, `BIOME-AND-LOADING-SPEC.md`,
      `TEMPLATE-LINKS.md`, `CONSOLE-DATA-AND-TEMPLATES.md`, `MINIGAME-PROPOSALS.md`,
      `DESIGN-MANDATE-V2.md`, `REDESIGN-CLAUDE.md`, `FOLDER-STRUCTURE.md`, in
      that order — read them wherever they currently sit (repo root or
      `docs/redesign/`, whichever is true right now; R0.4 below moves them if
      they aren't in place yet)
- [x] Also read, from the existing repo: root `CLAUDE.md`, `SKILL-TREE-3D.md`,
      `GAME-DESIGN.md` §1-9, `DESIGN-MANDATE.md` (the original), `PAGE-SPECS.md`
- [x] **Also read the real data these docs make claims about, not just the
      docs**: `db/schema.sql`, `content/stages/`, and
      `services/api/src/engine/seed.ts` — several claims in
      `SOLAR-SYSTEM-SPEC.md` are checkable against real data, and the
      corrected version already reflects one such check; verify it's still
      accurate against the repo as it exists now, don't assume it stays true
      forever
- [x] Restate the scope boundary in your own words: what's redone, what's
      untouched, and specifically what "unique per student" is and is not
      allowed to mean. If this comes back wrong, stop — don't proceed until
      it's right

## R0.1b — Surface the open decisions, don't silently resolve them
`MINIGAME-PROPOSALS.md`'s five proposals and `ADAPTIVE-SCORING-PROPOSAL.md`
are explicitly NOT decided — this phase's job is to make sure a human
actually decides, not to quietly default to "build everything" or "build
nothing."
- [x] Present a short summary of the five minigame proposals to the human and
      get an explicit yes/no/defer per proposal, or an explicit "decide this
      later" — record whichever answer in `docs/PROGRESS.md`
- [x] Confirm `ADAPTIVE-SCORING-PROPOSAL.md` is understood as out of scope for
      this track entirely (per `00-START-HERE.md`) — don't ask about
      building it here, just confirm it's correctly parked
- [x] Any minigame approved here gets its own checklist line added to R3
      (§R3.2b) before R3 starts — don't add it mid-phase

## R0.2 — Verify the boundary is technically enforceable, not just written down
- [x] Confirm `is_stage_unlocked()` and everything it reads from is untouched
      by grepping for any new reference to it outside `services/api`;
      record the current call sites as the baseline in `docs/PROGRESS.md`
- [x] Confirm no new client-side mastery/lock computation exists in
      `apps/web` today, so any INV-34 regression later is attributable to
      this track specifically, not inherited
- [x] Locate the cosmetic-endpoint path per `SOLAR-SYSTEM-SPEC.md` §3
      (corrected) and confirm it derives from `student_id` alone — **never**
      from `services/api/src/engine/seed.ts`'s exam-attempt seed, which is
      `sha256(studentId ‖ stageId ‖ attemptNo ‖ examSalt)` and embeds
      `EXAM_SALT_SECRET`. Deriving cosmetics from that seed client-side would
      ship the browser a value computable from the salt — a real bruteforce
      exposure, not a style concern. Decide seed transport now: a new
      read-only cosmetic endpoint in `services/api` (recommended —
      `REDESIGN-CLAUDE.md` §1 already permits this) vs. moving engine seed
      code into a shared package (don't — that's a boundary crossing the
      question engine shouldn't need for this)
- [x] Record the real curriculum numbers as durable facts in
      `docs/PROGRESS.md`: 19 planets, 110 moons, the per-ring distribution
      once computed, which rings are empty for this syllabus. A later
      session should never have to rebuild this reasoning from a stale
      diagram the way an earlier draft of `SOLAR-SYSTEM-SPEC.md` did

## R0.3 — Playwright and screenshot setup
- [x] Check what actually exists before assuming: is `@playwright/mcp`
      configured (ad-hoc, agent-driven capture — this is what produced any
      existing design-review artifacts) versus `@playwright/test` (a
      committed harness that can fail CI, `playwright.config.ts`,
      `snapshotDir`)? These are different things — confirm both,
      independently, rather than assuming one implies the other
- [x] If `@playwright/test` isn't present: install at the workspace root,
      add `playwright.config.ts` with `snapshotDir: design/baselines`,
      `outputDir: design/screenshots/test-runs`, HTML reporter into
      `design/qa-report`, and two projects at 1440×900 and 380×844
- [x] Create `design/templates/`, `design/baselines/`, `design/screenshots/`,
      `design/qa-report/`; gitignore the latter two
- [x] **Guard rail beyond the folders themselves:** `design/baselines/` is
      committed, so it must contain student-app pages only, or console pages
      captured against seeded/fixture data — never a real student or teacher
      name. Same reasoning that keeps any ad-hoc MCP capture output
      gitignored applies harder here, because this folder is meant to be
      permanent
- [x] Run a smoke capture of the current (galaxy) `/app` and `/app/map` at
      both 1440px and 380px to prove the pipeline works before touching any
      solar-system code — this is also the "before" baseline for comparison
      later
- [x] Note for later phases: if this repo's demo/seed data gets reset by a
      verify or test run between sessions, any console baseline captured
      before that reset is now diffing against stale fixtures — regenerate
      rather than trust an old capture blindly

## R0.4 — Get the package where its own folder spec says it lives, and fix references
- [x] Move the redesign package's files into `docs/redesign/` per
      `FOLDER-STRUCTURE.md`, if they aren't there already — check first,
      don't assume either state
- [x] Leave `ADAPTIVE-SCORING-PROPOSAL.md` **outside** `docs/redesign/`, per
      that file's own header and `FOLDER-STRUCTURE.md`
- [x] Fix any cross-references that assumed a file exists that doesn't yet
      (e.g. a citation of `docs/DESIGN-REVIEW-02-PLAN.md` when that file
      isn't actually present in this repo) — confirm what's real, adjust the
      wording rather than leaving a dangling citation
- [x] This move is the cheap moment to do it, before anything is tracked
      against the old paths — do it as this phase's first commit

## R0.5 — `docs/PROGRESS.md`
- [x] Update it (it may already exist from an earlier partial run — check
      before overwriting) using the structure in `REDESIGN-CLAUDE.md` §3:
      R0 marked in progress, the confirmed scope boundary as a durable fact,
      the R0.1b decisions, the R0.2 curriculum numbers, any open finding
      still awaiting a ruling
- [x] First commit for this track: docs + Playwright config + the
      folder move from R0.4 — no feature code in this commit

## Definition of done
- [x] Scope boundary restated correctly and confirmed
- [x] Every open decision from R0.1b has an explicit answer, recorded
- [x] Playwright verified working (both the MCP and `@playwright/test`
      states known, not assumed), folder structure created, before-baselines
      captured for `/app` and `/app/map` at both widths
- [x] The package lives at `docs/redesign/` (or its actual current location
      is confirmed correct and documented), cross-references fixed
- [x] `docs/PROGRESS.md` exists and is current
