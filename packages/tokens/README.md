# packages/tokens

The single source of colour, type, space, and motion for OCTA.

| File | What |
|---|---|
| `tokens.css` | Three themes + the register cast, all in OKLCH. 80 tokens. |
| `accents.ts` | The twelve accent presets and the apply function. |
| `elements.svg` | 19 symbols: register cast, stage node states, depth gauge, subsystems. |

## Rules

**Never write a literal hex outside this package.** `.claude/hooks/guard.mjs` blocks it. The
per-student accent system depends on every colour flowing through a token.

**Never derive semantic colours from the accent.** Red always means danger, regardless of what
hue the student chose. Deriving semantics from a primary breaks both learned meaning and
colour-blind safety.

## Themes

`data-theme` on `<html>`: `bare-metal` (default, dark) · `blueprint` (light) · `phosphor`
(CRT, high contrast).

## Accent

`--accent-hue` is set on `<html>` from `profiles.accent_hue`. Lightness and chroma are fixed
per theme; only hue varies. That's the whole trick — OKLCH is perceptually uniform, so a fixed
L holds contrast constant across every hue. HSL cannot do this.

```ts
import { applyAccent, accentById } from "@octa/tokens/accents";
applyAccent(accentById(profile.accent).hue);
```

## Elements

```html
<svg class="reg-icon" style="color: var(--reg-mar)">
  <use href="/elements.svg#octa-reg-mar" />
</svg>
```

Every symbol is stroke-based and inherits `currentColor`, so it themes for free.
Each has a `<title>` for screen readers.

## Fonts

Space Grotesk (display) · Inter (body) · JetBrains Mono (data). Self-host; don't hotlink Google
Fonts — a lecture hall on Philippine campus wifi should not wait on fonts.google.com.
