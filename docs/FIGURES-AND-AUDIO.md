# Figures and the audiobook — plan and rulings

Instructor request, 6 Oct 2026: "In all of the activities you mentioned Figures,
screen shot the figures or recreate them and save them to Supabase. Reread
everything to add those figures. Show if needed in questions. Add this to the
approval in admin, in contents or in items if questions need figures. Second,
an audiobook feature."

## Rulings (instructor, 6 Oct 2026, asked once)

1. **Figures are RECREATED as our own SVG diagrams**, never screenshots of the
   book. A figure draws the same idea as the book's figure, in the course's
   tokens, and is credited "after Stallings, Figure N.N". This keeps the line
   `.claude/rules/content.md` draws: book figures are described and referenced,
   never reproduced.
2. **The audiobook uses the browser's own voice now** (the Web Speech API:
   free, no key, no storage, works offline; the voice varies by device).
   **Pre-recorded MP3s are a later upgrade**, once a TTS key and a budget for
   Supabase Free's 1 GB exist.
3. **Order: the figure pipeline first**, then the lesson text of chapters 13-18
   written with their figures in one pass, then a reread of 01-12 to add theirs,
   then the questions for 09-18, then the audiobook, then R5.
4. **Revised, instructor, 6 Oct 2026: "stop all authoring only until chapter 12,
   don't pursue the rest."** Lesson text is drafted for 08-12 and no further.
   Chapter 13's draft (with two figures) was already written and synced before
   this ruling, and waits unapproved on /content; whether to withdraw it is the
   instructor's call. 14-18 keep their planned stubs. The work order is now
   (revised again 6 Oct: **the class chat first**, `docs/CHAT-PLAN.md`):
   (a) the reread of 01-12 to add figures; (b) questions for 09-12 only, at
   review; (c) the audiobook; (d) **the "Octalysis AI" proposal, analysed in
   `docs/AI-ASSISTANT-PROPOSAL.md`**: decide it, and build only the local drafting
   assistant if approved; (e) R5.

## Figures — how they work

**Source.** One file per figure, `content/figures/<id>.svg`, id like
`10-instruction-format` (the stage number, then a slug). A lesson places it
with a block:

```
<!-- block: figure id="10-instruction-format" after="12.2" -->
A 16-bit format: a 4-bit opcode and two 6-bit operand references.
```

The body is the caption. `after` names the book figure it redraws (book
numbering, through `content/book-map.json`); omit it for an original diagram.
The SVG's `<title>` is its accessible name and `<desc>` its long description.

**Rules for an SVG** (checked by `sync-content --verify`, refused otherwise):
a `viewBox`, a `<title>`, a `<desc>`, no width or height in pixels; only drawing
elements (no `script`, `foreignObject`, `image`, `use` of an outside file,
`on*` attributes, `javascript:` or outside `href`s, `style` elements); **no
literal colours**: every fill and stroke is `currentColor`, `none`, or a
`var(--fig-*)` token, so a figure is drawn in each realm's own colours and
meets the same AA contrast. Text at least 14 units at a viewBox no wider than
440, so it stays legible at 380px (measured 6 Oct 2026: at 640 and 12 the
console drew 8px labels at 380, and at 480 the reader drew 8.7px; at 440 the
smallest text is 9.5px. A figure is designed for a phone first).

**Storage.** Supabase Postgres, table `figures` (`db/addendum-figures.sql`),
staff-only under RLS like `chapter_drafts`. Sync writes the file's SVG as the
draft. Students are served **only `approved_svg`**, the bytes an instructor
approved, by hash; a changed file withdraws the approval and students keep the
last approved figure. A trigger refuses any `approved_svg` that is not the
approved draft. (`content_blocks.media_ref` holds the figure id.)

**Approval, in the console.**
- `/content`: each chapter lists its figures, drawn, with Approve and Send back,
  bound to the hash the reviewer saw, audited. Drafted chapters (08-18) show
  their figures in the draft preview with the same controls.
- `/items`: a question that needs a figure names it (`figure` in
  `content/items/NN.json`, column `items.figure_id`). The review shows the
  figure with its own Approve, and **a question cannot go live while its figure
  is unapproved** (the approve route refuses, and a trigger refuses it in the
  database too).

**Students.** The reader draws an approved figure inline with its caption and
credit; an unapproved one is simply absent (caption too). A question's figure
sits above its options in the stage check and the exams, on the neutral paper.

## The audiobook's voice — rulings of 6 Oct 2026 (evening)

The instructor: "intonation and voice quality is horrible". Asked once:
**both** (the better browser voice now, recorded MP3s next), and the MP3s
from **Google Cloud Text-to-Speech** (WaveNet/Neural2; about 300,000
characters for chapters 00-12, inside its free tier).

**Done the same day:** the best English voice on the device is chosen (a
"Natural"/"Online"/"Google" voice before the robotic defaults), a Voice choice
remembered per device, a paragraph spoken as one utterance where the voice
allows (Google's online voices get ~200 characters: they stop after ~15 s),
symbols said as words, and the reading mark redrawn as a soft panel with
room around the text.

**MP3s, the plan (not built):** a script reads the APPROVED lesson blocks,
asks Google Cloud TTS for one MP3 per block (a low mono bitrate keeps the
course to tens of MB), and stores each in a private Supabase bucket under the
block's text hash, so changed text gets new audio and unchanged text is never
paid for twice. A staff-only table records (stage, ordinal, hash, path,
bytes, voice); the reader plays the MP3s in order through signed links the
API gives only for a stage the student may read, falling back to the browser
voice where a block has none. Schema first, pushed before code (hard rule
10). **Needs from the instructor:** a Google Cloud project with the
Text-to-Speech API enabled, and an API key (server-side only: root .env and
Render, never a VITE_ variable, hard rule 2).

## The audiobook — how it works

**Built 6 Oct 2026** (`components/ListenBar.tsx`, `lib/listen.ts`; gate
`design/specs/web-listen.spec.ts`). The MP3 upgrade waits for a TTS key and a
storage budget.

A **Listen** control on the stage reader (`/app/stage/:id`): play, pause, speed,
and the paragraph being read is marked and kept in view. It reads the approved
lesson text only, in order, skipping code listings and figure drawings (it reads
their captions). Design-mandate tests: it changes what the student can do (hear
the lesson hands-free) and is reversible (pause, stop). It never appears on a
paper being sat (hard rule 9). Where the browser has no speech synthesis, the
control is not drawn and one line says so.

## Status

Tracked in `docs/NEXT-SESSION.md` and `docs/PROGRESS.md`. This document holds the
rulings and the design; update it when either changes.
