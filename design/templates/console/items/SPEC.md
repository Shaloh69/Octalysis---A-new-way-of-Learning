# `/items` — what was taken from the template, and what was not

Reference: `template.png` (shadcn-admin `/tasks`, captured 24 Sep 2026, see
`SOURCE.md`). Rebuilt 25 Sep 2026. Implementation: `current.png` (1440),
`current-380.png` (380). Gate: `design/specs/console-items.spec.ts`.

Colours and fonts are ours, always — `packages/tokens`, three themes. Nothing
below is about colour.

## Why the page was rebuilt, not fixed

Measured before touching it, and recorded as the red run:

- At 1440 the table was wider than its box. `Discrimination` spanned
  1370–1495px in a 1440px viewport and the action button sat at 1507–1575px,
  **off screen entirely**, inside a horizontal scroller nobody knew to scroll.
- At 380 only the ITEM column was visible; 472 elements sat outside the
  viewport.
- No toast, no loading state, no transition — the page blanked while it fetched
  and did its work silently.
- **An ordering (type G) item could not be reviewed.** The preview showed the
  shuffled steps with no key, because a G item's key is a sequence, not an
  option. Found by the gate: the first row happened to be one.

## Structure taken from the template

| Template | Here | Why |
|---|---|---|
| Title + one-line description left, actions right | `Items`, the bank's counts in words; **Import JSON**, **Export N as JSON**, **Review next** | The primary action is the one the page exists for. "Review next" opens the queue at the first item awaiting review *in the current filter* |
| Filter input + faceted filters in one toolbar | Filter box (slug, stem, objective) + Status, Stage, Type, Objective + Flagged | Browse by stage / objective / type / status is `PAGE-SPECS.md`'s first sentence for this page. Counts are in the options ("Awaiting review (183)") |
| Dense bordered table, one row per record, label beside title | Item · Stem · objective · Status · Exposures · p · Discrimination · Review | The objective code sits under the stem the way the template's label sits beside its title: it is context for the stem, not a column of its own |
| Status with an icon **and a word** | same | Colour is never the only signal |
| Row action at the right edge | a text **Review** button, `aria-label="Review <slug>"` | See "not copied" |
| Pagination footer: rows per page, page N of M, first/prev/next/last | same, 25/50/100 | The bank targets ~700 items |

### The column budget at 1440

Main is 1136px wide (1440 − 256 sidebar − 48 padding). `table-layout: fixed`,
so the table is exactly that wide and nothing can push it:

| Item | Stem · objective | Status | Exposures | p | Discrimination | Review |
|---|---|---|---|---|---|---|
| 13rem | *the rest, ~390px* | 6.5rem | 6rem | 6rem | 9rem | 6rem |

Measured density: **80.7px per row** (bound 95; the card list this replaced
was 122).

### Below 60rem of *available* width

A container query, not a viewport breakpoint — the sidebar takes a quarter of
a laptop screen. Each row reflows into a block: slug and **Review** on one
line, the stem below, then status, exposures, p and discrimination as
`label value` pairs. The header row stays in the accessibility tree, clipped
off screen, and every element carries an explicit table role so the reflow
cannot strip the semantics.

## Deliberately NOT copied

- **Row-selection checkboxes on every row.** Bulk review can only ever move a
  **draft** into review (below), so a checkbox appears only on draft rows, and
  select-all only when the page holds drafts. A checkbox on a review or live row
  would be a control that does nothing. Select-all sits *above* the table, not
  in its header: below 60rem the header row is screen-reader-only, and a
  control in it would be unreachable exactly where the template put it.
- **The "⋯" row menu.** The one action the page exists for does not go behind a
  menu. The action column was the defect; it is now a visible word.
- **Column visibility ("View").** Every column is load-bearing, and the spec's
  "every column the cards carried is still there" test exists because a density
  pass once tried to delete one.
- **Sortable headers.** The order is fixed: **flagged first**, then stage and
  slug. A flagged item is probably a wrong key on a live paper and is the first
  thing a reviewer should see. With 0 exposures across the bank, sorting by
  p or discrimination would sort nothing; revisit once `item_stats` has data.
- **Numbered page buttons.** First / previous / next / last and "page N of M"
  carry the same information in less width at 380.
- **"Create".** Items are authored in `content/items/NN.json` or imported; the
  console has no item editor (`/console/items/:id/edit` is not built).

## Features `PAGE-SPECS.md` planned, approved by the instructor 25 Sep 2026

| Planned | Built as | Bound by |
|---|---|---|
| Browse by objective and type | Type and Objective filters; objectives come from the bank and narrow to the chosen stage | — |
| **Bulk approve drafts** | Select drafts → **Send N to review**. `POST /items/bulk-status`, `to` is the literal `"review"` | Publishing stays **one decision per item** by a reviewer who is not the author (`routes/items.ts` rule 3). A draft's approval is its entry into the review queue. The API refuses `to: "live"`, skips anything that is not a draft and says why, and writes one `audit_log` row per item |
| **Import JSON** | Choose a file → **dry run first**, per-item plan with reasons → **Import N items as drafts** | Same rules as `sync-items.mjs` (`import-plan.ts`). Everything lands as a **draft** authored by the importer. A live item is **refused**, never versioned by an upload. An invalid row makes the whole commit write nothing. `source` is required for new or changed items and is kept in `audit_log`, since `items` has no column for it |
| **Export JSON** | **Export N as JSON** — exactly the rows the filters show | The file is the authored shape of `content/items/NN.json`, so it can be committed or imported back (an untouched round trip is all `unchanged`). **It carries the answer keys**, and the toast says so |

## What this page must never do

- Offer self-approval on an item the reviewer did not write (it would record a
  false statement in `audit_log`).
- Publish more than one item per decision.
- Close the review after a decision: it **advances** to the next item in the
  list being looked at. Closing pushes a reviewer toward rubber-stamping.
- Let an import change a live item.
