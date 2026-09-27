# Source of template.png

`TEMPLATE-LINKS.md`'s `/console/audit` row names a *"standard filterable log
table, shadcn-admin data table"*, the same dense reference `/items` and
`/submissions` used. The session prompt asked for a purpose-built activity or
audit log as well. Four were captured and all eight PNGs were opened before
anything was built.

Method, all four: Playwright (Chromium), `networkidle` + 2.5s, full page,
2026-09-28. **One trap, met and fixed:** shadcn.io centres each block
vertically in a `min-h-screen` box, so at a 900px viewport anything taller
than the viewport overflows *upward*, above the document's top, where no
scroll reaches it. The first capture of the Audit Trail began mid-list with its
heading, its *Actions* filter and its *Last 7 days* range simply missing, and
the command still reported 200. Re-captured at 1440×1500 and 380×1900, which
holds the whole block. The only chrome hidden is shadcn.io's floating theme
switcher (`div.fixed.z-[9999]`); a first attempt that hid every small fixed
element also hid shadcn-admin's sidebar, so the rule was narrowed and the
Tasks page re-captured untouched.

## Taken: `template.png` (= `template-tasks.png`), `template-tasks-380.png`

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/tasks, the named lead |
| HTTP | 200, final URL unchanged |
| Viewport | 1440×900 and 380×900; nothing hidden |
| Rendered at 1440 | Sidebar, then *Tasks* with a one-line description and **Import / Create** on the right of the heading; a filter field and two faceted filters (Status, Priority) with *View* at the far right; a **dense table** (~49px rows): select box, Task id, a type badge + title, status and priority as icon + word, `⋯`; pagination at the foot |
| At 380 | The table **scrolls sideways inside its card**, cut at "Status", and the filter's placeholder is cut at "Filter by title or II". Assertion 1's defect, in the reference |
| Taken | The **frame**: a heading with its one action on the right (ours is **Export CSV**), a toolbar of one search field plus filters, a dense table whose rows sit under ~60px (the bound this route's spec has asserted since D-4) |
| Not taken | Row selection (nothing is done to an audit entry; there is nothing to select for), numbered pagination (a log is read newest first and extended backwards; page 7 of 40 means nothing), the table at 380 |

## Taken: `template-380.png` (= `template-activity-feed-380.png`), `template-activity-feed.png`

| | |
|---|---|
| URL | https://www.shadcn.io/preview/blocks/crud/crud-activity-feed |
| HTTP | 200, final URL unchanged |
| Rendered | *Activity Feed*, "Track changes across your workspace", two selects on the right (*All Types*, *All users*). Entries **grouped under day headings** (*Today*, *Yesterday*), each a **sentence**: "**Sarah Chen** updated **Premium Headphones**", a detail line under it ("Changed price from $399 to $349"), then the age. A footer of counts (*Today 23 · This week 156 · This month 847*) and **Load More** |
| At 380 | One column; the selects keep their size and the heading wraps to one word per line beside them |
| Taken | **The sentence** as the primary cell: who did what to whom, in words, instead of `lock.set` and a UUID. **Day headings** for the timeline view. **Load older** at the foot rather than pages, which is the paging the instructor approved. *All Types* / *All users* as the shape of our Action and Who filters |
| Not taken | Relative ages ("2 hours ago"): evidence needs the time, and "3 weeks ago" is a different day by next week. Avatars. The period counts footer (a count of this filter's matches is said once, above the list) |

## Kept for its toolbar: `template-audit-trail.png`, `template-audit-trail-380.png`

| | |
|---|---|
| URL | https://www.shadcn.io/preview/blocks/crud/crud-audit-log |
| HTTP | 200, final URL unchanged |
| Rendered | *Audit Trail*, "Track all system changes and actions", **Actions ▾** and **Last 7 days ▾** on the right. Each entry: initials, a coloured dot, **name**, a verb badge (*Created / Updated / Deleted / Exported*), the target type; a detail line; the date **with the time** ("Mar 16, 2024 at 2:34 PM") and an IP in mono. Footer: *Showing 10 of 10 entries* |
| At 380 | The heading and its description wrap one or two words per line beside the two buttons; each entry's name, badge and target wrap into three short columns |
| Taken | An **action filter** and a **date range** as the two toolbar controls a log needs first; the absolute date *and* time on every entry; *Showing N of M* |
| Not taken | Colour as the action's meaning (a dot is not a word, and red-for-Deleted would put the one colour we keep for failure on a normal act); a verb badge with the target beside it as a separate word, which the sentence already says |

## Kept for Export: `template-log-viewer.png`, `template-log-viewer-380.png`

| | |
|---|---|
| URL | https://www.shadcn.io/preview/blocks/crud/crud-log-viewer |
| HTTP | 200, final URL unchanged |
| Rendered | *Application Logs*, "8 entries · 2 errors", **Clear Debug** and **Export** at the top right; a search field with level pills (All / Error / Warn / Info / Debug); each entry a mono timestamp, a level badge, the service, a title, a mono detail line truncated with `…` at 380, an id, `⋯` |
| Taken | **Export** as the header's action; the count in the header's subline |
| Not taken | **Clear Debug**: a log you can clear is the one thing this page must never offer. Detail truncated with an ellipsis: the reason is never truncated here, in either view |

## Rejected

| URL | Rendered | Why not |
|---|---|---|
| https://www.shadcn.io/preview/blocks/crud/crud-activity-log | **404** | Guessed name |
| https://www.shadcn.io/preview/blocks/crud/crud-audit-trail | **404** | Guessed name (the audit block is `crud-audit-log`) |
| https://www.shadcn.io/preview/blocks/crud/crud-change-log | **404** | Guessed name |
| https://www.shadcn.io/blocks/crud | **404** | The category index; not a page |

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure.
