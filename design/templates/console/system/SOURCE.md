# Source of template.png

`TEMPLATE-LINKS.md`'s `/console/system` row names a *"status/health-page
pattern from a DevOps shadcn admin template"*: a list of named checks, each
pass/fail, with a timestamp and a way to see the detail of a failure, and
**never an aggregate "all good" badge that hides one failing invariant.** The
session prompt asked for a purpose-built status or health-check page as well.
Seven were captured and every PNG was opened before anything was built.

Method, all seven: Playwright (Chromium), `networkidle` + 1.5-2.5s, full page,
2026-09-28, at **1440×1500 and 380×1900** (shadcn.io centres a block in a
`min-h-screen` box, so a shorter viewport lets a tall block overflow upward and
lose its heading: `NEXT-SESSION.md` §0k.7). The only chrome hidden is
shadcn.io's floating theme switcher (`div.fixed.z-[9999]`).

**One trap, met and fixed:** shadcn.io's `/view/...` preview pages open a
four-step **guided tour** ("Switch views, Step 1 of 4") whose scrim greys the
whole block. Every first capture was the block under a dim overlay with a
popover over its top, and every one answered 200. Re-captured after clicking
**Skip tour**.

## Taken: `template.png`, `template-380.png` (Health Checks, one row open), and `template-health-checks*.png` (all closed)

| | |
|---|---|
| URL | https://www.shadcn.io/view/dashboard/health-checks (block page: https://www.shadcn.io/blocks/dashboard-health-checks) |
| HTTP | 200, final URL unchanged |
| Rendered at 1440 | A card: **Health Checks**, "7 monitored endpoints", then **counts per state** (● 5 ● 1 ● 1) and **Check all** on the right. One row per check: a status dot, the **name**, a **mono identifier** under it (`/api/auth/health`), then on the right the measurement (`42ms`, `timeout` in mono), the **state in a word** (*Healthy / Degraded / Down*), when it was checked, and a chevron. `template.png` has *Email Service* opened: a panel under the row, **Check configuration**, a two-column label/value grid with values in mono (`GET`, `200`, `10s`, `30s`) |
| At 380 | Names wrap one word per line beside the measurements, and every identifier is **cut with an ellipsis** (`/api/ema…`, `https://or…`). Assertion 1's defect, in the reference |
| Taken | **The whole frame.** A heading with the count of checks, counts **per state in words and numbers**, one action (**Run again** = *Check all*), and one row per check: state in a word, name, mono identifier, count of what it found, and a disclosure that opens the **detail under the row** as a label/value grid in mono. This is row 77's "list of named checks, each pass/fail, with a timestamp and a way to see the detail of a failure", nearly word for word |
| Not taken | Colour dots as the state (ours carry a word and a shape; row 77: *"no severity colours as the only signal"*); relative ages ("12 sec ago"), because a check is evidence and needs its time; per-row times (ours all run together, so the time is said once); latency as the headline measurement (an invariant's measure is how many rows break the rule). **At 380, nothing is truncated**: the state goes under the name, and an identifier wraps rather than being cut |

## Kept for "what needs attention first": `template-status-page.png`, `template-status-page-380.png`

| | |
|---|---|
| URL | https://www.shadcn.io/view/dashboard/status-page (block page: https://www.shadcn.io/blocks/dashboard-status-page) |
| HTTP | 200, final URL unchanged |
| Rendered | **System Status**, *Partial Disruption*, **99.94%** "30-day uptime" at the top right; six components, each with a dot, *Operational/Degraded* in a word, a percentage, and a 30-segment history bar; then **Active Incidents**, one expanded with dated updates |
| At 380 | One column, intact; the history bars shrink to slivers |
| Taken | Naming **what needs attention above the full list**, so a failure is the first thing read and the full list still shows every check. Ours is a line of links, one per check that is not passing, each opening that check's detail |
| Not taken | **The 99.94% and "Partial Disruption" verdict**: an aggregate over the checks, the exact thing row 77 forbids. The **history bars**: colour is their only signal (a red segment is a day, unlabelled). Our history is the nightly runs, listed in words: when, and which checks failed |

## Kept for the row's second line: `template-component-status-list.png`, `template-component-status-list-380.png`

| | |
|---|---|
| URL | https://www.shadcn-ui-blocks.com/blocks/application-pro/status-health/component-status-list |
| HTTP | 200, final URL unchanged |
| Rendered | *Component status*, "Internal view · 3 components affected", **Refresh** and **Publish to status page**; eight rows, each a dot, a **name with a one-line description under it** ("REST and GraphQL endpoints"), **"Updated Jun 13, 09:00"** as an absolute time, a status **Select** and a status badge |
| At 380 | Each row stacks: name, description, time, the Select, the badge. Nothing is cut |
| Taken | **A description line under each name**: ours says what the check protects, in words. The **absolute timestamp**. The 380 stack (name, then description, then state), which fits without truncating anything |
| Not taken | **The per-row Select and Publish**: an editable status. This page only reads. It runs checks and never changes data |

## Rejected

| URL | HTTP | Rendered | Why not |
|---|---|---|---|
| https://shadcnspace.com/admin-dashboard → https://dashboard.shadcnspace.com/ | 200 | *Analytics Admin Dashboard*: earnings, weekly sales, revenue charts, transactions, campaigns, sales by country | **The named lead has no status or health view at all** (its listing names none either). Nothing in it is a list of checks |
| https://adminlte.io/blog/shadcn-admin-dashboard-templates/ | not captured | a listing | A listing, not a page; it led nowhere the shadcn.io blocks above do not reach more directly |
| https://www.shadcn.io/view/dashboard/api-health | 200 | *API Health*: **Health Score 99.60 % avg uptime**, "6/8 healthy", a table of method, endpoint, latency, status code, uptime and time; red and amber row fills | **Its headline is an aggregate score**, which row 77 forbids, and rows are coloured by state. At 380 the table falls apart into a stack of unlabelled numbers |
| https://www.shadcn.io/view/tables/server-status | 200 | *Server Fleet*: CPU, memory and disk as coloured meters per server, "5 healthy · 3 issues" | Metrics, not checks: row 77's *"no sparklines nobody reads"*. An invariant is a correctness rule, not a gauge |

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure.
