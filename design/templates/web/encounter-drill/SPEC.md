# Clock Bench: moon 02.8's Drill, SPEC

WEB-REVAMP §3.6 (approved by the instructor, 30 Sep 2026); GAME-DESIGN.md §11
(stage 02, archetype B, "The Clock Bench": turn frequency into period ↔
compute performance). Template: `template.png`, Stardew Valley's settings
screen (see `SOURCE.md`). Gate: `design/specs/web-encounter-drill.spec.ts`;
sourcing and arithmetic: `apps/web/test/clock-bench.spec.ts`.

## What it is, and why it is a bench and not a quiz

GAME-DESIGN §11 describes "a frequency dial; cycle time, MIPS and speedup read
out live. Then rapid-fire drill with infinite re-roll." **The rapid-fire,
re-rolled drill already exists: it is this moon's journey**, P items solved and
marked by the server, re-seeded every entry. A second drill marked in the
browser would be client-side scoring, which apps/web forbids. So the encounter
is the bench half: the book's own situation, with dials.

- **The situation is the book's**: Example 2.2 (Stallings ch. 2, §2.4), two
  million instructions on a 400-MHz processor, the four instruction types with
  their CPI and mix, printed as the book prints them
- **Two dials**, native `<input type=range>` (keyboard for free): the clock
  frequency (100 to 4,000 MHz) and the share of memory references that miss the
  cache (0 to 30%, the difference to or from arithmetic and logic, so the mix
  stays at 100%: stage 02's callout, "Fix the cache…")
- **The book's relations answer**, each named with its formula: cycle time
  t = 1/f, CPI = Σ(CPIᵢ × fractionᵢ), MIPS rate = f / (CPI × 10⁶), processor
  time T = Ic × CPI × t. Every value in mono
- **At the book's settings it reads what the book reads** (CPI 2.24, 178.6
  MIPS, 2.500 ns, 11.20 ms), and only then quotes the book's own sentence of
  the result. Back to the book's example restores them
- **Every quoted string is tested against the source**, including that each
  relation sits in the section cited (§2.4), watched failing on a wrong
  citation; the arithmetic is tested to reproduce the book's result
- **Not on the bench, and said here:** speedup (Amdahl, stage 02's §MFLOPS
  section) and MFLOPS, for which the source gives a formula but no situation
  to put on a dial. The moon's questions cover them

## What it owes

| Rule | Held by |
|---|---|
| Grades nothing | nothing to answer: no input but the dials, no verdict words; asserted |
| Records and sends nothing | no API request while the dials turn; asserted |
| Never the only path | the moon's questions above it; mastery only from them (3.7a) |
| Never dresses an assessment | not inside `[data-runner]`/`[data-paper]`, and neither inside it; asserted. Theme `switchboard` |
| AA in all seven biomes | computed on the bench, at the book's settings and turned |
| Lazy | its own chunk (`ClockBench`, 1.9 KB gz), requested only on moon 02.8, absent from `dist/index.html` |

The gate's token probe learned the encounter themes' four tokens while this
was built (`design/specs/_gate.ts`): the switchboard panel's colours are
`packages/tokens`' `--enc-*`, and the probe had never met one because no
encounter had rendered before.

## Controls

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Clock frequency dial | every readout answers at once | its value printed beside it, in mono | turn it back; Back to the book's example | the period is the frequency's reciprocal, and MIPS moves with it while CPI does not |
| Cache-miss dial | the mix changes, and CPI with it, 0.07 a point | the table shows the new mix | as above | a cache miss costs more than a clock increase buys back |
| Back to the book's example | restores 400 MHz and 10% | disabled when already there | turn a dial again | the book's own numbers, and its sentence |

## Captures (30 Sep 2026, build at 5185, reduced motion; all opened)

`current` (jungle, the book's settings), `current-turned` (cave, 1,200 MHz and
25% misses), `current-page` (arctic, the journey with its bench below the
paper); each at 1440 and `-380`.
