# `/locks` — motion

The console has no orchestrated moment. Everything here is a local state
change at `--dur-fast` (160ms) with `--ease-out`, from `packages/tokens`.
Nothing is the only signal of anything: every state these ease into can be
read from a still frame, in words.

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| Reason dialog **opens** | `.ease-dialog` → `octa-pop-in`: opacity 0→1, scale 0.97→1 | `--dur-fast` | **Cut.** Appears in place |
| Reason dialog **closes** | `octa-fade-out`; focus goes back to the cell that opened it | `--dur-fast` | **Cut** |
| **Dialog scrim** (every console dialog, since this session) | `.dialog-scrim` → `octa-fade-in` / `octa-fade-out` | `--dur-fast` | **Cut** |
| **Bulk bar** appears | `.bulk-bar` → `octa-rise-in` | `--dur-fast` | **Cut**; the count "N cells selected" carries it |
| Cell **hover** and **selected** rings | `box-shadow` transition | `--dur-fast` | **Cut**; selected is also in the cell's accessible name and in the bar's count |
| Cell **fill** after a save and reload | `background-color` transition | `--dur-fast` | **Cut**; the toast says what changed, to whom |
| **Tab** underline | `color`, `border-color` transition | `--dur-fast` | **Cut**; `aria-selected` and the text colour carry it |
| **Toast** enters | `octa-rise-in` | `--dur-fast` | **Cut** |
| **Skeleton** bars | `octa-shimmer`, infinite | `--dur-base` × 6 | **Still.** The bars stay, unanimated |

## Deliberately not animated

- **The readout strip.** It changes on every cell the pointer crosses; easing
  it would make it lag behind the pointer, and it is not a live region for the
  same reason.
- **The 1440 ↔ 380 pivot.** It is a layout decision, not a state change. A
  teacher never sees it happen except by resizing a window.
- **Staggered row entrances**, which the dashboard template has. Not ours.

## How "cut" is implemented, and proved

`packages/tokens` zeroes every `--dur-*` under `prefers-reduced-motion:
reduce`, and `apps/console/src/index.css` forces every animation and transition
to `0.01ms !important` under the same query.

`console-locks.spec.ts` assertion 6 proves it. **Positive control first:** with
motion allowed, the reason dialog must start an animation of ≥100ms. Without
that, the test passes on a page with no motion at all. Then, with the media
feature **emulated**, every animation and transition that starts on the page,
the dialog or a toast must be ≤1ms.
