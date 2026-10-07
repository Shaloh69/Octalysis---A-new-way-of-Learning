# Template for the Studio's moons editor (E2)

- URL: https://ui.shadcn.com/examples/tasks
- Captured: 8 Oct 2026, Playwright, 1440x900 (`template.png`, opened and read) and 380x800
  (`template-380.png`: the hero fills the first screen, so it shows the shell only).
- HTTP status 200; what rendered: shadcn's Tasks example, a table of tasks.
- What it is the reference FOR: a row = a code, the text, a status told by a small shape AND a
  word, a row menu; one primary "Add" button above the list; filters. The moons editor takes the
  row anatomy (code, sentence, status shape + word, row actions) and the single Add action; it
  does not take the table (a moon's sentence is long, so a row is a list item that wraps) or the
  filters (a chapter has ten moons, not a thousand).
- Colours are ours (`packages/tokens`); the specs assert structure, never pixels.
