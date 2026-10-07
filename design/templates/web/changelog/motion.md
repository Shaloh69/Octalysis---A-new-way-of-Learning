# /app/changelog — motion

| What moves | How | Reduced motion |
|---|---|---|
| "What's new" in the top strip, on hover | `color`, `--dur-fast` (160ms), `--ease-out` | cut (base.css's reduced-motion rule) |
| The page | nothing of its own: the shell's starfield as on every star page | the shell's own rule |

Asserted by `web-changelog.spec.ts` 6, at 1440 (one width is enough, as for
/app/settings).
