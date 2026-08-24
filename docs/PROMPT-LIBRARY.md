# PROMPT-LIBRARY.md
### Reusable prompt shapes, and the design-phase prompts

`docs/CLAUDE-CODE-PROMPTS.md` has the P0–P3 engine prompts. This file has the **templates** you
reuse for everything else, plus the UI prompts for P5, P6, and P9.

---

## 1. The four templates

Every prompt in this project is one of these four shapes. Using a shape you recognise is how you
notice when a prompt is missing its done-criteria.

### Template A — Build a vertical slice

```
Read <the 2-3 docs that govern this> before writing code.

Build <one thing>, end to end:
- <sub-deliverable>
- <sub-deliverable>

Constraints:
- <the rule most likely to be violated here>
- <the second one>

Done when:
- [ ] <checkable>
- [ ] <checkable>
- [ ] <a DENIAL test if this touches data>

Report at the end: what you actually ran, what you only wrote, what you're unsure about.
```

### Template B — Build a UI surface

```
Read docs/DESIGN-MANDATE.md §1 and §5, docs/PAGE-SPECS.md <section>, and
packages/tokens/README.md before writing any component.

Build <route(s)>.

Before you write JSX, list every control on the page and state which of the four
tests in DESIGN-MANDATE §1 each one passes. If a control fails a test, delete it
and tell me why.

Constraints:
- Colours from packages/tokens only. A literal hex is blocked by a hook.
- All six states from DESIGN-MANDATE §5.1.
- Every drag has a tap fallback. Every page is keyboard-completable.
- Motion only from the table in DESIGN-MANDATE §3.

Done when the universal checklist in §5.1 passes and you have screenshotted the
route in all three themes at 380px and 1280px.
```

### Template C — Verify something

```
Do not change any code in this session.

Check <the thing> against <the doc>. For each item, report PASS, FAIL, or
NOT-IMPLEMENTED with a file:line reference.

Where you find a FAIL, describe the fix but do not apply it.

End with the three things you are least confident about.
```

### Template D — Author content

```
Read .claude/rules/content.md first. You may not invent course content.

Author <what> from <exact source file and section>. Definitions and figures
verbatim; you may add heading structure and transitions only.

Where the source does not cover something, STOP and list what is missing.
Do not fill the gap.
```

---

## 2. Prompting rules that matter on this project

**Give it the schema before the feature.** The failure mode on a monorepo this size is Claude
Code inventing a table that half-overlaps one that exists. Reference `db/schema.sql` on any
data-touching session.

**One vertical slice per session, then `/clear`.** Performance degrades as context fills; watch
for the band starting around 40% use.

**State done-criteria in the prompt.** Without them you get code that compiles and doesn't work.

**Make it write the test first for anything with a correct answer.** The solvers and the seeded
generator are where a subtle bug becomes a grading incident across a whole cohort — and every
number will look plausible.

**Use Writer/Reviewer for the engine.** One session writes tests from the spec only; another
writes the implementation; a third reviews both with fresh context. A fresh context isn't biased
toward code it just wrote.

**Ask for the diff, not the file.** On a big codebase, "show me what changed and why" catches
drift that a wall of regenerated code hides.

**Forbid content invention explicitly, repeatedly.** An LLM asked to build a lecture app will
cheerfully write lecture content. Yours comes from `docs/source/` or it doesn't exist.

**End every session with:** *"Which parts of this did you actually run, and what are you unsure
about?"*

---

## 3. P5 — Encounter components

```
Read docs/STAGE-ENCOUNTERS.md and docs/DESIGN-MANDATE.md completely first.

Do NOT build eighteen bespoke interactions. STAGE-ENCOUNTERS.md §"Reuse"
identifies four components that cover nine stages. Build those four, parameterized
by content, in this order — stop after each and wait for my review:

1. <CardSort>    — stages 01, 06, and every matching/ordering item type
2. <BitArray>    — stages 02, 09, 14
3. <SliderRig>   — stages 04, 07, 16, 17
4. <NodeCanvas>  — stages 10, 12, and 13's data path view

For each, before writing JSX: list every control and state which of the four tests
in DESIGN-MANDATE §1 it passes.

Hard requirements on all four:
- Tap-to-select fallback for every drag. Test it with a mouse only, no dragging.
- Keyboard-completable: arrow keys to move focus, space to pick up, arrows to move,
  space to drop, escape to cancel. Follow the ARIA APG listbox and grid patterns.
- aria-live announces every state change.
- 380px wide.
- Content comes from props, never hardcoded. A component that knows about
  "two's complement" is wrong.

Done when: each component renders two different stages' content from the same code,
passes axe with zero violations in all three themes, and I can complete it without
touching a mouse.
```

