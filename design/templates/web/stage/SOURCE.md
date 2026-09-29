# Source of template.png

`TEMPLATE-LINKS.md`'s row for `/app/stage/:id` names **shadcn Blocks,
article/reader layout**, https://ui.shadcn.com/blocks: *"Left content rail +
right objectives sidebar is a standard docs-reader pattern; don't reinvent
it."* That is a lead. Captured 29 Sep 2026; the lead held no reader.

## What was tried

| Lead | Result |
|---|---|
| **shadcn Blocks**, https://ui.shadcn.com/blocks | **Rejected: nothing of the right shape.** HTTP **200**, title "Building Blocks for the Web - shadcn/ui". Its categories are Featured, Sidebar, Login and Signup; the featured block is `dashboard-01` (KPI cards, an area chart, a data table). No article, docs or reader block exists. `rejected-shadcn-blocks.png` is what rendered. The same finding as `/assessments`' form (NEXT-SESSION §0f) |
| **shadcn's own docs page**, https://ui.shadcn.com/docs/installation | **Considered, not taken.** 200, "Installation - shadcn/ui". It IS the pattern the lead describes (section nav left, content, "On This Page" right), but its right rail is a plain link list with no mark for where the reader is, and half the rail is an advertisement. `considered-shadcn-docs.png` |
| **MDN**, an article page, https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article | **Taken.** Below |

## The screen: `template.png`, `template-380.png`

| | |
|---|---|
| URL | https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article, HTTP **200**, title "<article> HTML article contents element - HTML \| MDN" |
| Captured | 2026-09-29, Playwright (Chromium), `domcontentloaded` + 6s, at **1440×1500** (`template.png`) and **380×1900** (`template-380.png`) |
| Rendered | A long reference article. 1440: a section tree on the left, the article in a centred column (title, a lead paragraph, then sections headed by h2, prose, a code sample in mono, lists), and on the right **"In this article"**: the article's own h2s as a list, with **a bar and a tint marking the sections currently on screen** (Try it, Attributes, Usage notes). 380: one column; the "In this article" list sits inline after the lead paragraph, with the same bar |
| Opened | All four PNGs were opened and looked at before `SPEC.md` was written |

## What we take

- **The reading is one column of a readable width, and the page's own headings
  are its navigation.** The right rail lists the stage's `##` sections, built
  from the content itself, never authored twice.
- **The rail says where you are.** MDN's bar over the visible sections is
  PAGE-SPECS' "section progress" in its reference form: `Section 3 of 7` in
  mono and a mark on the current section, from the scroll position alone.
- **A code sample is a framed block in mono, in the flow of the prose.** Ours
  are the chapter's figures, verbatim (PAGE-SPECS).
- **Headings are headings.** h2 per section, h3 below; the old reader drew
  `## ` as text.

## What we do not take

- **The left section tree.** Our left edge belongs to the shell (the Depth
  Gauge), and the whole course's tree is the map, one control away. The reader
  offers **Back to the map** instead.
- **The inline list at 380.** PAGE-SPECS asks for a **bottom sheet** on mobile:
  a bar that says where you are and opens the same rail. MDN's inline list
  scrolls away with the first screen, which is where a student reading a
  9,000-character chapter loses their place.
- **The white page, the blue links, the browser-compat widgets, MDN's type.**
  Colours and type are ours, from `packages/tokens`, over the student's biome
  (`BIOME-AND-LOADING-SPEC.md` §1b)
- **"Try it" editors.** Nothing on this page runs code; archetype beats that
  would (LAB, TRACE, DRILL) have no blocks in the data, and none is invented
