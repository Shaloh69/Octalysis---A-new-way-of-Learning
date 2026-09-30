# Bus Contention: moon 03.9's Bus wiring, SPEC

WEB-REVAMP §3.6 (placements approved by the instructor, 30 Sep 2026);
GAME-DESIGN.md §10.3 (stage 03 is the Phaser one: "the shared bus visibly
constricting is the lesson") and §11 (stage 03, archetype D, "Bus Contention":
assemble the interconnection ↔ explain the bottleneck). Moon 03.9's objective:
*Enumerate the elements of Bus design.* Template: `template.png`, Mini Metro in
game (see `SOURCE.md`). Gate: `design/specs/web-encounter-bus.spec.ts`;
sourcing and rules: `apps/web/test/bus-contention.spec.ts`.

## Where it lives

Below the moon's journey (`/app/stage/03/moon/03.9`), in its own section
wearing stage 03's encounter theme (`data-encounter="circuit"`), inside the
planet's biome, through `MoonEncounterSlot` like every moon encounter. **It
never wraps the paper**: runner and encounter are siblings (asserted both ways).
The map's moon panel names it: "Bus Contention, a bus wiring beside its
questions" (`encounters/registry.ts`).

**Phaser, lazy, and only here** (GAME-DESIGN §10.2; R4.5). Two chunks, each
requested only on moon 03.9: `BusContention` (5.4 KB gz) and `bus-scene`
(341.8 KB gz, all of Phaser 3.90). `bus-scene.ts` is the only importer of
`phaser` in apps/web and is itself reached only by a dynamic import inside
`BusContention`. Measured 1 Oct 2026: `dist/index.html` references the entry
script alone and names neither chunk; the entry chunk (106.0 KB gz) contains no
Phaser; another moon of the same planet (03.10) fetches neither chunk. All
three asserted.

## What it is

Figure 3.16 (Stallings ch. 3, §3.4) on a bench, in three steps beside a live
drawing of the bus:

- **The bus.** A processor, a memory and two I/O modules over the book's three
  groups of lines, drawn by Phaser: taps where a module is wired, requests
  waiting as squares above their module (the template's riders), the
  transmitter outlined, and each cycle one packet crossing the data lines.
  The data lines are drawn thicker as the bus widens. Beside it, always, the
  readout: the bus cycle, what the **control**, **address** and **data** lines
  carry this cycle, and who is waiting; then the book's sentence for what just
  happened and the book's meaning of every control signal raised.
- **1 · Wire it.** A table, module by group of lines; each cell a toggle
  (`aria-pressed`). Each group's job is quoted beneath. A module can ask for the
  bus only on all three groups, and only once memory is too; the reason is
  printed ("Tap Processor onto the control lines first: a bus request travels
  on them.").
- **2 · Ask for it.** A request per module (the processor reads an instruction
  from memory; an I/O module writes to memory directly, DMA), each with the
  book's sentence for that transfer; Everyone asks at once; Step one bus
  cycle; Run / Pause; Clear the traffic.
- **3 · Change the bus.** The data bus width (8, 16, 32, 64 lines): a 64-bit
  instruction takes 64 ÷ width accesses, and at 32 the book's own example is
  quoted ("the processor must access the memory module twice"). The grant
  switch: with bus request and bus grant off, every module with a request
  drives the lines in the same cycle, and two at once **garble**, nothing
  arrives, and the book's sentence says why.

**Every sentence about a bus is the book's**, quoted and cited (§3.3, §3.4,
§3.5). `bus-contention.spec.ts` checks each against `ch-03.md` (watched
failing on a one-word change, 1 Oct 2026), and the gate spec checks every `<q>`
on the rendered bench too.

**What the bench simplifies, printed on it:** grants go in the order asked,
and an I/O transfer takes one bus cycle. The book names arbitration and leaves
its methods to Appendix C, which the sources do not carry.

**Not the 9th edition's table.** The extract's §3.4 has no "Elements of Bus
Design" table (type, arbitration, timing, width, data transfer type); the bench
teaches the elements the extract does carry: the shared medium, the three
groups of lines, width, the control signals, and obtaining the bus before
transferring. Bus timing (synchronous / asynchronous) is therefore not here.

## When the canvas cannot run

No 2D canvas, or the scene's chunk fails to load (the spec aborts it): the
same bus is drawn in the DOM (`.bus-fallback`: the modules with their taps and
waiting requests, the transmitter outlined, the three groups of lines, the data
lines as thick as the width, a hatched line when garbled), a notice says so,
and every control is unchanged. Asserted: fallback shown, notice shown, the
whole wire → ask → step path works, nothing clipped, no horizontal scroll.

## What it owes, and does

| Rule | Held by |
|---|---|
| Grades nothing (apps/web: no client-side scoring) | no score, verdict or tally in the model or on the page; asserted on the rendered text and the state's keys |
| Records and sends nothing | no API request while wiring, asking, stepping or clearing; asserted |
| Never the only path | the moon's questions are on the page above it, untouched; mastery comes only from them (3.7a) |
| Never dresses an assessment | asserted: no `[data-runner]`/`[data-paper]` inside `[data-encounter]` and none around it |
| Keyboard, the whole encounter | every control is a DOM button, radio or checkbox; the spec wires nine taps with Space, asks, steps, turns the width with arrows and the grant with Space |
| The canvas is presentation | `aria-hidden`; a click on a module or a tap point is a shortcut to the same handler as its button, measured at click time |
| AA in all seven biomes | computed, unwired and contended |
| No literal colour | the canvas reads the page's tokens at run time and resolves them (OKLCH included) through a 2D context |

## Controls

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Wire / Wired (a module × a group) | taps the module onto those lines, or off | the column's group, the pressed state, the drawing | press again | the three groups are the elements being enumerated |
| Wire every module | all twelve taps at once | disabled once all are wired | a tap at a time | — |
| *Module*: request the bus | raises a bus request; a square waits above the module | disabled with the reason until wired; the book's sentence for its transfer | Clear the traffic | a module must obtain the bus before it transfers |
| Everyone asks at once | one request from each module that may | the waiting line | Clear the traffic | contention, at once |
| Step one bus cycle | one cycle: who transmits, what each group of lines carries, who waits | the readouts, the drawing, a polite status; disabled with the reason when nobody asked | — (time moves on) | only one device at a time can transmit |
| Run / Pause | a cycle every 700 ms until nobody waits | `aria-pressed`, the readouts | Pause | the queue draining |
| Clear the traffic | empties the requests and the cycle count; wiring and dials stay | the readouts return to idle | ask again | — |
| Data bus width (radios) | the accesses a 64-bit instruction takes, and so how long the processor holds the bus | the sentence beside it; the data lines' thickness | another width | width sets bits per transfer (the book's example at 32) |
| Bus request and bus grant (checkbox) | off: every asker drives the lines at once, and two garble | the sentence beside it changes; the readout says garbled | tick it | why the control lines exist |

## Captures (1 Oct 2026, build at 5185, reduced motion; all opened)

`current` (jungle, unwired), `current-contended` (city, two requests each,
one cycle), `current-garbled` (desert, grant off), `current-fallback` (arctic,
scene chunk aborted), `current-page` (ocean, the journey with its encounter
below the paper); each at 1440 and `-380`. Reproduce with `OCTA_CAPTURE=1`.

Found by looking, not by the gate: the first 1440 capture had the wiring table
running past its panel's frame (on screen, so "nothing clipped" passed). Fixed
(fixed table layout), and gate 1 now also asserts nothing leaves its panel
(watched failing on the old build). The first 380 capture had the line names
drawn over the tap wires; they now sit on a chip.
