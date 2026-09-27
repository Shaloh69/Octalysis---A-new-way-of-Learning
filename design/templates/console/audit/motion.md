# `/audit` — motion

**No entrance.** A teacher opens this page to find one entry, often while
someone waits for the answer; a hundred rows easing in would make them wait
for the thing they came to read. Every state reads from a still frame, and
`prefers-reduced-motion` cuts everything.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| Details, opening | `octa-rise-in` (shared) on `.au-details` | `--dur-fast` | the fields are there; the button reads `aria-expanded="true"` and its chevron points up | cut |
| The chevron on Details | `rotate` transition | `--dur-fast` | the panel under the row is open or not | cut |
| Entries brought in by **Load older** | `octa-fade-in` on `[data-new]`, once | `--dur-base` | *Showing N of M* grows; the button's "N more" shrinks, or the end sentence replaces it | cut |
| Toasts after Export CSV | `octa-rise-in` (shared toaster) | `--dur-fast` | the toast says how many entries, which filter, and the file's name; a refusal says why and stays | cut |
| Row hover in the table | `background-color` transition | `--dur-fast` | none needed: hover adds nothing a still frame lacks | cut |
| Table / Timeline (pressed) | `background-color` (the shared `Button`) | `--dur-fast` | `aria-pressed` and the accent fill; the view underneath changes | cut |
| The skeleton, after 400ms of a first load | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence **at its top** says the server may be waking | cut to one frame |

**A filter change does not animate.** The rows already shown stay put while the
new ones load, and a `Loading…` status sits beside the count; the new rows
replace them in one step. Easing rows out and in on every keystroke would move
the text under the reader's eye, which is exactly what `design.md`'s "never
move the content after it lands" forbids.

**Load older does not scroll.** The new entries land under the ones already
read. When it reaches the start of the log, the button is replaced by *That is
every entry …* and focus moves to that sentence, so a keyboard user is not
dropped on `<body>`.

Gate assertion 6 in `design/specs/console-audit.spec.ts` checks both halves:
with motion allowed, Details MUST ease open (the positive control, read
through `motionStarted(page, "main")`), and with `reducedMotion: "reduce"`
emulated nothing on the route may animate, through a reload, Details and both
view switches.
