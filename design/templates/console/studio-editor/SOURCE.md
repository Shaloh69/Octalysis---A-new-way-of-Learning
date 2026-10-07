# Studio's editor look — template sources

Instructor, 8 Oct 2026: "Change the design for the Studio. It should look more
like an actual editor; also the sidebar should be on the right side. Also
freedom of clicking, typing like MS Word for the topics or moons." Answers the
same day (AskUserQuestion): **one right sidebar with two tabs, Outline and AI
Assistant**; every freedom (type in place, add/delete/reorder topics, edit a
moon's wording, add/delete moons); **Draft, then Publish**; the AI may also
propose moons. Plan: `docs/STUDIO-EDITOR-PLAN.md`.

All captured 8 Oct 2026 with Playwright (`scripts/.capture-ref.tmp.mjs`,
`.capture-loose.tmp.mjs`), opened and looked at.

| File | URL | HTTP | What rendered |
|---|---|---|---|
| `lexical.png` | https://playground.lexical.dev/ ("Lexical Playground") | 200 | **The Word model:** one toolbar (undo, redo, block type, font, size, B / I / U / code / link, colour, Insert, align) above a white page; the document is just there to click into and type. (Its black debug panel is the playground's, not taken) |
| `tiptap.png` | https://tiptap.dev/product/editor ("Tiptap Rich Text Editor") | 200 | The marketing hero, and under it the **Simple Editor's toolbar**: undo/redo, heading, lists, quote, code block, B I S code U highlight link, super/subscript, align, Add. The vocabulary of controls to offer |
| `tiptap-notion-like.png` | https://tiptap.dev/docs/ui-components/templates/notion-like-editor ("Notion-like \| Tiptap UI Components") | 200 | **The block model:** a page of blocks with a callout, and a **slim outline rail down the page's right edge** (a dash per heading). Docs chrome around it is not taken |

**Taken:** the document is a centred page on a canvas, with ONE toolbar above it
(Lexical): undo, redo, a block-type menu, bold, italic, code, link-free (the
reader renders none), lists, callout, Insert; each topic a block you click into
and type in (Notion-like); the outline on the right (Notion-like's rail,
here the Studio's full right sidebar with tabs).

**Rejected, with reasons:** https://novel.sh/ (rendered "Application error: a
client-side exception has occurred", nothing to look at);
https://ckeditor.com/ckeditor-5/demo/document-editor/ (404) and
https://ckeditor.com/ckeditor-5/demo/ (a demo index with thumbnails, no editor).

**Not taken:** colours and type (ours, three themes), fonts and font sizes,
text colour, highlight, alignment, sub/superscript, links, images (the reader
renders none of them: what the editor offers is what a student can see), live
multi-cursor collaboration, the playground's debug panel.
