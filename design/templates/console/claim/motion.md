# `/claim` (console) — motion

The same frame as `/signin`, so the same motion: `design/templates/console/signin/motion.md`
owns the detail. Recorded here is only what this page adds or leaves out.

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| **The POST readout counts up** (`ROSTER`, `ROLE`, `CLAIM`) | per line, opacity 0 → 1, 90ms apart | `--dur-base` | **Skipped**: every line on the first frame |
| **The bus backdrop** in the right half | `@octa/tokens/backdrop.css` | 24–60s, infinite | **Still** |
| **A fault arrives** | `.gate-fault`: `octa-fade-in` | `--dur-fast` | **Cut**. It appears in place |
| **Checking…** spinner | `animate-spin` | 1s, infinite | **Still**; the word carries it, and past 3s a `role="status"` line says the server may be waking |
| `CLAIM` line: `WAITING` → `CHECKING` → `FAULT` | none. The words change | — | Same |

**On success** there is a toast ("Your teacher account is ready.") and the
route changes to `/locks` (or `/signin` if the automatic sign-in fails), with
the shell's own route transition.

Proved by `console-claim.spec.ts` assertion 6: a positive control (the readout
counts up with motion allowed), then every animation and transition through a
failed claim ≤1ms under emulated reduced motion.
