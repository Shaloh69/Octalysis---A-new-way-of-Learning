# /studio — motion

| What moves | How | Reduced motion |
|---|---|---|
| A sheet (the outline or the AI pane at 380) | the dialog's ease-in, `--dur-base` | cut |
| A dialog (add subject, add or edit a book, make default, send back) | the dialog's ease-in | cut |
| Outline links, tabs, icon buttons, hover | `background-color` / `color`, `--dur-fast` (160ms), `--ease-out` | cut (`--dur-fast: 0ms`) |
| A pane docking (1440) | none: it is there or it is not | the same |
| Opening a subject's disclosure | none: the chevron turns, the list appears | the same |
| A sidebar tab changing (Outline / AI Assistant) | none: the panel is swapped | the same |
| A topic becoming the active one | none: its controls and the accent bar are there or not | the same |
| Typing, formatting, adding, moving, deleting a topic | none: the page changes where you are | the same |
| The save status (Saved / Unsaved changes / Saving) | a word, never an animation | the same |
| The Publish and Discard dialogs | the dialog's ease-in | cut |
| Student view toggle | none: the page is swapped for the preview | the same |

Nothing ambient. The send-back dialog is the positive control in
`console-studio.spec.ts` gate 6 (it eases with motion allowed; nothing over 1ms
with `reduce` emulated).
