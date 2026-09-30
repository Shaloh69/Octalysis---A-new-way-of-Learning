# Bus wiring (moon 03.9, Bus Contention): template source

`template.png`: **Mini Metro, in game**, from
https://interfaceingame.com/screenshots/mini-metro-in-game/ (HTTP 200),
image https://interfaceingame.com/wp-content/uploads/mini-metro/mini-metro-in-game.jpg
(HTTP 200, image/jpeg, 196,107 bytes, 1600×900; converted to PNG, same pixels).
Captured 1 Oct 2026 with curl. **Opened before use.**

**Why this one.** GAME-DESIGN.md §10.3 says of stage 03: "the shared bus visibly
constricting is the lesson". Mini Metro is that picture exactly: stations on
shared lines, and riders piling up at a stop when the line cannot carry them.
The wiring games first looked for (SHENZHEN I/O, TIS-100, Turing Complete,
Factorio, Opus Magnum) have no page on interfaceingame.com (all HTTP 404, 1 Oct
2026), and a circuit-board editor would have taught routing, not contention.

| In the template | Taken as |
|---|---|
| Stations joined by coloured lines | Figure 3.16's modules (CPU, memory, two I/O) tapped onto the bus's three groups of lines |
| The line picker down the right edge | The wiring table: one column per group of lines (data, address, control) |
| Riders waiting beside a station | A module's raised bus requests, drawn as squares above it until it is granted |
| One train moving along a line | One packet crossing the data lines per bus cycle |

**Not in the template, and ours:** the readouts of what each group of lines
carries this cycle, the book's sentences, the width dial and the grant switch.
The frames are the planet's sprite panels (`_direction/biome/`), as on every
moon encounter.

Copyright: a screenshot of a commercial game, kept as a reference artifact
only. Nothing from it ships.
