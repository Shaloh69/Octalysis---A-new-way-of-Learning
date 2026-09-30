# Cache Tuner: moon 04.5's Cache drill, SPEC

WEB-REVAMP §3.6 (approved by the instructor, 30 Sep 2026); GAME-DESIGN.md §11
(stage 04). Objective 04.5: "Compute for cache addresses and size". Template:
`template.png`, the Clock Bench's (see `SOURCE.md`). Gate:
`design/specs/web-encounter-cache.spec.ts`; sourcing and arithmetic:
`apps/web/test/cache-tuner.spec.ts`.

## What it is

The book's Example 4.2 on a bench (Stallings ch. 4, §4.3): a 24-bit address
for 16 MB of byte-addressable main memory, quoted at the top.

- **Two dials**, powers of two: cache size (1 KB to 1 MB) and line size (4 to
  128 bytes). **The mapping** as five radio buttons: direct, 2-, 4- and 8-way
  set associative, fully associative
- **The address, drawn**: TAG | LINE or SET | WORD, each field's width in
  proportion to its bits and its bit count printed in mono; fully associative
  has no index field at all
- **The relations, each with its value**: lines = cache size / line size,
  sets = lines / ways, WORD = log₂(bytes per line), LINE or SET = log₂(lines
  or sets), TAG = 24 − the rest (stage 04's reading states them so)
- **Five worked examples from the sources**, and on each the bench quotes it:
  the book's 4.2a (direct: 8 / 14 / 2), 4.2b (associative: 22 / 2), 4.2c
  (2-way: 9 / 13 / 2), and the reading's direct (8 / 12 / 4) and 4-way
  (10 / 10 / 4). Two buttons jump to the book's and the stage's. Every quote is
  tested against its file and every example against the arithmetic (watched
  failing on a wrong figure)

## Not built, and why

GAME-DESIGN §11 imagined a **live hit-rate meter** ("beat 90%"). A hit rate
needs an address trace, and no source gives one; a trace made up here would be
invented content (hard rule 5). The bench computes what the objective asks for,
the address fields and the sizes. If the instructor wants the meter, it needs
a sourced trace first (recorded in `NEXT-SESSION.md` §0x).

## What it owes

| Rule | Held by |
|---|---|
| Grades nothing | nothing to answer; no verdict words, no "hit rate"; asserted |
| Records and sends nothing | no API request while it changes; asserted |
| Never the only path | the moon's questions above it; mastery only from them (3.7a) |
| Never dresses an assessment | asserted both ways; theme `retro` |
| AA in all seven biomes | computed on the bench, direct and 4-way |
| Lazy | its own chunk (`CacheTuner`, 2.1 KB gz), absent from `dist/index.html` |

## Controls

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Cache size dial | lines, and the LINE or SET field, answer at once | its size printed in words | turn it back; the example buttons | more lines, more index bits, a shorter tag |
| Line size dial | WORD grows, the index shrinks | as above | as above | a longer line is more WORD bits |
| Mapping | direct, k-way, or fully associative | the field changes name, LINE or SET, or goes | choose another | "Notice the tag grew" (the reading): associativity trades index bits for tag bits |
| The book's Example 4.2 / Stage 04's example | the sources' own settings | the quote appears | change anything | the worked example, in the source's words |

## Captures (30 Sep 2026, build at 5185, reduced motion; all opened)

`current` (desert, the book's example), `current-4way` (ocean, the reading's
4-way), `current-associative` (city, fully associative); each at 1440 and `-380`.
