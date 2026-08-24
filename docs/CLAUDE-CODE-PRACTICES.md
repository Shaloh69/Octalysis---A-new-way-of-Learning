# CLAUDE-CODE-PRACTICES.md
### Getting Claude Code to build OCTA correctly — functionality and design

Primary sources, read both:
- **Official docs:** https://code.claude.com/docs/en/best-practices
- **Anthropic engineering post:** https://www.anthropic.com/engineering/claude-code-best-practices
- Community field manual (Boris Cherny input, GitHub trending): https://github.com/shanraisshan/claude-code-best-practice
- Patterns repo: https://github.com/awattar/claude-code-best-practices

---

## 1. The one constraint everything else follows from

<cite index="55-1">Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills.</cite>

Everything below is a way of spending context well. On a project this size — a monorepo, a
17-stage curriculum, a psychometric engine, and an RLS model — you will lose more time to a
bloated context than to any missing feature.

Practical consequences for OCTA:

- **One vertical slice per session, then `/clear`.** "Build the question engine" works. "Build
  the app" produces a demo.
- **Keep `CLAUDE.md` under ~200 lines.** Everything longer moves into `.claude/rules/*.md` with
  `paths:` globs so it loads only when relevant. Your RLS rules shouldn't be burning context
  during a CSS task.
- **Reference files instead of pasting them,** except the schema, which is worth its tokens on
  any data-touching session.

---

## 2. Context architecture for this repo

`CLAUDE.md` <cite index="60-1">is pulled into context automatically at the start of a conversation, which makes it the right place for common bash commands, core files and utility functions, code style guidelines, testing instructions, and repository etiquette.</cite> <cite index="52-1">Claude also merges multiple CLAUDE.md files based on directory structure</cite> — so use that: global principles at the root, local constraints per package.

```
CLAUDE.md                          # ≤200 lines. The 8 hard rules, stack, conventions.
apps/web/CLAUDE.md                 # student UI: tokens, accent system, motion rules
apps/console/CLAUDE.md             # teacher UI: template provenance, table patterns
services/api/CLAUDE.md             # Fastify conventions, error shape, serializers
db/CLAUDE.md                       # RLS model, versioning rules, invariants

.claude/rules/
  rls.md          paths: ["db/**", "services/api/**"]
  engine.md       paths: ["services/api/src/engine/**"]
  design.md       paths: ["apps/**/*.tsx", "packages/tokens/**"]
  content.md      paths: ["content/**", "scripts/sync-content.ts"]
```

`.claude/rules/engine.md` is the most important file in the repo after the schema. It should say:
determinism is non-negotiable, `Math.random` is banned, every distractor comes from a real
misconception, and no function in this directory may return a correct answer to a caller that
serves students.

---

## 3. Enforce in `settings.json`, not in prose

A community finding worth taking seriously:
<cite index="57-1">use settings.json for harness-enforced behaviour (attribution, permissions, model) — don't put "NEVER add Co-Authored-By" in CLAUDE.md when the deterministic setting exists.</cite>

Same principle for your security rules: **anything you can enforce mechanically, don't write as a
request.** Prose in CLAUDE.md is a strong hint. A hook is a guarantee.

### Hooks worth writing on day one

<cite index="56-1">Hooks catch mistakes before they reach disk.</cite> Three `PreToolUse` hooks close your three worst failure modes:

| Hook | Blocks |
|---|---|
| `no-service-role-in-client` | Any write under `apps/**` containing `SERVICE_ROLE`, or any `.env*` line matching `VITE_.*SERVICE_ROLE` |
| `no-literal-hex` | Any write under `apps/**` containing a raw `#rrggbb` outside `packages/tokens/` — forces every colour through the token layer, which is what makes the per-student accent system hold |
| `no-answer-in-client` | Any write under `apps/**` that imports from `services/api/src/engine/solvers` or references `correct_value` |

Plus a `PostToolUse` hook running `scripts/scan-bundle.ts` after any build, so the answer-key leak
can never come back.

These three hooks are worth more than any amount of instruction, because <cite index="48-1">AI tools optimize for code that compiles, migrates and returns data — not for authorization correctness.</cite> Don't rely on asking nicely for the thing you can make impossible.

---

## 4. The Writer/Reviewer pattern — use it for the engine

<cite index="55-1">A fresh context improves code review since Claude won't be biased toward code it just wrote. Use a Writer/Reviewer pattern; you can do something similar with tests — have one Claude write tests, then another write code to pass them.</cite>

**For the question engine and the solvers, invert it deliberately:**

- **Session A** writes `test/solvers.spec.ts` from the *specification only* — the formulas in
  `MASTER-PLAN.md` §3 and the worked examples from the source decks (133 MHz → 7.52 ns). It never
  sees an implementation.
- **Session B** writes `solvers.ts` to pass those tests. It never sees the test authoring
  reasoning.
- **Session C** reviews both with fresh context and reports disagreements.

