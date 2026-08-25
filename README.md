# OCTA

Interactive learning platform for **CPE 412 — Computer Architecture and Organization**
(BS Computer Engineering, UCLM). Stage 00 orientation plus 17 graded stages across 14 weeks.

Motivation design based on the **Octalysis Framework** by Yu-kai Chou.

---

## What makes it different from a quiz app

1. **Every student gets a structurally unique paper** — 70 items on the final check, seeded per
   student, different numbers, different distractors, different order — but built to the same
   blueprint, so the papers are equivalent in difficulty.
2. **The teacher controls stage access** globally, per section, and per student, with an audit
   trail on every override.
3. **Progression is depth, not points.** The level system is the Computer Level Hierarchy (L6
   User → L0 Digital Logic) from Chapter 1 of the source material. There is no XP.
4. **The teacher can talk back to the system** — contextual flags, inline bad-question reports,
   and a periodic System Usability Scale survey.

---

## Read in this order

| # | File | Why |
|---|---|---|
| 1 | `START-HERE.md` | The map. Hard rules, repo layout, session discipline. |
| 2 | `START-PROMPT.md` | **The kickstart prompt.** Paste into Claude Code first. |
| 3 | `docs/MASTER-PLAN.md` | Product definition, curriculum, question engine, hosting |
| 4 | `docs/VERIFICATION.md` | Nine findings from the cross-check. All applied to the schema. |
| 5 | `db/schema.sql` | **The data model is the contract.** |
| 6 | `docs/LESSON-PLAN-AND-LEVELS.md` | Stage archetypes, week-by-week plan, the level system |
| 7 | `docs/PAGE-SPECS.md` | Every route, its contents, its states, its copy |
| 8 | `docs/GAME-LAYER.md` | The Bring-Up, all 8 Octalysis petals, per-student accent |
| 9 | `docs/AUDITS.md` | Invariants, test matrices, the fairness audit |
| 10 | `docs/LESSON-HANDLING.md` | How lessons flow source → DB → screen; the element/character system; research grounding |
| 11 | `docs/TOOLCHAIN-CORRECTION.md` | **Read before P5.** The course is TASM x86-16, not MARIE. Supersedes Stage 13-15 in the master plan. |
| 12 | `docs/STAGE-ENCOUNTERS.md` | What the student physically touches at each of the 18 nodes |
| 13 | `docs/DESIGN-MANDATE.md` | Every-control-earns-its-place rule, animation spec, avatars, per-page checklists |
| 14 | `docs/PROMPT-LIBRARY.md` | The four prompt templates + P5/P6/P9 design prompts |
| 15 | `docs/PHASES.md` | P0 → P10 with exit criteria |

Reference as needed: `docs/DESIGN-REFERENCES.md` (real templates + links),
`docs/CLAUDE-CODE-PRACTICES.md`, `docs/CLAUDE-CODE-PROMPTS.md` (per-phase prompts),
`docs/CLAUDE-CODE-FILES.md` (source of the CLAUDE.md/rules files, already split into place).

---

## Repo layout

```
octa/
├── START-HERE.md            read first
├── START-PROMPT.md          paste this into Claude Code
├── CLAUDE.md                root context, ≤200 lines, loaded every session
├── .claude/
│   ├── settings.json        permissions + hooks
│   ├── hooks/guard.mjs      blocks service-role leaks, hex colors, answer-key imports
│   ├── rules/               rls · engine · design · content (path-scoped)
│   └── commands/            (write /new-item first — you'll run it hundreds of times)
├── db/
│   ├── CLAUDE.md
│   ├── schema.sql               ← apply 1st
│   ├── addendum-feedback.sql    ← apply 2nd  (defines sus_score, needed by 3rd)
│   └── addendum-audit.sql       ← apply 3rd  (25 invariant checks + runner)
├── docs/
│   ├── MASTER-PLAN.md · LESSON-PLAN-AND-LEVELS.md · GAME-LAYER.md
│   ├── PAGE-SPECS.md · DESIGN-REFERENCES.md · PHASES.md
│   ├── AUDITS.md · VERIFICATION.md
│   ├── CLAUDE-CODE-PRACTICES.md · CLAUDE-CODE-PROMPTS.md · CLAUDE-CODE-FILES.md
│   └── source/
│       ├── day1-deck.md         instructor's Day 1 deck, extracted
│       └── chapter1-deck.md     instructor's Chapter 1 deck, extracted
├── packages/tokens/
│   ├── tokens.css           3 themes + register cast, 80 tokens, OKLCH
│   ├── accents.ts           the 12 accent presets
│   └── elements.svg         19 symbols: registers, node states, depth gauge, subsystems
├── apps/web/CLAUDE.md       student + public
├── apps/console/CLAUDE.md   teacher + admin
├── services/api/CLAUDE.md   Fastify on Render
└── content/stages/          authoring source of truth (empty — you write these)
```

---

## Database setup

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/addendum-feedback.sql
psql "$DATABASE_URL" -f db/addendum-audit.sql
```

**The order is load-bearing** — `inv_24` calls `sus_score()`, which the feedback addendum defines.

Then:

```sql
select * from run_invariants() where offending_count > 0;
```

On a fresh database this returns rows for the bank-health checks (there are no items yet). That's
expected. Every *structural* check should come back clean.

---

## Hard rules

1. The answer key never reaches the browser.
2. `SUPABASE_SERVICE_ROLE_KEY` never appears in a `VITE_*` variable.
3. RLS on for every table in `public`, and every RLS-enabled table has at least one policy.
4. Never decide a stage lock client-side.
5. Never invent course content.
6. Items are versioned, never edited in place.
7. `responses` and `attempt_items` are written only by the grading service.
8. Test authorization by testing **denial** — and watch it fail before you make it pass.

---

## Two decisions already made

**Name.** Ship as **OCTA** — it reads as *octal* (base-8, taught in Stage 09) and as *8 core
drives*. "Octalysis" is Yu-kai Chou's trademarked framework name; keep it as the thesis title and
credit it on `/about`.

**Render's free tier sleeps after ~15 minutes** and cold-starts in 30–60 seconds. A lecturer
opening Lecture Mode in front of 40 students cannot wait a minute. Everything runs on free tiers,
and **Render Free has no cron jobs** — the keep-alive is a `pg_cron` + `pg_net` GET to `/healthz`
from Supabase. See `docs/DELIVERY.md` §2.

---

## Session discipline

One phase per Claude Code session. `/clear` between phases. End every session with:

> **"Which parts of this did you actually run, and what are you unsure about?"**
