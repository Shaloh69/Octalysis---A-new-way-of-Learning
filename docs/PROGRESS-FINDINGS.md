# PROGRESS-FINDINGS.md — the findings log, F-1 onward

**Split out of `PROGRESS.md` on 7 September 2026.** That file had reached
**2,003 lines**, is read at the start of every session, and buried the current
state under forty findings — the exact failure `REDESIGN-CLAUDE.md` §2c rule 6
names, in the document that records the rule.

**This is reference. Consult it when a finding is cited; do not read it
through.** `PROGRESS.md` holds live state and links here.

**Append new findings; do not rewrite old ones.** A finding that turned out to
be wrong gets a correction appended to it, not an edit — the wrong reasoning is
often the useful part.

---

## The findings behind those rulings

Kept because the measurements are the reasoning, and a later session should not
have to rebuild them. Numbered so the phase files can cite them.

### F-1 · Moon-derived planet radius is the number the code already computes, and it breaks Stage 00
**RULED: mean of moons, with an explicit Stage 00 fallback to `Math.min(...stages.levels)`.**
`SOLAR-SYSTEM-SPEC.md` §1.1's longest argument retires a collapse rule for
`stages.levels`. That rule already exists in shipped, tested code —
`Math.min(...levels)`, `apps/web/src/lib/layout.ts:69` — and because every
stage's objectives are level-unanimous, "mean of its moons" returns the
identical number for all 18 stages that have objectives. It is the old rule by
a longer route. What it adds is a division by zero on Stage 00. And its stated
payoff — moons "visibly spread across the rings it actually touches" — cannot
occur anywhere in this course.
**Options:** (a) keep `Math.min(...levels)` and drop the moon-derivation, moons
inherit their planet's ring; (b) keep moon-derivation and state a Stage 00
fallback explicitly; (c) something else.

