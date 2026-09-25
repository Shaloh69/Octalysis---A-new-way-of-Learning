# Source of template.png

`TEMPLATE-LINKS.md` had no URL for this route. Its row said *"build from
`PAGE-SPECS.md` directly; closest structural reference is a permissions matrix —
any admin-panel roles × resources grid"*. That is a lead, not a template, so
four candidates were captured and looked at before one was chosen.

| | |
|---|---|
| URL | https://www.shadcn.io/view/tables/permission-matrix |
| Captured | 2026-09-25, Playwright (Chromium), `waitUntil: networkidle` + 1.5s, then the site's "Switch views" tour dismissed with its own "Skip tour" button |
| HTTP | 200, final URL unchanged (no redirect) |
| Viewport | 1440x900 → `template.png`; 380x900 → `template-380.png` |
| Rendered | A real block, not an empty SPA shell: 41 checkbox controls, 5 `th`, 18 `tr`. A card titled "Role Permissions" with a count ("13 permissions") at the right of its header; four role columns (Admin, Manager, Editor, Viewer), each carrying a **per-column count** (`13/13`, `11/13`, `5/13`, `3/13`); permission rows **grouped under section rows** (User Management, Content, Settings, Analytics); the Admin column fixed on, shown as a padlock rather than a checkbox. At 380 the grid does **not** fit: its fourth column is cut off at the card's right edge |
| Why this one | It is the densest two-axis grid of toggles of the four, and it carries the three things `/locks` needs from a reference: counts per column, a column whose cells are fixed by a rule above the row (our global override), and grouping rows |

A second capture sits beside it, **for the cell states only**:

| | |
|---|---|
| URL | https://www.shadcn.io/view/dashboard/permission-matrix |
| Captured | 2026-09-25, same method, HTTP 200 |
| File | `template-states.png` (1440) |
| Rendered | Resources × five roles, each cell a small **lettered badge** (A / W / R, or a dash for none), a **legend in the card header** naming each letter, and a user count under every column head |
| Why kept | The cell grammar: a state that is readable as a letter or a glyph, not only as a colour, with its legend where the eye already is. `/locks` has three states that must be told apart by a colour-blind teacher |
| Why not the main template | 7 rows × 5 columns of read-only badges. It is a summary, not a grid you operate |

**Rejected:**

| URL | Rendered | Why not |
|---|---|---|
| https://www.shadcn.io/view/tables/checkbox-toggle | One role × 8 resources × 4 actions, header checkboxes that toggle a column | Adopted as an *idea* (a column head that selects its whole column), not as the layout. It configures one role, and `/locks` is every student at once |
| https://www.shadcn.io/view/account/permissions | Grouped rows, check/cross per role, 0 interactive controls | Read-only. Nothing in it is a control |

**What neither template answers:** 380. Both overflow their own card at 380 (the
fourth column of `template-380.png` is cut off mid-word). A horizontal scroller
is assertion 1's defect, so the 380 layout is our own; see `SPEC.md`.

The PNGs were opened and looked at after capture. The first capture of every
candidate showed the site's onboarding popover over the grid; those were
discarded and re-captured with the tour dismissed.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure;
see `SPEC.md`.
