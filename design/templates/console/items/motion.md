# `/items` — motion

The console's budget is small: `CLAUDE.md` allows one orchestrated moment per
stage in the student app, and the console has none. Everything here is a local
state change, 120–200ms, from `packages/tokens` (`--dur-fast` = 160ms,
`--ease-out`). Nothing here is the only signal of anything: every state these
ease into is readable from a still frame.

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| Review and import dialogs **open** | `octa-pop-in`: opacity 0→1, scale 0.97→1 | `--dur-fast` | **Cut.** Appears in place |
| Review and import dialogs **close** | `octa-fade-out` (Radix keeps the dialog mounted until it ends) | `--dur-fast` | **Cut** |
| A decision **advances** the dialog to the next item | `.ease-swap`: the new item's body fades in | `--dur-fast` | **Cut**; the status line "01-x approved. Showing the next item." carries it |
| Re-roll | the same `.ease-swap` on the new instance | `--dur-fast` | **Cut** |
| Table rows after a **filter or page change** | `.bank-rows`: fade in | `--dur-fast` | **Cut** |
| Row **hover** | background-colour transition | `--dur-fast` | **Cut** |
| **Toast** enters | `octa-rise-in`: opacity + 0.5rem rise | `--dur-fast` | **Cut** |
| **Bulk bar** appears | `octa-rise-in` | `--dur-fast` | **Cut** |
| **Skeleton** bars | `octa-shimmer`, opacity 1→0.45→1, infinite | `--dur-base` × 6 | **Still.** The bars stay, unanimated |

## How "cut" is implemented, and proved

Two mechanisms, both already in place before this page:

1. `packages/tokens` sets every `--dur-*` to `0ms` under
   `prefers-reduced-motion: reduce`, and every animation here is written in
   those tokens.
2. `apps/console/src/index.css` forces `animation-duration` and
   `transition-duration` to `0.01ms !important` under the same query.

`console-items.spec.ts` assertion 6 proves it rather than assuming it. With
motion allowed, the review dialog must start an animation of ≥100ms: that is
the **positive control**, without which the test passes on a page with no motion
at all, which this page was. Then, with the media feature **emulated**, every
animation and transition that starts on the route's surfaces (page, dialogs,
toasts) must be ≤1ms. They are recorded by a capture-phase listener, because a
160ms entrance is over before a round trip to the page can see it.

## Deliberately not animated

- **The skeleton's arrival.** It appears after ~400ms and is replaced by rows
  in the same space. Animating that swap would make the content look like it
  moved after it landed.
- **The dialog overlay.** It belongs to the shared `Dialog` primitive, which is
  another route's concern. Its scrim renders no colour at all today; parked in
  `docs/NEXT-SESSION.md`.
