# `/reset-password` — motion

The gate's frame, so the gate's motion: `design/templates/console/signin/motion.md`
owns the detail. What this page adds:

| What moves | How | Duration | Reduced-motion path |
|---|---|---|---|
| **The POST readout counts up** (`AUTH`, `LINK`, `SERVER`, `PASSWORD`) | per line, opacity 0 → 1, 90ms apart | `--dur-base` | **Skipped**: every line on the first frame |
| **The bus backdrop** | `@octa/tokens/backdrop.css` | 24–60s, infinite | **Still** |
| **A fault arrives** | `.gate-fault`: `octa-fade-in` | `--dur-fast` | **Cut** |
| **Saving…** spinner | `animate-spin` | 1s, infinite | **Still**; the word carries it, and past 3s a `role="status"` line says so |
| `SERVER` line: `WAKING` → `ONLINE` / `NO ANSWER`, and its sentence past 3s | none. Words | — | Same |
| **"Password changed" toast** on `/locks` | `octa-rise-in` (shared `.toast`) | `--dur-fast` | **Cut** |

The three states (form, expired, no link) are separate first renders, decided
by the address. Nothing transitions between them.

Proved by `console-password-reset.spec.ts` assertion 6: a positive control,
then ≤1ms for everything on the recovery form with both hints showing, under
emulated reduced motion.
