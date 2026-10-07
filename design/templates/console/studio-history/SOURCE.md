# Template for per-topic History in the Studio's editor (E1.5)

- URL: https://en.wikipedia.org/w/index.php?title=CPU_cache&action=history&limit=12
- Captured: 8 Oct 2026, Playwright, 1440x900 (`template.png`, opened and read). HTTP 200; a real
  revision-history page rendered with its list.
- What it is the reference FOR: a revision list, newest first, one row per version: WHEN, WHO,
  the edit's summary (our "reason"), and one action per row ("undo" there; "Use this text" here).
  Taken: the row anatomy and the order. Not taken: the dense single-line layout (a topic's
  earlier text must be readable in place, so each row carries the old text), the diff
  checkboxes (the dialog shows the text itself), "minor edit" tags.
- Colours are ours (`packages/tokens`); the specs assert structure, never pixels.