### F-2 · The crowding §1.1 claims to fix is not fixed
**RULED: adopt occupancy-proportional ring spacing.**
Stated reason for the change was that L1 "would carry over a third of both
planets and moons." Measured after the correction: **7 of 19 planets and 43 of
110 moons**, on the second-smallest circumference. Worse, stages 12–16 are five
*consecutive* ordinals all on L1, so with angle = `ordinal` they crowd into a
~95° arc of a small ring carrying 26 moons. The last third of the course renders
as a flat arc, not the "corkscrew" §1.3 promises.
**Proposal:** allocate radial steps by occupancy instead of evenly. Stays
deterministic, stays monotonic in level, keeps the honesty claim. Now explicitly
permitted by the reworded `DESIGN-MANDATE-V2.md` §1B ("ordering is data, spacing
is typography").

### F-3 · Angle = ordinal over a full 360° closes a loop on a chain that has none
**RULED: adopt the ~300° sweep with a visible gap.**
Stage 18 lands ~19° from Stage 00. The single most important true fact about
this graph is that it is a chain with no forks and no return, and the layout
draws it as a near-closed ring.
**Proposal:** sweep ~300° with a visible gap, or advance radius per turn.

### F-4 · Stage 01 loses information the galaxy carried
**RULED: preserve the all-levels rendering.**
`stages.levels` is `{0,1,2,3,4,5,6}` and the current map renders it as a column
crossing every stratum (`layout.ts:66`, `spansAllLevels`). Its objectives are
all level 6, so under the new rule it collapses to a point on the outermost
ring and "this stage is *about* the hierarchy" disappears. The spec never
mentions the regression.

### F-5 · `/app` does not redirect and never renders a canvas — and that is deliberate code, contradicting four documents
**RULED: 3D default on capable devices, degrade in place, nothing redirects.
`VISUAL-SYSTEM-3D.md` §5 owns the rule; the other four documents now point at it.**
Measured, all four combinations: `/app` → `/app`, `canvas=0`, always. `/app` and
`/app/map` are the same component with a `flat` prop; 3D is opt-in via
`localStorage["octa:map-mode"]`, defaulting to `"2d"`. The code says so in a
comment and cites `VISUAL-SYSTEM-3D.md` §5, whose "automatic degradation ladder"
does say *degrade in place* rather than redirect.

Against that: root `CLAUDE.md`, `GAME-DESIGN.md` §2.1, `SKILL-TREE-3D.md` §4 and
`PAGE-SPECS.md` §2 all say `/app` is a 3D galaxy **by default** that **redirects**
to `/app/map`. Two separate questions, and the second is the dangerous one:

1. **Redirect vs. degrade-in-place** — a genuine doc-vs-doc contradiction. The
   code's answer is arguably the better one. Needs one owner named and the
   losing copies turned into pointers, per `DESIGN-REVIEW-01`'s step 3.
2. **3D default-off** — *no* document sanctions this. If it stands, **the solar
   system R1–R5 builds is invisible to every student unless they find a toggle.**
   That is not a detail; it decides whether this redesign has a user.

~~**Not mine to fix.** Both are product decisions.~~ **Both answered.** Question 1
resolved in favour of degrade-in-place, with §5 named as owner. Question 2
resolved: 3D becomes the default, so R1 must remove the default-off behaviour
while keeping the preference as a genuine override.

### F-6 · The map graphic is close to unreadable at both widths
See `design/before-r0/`. At 1440px the graph occupies a fraction of the width as
tiny dark discs; at 380px it is a scatter of near-black specks with no labels and
no visible edges. The act list beneath it carries all the actual information, and
carries it well. Same class as `DESIGN-REVIEW-01` D-1, and invisible to every
green gate. R1/R3 input, not a blocker.

### F-15 · Three visual defects only a screenshot could find
**NEW. All three shipped green through typecheck, 52 unit tests and 32 specs.**

1. **Every biome rendered the same pale planet.** The tint lerped 55% from the
   palette variant toward the biome tint — and a saturated cyan mixed halfway
   with a saturated warm lands on near-neutral white. **The two chromas cancel.**
   It looked exactly like the tint was not being applied. Now 88%, so the biome
   dominates and the palette variant survives as a trace, which is the intended
   relationship. §4.1 says the surface *derives from* the biome; a 50/50 blend
   does not do that.
2. **Comets rendered as grey squares the size of a planet.** A `<points>`
   sprite is a quad, and `sizeAttenuation` made near ones huge. They read as
   debris. Now `lineSegments` with a head and a tail — a streak, which is both
   cheaper to read and closer to what a comet looks like.
3. **The star field had the same problem, and had had it since R1.** Stars were
   scattered from radius 60 while the camera sits at ~30, so a handful were
   closer than the system itself and drew as large grey squares. Visible in
   every solar-system screenshot in this repo and never noticed. Minimum radius
   is now well beyond the camera.

And a fourth, caught by the probe rather than the eye: **progressive reveal
left 19 hit targets over 3 visible planets** — invisible clickable controls in
empty space. A student tabbing the map would land on something with no visual
referent. The hit layer now matches the drawn scene; the act list still carries
all 19, which is where completeness belongs.

### F-13 · The planet HUD was never built — the click went straight to the stage
**NEW. Diagnosed on request, and it was the second of the two possibilities.**

`/app` renders the solar system correctly — checked in a real browser with
every fallback trigger evaluated individually: `reducedMotion` false,
`innerWidth` 1440, WebGL available, no stored preference. One canvas, no flat
SVG, 19 hit buttons. **The map was never the problem.**

The problem was that clicking a planet called `onOpen` → `nav('/app/stage/:id')`
and went straight to the stage. **No camera fly-in, no HUD, no dialog** —
measured `dialogs: 0`, `hudLike: 0`, url `/app/stage/00`. The whole of
`SOLAR-SYSTEM-SPEC.md` §2 had never existed.

**Why it read as built:** R3 landed the hit layer — 19 real focusable buttons
projected onto their planets — and clicking did *something*. Click detection is
not the interaction, and a checklist line reading "camera focus animation on
select" inside a list of rendering bullets got ticked by association. Same
failure shape as the frame rate inside "performance budget checked". Both are
now their own lines in R1 with the reason written next to them.

**Built:** camera easing to the selected planet (in `useFrame`, since drei is
not installed), and the §2 HUD — Act chip, state icon beside the printed state,
the lock reason **printed in full**, subtopic dots, prerequisites named in
text, and an Enter button that is what actually navigates. Focus-trapped,
Escape closes, the orbit stops while it is open.

**Two things it honestly cannot show yet, and does not fake:**
- **Per-dot mastery.** The count is real (from `objectives`), but no
  per-objective mastery exists anywhere in the API — `/api/v1/progress`
  aggregates by (level, competency). Lighting dots from stage mastery would
  invent per-objective state out of an average. Arrives with R4.
- **The summary line and pictogram.** `stages.summary` is **NULL for all 19
  stages**. Rendering nothing is correct; hard rule 5 forbids inventing it.

### F-14 · Two rungs of the degradation ladder had never been built
**NEW, found while confirming the fallbacks had not been weakened.**

`VISUAL-SYSTEM-3D.md` §5's ladder has five rungs. **Only three existed.**

| Rung | Status before |
|---|---|
| 1 · `prefers-reduced-motion` | built |
| 2 · viewport ≤ 640px | built |
| 3 · WebGL unavailable | built |
| 4 · **sub-30fps for 3 seconds → drop a tier, remember it** | **missing** |
| 5 · **Save-Data → drop a tier** | **missing** |

Rungs 1–3 are capability checks answerable *before* rendering. Rung 4 can only
be answered by rendering and watching, which is presumably why it was the one
left out — and it is also the one that matters most for the actual audience: a
220 KB chunk downloads fine on a phone whose GPU then cannot fill the frame.

Last session measured frame rate; it did not implement a frame-rate *fallback*.
Those are different things and it is worth not confusing them.

**Both built now.** Rung 4 samples one-second windows and needs three
consecutive bad ones before acting — a single bad second is a GC pause or a tab
regaining focus, and dropping someone out of the map for a hiccup is its own
bug. The verdict is remembered per device under `octa:map-too-slow`, separate
from the student's own preference so clearing one does not clear the other.
Asserted both ways: a remembered verdict falls back, and the guard stays quiet
on a machine that holds 30fps.

~~Still not built from §5: the `/app/settings` Full / Reduced / Off
override.~~ **BUILT.** Two options rather than three: §5 says "Full / Reduced /
Off", but Reduced and Off are the same thing here — there is one 3D surface and
it is either drawn or it is not, and a third setting that did nothing different
would fail the mandate's consequence test. Choosing the solar system also
clears a remembered too-slow verdict, because a student overruling the guard is
what an override is for; it re-measures and can fire again.

### F-12 · R3 cannot be completed as written — ~20 of its routes do not exist
**NEW. The biggest planning fact for the next session.**

R3's definition of done says "all 44 routes checked, each with a template
screenshot and an implementation screenshot on file." Counted against the real
app:

| | Routes in `TEMPLATE-LINKS.md` | Actually built |
|---|---|---|
| Public | 13 | 4 — `/`, `/login`, `/register`, `/maintenance` |
| Student | 16 | 7 — `/app`, `/app/map`, `/app/stage/:id`, `…/check`, `/app/progress`, `/app/settings`, `/app/work` |
| Console | 15 | 14 |

`apps/web/src/pages/` holds **four files**. Missing: `/course`,
`/how-it-works`, `/for-teachers`, `/accessibility`, `/about`,
`/forgot-password`, `/reset-password`, `/404`, `/500`,
`/app/stage/:id/results/:attemptId`, `/app/final`, `/app/lab` and its three
simulators, `/app/notebook`, `/app/mistakes`, `/app/live`, `/app/help`.

**A template pass cannot be applied to a page that does not exist**, and
building them is not a template pass — `/app/lab/fde` means building the FDE
stepper, which is P6 and `GAME-DESIGN.md` §6.4 calls "the part that actually
makes it a game". Several also depend on chapters 08–18 being authored, which
they are not.

So R3's real scope is: **template-pass the ~25 routes that exist**, and treat
the ~19 that do not as P-phase build work scheduled separately. The console is
in good shape (14 of 15) and is where the template merges in
`CONSOLE-DATA-AND-TEMPLATES.md` actually pay off; the student app is where the
gap is. This needs a ruling before R3 is planned as a whole.

### F-10 · The 3D layer had never used a design token
**NEW in R2, and the most consequential finding so far.**

`tokenColor()` in the canvas did `new THREE.Color(raw)` on a token's value.
**Every token in this project is authored in OKLCH**, which three.js's colour
parser does not understand — it handles hex, `rgb()`, `hsl()` and named
colours. So every read threw, hit its catch, and returned a hardcoded HSL
fallback. The galaxy had been running that way since it was written.

`VISUAL-SYSTEM-3D.md` §6 opens "Never write a literal hex in a 3D scene… Read
the resolved CSS custom properties once at scene setup and convert." The read
was there. The convert never happened.

Why nothing caught it: `scan:palette` passes because there is no literal hex;
`check:contrast` passes because the tokens were fine — they simply never
reached the scene; TypeScript sees a valid constructor call. It surfaced only
because two students with deliberately different palette variants rendered
identically in a screenshot, and the screenshot was looked at.

**Fixed:** the canvas now paints one pixel to a 1×1 2D canvas and reads it
back, so the browser does the colour maths. That also avoids a second copy of
OKLCH→sRGB drifting from the one `scripts/check-contrast.mjs` already owns.
`docs/VISUAL-SYSTEM-3D.md` §6 records the whole thing.

**Related and now removed:** `apps/web/src/components/GalaxyCanvas.tsx` was
dead after R1 and carried the same broken conversion. Deleted rather than left
as a second, wrong copy of the map renderer.

### F-11 · The visual harness was flaky, and it was my fault
**NEW in R2. Fixed in the same session.**

`design/specs/*.spec.ts` used `waitForTimeout(1800)` as a synchronisation
primitive. That passes at one worker and fails at eight against a single Vite
dev server — four tests failed, all of them assertions about `.act-list`, which
reads exactly like a product bug and is not one.

Fixed properly rather than by raising the number: the specs now wait on real
conditions (`html[data-planet]` for "the cosmetics fetch has landed",
`.act-list` for "the DOM layer rendered", `canvas` only where the ladder says
one should exist), and `playwright.config.ts` caps workers at 4 locally and 2
in CI because one dev server and one API process are a real bottleneck.

Worth knowing for R3, which adds a lot more specs: a fixed sleep in a visual
test is a latent false failure, and the tell is passing serially while failing
in parallel.

### F-8 · 47 CSS declarations reference custom properties that do not exist
**NEW in R1. Not caused by this work — it predates it.**

`apps/web/src/styles.css` uses `var(--ink-dim)` **27 times** and `var(--rule)`
**20 times**. Neither is defined anywhere in `packages/tokens/tokens.css`. With
no fallback those declarations are invalid at computed-value time: `color`
inherits instead of dimming, and a border falls back to `currentColor`.

Every gate stayed green, each for a specific reason worth writing down.
`scan:palette` passes because there is no literal hex. `check:contrast` passes
because it computes **token pairs**, and these are not tokens at all.
TypeScript never sees CSS. Same shape as `DESIGN-REVIEW-01`'s
finding-behind-the-findings: a class of defect no automated check here can see.

The intent looks obvious — `--ink-dim` wanting `--ink-muted`, `--rule` wanting
`--line`, both of which exist — but "looks obvious" is an inference about
someone else's intent across 47 sites, so this is a **decision, not a cleanup**:
alias the two names in `packages/tokens` (lower risk, keeps the call sites), or
rewrite the call sites (one fewer concept). Recommend aliasing first so the
visual change lands in one reviewable step, then deciding whether to rename.

`GalaxyCanvas.tsx` reads `--ink-dim` three times too, so the star field and edge
colours have been hardcoded HSL fallbacks all along — in the one file most
committed to routing every colour through a token. `SolarSystemCanvas.tsx` uses
`--ink-faint`, which exists.

### F-9 · The documented bundle baseline is stale, and nothing measures it
**NEW in R1.**

`VISUAL-SYSTEM-3D.md` §5 records "51.9 KB + 3.8 KB CSS" as the initial bundle.
Measured at HEAD **before** any R1 change: **69.62 KB JS + 7.49 KB CSS**. The JS
figure has drifted 34%; the CSS has nearly doubled. Presumably across P4–P9.

That section ends "A budget nobody measures is a wish", which turned out to be
exactly right: `pnpm scan:bundle` checks for answer-key and secret leaks, not
size, so nothing in CI has ever compared these numbers to the document.

The ≤250 KB **3D chunk** budget — the one that actually protects the phone
audience — is intact at 220.37 KB. It is the initial-bundle line that rotted.
Worth doing: correct §5's numbers, and decide whether `scan:bundle` should gain
a size assertion so the next drift is caught by CI rather than by someone
reading a document three phases later.

### F-7 · RESOLVED 2 Sep 2026 — and the drift was not cosmetic

**The instructor ruled:** Prelim covers chapters 1-4, Midterm 5-8, Semi-finals
9-12, Finals 13-17, **and the Finals is cumulative — it covers 1-17.**

`db/schema.sql` was one stage out on every boundary: it grouped 00-05 / 06-09 /
10-13 / 14-18, putting chapter 5 in the Prelim, 9 in the Midterm and 13 in the
Semi-finals. **That was never a labelling problem.** The examination blueprints
scope by `by_act`, so each of the four papers was sampling one chapter from
beyond its own grading period — a student revising to the syllabus would have
been right and the generated paper wrong. Three rows changed (05→2, 09→3, 13→4)
and all four exams re-scoped with them.

The cumulative half was already correct: the Final Examination blueprint weights
all four acts 8/8/10/24, with the heavier end on material examined nowhere else.

Act names are now printed, and the Finals carries **"cumulative — covers the
whole course"** beside it. It is the one period whose name misdescribes its
scope, and a student who reads "Finals · 13-18" and revises only those chapters
has been misled by a label we chose. The stage range stays printed beside every
name so the grouping is checkable rather than trusted.

**STILL OPEN — chapter 18.** The ruling's ranges stop at 17, but chapter 18
(Distributed Systems Architecture) exists, is published and is gradeable. It
sits in Act 4 because every stage must belong to a period for `by_act` to reach
it, and omitting it would silently drop it from the only cumulative exam. That
is an assumption, not a ruling: **is chapter 18 examinable, and in which
period?**

### F-7 (original) · Inherited from DESIGN-REVIEW-01
**D-3, act grouping.** Three sources, three answers: `StageMap.tsx:297` renders
narrative act names, `stages.act` groups 00–05/06–09/10–13/14–18, and `CLAUDE.md`
says Prelim 1–4 / Midterm 5–8 / Semis 9–12 / Finals 13–17. Confirmed still
present in the R0 captures. **This redesign promotes Act to a HUD chip *and*
four-colour banding on the flight path**, so an unresolved grouping gets rendered
more prominently, not less. Still the instructor's call.

**D-4, submissions-queue density** — *superseded: FIXED in R3, 2 Sep 2026, the
queue going from 3,436px to 1,219px. Kept here only because this block records
what was true when F-7 was written.* `CONSOLE-DATA-AND-TEMPLATES.md` §2 points
at it correctly rather than at a plan file that does not exist.

---

### F-16 · The first-run copy was mine, and nothing on screen said so

The first-run panel was built with three steps of real-sounding prose about
what the sun is and what distance encodes. Correct-sounding, plausible, and
**written by nobody who teaches CPE 412** — hard rule 5's exact failure mode,
in the first paragraphs a student reads in this app.

Ruled by the user: keep the panel, replace the copy with obvious placeholders,
and **say on screen that it is not real content.** Built that way — a visible
"placeholder text — not real course content yet" label, a `PLACEHOLDER` flag to
delete when real copy lands, and step bodies that name the SUBJECT each real
step should cover without asserting anything about the course.

The flag is explicit rather than inferred from the text, so removing the
scaffolding is a deliberate act rather than something that happens by accident
when somebody edits a string.

The real copy inherits one constraint, recorded in `SOLAR-SYSTEM-SPEC.md` §2b:
**it must not name the rings.** Stage 11's reveal is ten weeks of unexplained
descent, and a week-one tutorial that labels the hierarchy spends it.

### The `?` replay button — what made "Skip" honest

Dismissing the tour used to be permanent, and the panel simply vanished. That
quietly inverts the cost of Skip: leaving early means losing the only
explanation the map has, so the safe move becomes reading a tutorial you do not
want. A 44px `?` now sits in the dismissed panel's own slot and replays it from
step one.

It sits in the slot rather than floating in a corner so that replaying shifts
nothing and the control keeps a sane tab position; its accessible name is a
sentence, because a `?` is a glyph and "question mark" is not a thing anyone can
make a decision about; and replaying does **not** clear the seen flag, since the
student asked to see it once more, not to be greeted again next visit.

Both paths are now covered by spec — the first-run panel had **no test at all**
before this, despite being the first thing every student sees.

### F-17 · The 2D map kept coming back, and the frame-rate guard was why

Reported from a real session: the student was landing on the flat map instead of
the solar system. Not a rendering failure — the degradation ladder demoting them,
correctly by its own rules, wrongly in fact.

`FrameRateGuard` dropped to flat after 3 seconds under 30fps and wrote
`octa:map-too-slow`. Three things were wrong with that, and they compounded:

1. **It measured during warm-up.** Shader compilation, geometry upload, the lazy
   chunk settling, React mounting the overlay — the first seconds of a WebGL
   scene are its slowest by construction. The guard judged the scene at the one
   moment it was guaranteed to look worst.
2. **A single stall counted as a second of bad frame rate.** A tab switch, a GC
   pause, a laptop sleeping — one enormous delta, averaged into a one-second
   window, reads as catastrophic.
3. **The verdict was permanent.** Nothing ever re-measured. One bad startup
   demoted that browser forever, and because this ladder is deliberately silent
   the student got no explanation and no way back.

Confirmed independently by the suite, not just by report: "the guard does NOT
fire on a machine that can hold 30fps" was **failing** — `guard fired when it
should not`.

Fixed: 4 seconds of unmeasured warm-up, frames over 0.5s discarded rather than
counted, and the verdict stored as `{"at": <epoch ms>}` with a seven-day TTL. The
legacy `"1"` parses to a number rather than a record and is therefore read as
stale, which **releases every browser the old flag stranded** with no migration
step. Two new specs cover the expiry and that release, the second precisely
because it runs once per browser and would otherwise never be exercised.

**Ruling (2 Sep 2026): the flat map stays.** Asked whether "remove 2D completely"
meant deleting the flat presentation, the answer was to stop it *appearing*
spuriously and keep it as the accessibility fallback. A `<canvas>` has no
accessibility semantics, so the DOM layer is the only path for a screen reader,
reduced motion, a portrait phone, or a machine without WebGL. Rung 4 protects a
student on a weak device; it must not take the map from one on a capable device,
so when it is wrong it must be wrong temporarily.

### F-18 · Two invariant tests had outlived the design — one failing, one vacuous

`pnpm verify` was **red on `main`**, and had been. I had been running `pnpm qa`,
typecheck and the contrast gate and calling that verified. It is not: `verify`
runs the unit suites, and one was failing.

**The loud one.** `services/api/test/cosmetics.spec.ts` forbade the bare word
"seed" in `layout.ts`. True when written; false since R1, when §5's moon preview
deliberately threaded a numeric seed into `computeSolarLayout`. The invariant
worth protecting was never "the string is absent" — it is that cosmetics cannot
reach curriculum **structure**. Rewritten to forbid student identity and
cosmetic appearance, case-insensitively and on stems.

**The silent one, which is worse.** `apps/web/test/layout-solar.spec.ts` asserted
`computeSolarLayout.length === 2` under the heading *"there is no seed input at
all"* — while a third parameter, `previewSeed = 0`, existed. **`Function.length`
ignores defaulted parameters**, so the claim was green and false. That is the
identical trap this repo already documented for `deriveCosmetics(key, examSalt =
"")` in the very same suite; it was fixed there and never swept for elsewhere.
Now asserted against the source signature.

Both were **mutation-tested** rather than assumed: adding a `studentAccentHue`
parameter to `layout.ts` makes each go red. The first attempt at the tightened
word list did *not* catch it — "studentAccentHue" contains neither "studentId"
nor "accentHue" as a case-sensitive substring — which is exactly why the
mutation check was run.

### F-19 · Two environment traps that cost real time

**`pnpm verify` truncates the demo data.** The API suite calls `resetAll()`.
Restoring it takes TWO steps, not one: `db/demo-seed.sql` brings back the
profiles and progress, but only 4 objectives — the other 110 come from
`node scripts/sync-content.mjs`, because `content/stages/*.md` front matter is
the authoring source of truth. A map with every stage locked and no moons is
that, not a regression. `DESIGN-REVIEW-01.md` documents the first half; the
content sync is the half that was missing.

**A cold Vite server fails four baseline tests.** `before-baseline.spec.ts` sorts
first alphabetically and absorbs the dependency-optimize pass: `networkidle`
never settles and the stage list has not mounted. Warm, it passes 8/8 in 5.6s.
**Warm the server before believing a red run.**

Also corrected in the launch sequence: the API health route is **`/healthz`**,
not `/health` (which 404s and will hang a naive wait loop forever), and
`playwright.config.ts` sets `webServer: undefined` **deliberately**, so a dead
stack reports as `ERR_CONNECTION_REFUSED` on every route rather than one clear
error. Restarting the API needs the old process killed first — a second instance
silently loses the port to `EADDRINUSE` and keeps serving the OLD build, which
is how a payload change can appear to have no effect.

### F-20 · The moons were selectable but unnamed, and the act text went nowhere

Both found by cross-referencing the specs against a live browser rather than
re-reading them, and both are defects in work committed the same session.

**The moon list read `05.1 L0`, six times.** `/api/v1/stages` sent `{id, level}`
under an explicit comment — "levels only, no descriptions… the objective's text
arrives with the stage itself" — which was right while moons were decoration and
wrong the moment §5 made them selection targets. `objectives.description` is
authored data sitting in the database ("Differentiate DRAM and SRAM"), so
surfacing it is what hard rule 5 *requires*, not a violation of it. Nor is it
newly exposed: the per-stage route already returns descriptions for a **locked**
stage on purpose.

Two things fell out of it. `StageNode` in `packages/contracts` never declared
`objectives` at all, though the API sent them and the web app consumed them —
the exact drift "Zod at every API boundary" exists to prevent. And `.hud-moons`
was declared **twice** in `styles.css`, the later rule a leftover from the dots
era, which laid the caption out as a one-word-per-line column beside the list.

**The act text was deleted from the map and never re-homed.** `/app/stages` had
no acts at all — one H1 over a flat 19-row list. Now grouped into the four
periods with per-act progress. Still no NAMES: `stages.act` groups 00–05,
`CLAUDE.md` says Prelim 1–4, the superseded map said a third thing. D-3 is still
the instructor's call, so the heading is a numeral and a stage range, both true
under all three readings. Printing "Prelim" over a group containing chapter 05
would be worse than printing nothing, because a student would believe it.

### F-21 · The flat map was a different picture, and two maps drew at once

Ruled 2 Sep 2026: the flat map should still LOOK like the galaxy — orbits, moons,
planets — but hold completely still, and selecting a planet should go through
§4.1's warp instead of zooming.

**It was a level-strata DAG with its own `computeLayout`.** That is a second
authoring of the map, which root `CLAUDE.md` forbids outright, and it had already
drifted: it drew strata the solar system replaced with rings. A student sent to
it by reduced motion or a slow device did not get a quieter version of the map,
they got a different diagram of the same curriculum and had to rebuild their
mental model to use it. `VISUAL-SYSTEM-3D.md` §5 says the flat route "is never a
degraded mode"; a layout sharing nothing with the 3D one makes that untrue in the
way that matters most, which is recognition.

`FlatGalaxy.tsx` now reads `computeSolarLayout` — the actual function the canvas
uses — projected x/z → x/y in SVG. The old `MapSvg` is deleted.

**`/app/map` was drawing BOTH.** Confirmed in the browser: one canvas and one
flat galaxy, on the same route, painting the same rings slightly out of register.
`StageMap` carries a comment forbidding exactly this, but the backdrop is mounted
in `App.tsx`, a level above it, so the comment governed a component that was
never the problem. It was survivable while the two pictures looked nothing alike.
Fixed in `App.tsx`, and now asserted in both directions.

**Nothing on it moves**, and that is tested twice: a 1.2s stillness check, plus
an assertion that no CSS animation is *declared* anywhere in its subtree — a
static frame alone would not prove it, because a slow enough animation looks
still.

**Two measurement findings, neither guessable from the source.** The stage id was
SVG `<text>`, which renders at **6×4 pixels** on a 1140px map and would be ~4px
at 380px: font size inside a viewBox scales with the drawing, and this drawing
holds 19 planets and 110 moons. Labels moved to the DOM hit layer, sized in rem.
And `stroke-width: 0.04` in layout units is a **0.6px hairline** at ~16px/unit,
which is why locked planets were fainter than the moons orbiting them — the big
thing looked less important than the small ones.

Star field: the CSS box-shadow technique, sourced and documented at
`BIOME-AND-LOADING-SPEC.md` §4.1b, with the loop animation every published
version has deliberately removed.

**Still open, and deliberately not done here:** `apps/web/src/lib/layout.ts` is
now dead — nothing imports it but its own test file, `apps/web/test/layout.spec.ts`.
Deleting a module and its suite is a bigger call than this pass needed, so it is
flagged rather than taken.

### F-22 · Stage 00 has objectives, and the sun's burst became chance

**Stage 00, ruled 2 Sep 2026.** Orientation is "part 2 of the tutorial": it
explains what the course covers, what a student will encounter, and how the
learning system works. Five objectives authored in `content/stages/00.md`.

Every one is about the course's shape or about OCTA itself — the four grading
periods, how a stage unlocks, how to read a lock's distance, how to move between
map/list/progress, and why every paper differs but is equivalent. **None assert
anything about computer architecture**, so hard rule 5 holds: this is not
invented course content, and chapters 01-18 still carry the subject matter.

Safe by construction: stage 00 stays `gradeable: false` and every blueprint sets
`exclude_non_gradeable_stages: true`, so these can never be sampled into an
examination. They exist to give orientation moons, a competency footprint, and
something a student can actually check off.

They also do NOT name the seven levels. The depth gauge stays unexplained until
Stage 11 — the prose has always respected that ("What it measures is named later
in the course") and the objectives keep the same line.

**F-1's fallback survives its own obsolescence.** Stage 00 was the only stage
with no objectives, so the mean-of-moons fallback now has no real data
exercising it. The branch stays — nothing stops a future chapter being authored
before its objectives — but the test no longer leans on stage 00 staying empty.
It builds a synthetic objective-less stage instead, and a second test records
"every stage has objectives" as a fact that goes red if that ever changes. A
test whose fixture can be deleted by unrelated content work is not a guard.

**The sun's burst is now a random event**, roughly one click in twelve. §1.1b
reserved it for "the first time a student interacts with the sun", which needed
a durable has-this-person-ever signal: a session flag re-fires the "first" time
every visit, `localStorage` re-fires it on every new browser, so the one thing
the moment had to be — once — was the thing neither could promise. Chance needs
no memory. It is also better behaved: a once-ever burst can be missed by
clicking while looking elsewhere and then never seen again, where this one stays
possible, which makes the sun worth touching twice. One `pulse` ref carries both
intensities, so there is no second piece of state.

### F-23 · Every minigame was pinned to the wrong chapter

Chapter 18 is confirmed in the Finals (instructor, 2 Sep 2026), closing F-7's
last open edge. The rest of this finding is about the games.

**`GAME-DESIGN.md` §11's table named chapters from the superseded course** — all
eleven rows. "02 Machine Language" when chapter 2 is Computer Evolution and
Performance. "10 Digital Logic" when this syllabus contains no digital-logic
chapter at all. "13 Fetch–Decode–Execute" when chapter 13 is Reduced Instruction
Set Computers. Building from it would have put a half-adder sandbox inside a
chapter about instruction sets.

**§10.3's Phaser assignment was derived from that same table**, so the three
canvas stages — 10, 12, 13 — were themselves wrong, and that number had been
copied into root `CLAUDE.md` as a dependency rule. So had `codemirror (stage 15)`,
where chapter 15 is Control Unit Operation and the x86 listings are chapters 10
and 11.

**Three of the five approved proposals were mis-pinned too**, which matters more
because they are approved work:

| Proposal | Was | Chapter actually is | Now |
|---|---|---|---|
| 1 · Hazard Interceptor | 14 · ILP | ✅ correct | unchanged |
| 2 · The Descent | 16 · "Memory Hierarchy" | ❌ Microprogrammed Control | **04 → 06** |
| 3 · Fault Line | 18 · Distributed Systems | ✅ correct | unchanged |
| 4 · The Amdahl 500 | 17 · "Performance & Future" | ⚠ Multicore Computers | 17, renamed |
| 5 · Mnemonic Sprint | 15 · "Writing Assembly" | ❌ Control Unit Operation | **10 → 11** |

A memory-hierarchy platformer inside Microprogrammed Control, and an assembly
typing drill inside Control Unit Operation, would each have assessed a verb the
chapter does not teach — precisely what §8.3's verb test exists to prevent.

**The rewrite is driven by archetype, not taste.** `stages.archetype` already
fixes each chapter's beat sequence, so A→sort, B→drill, C→remix, D→simulator.
The minigame is the stage's signature beat rather than an arcade game bolted on,
which also means only **D** stages are canvas candidates at all. Eighteen games
now, one per chapter, plus two spanning encounters.

**Phaser goes from three scenes to five, stated rather than hidden.** Three of
the approved proposals are canvas-native by construction (shooter, platformer,
tower-defense). The marginal cost is not another megabyte each — Phaser is one
lazily-loaded chunk shared across scenes — but each new scene owes build effort
and its own accessibility work, so each now owes a documented DOM path to the
same objective. **Reversible if that trade is unwanted:** Fault Line and The
Descent are the two that could be argued back to DOM.

Reference implementations are named per game in §11.1 so nobody starts from a
blank file, and they are marked **references, not vendored code**: only Phaser
itself and the official React+TS template are licence-verified, because nothing
is being copied from the tutorials. The same discipline `BIOME-AND-LOADING-SPEC.md`
§2 applies to art, learned when a biome pack turned out to be do-not-use.

**Not yet done:** none of these are built. The table is now safe to build from,
which it was not before.

### F-24 · R3 begins: the universal gate is mechanical now, and it found things

R3.0 asks for the nine-item gate to be confirmed per route — twenty-odd routes,
by hand, by eye. That is precisely the checking `DESIGN-REVIEW-01` proved does
not survive a deadline: 291 tests and three static gates were green while the
console shipped 96-pixel text inputs, because nobody loaded the page.

`design/specs/r3-gate.spec.ts` runs the mechanical five on every built route,
both widths, every time: 380px without sideways scroll · visible focus · reduced
motion honoured · every control named · one `main` and exactly one `h1`. The
other four (six states, AA on three themes, zero literal hex, error copy) stay
where they already are — two static gates and human judgement — and the file
says so rather than pretending.

**What it found on its first run:**

**The flat map failed its own written gate.** §5 says the flat map "names every
ring, planet, and moon in text, INDEPENDENT of whether Stage 11 has been
reached… the withholding is allowed to be cosmetic, it is not allowed to be an
accessibility gap." It was a gap: a screen-reader user got 19 stage buttons and
nothing else, because the rings and all 115 moons lived only inside an
`aria-hidden` SVG. There is now an `sr-only` map key naming all seven orbits and
every stage's subtopics by their authored descriptions — while the drawing still
withholds the ring names until Stage 11. That is the gate's own resolution, not
an inconsistency: the reveal is a framing device for a sighted user, and nobody
should wait ten weeks for information the layout has always had.

**`/students`' sortable column headers were 18px tall and did not say what they
did.** `--control-h-sm` is `2rem` and `tokens.css` calls it "dense table
actions", so 18px is barely half the system's own floor for exactly this
control. Worse than the size: the sort glyph was one fixed `aria-hidden` icon,
identical in all three states, and nothing carried `aria-sort`. Pressing it
reordered the table and told you nothing — the design mandate's legibility test,
failed outright. Now 32px, with `aria-sort` on the `<th>` and a glyph that
reflects direction.

**`/locks`' lock matrix was 28px.** 19 stages × 25 students of `h-7` cells,
below the same floor. Raised to `h-8`.

**Two false starts worth keeping, because both would have wasted someone's day:**

1. **The focus test reported `/register` as having no focus indicator. It was
   wrong.** `:focus-visible` — which every focus style in this project correctly
   uses — deliberately does not match a programmatic `.focus()`. The global rule
   was right there giving a 2px accent outline. The helper now presses **Tab**,
   like a student would. A test that fails working code is worse than no test.
2. **My own fix broke a gate.** Adding a redundant `sr-only` span for sort state
   pushed `/students` to 497px at a 380px viewport. Tailwind's `sr-only` is
   `position: absolute`, `.table-scroll` is not `position: relative`, so the
   spans escaped the scroller's clipping, took their static position near the
   right edge of a 554px table, and dragged the document with them. Bisected in
   the browser rather than guessed: removing the six spans dropped scrollWidth
   497 → 361. `aria-sort` already carried the state, so the span was redundant
   as well as harmful. **An invisible element broke a layout gate** — a good
   reason not to add one you do not need.

`/login` and `/register` were checked against `DESIGN-REFERENCES.md` §7 and
**already implement it**: the POST panel with CPU/MEM/BUS/AUTH readout, the
notched frame, the staged assembly, and reduced motion going straight to the end
state. No rebuild needed, which is what R3.0 step 6 is for — confirming, not
redoing.

### F-25 · R3.3 begins — the page you'll use most, and a fixture that does not exist

`/students/:id` is what `STATUS.md` calls "the page you'll use most", and
`CONSOLE-DATA-AND-TEMPLATES.md` §2 asks for TanStack's expanding-rows pattern on
its attempt history, "where expanding a row reveals the regenerated exact
variant". Built.

**The point is not the widget.** A teacher marking a class scans the list,
checks one paper, and carries on. Navigating to `/attempts/:id` answers the same
question and costs them their place in the list — the wrong trade on the page
they live in. So expanding reveals a *summary* — per item: ordinal, stem, what
the student answered, the key, the stage — and `Open paper` still goes to the
full page, because a disputed mark deserves the whole thing.

It is not a second copy of `AttemptPage`, and it must never become one:
`scripts/scan-bundle.mjs` searches the STUDENT bundle for exactly these field
names with a live database value, so the check cannot pass vacuously. Showing
the key is allowed here for the same reason it is allowed there — staff,
console, submitted attempt, `ai_after_submit` at the database level.

**`db/demo-seed.sql` seeds ZERO attempts.** The console's most-used page had
nothing to show, and could not be reviewed, screenshotted or tested end-to-end.
That is a real fixture gap, not a test inconvenience: every judgement anyone has
made about this page was made against an empty state.

The spec therefore **builds its own data** — starts and submits an attempt
through the real API exactly as a student would, rather than depending on one
somebody created by hand, which is not reproducible and would rot on the next
`pnpm db:reset`. Assessment ids are generated UUIDs from `schema.sql` and are
**not stable across a reset**, so it looks the assessment up by title. Worth
fixing properly later by seeding a submitted attempt, and worth knowing now.

**Also corrected:** a line in this file still described D-4 as open while the
header recorded it fixed. D-4 is fixed — the submissions queue went from 3,436px
to 1,219px in R3.

### F-26 · The audit log repeated D-4, and it was worse than D-4

`/audit` rendered one bordered card per entry. Measured with 24 real entries:
**109px each**. The page asks the API for 300, so at full load that is roughly
**32,600px — about 33 screens** — to find one lock change, on a page whose only
purpose is being scanned. D-4's submissions queue was 3,436px.

`CONSOLE-DATA-AND-TEMPLATES.md` §2 had already called it: "most admins will want
the table by default and the timeline as an alternate view, not the reverse —
dense-first, same lesson as the submissions-queue fix." The page was built the
reverse way round.

**Now 41px per entry — 2.7× denser**, and 12,300px projected at 300 rows instead
of 32,600. The timeline is kept, not deleted: reading a sequence of events in
order is genuinely better for reconstructing one incident. It is the wrong
default for finding it.

**The reason is never truncated, in either view**, and that is asserted. It is
the field a grade dispute turns on; making the page scannable was meant to make
it findable, so clipping it would trade away the thing being looked for.

The toggle uses `aria-pressed` rather than a tab set: these are two renderings of
the same rows, and calling them tabs would tell a screen-reader user that
switching moves them somewhere else.

**The density is now a number in a test, not a screenshot.** `console-audit.spec.ts`
asserts under 60px per row — loose enough that ordinary padding changes are not a
failure, tight enough that the 109px card list, or any drift back toward it,
is.

### F-27 · Two test defects of my own, both caught by running the suite

**My audit spec broke nine solar-system tests.** To generate audit entries it
set **global** locks, which changes `is_stage_unlocked()` for every student —
while the map specs were reading the map in parallel. They failed correctly: the
map really had changed underneath them. Fixed by scoping the locks to one seeded
student (`21-0001`) that no other spec observes. **A test that writes shared
state has a blast radius, and mine was the whole curriculum.**

**The sidebar docking assertion raced an animation.** It intermittently read
1442 against a 1440 viewport, because the panel enters by translating in from
the right and the measurement caught it mid-flight. The page was never wrong;
the measurement was early. It now awaits the element's own `getAnimations()`
before measuring — exact, where a 2px tolerance would have hidden a real
overflow if one ever appeared.

### F-28 · The item bank was the third card list, and `.table-scroll` was the real bug

`/items` was a card list at **122px per item** — ~4,000px for 33 items, and the
bank targets roughly 40 live items per gradeable chapter, so about 700 items and
85,000px at full size. `CONSOLE-DATA-AND-TEMPLATES.md` §2 had already paired it
with the submissions queue: "the same shape… should be solved together against
the same reference rather than separately by taste."

Now a table at **72px per row**, with every field the cards carried given a
column, and both psychometric warnings intact in words — "at guessing", and "the
key is probably wrong" for a negative point-biserial. Those sentences are why a
teacher opens this page; compressing them into a colour would have been the
density pass eating the thing it was meant to surface.

**Two mistakes of mine on the way, both worth keeping:**

**I calibrated the density bound against an empty column.** The first
measurement said 67px — taken while the database was missing its objectives, so
that column rendered nothing. With real data the rows were **98px**, which
against 122px is a rounding error, not a density pass. Clamping the objective
sentence to two lines (full text on hover) and giving the stem room is what
bought the real improvement. **A bound calibrated on absent data passes and
means nothing.**

**The 30-exposure explanation was printed on every row.** On a fresh bank that
is every row — 22 copies of one sentence, and the single biggest contributor to
height. It is stated once above the table now. Repeating an explanation per row
is how a density pass quietly gives back what it won.

### F-29 · `.table-scroll` was not a containing block, and it cost two bisections

An `sr-only` label inside a table header broke the 380px gate on `/students`,
and then again on `/items`, and the second time made the pattern obvious.

Tailwind's `sr-only` is `position: absolute`. `.table-scroll` had `overflow-x:
auto` but no `position`, so such a child resolved against the initial containing
block instead of the scroller: it escaped the clipping, took its static position
out at the right-hand edge of a table far wider than the viewport, and dragged
the **document's** `scrollWidth` with it. **An invisible element broke a layout
gate** — twice.

Fixed at the root: `.table-scroll` is `position: relative`, which closes the
whole class. The sticky first column on `/locks` was checked through a 200px
horizontal scroll afterwards and still pins. The two headers that triggered it
now use `aria-label` on the `<th>` rather than a positioned child — a column
header needs a NAME, not an element.

`StudentDetailPage` had carried the same `sr-only` header since before this
pass, so the bug was already in the codebase waiting for a wide enough table.

### F-30 · The fixture gap, partly closed

`db/demo-seed.sql` now seeds **one item with real psychometrics** — 120
exposures, p-value 0.18, discrimination −0.12, flagged. Before it, every item in
the bank had zero exposures, so the branch that matters most on `/items` could
not be seen, screenshotted, reviewed or tested by anyone. Deliberately one item:
this is a fixture for reviewing a rare state, not a claim that the bank is in
trouble.

Attempts and audit entries are still unseeded; those two specs build their own
through the real API (F-25, F-27).

**Also relearned:** `db/demo-seed.sql` alone leaves the database with 4
objectives. `scripts/sync-content.mjs` is the other half, and forgetting it
broke the map specs mid-session — the second time this session. It is written
down in F-19; writing it down was evidently not enough.

### F-31 · The plan disagreed with the repository, and now says so out loud

`R3-page-templates-and-redesign.md` sat at **0 of 44 boxes ticked** while eight
of its routes had been reworked, measured and committed. The work was going into
`PROGRESS.md` findings; nobody ticked the plan. This file's own heading had
already done the same thing once — it read *"R2 complete, R3 next"* for several
sessions after R3 started.

**A plan that disagrees with the repository is worse than no plan**, because
someone will act on it. Reconciled: **13 ticked, 31 remaining**, and every tick
means *verified in this repository*, not *believed done*. Combined items that
are partly finished now say which part — `/audit · /feedback · /live` records
that only `/audit` is done rather than staying a silent blank.

**Made a rule, not a resolution.** `REDESIGN-CLAUDE.md` §2b and root `CLAUDE.md`
now require: name the phase and sub-item when starting, **tick the phase file's
box in the same commit as the work**, write the reason beside any item that will
never be ticked, and close by naming what the phase still owes. A checklist
reconciled in a separate pass drifts again — this one already did.

### F-32 · The four untemplated routes, searched rather than guessed

R3 named four built routes with no template row and asked for "a template row or
a record of why not". All four have one now, and one of them is a *why not*.

| Route | Answer |
|---|---|
| `/app/work` | shadcn.io **File Manager Table View** + **File Upload Bulk**. The page reads as "assignments" but behaves as "files with deadlines", which was not obvious in advance — and it carries **40% of the grade** |
| `/console/submissions` | The **same dense-table reference** as `/items` and `/audit` (shadcn-admin Tasks). `is_late` must be a visible column — D-4's original defect was that it was not shown at all |
| `/console/system` | The **status/health-page pattern** from DevOps shadcn templates. Take the list-of-checks structure only: no aggregate "all good" badge that can hide a failing invariant |
| `/console/attempts/:attemptId` | **No template, deliberately.** It is a document, not a dashboard; the reference is a printed exam paper |

**The failed searches were as useful as the successful ones.** There is no
"grading queue" template in the shadcn ecosystem worth citing — the nearest
neighbours are content-moderation queues, which are the same page under a
different noun. Citing a weak match would have been worse than pointing at the
dense-table reference §2 already mandated. And `/console/attempts/:attemptId`
gets an explicit *we looked and decided not to*, so nobody re-opens it in three
weeks.

Same licence caution as everywhere: these are references to read, not code to
vendor. `BIOME-AND-LOADING-SPEC.md` §2 is the standing reminder of what happens
when that check is skipped.

### F-33 · `pnpm db:demo` — the two-step restore is one command now

`pnpm verify` truncates the demo data (the API suite calls `resetAll()`), and
restoring it is **two** steps: `db/demo-seed.sql`, then `scripts/sync-content.mjs`.
Running only the first leaves the database with **4 objectives instead of 115**,
which does not read as an error — it reads as a map with almost no moons and a
handful of map specs failing for reasons that look like the map.

That cost **three separate diagnosis detours in one session**. `DESIGN-REVIEW-01`
documented step one and not step two, and F-19 wrote the lesson down; writing it
down was not enough, so it is a command:

    pnpm db:demo    # both halves, in order, with the counts printed

It prints profiles / stages / objectives / progress / flagged items, and exits
non-zero if the objective count comes back short. **That guard is unexercised** —
the happy path is verified, but making `sync-content.mjs` fail silently enough to
trip it is not worth simulating. It is a smoke alarm, not tested code.

Deliberately **not** part of `pnpm verify`: the truncation is the API suite's own
setup doing its job, and re-seeding inside verify would hide it.

### F-34 · Three environment failures that looked exactly like product bugs

A long session degraded the machine, and each failure mimicked a real defect
convincingly enough to be worth recording.

**1. The gate reported "must have exactly one h1, found 0" — on different routes
each run.** `/app`, then `/app/stage/00`, then `/gradebook`. All three have an
`h1` in source; the pages render a skeleton first and the heading only after
their data arrives, and the helper waited a fixed 700ms. **The intermittency was
the tell.** It waits for the heading now, so a page that genuinely never renders
one fails on the thing that is actually missing. A flaky gate is worse than no
gate: it teaches people to re-run until green.

**2. Twenty-one failures from a Windows fork exhaustion.** `bash: fork: retry:
Resource temporarily unavailable` — Docker, the API and the console had all been
killed. Nothing was wrong with the code. **Check the stack is alive before
believing a red run**, the same way a cold Vite server has to be warmed first
(F-19).

**3. Port 5173 was serving a DIFFERENT PROJECT.** After the crash, another dev
server (`EngiRent Hub`) had taken the port, and the gate was cheerfully testing
someone else's application — `curl` returned 200, so the port looked healthy.
Caught by the page title, not by any assertion.

Rather than kill another project's server, OCTA's web was started on **5183** and
the harness pointed at it with `OCTA_WEB_URL`. That then failed with **CORS**,
because the API's `CORS_ALLOWED_ORIGINS` is pinned to 5173/5174 — correct
behaviour, and worth knowing: **moving the web port needs the API restarted with
that origin allowed.**

**The lesson under all three:** a red suite is a claim about the world, and the
world includes the machine. `pnpm qa` cannot tell "your code is broken" from
"your stack is gone", so the first question on a surprising failure is whether
the thing under test is actually running — and actually the right thing.

### F-35 · "Nothing renders a biome" was wrong, and the captures prove what does

I reported that the biomes were built but nothing rendered one. **That was
wrong**, and it is exactly the failure §2c rule 3 names: a claim repeated from
the shape of the code rather than checked against it. `StageReader.tsx` imports
`BiomeScene` and renders `<BiomeScene name={biome} />` on every stage landing,
and has done throughout.

**What is actually true**, verified by capturing all seven:

| Biome | State | Evidence |
|---|---|---|
| `neutral` | **Renders.** 5 vendored Kenney layers, `LICENSE-kenney.txt` alongside | capture is **120 KB** |
| `volcanic` | **Renders procedurally** — the one named exception in §2 | **60 KB** |
| `jungle` `arctic` `ocean` `desert` `cave` | **Draw nothing**, correctly | five captures, **byte-identical at 63,584** |

Those five being byte-identical is the whole point rather than a defect. §2 was
revised to forbid a gradient stand-in **because a gradient looks finished**: an
un-sourced biome rendering as a tinted rectangle is indistinguishable from a
done one, and would be signed off as such. `design/specs/biomes.spec.ts` now
asserts they draw nothing — a strange thing to want, and the right thing.

It also asserts `neutral` *does* draw, which is what stops the first assertion
passing vacuously. Without it, "nothing renders" would be satisfied by a scene
component that was broken everywhere.

R2's "each biome variant screenshotted individually (not one representative)" is
closed — `design/biomes/` has all seven. What remains is vendoring the art for
five, which needs a scoped download permission per §1b: the packs are
licence-checked (`BIOME-AND-LOADING-SPEC.md` §2) but **cave's chosen pack is
marked do-not-use and needs replacing**, and desert's is CC0-verified.

### F-36 · Three biomes vendored, and two packs the spec named could not be used

Authorised to source the biome art. Two of the packs `BIOME-AND-LOADING-SPEC.md`
§2 names did not survive contact:

- **Desert's pack is gone.** *Desert Parallax Background* by styloo — recorded as
  "CC0 1.0, explicit" and "the cleanest-licensed of the six" — **now returns
  404**. A licence verified against a page that no longer exists cannot be
  re-verified by anyone, which is a stronger objection than the art being
  unavailable.
- **Jungle's pack requires credit.** edermunizz's terms are clear and perfectly
  usable, but it is the only pack of the six creating a **standing obligation**
  that has to survive every future edit of `CREDITS.md`.

Both are now composed from **Kenney Background Elements** — CC0, the same pack
`neutral` uses, and the one §2's own table already calls the "base layer for
several biomes". **Neither substitution lowered the standard:** CC0 is at least
as permissive as what either replaced, and the `License.txt` travels with the art
in every biome directory. Three biomes, **23 KB of art total**.

`arctic` and `ocean` remain unvendored: their approved packs need a browser
session rather than a fetch, which §1b predicted and a bare `curl` confirmed.
**`cave` still has no approved source** — Admurin's pack is do-not-use over the
unresolved CC-3.0-versus-itch conflict, and finding a replacement is its own
piece of work.

**The jungle had to be rebuilt, and the reason is arithmetic.** The first
composition used three sprites that are all ~130px wide and similarly round
(aspects 1.78–2.15), so at similar scales they tiled at nearly the same interval
and the band read as **wallpaper** — one identical tree stamped across it. That is
the exact failure `neutral.ts` already warned about, reproduced by picking
sprites without measuring them. Fixed by making the **rendered tile widths**
differ — 39 / 74 / 129px, no two close, so the layers drift in and out of phase.
Recorded in §2a as a rule: measure the sprites before choosing scales.

**The spec caught its own staleness.** Adding jungle art made
`design/specs/biomes.spec.ts` fail — it still listed jungle as "must draw
nothing". That is the test doing its job, and the reason the vendored-biomes
assertion now checks **each** vendored biome rather than one representative: a
manifest with a typo'd path fails there and nowhere else.

### F-37 · Arctic and ocean vendored, and a pack that lied about being layers

Downloaded through a driven browser session — itch.io needs one, which §1b
predicted and a bare `curl` confirmed. Both licences were re-read on the live
page the day they were vendored rather than trusted from the earlier note, and
**neither pack ships a licence file**, so the terms are copied verbatim into
`public/biomes/<name>/LICENSE.txt` beside the art.

`arctic` is Admurin's and is **not CC0**: it must stay part of a project, never
be redistributed as a standalone asset, never be minted, never be training data.
Those are recorded in the manifest's `obligations` and in `CREDITS.md`. `ocean`
is ansimuz's and is the most permissive of the non-Kenney packs — no NFT clause,
no AI clause.

**ARCTIC RENDERED AS GREY MUSH, AND THE ALPHA CHANNEL EXPLAINED IT.** Six
numbered layers, stacked as a parallax set. Measured:

    0.png  100.0% opaque   the complete background — sky, mountains, pines
    1..4     5–52%         sparse overlays, as expected
    5.png  100.0% opaque   ANOTHER complete background

`5.png` drawn last covered the entire scene, so the band showed only layer 5.
It is an alternative background, not a foreground; it is not vendored at all
rather than shipped unused. **"Parallax" in a pack title does not promise
transparency** — measure the alpha before assuming a numbered set composites.

**`kind: "strip"` was added for this class of pack.** Pre-cut scene layers must
not receive the renderer's aerial perspective: the depth is painted in already,
and fading the back layer washes out a sky the artist balanced. Loose elements
(Kenney) need exactly the opposite, and now say which they are. `image-rendering:
pixelated` came with it — smoothing a 384×216 strip up to the band turns crisp
pixel art to mush, which is the one thing these packs are chosen for.

R2 moves to **20 of 21**. The remaining item is `cave`, which is a sourcing
problem rather than a build one.

### F-38 · Cave sourced from OpenGameArt, because itch could not prove a licence

The biome §2 could not source. Its instruction was *"Find a different pack. Not
Admurin's"* — that pack has the same art on DeviantArt under CC 3.0 while itch
states different terms, and the author declined to reconcile them.

**The obvious replacement failed identically.** ansimuz's *Warped Caves* is a
good pack by an author already vendored here, but its page has **no licence
statement from the author at all**. The CC-BY-3.0 that turns up in a search sits
in a **user comment**, by someone who is not the author, in a seven-year-old
thread. Same shape as the pack §2 rejected, so it was rejected too — and finding
that took reading the comment thread rather than trusting the search result.

**OpenGameArt records licence as structured metadata on the work.** That is the
difference that matters: it can be read, cited and re-verified later without
interpreting a conversation. *Seamless Parallax Cave Background* by
JonathanPalmerGD (from an original by PWL) is **CC0, confirmed twice** — the
entry's `License(s)` field and the pack's own bundled readme.

**Prefer OpenGameArt for anything licence-critical.** itch.io is better at
finding art and worse at proving you may use it.

A **CC-BY-SA 4.0** candidate with arguably better art was rejected on licence
rather than looks: ShareAlike adds a copyleft obligation chain, CC0 adds none,
and for a thesis deliverable the safer licence wins a close call.

**Downscaled 800 → 400px, 377 KB → 156 KB (59% smaller)**, which CC0 expressly
permits. The band draws at ~148px, so the source was five times oversized.

**Two rendering rules came out of it.** A square seamless source in a 4:1 band
tiles four times at `auto 100%` and loses every detail — it read as abstract
blobs until `scale` was raised to 2.2, so `.biome-strip` now honours
`--biome-scale` instead of hard-coding the height. And `smooth: true` was added
because this pack is **painted, not pixel art**: the pixelation that keeps the
pixel-art packs crisp is exactly what ruins this one.

**R2's biome work is complete.** The only remaining unticked box is the
superseded procedural-first item, which will never be ticked by design.

### F-39 · The biome becomes the page background, and D-2 returns for a fourth time

Ruled 2 Sep 2026: **the biome is the background of the whole page**, not a banner
strip. §1 always described a background — "the scenery around it", "behind its
edges" — and §4.2 says content "mounts **on top of it**". The 148px strip was a
weaker reading of the same words, and it is why arriving in a stage felt like
seeing a postcard of the destination rather than being in it.

**Checked before building, and most of what was asked is already specified:**

| Asked for | Status |
|---|---|
| Hyperdrive loading screen | **Already §4.1**, in detail, with three sources. Phase item exists |
| Loading screen changes per biome | **Already §4.2** — "the destination biome's backdrop, already in motion" |
| Travelling to the planet | **Already §4.2** — "backdrop dims and recedes → biome resolves in → content mounts" |
| Biome as page background | **Not documented.** Now §1b |
| Per-biome motif (falling leaves) | **Not documented.** Now §4.2b |
| Composition variety | **Not documented.** Now §2c |

**One conflict raised rather than silently implemented.** "The themes will change,
the colours will change" runs into §1's fairness line: the encounter theme is
per-STAGE and identical for everyone — both students get Pixel for the bit-toggle
exercise. §1b now states the boundary explicitly: the biome changes the page's
**ambient scenery**, never the encounter theme, the answer controls, the feedback
colours, or anything a student is graded through. Two students must be able to
compare screens during a Self-Test and see the same exercise.

**D-2 FOR THE FOURTH TIME.** A fixed full-viewport layer painted straight over
the nav, the Register Bar and the Depth Gauge. The solar backdrop hit this three
times and `.app-over-solar > *` was the fix each time — but that class is only
applied on hub routes, and content surfaces turn the solar backdrop *off*. So
the guard is now unconditional (`app-has-backdrop`), because the problem is
*there being a fixed layer at all*, not which one.

Then a second layer of the same bug: the shell guard was not enough, because the
biome is fixed **inside `main`, alongside the nav**. Equal z-index means DOM
order decides, and route content comes after the nav. The chrome is now
explicitly `z-index: 2` — it is the app's permanent furniture, and a student must
be able to leave a stage whatever is behind them.

**Fixing the stacking exposed the next thing:** the Register Bar's mono values
sat over pale clouds at whatever contrast the art happened to give. §1b's rule is
that a full-page background is held to the same computed AA as everything else,
and that the fix is **more opacity on the chrome, never less art behind it**. The
frame now carries its own ground on biome pages only.

**Element scales were retuned.** They were tuned for a 148px band and were ~6×
oversized against a 900px viewport — trees taller than the screen. Retuned per
§2c's structure rather than by dividing everything uniformly.

**Still to do from this ruling:** the composition variety itself (§2c — each
biome declaring its own structure, verified by the greyscale test), the per-biome
motifs (§4.2b), and wiring the warp into the stage transition so arriving reads
as travel. All four are now phase items in R3.4.

## Performance and QA numbers — measured, not assumed

| Measurement | Value | How |
|---|---|---|
| Playwright suite | **83 passed**, 0 failed | `pnpm qa`, warm dev server |
| Typecheck | clean, 4 workspaces | `pnpm typecheck` |
| Contrast gate | 1181 checks, all ≥ AA | `pnpm check:contrast` |
| Replay button hit area | 44 × 44 px | asserted in `solar-system.spec.ts` |
| Sidebar, desktop 1440×900 | `1072,0 368×900` (right rail) | measured in-browser |
| Sidebar, landscape 844×380 | `0,182 844×198` (bottom sheet) | measured in-browser |

**A cold Vite server fails four baseline tests, and it is not a regression.**
`before-baseline.spec.ts` sorts first alphabetically, so it absorbs the
dependency-optimize pass on a freshly started dev server: `networkidle` never
settles and the stage list is not mounted yet. Warm, the same file passes 8/8 in
5.6s. **Warm the server before believing a red run** — this cost a diagnosis
cycle, and it will do it again to whoever hits it next.

The launch sequence lives in `DESIGN-REVIEW-01.md` "How to reproduce this
setup". Two corrections to it, both found the hard way: the API health route is
**`/healthz`**, not `/health` (which 404s and will hang a naive wait loop
forever), and `playwright.config.ts` sets `webServer: undefined` **on purpose**
— the harness never starts the stack, so a dead dev server reports as
`ERR_CONNECTION_REFUSED` across every route rather than as one clear error.

## Decisions made this session worth remembering

- Package lives at `docs/redesign/`, phase files at `docs/redesign/phases/`.
  `FOLDER-STRUCTURE.md` never placed the phase files; it does now.
- Work on `main`. `KICKOFF_PROMPT.md`'s suggestion of a `redesign/*` branch is
  overridden by root `CLAUDE.md` and has been corrected in that file.
- `DESIGN-MANDATE-V2.md` §1B was stating the honesty rule against a formula
  §1.1 had already replaced. Reworded to separate **ordering (data, never
  adjusted)** from **spacing (a rendering constant)**.
- `DESIGN-MANDATE-V2.md` §2 introduced moons on Stage 00's "single objective".
  Stage 00 has none. Moved to Stage 01, with the underlying question — *should
  Stage 00 have objectives at all?* — flagged as the instructor's, not silently
  answered by inventing content (hard rule 5).
- `phases/R1` §R1.1 specified the superseded formula. Rewritten, with the new
  moon-aggregation and cosmetic-independence tests added, and gated on F-1..F-4.

## Next concrete step

**Start R3 — the page-template pass.** It is the largest phase by page count;
split it across sessions and update this file after each batch of routes.

1. Read `docs/redesign/TEMPLATE-LINKS.md` for the per-route template, and
   `CONSOLE-DATA-AND-TEMPLATES.md` for the console's real merges — the console
   section of TEMPLATE-LINKS is only the baseline.
2. Two items carried in from earlier phases, both named and neither forgotten:
   **render the biomes** (R2.2b — defined, checked, unpainted; they belong on
   `/app/stage/:id`), and **project DOM controls onto their planets** (R1.2 —
   `SKILL-TREE-3D.md` §4's overlay).
3. **F-8 belongs here**: 47 declarations referencing `--ink-dim` and `--rule`,
   which do not exist. It is a decision (alias vs. rewrite), not a cleanup.
4. Still outstanding from R0's rulings: `GAME-DESIGN.md` §11's mini-game table
   (rewrite for the 18-chapter curriculum, add the five approved games) and
   §12's Track D.
5. **F-7/D-3 is still the instructor's**, and R3 will render act names on more
   surfaces, not fewer.

## Superseded — R2's plan, kept for the record

**Start R2 — per-student seeded cosmetics.**

1. Build the cosmetic endpoint per the shape decided in R0.2:
   `services/api/src/routes/cosmetics.ts` -> `GET /api/v1/cosmetics`, from
   `profiles.student_id` alone. **Never** import from
   `services/api/src/engine/seed.ts`; `pnpm check:boundary` enforces it.
2. The whole-system rotation offset is the only cosmetic touching the map's
   geometry, and it must rotate **every** body by the same angle. A per-ring or
   per-planet offset would put a seeded value inside the semantic encoding.
   `layout-solar.spec.ts` already asserts `computeSolarLayout` takes no seed
   parameter at all -- keep it that way and apply the rotation at the renderer.
3. Housekeeping still outstanding from R0's rulings: `GAME-DESIGN.md` 11's
   mini-game table (rewrite for the 18-chapter curriculum, add the five
   approved games) and 12's Track D.
4. F-8 and F-9 are cheap and belong in R3's design pass.

### Superseded — R1's plan, kept for the record

1. `layout.ts` — tests first, per `phases/R1` §R1.1. Six unit tests are named
   there: INV-32 for planets, INV-32 extended to all 110 moons,
   moon-to-planet aggregation, the Stage 00 fallback by name, radius monotonic
   in level, and radius independent of the cosmetic seed. Plus F-3's
   largest-gap assertion.
2. Then §R1.2 — make 3D the default, keep degrade-in-place, and turn R0's
   recorded viewport × motion matrix into hard assertions.
3. **Before R1.4's performance check, note what is not installed:**
   `@react-three/drei`, `@react-three/postprocessing` and
   `react-force-graph-3d` are all absent, and `VISUAL-SYSTEM-3D.md` §5 records
   that drei was deliberately *dropped* to get the chunk under 250 KB (219.8 KB
   measured). Re-measure before assuming headroom.
4. Housekeeping the rulings created, cheapest first: `GAME-DESIGN.md` §11's
   table (rewrite for the 18-chapter curriculum, add the five minigames) and
   §12's Track D.

## R1 · what changed outside `apps/web`, and why

One change landed in `services/api`, and it is exactly the kind
`REDESIGN-CLAUDE.md` §1 says to flag rather than make quietly:

**`GET /api/v1/stages` now returns each stage's objectives** as `{id, level}`
pairs, no description text. The layout needs them — a planet's ring is the mean
of its own moons' levels, and without them every stage would silently take the
no-objectives fallback and the rendered map would disagree with its own tests.

Why this sits inside the boundary rather than crossing it:
- **No schema change.** No new table, column, function or policy.
- **Read-only and additive**, on an existing student-facing route.
- **RLS-neutral.** `ob_read` already lets an authenticated user read objectives
  of any **published** stage — deliberately not requiring *unlocked*, which is
  why `/api/v1/stages/:id` can already return a locked stage's objectives, and
  why `PAGE-SPECS.md` §2 can promise a preview of the next locked stage's
  objectives. The query filters to the same published set the route already
  filtered to, so it exposes nothing that was not already reachable.
- **Nothing to do with** grading, the question engine, or the exam seed.

250 API tests still pass and `pnpm check:boundary` is clean.

## Which parts of this were actually run, and what I am unsure about

**R1 — ran, and watched succeed or fail:** `pnpm verify` end to end (typecheck,
lint, palette, env, 1122 contrast checks, objectives, book map, **321 tests**
across web/console/api, 23 invariants, 0 failures); `pnpm qa` (**19/19**); the
four-way mutation check on `layout.ts`; `pnpm --filter @octa/web build` twice —
once with the change and once with it stashed — for a real before/after bundle
delta rather than a guess; a Chromium probe that located the 5px 380px overflow;
the API restarted and its new payload inspected directly (110 objectives across
19 stages, Stage 00 with zero, Stage 03 with 11 at level 1 — matching the layout
tests exactly).

**Looked at, not merely asserted:** five screenshots during R1, and the first
two were wrong in ways no test would have caught — the solar system drawn as a
full-viewport backdrop *underneath* the flat SVG map, two maps stacked with the
act list scrolling over both; then the page title pushed below the map; then the
camera cropping the outer rings. All three were found by opening the picture.


**Ran, and watched succeed or fail:** the package move; `pnpm add -Dw
@playwright/test` and `npx playwright install chromium`; `pnpm qa` (8/8, four
times, including one run that exposed my own broken motion emulation);
`node scripts/sync-content.mjs` (215 blocks, 110 objectives); `db/demo-seed.sql`;
`pnpm check:boundary` clean, then failing on a deliberately planted violation,
then clean again after removing it; direct SQL for every number in the ring
table; a standalone Chromium probe for the redirect matrix.

**Verified by reading real files, not documentation:** every claim in the
durable-facts and boundary-baseline sections.

**R2 — ran, and watched succeed or fail:** `pnpm verify` end to end (**333
tests** across web/console/api, 1174 contrast checks, 23 invariants, 0
failures); `pnpm qa` **22/22**; three mutation checks on the boundary tests,
one of which exposed my own assertion being useless; the contrast extension
caught five real failures before passing; two students captured side by side
and compared by eye.

**Looked at, not merely asserted — and this is where R2's real finding came
from:** the seeding rendered identically for both students THREE times while
every test stayed green. Wrong element for the attribute, then a memo caching
the colour before the fetch landed, then the actual cause — three.js cannot
parse OKLCH, so the 3D layer had never read a token at all. Only the screenshot
showed it, each time.

**Assumed, not verified — R2:**
- **The biomes are defined, checked, and rendered nowhere.** Seven token sets
  pass contrast; nothing paints them yet. Deferred to R3 on purpose, but it
  means "all seven biomes screenshotted individually" — a `REDESIGN-CLAUDE.md`
  §2 requirement — is **not** done, and cannot be until they render.
- **Only the default theme was looked at**, again. The contrast maths covers
  all three; the rendered canvas has only ever been seen on one.
- **The callsign is generated but displayed nowhere.** `SOLAR-SYSTEM-SPEC.md`
  §3 puts it on `/app/settings`, which R3 owns.
- Frame rate still not measured, carried from R1 and still the biggest gap.

**Assumed, not verified — R1:**
- ~~**Frame rate was never measured.**~~ **MEASURED** — see "Performance
  numbers" above. 60.1 / 59.4 / 47.4 fps at 1× / 4× / 6× CPU throttling, so the
  30fps floor holds with headroom. The remaining caveat is real though: CPU
  throttling is not GPU throttling, and a phone's fill rate is the likelier
  limit. Running it on an actual device is still undone.
- ~~**Draw calls were not counted**, only reasoned about.~~ **COUNTED: 32**, by
  wrapping the GL context. R1's unmeasured "low 30s" estimate was right. R4
  adds 110 moons and must re-measure.
- **Only one theme was looked at.** Every capture is the default theme. The
  contrast gate computes all three, but a canvas reading tokens at scene setup
  is not what that gate covers.
- The Stage 11 ring-reveal flag is threaded through and unit-covered at the data
  level, but **no student in the demo seed has mastered Stage 11**, so the
  revealed state has never been rendered.
- `design/specs/*.ts` and `playwright.config.ts` are still **not** in any
  workspace `tsconfig`, so `pnpm typecheck` does not cover them. I typechecked
  them by hand again. Worth wiring properly rather than remembering each time.
- Moons are **not rendered** — deliberate, R1's goal says skeleton first and R4
  is the moon phase. The layout computes and tests all 110; nothing draws them.

**Assumed, not verified — R0 (carried forward, and two are now settled):**
- ~~`pnpm verify` was not run.~~ **SETTLED in R1:** run end to end, green.
  The `tsconfig` coverage gap for `design/specs/*.ts` and
  `playwright.config.ts` is real and still open — see the R1 list above.
- ~~The ≤250 KB 3D-chunk budget was not re-measured.~~ **SETTLED in R1:**
  220.37 KB, measured, with the before/after taken by stashing the change and
  rebuilding. drei, postprocessing and react-force-graph-3d were **not**
  installed and were **not** added — R1.3 builds rings, path and star field from
  plain BufferGeometry, which is why the chunk barely moved. See F-9 for the
  initial-bundle figure, which had rotted.
- Nothing was captured on the console app; R0 only needed the student map.
- The captures came from an API and dev servers already running from a previous
  session. I confirmed they were healthy and serving the reseeded database, but
  I did not start them myself and do not know the exact env they booted with
  beyond the JWT secret, which I verified by minting a token that worked.

### F-40 · The seeded theme and accent hue never reach the browser

R2's last open item asked for two seeded students side by side, to confirm the
cosmetics differ while the map does not. Doing it confirmed the map — 19 nodes,
identical order, biomes cave vs desert — and found that **two thirds of the
cosmetics are not applied at all.**

`232129001` holds `accent_hue 37`, theme `blueprint`. `232129006` holds
`accent_hue 222`, theme `bare-metal`. Both render as `data-theme="bare-metal"`
with `--accent-hue: 250`.

`lib/session.ts:applyStoredTheme()` reads both values from **localStorage only**,
falling back to `bare-metal` / `250`. Nothing reads `profiles.theme` or
`profiles.accent_hue`, and `routes/cosmetics.ts` does not return them — it
returns `biomeIndex` alone, hashed from the seed. So the biome is seeded and
applied; the theme and hue are seeded, stored, and ignored.

**`apps/web/CLAUDE.md` states the opposite**, in its Accent section: "`profiles.accent_hue`
(0-360) is set as `--accent-hue` on `<html>`." It is not. That sentence has been
describing an intention as a fact.

**RESOLVED 7 Sep 2026**, on the instruction "yes they get them on first load".

`deriveCosmetics()` now returns `themeIndex` and `accentHue` from the same digest
that seeds the biome, and `applySeededLook()` applies each only where the student
has not chosen that part. Verified in the browser across four students: four
distinct looks, all three themes represented, **19 map nodes in identical order**
— the curriculum did not move.

**`profiles.accent_hue` was not the answer**, and finding that out mattered. Its
column default is **250** — the exact value the bug was producing — so it is a
preference column with a default, not a seeded field. Reading it would have
"fixed" F-40 by giving every real student 250 again. Only the demo fixtures set
it to varied values, which is what made it look seeded.

**Two follow-on bugs, both caught by testing rather than by looking:**

1. `applyStoredTheme()` **wrote** its defaults to `localStorage` on first load,
   so nothing downstream could tell "chose the default" from "never chose". The
   seed correctly declined to overwrite a choice that this function had invented
   microseconds earlier, and the fix looked broken. It now applies in memory and
   stores nothing; only Settings writes.
2. A single "has chosen anything" flag meant picking a theme also froze the
   accent at 250 — the same everyone-identical bug, in miniature. Theme and hue
   are now asked separately.

**And a vacuous test.** The first check that "an explicit choice beats the seed"
used a student whose seed was *already* blueprint and chose blueprint. It passed
and proved nothing. Re-run with `phosphor` against a `blueprint` seed.

The reason this sat undetected is worth keeping: the seeded values were correct
in the database the whole time, every contrast check passed, and the app looked
right. Nothing was broken enough to notice. It took rendering two students side
by side and comparing the DOM against the rows — which is exactly the check R2
wrote down and left for last.

### F-43 · The live Supabase project is a bare, stale schema — and the push script omitted 40% of the grade

**Measured read-only on 9 September 2026** against
`lqvkqdaqtkhxmnvodmyr.supabase.co` with `db-push-supabase.mjs --check`, which
applies nothing. The instructor's statement was "Supabase is live, everything is
live". It is live. It is also empty and behind.

| | Live | Local / schema.sql |
|---|---|---|
| public tables | **21** | **22** |
| stages | **18** | **19** |
| profiles · objectives · content_blocks | 0 · 0 · 0 | 25 · 115 · 217 |
| items · assessments | 0 · 0 | 183 · 2 |
| blueprints | 4 | 4 |
| auth.users | not counted — the query was blocked by a permission prompt and not worked around | — |

**The missing table is `submissions`.** Labs, the project and participation —
**40% of the grade**. `scripts/db-push-supabase.mjs`'s `FILES` list never
included `db/addendum-submissions.sql`.

**This is the same defect root `CLAUDE.md` already records against
`scripts/db-reset.mjs`.** It was found and fixed there on 7 Sep and **never fixed
here**, so the local stack has been correct and every deployment silently has
not. Nothing failed: the schema applied cleanly, the API started, and the gap is
visible only if you count tables — which is exactly why it survived a push.
Fixed, with the apply order now matching `db-reset.mjs`.

**18 stages, not 19.** The live schema predates the 18-chapter curriculum
rebuild (`5b548e8`, "the syllabus has eighteen chapters, not seventeen"). So the
live project was pushed from an older `schema.sql` and has not been touched
since.

**Nothing has been lost, because nothing was there.** 0 profiles, 0 attempts,
0 responses. That makes a `--reset` push safe *today* — but `--reset` runs
`drop schema public cascade`, it is irreversible and outward-facing, and this
reading is a snapshot. **It has not been run, and it needs the instructor's
explicit go-ahead rather than an inference from these counts.**

**What "live" therefore means right now:** the hosts exist and the database
answers. No student could use it — there are no stages 00–18, no objectives, no
content, no item bank, no assessments, and no account that can sign in.

### F-42 · The item bank was blocked by the engine, not by the authoring — and the scope now says so

**Instructor's ruling, 9 September 2026.** F-41 asked which blueprint the demo
should ship. The answer went further: build the complete item bank, sourced from
Stallings and verified, with new solvers written where the engine needed them.
A second ruling the same day scoped it: **stop at stage 08 and the Midterm.
Semi-final and Finals land in a later update.**

**What the audit found first, and why it changed the job.** Type P items do not
own their question. `resolve.ts` sets `stem: solver.stem(params)` and takes the
distractors and the rationale from the solver too, ignoring `items.stem_template`
entirely. So **the number of distinct P questions the system can express equals
the number of registered solvers**, and there were four: `cycle-time`,
`unit-convert`, `twos-complement`, `amat`. Every period blueprint demands 13 P
items from its own act. Acts 2 and 4 had no applicable solver at all. That is not
a hard authoring problem, it is an arithmetic impossibility, and no amount of
item writing would have moved it.

Those four solvers also carry `objectiveHint` values from the SUPERSEDED course
(`07.3`, `07.2`, `09.2`, `16.3`) and a comment reading "Stage 07 is the drill
week". That is why the only bank that ever existed was 22 stage-07 items.

**Written, with the engine boundary crossed deliberately and on the record.**
`REDESIGN-CLAUDE.md` §1 puts `services/api/src/engine` outside the redesign
track. This is not redesign work -- it is the P3/P5 curriculum work F-41 was
blocking -- and it was authorised explicitly before any code was written.

- **`solver-core.ts`** -- shared types plus `round`, `log2`, `bytes`, so the act
  banks and the registry do not import each other.
- **`solvers-act1.ts` (16)**, `solvers-act2.ts` (14), `solvers-act3.ts` (13),
  `solvers-act4.ts` (13). **56 new solvers, 60 in the registry.**
- Added to **REGISTRY_1_0_0, not a new engine version**. Adding a ref is safe:
  a stored seed only ever names a ref that already existed, so no paper already
  sat can change. The original four are untouched.
- **`scope.ts`** -- the examinable-scope flag. A constant, not an env var:
  exam scope decides what a real class is graded on, and an env var makes it
  flippable with no review, no diff and no test run.

**Four defects the tests caught that reading the code did not.**

1. `programmed-io-cost` could draw 4096 bytes at 5 us against a 10 ms window and
   ask for **163.84% of the processor** -- an impossible answer on a graded paper.
2. `instruction-address-bits` could draw a 16-bit instruction with a 4-bit opcode
   and three 4-bit register fields, leaving an address field of **zero bits**.
3. The registry test asserted "exactly the four P3 solvers" and failed on the
   first bank. It was protecting the wrong rule; it now asserts that 1.0.0 never
   LOSES or renames a solver, which is the rule that actually matters.
4. `scope.spec.ts` passed alone and failed inside the suite, because `resetAll()`
   truncates `blueprints` and `helpers/bank.ts` substitutes fixtures. It now
   reads the canonical exams from `db/schema.sql` and asks the database only the
   question that belongs to it. Same order-dependence that makes `pnpm qa`
   unreliable -- see the note in `PROGRESS.md`.

**Measured after the work:** API suite **350 passed, 1 skipped** (was 266),
21 files. Typecheck clean. Acts 3 and 4 solvers are written, tested and
registered but **out of examinable scope** -- inert until an item references
them, and `scope.spec.ts` fails if the flag is widened without the bank.

**Still owed:** the item rows themselves (S and G for stages 01-08, plus one P
row per in-scope solver), a seed that survives `pnpm db:reset`, an assessment for
Prelim and Midterm, a feasibility proof that both blueprints can actually be
filled, and the instructor's review pass.

**Approval goes through the console — instructor's ruling, 9 September 2026.**
Not a CLI promotion script. `/items` already had the review queue, status
filters, and a preview that resolves through the SAME `resolveItem()` a
student's paper goes through. Pointing a few hundred seeded items at it exposed
three things a two-item fixture never could:

1. **`review` offered exactly one decision: Approve and publish.** There was no
   way to reject. A reviewer who found a wrong key could publish it or leave it
   in the queue forever. The API had accepted a `reason` on every status change
   all along and the UI had never sent one. **Send back** now exists, the reason
   is required, and it lands in `audit_log`.
2. **Every decision closed the dialog.** Two hundred open/close cycles is not
   just slow, it pushes a reviewer toward clicking Approve to make the modal go
   away — the exact failure the review rule exists to prevent. Decisions now
   advance to the next item. One decision per item is untouched; only the
   navigation between them is gone.
3. **The self-approval tick was offered on items the reviewer did not write.**
   It says *"I wrote this item and have re-checked the answer key myself"*, and
   on a seeded item that is a false statement recorded in `audit_log`. It is now
   gated on authorship, which also matches what the server does — it only
   demands self-approval when `author_id` equals the reviewer.

**This decides how the bank must be seeded: `author_id = NULL`.** The demo
fixture has exactly ONE member of staff, so an item authored by the instructor
can only go live as a self-approval. An item with no author on record is
reviewed normally — which is the honest reading, because the instructor really
is the first person to check it. The dialog says so on the item.

**Verified:** `design/specs/console-item-review.spec.ts`, 3 cases, and the
advance is **mutation-tested** — reverting `advanceFrom` to close-on-decision
makes it fail. Capture in `design/item-review/`. `r3-gate` and the other console
specs re-run clean: 57 passed, 17 skipped.

**THE BANK ITSELF — 183 items, and the pipeline that seeds them.**

`content/items/NN.json` + `scripts/sync-items.mjs`, modelled on the existing
`content/stages/*.md` + `sync-content.mjs` pipeline: content lives in files, git
owns the history, the database is a projection. Wired into `db-demo.mjs` after
sync-content, because every item names an objective. **`pnpm db:reset && node
scripts/db-demo.mjs` now produces a real bank from a clean checkout**, which is
what F-41 actually asked for.

| Act | Stages | Objectives | Items | S | P | G |
|---|---|---|---|---|---|---|
| 1 Prelim | 01-04 | 32 | 96 | 74 | 16 | 6 |
| 2 Midterm | 05-08 | 27 | 87 | 67 | 14 | 6 |

Every item cites its source section, and the citations were checked against
`content/book-map.json`: all eight in-scope stages map 1:1 to book chapters
(stage 02 also drawing ch 2), so no item sends a student to the wrong chapter of
the 10th edition. Acts 3-4 would have needed the renumbering -- stage 09 is book
ch 10 -- which is another reason the scope flag sits where it does.

**Three rules `sync-items.mjs` will not break**, each with a reason:

1. **It never touches a `live` or `retired` item.** Hard rule 6, and
   `routes/items.ts` refuses to edit a live one at all. A re-run after the
   instructor approves something leaves it alone and reports it as locked.
   Silently rewriting an approved item would swap a reviewed answer key for an
   unreviewed one with nothing on screen to say so.
2. **Items land as `review` with `author_id = NULL`** -- the console ruling's
   consequence, so the instructor's approval is a genuine first review.
3. **It refuses anything past the scope flag**, which it READS from `scope.ts`
   rather than duplicating.

**`bank-feasibility.spec.ts` is the proof F-41 was really asking for.** A bank
that merely exists is not the fix; the failure being prevented is a student
meeting `BlueprintUnsatisfiable` instead of a paper. It reads the real files and
the real blueprints, fills Prelim and Midterm, asserts every constraint cell
lands EXACTLY across 60 student seeds, and asserts the two deferred exams
correctly still cannot be filled -- so the flag is checked for honesty in both
directions.

**It caught the one that counted.** Act 2's only `apply` items were its 14
parameterized ones. The Midterm demands `apply: 14` and `P: 13` simultaneously,
so exactly one apply had to come from a non-P item and there were none. Every
per-dimension count looked healthy and the bank could not have produced one
valid paper. Four apply-level S items fixed it, and **reverting them makes the
spec fail with that exact joint-cell error** -- watched failing, per the
project's own rule.

**Two defects found by running rather than reading:** the UPDATE in
`sync-items.mjs` never referenced `$1`, so Postgres refused it with "could not
determine data type of parameter $1"; and act 2 had ZERO `G` items against a
Midterm demand of five, which only the type tally exposed.

**Measured:** `pnpm verify` green -- **359 API** (was 266 before this work), 53
web, 24 console, contrast 1181, 25 invariants clean and 0 failures.
`check:items` is now part of `verify`.

**Still owed on F-41 -- corrected later the same day.** This paragraph said "no
`assessments` row exists" and was true for about an hour. `sync-assessments.mjs`
now seeds Prelim and Midterm at five attempts, every section, no dates, and the
missing `PATCH` route was built so a window can be set at all. What remains is
the console CONTROL for that window, and the instructor's review pass -- nothing
is `live` until they approve it.



### F-41 · Every multiple-choice answer was rejected, and the fixture cannot exercise the fix

**Two defects, found together, because the first one hid the second.**

#### The client sent a shape the server does not accept

`AnswerBody` in `routes/attempts.ts` accepts `{index}`, `{value}` or `{order}`.
`AttemptRunner` sent the bare option string. So **every multiple-choice answer
came back `400 "That answer could not be read."`** and nothing reached
`responses`.

It failed in the worst possible way: the answer is written to local state
*before* the request, so the option stayed selected, the paper looked answered,
and only the network tab disagreed. A student would have sat a whole check and
submitted eight unanswered questions.

Fixed: options send `{ index: k }`, free entry sends `{ value }`. Index rather
than text on purpose — `gradeResponse` will fall back to matching text against
the options, but two options rendering the same string would be ambiguous, and a
repeated distractor is a real thing.

Verified end to end: `200 {"recorded":true,...}`, the counter moves to
`1 / 8 answered`, and a row appears in `responses`.

#### And the test that should have caught it passed

`attempt-runner.spec.ts` asserted "answering does not fetch the key either" and
was green — **because the answer never saved**. Nothing about correctness came
back because nothing came back at all.

That test also stated the rule wrongly. Hard rule 1 is that the key is denied
*until submitted*, and `engine-repo.ts` sets
`revealVerdict = blueprintScope !== "final"` — so on a formative stage check the
student IS told the answer and rationale immediately, which is the pedagogy. The
test would have failed on any assessment where reveal is on, flagging intended
behaviour as a security breach. Rewritten to assert what actually matters: the
answer records, and the key never travels with the QUESTIONS.

#### The fixture cannot exercise any of it

`db/demo-seed.sql` has **no `insert into assessments` anywhere** — it deletes
them and re-points their section, nothing more. So a clean
`pnpm db:reset` + `node scripts/db-demo.mjs` leaves the database with **zero
assessments**: no student can sit anything, `/assessments` shows its empty
state, and the attempt runner is unreachable.

The rows this work was done against were session artefacts that the reset
removed. The suite now skips those tests with that reason rather than failing,
because the runner is not broken — there is nothing to run it on.

**CORRECTED 8 Sep 2026 — the three tools do different things, and this finding
first blamed the wrong one.** Measured:

| | `items` | `assessments` | `objectives` |
|---|---|---|---|
| after `pnpm db:reset` | **0** | **0** | 115 |
| after `pnpm verify` | 22 | 2 | **4** (truncated) |
| after `node scripts/db-demo.mjs` | 22 | 2 | 115 |

`db-demo` does **not** wipe items or assessments; `db:reset` does, because it
drops the database. And the 22 items and 2 assessments are **created by the API
test suite** — they are `pnpm verify`'s artefacts, not seed data.

That is the whole explanation for a session's worth of confusing state: `verify`
gives you a bank and empties the objectives, `db-demo` gives you objectives back
and leaves the bank alone, and `db:reset` takes everything. It also means the
only current way to get an item bank locally is **to run the test suite**, which
is a dependency nobody would guess and nothing documents.

**Not fixed here, and deliberately.** Seeding an assessment needs a blueprint
matched to the item bank, and the bank holds live items for **stage 07 only**
while the four seeded blueprints are all `final` scope covering chapters that
have none. Authoring a stage-scoped blueprint is question-engine data, and
guessing its cells would produce papers that fail feasibility at the moment
forty students press Start — the exact failure `/assessments` exists to prevent.

**This needs an instructor's call**, or a deliberate fixture task: which
blueprint should the demo data ship, and against which stage.

