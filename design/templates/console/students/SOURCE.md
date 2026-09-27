# Source of template.png

`CONSOLE-REVAMP.md` §3 names *"shadcn-admin table"* for `/students`, and
`TEMPLATE-LINKS.md`'s `/console/roster` row adds *"dry-run preview modal
pattern — shadcn Blocks"*. Both are leads, not templates. Each was captured and
looked at before anything was built.

## The table — `template.png`, `template-380.png`, `template-states.png`

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/users |
| Captured | 2026-09-25, Playwright (Chromium), `waitUntil: networkidle` + 1.5s |
| HTTP | 200, final URL unchanged (no redirect). No onboarding popover on this page (checked: 0 dialogs or poppers before capture) |
| Viewport | 1440x900 → `template.png`; 380x900 → `template-380.png` |
| Rendered | A real table, not an empty shell: 10 `tbody tr`, 8 `th`, 11 checkboxes. Title "User List" with a one-line description; **Invite User** (outline) and **Add User** (primary) at the right of the title; a toolbar of a filter input and two **faceted filters** (Status, Role) with a **View** menu at the far right; columns Username, Name, Email, Phone Number, Status, Role, each row ending in a **`⋯` row menu**; status as a small bordered badge in words (Active, Invited, Suspended); pagination with rows-per-page at the foot |
| `template-states.png` | The same page with two rows ticked and the third row's menu open. Ticking rows raises a **floating bar at the bottom**: "✕ · 2 users selected · four icon actions", the last one a red delete. The row menu holds **Edit** and **Delete**, Delete set apart in red with its own icon |
| At 380 | The table does **not** fit. It is cut off at the card's edge after the second column ("Name"), with the Email column's first letter showing. Same failure as `/locks`' template: a horizontal scroller is assertion 1's defect, so the 380 layout is ours |
| Why this one | It is the named reference, and it carries every structure a roster needs: selection for a bulk action, a per-row menu that holds the one destructive action away from the row itself, status in words, and a toolbar of filters over a single table |

## The import — `template-import.png` (the named reference, rejected for the preview)

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/tasks, "Import" button |
| Captured | 2026-09-25, same method, HTTP 200 |
| Rendered | "Import Tasks · Import tasks quickly from a CSV file", a file input, **Close** and **Import**. That is all |
| Why not | There is no preview step. A file goes straight to Import. `/students`' whole point is that nothing is written until the plan has been read |

`https://ui.shadcn.com/blocks` (the `TEMPLATE-LINKS.md` lead for the preview)
answered 200 after a 30s `networkidle` timeout and a `domcontentloaded` retry. Its block
index lists **dashboard, sidebar, login and signup** only. There is no preview or
confirmation dialog in it to capture. `https://www.shadcn.io/view/dialogs/import-csv`
was a 404, and `https://importer.sadmn.com/` (a shadcn CSV importer) answered
**526, invalid SSL certificate** at Cloudflare.

## The preview — `template-preview.png`

| | |
|---|---|
| URL | https://ugnissoftware.github.io/react-spreadsheet-import/iframe.html?id=validation-step--basic&viewMode=story |
| Source | `react-spreadsheet-import` (UgnisSoftware), its Storybook "Validation Step" story, captured from the story's own iframe so the Storybook chrome is not in the picture |
| Captured | 2026-09-25, Playwright, `networkidle` + 2.5s, HTTP 200, 1440x900 |
| Rendered | "Validate data": every imported row in a table **before** anything is written, problem cells marked, a **"Show only rows with errors"** toggle and "Discard selected rows" in the header, one **Confirm** at the foot |
| Why this one | It is the one reference found that is built around the step `/students` exists for: every row, its outcome, a filter down to the rows that need a look, and a single commit |
| What it gets wrong | A problem is marked **by cell colour alone** (a pale blue, yellow or red fill), with the reason in a tooltip. `/students` says each row's outcome in words |

The PNGs were opened and looked at after capture.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure;
see `SPEC.md`.
