# REDESIGN-SIGNOFF.md — the solar-system redesign, R0–R5

**Written 7 Oct 2026 (R5.6).** This is the sign-off report R5 asks for. It is
NOT a declaration that the redesign is complete: four boxes stay open, and
every one of them is a person's to close (section 5). `pnpm phase` counts the
boxes; this file says what they add up to.

Read with: `00-START-HERE.md` (the boundary), `docs/PROGRESS.md` (live state),
the phase files in `phases/` (the evidence, box by box).

---

## 1. What changed

The presentation and game layer of the student app, and the console's pages,
rebuilt from captured templates. In order:

| Phase | What it delivered |
|---|---|
| **R0** scope and guardrails | The boundary table (section 2), five rulings folded into the phase files, and a browser capture of the app as it was (`design/before-r0/`) |
| **R1** solar system foundation | The galaxy became a solar system: a ring per abstraction level, a planet per stage, `layout.ts` as the one pure layout function, Kepler's third law for the orbits |
| **R2** per-student seeded cosmetics | A cosmetic seed, separate from the exam seed by test (R2.3): each student's texture, phase, accent hue and biome differ; structure never does. Found F-40 on closing |
| **R3** page templates and redesign | Every console route rebuilt from a captured template through a six-assertion page gate at 1440 and 380; then the student app **remade** as a game (instructor ruling 2, 30 Sep): one star HUD in the system, a sprite biome inside each planet, the 2D map removed, the neutral paper. Ruling 3 (a paper behind Start, no way back, full screen) and ruling 4 (leaving it submits it) landed inside it |
| **R4** moons | A moon per objective; moons open the next planet (WEB-REVAMP 3.7a); a moon's journey; the four act-1 minigames (Two Columns, Clock Bench, Bus Contention, Cache Tuner); R4.7–R4.9's realistic system (ellipses, bands, belts, rings, comets) |
| **R5** testing and sign-off | The invariants re-run on the new coordinates, the accessibility contract re-run in its own words, the performance budgets measured, the boundary diffed, every route's template and spec counted |

### Before and after

The same route, `/app` at 1440, before R0 and now:

- Before: `design/before-r0/app-map-desktop-1440-default.png`. A flat stage
  list grouped by act under a sparse node graph; every lock described as
  "reaches 70%"; browser-default link colour.
- After: `design/templates/web/app/current-looking.png`, recaptured 7 Oct
  2026 by the full Playwright run (section 4). The textured 3D system with
  its accessible SYSTEM panel: a row of 19 planets grouped by act, locked
  ones a dashed outline, the next stage ringed, course mastery, the key,
  and the key hints (Stages, zoom, reset view, report a problem).
- Both at 380 beside them (`*-mobile-380-*.png`, `current-looking-380.png`).
  Reduced motion before: `design/before-r0/app-map-*-reduced.png`.
- Not to cite: `design/templates/web/app/current.png` is an orphan from 30
  Sep (no spec writes it now; it predates the textures and the CHAT tab).

---

## 2. What stayed the same — the boundary, checked

`00-START-HERE.md`'s table said the redesign would leave the schema, RLS, the
hard rules, the seeded question engine and the eight encounter themes exactly
as they were. R5.4 checked that by diff (`1e3fb09^..HEAD`), not by memory:

| Promised untouched | Found |
|---|---|
| The student app never computes a lock | Holds. 0 added lines in apps/web or packages/tokens name `is_stage_unlocked`; no import of the engine; `pnpm check:boundary` clean |
| The seeded question engine | Holds for grading (`grade.ts` untouched since R0). **Not for the lock and blueprint layer** — see below |
| The 8 encounter themes | Holds. Byte-identical: 145 lines, 16 selectors, in `packages/tokens/tokens.css` |
| Unique game ≠ unique paper | Holds. R2.3's tests green (cosmetics 27, layout-solar 58) |

**Flagged, not silently accepted.** The moon work changed the lock layer
itself, each change by a recorded instructor ruling and each with denial tests:

- `16137e5`: a non-gradeable prerequisite never blocks (ruling 25 Sep).
- `403ec5b`: moons open the next planet. `is_stage_unlocked()` step 4 asks
  for every moon of each gradeable prerequisite, not 70% stage mastery
  (WEB-REVAMP 3.7/3.7a).
- `5259c50`: a moon's journey (an 'objective' blueprint scope); a check on a
  locked stage is refused (hard rule 4).

