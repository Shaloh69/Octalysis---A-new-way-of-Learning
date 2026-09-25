# `/forgot-password` — motion

The same frame as `/signin`, so the same motion: `design/templates/console/signin/motion.md`
owns the detail. Recorded here is only what this page adds or leaves out.

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| **The POST readout counts up** (`AUTH`, `LINK`, `MAIL`) | per line, opacity 0 → 1, 90ms apart | `--dur-base` | **Skipped**: every line on the first frame |
| **The bus backdrop** in the right half | `@octa/tokens/backdrop.css` | 24–60s, infinite | **Still** |
| **A fault arrives**, or **the "on its way" panel replaces the form** | `.gate-fault`: `octa-fade-in` | `--dur-fast` | **Cut**. It appears in place |
| **Sending…** spinner | `animate-spin` | 1s, infinite | **Still**; the word carries it, and past 3s a `role="status"` line says the service is slow |
| `MAIL` line: `WAITING` → `SENDING` → `REQUESTED` / `FAULT` | none. The words change | — | Same |

No toast: the panel that replaces the form is the confirmation, where the
teacher is already looking.

**Not woken here:** this page does not wake the API. Whoever uses it is about to
leave for their inbox, and `/reset-password`, where they come back, does the
wake.

Proved by `console-password-reset.spec.ts` assertion 6: a positive control
(the readout counts up with motion allowed), then every animation and transition
through a failed request ≤1ms under emulated reduced motion.
