# Source of template.png

`CONSOLE-REVAMP.md` §3 names *"shadcn Blocks — form + preview"* for
`/assessments`, and `TEMPLATE-LINKS.md`'s `/console/assessments` row says
*"shadcn Blocks — multi-step form"*. Both are leads. Each was followed, and what
each one actually rendered was captured and looked at before anything was built.

## Taken: `template.png`, `template-380.png`

| | |
|---|---|
| URL | https://www.shadcn.io/preview/blocks/form/form-with-preview, the bare preview of shadcn.io's **Form With Preview** block (its catalogue page is https://www.shadcn.io/blocks/form-with-preview) |
| Captured | 2026-09-27, Playwright (Chromium), `networkidle` + 2.5s |
| HTTP | 200, final URL unchanged (no redirect) |
| Viewport | 1440x900 → `template.png`, full page; 380x1400 → `template-380.png`, full page (see "At 380") |
| Chrome removed | The preview site floats its own theme switcher ("Default · Light · Radius · Style", a palette button at 380) over the block, `position: fixed`. It is the site's control, not the block's, and was hidden before capture. 0 dialogs, menus or listboxes open |
| Rendered at 1440 | One bordered card split in two by a vertical rule. **Left, "Article Details"**: a heading and one-line description, then labelled fields stacked one per row (Title, Description with a hint under it, Status and Badge Color as compact selects, Author) and one full-width primary button at the foot of the form. **Right, "Live Preview"**: a heading and description, then a **preview card** showing the thing as its reader will meet it (title, a status badge, description, byline), then a **"Metadata" box**: label left, value right-aligned, one row each (Words 12, Characters 87, Read time 1 min) |
| At 380 | The two halves **stack**: the form first, the preview under it, split by a horizontal rule. Captured on a 1400px-tall viewport, because at 380x900 the block's own heading sat at **-46px**, above the page's scroll origin: the card is centred in a full-height flex box and, once taller than the viewport, overflows upward where no scroll can reach it. That is assertion 1's defect in a template, and the reason `SPEC.md` never vertically centres anything |
| What it gets wrong | The preview says nothing the form fields did not already say, and the metadata is decoration (a word count). Ours has to earn the panel: the preview is **what a student will be offered**, and the metadata box is **whether the live bank can fill it**, which the form cannot tell you |

## The named lead: `template-multi-step.png`, kept as the record

| | |
|---|---|
| URL | https://www.shadcn.io/preview/blocks/form/form-multi-step (catalogue: https://www.shadcn.io/blocks/form-multi-step) |
| Captured | 2026-09-27, same method, HTTP 200, URL unchanged, site switcher hidden |
| Rendered | "Create Your Profile": a three-step indicator (Personal Info → Professional Details → Review & Submit), two fields on step 1, Back / Next in a footer |
| Why not | An assessment is **six fields**. A wizard hides five of them behind Next while the one thing a teacher needs to see, whether the bank can fill the paper, would only appear at the review step, after the choices it depends on. The preview must sit beside the fields and change as they change |

## Rejected

| URL | Rendered | Why not |
|---|---|---|
| https://ui.shadcn.com/blocks | 200. The Blocks index shows five iframes: `dashboard-01`, `sidebar-07`, `sidebar-03`, `login-03`, `login-04` | No form block at all. The link `TEMPLATE-LINKS.md` meant does not exist there, as `/students`' `SOURCE.md` had already found |
| https://ui.shadcn.com/examples/forms | **404** | Removed from the shadcn site |
| https://ui.shadcn.com/examples/cards | **404** | Removed; it held the old "Create project" card |
| https://www.shadcn.io/view/forms/multi-step-form | **404** | A guessed path; the catalogue's real one is above |
| https://www.shadcn.io/preview/blocks/form/form-split-panel | 200. A left nav of section names beside one long form | A navigation pattern for a long form; this form is short, and it has no preview |
| https://www.shadcn.io/preview/blocks/form/form-wizard | 200. "Setup Wizard" with a vertical step list | Same objection as the multi-step lead |
| https://www.shadcn.io/preview/blocks/stepper/stepper-with-preview | 200, but **rendered no headings and no inputs** in 4s | Nothing to compare against |
| https://atlassian.design/components/form/examples | 200. 17 live form examples in documentation | Forms without a preview; and the examples sit inside docs chrome with no bare page to capture |

## The list half

The page is a list of assessments as well as a create form. The list's
structure is not new: it follows the table-then-list pattern already
referenced and captured for `/students` (`../students/template.png`,
shadcn-admin's users table) and `/students/:userId`, and it keeps the columns
`console-teaching.spec.ts` has held this page to since the density pass.
No second capture was taken for it.

The PNGs were opened and looked at after capture.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure;
see `SPEC.md`.
