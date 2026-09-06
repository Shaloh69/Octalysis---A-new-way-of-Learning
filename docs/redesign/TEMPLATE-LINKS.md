# TEMPLATE-LINKS.md — Every Route, Its Own Template
### Extends `DESIGN-REFERENCES.md` and `GAME-DESIGN.md` §4. Where those already name a source for a page family, this file points back rather than re-citing — the goal is one owner per fact, not a second copy.

Rule inherited from `DESIGN-REFERENCES.md`'s own header: **take the layout,
leave the identity.** Every source below ships its own colours/fonts by
default — replace with `packages/tokens` before a page is considered built,
same as every existing template reference in this project.

---

## Public site — `apps/web`, unauthenticated

| Route | Template | Source | What to take |
|---|---|---|---|
| `/` | Cruip Simple Light, restructured | `DESIGN-REFERENCES.md` §2 | Section rhythm and responsive breakpoints only — the hero itself is custom (the live re-rollable item demo + course map), per `PAGE-SPECS.md` §1 and `DESIGN-MANDATE.md` §5.2. Do not template the hero |
| `/course` | shadcn Blocks — content/list layouts | https://ui.shadcn.com/blocks | A structured, filterable list of 19 stages — same data-table-adjacent pattern as the console's item bank, reused publicly |
| `/how-it-works` | Cruip Simple Light's "how it works" section pattern | `DESIGN-REFERENCES.md` §2 | Numbered-step layout; content is the fairness argument, not generic feature copy |
| `/for-teachers` | Notus React (landing + dashboard in one language) | `DESIGN-REFERENCES.md` §2 | Feature-with-screenshot blocks — this page needs real console screenshots, which is also why it can't be built before the console pages below are |
| `/accessibility` | shadcn Blocks — simple content page | https://ui.shadcn.com/blocks | Plain content page, no special layout needed — don't over-template this one |
| `/about` | shadcn Blocks — simple content page | https://ui.shadcn.com/blocks | Same as above |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | The POST boot sequence | `DESIGN-REFERENCES.md` §7, in full | Already the most fully-specified page in the whole project — do not template over it with a generic auth block, §7.2-7.4 are the spec |
| `/404`, `/500`, `/maintenance` | shadcn-admin's error page patterns | https://shadcn-admin.netlify.app (404/500 routes) | Keep these boring on purpose — an error page is not the place to spend the design mandate's one-moment-of-boldness budget |

---

## Student app — `apps/web/app/*`

| Route | Template | Source | What to take |
|---|---|---|---|
| `/app` (solar system) | See `SOLAR-SYSTEM-SPEC.md` §4 in full | — | Custom build, referenced sources listed there, not repeated here |
| `/app/map` (flat map) | beautiful-skill-tree + React Flow a11y patterns | `GAME-DESIGN.md` §4.2 | Unchanged from the existing citation — the flat map's *mechanism* doesn't change with the solar-system reframe, only its labels (ring/planet/moon language) |
| `/app/stage/:id` | shadcn Blocks — article/reader layout | https://ui.shadcn.com/blocks | Left content rail + right objectives sidebar is a standard docs-reader pattern; don't reinvent it, the content is what's bespoke |
| `/app/stage/:id/check` | Game UI Database — Dialogue/HUD category | `GAME-DESIGN.md` §4.3 | One-item-per-screen with a persistent status strip (Register Bar) is closer to a game HUD than a form wizard — pull from game UI references, not SaaS quiz-app patterns |
| `/app/stage/:id/results/:attemptId` | shadcn Blocks — stats/summary cards | https://ui.shadcn.com/blocks | Per-objective breakdown as a card grid, reusing the same card primitive as `/console/analytics` |
| `/app/final` | Custom — item palette pattern | Study: any exam-taking software's question-navigator sidebar (e.g. university LMS finals UIs) | No direct open-source template fits the "70-item palette + review-before-submit + one confirmation" shape closely enough to borrow layout from; build from `PAGE-SPECS.md`'s spec directly |
| `/app/lab`, `/app/lab/fde`, `/app/lab/asm`, `/app/lab/cache` | RPGUI / rpg-css panel chrome + Game UI Database | `GAME-DESIGN.md` §4.3 | Panel/frame chrome only — the actual simulators (stepper, interpreter, cache sliders) are bespoke and unrelated to any template |
| `/app/notebook` | shadcn Blocks — card gallery | https://ui.shadcn.com/blocks | Curated-content gallery pattern; PDF export is a backend concern, not a template one |
| `/app/mistakes` | Same list/table pattern as `/console/roster` | `DESIGN-REFERENCES.md` §1 | Reuse the TanStack Table density pattern already chosen for the console rather than inventing a third list style |
| `/app/progress` | shadcn/ui Charts + the 7×3 competency grid, custom | https://ui.shadcn.com/charts | Growth-curve chart from shadcn Charts; the 7×3 grid itself is bespoke (maps directly to the seven orbit rings in `SOLAR-SYSTEM-SPEC.md` §1.1 — consider a visual echo between this page and the map, same data, two views) |
| `/app/live` | Custom, tightly scoped | — | Locked-to-one-question view with an anonymous distribution chart (shadcn Charts) — small enough not to need a template |
| `/app/settings` | shadcn-admin's settings page | `DESIGN-REFERENCES.md` §1 | Direct reuse — settings pages don't need a game-specific design language, they're a utility surface |
| `/app/help` | shadcn Blocks — FAQ/content | https://ui.shadcn.com/blocks | Plain content |
| `/app/work` | shadcn.io **File Manager Table View** + **File Upload Bulk** | https://www.shadcn.io/blocks/file-upload-table-view · https://www.shadcn.io/blocks/file-upload-bulk | **Added 2 Sep 2026 — this route was built and had no row.** It carries labs, the project and participation: **40% of the grade**, and the largest single share of it. The table block gives the list its shape (sortable name/type/size/modified, row selection, bulk actions); the bulk-upload block gives per-file progress and status, which matters because a student submitting three lab files needs to know *which* one failed. Take the structure, not the chrome — deadlines and late state are ours, and a late submission must say so in words, never by colour alone |

