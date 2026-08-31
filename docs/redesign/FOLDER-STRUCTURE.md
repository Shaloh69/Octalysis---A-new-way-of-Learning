# FOLDER-STRUCTURE.md — Where Everything in This Redesign Lives

This redesign adds files to the **existing** OCTA monorepo layout — it does
not create a parallel app or package. New top-level additions are limited to
documentation and design-reference material; all code changes land inside
`apps/web` and `packages/tokens`, which already exist.

```
octa/                                    (existing repo root)
├── CLAUDE.md                            (existing, root rules — unchanged)
├── START-HERE.md, START-PROMPT.md       (existing — unchanged)
├── docs/
│   ├── ... (existing docs — unchanged: MASTER-PLAN.md, PAGE-SPECS.md,
│   │        DESIGN-REFERENCES.md, DESIGN-MANDATE.md, PHASES.md,
│   │        GAME-DESIGN.md, SKILL-TREE-3D.md, DESIGN-REVIEW-01.md, etc.)
│   ├── PROGRESS.md                      redesign state tracker, §3 below
│   ├── DESIGN-REVIEW-01.md              (existing — the first browser pass.
│   │                                     D-3 and D-4 are still OPEN and this
│   │                                     redesign inherits both)
│   └── redesign/                        this package's docs — MOVED HERE in
│       │                                  R0.4, from the repo root
│       ├── 00-START-HERE.md
│       ├── SOLAR-SYSTEM-SPEC.md
│       ├── BIOME-AND-LOADING-SPEC.md
│       ├── TEMPLATE-LINKS.md
│       ├── CONSOLE-DATA-AND-TEMPLATES.md
│       ├── MINIGAME-PROPOSALS.md
│       ├── DESIGN-MANDATE-V2.md
│       ├── REDESIGN-CLAUDE.md
│       ├── FOLDER-STRUCTURE.md          (this file)
│       └── phases/                      R0-R5, one per session. The original
│           ├── R0-scope-and-guardrails.md   version of this file never placed
│           ├── R1-solar-system-foundation.md  these — they travel with the
│           └── R2 … R5                        package, so they live here too
│
├── KICKOFF_PROMPT.md                    Stays at the repo root, not in
│                                         docs/redesign/ — it is pasted into a
│                                         fresh session, so it is found the same
│                                         way START-PROMPT.md already is
│
├── ADAPTIVE-SCORING-PROPOSAL.md         NEW, but deliberately NOT copied into
│                                         docs/redesign/ or referenced by
│                                         KICKOFF_PROMPT.md — it's grading-
│                                         engine work, out of scope for this
│                                         track. Keep it at repo root or
│                                         wherever makes it easy to find later,
│                                         not inside the redesign folder
│
├── design/                              NEW — screenshots and templates
│   ├── templates/                       COMMITTED. One reference screenshot
│   │                                     per route, per TEMPLATE-LINKS.md.
│   │                                     Naming: <route-slug>.png, e.g.
│   │                                     app-solar-system.png, console-locks.png
│   ├── baselines/                       COMMITTED. Playwright's own
│   │                                     snapshotDir — machine-managed,
│   │                                     don't hand-edit
│   ├── screenshots/                     GITIGNORED. Ad-hoc dev captures,
│   │                                     dated subfolders: YYYY-MM-DD/
│   └── qa-report/                       GITIGNORED. Playwright HTML reporter
│
├── apps/web/
│   ├── src/
│   │   ├── solar-system/                NEW — the 3D layer
│   │   │   ├── layout.ts                pure fn, stages[] -> Vec3, tested
│   │   │   ├── SolarSystem.tsx          the R3F canvas, presentation layer
│   │   │   ├── PlanetDialog.tsx
│   │   │   ├── MoonDetail.tsx
│   │   │   └── cosmetic-seed.ts         reads the existing student seed,
│   │   │                                 derives orbit-phase/texture-variant
│   │   ├── flat-map/                    NEW (or wherever /app/map's existing
│   │   │                                 code lives — extend, don't duplicate)
│   │   └── ... (existing app code — unchanged except where a route's
│   │            template pass touches it per TEMPLATE-LINKS.md)
│   ├── tests/
│   │   ├── solar-system-layout.spec.ts  NEW — unit tests for layout.ts
│   │   └── ... (existing + new per-route visual specs)
│   └── playwright.config.ts             NEW if not already present — check
│                                          first, see REDESIGN-CLAUDE.md §2
│
├── packages/tokens/
│   └── ... (existing — encounter themes, base themes, unchanged; solar
│            system ring tints reuse existing accent hue tokens, no new
│            token family needed per SOLAR-SYSTEM-SPEC.md §3)
│
└── db/
    └── (unchanged — see the scope boundary in REDESIGN-CLAUDE.md §1;
         if cosmetic-seed data genuinely needs a new column or table, that
         gets proposed explicitly in a session, not added silently)
```

## Rules

- [x] **Done in R0.4.** `docs/redesign/` holds only the files this package
      delivers — nine documents plus `phases/`, as of the current package
      contents. Don't let it become a second home
      for facts that already live in `docs/PAGE-SPECS.md` or
      `docs/DESIGN-MANDATE.md` — those stay where they are and this folder
      points back to them, per every file's own header in this package.
- [ ] `design/templates/` and `design/baselines/` are committed; `screenshots/`
      and `qa-report/` are gitignored — same split as the UniThrift redesign
      used, for the same reason (small permanent contract vs. large disposable
      output).
- [ ] Route-slug naming: lowercase, hyphenated, mirrors the URL —
      `/app` (solar system) → `app-solar-system`, `/console/students/:id` →
      `console-student-detail`.
- [ ] No new top-level app, no new package. If a solar-system component
      genuinely needs its own package boundary later (unlikely at 19 planets),
      that's a decision for a real architecture review, not something this
      redesign should reach for by default.
