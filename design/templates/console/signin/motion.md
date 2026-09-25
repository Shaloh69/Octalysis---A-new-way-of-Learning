# `/signin` — motion

This is the console's one theatrical screen. `DESIGN-REFERENCES.md` §7: the auth
screens are where the design mandate spends its boldness, and the boldness goes
into **motion and rhythm, not colour**. The whole sequence is under a second.
Everything else here is a local state change from `packages/tokens`
(`--dur-fast` = 160ms, `--dur-base` = 240ms, `--ease-out`). Nothing is the only
signal of anything: every state these ease into is readable from a still frame.

The same applies to all three gate screens (sign-in, student account,
credential change), because they share `GateFrame`.

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| **The POST readout counts up.** One line appears every 90ms, then the verdict (`CONSOLE READY`) | per line, an opacity transition 0 → 1 | `--dur-base`, lines staggered 90ms; ≈ 0.7s for five lines | **Skipped, not shortened.** Every line is at full opacity on the first frame. Read once, in a ref, before the first paint, so there is no flash of the animated first frame |
| **The bus backdrop** in the right half: grid drift, accent bloom, pulses along the traces | `@octa/tokens/backdrop.css`, `transform` and `opacity` only | 24–60s, infinite | **Still.** The static grid and traces stay; nothing moves |
| **A fault arrives** under the fields | `.gate-fault`: `octa-fade-in` | `--dur-fast` | **Cut.** It appears in place. Never a shake, never a flash |
| **The readout halts**: `AUTH FAULT`, `CONSOLE HALTED` | none. The words change | — | Same. It is words, and the real message is the `role="alert"` beside the form |
| **Checking…** spinner in the button while a sign-in is in flight | `animate-spin` on the icon | 1s, infinite | **Still.** The word "Checking…" carries it, and past 3s a `role="status"` line says the service is slow |
| **The `SERVER` line** (the API wake): `WAKING` → `ONLINE` / `NO ANSWER`, and past 3s a sentence under the form | none. The words change | — | Same. The sentence is `role="status"`, and it goes when the server answers |
| **Show-password** toggle, link and button hovers | colour transition | `--dur-fast` | **Cut** |
| **"Signed in as …" toast** on the page the teacher lands on | `octa-rise-in` (the shared `.toast`) | `--dur-fast` | **Cut** |

## What never moves

- **Focus.** The sequence never takes it and never traps it. Someone who tabs
  into the password field while the readout is still counting keeps it.
- **The form.** It is usable from the first frame. The readout decorates a
  working form; it is never a gate in front of one.
- **The layout.** A fault inserts one line above the button and nothing
  reflows around it afterwards.

## How "skipped" is implemented, and proved

1. `GateFrame` reads `prefers-reduced-motion` once, before the first paint, and
   starts the readout at its end state.
2. `packages/tokens` sets every `--dur-*` to `0ms` under the query, and
   `apps/console/src/index.css` forces animation and transition durations to
   `0.01ms !important`, which stops the backdrop and the spinner.

Assertion 6 in `console-gate.spec.ts` and `console-bootstrap-credentials.spec.ts`
proves it rather than assuming it. **Positive control first:** with motion
allowed, the readout must start transitions of at least 100ms inside `<main>`,
or the test fails on a page with no motion at all. Then, with the media
feature emulated, every animation and transition that starts inside `<main>`
through a failed sign-in must be ≤1ms, and every readout line must already be
at full opacity. On the old credential screen the positive control is what
went red: that screen had no motion at all.