---

## Teacher console — `apps/console`

All console pages default to **`satnaing/shadcn-admin`** per `DESIGN-REFERENCES.md`
§1 — that citation stands for every route below unless a row says otherwise.
**For a real multi-template merge per page (not just the one default) and
what more data each page could hold, see `CONSOLE-DATA-AND-TEMPLATES.md` —
this section only lists the baseline, that file has the actual depth.**

| Route | Deviation from the shadcn-admin default | Source |
|---|---|---|
| `/console` (overview) | Standard KPI-card-row dashboard pattern | shadcn-admin's own dashboard demo |
| `/console/roster` | Add: dry-run preview modal pattern | shadcn Blocks — confirmation/preview dialog | https://ui.shadcn.com/blocks |
| `/console/students/:id` | Add: expandable row → regenerated-variant detail, a nested-detail pattern | TanStack Table's expanding-rows example — https://tanstack.com/table/latest/docs/framework/react/examples/expanding |
| `/console/locks` | Add: grid-of-toggles-with-reason-prompt, not in shadcn-admin's stock pages | Build from `PAGE-SPECS.md`'s spec directly; closest structural reference is a permissions matrix — any admin-panel "roles × resources" grid pattern |
| `/console/content` | Standard CMS-style split editor/preview | Any markdown-editor-with-live-preview pattern (e.g. shadcn's own docs site editor patterns) |
| `/console/items` | Standard filterable data table + the "preview instance with re-roll" panel is bespoke | shadcn-admin data table; re-roll panel has no template, it's unique to this project |
| `/console/items/:id/edit` | Standard form + a mandatory confirm-dialog with fixed copy | shadcn Blocks — form + AlertDialog |
| `/console/assessments` | Standard create-from-template wizard | shadcn Blocks — multi-step form |
| `/console/analytics` | Add: cohort heatmap (objectives × students) | No direct shadcn/TanStack citation — this specific chart type is closest to a correlation-matrix heatmap. For dense-table references, use `DESIGN-REVIEW-01.md` D-4 — the submissions-queue density defect it records is unfixed and names the same problem shape (many rows, several numeric columns, must stay scannable); `CONSOLE-DATA-AND-TEMPLATES.md` §2 carries the actual sourcing |
| `/console/gradebook` | Standard data table + export | shadcn-admin data table |
| `/console/live`, `/console/live/present` | Custom — see `DESIGN-MANDATE-V2.md`, no names ever on `/present` | — |
| `/console/feedback` | Two-tab layout, standard | shadcn-admin's tabs pattern |
| `/console/audit` | Standard filterable log table | shadcn-admin data table |
| `/console/settings` | Standard settings page | shadcn-admin settings demo |
| `/console/submissions` | **Same dense-table reference as `/items` and `/audit`** — shadcn-admin's Tasks page | https://shadcn-admin.netlify.app/tasks | **Added 2 Sep 2026.** Searched for a purpose-built "grading queue" template and there is not one worth citing; the shapes that come closest are content-moderation queues, which are the same thing under a different name. That is fine, because `CONSOLE-DATA-AND-TEMPLATES.md` §2 already ruled these pages must be "solved together against the same reference rather than separately by taste". D-4 fixed this queue by that route (3,436px → 1,219px); `/audit` and `/items` followed it. **`is_late` must be a visible column, not an inferred one** — D-4's original defect was that it was not shown at all |
| `/console/attempts/:attemptId` | **No template, deliberately** | — | **Recorded 2 Sep 2026 as a reason, not an omission.** This is a read-only reconstruction of one exam paper, regenerated from `attempts.seed`. It is a DOCUMENT, not a dashboard: the right reference is a printed exam paper, and forcing a card/table admin pattern onto it would make it worse. Its layout requirements come from `PAGE-SPECS.md` and from what a marker needs — item order, the student's answer, the key, the rationale — and it is already built that way. The only borrowed pattern is the summary-card row at the top, shared with `/app/stage/:id/results/:attemptId` |
| `/console/system` | Status/health-page pattern from a DevOps shadcn admin template | https://shadcnspace.com/admin-dashboard · listings: https://adminlte.io/blog/shadcn-admin-dashboard-templates/ | **Added 2 Sep 2026.** The invariant results page is a status page in every respect that matters: a list of named checks, each pass/fail, with a timestamp and a way to see the detail of a failure. DevOps-oriented shadcn admin templates (Signal Dashboard and similar) ship exactly that, including uptime/incident views and a public status page. **Take the list-of-checks structure and nothing else** — no severity colours as the only signal, no sparklines nobody reads, and never an aggregate "all good" badge that hides one failing invariant. `INV-*` failures are correctness failures, not metrics |

---

---

## Loading screens and biomes — cross-cutting, not one route

Two loading states apply across the student app, not to one route — see
`BIOME-AND-LOADING-SPEC.md` for the full spec, real sources repeated here for
completeness of "every visual thing has a named source":

| Surface | Template | Source |
|---|---|---|
| Hub loading (warp speed) | Three.js Starfield Warp technique | https://fwdtools.com/ui-snippets/three-starfield-warp/ |
| Stage/moon loading (biome preview) | Kenney Background Elements + CC0 itch.io biome packs | `BIOME-AND-LOADING-SPEC.md` §2 |

**Proposed, not yet decided** — see `MINIGAME-PROPOSALS.md`:

| Surface | Template | Source |
|---|---|---|
| Stage 14 bonus (shooter) | `phaserjs/template-react-ts` + Phaser by Example's shoot-em-up chapter | https://github.com/phaserjs/template-react-ts |
| Post-Stage-11 bonus (platformer) | `phaserjs/template-react-ts` + Phaser's official "Making Your First Phaser Game" tutorial | https://docs.phaser.io/phaser/getting-started/making-your-first-phaser-game |

---

## The four rows added 2 September 2026, and how they were chosen

`R3-page-templates-and-redesign.md` named four built routes with no template row
and asked for "a template row or a record of why not". All four now have one,
and one of them is a *why not*.

**Searched, not guessed.** Every source above was found by searching for the
page's actual shape, and the searches are as informative where they failed:

- **A "grading queue" template does not exist** in the shadcn ecosystem in any
  form worth citing. The nearest neighbours are content-moderation queues —
  review a submission, filter by status, act in bulk — which is the same page
  wearing a different noun. Rather than cite a weak match, `/console/submissions`
  points at the dense-table reference the other two console tables already use,
  which is what §2 asked for in the first place.
- **`/console/attempts/:attemptId` gets no template on purpose.** It is a
  document. A template row naming an admin dashboard pattern would be worse than
  an honest blank, and "we looked and decided not to" is a finding worth keeping
  so nobody re-opens it in three weeks.
- **File-manager blocks fit `/app/work` well** and were not obvious in advance —
  the page reads as "assignments" but behaves as "files with deadlines".

**Licence caution, same as everywhere else.** These are references to read, not
code to vendor. Only what a licence explicitly permits gets copied, and
`BIOME-AND-LOADING-SPEC.md` §2 is the standing reminder of what happens when
that check is skipped — a sourced pack turned out to be do-not-use.

---

## What this table deliberately does not repeat

- Component-level sources (base components, icons, charts, tables, motion,
  audio) — those are in `DESIGN-REFERENCES.md` §3 and apply everywhere, no
  need to re-list per row
- Typography, theme tokens, the Register Bar, the animation table, the avatar
  system — all in `DESIGN-MANDATE.md` §3-4, unchanged by this redesign
- The 8 encounter themes and their per-stage mapping — `GAME-DESIGN.md` §9,
  locked, out of scope for this pass entirely
