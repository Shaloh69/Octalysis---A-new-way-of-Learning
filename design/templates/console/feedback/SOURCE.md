# Source of template.png

`TEMPLATE-LINKS.md`'s `/console/feedback` row names *"Two-tab layout,
standard; shadcn-admin's tabs pattern"*, following `PAGE-SPECS.md` §4.4's "My
feedback" and "All feedback" tabs. The session prompt asked for a
purpose-built feedback inbox or triage block as well. Six were captured and
every PNG kept here was opened before anything was built.

Method, all six: Playwright (Chromium), `networkidle` + 1.5s, full page,
2026-09-29, at **1440×1500 and 380×1900** (`NEXT-SESSION.md` §0k.7). The
shadcn.io previews were captured **after clicking "Skip tour"** (§0l.7); the
only chrome hidden is shadcn.io's floating theme switcher
(`div.fixed.z-[9999]`).

## Taken: `template.png`, `template-380.png` (Account Feedback History)

| | |
|---|---|
| URL | https://www.shadcn.io/view/account/feedback-history (block page: https://www.shadcn.io/blocks/account-feedback-history) |
| HTTP | 200, final URL unchanged |
| Rendered at 1440 | *Feedback History*, "Your submissions and team responses"; three **counts in words and numbers** (6 Submitted, 4 Responded, 2 Pending); a toolbar of **All types ▾ / All status ▾** with "**6 results**" on the right; one row per submission: a kind icon, the **title**, a **kind badge** (Bug Report, Feature, Improvement, Question), the **date**, the **status in a word**, and **View details** opening under the row; a footer of rates |
| At 380 | One column, intact: counts in three cells, the two selects, each row wrapping its title over two or three lines, nothing cut |
| Taken | **The frame.** Counts per status at the top (ours are the five triage states, each also the status filter), a **kind** and a **status** filter with the count of what matches, one row per report with its kind, date and status in words, and its detail **opening in place** (the rule `console-live-feedback.spec.ts` has held since P8: a report expands in the queue, one at a time) |
| Not taken | Colour as the status (ours is a word and a shape); the "67% response rate" footer (an aggregate nobody acts on); the icon as the only carrier of kind |

## Kept for the dense row: `template-admin-tasks.png`, `template-admin-tasks-380.png`

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/tasks |
| HTTP | 200, final URL unchanged |
| Rendered | *Tasks*, **Import / Create** on the right; a filter field and two faceted filters (**Status**, **Priority**); a dense table (~31px rows): Task id, a type badge and title, **Status and Priority each an icon and a word**, `⋯` |
| At 380 | The table scrolls sideways inside its card, cut at "Status"; the filter placeholder is cut. Assertion 1's defect |
| Taken | At 1440 **a table dense enough to scan** (the existing spec's bound: under 90px a row), with **Status and Severity each a shape and a word**, as Tasks does Status and Priority. The header's action on the right (ours is **Export CSV**) |
| Not taken | Row selection and numbered pagination (reports are grouped and read newest first, extended by Load older); the table at 380 |

## Kept for the SUS panel: `template-customer-feedback.png`, `template-customer-feedback-380.png`

| | |
|---|---|
| URL | https://www.shadcn.io/view/dashboard/customer-feedback (block page: https://www.shadcn.io/blocks/dashboard-customer-feedback) |
| HTTP | 200, final URL unchanged |
| Rendered | *Customer Feedback*, "Last 30 days"; **72 NPS Score · 4.2/5 CSAT · 1,847 Responses** in one row; a promoters/passives/detractors bar; four recent entries, each a name, an age, a quote and its source |
| At 380 | The three figures stay in one row; the bar and its legend wrap |
| Taken | **A score beside the number of responses it came from**, in one row. Ours: the SUS mean and its n, for students and staff separately (`PAGE-SPECS.md` §4.3) |
| Not taken | NPS (§4.3: "skip NPS"); the red/amber/green bar (colour as the meaning); relative ages |

## Rejected

| URL | HTTP | Rendered | Why not |
|---|---|---|---|
| https://shadcn-admin.netlify.app/ | 200 | *Dashboard* with **Overview / Analytics / Reports / Notifications** tabs over revenue cards, a bar chart and recent sales | **The named lead**, for its tabs. The instructor ruled **one queue** on 29 Sep 2026: "My feedback" is deferred until the console can send feedback at all (the §4.1 flag exists only in the student app), and teacher and admin are one role (D4), so there is no second tab to hold |
| https://www.shadcn.io/view/kanban/bug-reports | 200 | *Bug Reports, 9 bugs*: three columns (New, Triaging, Fixing), each card a truncated title and a mono id | Triage by moving cards between columns: the report's text is cut to one line, and a queue read by columns hides the reason a report is where it is. Five states would be five columns at 70rem |
| https://ui.shadcn.com/examples/mail | **404** | — | The Mail example moved |
| https://v3.shadcn.com/examples/mail | 200 | The Mail example: folders, a message list, and a **reading pane** with the full message and a reply box | A real triage inbox, and the strongest alternative. Not taken: its reading pane replaces the **expand-in-place, one at a time** rule this route's spec has held since P8, and `/submissions` already uses a pane where the reading is the work. Here the queue is scanned and worked down. At 380 it renders as a thumbnail |

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure.
