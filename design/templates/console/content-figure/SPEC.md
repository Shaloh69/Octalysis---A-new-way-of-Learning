# SPEC: a figure under review (console)

Instructor rulings 6 Oct 2026; `docs/FIGURES-AND-AUDIO.md`.

- `/content/:stageId` has a **Figures** card when the chapter has figures: "N of M waiting
  for review", then one card per figure in a grid (one column at 380).
- A figure card: heading = id in mono + title; status in a word (Waiting for your review,
  Approved, Sent back); the drawing large on `--surface-0`; one sentence on what students see
  now; the reason when sent back; who reviewed and when.
- **Approve figure <id>** sends the drawing's hash; the API refuses a redrawn one (409). **Send
  back figure <id>** opens a dialog that needs a reason. Both toast, both audited.
- The chapter's preview and the draft's preview draw figure blocks with the drawing under
  review, and say "Not approved yet" under one that is not.
- `/items` review: a question that names a figure shows the same card under its stem, and
  **Approve and publish** is disabled with a sentence saying why until the figure is approved.
- The six gate assertions of `console-content.spec.ts` stay green at 1440 and 380.