This is a curriculum decision taken inside a visual redesign, which
`00-START-HERE.md` says must be flagged. It was ruled each time; it is
recorded here so nobody later mistakes it for drift.

---

## 3. Measured, not assumed

| Budget | Result (7 Oct 2026 unless noted) |
|---|---|
| 3D chunk ≤ 250 KB gz | 226.6 KB gz (5 Oct) |
| Draw calls ≤ 50 | 34–47 across the whole system, a giant, the eleven-moon planet, at 1440 and 380 |
| 30 fps floor, throttled | **60 fps** (vsync cap) at full quality under Chrome's 4x CPU slowdown, on the hardware GPU; 57.5 at 8x; **24.1 at 16x even with the guard's lower quality** (it cuts GPU cost, not CPU) |
| Accessibility contract | 7 of 8 lines verified (R5.2); WebGL disabled for real, not stubbed |
| Ruling 4 on the deployment | Verified 7 Oct in a real browser: leaving full screen and a reload each hand the paper in, say why, and are recorded (`left_fullscreen`/`closed` + `auto_submitted`). The run found the reloaded review missing its questions; fixed (`b7bcede`) and re-verified live |

What these do NOT cover: a real mid-range phone's GPU (this laptop's flatters
it), and a person using a screen reader.

---

## 4. Every route: template and spec

R5.5, 7 Oct 2026, against the built apps (preview :5185 and :5186) on a
freshly reset and reseeded database:

- **Templates.** 38 route folders under `design/templates/` (19 web, 19
  console), each with a committed template (`template.png`, or
  `template.jpg` for `/app/stages`) except `web/_direction`, which is the
  remake's look reference, not a route. The names that do not match a spec
  file reconcile to one: `stage` and `stage-figure` → `web-stage.spec`,
  `web-stage-check.spec`; `loading` → `r3-loading-frames.spec`; `map` →
  `/app` (the 2D map was removed, `/app/map` redirects); `students-detail` →
  `console-student-detail.spec`; `forgot-password` and `reset-password` →
  `console-password-reset.spec`; `signin` → `console-gate.spec`;
  `assessments` → `console-assessment-window.spec`; `content-figure` →
  `console-content.spec`.
- **The whole Playwright suite** (`pnpm qa`, this repo's `test:visual`), two
  workers, 22.2 min: **1620 passed, 2 failed, 194 skipped**. Both failures
  were one test at both widths: `/content`'s editor expected chapter 04 to
  have 31 blocks, and it has had 32 since `c08fc7e` (6 Oct) drew its address
  split as a figure. The page was right, the count stale; corrected, the
  spec reran **93 passed**. So: **1622 passed, 0 failed**. The 194 skipped
  are the behaviour tests that run at one width by design, and nothing else.

---

## 5. Open, and whose

Following the project's "not mine to fix" pattern: each is named, with the
document that owns it. None is built around.

| Open | Owner | Where |
|---|---|---|
| Planet summaries approved (R3's last box) | Instructor, on /content | R3 DoD |
| The screen-reader pass (R4.4, R4 DoD, R5.2) | A person with a screen reader | R4.4 |
| A stage's prerequisites listed in text for an OPEN planet (only a locked planet's reason names them today; the map draws no edge, INV-33 ruling) | Instructor: list them, or accept as is | R5.2 note |
| The guard cannot rescue a CPU-bound device (24 fps at 16x) | Instructor: accept, or plan a lighter CPU path | R5.3 note |
| Restoring a flight-path line (INV-33's other half) | Instructor, parked 2 Oct | NEXT-SESSION 0za |
| ~~Accept the moon work's lock-layer changes (section 2) as inside the redesign's scope~~ **ACCEPTED by the instructor, 8 Oct 2026** (asked while approving the Studio's moons plan, `docs/STUDIO-EDITOR-PLAN.md` E2). R5's last DoD box is ticked | Instructor | R5 DoD |

Content the instructor still owes is outside the redesign and is tracked in
`docs/NEXT-SESSION.md` (the 83 act-1 items at review, the 131 questions for
09-12, chapter drafts 08-13, 17 figures).

**`docs/PROGRESS.md` is NOT marked "redesign complete"** (R5.6's second box):
it will be when section 5's first two rows close. (8 Oct 2026: the lock-layer row closed; the screen-reader pass and the planet summaries are still a person's.)
