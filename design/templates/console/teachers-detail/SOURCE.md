# Source of `/teachers/:id`' template

Plan: `docs/TEACHERS-AND-SUBJECTS-PLAN.md` §2 (approved 7 Oct 2026, night):
the admin's page for ONE teacher: their record, their classes, their AI token
totals by engine and by month (never their drafts), disable or re-enable.

| | |
|---|---|
| URL | https://ui.shadcn.com/view/new-york-v4/dashboard-01 (shadcn/ui's "dashboard-01" block, standalone) |
| Captured | 7 Oct 2026 (night), Playwright (Chromium), `networkidle` + 2.5 s |
| HTTP | 200, title "dashboard-01 - shadcn/ui" |
| `template.png` (1440) | Opened and looked at. A header bar with the page's name; **four stat cards** (a label, a large number, a small trend badge, a two-line note); an **area chart** with a 3-month / 30-day / 7-day toggle; **tabs over a table** (Outline, Past Performance, …) with "Customize Columns" and "Add Section" |
| `template-380.png` | Opened. The stat cards stack one per row at full width; nothing is cut off in the first screen |

**Rejected first:** `https://ui.shadcn.com/examples/dashboard` (200, but the
dashboard renders as a framed example below the site's marketing hero), and
`https://ui.shadcn.com/view/dashboard-01` (404).

**Taken:** the stat cards (ours: classes held, students in them, tokens this
month, last sign-in), one chart of the token totals by month with a range
toggle, the table of classes under it. **Not taken:** the trend badges'
growth framing (a token total is not a target to grow), "Customize Columns",
the drag handles, colours and type (ours). The chart follows the `dataviz`
rules and is drawn only from totals.
