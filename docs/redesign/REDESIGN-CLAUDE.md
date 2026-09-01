# REDESIGN-CLAUDE.md — Rules for This Redesign Track Specifically

This file does not replace the repo's root `CLAUDE.md`. Claude Code reads
**both**, root `CLAUDE.md` first — every hard rule there (answer key never
reaches the browser, RLS on every table, no client-side lock decisions, items
versioned never edited in place, denial-tested authorization) is in force for
everything in this redesign exactly as it is for everything else in the repo.
This file adds redesign-specific process on top, it doesn't relax anything.

## 1. The non-negotiable scope boundary

Restated from `00-START-HERE.md` because it's the rule most likely to get
eroded by momentum mid-session:

- The schema, RLS policies, auth system, and question engine are **not** part
  of this redesign. If implementing something here seems to require touching
  `db/schema.sql`, `is_stage_unlocked()`, the grading service, or anything in
  `services/api` beyond a genuinely new read-only endpoint for solar-system
  cosmetic data — stop and flag it, don't proceed silently.
- The 8 locked encounter themes (`GAME-DESIGN.md` §9) are a different layer
  and are not touched by this redesign.
- "Unique per student" means cosmetic seeding (`SOLAR-SYSTEM-SPEC.md` §3),
  derived from `student_id` via a new read-only endpoint — never derived
  from or sharing code with `services/api/src/engine/seed.ts`'s exam-attempt
  seed, which embeds `EXAM_SALT_SECRET` and must never reach the client.
  Never a change to curriculum structure or assessment content.

## 1b. Downloading assets — Claude Code can, but scope the permission first

Claude Code's `Bash` tool can run `curl`/`wget`/`git clone`, and it has a
`WebFetch` tool — whichever of these actually work depends entirely on this
repo's `.claude/settings.json` `permissions` block, which already exists
here (`.claude/hooks/guard.mjs` blocks other things) — check what it
currently allows before assuming any of this "just works."

Recommended scoping, since a blanket allow or a blanket deny are both wrong
for this project specifically — real CC0 assets are worth fetching
automatically, and license verification on ambiguous sources genuinely needs
a human glance:

```json
"permissions": {
  "allow": [
    "WebFetch(domain:kenney.nl)",
    "WebFetch(domain:kenney-assets.itch.io)",
    "Bash(git clone https://github.com/*)"
  ],
  "ask": [
    "WebFetch(domain:itch.io)",
    "Bash(curl *)",
    "Bash(wget *)"
  ]
}
```

Reasoning, source by source:
- **Kenney** (`kenney.nl`, `kenney-assets.itch.io`) — stable direct-download
  URLs, CC0, already this project's trusted audio supplier. Safe to allow
  outright
- **GitHub repos** (every template/reference cited in this package) —
  `git clone` is safe and unambiguous, allow it
- **Non-Kenney itch.io** (the jungle/desert/arctic/cave/ocean biome packs in
  `BIOME-AND-LOADING-SPEC.md`) — license quality varies per file (one source
  in that doc is flagged specifically because its own author gave
  conflicting license info in different places), and itch's download flow
  often needs a browser session rather than a bare fetch anyway. Route
  through "ask" so a human sees which file and which license before it lands
  in the repo
- **Raw `curl`/`wget`** — kept on "ask" rather than denied outright, since
  Kenney's own direct-zip URLs sometimes need a plain fetch rather than
  `WebFetch`'s page-rendering path; "ask" means a human sees the exact URL
  before it runs, which is the right level of friction for a one-off fetch
  outside the two allow-listed domains above

## 2. Playwright and screenshots — every page, every iteration, not a sample

Same practice the UniThrift redesign used, applied here, stated as a hard
requirement rather than a habit to remember: **no page, biome, minigame, or
console view is considered implemented until it has been screenshotted and
looked at.** Not "the important ones," not "a representative sample" — every
single page/state this redesign touches, every time it's meaningfully
changed, not just once at the end of building it.

**Why this is a hard requirement and not a nice habit — a worked example.**

`useSeededBiome()` was added to `StageReader` just above its main `return`,
which sits **after two conditional returns** (an error branch and a loading
branch). So the hook ran on some renders and not others, React threw *"Rendered
more hooks than during the previous render"*, and **the entire stage page
rendered blank**.

What was green at that moment: `tsc --noEmit` across all four workspaces, 333
unit tests, 1174 contrast checks, the palette scanner, the bundle scanner, and
24 Playwright specs. Every gate. The page was blank anyway.

**Hooks-order bugs are structurally invisible to the checks this project
runs.** They are valid TypeScript — the type system has no concept of call
order. And they pass isolated component tests, because those mount a component
in one state and assert on it; they rarely drive the exact sequence of
conditional returns that a real page's full render tree hits with real data,
real loading states and real errors. The bug only exists in the transition.

