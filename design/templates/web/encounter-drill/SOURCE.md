# The Drill bench (a moon's computation encounter): template source

`template.png`: **Stardew Valley, the settings screen**, from
https://interfaceingame.com/screenshots/stardew-valley-settings/ (HTTP 200),
image https://interfaceingame.com/wp-content/uploads/stardew-valley/stardew-valley-settings-1920x1080.png
(HTTP 200, image/png, 881,851 bytes, 1920×1080). Captured 30 Sep 2026 with
curl, as `_direction/biome/` was. **Opened before use.** (The
`stardew-valley-options` page answered 404; this is the game's own options
screen under its published name.)

| In the template | Taken as |
|---|---|
| One framed panel over the live world | The bench's panels, in the planet's sprites, over the biome |
| A column of controls, each with its label beside it | The two dials (clock frequency, cache-miss share), each labelled, its value printed beside it |
| Controls that take effect at once, no Save | The readouts answer as a dial moves; nothing is submitted |

**Not in the template, and ours:** the readouts and the book's table. This
screen shows toggles and drop-downs, not sliders; the dials are native
`<input type=range>` (GAME-DESIGN.md §10.3: keyboard-accessible for free),
drawn in the page's tokens.

Copyright: a screenshot of a commercial game, kept as a reference artifact
only. Nothing from it ships.
