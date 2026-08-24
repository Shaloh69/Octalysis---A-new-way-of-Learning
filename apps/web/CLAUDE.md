# apps/web — student + public

Vite + React 18 + TS + Tailwind v4 + shadcn/ui. Deploys to Vercel.
Route groups: `/` public (unauthenticated), `/app/*` student (role `student`).

## Never in this package
- Any import from `services/api/src/engine/**`
- The string `SERVICE_ROLE` anywhere
- A literal hex color (use `packages/tokens`) — a hook blocks it
- `localStorage` for anything that affects a grade
- Client-side scoring, client-side lock computation

## The three progression axes — do not invent a fourth
- **Depth** (7 levels, Depth Gauge on the left edge) — from stage completion
- **Competency** (21 cells at `/app/progress`) — from objective mastery
- **Hardware** (subsystems online at `/app/machine`) — from Bring-Up

There is no XP, no points, no currency. If a design needs a number, it is a mastery percentage.

## Stage archetypes drive the reader UI
Read `stages.archetype` and render the matching beat sequence:

```
A concept    BRIEF LEARN PROBE SORT  CHECK BRING-UP LOG
B compute    BRIEF LEARN PROBE DRILL CHECK BRING-UP LOG
C artifact   BRIEF LEARN TRACE REMIX CHECK BRING-UP LOG
D simulator  BRIEF LEARN LAB   BUILD BREAK CHECK BRING-UP LOG
```

Do not add a beat a stage's archetype doesn't declare. See docs/LESSON-PLAN-AND-LEVELS.md §1.

## Accent
`profiles.accent_hue` (0-360) is set as `--accent-hue` on `<html>`. All accent colors derive in
OKLCH with lightness and chroma fixed per theme, which is what keeps contrast constant across
hues. Never store or read a hex accent.

Accent MAY color: the student's own progress, their map node, Register Bar highlight, focus rings.
Accent MAY NOT color: correct/incorrect, danger, warning, success, locks, or anything in Lecture
Mode aggregates.

## Every component needs six states
loading (skeleton, not a spinner) · empty (an invitation, not an apology) · locked (name the
reason and the distance to unlocking) · error (what happened + how to fix) · offline (banner +
queued autosave) · 380px. See docs/PAGE-SPECS.md §5.

## Feedback tone
Incorrect answers: neutral low tick, calm rationale card, offer a re-roll. Never red, never a
buzzer, never a shake. These students are already anxious about a hard course.
