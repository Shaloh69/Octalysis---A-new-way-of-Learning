# Source of template.png

Three documents name this page's reference, and they disagree:

| Document | Says |
|---|---|
| `CONSOLE-REVAMP.md` §3 | *"KPI cards + chart"* |
| `TEMPLATE-LINKS.md`, `/console/gradebook` | *"Standard data table + export — shadcn-admin data table"* |
| `PAGE-SPECS.md` §`/console/gradebook` | *"Per-stage mastery + final score. Weighting configuration. CSV / XLSX export shaped for the university's format."* |

All three were captured, with four table blocks that could carry a gradebook's
grid, and every PNG was opened before anything was built. They are not
alternatives: the dashboard gives the page's frame, a heatmap table gives the
grid, and the data table gives the toolbar.

Captured 2026-09-28 with Playwright (Chromium), `networkidle` + 2.5s, full page.
Every URL answered **200** with its final URL unchanged. 1440 at 1440x900; 380
at **380x1400**, not 900, because shadcn.io's previews centre their block
vertically and a 900-tall 380 capture cut the block's own foot off. Floating
site chrome (fixed elements under 400x200: shadcn.io's theme switcher, shadcn-admin's
nothing) was hidden before capture; no dialog, menu or listbox was open.

## Taken

### `template.png`, `template-380.png`: the page's frame

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/, shadcn-admin's **Dashboard** (Overview tab) |
| Rendered at 1440 | Title *Dashboard* with **Download** on the right; Overview / Analytics / Reports / Notifications tabs; a row of **four KPI cards** (label, icon, a large value, a one-line qualifier); then two cards side by side, a **bar chart** (*Overview*, twelve months, y-axis in dollars, no value labels) and *Recent Sales* (a list: avatar, name, email, amount) |
| At 380 | One column. Download stays beside the title; the KPI cards stack one per row; the chart keeps twelve bars but labels every other month; the list keeps its amounts, wrapping two of them under the name |
| Taken | **The frame**: title and the export on the right of it; a KPI row; a chart card beside a smaller card that explains it. The KPI cards' anatomy (a label, a value, a qualifier line that says what the value is *of*) |
| Not taken | The tabs (one view of one course; the table's own view toggle does what they would). The icon per KPI card. A chart with no value on it: a bar a teacher has to hover for is a number a teacher does not read, so ours prints each value as text at the bar's tip. The avatars |

### `template-table.png`, `template-table-380.png`: the grid

| | |
|---|---|
| URL | https://www.shadcn.io/preview/blocks/tables/tables-heatmap |
| Rendered at 1440 | *Weekly Traffic Pattern*: a sequential scale legend (0 → 65) top right; rows (time of day) × columns (weekday), **every value in mono**, a **Total column** on the right and a **Total row** at the foot, both bold, on a faintly different surface; one line under the table ("Hover over cells to see detailed information") |
| At 380 | The grid **runs off the card's right edge**: Sun is cut to "Su" and its values to one digit, with no visible scroll affordance. Assertion 1's defect, in the reference |
| Taken | The **shape of a gradebook**: rows of people, columns of marks, a **total column** (ours: *Final so far*) and a **total row** (ours: *Class average*), set apart from the body by weight and surface. Mono numbers, centred |
| Not taken | **The cell shading.** More-is-darker makes a low score the *faintest* cell on the page, and the low score is what a teacher opens a gradebook to find. The scale legend goes with it. "Hover to see" (nothing here hides in a hover). The 380 grid, which clips: ours is a list below 48rem of its own width |

### `template-tasks.png`: the named data table

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/tasks (already captured for `/submissions`; recaptured here for this folder) |
| Rendered at 1440 | *Tasks*, a description, Import / Create; a **filter field** and two faceted filter buttons; a dense table with a `⋯` per row; pagination |
| Taken | The toolbar: a filter field on the left, and the view choice as buttons beside it |
| Not taken | Row selection, the row menu (a gradebook row has no action but opening the student), pagination (21 rows) |

## Rejected

| URL | Rendered | Why not |
|---|---|---|
| https://www.shadcn.io/preview/blocks/tables/tables-pinned-columns (`rejected-pinned-columns.png`) | 200. *Inventory*, SKU pinned left and Actions pinned right | The right-hand pin **covers its own Available column at 1440**: "Availabl", and the values cut to "20", "9", "1". A sticky column is what a wide gradebook needs, and this block shows the failure it invites. We pin the student column only, and the page never needs to scroll sideways in its default view |
| https://www.shadcn.io/preview/blocks/tables/tables-subtotal (`rejected-subtotal.png`) | 200. *Q1 Expense Report*: rows grouped by category with a subtotal row each, a grand total, a big total top right | Group subtotals are the right idea for *components* of a grade, but a gradebook's groups are columns (the five components), not rows. At 380 it drops every numeric column without a word |
| https://www.shadcn.io/preview/blocks/tables/tables-footer | 200. *Invoices*, a total row at the foot with "Avg $144" | The same footer idea as the heatmap, with less: no total column |
| https://www.shadcn.io/preview/blocks/tables/tables-export | 200. *Sales Orders*, an Export button in the card header | Only an export button. Ours sits beside the title, as on the dashboard, because it exports the whole page, not one card |

## How this was searched

shadcn.io's `/blocks` lists one block per category; the `tables` family (≈100
blocks) was read from a block page's sibling links and filtered for *grade,
score, student, weight, total, footer, heatmap, pinned, export, subtotal*. No
block is a gradebook. `tables-course-curriculum` was the only education-named
one, and it is a syllabus list, not marks.

## The "before" screenshots

`before-desktop-1440.png` and `before-mobile-380.png` show the OLD page
reading the NEW CSV (this session changed the export first): its chart plots
`section`, `quizzes_30` and `grade_covered_pct` as though they were stages,
because it parsed a file it did not own. That is itself a reason for the
rebuild. Visible either way: the section `BSCPE - 4` broken across two lines in
every row, names wrapping to three lines, and the class average readable only
as the height of a bar.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure.
