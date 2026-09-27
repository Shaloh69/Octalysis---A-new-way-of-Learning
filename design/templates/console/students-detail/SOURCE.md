# Source of template.png

`CONSOLE-REVAMP.md` §3 names *"TanStack expanding rows"* for `/students/:id`,
and `TEMPLATE-LINKS.md`'s `/console/students/:id` row points at TanStack
Table's expanding-rows example. That is a lead. It was captured and looked at
before anything was built, and so was a second reference for the record
header, which the lead does not cover.

## The attempt list: `template.png`, `template-380.png`, `template-subrows.png`

| | |
|---|---|
| URL (named) | https://tanstack.com/table/latest/docs/framework/react/examples/expanding → `template-subrows.png` |
| URL (taken) | https://tanstack.com/table/latest/docs/framework/react/examples/sub-components → `template.png`, `template-380.png` |
| Captured | 2026-09-27, Playwright (Chromium), `domcontentloaded` + 15s for the in-page WebContainer to boot and serve the example |
| HTTP | 200 for both, final URL unchanged (no redirect) |
| How | The example no longer runs in a StackBlitz/CodeSandbox embed: TanStack boots it in a WebContainer and shows it in an `about:srcdoc` iframe about 286px wide, beside the source. The iframe was lifted to `position: fixed; inset: 0` so the capture is **the example itself at 1440 and at 380**, not the docs page around it. The first row's expander was clicked before capture. One `role=dialog` exists in the docs chrome underneath; the lifted iframe covers it, and the PNGs were opened to confirm nothing overlays the example |
| Rendered, `expanding` | Rows expand into **sub-rows of the same shape**, indented under the parent: a pointing-hand toggle before the first name, 10 rows, a JSON dump of the table state below |
| Rendered, `sub-components` | Rows expand into **a detail panel of a different shape**: a toggle in a leading column of its own, and a full-width row inserted directly beneath the expanded row (here a JSON dump of the row). The other rows stay where they were |
| At 380 | The `sub-components` table does **not** fit: the last column is cut at the viewport edge ("Pro/Prog"). The same failure `/locks`' and `/students`' templates showed, and assertion 1's defect, so the 380 layout is ours |
| Why `sub-components` over the named one | A paper is not a sub-row of an attempt: it has a different shape (numbered questions, options, answers, key, rationale, time). The named `expanding` example nests rows of the same shape; its sibling `sub-components` is the pattern this page actually needs, and `CONSOLE-DATA-AND-TEMPLATES.md` §2 describes exactly it ("expanding a row reveals the regenerated exact variant"). `template-subrows.png` is kept as the record of what the named link shows |
| What it gets wrong | The toggle is an emoji in an unlabelled button: its state is the hand's direction and nothing else. Ours carries `aria-expanded`, `aria-controls` and the assessment's name as its label |

## The record header: `template-header.png`, `template-header-380.png`

shadcn-admin (the reference for `/students`) has **no user-detail page**:
its `/users` route is the list and a row opens an edit dialog. So a record
header had to come from somewhere else.

| | |
|---|---|
| Rejected | https://polaris-react.shopify.com/patterns/resource-details-layout, Shopify Polaris's "resource details" pattern (a customer or order record). Answered 200 but **redirected** to https://shopify.dev/docs/api/polaris; the pattern page no longer exists |
| URL (taken) | https://primer.style/react/storybook/iframe.html?id=components-pageheader-examples--pull-request-page&viewMode=story, GitHub Primer's `PageHeader`, "Pull request page" example, captured from the story's own iframe so no Storybook chrome is in the picture |
| Captured | 2026-09-27, Playwright, `networkidle` + 2.5s, HTTP 200, URL unchanged. 0 dialogs or open popovers |
| Viewport | 1440x900 → `template-header.png`; 380x900 → `template-header-380.png` |
| Rendered at 1440 | One record's header: the **title**, then on one line a **status label** ("Open", filled) followed by a **metadata sentence** with the mono values set apart (`main`, `bs/pageheader-title`), the record's **actions** (Edit, Code) at the right of the title, and tabs under it |
| Rendered at 380 | A **parent link** appears above the title ("← Pull requests"), the title wraps, the actions collapse into **one `⋯` menu** beside it, and the tabs collapse to the current one plus "More" |
| Why this one | It is a record page, not a list: back to the list, who it is, its state in a word, the facts about it in a sentence, and the few things you can do to it, kept out of the content below. A student's record has the same five |
| What we do not take | The tabs. This page has two sections (progress, attempts), both short enough to read without switching. The filled green status label: a status here is a word, and "deactivated" is not a success colour |

The PNGs were opened and looked at after capture.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure;
see `SPEC.md`.