That is what the screenshot step is for. **It is not documentation of work
already verified — it is the only check in this repo that can catch a page
that compiles, passes, and does not render.** Three separate defects this
redesign found came from opening the page and no other way: this one, the 3D
layer never reading a design token (three.js cannot parse OKLCH, so every
colour was a silent fallback), and two students' seeded palettes rendering
identically. All three passed every automated gate.

- [ ] Confirm Playwright is already set up in this repo (`STATUS.md` implies
      it may not be — check for `@playwright/test` before assuming; if it
      isn't there, install and configure it as the very first task of R0,
      before any solar-system code)
- [ ] `design/templates/` — one reference screenshot per route, pulled from
      the source named in `TEMPLATE-LINKS.md` or `CONSOLE-DATA-AND-TEMPLATES.md`
- [ ] `design/screenshots/` — ad-hoc, dated subfolders, gitignored, for the
      "does this look like what I just built" habit — use it after *every*
      meaningful change, not at the end of a work session. If you write a
      component and don't screenshot it before moving to the next one, that's
      unfinished work, not a shortcut
- [ ] `design/baselines/` — Playwright's own `snapshotDir`, committed,
      formal regression baselines established once a page is genuinely done
- [ ] Capture at **1440px and 380px**, same discipline `DESIGN-REVIEW-01.md`
      already established for this repo — both, every time, not just desktop
- [ ] **Every biome variant** (`BIOME-AND-LOADING-SPEC.md`) gets its own
      screenshot, not just "one biome as a representative example" — a biome
      that looks fine in isolation can still fail contrast or clip content in
      combination with a specific base theme, and the only way to know is to
      actually generate and look at each combination
- [ ] **Both loading screens** (warp-speed hub, biome-preview entry) get
      captured as short frame sequences (a handful of stills across the
      animation), not just a single frame — a loading animation that looks
      right in its first frame and wrong in its third is a real, easy-to-miss
      bug class
- [ ] **Any minigame from `MINIGAME-PROPOSALS.md` that gets built** gets the
      same screenshot discipline as every other page — including its
      ungraded/opt-in entry point, so it's verified that it's actually
      optional and doesn't block the primary DOM path
- [ ] `NEXT_PUBLIC_QA_MODE` (or this repo's equivalent env convention — check
      what's already there before inventing a new var name) freezes orbit
      drift and biome ambient motion to the deterministic base position for
      reproducible screenshots

## 3. Context management — `docs/PROGRESS.md`, same mechanism as UniThrift

This redesign is genuinely large (solar system rebuild + ~44 page templates +
moon integration + testing). It will not fit one Claude Code context window.

- [ ] `docs/PROGRESS.md` gets created in R0 and updated continuously — current
      phase, what's checked off, any blocker, the next concrete step
- [ ] Before `/clear` or a session ending mid-project, `docs/PROGRESS.md` is
      current. The next session reads root `CLAUDE.md`, then this file, then
      `docs/PROGRESS.md`, and resumes — it does not need to be re-briefed
- [ ] One phase (R0-R5) per session is the target cadence, same as the
      project's own established "one phase per Claude Code session, `/clear`
      between phases" rule in `START-HERE.md` §7 — this redesign follows that
      existing house rule, not a new one

## 4. Folder structure — see `FOLDER-STRUCTURE.md`

Read it before creating any new file. The short version: documentation goes
in `docs/`, screenshots in `design/`, redesign-specific source stays inside
the existing `apps/web` and `packages/tokens` structure — **this redesign does
not introduce a new top-level app or package**, it's new code inside what
already exists.

## 5. Session-end discipline — inherited from `START-HERE.md` §7

- End every session with: *"Which parts of this did you actually run, and
  what are you unsure about?"* Same question, same reason — the honest answer
  is usually the most valuable output of the session.
- Write the test first for anything with a correct answer. Nothing in this
  redesign should introduce a new "correct answer" surface (that's the
  question engine's job, untouched), but the moon-mastery visualisation reads
  from real grading data — get the read path tested before trusting what it
  displays.
- Ask for the diff, not the file, on anything touching more than one route.

## 6. What "done" means for this redesign

A task in this track is done when it clears everything root `CLAUDE.md` §8
already requires (compiles strict, tests pass including denial tests if it
touches data, RLS implications stated, keyboard-only, 380px, verified vs.
assumed stated explicitly) **plus**:

- [ ] It has a named template in `TEMPLATE-LINKS.md` and a captured baseline
- [ ] It passes every item in `DESIGN-MANDATE-V2.md` §5's gate
- [ ] If it touches `/app` or `/app/map`, the solar-system-specific gate
      items are checked, not just the universal nine
