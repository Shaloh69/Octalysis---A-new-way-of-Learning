# Source of template.png

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/tasks |
| Captured | 2026-09-24 |
| HTTP | 200 |
| Viewport | 1440x900 |
| Rendered | 6 columns, 10 rows visible |
| Why this one | `TEMPLATE-LINKS.md` names shadcn-admin's data table as the reference for `/console/items` |

Captured with Playwright against the live demo, not saved from a blog
screenshot. A link is not a template: it can rot, redirect, or need JS that
never runs. This PNG is the artifact the spec compares structure against, and
the row above records exactly what produced it.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure —
column density, row height, header treatment, where actions sit, how filters and
search are arranged, and how the table behaves when it runs out of width.
