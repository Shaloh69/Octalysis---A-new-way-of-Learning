# `/app/settings` — SPEC

Ruling 2 (30 Sep 2026, `WEB-REMAKE.md` §8 row 9): the HUD's panels, the
accent, no theme picker. Gate: `design/specs/web-settings.spec.ts` (and
`student-states.spec.ts`).

## Realm

The star system: `html[data-realm="star"]`, no biome; the star shell.

## Panels, and the controls against the four tests (`DESIGN-MANDATE.md` §1)

| Panel | Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|---|
| **Accent** | 13 named radios: **Seeded** (the hue the cosmetics seed gave, checked until the student picks) and the twelve presets (`@octa/tokens/accents`) | Repaints `--accent-hue` at once (the whole HUD is the preview); one toast; persists per browser | The name is the control; the swatch is decorative (WCAG 1.4.1) | Pick again, or Seeded (forgets the choice) | Their own place, marked the same everywhere |
| **Your system** | none | — | The callsign in mono, and what it is | — | — |
| **Keyboard** | **Single-key shortcuts** switch (`role="switch"`) | Turns M, F and the rest on or off (WCAG 2.1.4); one toast | On/Off in words; the page's shortcuts listed with their caps | Switch back | — |
| **Motion** | none: states the device's reduce-motion setting | — | In words | — | Why the map may be still |

Removed by ruling 2: the three-theme picker (one star HUD; a biome per planet).

Swatches are derived in `packages/tokens/looks.css` (`[data-swatch]`, the star
set's accent lightness and chroma at the preset's `--swatch-hue`), so no colour
is written outside the tokens package; `_gate.ts` skips `[data-swatch]` in its
token check, because each is deliberately not the current accent.

## Captures (opened, 30 Sep 2026, build at 5185, student 232129006)

`current` and `current-380`, full page (the fixed bars land mid-image in a
full-page capture; an artifact of the capture).
