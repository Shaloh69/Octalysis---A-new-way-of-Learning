# `/live` and `/live/present` — motion

**No entrance on `/live`.** A teacher opens it mid-lecture to read four numbers
and a card; nothing eases in before them. **The projector has one moment**: a
bar grows from its baseline when a figure lands (`VISUAL-SYSTEM-3D.md`: no
decoration on the projector, so this is the only one). Every state reads from a
still frame, and `prefers-reduced-motion` cuts everything.

| What moves | How | Duration | Still-frame signal | Reduced motion |
|---|---|---|---|---|
| Projector bars (the class's share; the class so far) | `octa-grow` (shared with `/gradebook`) on `.lv-p-fill`, `transform-origin: left` | `--dur-trace` | the percentage and "7 of 12" are printed beside the bar | cut |
| A bar's width when a new reading changes it (both views) | `width` transition on `.lv-fill` / `.lv-p-fill` | `--dur-base` | the number beside it changes in the same frame | cut |
| Start a question / End this question opening | `ease-dialog` (`octa-pop-in`, shared) | `--dur-fast` | the dialog and its title; focus moves into it | cut |
| Toasts after Start and End | `octa-rise-in` (shared toaster) | `--dur-fast` | the toast names the item and what happened to it; a refusal also shows **in the dialog**, and its toast stays | cut |
| Question rows, stage and section pills (pressed) | `background-color` / `border-color` transition | `--dur-fast` | `aria-pressed` and the accent border | cut |
| The skeleton, after 400ms of a first read | `octa-shimmer` | `--dur-base` × 6, looping | the skeleton's shape and `aria-busy`; past 3s a sentence **at its top** | cut to one frame |

**A new reading does not animate the page.** Every 5 seconds the numbers are
replaced in place; only a bar whose value changed eases to its new width.
**Starting or ending a question does not animate the card**: it changes state
in one step, and the toast says what happened.

Gate assertion 6 in `design/specs/console-live.spec.ts` checks both halves:
with motion allowed, the projector's bar MUST grow in (the positive control,
read through `motionStarted(page, "main")`), and with `reducedMotion:
"reduce"` emulated nothing on `/live` or `/live/present` may animate, through
a reload, the End dialog and the projector.
