# Source of template.png

`TEMPLATE-LINKS.md`'s row for `/console/content` names no URL: *"Standard
CMS-style split editor/preview. Any markdown-editor-with-live-preview pattern
(e.g. shadcn's own docs site editor patterns)."* `PAGE-SPECS.md` asks for
*"Edit `content_blocks` with live preview. Versioned."* and `WEB-REVAMP.md`
§3.8 puts **summary review** on this route. So three shapes were needed: a
chapter list, an editor with a preview beside it, and a review queue.

Captured 2026-09-28 with Playwright (Chromium), `networkidle` + 3s. 1440 at
1440x900; 380 at 380x1400. Every PNG below was opened and looked at before a
line of the rebuild was written.

**A 200 proved nothing here, twice.** Decap's demo answers 200 on every route
and renders only a *Login* gate until the button is pressed (it uses a test
backend, so no credentials are involved). The first two captures were that
gate. The captures below log in first; the hash routes then return no HTTP
status of their own ("hash-nav" in the log), so what rendered is recorded from
the image, not from a status code.

## Taken

### `template.png`, `template-380.png`: the editor

| | |
|---|---|
| URL | https://demo.decapcms.org/#/collections/posts/entries/2026-09-29-post-number-20 (Decap CMS, the open-source Git-based CMS formerly Netlify CMS, its public demo) |
| Rendered at 1440 | An editor bar (back arrow, *Writing in Posts collection*, *CHANGES SAVED*, Save, Published ▾, Delete published entry, View Live); the entry's **fields on the left** (Title, Draft, Publish date, Cover image, Body with a Rich Text / Markdown toggle) and a **live preview on the right**, split by a rule |
| At 380 | **The preview is gone**, with no way to reach it. The editor bar crops its own buttons: *Delete published entry* is off the right edge and the title wraps to four lines |
| Taken | **The split**: what you edit on the left, what the reader will see on the right, updated as you type. A save state in words in the editor's own header ("changes saved"). A back control to the collection |
| Not taken | Delete (a content block is never deleted from the console; sync owns structure). Rich-text mode (the student app renders a small subset, so a WYSIWYG would show things students never see). The floating eye toggle. **The 380 behaviour**: losing the preview is losing the reason for the page. Ours keeps both, one at a time, behind two pressed buttons |

### `template-dillinger.png`, `template-dillinger-380.png`: the source pane

| | |
|---|---|
| URL | https://dillinger.io/ |
| Rendered at 1440 | A markdown editor: the **source in a monospace pane on the left**, the rendered document on the right, a word and character count under the source |
| At 380 | Its document drawer opens over the editor on load and covers it |
| Taken | The source in **mono**, because markdown source is what the machine reads (`design.md`: mono means "this is what the machine sees"). A count under it |
| Not taken | Import, export, image upload, the drawer, cloud services. The whole chapter is one document in Dillinger; ours edits **one block at a time**, because blocks are what is versioned and synced |

### `template-table.png`, `template-table-380.png`: the chapter list

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/tasks (already the console's dense-table reference for `/items`, `/submissions`, `/audit`) |
| Rendered at 1440 | *Tasks*, a description; a filter field and faceted filters; a dense table with a status word and icon per row; pagination |
| At 380 | The table runs off its card: Status is cut to "Ca", "Do", with no scroll affordance |
| Taken | The dense table with a **status in words** on every row, the id in mono, the title as the row's link |
| Not taken | Filters (19 rows fit on one screen, and all 19 matter). Selection, the row menu, pagination. **The 380 table**, which clips exactly the column the page exists for; ours is a list below its table width |

## Captured and rejected

| URL | Rendered | Why not |
|---|---|---|
| https://demo.decapcms.org/#/collections/posts (`template-collection.png`) | The collection: a *Collections* sidebar, a description card, Sort/Filter/Group, one card per entry with title and date | The card list carries only a title and date. A chapter's row has to say **authored or planned, its summary's state, and whether it holds edits not yet in git**, and cards 64px tall would not show 19 of them. The table does |
| https://demo.decapcms.org/#/workflow (`template-workflow.png`) | *Editorial Workflow*: three coloured columns, Drafts / In Review / Ready, 0 entries each | This is the closest stock shape to summary review, and its grammar is kept as **words** (to review, sent back, approved). The board is not: three columns of 19 short texts at 1440, and nothing at 380. Colour-coded columns would also make state a colour, which the console never does alone |
| https://uiwjs.github.io/react-md-editor/ | A documentation page for a React editor component; the capture landed mid-page | A component's docs, not a page layout |

## The page before the rebuild

`before.png` (1440) and `before-380.png` (380), captured from the built console
on 28 Sep 2026. At 1440 it reads well. **At 380 the table is cut off after its
Type column**: Status, Objectives, Blocks and Live items, the columns the page
exists for, sit off-screen on every row. It has no editor and no summaries.
