# KICKOFF_PROMPT.md

Copy the block below into a fresh Claude Code session, from the repo root.

**The file move this section used to ask for is done — R0.4 landed it.** The
nine package docs are at `docs/redesign/`, the phase files at
`docs/redesign/phases/`, `docs/PROGRESS.md` is at the repo root's `docs/`
(not inside `redesign/` — it's the live tracker for the whole effort, not
package documentation), and `ADAPTIVE-SCORING-PROPOSAL.md` plus this file
stay at the repo root. Nothing needs copying before pasting the prompt.

**Branch: `main`.** This package's first draft suggested inventing a
`redesign/solar-system` branch. Root `CLAUDE.md` overrides that, and says why
in detail: `shaloh-build` existed for eighteen commits while `main` sat on the
P0 skeleton, and Vercel and Render each built the skeleton and failed
differently because every host defaults to `main`. Work on `main`, push to
`main`, commit small and often.

Same discipline as this project's own `START-PROMPT.md`: it reads and argues
before it writes, and it stops for your confirmation before touching code.

---

```
Read, in full, before writing any code:
  Root CLAUDE.md · START-HERE.md · docs/PAGE-SPECS.md
  docs/SKILL-TREE-3D.md · docs/GAME-DESIGN.md §1-9 · docs/DESIGN-MANDATE.md
  docs/redesign/00-START-HERE.md · docs/redesign/SOLAR-SYSTEM-SPEC.md
  docs/redesign/BIOME-AND-LOADING-SPEC.md · docs/redesign/TEMPLATE-LINKS.md
  docs/redesign/CONSOLE-DATA-AND-TEMPLATES.md · docs/redesign/MINIGAME-PROPOSALS.md
  docs/redesign/DESIGN-MANDATE-V2.md · docs/redesign/REDESIGN-CLAUDE.md
  docs/redesign/FOLDER-STRUCTURE.md
  docs/DESIGN-REVIEW-01.md — D-3 (act grouping) and D-4 (queue density)
  are both still OPEN and this redesign inherits them

This is a redesign of the galaxy skill-tree map into a solar system, plus a
full per-page template pass, plus per-student cosmetic variation, plus moons
representing subtopics. It is explicitly NOT a rebuild of the schema, RLS,
auth, or question engine — those are tested and stay exactly as they are.

Before doing anything else, reply with the following and then stop:

1. A one-paragraph summary of what's being redone and what is explicitly
   staying untouched — in your own words, not copied from the docs.
2. The single sentence that draws the line between "unique exam paper" and
   "unique solar system." If you can't state it precisely, re-read
   00-START-HERE.md's closing section and SOLAR-SYSTEM-SPEC.md §3 before
   answering again.
3. Confirm you understand why the curriculum graph has no forks (19 nodes,
   18 edges, one linear chain) and that moons do not change this — a moon is
   inside a planet, it does not add a second path through the syllabus.
4. Three things in SOLAR-SYSTEM-SPEC.md you'd design differently, and why.
   Be blunt. If you agree with all of it, you haven't actually checked it
   against SKILL-TREE-3D.md and GAME-DESIGN.md closely enough.
5. Confirm Playwright's current state in this repo (configured already, or
   not) and your plan for R0.3 either way.
6. Your proposed checklist for R0 only.

Then stop and wait for my go-ahead. Do not create files, do not run
commands, do not scaffold anything in this session.

Context you need up front:
- This redesign runs across many sessions — docs/PROGRESS.md is the
  continuity mechanism. Update it before any /clear or session end,
  and the next session resumes from it without needing to be re-briefed.
- One phase (R0-R5) per session is the target cadence, matching this
  project's own existing "/clear between phases" rule.
- I would rather you tell me something in SOLAR-SYSTEM-SPEC.md is a bad
  idea than build it silently. The instructor-facing "not mine to fix"
  pattern already used elsewhere in this project (SKILL-TREE-3D.md §10) is
  the right shape for anything you find that's a real product decision,
  not a design detail.
```

---

## After it replies

Same pattern as this project's own `START-PROMPT.md`: read its disagreements
carefully, resolve the ones that are real before any code gets written — a
doc fix costs a minute now, a rebuilt solar system costs a lot more later.

Then give it R0's checklist directly from `docs/redesign/phases/R0-scope-and-guardrails.md`.

One phase per session. `/clear` between phases. Every session ends with:

> **"Which parts of this did you actually run, and what are you unsure about?"**