---

## 4. P6 — Simulators

```
Read docs/TOOLCHAIN-CORRECTION.md FIRST. This course is TASM x86-16, not MARIE.
Then docs/STAGE-ENCOUNTERS.md and services/api/CLAUDE.md.

Three simulators. One at a time. Stop and wait for review after each.

1. FDE stepper (stage 13)
   Live 8086 registers in the Register Bar: AX BX CX DX SI DI SP BP IP FLAGS.
   Play / pause / step / reset. PREDICT-BEFORE-STEP: the student commits a guess
   for the next register value, then steps. The commit is the assessment — record
   it as a response.

2. x86-16 subset interpreter (stage 15) — services/api/src/engine/x86/
   ~35 instructions plus INT 21h services 01h 02h 09h 0Ah 4Ch, and the
   .MODEL/.STACK/.DATA/.CODE directives.
   MUST be deterministic: same program + same seeded inputs = same final state,
   always. Stage 15 items are graded by running it server-side and comparing
   register state, so a nondeterministic interpreter is a broken grader.
   Never bundle TASM.EXE or TLINK.EXE — proprietary. Validate against UASM.

3. Cache simulator (stage 16)
   Sliders: cache size, block size, associativity, miss penalty. Live hit ratio
   and AMAT against a sample address trace. The target is "beat 90%" — the tuning
   IS the lesson.

All three: break-it-on-purpose mode, keyboard operable, reduced-motion safe, 380px.

Done when a student can write, assemble, and run an x86-16 program that loops, and
assembly errors name the line and say what is wrong in plain language.
```

---

## 5. P9 — Themes, motion, avatars, accessibility

```
Read docs/DESIGN-MANDATE.md §2, §3, §4 and packages/tokens/README.md.

Four parts. Do them in order.

1. THEMES — wire packages/tokens/tokens.css. Three themes via data-theme on <html>.
   Accent from profiles.accent_hue as --accent-hue. Twelve presets from accents.ts.
   Add a CI check computing WCAG AA contrast for all 12 accents x 3 themes x
   {ink, surface, accent-fg}. That is INV-26. It must fail the build.

2. AVATARS — self-host DiceBear via the npm package, NOT the HTTP API. Style
   'identicon' (CC0), seeded with student_id, tinted with the accent hue. Offer
   'bottts' as an alternate in settings. Credit both on /about.
   Never render an avatar in Lecture Mode aggregates — those are anonymous.

3. MOTION — implement ONLY the table in DESIGN-MANDATE §3. Use motion.dev. Do not
   add GSAP or Lottie. The Bring-Up is the only celebration; there is no confetti
   anywhere. Incorrect answers have ZERO motion — a left border and a calm
   rationale, never red, never a shake. This is a deliberate motivation-design
   decision; do not "improve" it.

4. FIRST-RUNS — implement the introductions table in DESIGN-MANDATE §2. Each fires
   once, at first use, 30 seconds max, dismissible, recorded in a table so it never
   repeats. The Depth Gauge is NOT explained until stage 11 — that reveal is
   designed, do not add an earlier tooltip.

Done when: all three themes pass AA in CI; one full stage completed keyboard-only
start to finish; prefers-reduced-motion sets every duration to 0 and state still
changes; and /public/audio/CREDITS.md plus /about list every third-party asset with
its license.
```

---

## 6. The verification prompt — run at the end of every phase

```
Do not change any code in this session.

Verify the work from phase <N> against:
- docs/PHASES.md exit criteria for <N>
- docs/DESIGN-MANDATE.md §5.1 (if it touched UI)
- docs/AUDITS.md §3.1 denial matrix (if it touched data)

For each criterion: PASS, FAIL, or NOT-IMPLEMENTED with a file:line reference.

Then run: select * from run_invariants() where offending_count > 0;
and the Supabase Security Advisor. Report both verbatim.

End with the three things you are least confident about, and one thing you think
we got wrong at the design level.
```

That last clause matters. An agent that never disagrees at the design level has stopped reading
and started pattern-matching.
