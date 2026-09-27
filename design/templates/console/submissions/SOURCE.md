# Source of template.png

`CONSOLE-REVAMP.md` §3 names a *"marking-queue list"* for `/submissions`.
`TEMPLATE-LINKS.md`'s `/console/submissions` row names shadcn-admin's **Tasks**
page, the same dense-table reference `/items` used, and records that a
purpose-built grading queue template does not exist. Both halves of the page
were looked for: **the queue**, which the named Tasks page covers, and **the
marking panel** (read the work, pick a band, write feedback, and the audited
return), which no named link covers. Every candidate below was captured and
opened before anything was built.

## Taken: `template.png`, `template-380.png`, `template-380-list.png`

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/chats, shadcn-admin's **Inbox**, with the first conversation (*Alex John*) selected |
| Captured | 2026-09-27, Playwright (Chromium), `networkidle` + 2.5s, then one click on the conversation |
| HTTP | 200, final URL unchanged (no redirect) |
| Viewport | 1440x900 → `template.png`; 380x900 → `template-380-list.png` (nothing selected) and `template-380.png` (the conversation selected). Full page. The Inbox is not vertically centred, so nothing clipped at 380x900 and no taller viewport was needed |
| Chrome removed | None needed: shadcn-admin floats no site control. 0 dialogs, menus or listboxes open |
| Rendered at 1440 | The app shell, then **two panes**. Left, ~18rem: an *Inbox* heading, a search field, and a **list of conversations**, two lines each (name, then the last line of the thread), the selected one tinted. Right, the rest: a **reading pane** with its own header (name, role, actions on the right), the thread scrolling under it, and a **composer pinned to the foot** of the pane |
| At 380 | **One pane at a time.** `template-380-list.png`: the list, full width. `template-380.png`: the selected conversation full width, with a **back arrow** in its header, the composer at the foot. The list is gone while a conversation is open |
| What it gets wrong for us | A chat's composer sends a message and the thread grows. Ours is a **mark**, made once and frozen; changing it is a separate, audited act. And a two-line preview of the last message is exactly what `DESIGN-REVIEW-01` D-4 removed from this queue: what a teacher triages on is who, which deliverable, when, and **whether it was late** |

## The named lead: `template-tasks.png`, `template-tasks-380.png`

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/tasks |
| Captured | 2026-09-27, same method, HTTP 200, URL unchanged, no site chrome to hide |
| Rendered at 1440 | *Tasks*, a one-line description, Import / Create on the right; a filter field and two faceted filters (Status, Priority) with a View control; a **dense table**: select box, Task id (mono-ish), a type badge + title, Status and Priority as icon + word, a `⋯` per row; pagination at the foot. ~49px per row |
| At 380 | The table **scrolls sideways inside its card**, cut at "Status"; the filter field's placeholder is cut at "Filter by title or II". That is assertion 1's defect in the reference, and why ours is a list below its breakpoint |
| Taken | The **density** (D-4's ~41px bound already came from here), the toolbar shape (search + faceted filters with counts), status as a word beside an icon rather than a colour |
| Not taken | Row selection checkboxes (there is no bulk grading: each mark is read and decided), pagination (61 rows; one scroll), the table at 380 |

## Rejected

| URL | Rendered | Why not |
|---|---|---|
| https://www.shadcn.io/preview/blocks/crud/crud-approval-queue (`rejected-approval-queue.png`) | 200. *Approval Queue*: Pending 4 / Approved 1 / Rejected 1 tabs, rows of title + category badge + requester + age, a chevron per row. A centred card; floating theme switcher hidden | The closest name, and the queue half matches, but there is **no detail pane**: the chevron goes nowhere. A lab write-up has to be read before it is marked |
| https://www.shadcn.io/preview/blocks/crud/crud-review-moderator | 200. *Review Moderation*: search, All/Pending/Approved/Rejected/Flagged, each review's full text inline with Approve / Reject buttons under it | Decides **inline in the list**, which is right for a one-line review and wrong for a four-band rubric plus feedback. It also puts Reject in red on every row |
| https://www.shadcn.io/preview/blocks/crud/crud-view-details | 200. A product detail page (*Wireless Noise-Canceling Headphones*) | A detail view with no queue beside it |
| https://www.shadcn.io/preview/blocks/crud/crud-feedback-manager | 200. *Feedback*: a list of feedback entries with status | A list again, no reading pane |
| https://ui.shadcn.com/examples/mail | **404** | The mail example (list + reading pane) that shadcn/ui used to ship. Removed, like `/examples/forms` before it |
| https://ui.shadcn.com/examples/tasks | 200, but it renders the **shadcn/ui landing page** ("The Foundation for your Design System") around a small tasks demo | Same table as shadcn-admin's Tasks inside marketing chrome; the admin page is the cleaner capture |
| https://www.shadcn.io/blocks/mail, https://www.shadcn.io/preview/blocks/mail/mail-inbox | **404** | Guessed paths; shadcn.io has no mail category. Its `crud-*` family was searched instead (above) |

## How this was searched

The shadcn.io catalogue (`/blocks`) lists one block per category; the `crud`
family (≈90 blocks) was read from a block page's sibling links and filtered
for *approval, review, moderation, queue, feedback, detail, task*. Four came
back and all four are above. None has a list beside a reading pane. The one
reference that does is shadcn-admin's own Inbox, from the same template the
console's other tables already follow.

The PNGs were opened and looked at after capture.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure;
see `SPEC.md`.