This is over-engineering for a CRUD endpoint. It is exactly right for the four functions that
determine whether a student's grade is correct. A solver bug that ships is a grading incident
affecting a whole cohort, and it will be invisible — the numbers will all look plausible.

Same pattern for the **RLS denial matrix**: one session writes the denial tests from the matrix in
`AUDITS.md` §3.1, another writes the policies.

---

## 5. Plan mode and the review gates

The converged pattern across every serious workflow methodology:
<cite index="59-1">research → plan → execute → review → ship, with the human as oversight at each gate</cite>, and <cite index="59-1">plan mode has Claude propose a plan and wait for approval before executing.</cite>

For OCTA, gate at these five points specifically. Everywhere else, let it run.

1. **Schema changes** — a migration is hard to walk back once real student attempts exist
2. **Any RLS policy** — see §3
3. **Solver math** — see §4
4. **Blueprint constraint logic** — the fairness argument depends on it
5. **Anything touching `attempts` or `responses`** — append-only means mistakes are permanent

<cite index="59-1">Watch for the performance degradation band starting around 40% context use.</cite> If a session is past that and still going, stop and `/clear` rather than pushing through.

---

## 6. Skills — write one for anything you'll do twice

<cite index="59-1">Write your first skill for any workflow you've repeated twice.</cite> Yours, in priority order:

| Skill | What it does |
|---|---|
| `/new-item` | Authors an item against a stage's objectives, in the house style, with distractors from real misconceptions, `status='draft'`. **You will run this hundreds of times** — 780 items is the real project. |
| `/new-stage` | Scaffolds `content/stages/NN.md`, its objectives, and its blueprint entry |
| `/audit` | Runs `run_invariants()`, the denial matrix, the bundle scan, and reports |
| `/a11y` | axe pass on changed routes, in all three themes, plus contrast check on the 12 accent presets |
| `/regrade` | The key-correction workflow from `AUDITS.md` §3.5, with the audit log entries |

`/new-item` is the one that pays for itself. Give it three hand-written seed items per stage as
style examples, and require every output to name which misconception each distractor encodes.

---

## 7. Design work specifically

Design is where Claude Code drifts hardest, because "looks fine" is easy to reach and "looks
intentional" isn't. Four rules:

**Give it the tokens, then forbid improvisation.** `packages/tokens` is the single source of
colour, type scale, spacing, and motion duration. The `no-literal-hex` hook (§3) makes this
mechanical rather than aspirational. Without it you get `bg-slate-800` scattered through the
codebase and your three themes stop working the day someone ships a hardcoded colour.

**Name the template's provenance in the local CLAUDE.md.** `apps/console/CLAUDE.md` should say:
*"This shell is adapted from satnaing/shadcn-admin. Some components are modified from upstream
shadcn for RTL — don't assume they match the shadcn docs. The palette has been replaced; do not
reintroduce slate/blue."*

**Screenshot review loop.** Have it build, screenshot the route, and critique its own output
against the spec before you look. A picture surfaces overflow, misalignment, and low contrast far
faster than reading JSX. Then look yourself — after staring at generating code, an agent tends to
see what it expected rather than what rendered.

**Specify the state, not just the happy path.** For every component: loading, empty, locked,
error, offline, and 380px. `PAGE-SPECS.md` §5 defines these once; point at it rather than
re-describing them per component.

---

## 8. Repository etiquette

<cite index="58-1">Commit early and often — before major changes, commit your work, so you have a safety net to revert. Review every line it produces. Invest in your CLAUDE.md and keep it updated. And don't be afraid to say "no": if a suggestion is unsuitable, reject it, explain why, and guide the agent toward the correct path.</cite>

Two more that matter here specifically:

- **The repo you're replacing has one commit.** For a capstone, the commit history *is* your
  evidence of process. Conventional commits, small and frequent, from day one.
- <cite index="58-1">If Claude suggests unwanted dependencies or patterns, add explicit prohibitions to your CLAUDE.md.</cite> Yours to pre-empt: no `htm` (you're on JSX now), no `localStorage` for anything gradeable, no client-side scoring, no new UI library beyond shadcn, no ORM on top of Supabase.

---

## 9. Parallelism, if you want it

<cite index="55-1">Multiple sessions enable quality-focused workflows beyond just parallelizing work</cite>, and <cite index="52-1">git worktrees make this practical by enabling parallel, isolated agent sessions on the same repo.</cite>

Realistic split for OCTA: one worktree on the engine (P3), one on the console (P4), one on content
authoring. They touch almost disjoint file sets, so merges stay clean. Don't parallelize inside a
phase — the engine and its tests must stay in lockstep.

---

## 10. The session-closing question

Every session, every phase, end with:

> **"Which parts of this did you actually run, and what are you unsure about?"**

<cite index="58-1">Claude is an assistant, not a replacement for human oversight.</cite> On a system that assigns grades to real students, the honest inventory of what was verified versus assumed is more valuable than the code it produced.
