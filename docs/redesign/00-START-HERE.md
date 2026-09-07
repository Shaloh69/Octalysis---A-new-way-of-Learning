# 00-START-HERE.md — OCTA Solar System Redesign

Read this first. It exists because "start over" needs a hard boundary drawn
around it before anyone touches code — the boundary is what makes this safe to
build, not a bureaucratic step in front of it.

## What "start over" means here, and what it explicitly does not

You asked for this to be treated as if nothing was finished. Taken literally,
that would mean rebuilding the schema, RLS, the auth system, and the seeded
question engine — the parts `STATUS.md` shows are tested (291 tests, 38/38 RLS
denial tests passing on the live Supabase project), have already survived a
real production incident (the `drop schema public cascade` grants bug), and
are the actual thesis of the project (a fair, unique-per-student exam paper).
Rebuilding those would not be a redesign — it would be throwing away the one
part of this project that's hardest to get right and already correct.

**So "start over" is scoped to the presentation/game layer only:**

| Redone, from scratch | Left exactly as-is |
|---|---|
| The galaxy → **solar system** navigation shell (`SKILL-TREE-3D.md`, `GAME-DESIGN.md` §2-4) | Schema, RLS, all hard rules in `CLAUDE.md` §4 |
| The per-page template mapping (extends `DESIGN-REFERENCES.md`) | The seeded question engine — same paper-fairness guarantee, untouched |
| The game-facing half of `DESIGN-MANDATE.md` (§1B, §4) | The **8 locked encounter themes** (`GAME-DESIGN.md` §9) — different layer, dresses the in-stage activity, not navigation, already contrast-checked and pedagogically justified per stage |
| — | The universal per-page checklist (`DESIGN-MANDATE.md` §5.1) — six states, 380px, keyboard, contrast, tokens, mono, reduced-motion, the four control tests. These are correctness rules, not style, and stay in force over everything new too |
| — | `PHASES.md`'s P0–P10 structure. This work is additive hardening inside P9, using new phase IDs (R0–R5) so it never collides with or implies redoing P0–P8 |

If you actually want the schema/security/question-engine rebuilt too, say so
explicitly and separately — that is a different, much higher-risk
conversation, and it deserves its own scoping rather than being folded into a
visual redesign by implication.

## What's actually new in this package

1. **`SOLAR-SYSTEM-SPEC.md`** — the full redo of the skill-tree map. Orbit
   rings replace the old vertical axis as the Computer Level Hierarchy encoding
   (L0 innermost, closest to the hardware, out to L6). Planets are stages.
   **Moons are objectives/subtopics** — a planet isn't "cleared" until its
   moons are, which is the "more subtopics, complete before proceeding" part of
   what you asked for, built on data that already exists (`objectives`,
   already tracked per-stage in `/app/progress`). Per-student cosmetic
   variation (orbit phase, hue, planet texture variant) is seeded from
   `student_id` — the same principle `DESIGN-MANDATE.md` §4 already uses for
   avatars, extended rather than invented.
2. **`TEMPLATE-LINKS.md`** — every route in `PAGE-SPECS.md` gets a named
   template, the way you asked. Extends `DESIGN-REFERENCES.md` and
   `GAME-DESIGN.md` §4 rather than repeating them.
3. **`DESIGN-MANDATE-V2.md`** — the game-facing sections rewritten for the
   solar system; the universal checklist and control-test rules carried over
   verbatim, because those aren't stylistic opinions, they're the accessibility
   floor.
4. **`BIOME-AND-LOADING-SPEC.md`** — per-student "landing biomes" — now
   **seven**, each a pre-cut parallax pack with an individually-checked source
   (neutral, jungle, desert, arctic, ocean, cave, city) — five CC0, two with
   their terms recorded verbatim beside the art —
   plus two distinct loading screens: a warp-speed starfield for the hub, a
   biome-themed preview when heading toward a specific stage.
5. **`MINIGAME-PROPOSALS.md`** — **five** proposals now: a shooter, a
   platformer, a routing/tower-defense game, a prediction race, and a typing
   drill — each included only because a real verb-match to an actual
   objective was found for it, per `GAME-DESIGN.md` §8's research-backed rule
   against decorative "seductive detail" mechanics. Marked PROPOSED — same
   "not mine to fix" treatment as every other instructor-level call in this
   project.
6. **`CONSOLE-DATA-AND-TEMPLATES.md`** — what more the teacher console could
   surface (item-bank difficulty distribution, SUS trend, lock-override
   frequency — all built on data `STATUS.md`/`PAGE-SPECS.md` already say
   exists) and, per-page, **2-3 real templates merged** rather than one
   default — a heatmap interaction reference, a timeline/audit-trail
   component, a dense-table pattern, layered onto the existing shadcn-admin
   shell, never as a second dependency.
7. **`KICKOFF_PROMPT.md`** — one starting prompt, confirm-understanding-first,
   same discipline as the project's own `START-PROMPT.md`.
8. **Playwright and `docs/PROGRESS.md` from message one, every page, every
   iteration** — screenshot as you build, not just at the end and not just a
   sample, and a state file so a session can `/clear` without losing the
   thread.

## A file that is deliberately not part of this package's scope

**`ADAPTIVE-SCORING-PROPOSAL.md`** ships alongside these files but isn't one
of them, on purpose. It proposes letting item difficulty vary more
meaningfully across students, scored via an ability-estimate (Item Response
Theory-style) rather than raw correctness, so real difficulty variation
doesn't break grade comparability. It's a genuine, well-grounded idea — it's
also a change to the grading engine, which the boundary table above
explicitly excludes from this package. Read it, decide on it separately, and
if it moves forward, run it as its own effort — not in the same Claude Code
session as anything visual.

## The one thing that must never blur

**"Each student gets a unique game" and "each student gets a unique exam
paper" are two different mechanisms and must stay two different mechanisms.**

The exam paper's uniqueness (different numbers, different distractors, same
blueprint) is a **fairness** guarantee — it exists so no student has an easier
or harder paper, and it's enforced server-side, tested, and non-negotiable.

The solar system's uniqueness (which planet texture variant, what orbit phase
offset, what accent hue) is **cosmetic** — it exists so the app feels like
yours, the same reason the avatar is seeded from your ID. It must never touch
curriculum structure, unlock logic, objective sets, or assessment content. If
a future idea would make two students' *learning path* different — not just
its skin — stop and treat that as a curriculum decision, not a design one, and
it is explicitly out of scope for this package.

## Read order

1. This file
2. `SOLAR-SYSTEM-SPEC.md`
3. `BIOME-AND-LOADING-SPEC.md`
4. `TEMPLATE-LINKS.md`
5. `CONSOLE-DATA-AND-TEMPLATES.md`
6. `MINIGAME-PROPOSALS.md`
7. `DESIGN-MANDATE-V2.md`
8. `REDESIGN-CLAUDE.md`
9. `FOLDER-STRUCTURE.md`
10. `phases/R0` through `R5`
11. `KICKOFF_PROMPT.md` — paste this last, into a fresh Claude Code session
