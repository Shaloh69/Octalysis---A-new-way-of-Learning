# CONSOLE-DATA-AND-TEMPLATES.md — More Data, Merged Templates, Not One Default

`TEMPLATE-LINKS.md`'s console section currently points every route at one
default (`satnaing/shadcn-admin`) with per-row deviations. This file does two
things instead: proposes what *more* the console could surface (same
schema-driven spirit as the admin metrics work done for a different project
earlier in this conversation, adapted here), and names 2-3 real templates to
merge per page rather than one.

**Verification caveat, stated up front, same discipline as everywhere else in
this project:** I don't have OCTA's literal `db/schema.sql` in front of me —
only what `PAGE-SPECS.md`, `STATUS.md`, and `GAME-DESIGN.md` describe about
what the console already shows or is planned to show. Before implementing
anything below, confirm the actual column/table names against the real
schema file — the same schema-first verification discipline `REDESIGN-CLAUDE.md`
already requires everywhere else in this package. Nothing here should be
taken as asserted fact about exact field names.

---

## 1. What more the console could hold — grounded in what's already described, not invented

- **Item-bank health, beyond the review queue.** P7's `recompute_item_stats()`
  already computes p-value and point-biserial discrimination nightly
  (`STATUS.md`) — currently used only to flag items for review. Surface the
  *distribution*, not just the flagged outliers: a histogram of difficulty
  across the whole bank, per stage, so "is Stage 09's bank too easy overall"
  becomes answerable at a glance instead of only visible item-by-item.
- **SUS/feedback trend over time**, not just current status. `PAGE-SPECS.md`
  §4.4 already specs a "SUS score trend chart" on the admin feedback tab —
  worth calling out explicitly here since it's easy to build the triage inbox
  and skip the trend chart that makes the whole SUS effort worth doing.
- **Cohort mastery heatmap, already speced** (`PAGE-SPECS.md` §3,
  `/console/analytics`) — objectives × students. Worth being explicit that
  this is the single highest-value chart on the whole console and deserves
  real design attention, not a default table-with-conditional-formatting.
