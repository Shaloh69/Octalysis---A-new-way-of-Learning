# CLAUDE-CODE-FILES.md
### Every file Claude Code reads, ready to split into the repo

Each section below is one file. Create them at the path in the heading. The root `CLAUDE.md` is a
separate document.

**Why split like this:** <cite index="55-1">performance degrades as the context window fills</cite>, so the root file stays under 200 lines and everything else loads only when its `paths:` glob matches. Your RLS rules should not be burning context during a CSS task.

---

## `apps/web/CLAUDE.md`

```markdown
# apps/web — student + public

Vite + React 18 + TS + Tailwind v4 + shadcn/ui. Deploys to Vercel. Route groups:
`/` public (unauthenticated), `/app/*` student (role `student`).

## Never in this package
- Any import from `services/api/src/engine/**`
- The string `SERVICE_ROLE` anywhere
- A literal hex color (use `packages/tokens`) — a hook blocks it
- `localStorage` for anything that affects a grade
- Client-side scoring, client-side lock computation

## The three progression axes — do not invent a fourth
- Depth (7 levels, Depth Gauge, left edge) — from stage completion
- Competency (21 cells, /app/progress) — from objective mastery
- Hardware (subsystems online, /app/machine) — from Bring-Up
There is no XP, no points, no currency. If a design needs a number, it is a mastery percentage.

## Stage archetypes drive the reader UI
Read `stages.archetype` and render the matching beat sequence:
A concept   BRIEF LEARN PROBE SORT  CHECK BRING-UP LOG
B compute   BRIEF LEARN PROBE DRILL CHECK BRING-UP LOG
C artifact  BRIEF LEARN TRACE REMIX CHECK BRING-UP LOG
D simulator BRIEF LEARN LAB   BUILD BREAK CHECK BRING-UP LOG
Do not add a beat a stage's archetype doesn't declare.

## Accent
`profiles.accent_hue` (0-360) is set as `--accent-hue` on <html>. All accent colors derive
in OKLCH with lightness and chroma fixed per theme. Never store or read a hex accent.
Accent may color: the student's own progress, their map node, Register Bar highlight, focus
rings. Accent may NOT color: correct/incorrect, danger, warning, success, locks, or anything
in Lecture Mode aggregates.

## Every component needs six states
loading (skeleton, not a spinner) · empty (an invitation, not an apology) · locked (name the
reason and the distance) · error (what happened + how to fix) · offline (banner + queued
autosave) · 380px. See docs/PAGE-SPECS.md §5.

## Feedback tone
Incorrect answers: neutral low tick, calm rationale card, offer a re-roll. Never red, never a
buzzer, never a shake. These students are already anxious about a hard course.
```

---

## `apps/console/CLAUDE.md`

```markdown
# apps/console — teacher + admin

## Provenance
The app shell is adapted from github.com/satnaing/shadcn-admin (Vite + React + TS + shadcn).
Some components are modified from upstream shadcn for RTL support — do NOT assume they match
the shadcn docs. The palette has been replaced with packages/tokens. Never reintroduce
slate/blue; a lint rule fails the build on `slate-` or `blue-` utility classes.

## Auth
Route guards read role from JWT `app_metadata`, never from `profiles.role`. A student who
edits their profiles row must still be blocked.

## Pages, in order of how much they'll be used
1. /console/students/:id — regenerate the exact variant a student saw from their stored seed
2. /console/locks — students x stages matrix, reason prompt on every toggle
3. /console/items — bank, stats inline, preview-instance with re-roll
4. /console/roster, /console/gradebook, /console/analytics, /console/live,
   /console/feedback, /console/audit, /console/content, /console/assessments

## Rules
- Every write that changes student-visible state writes to `audit_log` with actor and reason.
- Projector view (/console/live/present) shows NO names, ever. Aggregates only.
- Editing a live item creates version+1 and retires the old one. The confirm dialog must say
  that stats do not carry over, in those words.
- Tables: TanStack Table. Charts: Recharts. Do not add another table or chart library.
```

---

## `services/api/CLAUDE.md`

```markdown
# services/api — Fastify on Render

Owns everything a student must not be able to compute: paper generation, grading, lock
resolution, role assignment, roster claims.

## Serialization
There is exactly ONE serializer for student-facing item payloads, in src/serialize/student.ts.
Every student route uses it. Never strip `correct_value` ad hoc per endpoint — that is how a
leak gets shipped.

## Engine
src/engine/{seed,solvers,resolve,blueprint,grade}.ts
- seed: splitmix64. `Math.random` is banned in this directory.
- Determinism is a hard requirement: same seed + same engine_version = byte-identical paper.
- attempts.engine_version pins the solver registry version. Old versions are kept forever.
- Every distractor comes from a real student misconception, never a random number near the
  answer. Name the misconception in a comment.

## Errors
`{ error: { code, message } }`. Auth failures use ONE generic message for unknown-user and
wrong-password alike — no enumeration. Same for unknown vs already-claimed student IDs.

## Rate limits
/auth/resolve 5/min/IP. /attempts 10/min/user. Roster import: staff only, dry-run by default.

## Render specifics
Free tier sleeps after ~15 min; a cold start mid-lecture is the worst failure mode in this
system. /healthz must stay trivially cheap. A cron pings it during class hours.
```

---

## `db/CLAUDE.md`

```markdown
# db — Supabase Postgres

Apply in order: schema.sql -> addendum-feedback.sql -> addendum-audit.sql.
The order is load-bearing: inv_24 calls sus_score(), defined in the feedback addendum.

## Known corrections — apply these, they are in docs/VERIFICATION.md
- V-1 stages.gradeable; Stage 00 is false; blueprint sampling excludes it
- V-2 profiles role change is blocked by a TRIGGER, not by a self-referencing policy
      (a policy that selects from its own table recurses)
- V-3 items.family_id is the stable identity across versions; items.id is per-version;
      attempt_items references items.id only, with no item_version column
- V-7 content_blocks read policy must also check stages.published

## Invariants
Every structural rule that can be a constraint should be a constraint. run_invariants() is for
rules a constraint cannot express. Do not write a checker for something a unique index already
guarantees.

## Never
- Disable RLS "temporarily" to debug. Use the service role in a scratch branch instead.
- Add an UPDATE or DELETE path to `responses`. Corrections void an attempt; they never edit
  history.
- Add a client INSERT policy to `responses` or `attempt_items`.
- Drop an item row. Retire it.
```

---

## `.claude/rules/rls.md`

```markdown
---
paths: ["db/**", "services/api/**"]
---
# Authorization rules

Testing that the right user succeeds proves nothing. For every policy, write and RUN the test
that proves the wrong user is blocked, and watch it fail before you make it pass.

The denial matrix is docs/AUDITS.md §3.1. Bold cells are the ones that matter. The lock
truth table is §3.2 — test at the boundary second on unlock_at and lock_at, not a minute either
side.

Six denials that must always hold:
1. A student cannot SELECT from `items` at all
2. A student cannot read attempt_items.correct_value while status='in_progress'
3. The same student CAN after status='submitted'
4. A student cannot change their own profiles.role
5. A student cannot read content_blocks for a locked or unpublished stage
6. A student cannot read another student's attempts, responses, or progress

Anything enforceable by a constraint, trigger, or hook should be — not by a comment asking
nicely.
```

---

## `.claude/rules/engine.md`

```markdown
---
paths: ["services/api/src/engine/**", "services/api/test/engine*"]
---
# Question engine rules

This code decides real students' grades. A subtle bug here is invisible: every number will
look plausible.

1. Determinism is non-negotiable. `Math.random` is banned. Use the seeded PRNG, and consume the
   stream in a defined order so a seed reproduces a paper byte-for-byte.
2. Uniqueness without equivalence is unfair. Every paper must satisfy every blueprint constraint
   cell exactly. An unsatisfiable blueprint THROWS, naming the cell and the shortfall. It never
   silently under-fills.
3. Distractors encode real misconceptions — wrong unit scale, inverted ratio, off-by-one bit
   width. Never a random number near the answer. Name the misconception in a comment.
4. No function in this directory may return a correct answer to a caller that serves students.
5. Answer position must be uniformly distributed across papers. If the correct option lands at
   B 40% of the time, students find it by week 4.
6. Pin behavior to attempts.engine_version. Never change a solver in place; add a version.

Worked examples that must pass, taken from the instructor's own decks:
- cycle time: 133 MHz -> 7.52 ns
```

---

## `.claude/rules/design.md`

```markdown
---
paths: ["apps/**/*.tsx", "apps/**/*.css", "packages/tokens/**"]
---
# Design rules

Every color, type size, space, and duration comes from packages/tokens. A literal hex outside
that package is blocked by a hook. `slate-` and `blue-` utility classes fail the build.

Type roles are jobs, not decoration:
- Space Grotesk — display, used with restraint
- Inter — body
- JetBrains Mono — ALL numbers, register values, hex, machine code, assembly listings, spec
  sheets, and every value in a parameterized question. In this app, monospace means "this is
  what the machine sees." That consistency is the design.

The signature element is the Register Bar: a persistent top strip showing PC, IR, MAR, MBR, ACC
as live mono hex. Idle pulse in stages 00-11, live in 12-15, question index as PC during an
assessment. Spend boldness here; keep everything else quiet.

Motion: one orchestrated moment per stage (the Bring-Up, ~2s, once). Correct answers get a
120ms accent flash. No confetti per question — it is noise by week three.
prefers-reduced-motion disables all of it.

Accessibility floor: WCAG 2.2 AA on all three themes, verified by computation not by eye.
Every drag interaction has a tap-to-select fallback. aria-live on answer feedback. Visible
focus everywhere. 380px with no horizontal scroll.
```

---

## `.claude/rules/content.md`

```markdown
---
paths: ["content/**", "scripts/sync-content.ts", "docs/source/**"]
---
# Content rules

NEVER invent course content. This is the highest-risk failure mode of building this app with an
LLM: plausible-sounding lecture text that is subtly wrong, which the instructor finds in week 6.

Stage prose, definitions, and figures come from docs/source/day1-deck.md and
docs/source/chapter1-deck.md, verbatim. You may add heading structure, callouts, and transitions.
You may not paraphrase a definition.

Figures 1.1-1.4 from the Day 1 deck are kind='code' blocks with the original listings intact,
character for character.

Where a stage has no source material (09, 10, 14, 15, 16, and parts of 17), stop and say so.
The instructor authors it; you do not.

The content fidelity check in docs/AUDITS.md §3.6 diffs quoted spans against source. It runs in
CI. If it fails, you invented something.
```

---

## `.claude/settings.json`

```json
{
  "permissions": {
    "deny": [
      "Bash(supabase db reset --linked)",
      "Bash(rm -rf *)",
      "Read(./.env.local)",
      "Read(./.env.production)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node .claude/hooks/guard.mjs" }] }
    ],
    "PostToolUse": [
      { "matcher": "Bash(pnpm build*)", "hooks": [{ "type": "command", "command": "node scripts/scan-bundle.mjs" }] }
    ]
  }
}
```

---

## `.claude/hooks/guard.mjs`

Three blocks, all mechanical. <cite index="57-1">Use harness-enforced behavior for anything deterministic rather than writing the rule as prose in CLAUDE.md.</cite>

```js
// Blocks the three worst failure modes before they reach disk.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const path = input.tool_input?.file_path ?? "";
const body = input.tool_input?.content ?? input.tool_input?.new_string ?? "";

const deny = (reason) => {
  console.error(reason);
  process.exit(2);               // exit 2 blocks the tool call and shows the reason
};

const inClient = path.includes("/apps/");

if (inClient && /SERVICE_ROLE/.test(body))
  deny("Blocked: service role key referenced in a client package. Server-only.");

if (/VITE_[A-Z_]*SERVICE_ROLE/.test(body))
  deny("Blocked: VITE_ vars are inlined into the client bundle at build time.");

if (inClient && !path.includes("/packages/tokens/") && /#[0-9a-fA-F]{6}\b/.test(body))
  deny("Blocked: literal hex color. Use a token from packages/tokens — the per-student accent depends on it.");

if (inClient && /(engine\/solvers|correct_value)/.test(body))
  deny("Blocked: answer-key surface referenced in a client package.");

process.exit(0);
```

---

## `.claude/commands/` — slash commands worth writing first

| File | Command | Purpose |
|---|---|---|
| `new-item.md` | `/new-item <stage> <objective>` | Author an item in house style, distractors from named misconceptions, `status='draft'`. **You will run this hundreds of times.** |
| `new-stage.md` | `/new-stage <id>` | Scaffold `content/stages/NN.md`, objectives with level + competency tags, blueprint entry |
| `audit.md` | `/audit` | `run_invariants()` + denial matrix + bundle scan + report |
| `a11y.md` | `/a11y` | axe on changed routes × three themes, plus the 12 accent presets |
| `regrade.md` | `/regrade <item>` | Key-correction workflow with audit log entries |

`/new-item` pays for itself first. Give it three hand-written seed items per stage as style
examples, and require every output to name which misconception each distractor encodes.
