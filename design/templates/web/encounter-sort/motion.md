# Two Columns: motion

| What moves | How | Duration | Reduced motion |
|---|---|---|---|
| A card landing in a column or back in the tray | `sort-in`: opacity 0 → 1 | `--dur-fast` | **Cut** (`--dur-fast: 0ms`, and `[data-encounter] { animation: none }`). Asserted: `web-encounter-sort.spec.ts` gate 6, positive control first |
| Compare with the book | nothing: the words appear | — | — |
| The lazy chunk arriving | nothing under 400ms, then "Loading the warm-up…" | — | — |

Nothing here is the only carrier of a meaning: where a card sits is its
column's heading, and the status line says each move in words.