- **Variant drift**, already speced alongside it — is one number range of a
  parameterized item measurably harder than another. This is a genuinely
  unusual chart type (nobody else's admin template has "parameterized item
  fairness drift") — no template will show this natively, budget real design
  time for it rather than expecting a merge to solve it.
- **Time-on-item outliers**, already speced. Worth pairing with the
  difficulty histogram above — an item that's both slow *and* hard might be
  genuinely hard; an item that's slow but not hard might have confusing
  wording, which is a different problem with a different fix.
- **Lock-override frequency**, derivable from `audit_log` — not currently
  called out as its own view anywhere, but `/console/locks` already logs a
  reason on every override; a simple "how often is the default policy being
  overridden, and by whom" rollup turns that log into an actual signal about
  whether the default unlock policy is well-calibrated for this class.

## 2. Per-page template merges — real sources, not one default

### `/console` (overview)
- **Shell + KPI cards:** `satnaing/shadcn-admin` (existing default) —
  https://shadcn-admin.netlify.app
- **+ Chart layout and page structure:** TheFrontKit **SaaS Metrics Kit** —
  https://thefrontkit.com/docs/saas-metrics-kit/faq — a current (2026),
  production-oriented dashboard template built on the *same stack already
  locked in* (Next.js/Tailwind v4/shadcn/ui/Recharts) — zero new-dependency
  risk, and it already solves "KPI row + several chart types + cohort
  retention heatmap" as a coherent page, which is structurally almost exactly
  what `/console` needs (swap "retention" for "mastery," the shape is the same)
- **Take:** shadcn-admin's shell and nav, TheFrontKit's page-density and
  chart-arrangement patterns for the content area. Don't import TheFrontKit's
  actual components if it turns out to require its own token layer — take the
  *arrangement*, same "layout not identity" rule as every other template
  citation in this project.

### `/console/analytics` (the cohort heatmap, variant drift, completion funnel)
- **Shell:** shadcn-admin (default, unchanged)
- **+ Heatmap interaction reference:** nivo's HeatMap — https://nivo.rocks/heatmap/
  — study its interaction model (cell hover, color-scale legend, axis
  labeling) as a **reference only**. Do not add nivo as a dependency — this
  project already has a "one charting library" rule (Recharts, per
  `DESIGN-REFERENCES.md` §3), and a cohort heatmap is fundamentally a colored
  grid, which is cheaper and more consistent to hand-build with existing
  tokens (same reasoning `SKILL-TREE-3D.md` §5.2 already used to prefer plain
  SVG+buttons over a graph library for the map)
- **+ Funnel/chart types:** shadcn/ui Charts — https://ui.shadcn.com/charts
  — already the locked charting source, has funnel-adjacent chart types
  usable for the completion-funnel-per-stage requirement

### `/console/items` (question bank, stats inline, review queue)
- **Shell + data table:** shadcn-admin's data table pattern (default)
- **+ Dense-row reference:** shadcn-admin's own Tasks page,
  https://shadcn-admin.netlify.app/tasks — the densest table in the template
  already chosen for this console. **This fix has not been made yet:**
  `DESIGN-REVIEW-01.md` D-4 records the submissions queue as too sparse to
  mark from (~145px per card for four lines, and `is_late` not shown at all)
  and leaves it deliberately unfixed pending a density pass. An item bank
  with p-value / discrimination / exposure columns is the same shape, so the
  two should be solved together against the same reference rather than
  separately by taste

### `/console/students/:id` — "the page you'll use most" (`STATUS.md`)
- **Shell + profile layout:** shadcn-admin (default)
- **+ Expandable-row detail:** TanStack Table's expanding-rows example —
  https://tanstack.com/table/latest/docs/framework/react/examples/expanding
  — for the attempt-history table where expanding a row reveals the
  regenerated exact variant
- **+ A dedicated activity/history timeline for this student specifically:**
  shadcn.io's **Timeline Audit Trail** block —
  https://www.shadcn.io/blocks/timeline-audit-trail — built for exactly this
  shape (colored status dots, action/user/timestamp, compact and scannable),
  shadcn-native so it composes cleanly with the existing component system, no
  new dependency

### `/console/audit` (system-wide audit log)
- **Shell + filterable table:** shadcn-admin (default)
- **+ Timeline view as an alternate/secondary presentation:** ReUI's
  **Timeline** component set — https://reui.io/components/timeline — twelve
  variants including a "deployment log with collapsible entries" pattern,
  directly applicable to a lock-override or grade-adjustment log where the
  summary line matters more than the full detail until you expand it
- **+ Activity-log table pattern:** shadcn.io's **Activity Log Table** block
  — https://www.shadcn.io/blocks/tables-activity-log — for the default,
  denser, table-first view (most admins will want the table by default and
  the timeline as an alternate view, not the reverse — dense-first, same
  lesson as the submissions-queue fix)

### `/console/gradebook`
- **Shell + export-ready table:** shadcn-admin (default) — no merge needed
  here specifically, this is a genuinely standard data-export table and
  doesn't benefit from extra template sourcing the way the analytics-heavy
  pages do

---

## 3. What this deliberately does not do

- Does not add a second charting library, a second table library, or a
  second timeline library as an actual dependency — every "merge" above
  either reuses an already-locked tool (shadcn/ui, Recharts, TanStack Table)
  or treats an external example (nivo) as a **visual/interaction reference
  only**, same as how `DESIGN-REFERENCES.md` and `GAME-DESIGN.md` already
  treat every template citation in this project: take the layout, never the
  dependency, unless the dependency is already on the approved list.
- Does not propose new database columns or tables. Every new view above reads
  data `STATUS.md`/`PAGE-SPECS.md` already say exists (`recompute_item_stats()`
  output, `audit_log`, `stage_progress`) — if implementation reveals a genuine
  gap (a metric that needs a column that doesn't exist), that's a schema
  proposal to make explicitly, in its own session, not something to add
  silently while building a dashboard.
