# Two Columns: moon 01.2's Sort, SPEC

WEB-REVAMP §3.6 (placements approved by the instructor, 30 Sep 2026);
GAME-DESIGN.md §11 (stage 01, archetype A, "Two Columns": classify a decision
↔ distinguish architecture from organization; the §8.3 verb test passes).
Template: `template.png`, Stardew Valley's chest (see `SOURCE.md`). Gate:
`design/specs/web-encounter-sort.spec.ts`; sourcing: `apps/web/test/two-columns.spec.ts`.

## Where it lives

Below the moon's journey (`/app/stage/01/moon/01.2`), in its own section
wearing the stage's encounter theme (`data-encounter`, stage 01: `base`),
inside the planet's biome. **It never wraps the paper**: the runner and the
encounter are siblings, and `data-encounter` is applied only by
`MoonEncounterSlot` and the reader's LAB block (grep, 30 Sep 2026). Its code is
its own lazy chunk (`TwoColumns`, 2.1 KB gz), requested only on moon 01.2 and
absent from `dist/index.html`. The map's moon panel names it ("Two Columns, a
sort beside its questions", §3.2 item 3), from `encounters/registry.ts`.

## What it is

- **Two framed columns**, Architecture and Organization, each headed by the
  book's own definition, quoted and cited; **To sort** beneath, as the chest
  sits over the inventory
- **Twelve cards, six a side, every word quoted** from Stallings ch. 1 §1.1
  (`docs/source/book/ch-01.md`) or stage 01's authored reading
  (`content/stages/01.md`), and so is the sentence that places each. Hard rule
  5 is a test: an invented or reworded card fails `two-columns.spec.ts`
  (watched failing, 30 Sep 2026)
- **Every move is a button**: a card goes to either column, back to the tray
  (Unsort) or across (To Organization / To Architecture). No drag, so no drag
  fallback is needed; keyboard and tap are the same path
- **Compare with the book** waits until every card is placed, then takes focus.
  After it, each card says **"The book puts it under X."**, the book's sentence
  and its citation, whichever column the student chose: the same sentence for
  every card, so there is no verdict word
- **Sort again** starts over and returns focus to the heading

## What it owes, and does

| Rule | Held by |
|---|---|
| Grades nothing (apps/web: no client-side scoring) | no score, no tally, no right/wrong words; asserted on the compared text |
| Records and sends nothing | no API request while sorting, comparing or starting over; asserted |
| Never the only path | the moon's questions are on the page above it, untouched; mastery comes only from them (3.7a) |
| Never dresses an assessment | asserted: no `[data-runner]`/`[data-paper]` inside `[data-encounter]` and none around it |
| AA in all seven biomes | computed, sorting and compared; words on sprites by `packages/tokens`' decoded-sprite test |

## Controls

| Control | Consequence | Legibility | Reversibility | Teaching |
|---|---|---|---|---|
| Architecture / Organization (a card in To sort) | places the card in that column | the column's name; a status line says where it went and how many are left | Unsort, or To the other column | classifying a design decision is the objective's verb |
| Unsort / To … (a placed card) | moves it back or across | the verb and the column | the other button | — |
| Compare with the book | shows where the book puts every card, and why | disabled until every card is placed, with the reason beside it | Sort again | the book's own sentence for each card |
| Sort again | clears the columns | the verb | sort again | — |

## Captures (30 Sep 2026, build at 5185, reduced motion; all opened)

`current` (jungle, nothing sorted), `current-sorting` (city, six placed),
`current-compared` (desert, all compared), `current-page` (ocean, the journey
with its Sort below the paper); each at 1440 and `-380`.
