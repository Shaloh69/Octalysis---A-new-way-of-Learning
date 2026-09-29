# The shell — SPEC

`WEB-REMAKE.md` §2, §3, §5 (rulings of 30 Sep 2026). Two shells, decided by the
route: the STAR shell on every hub route, the BIOME shell inside a planet.
Gate: `design/specs/web-shell.spec.ts`.

## Realm

- Star shell: `/app`, `/app/stages`, `/app/progress`, `/app/work`,
  `/app/settings`. `html[data-realm="star"]`, no `data-biome`, no `data-theme`.
- Biome shell: `/app/stage/:id` and `/app/stage/:id/check`.
  `html[data-realm="biome"][data-biome=<the planet's>]`.

## Controls, against the mandate's four tests

Consequence (it changes what the student knows, can do or can see) ·
legibility (it says what it does) · reversibility · teaching.

| Control | Where | Consequence | Legible | Reversible | Teaching |
|---|---|---|---|---|---|
| The five tabs (Map, Stages, Progress, Your work, Settings) | star nav; bottom bar at 640 and under | goes to that part of the course | the page's name | Back, or another tab | the course's parts, always in view |
| ← / → | star nav, 1440 only | the previous / next tab | "Previous: Stages" | the other arrow | — |
| Continue / Start | mission panel | opens the next stage (`lib/next-stage.ts`) | says which stage and why | Leave planet | the next step, in words |
| Sign out | readout strip | ends the session on a shared PC | yes | sign in | — |
| Key hints (M Map, F Report a problem, and the page's own) | bottom right, 1440 | the same as the key | label and cap | per action | the keys exist |
| Leave planet | biome nav | the map, this planet selected | yes | Enter journey | where the planet sits |
| Reading / Check | biome nav (bottom at 899 and under) | the planet's pages; Check only when one is open | yes | the other tab | — |
| Report | biome nav | opens the report dialog | yes | Close / Escape | — |
| Report a problem dialog: category, text, Send, Close | a dialog above everything | files a report (with the attempt's variant during a check) | yes | Close | — |

Removed, by ruling: the theme picker (no variants), the 2D map and its
Settings override, the floating "Report a problem" bar, the Depth Gauge rail.

## What it shows

- Star: the readout strip (the registers in their cast colours), the tab
  strip, the mission panel (next stage, its step, the depth meter L6 to L0,
  named from stage 11), the key-hint bar.
- Biome: the planet's biome scene behind everything; a sprite nav bar
  (Kenney panel sprite) with sprite buttons (Kenney button sprite, the
  pressed sprite on the current tab and on `:active`); the registers as a
  sprite bar with cast-colour pips; the key hints as a sprite bar.

## States

Loading: the mission panel shows a skeleton line. Offline: a banner under
the nav, in words. A route change closes the report dialog.
